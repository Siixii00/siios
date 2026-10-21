import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { getBalance, charge, formatMoney, WalletError } from '../../core/wallet.js';
import { loadOrders, addOrder, statusAt, newOrderId } from '../../core/orders.js';
import { askConfirm } from '../../core/dialogs.js';

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

const CART_KEY = 'delivery_cart';
const ORDERS_KEY = 'delivery_orders';
const MIN = 60 * 1000;

let tab = 'restaurants';
let openRestaurantId = null;
let checkingOut = false;

const etaMinutes = r => parseInt(r.time.split('-').pop(), 10);
function stagesFor(minutes) {
  return [
    { afterMs: 0, label: '餐廳備餐中' },
    { afterMs: Math.round(minutes * 0.25) * MIN, label: '外送員配送中' },
    { afterMs: minutes * MIN, label: '已送達' }
  ];
}

// 購物車：{ restaurantId, items: [{ name, qty }] }。舊版是每按一次加一筆 {name, price}，載入時轉換
async function loadCart() {
  const saved = await SettingsDB.get(CART_KEY);
  if (saved && !Array.isArray(saved) && saved.restaurantId) {
    return { restaurantId: saved.restaurantId, items: (saved.items || []).filter(i => i.qty > 0) };
  }
  if (Array.isArray(saved) && saved.length) {
    const first = RESTAURANTS.find(r => r.menu.some(m => m.name === saved[0].name));
    if (first) {
      const counts = new Map();
      saved.forEach(i => { if (first.menu.some(m => m.name === i.name)) counts.set(i.name, (counts.get(i.name) || 0) + 1); });
      return { restaurantId: first.id, items: [...counts].map(([name, qty]) => ({ name, qty })) };
    }
  }
  return { restaurantId: null, items: [] };
}

const saveCart = cart => SettingsDB.set(CART_KEY, cart);
const itemPrice = (r, name) => r.menu.find(m => m.name === name)?.price || 0;
const cartTotal = (cart, r) => cart.items.reduce((s, i) => s + itemPrice(r, i.name) * i.qty, 0);
const cartCount = cart => cart.items.reduce((s, i) => s + i.qty, 0);

function fmtDate(ts) {
  const d = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

async function renderDelivery() {
  const container = createElement('div', 'app-container delivery-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">外送</h1>
    </header>
    <div class="dl-tabs">
      <button data-tab="restaurants">餐廳</button>
      <button data-tab="orders">訂單</button>
    </div>
    <div class="page">
      <div class="restaurant-list"></div>
    </div>
    <div class="menu-section"></div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const list = container.querySelector('.restaurant-list');
  const menuSec = container.querySelector('.menu-section');

  async function drawOrders() {
    list.replaceChildren();
    const orders = await loadOrders(ORDERS_KEY);
    if (orders.length === 0) {
      list.appendChild(createElement('div', 'dl-empty', { textContent: '還沒有外送訂單' }));
      return;
    }
    orders.forEach(o => {
      const card = createElement('div', 'restaurant-card');
      const status = statusAt(o, stagesFor(o.eta));
      const remain = Math.max(0, Math.ceil((o.date + o.eta * MIN - Date.now()) / MIN));
      card.innerHTML = `<h3 class="restaurant-name">${o.restaurant}</h3>
        <div class="dl-items">${o.items.map(i => i.name + ' ×' + i.qty).join('、')}</div>
        <div class="restaurant-meta"><span>${fmtDate(o.date)}</span><span class="dl-status">${status}${status === '已送達' ? '' : '（約 ' + remain + ' 分鐘）'}</span><span>${formatMoney(o.total)}</span></div>`;
      list.appendChild(card);
    });
  }

  function drawRestaurants() {
    list.replaceChildren();
    RESTAURANTS.forEach(r => {
      const card = createElement('div', 'restaurant-card');
      card.innerHTML = `
        <h3 class="restaurant-name">${r.name}</h3>
        <span class="restaurant-cuisine">${r.cuisine}</span>
        <div class="restaurant-meta">
          <span class="rating"><i class="fas fa-star"></i> ${r.rating}</span>
          <span class="time"><i class="fas fa-clock"></i> ${r.time} 分</span>
        </div>`;
      card.onclick = () => openMenu(r.id);
      list.appendChild(card);
    });
  }

  async function openMenu(rid) {
    openRestaurantId = rid;
    const r = RESTAURANTS.find(x => x.id === rid);
    let cart = await loadCart();
    const mine = () => (cart.restaurantId === rid ? cart : { restaurantId: rid, items: [] });
    const balance = await getBalance();
    menuSec.classList.add('active');
    menuSec.innerHTML = `
      <div class="menu-header"><button class="back-btn" aria-label="返回餐廳列表"><i class="fas fa-arrow-left"></i></button><h2>${r.name}</h2></div>
      <div class="menu-list"></div>
      <div class="cart-summary"><div><div class="cart-total"></div><div class="dl-balance">餘額 ${formatMoney(balance)}</div></div><button class="dl-pay add-btn" style="width:auto;border-radius:20px;padding:0 20px">結帳</button></div>`;
    const menuList = menuSec.querySelector('.menu-list');
    const totalEl = menuSec.querySelector('.cart-total');
    const payBtn = menuSec.querySelector('.dl-pay');
    menuSec.querySelector('.back-btn').onclick = () => { menuSec.classList.remove('active'); menuSec.innerHTML = ''; openRestaurantId = null; };

    const refresh = () => {
      const c = mine();
      menuList.querySelectorAll('.menu-item').forEach(row => {
        const q = c.items.find(i => i.name === row.dataset.name)?.qty || 0;
        row.querySelector('.dl-qty').textContent = q;
        row.querySelector('.dl-minus').style.visibility = q ? 'visible' : 'hidden';
      });
      totalEl.textContent = cartCount(c) + ' 項　' + formatMoney(cartTotal(c, r));
      payBtn.disabled = cartCount(c) === 0;
    };
    const change = async (name, delta) => {
      if (cart.restaurantId && cart.restaurantId !== rid && cartCount(cart) > 0) {
        const other = RESTAURANTS.find(x => x.id === cart.restaurantId);
        if (!await askConfirm('購物車內有「' + other.name + '」的餐點，一次只能訂一家餐廳。要清空並改訂「' + r.name + '」嗎？')) return;
        cart = { restaurantId: rid, items: [] };
      }
      if (cart.restaurantId !== rid) cart = { restaurantId: rid, items: [] };
      const it = cart.items.find(i => i.name === name);
      if (it) it.qty += delta; else if (delta > 0) cart.items.push({ name, qty: 1 });
      cart.items = cart.items.filter(i => i.qty > 0);
      await saveCart(cart);
      refresh();
    };
    r.menu.forEach(m => {
      const row = createElement('div', 'menu-item');
      row.dataset.name = m.name;
      row.innerHTML = `<span class="item-name">${m.name}</span><span class="item-price">${formatMoney(m.price)}</span>
        <button class="dl-minus add-btn" aria-label="減少" style="background:#ccc">−</button><span class="dl-qty" style="min-width:24px;text-align:center">0</span><button class="dl-plus add-btn" aria-label="增加">+</button>`;
      row.querySelector('.dl-minus').onclick = () => change(m.name, -1);
      row.querySelector('.dl-plus').onclick = () => change(m.name, 1);
      menuList.appendChild(row);
    });
    refresh();

    payBtn.onclick = async () => {
      if (checkingOut) return;
      checkingOut = true;
      try {
        const c = mine();
        if (cartCount(c) === 0) return;
        const total = cartTotal(c, r);
        await charge(total, '外送 ' + r.name, { category: 'delivery' });
        await addOrder(ORDERS_KEY, {
          id: newOrderId(), date: Date.now(), restaurant: r.name, total, eta: etaMinutes(r),
          items: c.items.map(i => ({ name: i.name, qty: i.qty, price: itemPrice(r, i.name) }))
        });
        cart = { restaurantId: null, items: [] };
        await saveCart(cart);
        createToast('已下單，扣款 ' + formatMoney(total));
        menuSec.classList.remove('active');
        menuSec.innerHTML = '';
        openRestaurantId = null;
        tab = 'orders';
        draw();
      } catch (e) {
        createToast(e instanceof WalletError ? e.message : '下單失敗', 'error');
      } finally {
        checkingOut = false;
      }
    };
  }

  function draw() {
    container.querySelectorAll('.dl-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    if (tab === 'orders') drawOrders(); else drawRestaurants();
  }
  container.querySelectorAll('.dl-tabs button').forEach(b => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });
  draw();
  return { element: container, cleanup: null };
}

export default {
  id: 'delivery',
  name: '外送',
  icon: 'restaurant',
  routes: [{ path: '/delivery', render: renderDelivery }],
  navItem: { label: '外送', icon: 'restaurant', path: '/delivery', showInNav: true, order: 120 },
  stylesPath: 'js/apps/delivery/style.css'
};
