import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { getBalance, charge, formatMoney, WalletError } from '../../core/wallet.js';
import { loadOrders, addOrder, statusAt, newOrderId } from '../../core/orders.js';

const PRODUCTS = [
  { id: 'p1', name: '經典白 T 恤', price: 299, image: '👕', category: '服飾' },
  { id: 'p2', name: '休閒牛仔褲', price: 599, image: '👖', category: '服飾' },
  { id: 'p3', name: '運動鞋', price: 899, image: '👟', category: '鞋類' },
  { id: 'p4', name: '後背包', price: 450, image: '🎒', category: '配件' },
  { id: 'p5', name: '手錶', price: 1200, image: '⌚', category: '配件' },
  { id: 'p6', name: '耳機', price: 699, image: '🎧', category: '電子' }
];

const CART_KEY = 'taobao_cart';
const ORDERS_KEY = 'taobao_orders';
const MIN = 60 * 1000;
const STAGES = [
  { afterMs: 0, label: '已付款' },
  { afterMs: 2 * MIN, label: '已出貨' },
  { afterMs: 5 * MIN, label: '配送中' },
  { afterMs: 10 * MIN, label: '已送達' }
];

let tab = 'shop';
let checkingOut = false;

// 舊版購物車是「每按一次加入就多一筆」的陣列，載入時合併成 {id, qty}
async function loadCart() {
  const saved = await SettingsDB.get(CART_KEY);
  if (!Array.isArray(saved)) return [];
  const merged = new Map();
  saved.forEach(item => {
    const p = PRODUCTS.find(x => x.id === item.id);
    if (!p) return;
    const qty = Number.isInteger(item.qty) && item.qty > 0 ? item.qty : 1;
    merged.set(p.id, (merged.get(p.id) || 0) + qty);
  });
  return [...merged].map(([id, qty]) => ({ id, qty }));
}

const saveCart = cart => SettingsDB.set(CART_KEY, cart);
const cartCount = cart => cart.reduce((s, i) => s + i.qty, 0);
const cartTotal = cart => cart.reduce((s, i) => s + PRODUCTS.find(p => p.id === i.id).price * i.qty, 0);

function fmtDate(ts) {
  const d = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

async function renderTaobao() {
  const container = createElement('div', 'app-container taobao-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">購物</h1>
      <div class="cart-icon"><i class="fas fa-shopping-cart"></i> <span class="cart-badge">0</span></div>
    </header>
    <div class="tb-tabs">
      <button data-tab="shop">商品</button>
      <button data-tab="cart">購物車</button>
      <button data-tab="orders">訂單</button>
    </div>
    <div class="page"></div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const page = container.querySelector('.page');
  const badge = container.querySelector('.cart-badge');

  async function draw() {
    const cart = await loadCart();
    badge.textContent = cartCount(cart);
    container.querySelectorAll('.tb-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    page.replaceChildren();
    if (tab === 'shop') drawShop(cart);
    else if (tab === 'cart') await drawCart(cart);
    else await drawOrders();
  }

  function drawShop(cart) {
    const grid = createElement('div', 'product-grid');
    PRODUCTS.forEach(p => {
      const inCart = cart.find(i => i.id === p.id)?.qty || 0;
      const card = createElement('div', 'product-card');
      card.innerHTML = `<div class="product-image">${p.image}</div><div class="product-name">${p.name}</div><div class="product-price">${formatMoney(p.price)}</div>`;
      const btn = createElement('button', 'add-cart-btn', { textContent: inCart ? '再加一件（已有 ' + inCart + '）' : '加入購物車' });
      btn.onclick = async () => {
        const c = await loadCart();
        const item = c.find(i => i.id === p.id);
        if (item) item.qty += 1; else c.push({ id: p.id, qty: 1 });
        await saveCart(c);
        createToast('已加入「' + p.name + '」');
        draw();
      };
      card.appendChild(btn);
      grid.appendChild(card);
    });
    page.appendChild(grid);
  }

  async function drawCart(cart) {
    if (cart.length === 0) {
      page.appendChild(createElement('div', 'tb-empty', { textContent: '購物車是空的，去商品頁逛逛吧' }));
      return;
    }
    cart.forEach(item => {
      const p = PRODUCTS.find(x => x.id === item.id);
      const row = createElement('div', 'tb-row');
      row.innerHTML = `<span class="tb-icon">${p.image}</span><div class="tb-info"><div>${p.name}</div><div class="product-price">${formatMoney(p.price * item.qty)}</div></div>`;
      const qty = createElement('div', 'tb-qty');
      const change = async delta => {
        const c = await loadCart();
        const it = c.find(i => i.id === item.id);
        it.qty += delta;
        await saveCart(c.filter(i => i.qty > 0));
        draw();
      };
      const minus = createElement('button', '', { textContent: '−' });
      minus.setAttribute('aria-label', '減少');
      minus.onclick = () => change(-1);
      const plus = createElement('button', '', { textContent: '+' });
      plus.setAttribute('aria-label', '增加');
      plus.onclick = () => change(1);
      qty.append(minus, createElement('span', '', { textContent: String(item.qty) }), plus);
      row.appendChild(qty);
      page.appendChild(row);
    });
    const balance = await getBalance();
    const total = cartTotal(cart);
    const bar = createElement('div', 'tb-checkout');
    bar.innerHTML = `<div><div class="tb-total">合計 ${formatMoney(total)}</div><div class="tb-balance">餘額 ${formatMoney(balance)}</div></div>`;
    const pay = createElement('button', 'add-cart-btn', { textContent: '結帳' });
    pay.onclick = async () => {
      if (checkingOut) return;
      checkingOut = true;
      try {
        const c = await loadCart();
        if (c.length === 0) return;
        const items = c.map(i => ({ ...PRODUCTS.find(p => p.id === i.id), qty: i.qty }));
        const sum = cartTotal(c);
        await charge(sum, '購物 ' + cartCount(c) + ' 件', { category: 'shopping' });
        await addOrder(ORDERS_KEY, { id: newOrderId(), date: Date.now(), total: sum, items: items.map(i => ({ id: i.id, name: i.name, image: i.image, price: i.price, qty: i.qty })) });
        await saveCart([]);
        createToast('結帳成功，已扣款 ' + formatMoney(sum));
        tab = 'orders';
        draw();
      } catch (e) {
        createToast(e instanceof WalletError ? e.message : '結帳失敗', 'error');
      } finally {
        checkingOut = false;
      }
    };
    bar.appendChild(pay);
    page.appendChild(bar);
  }

  async function drawOrders() {
    const orders = await loadOrders(ORDERS_KEY);
    if (orders.length === 0) {
      page.appendChild(createElement('div', 'tb-empty', { textContent: '還沒有訂單' }));
      return;
    }
    orders.forEach(o => {
      const card = createElement('div', 'tb-order');
      const head = createElement('div', 'tb-order-head');
      head.append(createElement('span', '', { textContent: fmtDate(o.date) }), createElement('span', 'tb-status', { textContent: statusAt(o, STAGES) }));
      card.appendChild(head);
      card.appendChild(createElement('div', 'tb-order-items', { textContent: o.items.map(i => i.image + ' ' + i.name + ' ×' + i.qty).join('、') }));
      card.appendChild(createElement('div', 'product-price', { textContent: '合計 ' + formatMoney(o.total) }));
      page.appendChild(card);
    });
  }

  container.querySelectorAll('.tb-tabs button').forEach(b => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });
  await draw();
  return { element: container, cleanup: null };
}

export default {
  id: 'taobao',
  name: '購物',
  icon: 'shopping_bag',
  routes: [{ path: '/taobao', render: renderTaobao }],
  navItem: { label: '購物', icon: 'shopping_bag', path: '/taobao', showInNav: true, order: 122 },
  stylesPath: 'js/apps/taobao/style.css'
};
