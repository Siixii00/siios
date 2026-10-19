import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { getBalance, charge, formatMoney, WalletError } from '../../core/wallet.js';
import { GIFTS, getInventoryCounts, addGift } from '../../core/gifts.js';

let purchasing = false;

async function renderGiftShop() {
  const [counts, balance] = await Promise.all([getInventoryCounts(), getBalance()]);
  const container = createElement('div', 'app-container gift-shop-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">禮物商店</h1>
    </header>
    <div class="page">
      <div class="shop-section">
        <h2>禮物 <small style="font-weight:400;font-size:12px">餘額 ${formatMoney(balance)}</small></h2>
        <div class="gift-grid"></div>
      </div>
      <div class="inventory-section">
        <h2>我的禮物</h2>
        <div class="inventory-list"></div>
        <p class="gift-hint">在聊天室點「+」→「禮物」就能送給角色</p>
      </div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();

  const grid = container.querySelector('.gift-grid');
  GIFTS.forEach(g => {
    const item = createElement('div', 'gift-item');
    item.innerHTML = `<span class="gift-icon">${g.icon}</span><span class="gift-name">${g.name}</span><span class="gift-price">${formatMoney(g.price)}</span>`;
    const btn = createElement('button', 'buy-btn', { textContent: '購買' });
    btn.onclick = async () => {
      if (purchasing) return;
      purchasing = true;
      try {
        const bal = await getBalance();
        if (!confirm('購買「' + g.name + '」？價格 ' + formatMoney(g.price) + '，餘額 ' + formatMoney(bal))) return;
        await charge(g.price, '購買禮物「' + g.name + '」', { category: 'gift' });
        await addGift(g.id);
        createToast('已購買「' + g.name + '」');
        Router.handleRoute();
      } catch (e) {
        createToast(e instanceof WalletError ? e.message : '購買失敗', 'error');
      } finally {
        purchasing = false;
      }
    };
    item.appendChild(btn);
    grid.appendChild(item);
  });

  const inv = container.querySelector('.inventory-list');
  const owned = Object.entries(counts);
  if (owned.length === 0) {
    inv.appendChild(createElement('div', 'empty-inv', { textContent: '尚無禮物' }));
  } else {
    owned.forEach(([id, count]) => {
      const gift = GIFTS.find(g => g.id === id);
      const row = createElement('div', 'inv-item');
      row.append(createElement('span', '', { textContent: gift.icon + ' ' + gift.name }), createElement('span', '', { textContent: '×' + count }));
      inv.appendChild(row);
    });
  }
  return { element: container, cleanup: null };
}

export default {
  id: 'gift-shop',
  name: '禮物商店',
  icon: 'redeem',
  routes: [{ path: '/gift-shop', render: renderGiftShop }],
  navItem: { label: '禮物商店', icon: 'redeem', path: '/gift-shop', showInNav: true, order: 143 },
  stylesPath: 'js/apps/gift-shop/style.css'
};
