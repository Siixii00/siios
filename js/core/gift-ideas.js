// 角色挑禮物：提示詞、解析 AI 回覆、重要日子偵測、主動提議的排程。純函式，不碰瀏覽器與資料庫，方便測試。
import { KIND_IDS, normalizeKind } from './real-shops.js';
import { stripReasoning } from './reasoning-filter.js';
import { sameThing } from './dislikes.js';
import { hashString } from './seeded.js';

export const OCCASIONS = {
    request: { label: '隨便逛逛', hint: '沒有特別的日子，只是想到你。' },
    cheer: { label: '加油打氣', hint: '對方最近可能累了或需要被鼓勵。' },
    thanks: { label: '感謝', hint: '想謝謝對方。' },
    celebrate: { label: '慶祝', hint: '有值得慶祝的事。' },
    user_birthday: { label: '生日', hint: '今天或最近是對方的生日。' },
    anniversary: { label: '紀念日', hint: '是你們的紀念日。' },
    festival: { label: '節日', hint: '是個適合送禮的節日。' },
    event: { label: '行程中的日子', hint: '對方的行事曆上有個重要的日子。' },
    care: { label: '心意', hint: '沒有特別的理由，只是想讓對方開心一下。' },
    return: { label: '回禮', hint: '對方之前送過你東西，你想回一份心意。' }
};

const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const num = v => { const n = Math.round(Number(v)); return Number.isFinite(n) && n >= 0 ? n : null; };

// ───── 提示詞 ─────
export function buildIdeaMessages({ systemPrompt = '', charName = '角色', userName = '對方', occasion = 'request', label = '', budget = { min: 100, max: 1500 }, kinds = [], wishlist = [], past = [], extra = '' }) {
    const oc = OCCASIONS[occasion] || OCCASIONS.request;
    const rules = [
        `# 挑禮物`,
        `你是「${charName}」，要為「${userName}」挑 3 個適合的禮物點子。這些是現實世界買得到的商品，對方會自己決定要不要真的去買。`,
        `場合：${label || oc.label}（${oc.hint}）`,
        `預算：每個約 ${budget.min}～${budget.max} 元新台幣。`,
        kinds.length ? `想要的類別：${kinds.join('、')}。` : '',
        wishlist.length ? `對方的願望清單（可以從裡面挑，也可以挑別的，但要真的適合）：${wishlist.slice(0, 8).map(w => clip(w.name, 30)).join('、')}。` : '',
        past.length ? `已經送過、或對方拒絕過的（不要重複）：${past.slice(0, 15).map(p => clip(p, 20)).join('、')}。` : '',
        extra ? `其他背景：${clip(extra, 300)}` : '',
        '',
        '## 規則',
        '- 用你自己的個性，以及你對對方的了解來挑；要像一個真的在意對方的人，不是型錄。',
        '- 都是常見、買得到的商品類型；不要編造品牌型號或確切價格，價格給一個合理的區間。',
        '- 3 個點子要不同種類、價格有高有低，都在預算內；絕對避開「用戶討厭的事」。',
        '- reason：用你的口吻說一句為什麼選這個（20～40 字）；可以提到你們之間發生過的事，但不要編造不存在的共同經歷。message：送出時說的一句話（25 字內）。',
        `- kind 只能是：${KIND_IDS.join('、')}。`,
        '',
        '## 輸出格式（只輸出 JSON 陣列，不要其他文字）',
        '[{"name":"商品名稱（通用名稱，例如「保溫杯」）","reason":"…","message":"…","price_min":數字,"price_max":數字,"kind":"daily","queries":{"zh":"繁體中文搜尋關鍵字","cn":"簡體中文關鍵字","ja":"日文關鍵字","en":"English keywords"}}]'
    ].filter((l, i, a) => l !== '' || a[i - 1] !== '');
    return [
        { role: 'system', content: [systemPrompt, rules.join('\n')].filter(Boolean).join('\n\n') },
        { role: 'user', content: `請為我挑禮物（${label || oc.label}）。` }
    ];
}

// 解析 AI 回覆。回傳最多 limit 個合格的點子；不合格的略過
export function parseIdeas(text, { limit = 3 } = {}) {
    const clean = stripReasoning(String(text ?? ''));
    const m = clean.match(/\[[\s\S]*\]/);
    if (!m) return [];
    let arr;
    try { arr = JSON.parse(m[0]); } catch (_) { return []; }
    if (!Array.isArray(arr)) return [];
    const out = [], seen = [];
    for (const r of arr) {
        const name = clip(r?.name, 30);
        if (!name || seen.some(s => sameThing(s, name))) continue;
        let lo = num(r.price_min ?? r.priceMin), hi = num(r.price_max ?? r.priceMax);
        if (lo === null && hi === null) { lo = null; hi = null; }
        else { if (lo === null) lo = hi; if (hi === null) hi = lo; if (lo > hi) [lo, hi] = [hi, lo]; }
        const q = r.queries && typeof r.queries === 'object' ? r.queries : {};
        seen.push(name);
        out.push({
            id: 'i' + hashString(name + '|' + out.length + '|' + clip(r.reason, 20)).toString(36),
            name,
            reason: clip(r.reason, 90),
            message: clip(r.message, 60),
            priceMin: lo, priceMax: hi,
            kind: normalizeKind(r.kind),
            queries: { zh: clip(q.zh, 60) || name, cn: clip(q.cn, 60), ja: clip(q.ja, 60), en: clip(q.en, 60) }
        });
        if (out.length >= limit) break;
    }
    return out;
}

// 過濾：超出預算太多的、和用戶討厭的事有關的、重複的，都拿掉。全部被拿掉時，回傳空陣列（呼叫端可以決定要不要重試）
export function filterIdeas(ideas, { budget = null, dislikes = [], past = [] } = {}) {
    return (ideas || []).filter(i => {
        if (budget && i.priceMin !== null && i.priceMin > budget.max * 1.25) return false;
        const text = [i.name, i.queries?.zh].filter(Boolean).join(' ');
        if ((dislikes || []).some(d => d?.text && (sameThing(d.text, i.name) || text.includes(String(d.text).replace(/^(?:不吃|不碰|不看|不聽)/, ''))) && String(d.text).length >= 2)) return false;
        if ((past || []).some(p => sameThing(p, i.name))) return false;
        return true;
    });
}

export function formatPriceRange(i) {
    if (i.priceMin === null || i.priceMax === null) return '價格請以商店為準';
    return i.priceMin === i.priceMax ? `約 $${i.priceMin.toLocaleString()}` : `約 $${i.priceMin.toLocaleString()}～$${i.priceMax.toLocaleString()}`;
}

// ───── 重要日子 ─────
const DAY = 86400000;
const startOfDay = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const parseYmd = s => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2], d: +m[3] } : null; };

// 今年（或明年）的某月某日離今天幾天：負數表示已經過了
function daysUntilYearly(month, day, now) {
    const today = startOfDay(now);
    const thisYear = new Date(now.getFullYear(), month - 1, day).getTime();
    const diff = Math.round((thisYear - today) / DAY);
    if (diff >= -3) return { diff, year: now.getFullYear() };
    return { diff: Math.round((new Date(now.getFullYear() + 1, month - 1, day).getTime() - today) / DAY), year: now.getFullYear() + 1 };
}

export const FESTIVALS = [
    { id: 'newyear', name: '新年', month: 1, day: 1 }, { id: 'valentine', name: '情人節', month: 2, day: 14 }, { id: 'whiteday', name: '白色情人節', month: 3, day: 14 },
    { id: '520', name: '520（我愛你）', month: 5, day: 20 }, { id: 'christmas', name: '聖誕節', month: 12, day: 25 }
];

// 回傳 [{ key, type, label, occasion, diff, date }]：diff 是離今天幾天（0＝今天，-1＝昨天），只列出 -3～windowDays 之間的
export function detectOccasions({ now = new Date(), userBirthday = null, anniversaryDate = null, chatSince = null, events = [], charName = '', windowDays = 7 } = {}) {
    const out = [];
    const add = o => { if (o.diff >= -3 && o.diff <= windowDays) out.push({ ...o, date: startOfDay(now) + o.diff * DAY }); };
    const b = parseYmd(userBirthday);
    if (b) { const u = daysUntilYearly(b.m, b.d, now); add({ key: `ubday-${u.year}`, type: 'user_birthday', occasion: 'user_birthday', label: '你的生日', diff: u.diff }); }
    // 紀念日：使用者填的優先；沒填就用「第一次聊天」那天（至少認識 25 天以上）
    const a = parseYmd(anniversaryDate) || (chatSince && now.getTime() - chatSince > 25 * DAY ? (() => { const d = new Date(chatSince); return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() }; })() : null);
    if (a) {
        const sinceMs = new Date(a.y, a.m - 1, a.d).getTime();
        const u = daysUntilYearly(a.m, a.d, now);
        const years = u.year - a.y;
        if (years >= 1) add({ key: `anniv-${u.year}`, type: 'anniversary', occasion: 'anniversary', label: `認識 ${years} 週年`, diff: u.diff });
        const hundred = Math.round((sinceMs + 100 * DAY - startOfDay(now)) / DAY);
        add({ key: 'anniv-100d', type: 'anniversary', occasion: 'anniversary', label: '認識 100 天', diff: hundred });
    }
    for (const f of FESTIVALS) { const u = daysUntilYearly(f.month, f.day, now); add({ key: `fest-${f.id}-${u.year}`, type: 'festival', occasion: 'festival', label: f.name, diff: u.diff }); }
    for (const e of events || []) {
        if (!e?.title || !/生日|紀念|週年|周年|anniversary|birthday/i.test(e.title)) continue;
        const d = new Date(e.date);
        if (Number.isNaN(d.getTime())) continue;
        add({ key: `event-${e.id}-${d.getFullYear()}`, type: 'event', occasion: 'event', label: clip(e.title, 20), diff: Math.round((startOfDay(d) - startOfDay(now)) / DAY) });
    }
    return out.sort((x, y) => x.diff - y.diff);
}

// ───── 主動提議 ─────
export const FREQUENCIES = { off: '不主動', few: '少（只有生日與紀念日）', normal: '普通（加上節日與行程）', many: '常常（偶爾也會沒事送）' };
const CARE_PERCENT = { normal: 20, many: 50 };
const isoWeekKey = d => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = t.getUTCFullYear(); return `${y}-W${Math.ceil(((t - Date.UTC(y, 0, 1)) / DAY + 1) / 7)}`; };

// 找出該新增的提議卡片（還沒有的）。每個角色一次最多新增 2 張，全部最多 4 張，避免一打開就一堆
export function planProposals({ now = new Date(), characters = [], userBirthday = null, events = [], existing = [] } = {}) {
    const have = new Set(existing.map(p => p.id));
    const out = [];
    for (const c of characters) {
        const freq = c.frequency || 'normal';
        if (freq === 'off' || !c.chatSince) continue; // 還沒聊過的角色不會突然送禮
        const allowed = new Set(['user_birthday', 'anniversary']);
        if (freq !== 'few') { allowed.add('festival'); allowed.add('event'); }
        let added = 0;
        for (const o of detectOccasions({ now, userBirthday, anniversaryDate: c.anniversaryDate, chatSince: c.chatSince, events })) {
            if (!allowed.has(o.type) || o.diff < -1) continue; // 過了兩天以上就不補了
            const id = `${c.id}:${o.key}`;
            if (have.has(id) || added >= 2) continue;
            out.push({ id, characterId: c.id, key: o.key, type: o.type, occasion: o.occasion, label: o.label, dueAt: o.date, showAt: now.getTime(), createdAt: now.getTime(), status: 'pending', ideas: null });
            have.add(id); added++;
        }
        if (CARE_PERCENT[freq] && added < 2) {
            const key = `care-${isoWeekKey(now)}`, id = `${c.id}:${key}`;
            const lastCare = existing.filter(p => p.characterId === c.id && p.type === 'care').reduce((m, p) => Math.max(m, p.createdAt || 0), 0);
            if (!have.has(id) && now.getTime() - lastCare > 10 * DAY && hashString(id) % 100 < CARE_PERCENT[freq]) {
                out.push({ id, characterId: c.id, key, type: 'care', occasion: 'care', label: '想送你一份心意', dueAt: startOfDay(now), showAt: now.getTime(), createdAt: now.getTime(), status: 'pending', ideas: null });
                have.add(id);
            }
        }
    }
    return out.slice(0, 4);
}

// 清理：還沒處理的提議，日子過了兩週就丟掉；處理過的留 60 天、最多 100 筆
export function pruneProposals(list, now = Date.now()) {
    return (list || []).filter(p => (['pending', 'ready'].includes(p.status) ? now - (p.dueAt || p.createdAt || 0) <= 14 * DAY : now - (p.resolvedAt || p.createdAt || 0) <= 60 * DAY)).slice(-100);
}

// ───── 給 AI 的近況 ─────
// 最近 3 天在購物 App 裡發生的事（收下、真的買了、拒絕），讓角色下次聊天時可以自然地帶到。
export function describeRecentShopping(records, characterId, now = Date.now()) {
    const recent = (records || []).filter(r => r.characterId === characterId && now - r.at <= 3 * DAY).slice(-4);
    if (!recent.length) return '';
    const lines = recent.map(r => {
        const what = `「${r.name}」`;
        if (r.status === 'bought') return `- 用戶收下了你挑的${what}，而且真的去買了`;
        if (r.status === 'accepted') return `- 用戶收下了你挑的${what}（還沒說有沒有買）`;
        if (r.status === 'declined') return `- 你挑的${what}，用戶這次不需要${r.reason ? `（${r.reason}）` : ''}`;
        return null;
    }).filter(Boolean);
    if (!lines.length) return '';
    return ['# 最近在購物 App 的事（背景資訊，自然帶到就好，不用特地提起）', ...lines].join('\n');
}

// 還沒處理、而且已經到時間的提議（重要日子：建立就看得到；回禮：要等到過幾天才出現）
export const isShown = (p, now = Date.now()) => ['pending', 'ready'].includes(p.status) && (p.showAt ?? p.dueAt ?? 0) <= now;

// ───── 你送給角色的禮物（虛擬禮物）─────
// 送禮是一種互相往來的行為：角色會有反應、存成記憶，之後可能回禮，但不會增加好感度
export function describeGiftMessage(meta = {}, content = '') {
    const name = meta.name || content || '禮物';
    const price = Number(meta.price);
    return price > 0 ? `[禮物：${name}（價值 $${price.toLocaleString()}，是用戶花錢買來送你的）]` : `[禮物：${name}]`;
}

// 用戶剛送禮物的那一輪，附在提示詞最後的提醒（只用一次）
export const GIFT_REPLY_HINT = '用戶剛剛送了你一份禮物。依你的個性自然地反應就好：不要過度誇張、不要每次都用同樣的句型、不必逐項感謝；也不要在這時說「我也要回禮」——要回禮的話，之後自然會找機會。';

// 記憶的重要度：價格越高、越用心越重要（0.35～0.75）
export const giftImportance = price => Math.min(0.75, 0.35 + Math.max(0, Number(price) || 0) / 600);

export function giftMemoryText(charName, giftName, price) {
    return `用戶送了${charName}禮物「${giftName}」${price > 0 ? `（價值 $${Number(price).toLocaleString()}）` : ''}。`;
}

// 回禮：不是立刻，而是過 1～6 天，機率隨禮物價值提高（$10 約 33%、$50 約 47%、$200 約 90%）；
// 同一個角色已經有一份等著的回禮時不再排。回傳要新增的提議，或 null
export function planReturnGift({ now = Date.now(), characterId, giftName, price = 0, existing = [], rng = Math.random }) {
    if (existing.some(p => p.characterId === characterId && p.type === 'return' && ['pending', 'ready'].includes(p.status))) return null;
    const chance = Math.min(0.9, 0.3 + Math.max(0, Number(price) || 0) / 300);
    if (rng() >= chance) return null;
    const days = 1 + Math.floor(rng() * 6);
    const dueAt = now + days * DAY;
    return {
        id: `${characterId}:return-${now.toString(36)}`, characterId, key: `return-${now}`, type: 'return', occasion: 'return', label: '回禮',
        dueAt, showAt: dueAt, createdAt: now, status: 'pending', ideas: null, extra: `用戶前幾天送了你「${clip(giftName, 20)}」，你想回一份心意（不用比對方的貴，重點是心意）。`
    };
}
