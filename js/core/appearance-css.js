// 使用者自己寫的 CSS（全域，或只套用在某個 App）：清理、加上範圍前綴。純函式。
export const MAX_CSS = 50000;

// 去掉註解與危險的東西：@import（會去載入外部樣式）、expression()、javascript: 網址
export function sanitizeCss(css) {
    let s = String(css ?? '').slice(0, MAX_CSS);
    const removed = [];
    s = s.replace(/@import[^;]*;?/gi, () => { removed.push('@import'); return ''; });
    s = s.replace(/expression\s*\(/gi, () => { removed.push('expression()'); return '('; });
    s = s.replace(/javascript\s*:/gi, () => { removed.push('javascript:'); return ''; });
    s = s.replace(/<\/?style[^>]*>/gi, () => { removed.push('<style>'); return ''; });
    return { css: s, removed: [...new Set(removed)] };
}

// 括號是否成對（不成對時整段不套用，避免把後面所有樣式吃掉）
export function checkBalanced(css) {
    let depth = 0, inStr = null, inComment = false;
    for (let i = 0; i < css.length; i++) {
        const c = css[i], n = css[i + 1];
        if (inComment) { if (c === '*' && n === '/') { inComment = false; i++; } continue; }
        if (inStr) { if (c === '\\') i++; else if (c === inStr) inStr = null; continue; }
        if (c === '/' && n === '*') { inComment = true; i++; continue; }
        if (c === '"' || c === "'") { inStr = c; continue; }
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth < 0) return { ok: false, error: '多了一個 }' }; }
    }
    if (inComment) return { ok: false, error: '註解沒有結束' };
    if (inStr) return { ok: false, error: '引號沒有結束' };
    return depth ? { ok: false, error: `少了 ${depth} 個 }` } : { ok: true };
}

const splitTop = (s, ch = ',') => {
    const parts = []; let depth = 0, cur = '';
    for (const c of s) {
        if (c === '(' || c === '[') depth++; else if (c === ')' || c === ']') depth--;
        if (c === ch && depth === 0) { parts.push(cur); cur = ''; } else cur += c;
    }
    parts.push(cur);
    return parts.map(x => x.trim()).filter(Boolean);
};

// 讀出最上層的區塊：[{ head, body }]（head 是 { 前面的文字）
function topBlocks(css) {
    const out = []; let i = 0;
    while (i < css.length) {
        const open = css.indexOf('{', i);
        if (open === -1) break;
        let depth = 0, j = open;
        for (; j < css.length; j++) { if (css[j] === '{') depth++; else if (css[j] === '}') { depth--; if (!depth) break; } }
        out.push({ head: css.slice(i, open).trim(), body: css.slice(open + 1, j) });
        i = j + 1;
    }
    return out;
}

const scopeSelector = (sel, scope) => {
    const t = sel.trim();
    if (/^(html|:root|body)\b/.test(t)) return t.replace(/^(html|:root|body)\b(\s*)/, (m0, tag, sp) => scope + (sp ? ' ' : ''));
    return `${scope} ${t}`;
};

// 把 CSS 裡每個規則的選擇器加上 scope 前綴，例如 body[data-app="arcade"]。@media/@supports 內部會遞迴處理；@keyframes、@font-face 原樣保留
export function scopeCss(css, scope) {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
    return topBlocks(clean).map(({ head, body }) => {
        if (/^@(media|supports|container|layer)\b/i.test(head)) return `${head} {\n${scopeCss(body, scope)}\n}`;
        if (head.startsWith('@')) return `${head} {${body}}`;
        return `${splitTop(head).map(s => scopeSelector(s, scope)).join(', ')} {${body}}`;
    }).join('\n');
}

// 整合：全域 CSS + 各 App 的 CSS → 最後要放進 <style> 的文字，以及每一段的錯誤
export function buildCustomCss({ customCss = '', appCss = {} } = {}) {
    const errors = {}; const parts = [];
    const add = (key, raw, scope) => {
        if (!raw || !String(raw).trim()) return;
        const { css, removed } = sanitizeCss(raw);
        const bal = checkBalanced(css);
        if (!bal.ok) { errors[key] = bal.error; return; }
        if (removed.length) errors[key] = `已移除不允許的內容：${removed.join('、')}`;
        parts.push(`/* ${key} */\n${scope ? scopeCss(css, scope) : css}`);
    };
    add('global', customCss, null);
    for (const [id, raw] of Object.entries(appCss || {})) {
        if (/^[a-z0-9-]+$/i.test(id)) add(id, raw, `body[data-app="${id}"]`);
    }
    return { css: parts.join('\n\n'), errors };
}

// 常用範例，給編輯器的「插入範例」用
export const SNIPPETS = [
    { name: '隱藏捲軸', css: '* { scrollbar-width: none; }\n*::-webkit-scrollbar { display: none; }' },
    { name: '加大間距', css: '.page { padding: 24px !important; }' },
    { name: '全部圓角', css: 'button, input, textarea, select { border-radius: 14px !important; }' },
    { name: '方形直角', css: '* { border-radius: 0 !important; }' },
    { name: '隱藏底部導覽', css: '.kakao-bottom-nav, .ios-bottom-nav { display: none !important; }' },
    { name: '標題置左', css: '.menu-title { text-align: left !important; margin-right: auto; }' },
    { name: '細字', css: '#app * { font-weight: 300 !important; }' }
];
