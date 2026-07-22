import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const THEMES = [
  { id: 't1', name: '星空', icon: '🌌', price: 0 },
  { id: 't2', name: '森林', icon: '🌲', price: 50 },
  { id: 't3', name: '海洋', icon: '🌊', price: 50 },
  { id: 't4', name: '日落', icon: '🌅', price: 80 },
  { id: 't5', name: '極光', icon: '🌌', price: 100 },
  { id: 't6', name: '櫻花', icon: '🌸', price: 80 }
];

let owned = [];

async function loadOwned() {
  const saved = await SettingsDB.get('theme_owned');
  if (saved) owned = saved;
}

async function saveOwned() {
  await SettingsDB.set('theme_owned', owned);
}

async function renderThemeShop(params) {
  await loadOwned();
  const container = createElement('div', 'app-container theme-shop-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">主題商店</h1>
    </header>
    <div class="page">
      <div class="theme-grid">
        ${THEMES.map(t => `
          <div class="theme-item ${owned.includes(t.id) ? 'owned' : ''}" data-id="${t.id}">
            <div class="theme-icon">${t.icon}</div>
            <div class="theme-name">${t.name}</div>
            ${owned.includes(t.id) 
              ? '<span class="owned-badge">已擁有</span>'
              : `<span class="price">${t.price === 0 ? '免費' : t.price + ' 幣'}</span>`
            }
          </div>
        `).join('')}
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelectorAll('.theme-item:not(.owned)').forEach(item => {
    item.onclick = async () => {
      const theme = THEMES.find(t => t.id === item.dataset.id);
      if (theme.price === 0 || confirm(`購買「${theme.name}」主題？`)) {
        owned.push(theme.id);
        await saveOwned();
        renderThemeShop(params);
      }
    };
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'theme-shop',
  name: '主題商店',
  icon: 'store',
  routes: [{ path: '/theme-shop', render: renderThemeShop }],
  navItem: { label: '主題商店', icon: 'store', path: '/theme-shop', showInNav: true, order: 141 },
  styles: () => import('./style.css')
};