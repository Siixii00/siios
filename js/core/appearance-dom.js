// 外觀的瀏覽器部分：讀寫設定、把 CSS 放進頁面、偵測 App 本來是不是深色底。純函式在 appearance.js。
import { SettingsDB } from '../db.js';
import { normalize, migrateLegacy, buildCss, themeColorMeta, effectiveDark, isDarkBackground, colorTarget } from './appearance.js';
import { replaceInValue } from './appearance-colors.js';
import { buildCustomCss } from './appearance-css.js';
import { compileRules, keysFor, reorderKeys } from './appearance-rules.js';
import { loadImages, getImages, renderStickers } from './appearance-media.js';

const KEY = 'appearance';
const LS_KEY = 'sx_appearance'; // 同一份設定放一份在 localStorage，下次開啟時可以在資料庫讀完之前先套用，避免閃一下淺色
let current = normalize(null);
let mq = null;
let observer = null;
let timer = null;
let cssTimer = null;
let customErrors = {};
let editing = null; // 視覺編輯模式開著時：{ selectedId, onMove, onSelect }（貼紙可以拖曳）
const OWN_IDS = ['sx-appearance', 'sx-color-map', 'sx-custom-css'];

const systemDark = () => !!mq?.matches;

function readLocal() {
    try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch (_) { return null; }
}

export async function loadAppearance() {
    let v = await SettingsDB.get(KEY);
    if (!v) v = migrateLegacy(await SettingsDB.get('appearance_theme'), await SettingsDB.get('appearance_font_size'));
    return normalize(v);
}

export const currentAppearance = () => current;
export const customCssErrors = () => customErrors;

// 目前這個 App 的貼紙：重新畫一次。視覺編輯模式會傳 opts 讓貼紙可以拖曳
export function refreshStickers(opts) {
    if (opts !== undefined) editing = opts;
    try { renderStickers(current, document.body.dataset.app || '', editing ? { ...editing, editing: true } : {}); } catch (e) { console.warn('[Appearance] 貼紙顯示失敗：', e); }
}

export function applyAppearance(settings) {
    current = normalize(settings);
    let el = document.getElementById('sx-appearance');
    if (!el) { el = document.createElement('style'); el.id = 'sx-appearance'; document.head.appendChild(el); }
    el.textContent = buildCss(current, systemDark());
    document.documentElement.dataset.sxDark = effectiveDark(current, systemDark()) ? '1' : '0';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = themeColorMeta(current, systemDark());
    try { localStorage.setItem(LS_KEY, JSON.stringify(current)); } catch (_) { /* 沒有 localStorage 也沒關係 */ }
    scheduleNativeCheck();
    // 馬上套用（編輯器要立刻拿到 CSS 有沒有錯）；後來才載入的樣式表由 scheduleStyles 再補一次
    clearTimeout(cssTimer);
    try { applyStyles(); } catch (e) { console.warn('[Appearance] 套用樣式失敗：', e); }
}

export async function saveAppearance(settings) {
    const s = normalize(settings);
    await SettingsDB.set(KEY, s);
    applyAppearance(s);
    return s;
}

// ───── 移動順序：把存下來的順序套到畫面上 ─────
const STATE_CLASS = /^(active|selected|open|opened|current|show|hidden|disabled|loading|is-|has-|hover|focus|sx-)/;
// 容器底下每個子元素的代號（編輯器和套用要用同一套）
export function childKeys(container) {
    const kids = [...container.children];
    const keys = keysFor(kids.map(k => ({
        tag: k.tagName.toLowerCase(),
        cls: [...k.classList].find(c => /^[a-zA-Z][\w-]*$/.test(c) && !STATE_CLASS.test(c)) || '',
        text: k.textContent
    })));
    return { kids, keys };
}

export function applyOrders() {
    const app = document.getElementById('app');
    const orders = current.appOrders[document.body.dataset.app || ''];
    if (!app || !orders) return;
    for (const o of orders) {
        let box = null;
        try { box = app.querySelector(o.sel); } catch (_) { continue; }
        if (!box) continue;
        const { kids, keys } = childKeys(box);
        const want = reorderKeys(keys, o.keys);
        if (want.every((k, i) => k === keys[i])) continue; // 已經是這個順序：不動（避免一直觸發 MutationObserver）
        const byKey = new Map(keys.map((k, i) => [k, kids[i]]));
        want.forEach(k => box.appendChild(byKey.get(k)));
    }
}

// ───── 本來就是深色底的 App：不要再反相 ─────
function sampleBackgrounds(app) {
    const r = app.getBoundingClientRect();
    if (!r.width || !r.height) return [];
    const out = [];
    for (const [fx, fy] of [[0.5, 0.55], [0.5, 0.8], [0.2, 0.4]]) {
        const stack = document.elementsFromPoint(r.left + r.width * fx, r.top + r.height * fy);
        for (const el of stack) {
            if (!app.contains(el) && el !== app) continue;
            const cs = getComputedStyle(el);
            const bg = cs.backgroundColor;
            if (/rgba?\(/.test(bg) && !/rgba?\(\s*0,\s*0,\s*0,\s*0\)|transparent/.test(bg)) { out.push(bg); break; }
            // 漸層底色（例如 radial-gradient）：取裡面的顏色
            const grad = /gradient/.test(cs.backgroundImage) ? cs.backgroundImage.match(/rgba?\([^)]*\)/g) : null;
            if (grad?.length) { out.push(...grad); break; }
        }
    }
    return out;
}

function checkNative() {
    const app = document.getElementById('app');
    if (!app) return;
    try { applyOrders(); } catch (e) { console.warn('[Appearance] 套用順序失敗：', e); }
    const h = location.hash.replace(/^#\/?/, '');
    const home = h === '' || h === 'home';
    // 主畫面是桌布，維持原樣（反相會讓桌布上的白字變黑字）
    if (home) app.setAttribute('data-sx-wallpaper', ''); else app.removeAttribute('data-sx-wallpaper');
    if (document.documentElement.dataset.sxDark !== '1') { app.removeAttribute('data-sx-native-dark'); return; }
    // 先把濾鏡拿掉再取樣，不影響計算出的顏色（getComputedStyle 本來就不受濾鏡影響），只是保險
    if (isDarkBackground(sampleBackgrounds(app))) app.setAttribute('data-sx-native-dark', '');
    else app.removeAttribute('data-sx-native-dark');
}

function scheduleNativeCheck() {
    clearTimeout(timer);
    timer = setTimeout(checkNative, 180);
}

// ───── 換成指定顏色：掃描所有樣式表，把飽和的顏色換掉，產生一份覆蓋用的 CSS ─────
const COLOR_PROPS = /color|background|border|outline|fill|stroke|shadow|^--/;
const sheetCache = new WeakMap(); // sheet → { key, text }
const nodeIsOwn = n => n && OWN_IDS.includes(n.id);

function overridesFor(rules, target, opts) {
    const out = [];
    for (const rule of rules) {
        if (rule.type === 1) { // 一般規則
            const decls = [];
            for (let i = 0; i < rule.style.length; i++) {
                const prop = rule.style[i];
                if (!COLOR_PROPS.test(prop)) continue;
                const val = rule.style.getPropertyValue(prop);
                const next = val && replaceInValue(val, target, opts);
                if (next) decls.push(prop + ': ' + next + ' !important');
            }
            if (decls.length) out.push(rule.selectorText + ' { ' + decls.join('; ') + ' }');
        } else if (rule.type === 4 || rule.type === 12) { // @media、@supports
            const inner = overridesFor(rule.cssRules, target, opts);
            if (inner.length) out.push('@' + (rule.type === 4 ? 'media ' : 'supports ') + (rule.conditionText || rule.media?.mediaText || '') + ' {\n' + inner.join('\n') + '\n}');
        }
    }
    return out;
}

function colorMapText(s) {
    const target = colorTarget(s);
    if (!target) return '';
    const opts = { keepDanger: s.keepDanger };
    const key = target + '|' + s.keepDanger;
    const parts = [];
    for (const sheet of document.styleSheets) {
        if (nodeIsOwn(sheet.ownerNode)) continue;
        let rules;
        try { rules = sheet.cssRules; } catch (_) { continue; } // 跨網域的樣式表（例如字型）讀不到，略過
        if (!rules) continue;
        // Tailwind CDN 會一直往同一張樣式表加規則：規則數變了就重掃
        const sheetKey = key + '|' + rules.length;
        const hit = sheetCache.get(sheet);
        if (hit && hit.key === sheetKey) { parts.push(hit.text); continue; }
        const text = overridesFor(rules, target, opts).join('\n');
        sheetCache.set(sheet, { key: sheetKey, text });
        parts.push(text);
    }
    return parts.join('\n');
}

function styleTag(id) {
    let el = document.getElementById(id);
    if (!el) { el = document.createElement('style'); el.id = id; }
    return el;
}

// 套用「換色」與「自訂 CSS」。兩個 <style> 永遠放在 <head> 最後面，後來才載入的 App 樣式不會蓋過它們
function applyStyles() {
    const colors = styleTag('sx-color-map');
    const next = colorMapText(current);
    if (colors.textContent !== next) colors.textContent = next;
    const built = buildCustomCss(current);
    customErrors = built.errors;
    // 視覺編輯的規則先、手寫的 CSS 後（手寫的可以蓋過）
    const css = [compileRules(current.appRules, getImages()), built.css].filter(Boolean).join('\n\n');
    const custom = styleTag('sx-custom-css');
    if (custom.textContent !== css) custom.textContent = css;
    refreshStickers();
    for (const el of [colors, custom]) if (el.parentNode !== document.head || el.nextElementSibling) document.head.appendChild(el);
}

function scheduleStyles(delay = 150) {
    clearTimeout(cssTimer);
    cssTimer = setTimeout(() => { try { applyStyles(); } catch (e) { console.warn('[Appearance] 套用樣式失敗：', e); } }, delay);
}

export async function initAppearance() {
    mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const local = readLocal();
    if (local) applyAppearance(local);
    try { await loadImages(); } catch (e) { console.warn('[Appearance] 圖片庫載入失敗：', e); }
    try { applyAppearance(await loadAppearance()); } catch (e) { console.warn('[Appearance] 載入失敗：', e); }
    const onSystem = () => applyAppearance(current);
    if (mq?.addEventListener) mq.addEventListener('change', onSystem);
    else mq?.addListener?.(onSystem); // 舊版 Safari
    window.addEventListener('hashchange', () => {
        scheduleNativeCheck();
        // 進到新的 App 後，它的樣式表與 body[data-app] 要一下子才會就緒：早一次、晚一次各補套用（scheduleStyles 會互相取消，所以直接用 setTimeout）
        for (const ms of [300, 1200]) setTimeout(() => { try { applyStyles(); } catch (_) { /* 下次再試 */ } }, ms);
    });
    // 各 App 的樣式是進到該 App 才載入的：有新的樣式表加進來就重掃一次
    if (typeof MutationObserver === 'function') {
        new MutationObserver(list => {
            const added = list.flatMap(m => [...m.addedNodes]).filter(n => (n.tagName === 'LINK' || n.tagName === 'STYLE') && !nodeIsOwn(n));
            added.forEach(n => n.tagName === 'LINK' && n.addEventListener('load', () => scheduleStyles(50), { once: true }));
            // 既有 <style> 的內容被改掉（Tailwind CDN 會這樣加規則）也要重掃；自己的兩個 <style> 不算
            const edited = list.some(m => m.type === 'childList' && m.target.tagName === 'STYLE' && !nodeIsOwn(m.target));
            if (added.length || edited) scheduleStyles(300);
        }).observe(document.head, { childList: true, subtree: true });
    }
    const app = document.getElementById('app');
    if (app && typeof MutationObserver === 'function' && !observer) {
        observer = new MutationObserver(scheduleNativeCheck);
        observer.observe(app, { childList: true, subtree: true });
    }
}
