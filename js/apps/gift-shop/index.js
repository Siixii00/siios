import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const GIFTS = [
  { id: 'g1', name: '玫瑰花', icon: '🌹', price: 50 },
  { id: 'g2', name: '巧克力', icon: '🍫', price: 30 },
  { id: 'g3', name: '蛋糕', icon: '🎂', price: 80 },
  { id: 'g4', name: '戒指', icon: '💍', price: 200 },
  { id: 'g5', name: '玩偶', icon: '🧸', price: 100 },
  { id: 'g6', name: '信件', icon: '💌', price: 10 }
];

let inventory = [];

async function loadInventory() {
  const saved = await SettingsDB.get('gift_inventory');
  if (saved) inventory = saved;
}

async function saveInventory() {
  await SettingsDB.set('gift_inventory', inventory);
}

async function renderGiftShop(params) {
  await loadInventory();
  const container = createElement('div', 'app-container gift-shop-app');
  const counts = {};
  inventory.forEach(g => { counts[g.id] = (counts[g.id] || 0) + 1; });
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">禮物商店</h1>
    </header>
    <div class="page">
      <div class="shop-section">
        <h2>禮物</h2>
        <div class="gift-grid">
          ${GIFTS.map(g => `
            <div class="gift-item" data-id="${g.id}">
              <span class="gift-icon">${g.icon}</span>
              <span class="gift-name">${g.name}</span>
              <span class="gift-price">${g.price} 幣</span>
              <button class="buy-btn" data-id="${g.id}" data-name="${g.name}" data-price="${g.price}">購買</button>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="inventory-section">
        <h2>我的禮物</h2>
        <div class="inventory-list">
          ${Object.keys(counts).length > 0 
            ? Object.entries(counts).map(([id, count]) => {
                const gift = GIFTS.find(g => g.id === id);
                return `<div class="inv-item"><span>${gift?.icon} ${gift?.name}</span><span>x${count}</span></div>`;
              }).join('')
            : '<div class="empty-inv">尚無禮物</div>'
          }
        </div>
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelectorAll('.buy-btn').forEach(btn => {
    btn.onclick = async () => {
      if (confirm(`購買「${btn.dataset.name}」？`)) {
        inventory.push({ id: btn.dataset.id, boughtAt: Date.now() });
        await saveInventory();
        renderGiftShop(params);
      }
    };
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'gift-shop',
  name: '禮物商店',
  icon: 'gift',
  routes: [{ path: '/gift-shop', render: renderGiftShop }],
  navItem: { label: '禮物商店', icon: 'gift', path: '/gift-shop', showInNav: true, order: 143 },
  styles: () => import('./style.css')
};