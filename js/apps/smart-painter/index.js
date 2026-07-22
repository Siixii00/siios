import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const FILTERS = [
  { id: 'normal', name: '原圖', filter: 'none' },
  { id: 'vintage', name: '復古', filter: 'sepia(0.6)' },
  { id: 'bw', name: '黑白', filter: 'grayscale(1)' },
  { id: 'warm', name: '暖色', filter: 'sepia(0.3) saturate(1.4)' },
  { id: 'cool', name: '冷色', filter: 'hue-rotate(180deg) saturate(0.8)' },
  { id: 'drama', name: '戲劇', filter: 'contrast(1.3) brightness(0.9)' }
];

let photos = [];
let activeFilter = 'normal';

async function loadPhotos() {
  const saved = await SettingsDB.get('painter_photos');
  if (saved) photos = saved;
}

async function savePhotos() {
  await SettingsDB.set('painter_photos', photos);
}

async function renderSmartPainter(params) {
  await loadPhotos();
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
      <div class="filter-bar">
        ${FILTERS.map(f => `
          <button class="filter-btn ${f.id === activeFilter ? 'active' : ''}" data-filter="${f.filter}" data-id="${f.id}">
            ${f.name}
          </button>
        `).join('')}
      </div>
      <div class="action-row">
        <button class="upload-btn"><i class="fas fa-upload"></i> 上傳照片</button>
        <button class="save-btn"><i class="fas fa-download"></i> 儲存</button>
      </div>
      <div class="gallery">
        <h3>相簿 (${photos.length})</h3>
        <div class="photo-grid">
          ${photos.slice(-6).map(p => `<div class="photo-thumb" style="background-image: url('${p.url}')"></div>`).join('') || '<div class="empty-gallery">尚無照片</div>'}
        </div>
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelectorAll('.filter-btn').forEach(btn => {
    btn.onclick = () => {
      activeFilter = btn.dataset.id;
      const preview = container.querySelector('#preview');
      if (preview && preview.tagName !== 'IMG') return;
      if (preview) preview.style.filter = btn.dataset.filter;
      container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });
  container.querySelector('.upload-btn').onclick = () => {
    const url = prompt('輸入圖片 URL：');
    if (url) {
      const preview = container.querySelector('#preview');
      preview.innerHTML = `<img src="${url}" style="width: 100%; height: 100%; object-fit: contain; filter: ${FILTERS.find(f => f.id === activeFilter).filter};">`;
    }
  };
  container.querySelector('.save-btn').onclick = async () => {
    const img = container.querySelector('#preview img');
    if (img) {
      photos.push({ url: img.src, filter: activeFilter, date: Date.now() });
      await savePhotos();
      renderSmartPainter(params);
    }
  };
  return { element: container, cleanup: null };
}

export default {
  id: 'smart-painter',
  name: '照相館',
  icon: 'camera',
  routes: [{ path: '/smart-painter', render: renderSmartPainter }],
  navItem: { label: '照相館', icon: 'camera', path: '/smart-painter', showInNav: true, order: 131 },
  styles: () => import('./style.css')
};