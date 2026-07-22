import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const PRODUCTS = [
  { id: 'p1', name: '經典白 T 恤', price: 299, image: '👕', category: '服飾' },
  { id: 'p2', name: '休閒牛仔褲', price: 599, image: '👖', category: '服飾' },
  { id: 'p3', name: '運動鞋', price: 899, image: '👟', category: '鞋類' },
  { id: 'p4', name: '後背包', price: 450, image: '🎒', category: '配件' },
  { id: 'p5', name: '手錶', price: 1200, image: '⌚', category: '配件' },
  { id: 'p6', name: '耳機', price: 699, image: '🎧', category: '電子' }
];

let cart = [];

async function loadCart() {
  const saved = await SettingsDB.get('taobao_cart');
  if (saved) cart = saved;
}

async function saveCart() {
  await SettingsDB.set('taobao_cart', cart);
}

async function renderTaobao(params) {
  await loadCart();
  const container = createElement('div', 'app-container taobao-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">購物</h1>
      <div class="cart-icon"><i class="fas fa-shopping-cart"></i> <span class="cart-badge">${cart.length}</span></div>
    </header>
    <div class="page">
      <div class="product-grid">
        ${PRODUCTS.map(p => `
          <div class="product-card" data-id="${p.id}">
            <div class="product-image">${p.image}</div>
            <div class="product-name">${p.name}</div>
            <div class="product-price">$${p.price}</div>
            <button class="add-cart-btn" data-id="${p.id}" data-name="${p.name}" data-price="${p.price}">加入購物車</button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelectorAll('.add-cart-btn').forEach(btn => {
    btn.onclick = async () => {
      cart.push({ id: btn.dataset.id, name: btn.dataset.name, price: parseInt(btn.dataset.price) });
      await saveCart();
      container.querySelector('.cart-badge').textContent = cart.length;
    };
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'taobao',
  name: '購物',
  icon: 'shopping-bag',
  routes: [{ path: '/taobao', render: renderTaobao }],
  navItem: { label: '購物', icon: 'shopping-bag', path: '/taobao', showInNav: true, order: 122 },
  styles: () => import('./style.css')
};