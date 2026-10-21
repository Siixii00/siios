import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { pickFile, compressImage } from '../chats/chat-media.js';

const FILTERS = [
  { id: 'normal', name: '原圖', filter: 'none' },
  { id: 'vintage', name: '復古', filter: 'sepia(0.6)' },
  { id: 'bw', name: '黑白', filter: 'grayscale(1)' },
  { id: 'warm', name: '暖色', filter: 'sepia(0.3) saturate(1.4)' },
  { id: 'cool', name: '冷色', filter: 'hue-rotate(180deg) saturate(0.8)' },
  { id: 'drama', name: '戲劇', filter: 'contrast(1.3) brightness(0.9)' }
];

const ALBUM_KEY = 'sx_album_images';
const MAX_DIM = 1280;

let activeFilter = 'normal';
let sourceUrl = null;    // 目前編輯中的原圖（data URL）

const filterCss = () => FILTERS.find(f => f.id === activeFilter).filter;

async function loadPainterPhotos() {
  const list = await SettingsDB.get(ALBUM_KEY);
  return Array.isArray(list) ? list.filter(p => p.source === 'painter') : [];
}

async function addToAlbum(url) {
  const list = (await SettingsDB.get(ALBUM_KEY)) || [];
  list.unshift({ id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), url, source: 'painter', createdAt: new Date().toISOString() });
  await SettingsDB.set(ALBUM_KEY, list.slice(0, 200));
  import('../../core/activity-memory.js').then(m => m.rememberActivity({ sourceApp: 'smart-painter', content: '用戶用照相館修了一張照片，存到相簿', importance: 0.3, dedupeMs: 60 * 1000 })).catch(() => {});
}

// 真的把濾鏡畫進圖片後輸出；瀏覽器不支援 canvas filter 時退回原圖並告知
async function renderFiltered(url) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('無法讀取圖片'));
    el.src = url;
  });
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  const supported = typeof ctx.filter === 'string';
  if (supported) ctx.filter = filterCss();
  ctx.drawImage(img, 0, 0);
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.9), filtered: supported || activeFilter === 'normal' };
}

async function renderSmartPainter() {
  const photos = await loadPainterPhotos();
  const container = createElement('div', 'app-container painter-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">照相館</h1>
    </header>
    <div class="page">
      <div class="preview-area">
        <div class="preview-placeholder" id="preview">
          <i class="fas fa-camera"></i>
          <p>選擇照片開始編輯</p>
        </div>
      </div>
      <div class="filter-bar"></div>
      <div class="action-row">
        <button class="upload-btn"><i class="fas fa-upload"></i> 選擇照片</button>
        <button class="save-btn"><i class="fas fa-download"></i> 儲存到相簿</button>
      </div>
      <div class="gallery">
        <h3>我的作品 (${photos.length})</h3>
        <div class="photo-grid"></div>
      </div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const preview = container.querySelector('#preview');
  const bar = container.querySelector('.filter-bar');

  function showImage(url) {
    sourceUrl = url;
    preview.innerHTML = '';
    const img = createElement('img', '', { src: url, alt: '預覽' });
    img.style.cssText = 'width:100%;height:100%;object-fit:contain;max-height:360px;filter:' + filterCss() + ';';
    preview.appendChild(img);
  }

  FILTERS.forEach(f => {
    const btn = createElement('button', 'filter-btn' + (f.id === activeFilter ? ' active' : ''), { textContent: f.name });
    btn.onclick = () => {
      activeFilter = f.id;
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b === btn));
      const img = preview.querySelector('img');
      if (img) img.style.filter = f.filter;
    };
    bar.appendChild(btn);
  });

  container.querySelector('.upload-btn').onclick = async () => {
    const file = await pickFile({ accept: 'image/*' });
    if (!file) return;
    try {
      showImage(await compressImage(file, MAX_DIM));
    } catch (e) {
      createToast(e.message || '無法讀取這張圖片', 'error');
    }
  };

  const saveBtn = container.querySelector('.save-btn');
  saveBtn.onclick = async () => {
    if (!sourceUrl) {
      createToast('請先選擇一張照片');
      return;
    }
    saveBtn.disabled = true;
    try {
      const { dataUrl, filtered } = await renderFiltered(sourceUrl);
      await addToAlbum(dataUrl);
      createToast(filtered ? '已儲存到相簿' : '此瀏覽器不支援儲存濾鏡效果，已儲存原圖', filtered ? undefined : 'error');
      Router.handleRoute();
    } catch (e) {
      createToast('儲存失敗：' + (e.message || e), 'error');
      saveBtn.disabled = false;
    }
  };

  const grid = container.querySelector('.photo-grid');
  if (photos.length === 0) grid.appendChild(createElement('div', 'empty-gallery', { textContent: '尚無作品' }));
  photos.slice(0, 6).forEach(p => {
    const thumb = createElement('button', 'photo-thumb', { 'aria-label': '載入這張作品' });
    thumb.style.backgroundImage = 'url("' + p.url.replace(/"/g, '%22') + '")';
    thumb.onclick = () => showImage(p.url);
    grid.appendChild(thumb);
  });

  if (sourceUrl) showImage(sourceUrl);
  return { element: container, cleanup: null };
}

export default {
  id: 'smart-painter',
  name: '照相館',
  icon: 'camera',
  routes: [{ path: '/smart-painter', render: renderSmartPainter }],
  navItem: { label: '照相館', icon: 'camera', path: '/smart-painter', showInNav: true, order: 131 },
  stylesPath: 'js/apps/smart-painter/style.css'
};
