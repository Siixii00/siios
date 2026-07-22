import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const RESTAURANTS = [
  { id: 'r1', name: '美味軒', cuisine: '中式', rating: 4.8, time: '25-35', menu: [
    { name: '宮保雞丁', price: 120 },
    { name: '麻婆豆腐', price: 90 },
    { name: '炒飯', price: 80 }
  ]},
  { id: 'r2', name: '壽司郎', cuisine: '日式', rating: 4.6, time: '30-40', menu: [
    { name: '綜合壽司', price: 180 },
    { name: '鮭魚刺身', price: 150 }
  ]},
  { id: 'r3', name: 'Pasta House', cuisine: '義式', rating: 4.5, time: '20-30', menu: [
    { name: '義大利麵', price: 150 },
    { name: '披薩', price: 220 }
  ]}
];

let cart = [];

async function loadCart() {
  const saved = await SettingsDB.get('delivery_cart');
  if (saved) cart = saved;
}

async function saveCart() {
  await SettingsDB.set('delivery_cart', cart);
}

function renderRestaurants(container) {
  const list = container.querySelector('.restaurant-list');
  if (!list) return;
  list.innerHTML = RESTAURANTS.map(r => `
    <div class="restaurant-card" data-id="${r.id}">
      <h3 class="restaurant-name">${r.name}</h3>
      <span class="restaurant-cuisine">${r.cuisine}</span>
      <div class="restaurant-meta">
        <span class="rating"><i class="fas fa-star"></i> ${r.rating}</span>
        <span class="time"><i class="fas fa-clock"></i> ${r.time} 分</span>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('.restaurant-card').forEach(card => {
    card.onclick = () => openMenu(container, card.dataset.id);
  });
}

function openMenu(container, rid) {
  const r = RESTAURANTS.find(x => x.id === rid);
  if (!r) return;
  const sec = container.querySelector('.menu-section');
  if (!sec) return;
  sec.innerHTML = `
    <div class="menu-header">
      <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
      <h2>${r.name}</h2>
    </div>
    <div class="menu-list">
      ${r.menu.map(m => `
        <div class="menu-item">
          <span class="item-name">${m.name}</span>
          <span class="item-price">$${m.price}</span>
          <button class="add-btn" data-name="${m.name}" data-price="${m.price}">+</button>
        </div>
      `).join('')}
    </div>
    <div class="cart-summary">
      <span class="cart-count">${cart.length} 項</span>
      <span class="cart-total">$${cart.reduce((s, i) => s + i.price, 0)}</span>
    </div>
  `;
  sec.classList.add('active');
  sec.querySelector('.back-btn').onclick = () => { sec.classList.remove('active'); sec.innerHTML = ''; };
  sec.querySelectorAll('.add-btn').forEach(btn => {
    btn.onclick = async () => {
      cart.push({ name: btn.dataset.name, price: parseInt(btn.dataset.price) });
      await saveCart();
      sec.querySelector('.cart-count').textContent = `${cart.length} 項`;
      sec.querySelector('.cart-total').textContent = `$${cart.reduce((s, i) => s + i.price, 0)}`;
    };
  });
}

async function renderDelivery(params) {
  await loadCart();
  const container = createElement('div', 'app-container delivery-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">外送</h1>
    </header>
    <div class="page">
      <div class="restaurant-list"></div>
      <div class="menu-section"></div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  renderRestaurants(container);
  return { element: container, cleanup: null };
}

export default {
  id: 'delivery',
  name: '外送',
  icon: 'utensils',
  routes: [{ path: '/delivery', render: renderDelivery }],
  navItem: { label: '外送', icon: 'utensils', path: '/delivery', showInNav: true, order: 120 },
  styles: () => import('./style.css')
};