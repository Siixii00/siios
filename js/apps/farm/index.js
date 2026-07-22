import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const CROPS = [
  { id: 'c1', name: '番茄', growTime: 30, sellPrice: 50, icon: '🍅' },
  { id: 'c2', name: '玉米', growTime: 45, sellPrice: 80, icon: '🌽' },
  { id: 'c3', name: '草莓', growTime: 60, sellPrice: 120, icon: '🍓' }
];

let farm = { plots: Array(6).fill(null), coins: 100 };

async function loadFarm() {
  const saved = await SettingsDB.get('farm_state');
  if (saved) farm = saved;
}

async function saveFarm() {
  await SettingsDB.set('farm_state', farm);
}

async function renderFarm(params) {
  await loadFarm();
  const now = Date.now();
  
  const container = createElement('div', 'app-container farm-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">農場</h1>
      <div class="coins"><i class="fas fa-coins"></i> ${farm.coins}</div>
    </header>
    <div class="page">
      <div class="farm-grid">
        ${farm.plots.map((plot, i) => {
          if (!plot) {
            return `<div class="plot empty" data-idx="${i}"><span class="plus">+</span></div>`;
          }
          const crop = CROPS.find(c => c.id === plot.cropId);
          const elapsed = (now - plot.plantedAt) / 1000;
          const ready = elapsed >= crop.growTime;
          return `<div class="plot ${ready ? 'ready' : ''}" data-idx="${i}">
            <span class="crop-icon">${crop.icon}</span>
            ${ready ? '<span class="ready-badge">可收穫</span>' : `<span class="progress">${Math.floor(elapsed)}/${crop.growTime}s</span>`}
          </div>`;
        }).join('')}
      </div>
      <div class="shop-section">
        <h3>商店</h3>
        <div class="crop-list">
          ${CROPS.map(c => `
            <button class="crop-btn" data-id="${c.id}" data-price="20">
              ${c.icon} ${c.name} ($20)
            </button>
          `).join('')}
        </div>
      </div>
    </div>
  `;
  
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  
  container.querySelectorAll('.plot.empty').forEach(plot => {
    plot.onclick = () => {
      const idx = parseInt(plot.dataset.idx);
      const cropId = prompt('輸入作物代碼（c1, c2, c3）：');
      if (cropId && CROPS.find(c => c.id === cropId) && farm.coins >= 20) {
        farm.coins -= 20;
        farm.plots[idx] = { cropId, plantedAt: Date.now() };
        saveFarm();
        renderFarm(params);
      }
    };
  });
  
  container.querySelectorAll('.plot.ready').forEach(plot => {
    plot.onclick = async () => {
      const idx = parseInt(plot.dataset.idx);
      const plotData = farm.plots[idx];
      const crop = CROPS.find(c => c.id === plotData.cropId);
      farm.coins += crop.sellPrice;
      farm.plots[idx] = null;
      await saveFarm();
      renderFarm(params);
    };
  });
  
  return { element: container, cleanup: null };
}

export default {
  id: 'farm',
  name: '農場',
  icon: 'seedling',
  routes: [{ path: '/farm', render: renderFarm }],
  navItem: { label: '農場', icon: 'seedling', path: '/farm', showInNav: true, order: 127 },
  styles: () => import('./style.css')
};