// 主畫面小工具的「排版設定」：風格、每個小工具的尺寸、排序。純函式、不碰 IndexedDB，tests/unit/widget-layout.test.mjs 直接測。
// 資料另存在 widget_prefs（{ style, sizes }）；啟用清單 widget_active 的順序就是顯示順序，舊資料不用遷移。

export const WIDGET_STYLES = [
    { id: 'paper', name: '紙', hint: '米白底、墨色字' },
    { id: 'ink', name: '墨', hint: '深色底、淡色字' },
    { id: 'glass', name: '玻璃', hint: '半透明、看得到桌布' }
];
export const DEFAULT_STYLE = 'paper';
const SIZES = ['small', 'medium', 'large'];

// 小工具可用的尺寸：沒特別指定就只有預設那一種
export const allowedSizes = w => (Array.isArray(w.sizes) && w.sizes.length ? w.sizes : [w.size]).filter(s => SIZES.includes(s));

// 讀進來的資料可能缺欄位、有已移除的小工具或不合法的尺寸，一律整理成乾淨的樣子
export function normalizePrefs(raw, widgets) {
    const style = WIDGET_STYLES.some(s => s.id === raw?.style) ? raw.style : DEFAULT_STYLE;
    const sizes = {};
    for (const w of widgets) {
        const picked = raw?.sizes?.[w.id];
        if (picked && picked !== w.size && allowedSizes(w).includes(picked)) sizes[w.id] = picked;
    }
    return { style, sizes };
}

export const sizeOf = (prefs, w) => prefs.sizes[w.id] || w.size;

// 換尺寸；不在允許範圍內就原樣回傳。選回預設尺寸時不另外存，資料才不會越存越多
export function withSize(prefs, w, size) {
    if (!allowedSizes(w).includes(size)) return prefs;
    const sizes = { ...prefs.sizes };
    if (size === w.size) delete sizes[w.id]; else sizes[w.id] = size;
    return { ...prefs, sizes };
}

export function withStyle(prefs, style) {
    return WIDGET_STYLES.some(s => s.id === style) ? { ...prefs, style } : prefs;
}

// 把第 from 個移到第 to 個的位置；超出範圍或沒移動就原樣回傳
export function moveItem(ids, from, to) {
    if (from === to || from < 0 || to < 0 || from >= ids.length || to >= ids.length) return ids;
    const next = ids.slice();
    next.splice(to, 0, next.splice(from, 1)[0]);
    return next;
}
