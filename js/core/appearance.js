// 外觀：深色模式、主題色（換成指定顏色）、字體、介面大小、自訂 CSS。
// 深色 = 在 #app 外面套濾鏡（反相 + 色相轉 180°，圖片影片再反一次還原），因為各個 App 的顏色多半寫死在自己的 CSS 裡。
// 主題色 = 掃描樣式表把飽和的顏色換掉（appearance-colors.js）；自訂 CSS 見 appearance-css.js。
// 本來就是深色底的 App（街機廳、YouTube…）和主畫面（有桌布）不反相，由 isDarkBackground 判斷。
// 這個檔案只有純函式（可在 node 測試）；套用到頁面的部分在 appearance-dom.js。

export const PRESETS = [
    { id: 'default', name: '預設', color: '#16A34A' },
    { id: 'pink', name: '粉色', color: '#EC4899' },
    { id: 'blue', name: '藍色', color: '#3B82F6' },
    { id: 'purple', name: '紫色', color: '#8B5CF6' },
    { id: 'orange', name: '橘色', color: '#F97316' },
    { id: 'red', name: '紅色', color: '#EF4444' }
];
export const MODES = [{ id: 'light', name: '淺色' }, { id: 'dark', name: '深色' }, { id: 'auto', name: '跟隨系統' }];
export const FONTS = [
    { id: 'system', name: '預設', css: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans TC", sans-serif' },
    { id: 'serif', name: '襯線', css: '"Noto Serif TC", "Songti TC", "PMingLiU", Georgia, serif' },
    { id: 'rounded', name: '圓體', css: '"Varela Round", "Hiragino Maru Gothic ProN", "Microsoft JhengHei", ui-rounded, sans-serif' },
    { id: 'mono', name: '等寬', css: '"JetBrains Mono", ui-monospace, "Cascadia Mono", Consolas, monospace' }
];
export const SIZES = [{ id: 'small', name: '小', zoom: 0.92 }, { id: 'medium', name: '中', zoom: 1 }, { id: 'large', name: '大', zoom: 1.1 }];

export const DEFAULT_COLOR = '#16A34A'; // 預設配色的主色：選這個就是不換色
export const DEFAULTS = { mode: 'light', color: DEFAULT_COLOR, keepDanger: true, font: 'system', size: 'medium', saturation: 100, customCss: '', appCss: {} };

const HEX = /^#[0-9a-fA-F]{6}$/;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

// 舊版只存一個 appearance_theme（light/dark/pink/blue/green）：轉成新的設定
export function migrateLegacy(theme, font) {
    const out = { ...DEFAULTS };
    if (theme === 'dark') out.mode = 'dark';
    const p = { pink: '#EC4899', blue: '#3B82F6', green: '#16A34A' }[theme];
    if (p) out.color = p;
    if (['small', 'medium', 'large'].includes(font)) out.size = font;
    return out;
}

export function normalize(s) {
    const o = { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
    if (!MODES.some(m => m.id === o.mode)) o.mode = DEFAULTS.mode;
    if (!HEX.test(o.color)) o.color = DEFAULTS.color;
    if (!FONTS.some(f => f.id === o.font)) o.font = DEFAULTS.font;
    if (!SIZES.some(z => z.id === o.size)) o.size = DEFAULTS.size;
    o.saturation = clamp(Math.round(Number(o.saturation)) || 100, 50, 160);
    o.keepDanger = o.keepDanger !== false;
    o.customCss = typeof o.customCss === 'string' ? o.customCss.slice(0, 50000) : '';
    const apps = {};
    for (const [k, v] of Object.entries(o.appCss && typeof o.appCss === 'object' ? o.appCss : {})) if (/^[a-z0-9-]+$/i.test(k) && typeof v === 'string' && v.trim()) apps[k] = v.slice(0, 50000);
    o.appCss = apps;
    // 主題色：選預設的綠色就是不換色
    return o;
}

export const effectiveDark = (s, systemDark) => s.mode === 'dark' || (s.mode === 'auto' && !!systemDark);

const num = n => String(Math.round(n * 1000) / 1000);
const DARK_CONTRAST = 0.9;

// 濾鏡串：先主題色（色相偏移、飽和度），再深色（反相、色相轉回、降對比讓黑色不要死黑）
// 目前只有深色和飽和度會用到濾鏡
export function filterChain(s, { dark }) {
    const sat = s.saturation / 100;
    const parts = [];
    if (sat !== 1) parts.push('saturate(' + num(sat) + ')');
    if (dark) parts.push('invert(1)', 'hue-rotate(180deg)', 'contrast(' + DARK_CONTRAST + ')');
    return parts;
}

// 圖片等不該被濾鏡影響的元素：套上「反向」濾鏡（順序相反）還原
export function inverseChain(s, { dark }) {
    const sat = s.saturation / 100;
    const parts = [];
    if (dark) parts.push('contrast(' + num(1 / DARK_CONTRAST) + ')', 'hue-rotate(-180deg)', 'invert(1)');
    if (sat !== 1) parts.push('saturate(' + num(1 / sat) + ')');
    return parts;
}

const MEDIA = ['img', 'video', 'canvas', 'iframe', 'picture', 'svg image', '[style*="background-image"]', '[style*="url("]', '.sx-keep'];
const OVERLAYS = ['[class*="overlay"]', '[class*="modal"]', '[class*="sheet"]', '[class*="dialog"]'];

// 產生整段 CSS。dark：目前是否為深色；回傳字串（放進 <style>）
export function buildCss(settings, systemDark = false) {
    const s = normalize(settings);
    const dark = effectiveDark(s, systemDark);
    const font = FONTS.find(f => f.id === s.font);
    const zoom = SIZES.find(z => z.id === s.size).zoom;
    const rules = [];

    const tint = filterChain(s, { dark: false }), tintInv = inverseChain(s, { dark: false });
    if (tint.length) {
        rules.push(`#app { filter: ${tint.join(' ')}; }`);
        rules.push(`#app :is(${MEDIA.join(', ')}) { filter: ${tintInv.join(' ')}; }`);
    }
    if (dark) {
        const full = filterChain(s, { dark: true }), fullInv = inverseChain(s, { dark: true });
        const on = `#app:not([data-sx-native-dark]):not([data-sx-wallpaper]):not(:has(.lock-screen))`;
        rules.push(`${on} { filter: ${full.join(' ')}; }`);
        rules.push(`${on} :is(${MEDIA.join(', ')}) { filter: ${fullInv.join(' ')}; }`);
        // 掛在 body 底下的彈窗、面板（不在 #app 裡）也要一起變深色
        rules.push(`body > :is(${OVERLAYS.join(', ')}) { filter: ${full.join(' ')}; }`);
        rules.push(`body > :is(${OVERLAYS.join(', ')}) :is(${MEDIA.join(', ')}) { filter: ${fullInv.join(' ')}; }`);
    }
    if (s.font !== 'system') {
        rules.push(`#app :where(*:not(i):not(.material-icons):not(.material-symbols-outlined):not([class^="fa"]):not([class*=" fa-"])) { font-family: ${font.css} !important; }`);
    }
    if (zoom !== 1) rules.push(`#app { zoom: ${zoom}; }`);
    return rules.join('\n');
}

// 顏色亮度（0～1）；用來判斷 App 本來的底色是不是深色
export function luminance(r, g, b) { return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255; }
export function parseRgb(str) {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+))?/.exec(String(str || ''));
    return m ? { r: +m[1], g: +m[2], b: +m[3], a: m[4] === undefined ? 1 : +m[4] } : null;
}
// 取樣到的幾個底色：多數偏暗就是本來就深色。取不到（全透明）時回傳 false
export function isDarkBackground(colors) {
    const seen = colors.map(parseRgb).filter(c => c && c.a > 0.5);
    if (!seen.length) return false;
    return seen.filter(c => luminance(c.r, c.g, c.b) < 0.35).length > seen.length / 2;
}

export const themeColorMeta = (s, systemDark) => (effectiveDark(normalize(s), systemDark) ? '#141414' : '#FAF9F6');

// 要換成哪個顏色：選預設的綠色就是不換（回傳 null）
export const colorTarget = s => (s.color.toUpperCase() === DEFAULT_COLOR ? null : s.color);
