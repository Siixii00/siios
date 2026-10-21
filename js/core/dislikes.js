// 用戶討厭的事：一定要記住，而且不能靠「剛好被檢索到」。
// 一般記憶要查詢句命中才會被想起、也會隨時間淡化；討厭的東西不能這樣——角色一次踩雷就會讓人不舒服。
// 所以另外存一份清單（SettingsDB 的 user_dislikes），每次回覆都固定放進提示詞：
//   - 用戶說「我討厭…」「受不了…」「不吃…」「別再…」時自動記下（文字比對，不用 API）
//   - 記憶消化 API 整理記憶時看出來的，也會加進來（見 memory-system/digest.js）
//   - 同一件事被反覆提到（或用「說過很多次」「千萬」這類語氣強調）次數會累加，標成「反覆強調」
//   - 可以在「記憶設定」手動新增、刪除
// 這個檔案的純函式（抽取、比對、整理、提示詞）不碰瀏覽器，方便測試；存取在最下面。

const MAX_ITEMS = 40;
const MAX_PROMPT_ITEMS = 15;
export const STRONG_COUNT = 2;

// 明確表達厭惡、不能接受的說法。刻意不放單獨的「不要」——「你不要走」「不要這樣說」是一般的請求，不是討厭的東西
const TRIGGER = '(?:最討厭|超討厭|很討厭|真的討厭|非常討厭|討厭|厭惡|不喜歡|不愛|受不了|無法接受|不能接受|不可以接受|最怕|很怕|超怕|害怕|反感|噁心|雷點|地雷|不吃|不碰|不看|不聽|千萬不要|絕對不要|別再|不准|不許)';
const EMPHASIS = /再說一次|說過很多次|說過好幾次|說過了|我說過|都說了|不是說過|再強調|一定要記住|一定要記得|千萬|務必|絕對|記住|別忘了|不要再/;
const SKIP_BEFORE = /(?:不|沒|沒有|並不|不是|並非|你|妳|他|她|它|別人|有人|如果|假如|要是|是不是)$/;
const STOP_AFTER = /[，,。！？!?；;、\n（(「『"]/;

// 從一段使用者的話取出討厭的事，回傳 { phrases: [...], weight }。weight 是這句話的強調程度（1 或 2）
export function extractDislikes(text) {
    const src = String(text ?? '').replace(/\r/g, '');
    const phrases = [];
    const re = new RegExp(TRIGGER, 'g');
    let m;
    while ((m = re.exec(src))) {
        const before = src.slice(Math.max(0, m.index - 3), m.index);
        if (SKIP_BEFORE.test(before)) continue; // 「不討厭」「你討厭…」「如果討厭」
        const after = src.slice(m.index + m[0].length).replace(/^[：:\s是的就]+/, '');
        const end = after.search(STOP_AFTER);
        let phrase = (end === -1 ? after : after.slice(0, end)).trim();
        // 「討厭…嗎」「討厭什麼？」是在問，不是在說自己的感受（只看這一小句，後面另一句的問號不算）
        const clause = src.slice(m.index).match(/^[^，,。！？!?\n]*[！？!?]?/)[0];
        if (/[嗎麼?？]/.test(clause)) continue;
        phrase = phrase.replace(/(?:這件事|的感覺|而已|啦|喔|哦|啊|呢|了)$/, '').trim();
        if (/^不(?:吃|碰|看|聽)$/.test(m[0])) phrase = m[0] + phrase; // 保留動詞：「不吃香菜」
        if (phrase.length < 1 || phrase.length > 20) continue;
        if (/^(?:你|妳|我|他|她|它)$/.test(phrase)) continue;
        phrases.push(phrase);
    }
    return { phrases: [...new Set(phrases)], weight: phrases.length && EMPHASIS.test(src) ? 2 : 1 };
}

const clean = s => String(s ?? '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '').replace(/[的了這那一個]/g, '');
const grams = s => { const g = new Set(); for (let i = 0; i < s.length - 1; i++) g.add(s.slice(i, i + 2)); if (s.length === 1) g.add(s); return g; };

// 兩個說法是不是同一件事：一個包含另一個，或相鄰兩字重疊夠多
export function sameThing(a, b) {
    const x = clean(a), y = clean(b);
    if (!x || !y) return false;
    if (x === y || (Math.min(x.length, y.length) >= 2 && (x.includes(y) || y.includes(x)))) return true;
    // 較短的那句（至少 3 字）依序出現在較長的那句裡：「被忽略」＝「被人忽略」
    const [short, long] = x.length <= y.length ? [x, y] : [y, x];
    if (short.length >= 3) { let i = 0; for (const ch of long) if (ch === short[i]) i++; if (i === short.length) return true; }
    const gx = grams(x), gy = grams(y);
    let shared = 0;
    for (const g of gx) if (gy.has(g)) shared++;
    return shared >= 2 && shared / Math.min(gx.size, gy.size) >= 0.6;
}

// 把新抽到的說法記進清單（純函式，回傳新清單）。同一件事累加次數；強調的語氣一次算 2
export function recordDislikes(list, phrases, { weight = 1, source = 'chat', now = Date.now() } = {}) {
    const out = (list || []).map(x => ({ ...x }));
    for (const raw of phrases || []) {
        const text = String(raw ?? '').trim().slice(0, 40);
        if (!text) continue;
        const hit = out.find(x => sameThing(x.text, text));
        if (hit) {
            hit.count = (hit.count || 1) + weight;
            hit.lastAt = now;
            if (text.length > hit.text.length && !hit.manual) hit.text = text; // 留下說得比較完整的那個
            if (source && !hit.sources.includes(source)) hit.sources = [...hit.sources, source].slice(-5);
        } else {
            out.push({ id: 'dl' + now.toString(36) + Math.random().toString(36).slice(2, 6), text, count: weight, firstAt: now, lastAt: now, sources: source ? [source] : [], manual: source === 'manual' });
        }
    }
    // 太多時，丟掉最不重要的（次數少、很久沒提）；手動新增的不丟
    if (out.length > MAX_ITEMS) {
        out.sort((a, b) => Number(!!b.manual) - Number(!!a.manual) || (b.count - a.count) || (b.lastAt - a.lastAt));
        out.length = MAX_ITEMS;
    }
    return out;
}

// 兩份清單合併（PWA 與 Discord 各自學到的）：同一件事次數取較大、時間取較新（取較大而不是相加，重複同步才不會把次數灌水）
export function mergeDislikeLists(a, b) {
    const out = (a || []).map(x => ({ ...x, sources: [...(x.sources || [])] }));
    for (const y of b || []) {
        if (!y?.text) continue;
        const hit = out.find(x => sameThing(x.text, y.text));
        if (hit) {
            hit.count = Math.max(hit.count || 1, y.count || 1);
            hit.lastAt = Math.max(hit.lastAt || 0, y.lastAt || 0);
            hit.sources = [...new Set([...hit.sources, ...(y.sources || [])])].slice(-5);
            if (y.text.length > hit.text.length && !hit.manual) hit.text = y.text;
            if (y.manual) hit.manual = true;
        } else {
            out.push({ id: y.id || 'dl' + (y.lastAt || 0).toString(36) + Math.random().toString(36).slice(2, 6), text: String(y.text).slice(0, 40), count: y.count || 1, firstAt: y.firstAt || y.lastAt || 0, lastAt: y.lastAt || 0, sources: [...(y.sources || [])], manual: !!y.manual });
        }
    }
    out.sort((p, q) => Number(!!q.manual) - Number(!!p.manual) || (q.count || 1) - (p.count || 1) || (q.lastAt || 0) - (p.lastAt || 0));
    return out.slice(0, MAX_ITEMS);
}

// 放進系統提示詞的段落；沒有就回空字串。次數多的在前面
export function formatDislikePrompt(list) {
    const items = [...(list || [])].filter(x => x?.text).sort((a, b) => (b.count || 1) - (a.count || 1) || (b.lastAt || 0) - (a.lastAt || 0)).slice(0, MAX_PROMPT_ITEMS);
    if (!items.length) return '';
    const lines = items.map(x => `- ${x.text}${(x.count || 1) >= STRONG_COUNT ? `（用戶反覆強調過 ${x.count} 次，絕對不可以碰）` : ''}`);
    return [
        '# 用戶明確討厭／不能碰的事（務必遵守）',
        '以下是用戶親口說過討厭、受不了或不能接受的事。這比一般的喜好與劇情設定更重要：',
        ...lines,
        '要求：不要主動提起、不要建議、不要拿來開玩笑、不要為了劇情或氣氛而違背；遇到相關話題要自然地迴避或換個方式。如果用戶自己提起，表示理解與尊重，不要辯解、不要再追問。'
    ].join('\n');
}

// 世界書與角色設定也寫了「討厭」的話（角色自己的雷點）不在這裡處理——這份清單只屬於「用戶」

// ───── 存取（需要瀏覽器）─────
const KEY = 'user_dislikes';
let queue = Promise.resolve();
const serial = fn => { const run = queue.then(fn); queue = run.catch(() => {}); return run; };

async function store() { return (await import('../db.js')).SettingsDB; }

export async function loadDislikes() {
    try { const v = await (await store()).get(KEY); return Array.isArray(v) ? v : []; } catch { return []; }
}
export async function saveDislikes(list) { await (await store()).set(KEY, list); }

// 記一批說法（消化 API 看出來的、手動新增的都走這裡）
export function addDislikes(phrases, opts = {}) {
    return serial(async () => {
        const before = await loadDislikes();
        const after = recordDislikes(before, phrases, opts);
        if (JSON.stringify(before) !== JSON.stringify(after)) await saveDislikes(after);
        return after;
    });
}

// 使用者說的一句話：自動抽出討厭的事並記下。失敗一律靜默（不能影響聊天本身）
export async function learnDislikesFromText(text, source = 'chat') {
    try {
        const { phrases, weight } = extractDislikes(text);
        if (!phrases.length) return [];
        await addDislikes(phrases, { weight, source });
        return phrases;
    } catch { return []; }
}

export function removeDislike(id) {
    return serial(async () => { const list = (await loadDislikes()).filter(x => x.id !== id); await saveDislikes(list); return list; });
}

// 從 Discord Worker 拉下來的清單合併進本機（回傳是否有變動）
export function mergeRemoteDislikes(items) {
    return serial(async () => {
        const before = await loadDislikes();
        const after = mergeDislikeLists(before, items);
        const changed = JSON.stringify(before) !== JSON.stringify(after);
        if (changed) await saveDislikes(after);
        return changed;
    });
}

export async function getDislikePrompt() { return formatDislikePrompt(await loadDislikes()); }
