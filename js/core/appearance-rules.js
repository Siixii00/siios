// 不用寫程式的版面編輯：使用者在畫面上點選元素、用表單改顏色／大小／圖片，這裡把那些「規則」轉成 CSS，
// 另外管理「圖片貼紙」（可以拖曳擺放的圖片）。純函式（可在 node 測試）；點選與面板在 appearance-editor.js。
export const MAX_RULES_PER_APP = 150;
export const MAX_STICKERS = 40;
export const MAX_IMAGES = 24;

const COLOR = /^(#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?|transparent)$/;
const clampNum = (v, a, b) => { const n = Number(v); return Number.isFinite(n) ? Math.min(b, Math.max(a, Math.round(n * 100) / 100)) : null; };

// 每個可以調的屬性：怎麼檢查、怎麼變成 CSS（images 是 圖片代號 → data URL）
export const PROPS = {
    color: { label: '文字顏色', check: v => COLOR.test(v) && v, css: v => `color: ${v}` },
    bg: { label: '背景顏色', check: v => COLOR.test(v) && v, css: v => `background-color: ${v}` },
    bgImage: { label: '背景圖片', check: v => (typeof v === 'string' && /^[\w-]{1,40}$/.test(v) ? v : false), css: (v, images) => (images?.[v] ? `background-image: url("${images[v]}")` : null) },
    bgFit: { label: '圖片填滿方式', check: v => ['cover', 'contain', 'repeat'].includes(v) && v, css: v => (v === 'repeat' ? ['background-repeat: repeat', 'background-size: auto'] : [`background-size: ${v}`, 'background-repeat: no-repeat', 'background-position: center']) },
    fontSize: { label: '文字大小', check: v => clampNum(v, 50, 250) ?? false, css: v => `font-size: ${v}%` },
    bold: { label: '粗體', check: v => typeof v === 'boolean' && v, css: () => 'font-weight: 700' },
    align: { label: '文字對齊', check: v => ['left', 'center', 'right'].includes(v) && v, css: v => `text-align: ${v}` },
    radius: { label: '圓角', check: v => clampNum(v, 0, 80) ?? false, css: v => [`border-radius: ${v}px`, 'overflow: hidden'] },
    padding: { label: '內距', check: v => clampNum(v, 0, 60) ?? false, css: v => `padding: ${v}px` },
    margin: { label: '外距', check: v => clampNum(v, 0, 60) ?? false, css: v => `margin: ${v}px` },
    borderColor: { label: '邊框顏色', check: v => COLOR.test(v) && v, css: v => [`border-color: ${v}`, 'border-style: solid'] },
    borderWidth: { label: '邊框粗細', check: v => clampNum(v, 0, 12) ?? false, css: v => [`border-width: ${v}px`, 'border-style: solid'] },
    opacity: { label: '透明度', check: v => clampNum(v, 0, 100) ?? false, css: v => `opacity: ${v / 100}` },
    hide: { label: '隱藏', check: v => typeof v === 'boolean' && v, css: () => 'display: none' }
};

// 選擇器只允許常見的字元：不能有 { } ; @ 或換行，避免被拿來夾帶別的規則
const SELECTOR_OK = /^[a-zA-Z0-9_\-.#:()>+~*, \[\]="'一-鿿]{1,300}$/;
export const isSafeSelector = s => typeof s === 'string' && SELECTOR_OK.test(s) && !/[{};@\\]/.test(s) && !/^\s*$/.test(s);

export function sanitizeRule(rule) {
    if (!rule || !isSafeSelector(rule.sel)) return null;
    const props = {};
    for (const [k, v] of Object.entries(rule.props || {})) {
        const spec = PROPS[k]; if (!spec) continue;
        const ok = spec.check(v);
        if (ok !== false && ok !== undefined && ok !== null) props[k] = ok === true ? true : ok;
    }
    if (!Object.keys(props).length) return null;
    return { id: String(rule.id || '').replace(/[^\w-]/g, '').slice(0, 24) || 'r' + Math.random().toString(36).slice(2, 8), sel: rule.sel.trim(), similar: rule.similar !== false, label: String(rule.label || '').slice(0, 30), props };
}

export function sanitizeAppRules(map) {
    const out = {};
    for (const [app, list] of Object.entries(map && typeof map === 'object' ? map : {})) {
        if (!/^[a-z0-9-]+$/i.test(app) || !Array.isArray(list)) continue;
        const rules = list.map(sanitizeRule).filter(Boolean).slice(0, MAX_RULES_PER_APP);
        if (rules.length) out[app] = rules;
    }
    return out;
}

export function ruleToCss(rule, scope, images) {
    const decls = [];
    for (const [k, v] of Object.entries(rule.props)) {
        const d = PROPS[k]?.css(v, images);
        // 一個屬性可能展開成好幾條宣告（回傳陣列），每一條都要 !important（不能用 ; 切字串，圖片網址裡也有 ;）
        for (const x of [d].flat()) if (x) decls.push(x + ' !important');
    }
    if (!decls.length) return '';
    const sel = rule.sel.split(',').map(s => `${scope} ${s.trim()}`).join(', ');
    return `${sel} { ${decls.join('; ')}; }`;
}

export function compileRules(appRules, images = {}) {
    const out = [];
    for (const [app, rules] of Object.entries(appRules || {})) {
        const scope = `body[data-app="${app}"]`;
        for (const r of rules) { const css = ruleToCss(r, scope, images); if (css) out.push(css); }
    }
    return out.join('\n');
}

// 同一個選擇器再改一次：合併成同一條規則（把值為 null 的屬性拿掉）
export function upsertRule(rules, { sel, similar = true, label = '' }, patch) {
    const list = [...(rules || [])];
    const i = list.findIndex(r => r.sel === sel);
    const base = i >= 0 ? list[i] : { id: 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 4), sel, similar, label, props: {} };
    const props = { ...base.props };
    for (const [k, v] of Object.entries(patch)) { if (v === null || v === undefined || v === false) delete props[k]; else props[k] = v; }
    const next = { ...base, props };
    if (!Object.keys(props).length) { if (i >= 0) list.splice(i, 1); return list; }
    if (i >= 0) list[i] = next; else list.push(next);
    return list.slice(-MAX_RULES_PER_APP);
}

// ───── 圖片貼紙 ─────
// { id, app: 'arcade' | '*', img: 圖片代號, x, y（中心點，畫面百分比）, w（寬度，畫面百分比）, rot（度）, opacity（%）}
export function sanitizeSticker(s) {
    if (!s || !/^[\w-]{1,40}$/.test(String(s.img || ''))) return null;
    const app = s.app === '*' ? '*' : /^[a-z0-9-]+$/i.test(String(s.app || '')) ? s.app : null;
    if (!app) return null;
    return {
        id: String(s.id || '').replace(/[^\w-]/g, '').slice(0, 24) || 's' + Math.random().toString(36).slice(2, 8),
        app, img: s.img,
        x: clampNum(s.x, -20, 120) ?? 50, y: clampNum(s.y, -20, 120) ?? 50,
        w: clampNum(s.w, 3, 150) ?? 30, rot: clampNum(s.rot, -180, 180) ?? 0, opacity: clampNum(s.opacity, 5, 100) ?? 100
    };
}
export const sanitizeStickers = list => (Array.isArray(list) ? list : []).map(sanitizeSticker).filter(Boolean).slice(0, MAX_STICKERS);
export const stickersFor = (list, app) => (list || []).filter(s => s.app === '*' || s.app === app);

export function stickerStyle(s) {
    return `left: ${s.x}%; top: ${s.y}%; width: ${s.w}%; opacity: ${s.opacity / 100}; transform: translate(-50%, -50%) rotate(${s.rot}deg);`;
}

// 圖片庫：{ 代號: data URL }，只收 data:image
export function sanitizeImages(map) {
    const out = {};
    for (const [k, v] of Object.entries(map && typeof map === 'object' ? map : {})) {
        if (/^[\w-]{1,40}$/.test(k) && typeof v === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v)) out[k] = v;
    }
    return Object.fromEntries(Object.entries(out).slice(0, MAX_IMAGES));
}

// ───── 移動順序（同一層的元素前移／後移）─────
// 每個子元素用「標籤.class」（沒有 class 時用「標籤|文字前幾個字」）當作代號（重複的加 #2、#3），存的是某個容器底下子元素的代號順序。
export const MAX_ORDERS_PER_APP = 30;
export const MAX_ORDER_KEYS = 80;

export function keysFor(descs) {
    const seen = {};
    return descs.map(d => {
        // 有 class 就只用 class（文字常常會變，例如餘額、時間）；沒有 class 才用文字前幾個字
        const base = d.cls ? `${d.tag}.${d.cls}` : `${d.tag}|${String(d.text || '').replace(/\s+/g, ' ').trim().slice(0, 12)}`;
        seen[base] = (seen[base] || 0) + 1;
        return seen[base] > 1 ? `${base}#${seen[base]}` : base;
    });
}

// 目前的順序 current 依照存下來的 saved 重排：saved 裡找不到的（新出現的元素）維持原本相對順序、放在最後
export function reorderKeys(current, saved) {
    const have = new Set(current);
    const first = (saved || []).filter(k => have.has(k));
    const rest = current.filter(k => !first.includes(k));
    return [...first, ...rest];
}

export function moveKey(keys, key, delta) {
    const i = keys.indexOf(key);
    if (i < 0) return keys;
    const j = Math.max(0, Math.min(keys.length - 1, i + delta));
    if (j === i) return keys;
    const out = [...keys];
    out.splice(i, 1);
    out.splice(j, 0, key);
    return out;
}

export function sanitizeOrders(map) {
    const out = {};
    for (const [app, list] of Object.entries(map && typeof map === 'object' ? map : {})) {
        if (!/^[a-z0-9-]+$/i.test(app) || !Array.isArray(list)) continue;
        const orders = list
            .filter(o => o && isSafeSelector(o.sel) && Array.isArray(o.keys))
            .map(o => ({ sel: o.sel.trim(), keys: o.keys.filter(k => typeof k === 'string' && k.length > 0 && k.length < 80).slice(0, MAX_ORDER_KEYS) }))
            .filter(o => o.keys.length > 1)
            .slice(0, MAX_ORDERS_PER_APP);
        if (orders.length) out[app] = orders;
    }
    return out;
}

// 同一個容器再改一次就覆蓋；回到原本順序（keys 全空）就拿掉
export function upsertOrder(orders, sel, keys) {
    const list = (orders || []).filter(o => o.sel !== sel);
    if (keys && keys.length > 1) list.push({ sel, keys });
    return list.slice(-MAX_ORDERS_PER_APP);
}
