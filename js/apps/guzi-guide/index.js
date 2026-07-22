import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const CATEGORIES = ['徽章', '立牌', '海報', '吊卡', '其他'];

let items = [];

async function loadItems() {
  const saved = await SettingsDB.get('guzi_items');
  if (saved) items = saved;
}

async function saveItems() {
  await SettingsDB.set('guzi_items', items);
}

async function renderGuziGuide(params) {
  await loadItems();
  const container = createElement('div', 'app-container guzi-app');
  const stats = {};
  CATEGORIES.forEach(c => stats[c] = items.filter(i => i.category === c).length);
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">谷子圖鑑</h1>
    </header>
    <div class="page">
      <div class="stats-grid">
        ${CATEGORIES.map(c => `
          <div class="stat-card">
            <span class="stat-label">${c}</span>
            <span class="stat-value">${stats[c]}</span>
          </div>
        `).join('')}
      </div>
      <div class="total-count">
        <span>總計</span>
        <span class="total">${items.length} 件</span>
      </div>
      <div class="item-list">
        ${items.slice(-10).reverse().map(i => `
          <div class="item-row">
            <span class="item-name">${i.name}</span>
            <span class="item-cat">${i.category}</span>
          </div>
        `).join('') || '<div class="empty-items">尚無收藏</div>'}
      </div>
      <button class="add-btn"><i class="fas fa-plus"></i> 新增收藏</button>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelector('.add-btn').onclick = async () => {
    const name = prompt('名稱：');
    if (!name) return;
    const category = prompt('分類（徽章/立牌/海報/吊卡/其他）：') || '其他';
    items.push({ name, category, id: Date.now(), addedAt: new Date().toISOString() });
    await saveItems();
    renderGuziGuide(params);
  };
  return { element: container, cleanup: null };
}

export default {
  id: 'guzi-guide',
  name: '谷子圖鑑',
  icon: 'bookmark',
  routes: [{ path: '/guzi-guide', render: renderGuziGuide }],
  navItem: { label: '谷子圖鑑', icon: 'bookmark', path: '/guzi-guide', showInNav: true, order: 132 },
  styles: () => import('./style.css')
};