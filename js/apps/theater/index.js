import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const defaultContent = [
  {
    id: 'demo1',
    title: '星際迷航',
    desc: '一段跨越星系的冒險故事',
    category: 'movie',
    cover: 'https://images.unsplash.com/photo-1534796636912-3b95b3ab5986?w=400',
    html: `<div style="padding: 20px; background: linear-gradient(135deg, #0a0a1a, #1a1a3a); border-radius: 12px;">
      <h2 style="color: #e50914; margin-bottom: 16px;">序幕：啟航</h2>
      <p style="color: #b3b3b3; line-height: 1.8;">在無垠的宇宙深處，一艘星艦緩緩駛離了太空站...</p>
    </div>`
  },
  {
    id: 'demo2',
    title: '校園戀曲',
    desc: '青春校園裡的浪漫故事',
    category: 'series',
    cover: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=400',
    html: `<div style="padding: 20px; background: linear-gradient(135deg, #fce4ec, #f8bbd9); border-radius: 12px;">
      <h2 style="color: #c2185b; margin-bottom: 16px;">第一章：相遇</h2>
      <p style="color: #880e4f; line-height: 1.8;">櫻花盛開的季節，新的故事即將開始...</p>
    </div>`
  }
];

let contentData = [];
let currentContent = null;

async function loadContent() {
  const saved = await SettingsDB.get('theater_content');
  contentData = saved || [...defaultContent];
}

async function saveContent() {
  await SettingsDB.set('theater_content', contentData);
}

function renderContent(container) {
  const grid = container.querySelector('.theater-grid');
  if (!grid) return;
  
  grid.innerHTML = contentData.map(item => `
    <div class="theater-card" data-id="${item.id}">
      ${item.cover 
        ? `<img src="${item.cover}" alt="${item.title}" class="theater-poster">`
        : `<div class="theater-placeholder"><i class="fas fa-film"></i></div>`
      }
      <div class="theater-title">${item.title}</div>
    </div>
  `).join('') || '<div class="empty-state">尚無劇目</div>';
  
  grid.querySelectorAll('.theater-card').forEach(card => {
    card.onclick = () => openDetail(container, card.dataset.id);
  });
}

function openDetail(container, id) {
  currentContent = contentData.find(c => c.id === id);
  if (!currentContent) return;
  
  const modal = container.querySelector('.detail-modal');
  const title = container.querySelector('.detail-title');
  const desc = container.querySelector('.detail-desc');
  const preview = container.querySelector('.detail-preview');
  
  if (title) title.textContent = currentContent.title;
  if (desc) desc.textContent = currentContent.desc;
  if (preview) preview.innerHTML = currentContent.html || '<p style="color: #888;">無預覽內容</p>';
  if (modal) modal.classList.add('active');
}

function closeDetail(container) {
  const modal = container.querySelector('.detail-modal');
  if (modal) modal.classList.remove('active');
  currentContent = null;
}

async function renderTheater(params) {
  await loadContent();
  
  const container = createElement('div', 'app-container theater-app');
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">劇場</h1>
    </header>
    
    <div class="page">
      <div class="theater-grid"></div>
      
      <button class="add-btn">
        <i class="fas fa-plus"></i> 新增劇目
      </button>
      
      <div class="detail-modal">
        <div class="detail-content">
          <button class="close-detail-btn">
            <i class="fas fa-times"></i>
          </button>
          <h2 class="detail-title"></h2>
          <p class="detail-desc"></p>
          <div class="detail-preview"></div>
        </div>
      </div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.navigate('/');
  
  const closeDetailBtn = container.querySelector('.close-detail-btn');
  if (closeDetailBtn) {
    closeDetailBtn.onclick = () => closeDetail(container);
  }
  
  const addBtn = container.querySelector('.add-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      const id = 'content_' + Date.now();
      contentData.unshift({
        id,
        title: '新劇目',
        desc: '請編輯描述',
        category: 'movie',
        cover: '',
        html: '<div style="padding: 20px;">內容編輯中...</div>'
      });
      saveContent();
      renderContent(container);
    };
  }
  
  renderContent(container);
  
  return { element: container, cleanup: null };
}

export default {
  id: 'theater',
  name: '劇場',
  icon: 'theater-masks',
  routes: [{ path: '/theater', render: renderTheater }],
  navItem: { label: '劇場', icon: 'theater-masks', path: '/theater', showInNav: true, order: 103 },
  styles: () => import('./style.css')
};