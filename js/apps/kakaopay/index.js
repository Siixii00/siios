import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

let balance = 10000;
let transactions = [];

async function loadData() {
  const savedBal = await SettingsDB.get('kakaopay_balance');
  if (savedBal) balance = savedBal;
  const savedTx = await SettingsDB.get('kakaopay_transactions');
  if (savedTx) transactions = savedTx;
}

async function saveData() {
  await SettingsDB.set('kakaopay_balance', balance);
  await SettingsDB.set('kakaopay_transactions', transactions);
}

async function renderKakaopay(params) {
  await loadData();
  const container = createElement('div', 'app-container pay-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">支付</h1>
    </header>
    <div class="page">
      <div class="balance-card">
        <span class="balance-label">餘額</span>
        <span class="balance-amount">$${balance.toLocaleString()}</span>
      </div>
      <div class="action-buttons">
        <button class="action-btn send"><i class="fas fa-paper-plane"></i> 轉帳</button>
        <button class="action-btn receive"><i class="fas fa-qrcode"></i> 收款</button>
      </div>
      <div class="transaction-list">
        <h3>交易紀錄</h3>
        ${transactions.length > 0 
          ? transactions.slice(-5).reverse().map(t => `
              <div class="tx-item ${t.type}">
                <span class="tx-desc">${t.desc}</span>
                <span class="tx-amount">${t.type === 'send' ? '-' : '+'}$${t.amount}</span>
              </div>
            `).join('')
          : '<div class="empty-tx">尚無交易紀錄</div>'
        }
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelector('.action-btn.send').onclick = async () => {
    const amount = prompt('轉帳金額：');
    if (amount && !isNaN(amount) && parseInt(amount) > 0 && parseInt(amount) <= balance) {
      balance -= parseInt(amount);
      transactions.push({ type: 'send', amount: parseInt(amount), desc: '轉帳支出', date: Date.now() });
      await saveData();
      renderKakaopay(params);
    }
  };
  container.querySelector('.action-btn.receive').onclick = async () => {
    const amount = prompt('收款金額：');
    if (amount && !isNaN(amount) && parseInt(amount) > 0) {
      balance += parseInt(amount);
      transactions.push({ type: 'receive', amount: parseInt(amount), desc: '收款入帳', date: Date.now() });
      await saveData();
      renderKakaopay(params);
    }
  };
  return { element: container, cleanup: null };
}

export default {
  id: 'kakaopay',
  name: '支付',
  icon: 'wallet',
  routes: [{ path: '/kakaopay', render: renderKakaopay }],
  navItem: { label: '支付', icon: 'wallet', path: '/kakaopay', showInNav: true, order: 123 },
  styles: () => import('./style.css')
};