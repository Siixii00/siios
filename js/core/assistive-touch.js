import Router from '../router.js';
import { createElement, createToast } from '../components.js';
import { SettingsDB } from '../db.js';

const ENABLED_KEY = 'touch_enabled';
const POS_KEY = 'touch_pos';
const VOLUME_KEY = 'touch_volume';
const ALBUM_KEY = 'sx_album_images';
const VOLUME_STEPS = [100, 75, 50, 25, 0];   // 依序循環，不會一按就靜音

let ball = null;
let menu = null;
let observer = null;
let hostCheck = null;

function host() {
    return window.App?.getAppContainer?.()?.parentElement || document.body;
}

// ---- 動作 ----
export async function getVolume() {
    const v = await SettingsDB.get(VOLUME_KEY);
    return typeof v === 'number' ? v : 100;
}

function applyVolume(percent) {
    document.querySelectorAll('audio, video').forEach(m => { m.volume = percent / 100; });
}

// 之後新增的 <audio>／<video>（聊天裡的語音、影片）也套用同一個音量
function watchMedia(percent) {
    observer?.disconnect();
    observer = new MutationObserver(muts => {
        for (const mut of muts) {
            mut.addedNodes.forEach(n => {
                if (n.nodeType !== 1) return;
                if (n.matches?.('audio, video')) n.volume = percent / 100;
                n.querySelectorAll?.('audio, video').forEach(m => { m.volume = percent / 100; });
            });
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

export async function cycleVolume() {
    const cur = await getVolume();
    const next = VOLUME_STEPS.find(s => s < cur) ?? VOLUME_STEPS[0];
    await SettingsDB.set(VOLUME_KEY, next);
    applyVolume(next);
    watchMedia(next);
    createToast('媒體音量：' + next + '%（作用於聊天語音、影片等）');
    return next;
}

export async function takeScreenshot() {
    if (!navigator.mediaDevices?.getDisplayMedia) {
        createToast('這個瀏覽器不支援螢幕擷取（手機瀏覽器多半不支援），請改用系統截圖', 'error');
        return false;
    }
    let stream;
    try {
        stream = await navigator.mediaDevices.getDisplayMedia({ video: true, preferCurrentTab: true });
    } catch (e) {
        createToast(e.name === 'NotAllowedError' ? '你取消了螢幕擷取' : '無法擷取畫面：' + (e.message || e.name), 'error');
        return false;
    }
    try {
        const video = document.createElement('video');
        video.srcObject = stream;
        video.muted = true;
        await video.play();
        await new Promise(r => setTimeout(r, 250));   // 等第一個畫面穩定
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d').drawImage(video, 0, 0);
        const url = canvas.toDataURL('image/jpeg', 0.85);
        const list = (await SettingsDB.get(ALBUM_KEY)) || [];
        list.unshift({ id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), url, source: 'uploaded', createdAt: new Date().toISOString() });
        await SettingsDB.set(ALBUM_KEY, list.slice(0, 200));
        createToast('截圖已存到相簿');
        return true;
    } catch (e) {
        createToast('截圖失敗：' + (e.message || e), 'error');
        return false;
    } finally {
        stream.getTracks().forEach(t => t.stop());
    }
}

export const ACTIONS = [
    { id: 'home', label: '主畫面', icon: 'home', run: () => Router.navigate('/home') },
    { id: 'back', label: '返回', icon: 'arrow_back', run: () => Router.back() },
    { id: 'lock', label: '鎖定', icon: 'lock', run: () => window.App?.lock?.() },
    { id: 'volume', label: '音量', icon: 'volume_up', run: () => cycleVolume() },
    { id: 'screenshot', label: '截圖', icon: 'screenshot', run: () => takeScreenshot() }
];

// ---- 浮動按鈕 ----
function closeMenu() {
    menu?.remove();
    menu = null;
}

function openMenu() {
    closeMenu();
    menu = createElement('div', 'assistive-menu');
    ACTIONS.forEach(a => {
        const btn = createElement('button', 'assistive-menu-item');
        btn.innerHTML = '<span class="material-symbols-outlined">' + a.icon + '</span><span>' + a.label + '</span>';
        btn.onclick = () => { closeMenu(); a.run(); };
        menu.appendChild(btn);
    });
    if (host() === document.body) menu.style.position = 'fixed';
    host().appendChild(menu);
    const W = host().offsetWidth;
    const H = host().offsetHeight;
    menu.style.top = Math.min(Math.max(8, ball.offsetTop - 4), H - 230) + 'px';
    if (ball.offsetLeft > W / 2) menu.style.right = (W - ball.offsetLeft + 8) + 'px';
    else menu.style.left = (ball.offsetLeft + 56) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', outsideClose, { once: true, capture: true }), 0);
}

function outsideClose(e) {
    if (menu && !menu.contains(e.target) && e.target !== ball && !ball.contains(e.target)) closeMenu();
    else if (menu) setTimeout(() => document.addEventListener('pointerdown', outsideClose, { once: true, capture: true }), 0);
}

async function placeBall() {
    const W = host().offsetWidth;
    const H = host().offsetHeight;
    const saved = await SettingsDB.get(POS_KEY);
    const x = typeof saved?.x === 'number' ? saved.x : 0.88;
    const y = typeof saved?.y === 'number' ? saved.y : 0.7;
    ball.style.left = Math.max(0, Math.min(W - 48, x * W - 24)) + 'px';
    ball.style.top = Math.max(0, Math.min(H - 48, y * H - 24)) + 'px';
}

// 桌機模式的手機外框會被縮放：螢幕上的移動距離要換算回 CSS 像素
function hostScale() {
    const el = host();
    return el.offsetWidth ? el.getBoundingClientRect().width / el.offsetWidth : 1;
}

function makeDraggable() {
    let start = null;
    ball.addEventListener('pointerdown', e => {
        e.preventDefault();   // 避免滑鼠拖曳時選取文字或觸發原生拖放
        try { ball.setPointerCapture(e.pointerId); } catch { /* 指標已失效時略過，仍可用一般事件拖曳 */ }
        closeMenu();
        ball.style.transition = 'none';   // 拖曳時不要有動畫，否則位置會落後手指
        start = { px: e.clientX, py: e.clientY, left: ball.offsetLeft, top: ball.offsetTop, lastLeft: ball.offsetLeft, lastTop: ball.offsetTop, moved: false, scale: hostScale() || 1 };
    });
    ball.addEventListener('pointermove', e => {
        if (!start) return;
        const dx = (e.clientX - start.px) / start.scale;
        const dy = (e.clientY - start.py) / start.scale;
        if (!start.moved && Math.hypot(dx, dy) < 6) return;
        start.moved = true;
        start.lastLeft = Math.max(0, Math.min(host().offsetWidth - 48, start.left + dx));
        start.lastTop = Math.max(0, Math.min(host().offsetHeight - 48, start.top + dy));
        ball.style.left = start.lastLeft + 'px';
        ball.style.top = start.lastTop + 'px';
    });
    // pointerup 與 pointercancel 都要結束拖曳：瀏覽器可能在拖曳中途送出 cancel，此時仍要吸附並記住位置
    const finish = async (isCancel) => {
        if (!start) return;
        const { moved, lastLeft, lastTop } = start;
        start = null;
        ball.style.transition = '';
        if (!moved) { if (!isCancel) openMenu(); return; }
        // 放開後吸附到左右邊緣並記住位置
        const W = host().offsetWidth;
        const H = host().offsetHeight;
        const toRight = lastLeft + 24 > W / 2;
        ball.style.left = (toRight ? W - 48 : 0) + 'px';
        await SettingsDB.set(POS_KEY, { x: toRight ? (W - 24) / W : 24 / W, y: (lastTop + 24) / H });
    };
    ball.addEventListener('pointerup', () => finish(false));
    ball.addEventListener('pointercancel', () => finish(true));
}

export async function setAssistiveTouch(enabled) {
    await SettingsDB.set(ENABLED_KEY, !!enabled);
    await refreshAssistiveTouch();
}

export function isBallVisible() {
    return !!ball && ball.isConnected && ball.style.display !== 'none';
}

export async function refreshAssistiveTouch() {
    const enabled = (await SettingsDB.get(ENABLED_KEY)) === true;
    if (!enabled) {
        closeMenu();
        ball?.remove();
        ball = null;
        clearInterval(hostCheck);
        return;
    }
    if (!ball) {
        ball = createElement('button', 'assistive-ball', { 'aria-label': '輔助觸控' });
        ball.innerHTML = '<span class="material-symbols-outlined">touch_app</span>';
        makeDraggable();
        // 鎖定畫面上不顯示
        hostCheck = setInterval(() => { if (ball) ball.style.display = window.App?.isLocked ? 'none' : ''; }, 400);
    }
    if (host() === document.body) ball.style.position = 'fixed';
    if (!ball.isConnected) host().appendChild(ball);
    await placeBall();
    const volume = await getVolume();
    if (volume !== 100) { applyVolume(volume); watchMedia(volume); }
}

export const initAssistiveTouch = refreshAssistiveTouch;
