// 外觀用的圖片：圖片庫（上傳、縮圖、存在 IndexedDB）與「圖片貼紙」在畫面上的顯示。規則與限制見 appearance-rules.js。
import { SettingsDB } from '../db.js';
import { sanitizeImages, MAX_IMAGES, stickersFor, stickerStyle } from './appearance-rules.js';

const KEY = 'appearance_images';
const MAX_EDGE = 1280;
const MAX_CHARS = 1_400_000; // 縮圖後的 data URL 太大就改用壓縮率較高的 JPEG
let images = {};

export async function loadImages() {
    images = sanitizeImages(await SettingsDB.get(KEY));
    return images;
}
export const getImages = () => images;

async function persist() { await SettingsDB.set(KEY, images); }

function readAsImage(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('無法讀取這張圖片')); };
        img.src = url;
    });
}

// 縮到最長邊 1280px 再存成 data URL（手機相片動輒好幾 MB，原圖存不下也沒必要）
export async function fileToDataUrl(file) {
    if (!/^image\/(png|jpe?g|webp|gif)$/i.test(file.type)) throw new Error('只支援 PNG、JPG、WebP、GIF 圖片');
    if (file.size > 15 * 1024 * 1024) throw new Error('圖片太大（超過 15MB）');
    const img = await readAsImage(file);
    const scale = Math.min(1, MAX_EDGE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    let url = canvas.toDataURL('image/webp', 0.85);
    if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/png');
    if (url.length > MAX_CHARS) url = canvas.toDataURL('image/jpeg', 0.8);
    return url;
}

// 加進圖片庫，回傳新圖片的代號
export async function addImageFile(file) {
    if (Object.keys(images).length >= MAX_IMAGES) throw new Error(`圖片庫最多 ${MAX_IMAGES} 張，請先刪除不用的`);
    const url = await fileToDataUrl(file);
    const id = 'i' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    images = { ...images, [id]: url };
    await persist();
    return id;
}

export async function removeImage(id) {
    const { [id]: _gone, ...rest } = images;
    images = rest;
    await persist();
}

// ───── 圖片貼紙 ─────
// editing 為 true 時貼紙可以拖曳；onMove(id, {x, y}) 在拖曳結束時呼叫，onSelect(id) 在點選時呼叫
export function renderStickers(settings, appId, { editing = false, selectedId = null, onMove = null, onSelect = null } = {}) {
    const app = document.getElementById('app');
    if (!app) return;
    const host = app.parentElement || document.body;
    let box = document.getElementById('sx-stickers');
    const list = stickersFor(settings.stickers, appId).filter(s => images[s.img]);
    if (!list.length && !box) return;
    if (!box) {
        box = document.createElement('div');
        box.id = 'sx-stickers';
        box.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:6;overflow:hidden;';
    }
    if (box.parentElement !== host) host.appendChild(box);
    box.replaceChildren();
    for (const s of list) {
        const el = document.createElement('img');
        el.src = images[s.img];
        el.alt = '';
        el.draggable = false;
        el.dataset.sticker = s.id;
        el.style.cssText = `position:absolute;${stickerStyle(s)}height:auto;user-select:none;-webkit-user-drag:none;touch-action:none;` +
            (editing ? `pointer-events:auto;cursor:move;outline:${s.id === selectedId ? '2px solid #3b82f6' : '1px dashed rgba(59,130,246,.6)'};` : '');
        if (editing) wireDrag(el, s, box, onMove, onSelect);
        box.appendChild(el);
    }
}

function wireDrag(el, s, box, onMove, onSelect) {
    el.addEventListener('pointerdown', e => {
        e.preventDefault(); e.stopPropagation();
        // 拖曳途中不能重畫貼紙（會換掉正在拖的元素），所以選取放到放開手指之後
        const r = box.getBoundingClientRect();
        let moved = false;
        const move = ev => {
            moved = true;
            const x = Math.min(120, Math.max(-20, ((ev.clientX - r.left) / r.width) * 100));
            const y = Math.min(120, Math.max(-20, ((ev.clientY - r.top) / r.height) * 100));
            el.style.left = x + '%'; el.style.top = y + '%';
            el.dataset.x = x; el.dataset.y = y;
        };
        const up = () => {
            window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up);
            if (moved) onMove?.(s.id, { x: Number(el.dataset.x), y: Number(el.dataset.y) });
            onSelect?.(s.id);
        };
        window.addEventListener('pointermove', move); window.addEventListener('pointerup', up);
    });
}
