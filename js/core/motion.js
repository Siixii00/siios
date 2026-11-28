// 動態效果：開啟 App 時從圖示放大、返回主畫面、App 內換頁的滑動、清單依序進場。
// 只用 Web Animations API 的獨立屬性（translate / scale / opacity / clip-path），不會蓋掉元素自己的 transform，
// 動畫結束後元素回到原樣，不會留下任何樣式。系統開啟「減少動態效果」或 <html data-motion="off"> 時完全不動。

const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)'; // 先快後慢、結尾柔和（iOS 面板的曲線）
const ICON_SELECTOR = '.home-app-icon, .home-dock-icon';
const STAGGER_SELECTOR = '.ios-list-cell, .card';
const PENDING_MS = 2000; // 點了圖示之後，多久內掛上的 App 頁面算是「從圖示開啟」

function depth(hash) {
    return String(hash || '').replace(/^#/, '').split('/').filter(Boolean).length;
}

export function kindOf(el) {
    if (el.classList.contains('lock-screen')) return 'lock';
    if (el.classList.contains('home-screen')) return 'home';
    return 'app';
}

// 依「現在掛上什麼」與「剛才從哪裡來」挑一種轉場
export function pickTransition({ kind, lastNonHome, prevKind, prevHash, hash, fromIcon }) {
    if (kind === 'lock') return 'none';
    if (kind === 'home') return lastNonHome === 'lock' ? 'home-unlock' : 'home-return';
    if (prevKind === 'app' && hash === prevHash) return 'none'; // 同一頁重新渲染（例如搜尋後重畫）不要再動一次
    if (fromIcon) return 'zoom';
    return depth(hash) < depth(prevHash) ? 'slide-back' : 'slide-forward';
}

function motionAllowed() {
    if (typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return false;
    if (typeof CSS !== 'undefined' && CSS.supports && !CSS.supports('translate', '0 0')) return false;
    if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
    return document.documentElement.dataset.motion !== 'off';
}

function play(el, keyframes, options) {
    try { return el.animate(keyframes, { easing: EASE_OUT, ...options }); } catch (e) { return null; }
}

// 從點的那個圖示的位置放大成整個畫面
function zoomFromIcon(el, pending) {
    const r = el.getBoundingClientRect();
    el.style.transformOrigin = `${pending.cx - r.left}px ${pending.cy - r.top}px`;
    // 有些 App 容器本身沒有背景色（背景在內層）；放大期間要不透明，否則後面的主畫面會透出來
    const addedBg = getComputedStyle(el).backgroundColor === 'rgba(0, 0, 0, 0)';
    if (addedBg) el.style.backgroundColor = getComputedStyle(document.body).backgroundColor;
    const a = play(el, [
        { scale: 0.14, opacity: 0, clipPath: 'inset(0 round 120px)', offset: 0 },
        { opacity: 1, offset: 0.3 },
        { scale: 1, clipPath: 'inset(0 round 0px)', offset: 1 }
    ], { duration: 420 });
    const reset = () => { el.style.transformOrigin = ''; if (addedBg) el.style.backgroundColor = ''; };
    if (a) a.finished.then(reset, reset); else reset();
    return a;
}

// 被換掉的主畫面先留在後面，App 放大時它微微縮小變暗，看起來像 App 從主畫面「浮」出來
function recedeHome(host, el, home, zoom) {
    if (!home || home.isConnected) return;
    home.dataset.motionBackdrop = '1';
    home.style.cssText += ';position:absolute;inset:0;z-index:0;pointer-events:none;overflow:hidden';
    host.insertBefore(home, el);
    play(home, [
        { scale: 1, filter: 'brightness(1)' },
        { scale: 0.94, filter: 'brightness(0.7)' }
    ], { duration: 420, fill: 'forwards' });
    const done = () => home.remove();
    if (zoom) zoom.finished.then(done, done);
    setTimeout(done, 1500);
}

function slide(el, dir) {
    play(el, [
        { translate: `${dir * 22}px 0`, opacity: 0 },
        { translate: '0 0', opacity: 1 }
    ], { duration: 240 });
}

// 清單／卡片依序淡入上移（只處理畫面內的前幾個，避免長清單一次排一大堆動畫）
function stagger(root, baseDelay) {
    const items = [...root.querySelectorAll(STAGGER_SELECTOR)].slice(0, 40).filter(el => {
        const r = el.getBoundingClientRect();
        return r.height > 0 && r.bottom > 0 && r.top < innerHeight;
    }).slice(0, 12);
    items.forEach((el, i) => play(el, [
        { opacity: 0, translate: '0 10px' },
        { opacity: 1, translate: '0 0' }
    ], { duration: 300, delay: baseDelay + i * 35, fill: 'backwards' }));
}

function homeUnlock(el) {
    // 只處理目前這一頁看得到的圖示（其他頁在畫面外，動了也看不到）
    const icons = [...el.querySelectorAll(ICON_SELECTOR)].filter(icon => {
        const r = icon.getBoundingClientRect();
        return r.right > 0 && r.left < innerWidth;
    }).slice(0, 24);
    icons.forEach((icon, i) => play(icon, [
        { opacity: 0, translate: '0 16px', scale: 0.9 },
        { opacity: 1, translate: '0 0', scale: 1 }
    ], { duration: 380, delay: i * 22, fill: 'backwards' }));
}

function homeReturn(el) {
    play(el, [
        { scale: 1.06, opacity: 0.3 },
        { scale: 1, opacity: 1 }
    ], { duration: 260 });
}

export function initMotion(host) {
    if (!host || typeof MutationObserver === 'undefined') return;

    let pending = null;            // 最近一次點的圖示位置
    let lastNonHome = 'lock';      // 進主畫面前是鎖定畫面（解鎖）還是 App（返回）
    let prevKind = 'lock';
    let prevHash = '';

    // 點圖示時先記下位置（capture：早於圖示自己的點擊處理）。編輯模式下點圖示不會開啟，不記。
    document.addEventListener('click', e => {
        const icon = e.target.closest && e.target.closest(ICON_SELECTOR);
        if (!icon || icon.closest('.home-screen.editing')) return;
        const box = icon.querySelector('.home-app-icon-bg, .home-dock-icon-bg') || icon;
        const r = box.getBoundingClientRect();
        pending = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, t: performance.now(), home: icon.closest('.home-screen') };
    }, true);

    new MutationObserver(records => {
        const added = [];
        for (const rec of records) for (const n of rec.addedNodes) if (n.nodeType === 1 && !n.dataset.motionBackdrop) added.push(n);
        const el = added[added.length - 1];
        if (!el) return;

        const kind = kindOf(el);
        const hash = location.hash;
        const fromIcon = !!pending && performance.now() - pending.t < PENDING_MS;
        const type = pickTransition({ kind, lastNonHome, prevKind, prevHash, hash, fromIcon });

        const used = pending;
        if (kind !== 'lock') pending = null;
        if (kind !== 'home') lastNonHome = kind;
        prevKind = kind;
        prevHash = hash;

        if (type === 'none' || !motionAllowed()) return;
        if (type === 'zoom') { recedeHome(host, el, used.home, zoomFromIcon(el, used)); stagger(el, 180); }
        else if (type === 'slide-forward') { slide(el, 1); stagger(el, 60); }
        else if (type === 'slide-back') { slide(el, -1); stagger(el, 60); }
        else if (type === 'home-unlock') homeUnlock(el);
        else if (type === 'home-return') homeReturn(el);
    }).observe(host, { childList: true });
}
