// Android 桌面風格的「系統介面」：狀態列、下拉通知／快速設定、導覽列（返回／主畫面／最近使用）、點擊水波紋。
// 只在外觀設定選了 Android 時才會出現（setAndroidChrome(true)）；樣式在 css/android.css。
import Router from '../router.js';
import { createElement } from '../components.js';
import { getAllApps } from '../apps/registry.js';
import { currentAppearance, saveAppearance } from './appearance-dom.js';

const RECENTS_KEY = 'sx_recents';
const MAX_RECENTS = 8;
let active = false;
let statusBar = null, navBar = null, shade = null, recentsEl = null, clockTimer = null, toneTimer = null, dotTimer = null, rippleHandler = null, hashHandler = null;

const frame = () => document.querySelector('.phone-frame');
const screen = () => document.querySelector('.phone-screen');
const host = () => screen() || document.body; // 狀態列、通知面板都放在手機螢幕裡（沒有外框時放 body）

// ───── 最近使用 ─────
const loadRecents = () => { try { return JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]').filter(r => r && r.path); } catch (_) { return []; } };
const saveRecents = list => { try { localStorage.setItem(RECENTS_KEY, JSON.stringify(list.slice(0, MAX_RECENTS))); } catch (_) { /* 沒有 localStorage 也沒關係 */ } };

function appForPath(path) {
    const seg = '/' + String(path).replace(/^#?\/?/, '').split('/')[0];
    return getAllApps().find(a => a.navItem?.path === seg || a.routes?.some(r => r.path === seg));
}

function trackRecents() {
    const path = location.hash.replace(/^#/, '') || '/home';
    if (path === '/home' || path === '/') return;
    const app = appForPath(path);
    if (!app?.navItem) return;
    const base = app.navItem.path;
    const list = loadRecents().filter(r => r.path !== base);
    list.unshift({ path: base, label: app.navItem.label || app.name, icon: app.navItem.icon || 'apps', at: Date.now() });
    saveRecents(list);
}

// ───── 真實的通知：購物 App 的送禮提議、今天的行事曆行程 ─────
async function gatherNotes() {
    const notes = [];
    try {
        const { loadProposals, isShown } = await import('./shopping-store.js');
        const shown = (await loadProposals()).filter(p => isShown(p));
        if (shown.length) notes.push({ icon: 'redeem', text: shown.length === 1 ? (shown[0].type === 'return' ? '有人想回送你一份禮物' : '有人想送你一份禮物：' + shown[0].label) : `有 ${shown.length} 位角色想送你禮物`, path: '/taobao' });
    } catch (_) { /* 沒有就算了 */ }
    try {
        const { loadEvents, dateKey } = await import('./calendar.js');
        const today = dateKey(new Date());
        (await loadEvents()).filter(e => dateKey(e.date) === today).slice(0, 3).forEach(e => notes.push({ icon: 'event', text: '今天：' + e.title + (e.time ? '（' + e.time + '）' : ''), path: '/timetree' }));
    } catch (_) { /* 同上 */ }
    return notes;
}

async function refreshDot() {
    const dot = statusBar?.querySelector('.sx-sb-dot');
    if (dot) dot.hidden = !(await gatherNotes()).length;
}

// ───── 狀態列 ─────
function clockText() { const d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

function buildStatusBar() {
    const bar = createElement('div', 'sx-statusbar');
    const time = createElement('span', 'sx-sb-time', { textContent: clockText() });
    const dot = createElement('span', 'material-symbols-outlined sx-sb-dot', { textContent: 'notifications', hidden: true });
    const icons = createElement('span', 'sx-sb-icons');
    icons.innerHTML = '<span class="material-symbols-outlined">signal_cellular_alt</span><span class="material-symbols-outlined">wifi</span><span class="material-symbols-outlined sx-sb-battery">battery_full</span>';
    bar.append(time, dot, icons);
    bar.title = '往下拉打開通知';
    // 點一下或往下拉：打開通知面板
    let y0 = null;
    bar.addEventListener('pointerdown', e => { y0 = e.clientY; });
    bar.addEventListener('pointerup', e => { if (y0 !== null && (e.clientY - y0 > 20 || Math.abs(e.clientY - y0) < 4)) toggleShade(true); y0 = null; });
    clockTimer = setInterval(() => { time.textContent = clockText(); shade?.querySelector('.sx-shade-time') && (shade.querySelector('.sx-shade-time').textContent = clockText()); }, 20000);
    const bat = navigator.getBattery?.();
    bat?.then?.(b => {
        const set = () => { const el = bar.querySelector('.sx-sb-battery'); if (el) el.textContent = b.charging ? 'battery_charging_full' : b.level > 0.8 ? 'battery_full' : b.level > 0.5 ? 'battery_5_bar' : b.level > 0.2 ? 'battery_3_bar' : 'battery_1_bar'; };
        set(); b.addEventListener('levelchange', set); b.addEventListener('chargingchange', set);
    }).catch(() => {});
    return bar;
}

function tone() {
    if (!statusBar) return;
    const onWallpaper = !!document.querySelector('.lock-screen') || /^#?\/?(home)?$/.test(location.hash.replace(/^#/, '')) || location.hash === '#/home';
    statusBar.classList.toggle('on-wallpaper', onWallpaper);
}

// ───── 下拉通知／快速設定 ─────
function toggleShade(open) {
    if (!active) return;
    if (!shade) shade = buildShade();
    if (open === undefined) open = !shade.classList.contains('open');
    if (open) { refreshShade(); setTimeout(() => shade.classList.add('open'), 15); } else shade.classList.remove('open');
}

function buildShade() {
    const el = createElement('div', 'sx-shade');
    el.innerHTML = '<div class="sx-shade-head"><div class="sx-shade-time"></div><div class="sx-shade-date"></div></div><div class="sx-tiles"></div><div class="sx-notes"></div><button class="sx-shade-close" title="收起"></button>';
    el.querySelector('.sx-shade-close').onclick = () => toggleShade(false);
    let y0 = null;
    el.addEventListener('pointerdown', e => { y0 = e.clientY; });
    el.addEventListener('pointerup', e => { if (y0 !== null && y0 - e.clientY > 60) toggleShade(false); y0 = null; });
    host().appendChild(el);
    return el;
}

async function refreshShade() {
    const now = new Date();
    shade.querySelector('.sx-shade-time').textContent = clockText();
    shade.querySelector('.sx-shade-date').textContent = now.toLocaleDateString('zh-TW', { month: 'long', day: 'numeric', weekday: 'long' });
    const s = currentAppearance();
    const tiles = [
        { icon: 'dark_mode', label: '深色模式', on: s.mode === 'dark', run: () => saveAppearance({ ...currentAppearance(), mode: currentAppearance().mode === 'dark' ? 'light' : 'dark' }) },
        { icon: 'palette', label: '外觀設定', run: () => { toggleShade(false); Router.navigate('/appearance'); } },
        { icon: 'settings', label: '設定', run: () => { toggleShade(false); Router.navigate('/settings'); } },
        { icon: 'phone_iphone', label: '改成 iOS', run: () => saveAppearance({ ...currentAppearance(), ui: 'ios' }).then(() => { toggleShade(false); Router.navigate('/home'); Router.handleRoute?.(); }) },
        { icon: 'lock', label: '鎖定螢幕', run: () => { toggleShade(false); window.App?.lock?.(); } },
        { icon: 'home', label: '主畫面', run: () => { toggleShade(false); Router.navigate('/home'); } }
    ];
    const box = shade.querySelector('.sx-tiles');
    box.replaceChildren();
    for (const t of tiles) {
        const b = createElement('button', 'sx-tile' + (t.on ? ' on' : ''));
        b.innerHTML = `<span class="material-symbols-outlined">${t.icon}</span><span>${t.label}</span>`;
        b.onclick = async () => { await t.run(); if (shade?.classList.contains('open')) refreshShade(); };
        box.appendChild(b);
    }
    const notes = shade.querySelector('.sx-notes');
    const items = await gatherNotes();
    if (!shade) return; // 等待期間已經被關掉（切回 iOS）
    notes.replaceChildren();
    const rec = loadRecents();
    notes.append(createElement('div', 'sx-notes-title', { textContent: items.length ? '通知' : '沒有新通知' }));
    items.forEach(n => {
        const row = createElement('button', 'sx-note');
        row.innerHTML = `<span class="material-symbols-outlined">${n.icon}</span><span></span>`;
        row.lastChild.textContent = n.text;
        row.onclick = () => { toggleShade(false); Router.navigate(n.path); };
        notes.appendChild(row);
    });
    if (rec.length) notes.append(createElement('div', 'sx-notes-title', { textContent: '最近使用' }));
    rec.slice(0, 3).forEach(r => {
        const row = createElement('button', 'sx-note');
        row.innerHTML = `<span class="material-symbols-outlined">${r.icon || 'apps'}</span><span>${String(r.label).replace(/[<>&]/g, '')}</span>`;
        row.onclick = () => { toggleShade(false); Router.navigate(r.path); };
        notes.appendChild(row);
    });
}

// ───── 導覽列 ─────
async function goBack() {
    if (shade?.classList.contains('open')) { toggleShade(false); return; }
    if (recentsEl) { closeRecents(); return; }
    const mod = await import('../homescreen.js');
    const hs = mod.default;
    if (hs.drawer) { hs.closeDrawer(); return; }
    if (hs.editing) { hs.exitEdit(); return; }
    if (/^#?\/?(home)?$/.test(location.hash.replace(/^#/, ''))) return; // 已經在桌面
    Router.back();
}

function closeRecents() { recentsEl?.remove(); recentsEl = null; }

function openRecents() {
    if (recentsEl) { closeRecents(); return; }
    toggleShade(false);
    const list = loadRecents();
    const el = createElement('div', 'sx-recents');
    const row = createElement('div', 'sx-recents-row');
    if (!list.length) row.appendChild(createElement('div', 'sx-recents-empty', { textContent: '沒有最近使用的 App' }));
    list.forEach(r => {
        const card = createElement('button', 'sx-recent-card');
        card.innerHTML = `<span class="material-symbols-outlined">${r.icon || 'apps'}</span><span>${String(r.label).replace(/[<>&]/g, '')}</span>`;
        card.onclick = () => { closeRecents(); Router.navigate(r.path); };
        row.appendChild(card);
    });
    const clear = createElement('button', 'sx-recents-clear', { textContent: '全部清除' });
    clear.onclick = () => { saveRecents([]); closeRecents(); };
    el.append(row, clear);
    el.addEventListener('click', e => { if (e.target === el) closeRecents(); });
    host().appendChild(el);
    recentsEl = el;
}

function buildNavBar() {
    const bar = createElement('div', 'sx-navbar');
    const btn = (icon, title, fn) => { const b = createElement('button', 'sx-nav-btn', { title }); b.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`; b.onclick = fn; return b; };
    bar.append(
        btn('arrow_back_ios_new', '返回', goBack),
        btn('radio_button_unchecked', '主畫面', () => { toggleShade(false); closeRecents(); Router.navigate('/home'); }),
        btn('crop_square', '最近使用', openRecents)
    );
    return bar;
}

// ───── 點擊水波紋 ─────
const RIPPLE_TARGETS = 'button, a, [role="button"], .ios-list-cell, .ios-icon-cell, .kakao-chat-cell, .home-app-icon, .home-dock-icon, [class*="-btn"], [class*="card"]';

function onRipple(e) {
    if (!active || e.button > 0) return;
    const t = e.target.closest?.(RIPPLE_TARGETS);
    if (!t || t.closest('.sx-navbar, .sx-statusbar, #sx-editor')) return;
    const r = t.getBoundingClientRect();
    if (r.width < 24 || r.height < 24 || r.width > 600 || r.height > 400) return;
    const parent = document.getElementById('app')?.parentElement || document.body;
    const pr = parent === document.body ? { left: 0, top: 0 } : parent.getBoundingClientRect();
    const hostEl = createElement('div', 'sx-ripple-host');
    hostEl.style.cssText = `left:${r.left - pr.left}px;top:${r.top - pr.top}px;width:${r.width}px;height:${r.height}px;border-radius:${getComputedStyle(t).borderRadius};`;
    const size = Math.max(r.width, r.height) * 2;
    const dot = createElement('span', 'sx-ripple');
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px;`;
    hostEl.appendChild(dot);
    parent.appendChild(hostEl);
    setTimeout(() => hostEl.remove(), 600);
}

// ───── 開關 ─────
export function setAndroidChrome(on) {
    if (on === active) { if (on) tone(); return; }
    active = on;
    document.body.classList.toggle('sx-android', on);
    if (on) {
        statusBar = buildStatusBar();
        host().appendChild(statusBar);
        navBar = buildNavBar();
        (frame() || document.body).appendChild(navBar);
        rippleHandler = onRipple;
        document.addEventListener('pointerdown', rippleHandler, true);
        hashHandler = () => { trackRecents(); tone(); closeRecents(); toggleShade(false); setTimeout(tone, 400); };
        window.addEventListener('hashchange', hashHandler);
        trackRecents(); tone(); setTimeout(tone, 800);
        refreshDot(); dotTimer = setInterval(refreshDot, 60000);
        toneTimer = setInterval(tone, 1000); // 鎖定畫面／解鎖不會換網址，用定時檢查狀態列要用淺色還是深色
    } else {
        clearInterval(clockTimer); clearInterval(toneTimer); clearInterval(dotTimer);
        statusBar?.remove(); navBar?.remove(); shade?.remove(); closeRecents();
        statusBar = navBar = shade = null;
        document.removeEventListener('pointerdown', rippleHandler, true);
        window.removeEventListener('hashchange', hashHandler);
    }
}
