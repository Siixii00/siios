import APIClient from '../../api.js';

// 每日真實世界事件：從 Wikipedia 的「Portal:Current events」取得當天新聞（免費、免金鑰、允許跨網域），
// 有設定 AI 就由 AI 翻成中文並判斷對各板塊的影響；沒有 AI 時用關鍵字規則。
export const SECTORS = ['大盤', '半導體', '金融', '食品', '能源', '電動車', '遊戲', '生技', '原物料', '國防'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WIKI = 'https://en.wikipedia.org/w/api.php';
const MIN_ITEMS = 12;
const STRENGTH_STEP = 0.012; // 每 1 級強度 = 1.2% 的目標漲跌幅
const MAX_BIAS = 0.1;

const pad = n => String(n).padStart(2, '0');
export const localDate = (d = new Date()) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
export const startOfDay = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

function clean(s) {
    return s
        .replace(/<ref[^>]*\/>/g, '').replace(/<ref[\s\S]*?<\/ref>/g, '')
        .replace(/\{\{[^}]*\}\}/g, '')
        .replace(/\[https?:\/\/[^\s\]]+[^\]]*\]/g, '')
        .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1')
        .replace(/'{2,}/g, '').replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ').replace(/\s+([.,;:])/g, '$1').trim();
}

export function parseWikitext(text) {
    const items = [];
    let category = '';
    for (const raw of text.split('\n')) {
        const line = raw.trim();
        const head = /^'''(.+?)'''$/.exec(line);
        if (head) { category = clean(head[1]); continue; }
        if (!line.startsWith('*')) continue;
        const url = (/\[(https?:\/\/[^\s\]]+)/.exec(line) || [])[1] || '';
        const t = clean(line.replace(/^\*+\s*/, ''));
        if (t.length >= 30) items.push({ text: t, category, url });
    }
    // 有來源連結的才是新聞本文；標題層級的行沒有連結
    const withUrl = items.filter(i => i.url);
    return withUrl.length >= 3 ? withUrl : items;
}

async function fetchDay(date) {
    const title = `Portal:Current_events/${date.getFullYear()}_${MONTHS[date.getMonth()]}_${date.getDate()}`;
    const res = await fetch(`${WIKI}?action=parse&page=${encodeURIComponent(title)}&prop=wikitext&format=json&formatversion=2&origin=*`);
    if (!res.ok) throw new Error('新聞來源回應 ' + res.status);
    const data = await res.json();
    const text = data.parse?.wikitext;
    return typeof text === 'string' ? parseWikitext(text) : []; // 當天頁面還沒建立時回傳空
}

// 今天的新聞還不夠多時（例如凌晨），往前補昨天與前天
export async function fetchHeadlines() {
    const items = [];
    const day = new Date();
    for (let back = 0; back < 3 && items.length < MIN_ITEMS; back++) {
        try { items.push(...await fetchDay(new Date(day.getFullYear(), day.getMonth(), day.getDate() - back))); }
        catch (e) { if (back === 0 && !items.length) throw e; }
    }
    if (!items.length) throw new Error('目前取不到新聞，稍後再試');
    return items.slice(0, 40);
}

// ───────── 規則分析（沒有 AI 時使用）─────────
const RULES = [
    { re: /\b(war|invasion|missile|airstrike|strikes?|offensive|shell(?:ing|ed)|troops|ceasefire|military|drone attack|Ukraine|Russia|Gaza|Israel|Iran|Houthi|Taiwan Strait)\b/i, label: '戰事與地緣衝突', why: '衝突升溫會推升能源與金屬的供給風險，並提高國防需求；風險資產通常承壓。', impacts: [['能源', 1, 2], ['原物料', 1, 2], ['國防', 1, 2], ['大盤', -1, 1]] },
    { re: /\b(oil|crude|OPEC|petroleum|gasoline|natural gas|pipeline|refiner)/i, label: '能源供需消息', why: '原油與天然氣的供給變化會直接影響能源股獲利。', impacts: [['能源', 1, 2]] },
    { re: /\b(AI|artificial intelligence|chip|semiconductor|Nvidia|TSMC|data cent|GPU|OpenAI|machine learning)/, label: '人工智慧與晶片', why: 'AI 需求帶動晶片與算力投資，半導體族群受惠。', impacts: [['半導體', 1, 3], ['遊戲', 1, 1]] },
    { re: /\b(tariff|trade war|sanction|export control|embargo|ban on)/i, label: '貿易限制與制裁', why: '關稅與出口管制擾亂供應鏈，對科技與原物料價格都是變數。', impacts: [['半導體', -1, 2], ['原物料', 1, 1], ['大盤', -1, 1]] },
    { re: /\b(interest rate|Federal Reserve|central bank|rate (?:cut|hike)|inflation|recession|unemployment|GDP)/i, label: '利率與總體經濟', why: '利率與景氣預期會改變資金成本，金融與成長股最敏感。', impacts: [['金融', 1, 1], ['半導體', -1, 1], ['大盤', -1, 1]] },
    { re: /\b(bank (?:collapse|fail|run)|default|bankruptcy|debt crisis|financial crisis|fraud)/i, label: '金融風險事件', why: '信用事件會引發擠兌與避險情緒，金融股首當其衝。', impacts: [['金融', -1, 3], ['大盤', -1, 2]] },
    { re: /\b(earthquake|hurricane|typhoon|flood|wildfire|tsunami|cyclone|storm|volcano)/i, label: '天災', why: '天災衝擊產能與物流，也帶動重建所需的原物料需求。', impacts: [['原物料', 1, 1], ['食品', 1, 1], ['半導體', -1, 1]] },
    { re: /\b(drought|harvest|crop|famine|wheat|grain|food (?:price|shortage)|agricultur)/i, label: '糧食與農業', why: '收成與糧價變動會影響食品業成本與售價。', impacts: [['食品', 1, 2]] },
    { re: /\b(vaccine|outbreak|virus|pandemic|epidemic|cholera|measles|bird flu|FDA|drug|clinical trial|cancer)/i, label: '醫療與疫情', why: '疫情與新藥核准消息會牽動生技與醫療族群。', impacts: [['生技', 1, 2]] },
    { re: /\b(electric vehicle|EV\b|Tesla|BYD|battery|lithium|charging station)/i, label: '電動車與電池', why: '電動車需求與電池原料價格同時影響車廠與礦業。', impacts: [['電動車', 1, 2], ['原物料', 1, 1]] },
    { re: /\b(gold|copper|silver|steel|nickel|iron ore|mining|mine\b|rare earth|aluminium|aluminum|metal)/i, label: '金屬與礦業', why: '金屬供給或需求的變化直接反映在原物料價格。', impacts: [['原物料', 1, 2]] },
    { re: /\b(video game|gaming|esports|Nintendo|PlayStation|Xbox|Steam|streaming)/i, label: '遊戲與娛樂', why: '大作與平台消息影響遊戲公司的營收預期。', impacts: [['遊戲', 1, 2]] },
    { re: /\b(election|coup|protest|parliament|president|prime minister|resign)/i, label: '政局變動', why: '政局不確定性升高時，資金傾向觀望，大盤波動加大。', impacts: [['大盤', -1, 1]] }
];

export function analyzeByRules(items) {
    const used = {};
    const events = [];
    for (const it of items) {
        const hit = RULES.filter(r => r.re.test(it.text)).slice(0, 1)[0];
        if (!hit || (used[hit.label] || 0) >= 2) continue;
        used[hit.label] = (used[hit.label] || 0) + 1;
        events.push({ zh: hit.label, en: it.text, why: hit.why, url: it.url, impacts: hit.impacts.map(([sector, dir, strength]) => ({ sector, dir, strength })) });
        if (events.length >= 8) break;
    }
    return events;
}

// ───────── AI 分析 ─────────
export async function aiReady() {
    const s = await APIClient.getSettings();
    return !!(s.api_url && s.api_key);
}

function extractJson(text) {
    try { return JSON.parse(text); } catch { /* 往下找 */ }
    const m = /\{[\s\S]*\}/.exec(text);
    if (!m) throw new Error('AI 回覆不是 JSON');
    return JSON.parse(m[0]);
}

export async function analyzeByAI(items) {
    const list = items.slice(0, 25);
    const system = `你是財經分析師，要把今天的世界新聞對應到一個「虛構市場」的產業板塊，供使用者從遊戲中學習真實世界的連動。板塊只能是：${SECTORS.join('、')}（「大盤」代表整體市場情緒）。只挑選 4~8 則對市場最有意義的新聞，其餘忽略。`;
    const user = `今天的新聞標題（英文）：\n${list.map((it, i) => `${i + 1}. [${it.category}] ${it.text.slice(0, 220)}`).join('\n')}\n\n請只輸出 JSON：{"events":[{"i":新聞編號,"zh":"繁體中文一句話事件摘要","why":"一句話說明為什麼會影響這些板塊（讓人學到產業連動）","impacts":[{"sector":"板塊","dir":1或-1,"strength":1到3}]}]}`;
    const text = await APIClient.complete([{ role: 'system', content: system }, { role: 'user', content: user }], { temperature: 0.3, maxTokens: 2200 });
    const parsed = extractJson(text);
    const events = [];
    for (const e of Array.isArray(parsed.events) ? parsed.events : []) {
        const src = list[(e.i | 0) - 1];
        const impacts = (Array.isArray(e.impacts) ? e.impacts : [])
            .filter(x => SECTORS.includes(x.sector) && (x.dir === 1 || x.dir === -1))
            .map(x => ({ sector: x.sector, dir: x.dir, strength: Math.max(1, Math.min(3, Math.round(Number(x.strength) || 1))) }));
        if (!e.zh || !impacts.length) continue;
        events.push({ zh: String(e.zh).slice(0, 120), en: src?.text || '', why: String(e.why || '').slice(0, 160), url: src?.url || '', impacts });
    }
    if (!events.length) throw new Error('AI 沒有產出可用的事件');
    return events.slice(0, 8);
}

// 分析：優先 AI，失敗或沒設定就退回規則
export async function analyze(items) {
    let aiError = '';
    if (await aiReady()) {
        try { return { source: 'ai', events: await analyzeByAI(items) }; }
        catch (e) { aiError = e.message; }
    }
    return { source: 'rules', events: analyzeByRules(items), aiError };
}

// 近三天的事件會延續影響（今天 100%、昨天 50%、前天 25%）。回傳每個板塊的目標漲跌幅（小數）
export function sectorBias(days, now = new Date()) {
    const bias = {};
    [1, 0.5, 0.25].forEach((weight, back) => {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - back);
        for (const ev of days[localDate(d)]?.events || []) {
            for (const im of ev.impacts) bias[im.sector] = (bias[im.sector] || 0) + im.dir * im.strength * STRENGTH_STEP * weight;
        }
    });
    for (const k of Object.keys(bias)) bias[k] = Math.max(-MAX_BIAS, Math.min(MAX_BIAS, bias[k]));
    return bias;
}
