// 「換成指定顏色」：把各個 App 樣式表裡飽和度夠高的顏色（各 App 的主色、強調色）換成使用者選的顏色。
// 換法是保留原本的明暗和透明度，只把色相、飽和度往目標靠，所以按鈕、連結、選取狀態仍然有深淺層次。
// 純函式（可在 node 測試）；掃描樣式表在 appearance-dom.js。
const HEX = /^#[0-9a-fA-F]{6}$/;
const clamp = (n, a = 0, b = 1) => Math.min(b, Math.max(a, n));

export function hexToRgb(hex) {
    if (!HEX.test(hex)) return null;
    return { r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) };
}

export function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2;
    if (!d) return { h: 0, s: 0, l };
    const s = d / (1 - Math.abs(2 * l - 1));
    const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return { h: (h * 60 + 360) % 360, s, l };
}

export function hslToRgb(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

// 找出字串裡的顏色：#rgb/#rrggbb/#rrggbbaa、rgb()/rgba()、hsl()/hsla()
const COLOR_RE = /#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b|rgba?\((?:[^()]|\([^()]*\))*\)|hsla?\((?:[^()]|\([^()]*\))*\)/g; // 括號裡可以再有一層，例如 Tailwind 的 rgb(168 85 247 / var(--tw-bg-opacity))

export function parseColor(str) {
    const t = String(str).trim();
    let m;
    if ((m = /^#([0-9a-fA-F]{3})$/.exec(t))) { const [r, g, b] = m[1].split('').map(c => parseInt(c + c, 16)); return { r, g, b, a: 1 }; }
    if ((m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(t))) return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16), a: m[2] ? parseInt(m[2], 16) / 255 : 1 };
    if ((m = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(t))) {
        const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
        return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]), a };
    }
    if ((m = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%(?:[\s,/]+([\d.]+%?))?\s*\)$/.exec(t))) {
        const { r, g, b } = hslToRgb(+m[1] % 360, clamp(+m[2] / 100), clamp(+m[3] / 100));
        const a = m[4] === undefined ? 1 : m[4].endsWith('%') ? parseFloat(m[4]) / 100 : +m[4];
        return { r, g, b, a };
    }
    return null;
}

const fmt = ({ r, g, b }, a) => (a >= 0.999 ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${Math.round(a * 1000) / 1000})`);

// 這個顏色要不要換：飽和度夠高、不太亮也不太暗。keepDanger：保留警示用的紅色
export function isAccentLike(c, { keepDanger = true } = {}) {
    const { h, s, l } = rgbToHsl(c.r, c.g, c.b);
    const chroma = (Math.max(c.r, c.g, c.b) - Math.min(c.r, c.g, c.b)) / 255;
    // 灰、帶一點藍灰的中性色（Tailwind 的 gray/slate 等）不算主色：飽和度和色彩強度都要夠
    if (s < 0.3 || chroma < 0.12 || l < 0.12 || l > 0.93) return false;
    if (keepDanger && s >= 0.5 && (h >= 345 || h <= 12)) return false;
    return true;
}

export function mapColor(c, target, opts = {}) {
    if (!isAccentLike(c, opts)) return null;
    const t = hexToRgb(target); if (!t) return null;
    const src = rgbToHsl(c.r, c.g, c.b), dst = rgbToHsl(t.r, t.g, t.b);
    const s = clamp(src.s * 0.5 + dst.s * 0.5, 0, 1);
    const l = clamp(src.l + (dst.l - 0.5) * 0.5, 0.08, 0.95);
    return fmt(hslToRgb(dst.h, s, l), c.a);
}

// 把一段 CSS 值裡的所有該換的顏色換掉；沒有任何要換的就回傳 null
export function replaceInValue(value, target, opts = {}) {
    let changed = false;
    const out = String(value).replace(COLOR_RE, m => {
        // 透明度是變數（Tailwind）：顏色換掉，透明度的部分原樣保留
        const v = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*\/\s*(var\(.*\))\s*\)$/.exec(m);
        if (v) {
            const mapped = mapColor({ r: +v[1], g: +v[2], b: +v[3], a: 1 }, target, opts);
            if (!mapped) return m;
            changed = true;
            return mapped.replace(/^rgb\((\d+), (\d+), (\d+)\)$/, `rgb($1 $2 $3 / ${v[4]})`);
        }
        const c = parseColor(m);
        const r = c && mapColor(c, target, opts);
        if (!r) return m;
        changed = true;
        return r;
    });
    return changed ? out : null;
}
