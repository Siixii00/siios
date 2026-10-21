// 視覺編輯模式（不用寫程式）：在任何一個 App 的畫面上直接點選元素，用面板改顏色／大小／圖片，
// 也可以放上可以拖曳的圖片貼紙。改的東西存成「規則」（appearance-rules.js），重新開啟仍然有效。
import { currentAppearance, applyAppearance, saveAppearance, refreshStickers, childKeys, applyOrders } from './appearance-dom.js';
import { getImages, addImageFile } from './appearance-media.js';
import { upsertRule, sanitizeSticker, MAX_STICKERS, moveKey, upsertOrder } from './appearance-rules.js';

let on = false;
let mode = 'select'; // select：點選元素；use：照一般方式操作（可以切換頁面）
let selEl = null;
let selInfo = null; // { sel, similar, label }
let selSticker = null;
let panel = null;
let hl = null;
let raf = 0;
let saveTimer = null;
let onDone = null;
let collapsed = false;

export const isEditing = () => on;
const appId = () => document.body.dataset.app || '';
const host = () => document.getElementById('app')?.parentElement || document.body;

function el(tag, props = {}, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
        if (k === 'style') e.style.cssText = v;
        else if (k === 'class') e.className = v;
        else if (k.startsWith('on')) e[k] = v;
        else if (k === 'text') e.textContent = v;
        else e[k] = v;
    }
    kids.flat().forEach(c => c != null && e.append(c));
    return e;
}

// ───── 把點到的元素變成選擇器 ─────
const SKIP_CLASS = /^(active|selected|open|opened|current|show|hidden|disabled|loading|is-|has-|hover|focus|sx-)/;
const cleanClasses = n => [...n.classList].filter(c => /^[a-zA-Z][\w-]*$/.test(c) && !SKIP_CLASS.test(c)).slice(0, 2);

function partOf(node, withIndex) {
    let p = node.tagName.toLowerCase();
    const cls = cleanClasses(node);
    if (cls.length) p += '.' + cls.join('.');
    if (withIndex && node.parentElement) {
        const same = [...node.parentElement.children].filter(c => c.tagName === node.tagName);
        if (same.length > 1) p += `:nth-of-type(${same.indexOf(node) + 1})`;
    }
    return p;
}

export function selectorFor(node, similar) {
    const app = document.getElementById('app');
    if (similar) {
        const own = partOf(node, false);
        if (cleanClasses(node).length) return own; // 有 class：套用到同一個 class 的所有元素
    }
    // 只改這一個（或沒有 class 可用）：往上累積到選擇器在這個 App 裡只對到它一個
    const parts = []; let cur = node;
    while (cur && cur !== app && cur !== document.body) {
        parts.unshift(partOf(cur, true));
        const sel = parts.join(' > ');
        try { if (app.querySelectorAll(sel).length === 1) return sel; } catch (_) { break; }
        cur = cur.parentElement;
    }
    return parts.join(' > ');
}

const labelOf = node => {
    const t = (node.innerText || node.alt || node.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 14);
    return t ? `「${t}」` : node.tagName.toLowerCase() + (cleanClasses(node)[0] ? '.' + cleanClasses(node)[0] : '');
};

// ───── 存檔：畫面即時更新，資料庫稍後再寫（拖滑桿時不會一直寫）─────
function commit(next) {
    applyAppearance(next);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveAppearance(currentAppearance()).catch(() => {}), 500);
}
const rulesOf = () => currentAppearance().appRules[appId()] || [];
function setProps(patch) {
    if (!selInfo) return;
    const cur = currentAppearance();
    const list = upsertRule(rulesOf(), selInfo, patch);
    const appRules = { ...cur.appRules, [appId()]: list };
    if (!list.length) delete appRules[appId()];
    commit({ ...cur, appRules });
}
function setSticker(id, patch) {
    const cur = currentAppearance();
    commit({ ...cur, stickers: cur.stickers.map(s => (s.id === id ? sanitizeSticker({ ...s, ...patch }) || s : s)) });
    redrawStickers();
}
// 同一層的元素往前／往後移一格（delta：-1 往前、1 往後）；回到原本順序請用「還原這一層的順序」
function moveSelected(delta) {
    const parent = selEl?.parentElement;
    const app = document.getElementById('app');
    if (!parent || parent === app) { window.alert?.('這個元素在最外層，不能調整順序'); return; }
    const { kids, keys } = childKeys(parent);
    if (kids.length < 2) { window.alert?.('這一層只有它自己，沒有可以換的位置'); return; }
    const next = moveKey(keys, keys[kids.indexOf(selEl)], delta);
    if (next === keys) return;
    const sel = selectorFor(parent, false);
    const cur = currentAppearance();
    const list = upsertOrder(cur.appOrders[appId()], sel, next);
    const appOrders = { ...cur.appOrders, [appId()]: list };
    if (!list.length) delete appOrders[appId()];
    commit({ ...cur, appOrders });
    applyOrders();
    selInfo = { ...selInfo, sel: selectorFor(selEl, selInfo.similar) }; // 位置變了，單一元素的選擇器要重算
    moveHighlight();
}
function resetOrder() {
    const parent = selEl?.parentElement; if (!parent) return;
    const sel = selectorFor(parent, false);
    const cur = currentAppearance();
    const list = upsertOrder(cur.appOrders[appId()], sel, []);
    const appOrders = { ...cur.appOrders, [appId()]: list };
    if (!list.length) delete appOrders[appId()];
    commit({ ...cur, appOrders });
    window.alert?.('已清除這一層的順序設定；重新進入這個頁面就會回到原本的順序。');
}
function redrawStickers() {
    refreshStickers({ selectedId: selSticker, onMove: (id, pos) => { setSticker(id, pos); }, onSelect: id => { selSticker = id; selEl = null; selInfo = null; moveHighlight(); buildPanel(); redrawStickers(); } });
}

// ───── 選取框 ─────
function moveHighlight() {
    cancelAnimationFrame(raf);
    if (!hl) return;
    if (!selEl || !document.contains(selEl)) { hl.style.display = 'none'; return; }
    const loop = () => {
        if (!on || !selEl || !document.contains(selEl)) { hl.style.display = 'none'; return; }
        const b = selEl.getBoundingClientRect();
        Object.assign(hl.style, { display: 'block', left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
        raf = requestAnimationFrame(loop);
    };
    loop();
}

function onClick(e) {
    if (!on || mode !== 'select') return;
    const t = e.target;
    if (panel?.contains(t) || t.closest?.('#sx-stickers')) return;
    const app = document.getElementById('app');
    if (!app || !app.contains(t)) return;
    e.preventDefault(); e.stopPropagation();
    selEl = t; selSticker = null;
    const similar = selInfo?.similar ?? true;
    selInfo = { sel: selectorFor(t, similar), similar, label: labelOf(t) };
    moveHighlight(); buildPanel(); redrawStickers();
}

// ───── 面板 ─────
const colorOf = (rule, k, fallback) => (rule?.props[k] && rule.props[k] !== 'transparent' ? rule.props[k].slice(0, 7) : fallback);

function row(label, control, clear) {
    return el('div', { class: 'sxe-row' }, el('span', { class: 'sxe-label', text: label }), control, clear || '');
}

function colorRow(label, key, rule, fallback) {
    const input = el('input', { type: 'color', value: colorOf(rule, key, fallback) });
    input.oninput = () => setProps({ [key]: input.value });
    const clear = el('button', { class: 'sxe-mini', text: '清除', onclick: () => { setProps({ [key]: null }); input.value = fallback; } });
    return row(label, input, clear);
}

function rangeRow(label, key, rule, min, max, unit, dflt) {
    const input = el('input', { type: 'range', min, max, step: 1, value: rule?.props[key] ?? dflt });
    const val = el('span', { class: 'sxe-val', text: (rule?.props[key] ?? '預設') + (rule?.props[key] !== undefined ? unit : '') });
    input.oninput = () => { setProps({ [key]: Number(input.value) }); val.textContent = input.value + unit; };
    const clear = el('button', { class: 'sxe-mini', text: '清除', onclick: () => { setProps({ [key]: null }); input.value = dflt; val.textContent = '預設'; } });
    return row(label, el('span', { class: 'sxe-range' }, input, val), clear);
}

function checkRow(label, key, rule) {
    const input = el('input', { type: 'checkbox', checked: !!rule?.props[key] });
    input.onchange = () => setProps({ [key]: input.checked ? true : null });
    return row(label, input);
}

function selectRow(label, key, rule, options) {
    const s = el('select', {}, el('option', { value: '', text: '預設' }), options.map(([v, t]) => el('option', { value: v, text: t })));
    s.value = rule?.props[key] || '';
    s.onchange = () => setProps({ [key]: s.value || null });
    return row(label, s);
}

// 圖片挑選（圖片庫 + 上傳）：choose(id) 選到圖片時呼叫
function imagePicker(choose) {
    const wrap = el('div', { class: 'sxe-images' });
    const draw = () => {
        wrap.replaceChildren();
        for (const [id, url] of Object.entries(getImages())) wrap.append(el('button', { class: 'sxe-thumb', style: `background-image:url("${url}")`, title: '使用這張', onclick: () => choose(id) }));
        const file = el('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', style: 'display:none' });
        file.onchange = async () => {
            if (!file.files[0]) return;
            try { const id = await addImageFile(file.files[0]); choose(id); draw(); }
            catch (e) { window.alert?.(e.message || '上傳失敗'); }
        };
        wrap.append(el('button', { class: 'sxe-thumb sxe-add', text: '＋上傳', onclick: () => file.click() }), file);
    };
    draw();
    return wrap;
}

function elementSection() {
    const cur = rulesOf().find(r => r.sel === selInfo.sel);
    const box = el('div', { class: 'sxe-sec' });
    const toggle = el('select', {}, el('option', { value: '1', text: '套用到所有同類的元素' }), el('option', { value: '0', text: '只改這一個' }));
    toggle.value = selInfo.similar ? '1' : '0';
    toggle.onchange = () => { selInfo = { ...selInfo, similar: toggle.value === '1', sel: selectorFor(selEl, toggle.value === '1') }; buildPanel(); };
    box.append(
        el('div', { class: 'sxe-title', text: `選到：${selInfo.label}` }), toggle,
        colorRow('文字顏色', 'color', cur, '#111827'),
        colorRow('背景顏色', 'bg', cur, '#ffffff'),
        row('背景圖片', el('span', {}, cur?.props.bgImage ? '已設定 ' : '', el('button', { class: 'sxe-mini', text: '清除', onclick: () => { setProps({ bgImage: null, bgFit: null }); buildPanel(); } }))),
        imagePicker(id => { setProps({ bgImage: id, bgFit: cur?.props.bgFit || 'cover' }); buildPanel(); }),
        cur?.props.bgImage ? selectRow('圖片排列', 'bgFit', cur, [['cover', '填滿'], ['contain', '完整顯示'], ['repeat', '重複']]) : '',
        rangeRow('文字大小', 'fontSize', cur, 50, 250, '%', 100),
        checkRow('粗體', 'bold', cur),
        selectRow('文字對齊', 'align', cur, [['left', '靠左'], ['center', '置中'], ['right', '靠右']]),
        rangeRow('圓角', 'radius', cur, 0, 60, 'px', 0),
        rangeRow('內距', 'padding', cur, 0, 40, 'px', 0),
        rangeRow('外距', 'margin', cur, 0, 40, 'px', 0),
        colorRow('邊框顏色', 'borderColor', cur, '#999999'),
        rangeRow('邊框粗細', 'borderWidth', cur, 0, 12, 'px', 0),
        rangeRow('透明度', 'opacity', cur, 0, 100, '%', 100),
        checkRow('隱藏這個元素', 'hide', cur),
        row('位置', el('span', { class: 'sxe-move' }, el('button', { class: 'sxe-mini', text: '↑ 往前', onclick: () => moveSelected(-1) }), el('button', { class: 'sxe-mini', text: '↓ 往後', onclick: () => moveSelected(1) }), el('button', { class: 'sxe-mini', text: '還原這一層', onclick: resetOrder }))),
        el('button', { class: 'sxe-btn', text: '還原這個元素', onclick: () => { const k = Object.keys(cur?.props || {}); setProps(Object.fromEntries(k.map(x => [x, null]))); buildPanel(); } })
    );
    return box;
}

function stickerSection() {
    const cur = currentAppearance();
    const s = cur.stickers.find(x => x.id === selSticker);
    const box = el('div', { class: 'sxe-sec' }, el('div', { class: 'sxe-title', text: '圖片貼紙' }));
    box.append(
        el('div', { class: 'sxe-hint', text: '選一張圖放到畫面上，之後可以用手指拖曳位置。' }),
        imagePicker(id => {
            const now = currentAppearance();
            if (now.stickers.length >= MAX_STICKERS) { window.alert?.(`貼紙最多 ${MAX_STICKERS} 個`); return; }
            const n = sanitizeSticker({ app: appId() || '*', img: id, x: 50, y: 50, w: 30 });
            commit({ ...now, stickers: [...now.stickers, n] });
            selSticker = n.id; selEl = null; selInfo = null; moveHighlight(); buildPanel(); redrawStickers();
        })
    );
    if (s) {
        const num = (label, key, min, max, unit) => {
            const input = el('input', { type: 'range', min, max, step: 1, value: s[key] });
            const val = el('span', { class: 'sxe-val', text: s[key] + unit });
            input.oninput = () => { setSticker(s.id, { [key]: Number(input.value) }); val.textContent = input.value + unit; };
            return row(label, el('span', { class: 'sxe-range' }, input, val));
        };
        const scope = el('select', {}, el('option', { value: appId() || '*', text: '只在這個 App' }), el('option', { value: '*', text: '所有頁面' }));
        scope.value = s.app;
        scope.onchange = () => { setSticker(s.id, { app: scope.value }); };
        box.append(
            num('大小', 'w', 3, 150, '%'), num('旋轉', 'rot', -180, 180, '°'), num('透明度', 'opacity', 5, 100, '%'),
            row('出現在', scope),
            el('button', { class: 'sxe-btn sxe-danger', text: '刪除這張貼紙', onclick: () => { commit({ ...currentAppearance(), stickers: currentAppearance().stickers.filter(x => x.id !== s.id) }); selSticker = null; buildPanel(); redrawStickers(); } })
        );
    }
    return box;
}

function changesSection() {
    const rules = rulesOf();
    if (!rules.length) return '';
    const box = el('div', { class: 'sxe-sec' }, el('div', { class: 'sxe-title', text: `這個 App 已修改 ${rules.length} 處` }));
    for (const r of rules) {
        box.append(el('div', { class: 'sxe-change' },
            el('span', { text: `${r.label || r.sel} · ${Object.keys(r.props).length} 項` }),
            el('button', { class: 'sxe-mini', text: '刪除', onclick: () => { const cur = currentAppearance(); const list = rules.filter(x => x.id !== r.id); const appRules = { ...cur.appRules, [appId()]: list }; if (!list.length) delete appRules[appId()]; commit({ ...cur, appRules }); buildPanel(); } })
        ));
    }
    return box;
}

function buildPanel() {
    if (!panel) return;
    const body = el('div', { class: 'sxe-body' });
    if (mode === 'select') {
        body.append(selInfo ? elementSection() : el('div', { class: 'sxe-hint sxe-big', text: '點一下畫面上的任何東西（文字、按鈕、卡片、背景…），就可以修改它。' }), stickerSection(), changesSection());
    } else {
        body.append(el('div', { class: 'sxe-hint sxe-big', text: '現在是「操作」模式：可以照平常的方式點擊、切換頁面。要修改時再切回「選取」。' }));
    }
    const seg = (id, text) => el('button', { class: 'sxe-seg' + (mode === id ? ' on' : ''), text, onclick: () => { mode = id; if (id === 'use') { selEl = null; selInfo = null; moveHighlight(); } buildPanel(); } });
    const head = el('div', { class: 'sxe-head' },
        el('strong', { text: '視覺編輯' }), seg('select', '選取'), seg('use', '操作'),
        el('button', { class: 'sxe-mini', text: collapsed ? '展開' : '收合', onclick: () => { collapsed = !collapsed; buildPanel(); } }),
        el('button', { class: 'sxe-btn sxe-done', text: '完成', onclick: () => { const cb = onDone; stopEditing(); cb?.(); } })
    );
    panel.replaceChildren(head, collapsed ? '' : body);
    panel.style.maxHeight = collapsed ? 'none' : '55%';
}

const PANEL_CSS = `
#sx-editor{position:fixed;left:0;right:0;bottom:0;z-index:9;background:#fff;color:#222;border-top:1px solid #ddd;box-shadow:0 -4px 16px rgba(0,0,0,.15);overflow:auto;font:13px/1.4 system-ui,-apple-system,"Noto Sans TC",sans-serif}
#sx-editor *{box-sizing:border-box;font-family:inherit}
.sxe-head{display:flex;align-items:center;gap:6px;padding:8px 10px;position:sticky;top:0;background:#fff;border-bottom:1px solid #eee;z-index:1}
.sxe-head strong{margin-right:auto}
.sxe-seg,.sxe-mini,.sxe-btn{border:1px solid #ccc;background:#f7f7f7;border-radius:8px;padding:5px 10px;font-size:12px;color:#222;cursor:pointer}
.sxe-seg.on{background:#3b82f6;border-color:#3b82f6;color:#fff}
.sxe-done{background:#16a34a;border-color:#16a34a;color:#fff}
.sxe-danger{color:#b91c1c}
.sxe-btn{width:100%;margin-top:8px;padding:8px}
.sxe-body{padding:8px 10px 14px}
.sxe-sec{margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid #eee}
.sxe-title{font-weight:700;margin-bottom:6px}
.sxe-hint{color:#666;font-size:12px;margin:4px 0}
.sxe-big{padding:10px 0;font-size:13px}
.sxe-row{display:flex;align-items:center;gap:8px;margin:6px 0}
.sxe-label{width:74px;flex:none;color:#444}
.sxe-range{display:flex;align-items:center;gap:6px;flex:1}
.sxe-range input{flex:1;min-width:0}
.sxe-val{width:44px;text-align:right;color:#666;font-size:12px}
.sxe-row input[type=color]{width:40px;height:28px;padding:0;border:1px solid #ccc;border-radius:6px;background:none}
.sxe-sec select{width:100%;padding:6px;border:1px solid #ccc;border-radius:6px;background:#fff;color:#222}
.sxe-row select{flex:1}
.sxe-images{display:flex;flex-wrap:wrap;gap:6px;margin:6px 0}
.sxe-thumb{width:46px;height:46px;border:1px solid #ccc;border-radius:8px;background:#f2f2f2 center/cover no-repeat;cursor:pointer;padding:0;font-size:11px;color:#444}
.sxe-add{background:#fff}
.sxe-move{display:flex;gap:6px;flex-wrap:wrap}
.sxe-change{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0}
#sx-hl{position:fixed;pointer-events:none;z-index:8;outline:2px solid #3b82f6;outline-offset:1px;background:rgba(59,130,246,.12);display:none}
`;

// ───── 開始／結束 ─────
export function startEditing(opts = {}) {
    if (on) return;
    on = true; mode = 'select'; selEl = null; selInfo = null; selSticker = null; collapsed = false;
    onDone = opts.onDone || null;
    const h = host();
    if (!document.getElementById('sx-editor-css')) { const st = el('style', { id: 'sx-editor-css', text: PANEL_CSS }); document.head.appendChild(st); }
    panel = el('div', { id: 'sx-editor' });
    hl = el('div', { id: 'sx-hl' });
    h.append(hl, panel);
    document.addEventListener('click', onClick, true);
    window.addEventListener('hashchange', onHash);
    buildPanel(); redrawStickers();
}

function onHash() {
    if (!on) return;
    if (location.hash.startsWith('#/appearance')) { stopEditing(); return; }
    selEl = null; selInfo = null; selSticker = null; moveHighlight();
    setTimeout(() => { buildPanel(); redrawStickers(); }, 400); // 新的 App 載入後再更新
}

export function stopEditing() {
    if (!on) return;
    on = false;
    document.removeEventListener('click', onClick, true);
    window.removeEventListener('hashchange', onHash);
    cancelAnimationFrame(raf);
    panel?.remove(); hl?.remove(); panel = null; hl = null;
    refreshStickers(null);
    clearTimeout(saveTimer);
    saveAppearance(currentAppearance()).catch(() => {});
    onDone = null;
}
