import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { getBalance, getTransactions, charge, credit, setBalance, formatMoney, WalletError } from '../../core/wallet.js';
import { askForm } from '../../core/dialogs.js';
import { renderFundSection } from './fund-ui.js';

const CATEGORY_LABELS = {
  shopping: '購物', delivery: '外送', gift: '禮物', theme: '主題', sticker: '貼圖',
  transfer: '轉帳', farm: '農場', topup: '儲值', adjust: '調整', pub: '酒館', invest: '投資', arcade: '街機', fund: '共同基金', home: '宅家', dating: '約會'
};

function fmtDate(ts) {
  const d = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
}

async function renderKakaopay(params) {
  const [balance, transactions] = await Promise.all([getBalance(), getTransactions(50)]);
  const container = createElement('div', 'app-container pay-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">支付</h1>
    </header>
    <div class="page">
      <div class="balance-card">
        <span class="balance-label">餘額</span>
        <span class="balance-amount">${formatMoney(balance)}</span>
      </div>
      <div class="action-buttons">
        <button class="action-btn send"><i class="fas fa-paper-plane"></i> 轉帳</button>
        <button class="action-btn receive"><i class="fas fa-qrcode"></i> 收款</button>
        <button class="action-btn topup"><i class="fas fa-plus-circle"></i> 儲值</button>
        <button class="action-btn adjust"><i class="fas fa-sliders-h"></i> 設定餘額</button>
      </div>
      <div class="fund-slot"></div>
      <div class="transaction-list">
        <h3>交易紀錄</h3>
        <div class="tx-scroll"></div>
      </div>
    </div>
  `;
  const list = container.querySelector('.tx-scroll');
  if (transactions.length === 0) {
    list.appendChild(createElement('div', 'empty-tx', { textContent: '尚無交易紀錄' }));
  } else {
    transactions.forEach(t => {
      const row = createElement('div', 'tx-item ' + t.type);
      const desc = createElement('span', 'tx-desc');
      desc.textContent = t.desc + (CATEGORY_LABELS[t.category] ? '（' + CATEGORY_LABELS[t.category] + '）' : '');
      desc.appendChild(createElement('small', '', { textContent: ' ' + fmtDate(t.date) }));
      row.appendChild(desc);
      row.appendChild(createElement('span', 'tx-amount', { textContent: (t.type === 'send' ? '-' : '+') + formatMoney(t.amount) }));
      list.appendChild(row);
    });
  }
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  renderFundSection(async () => {
    container.querySelector('.balance-amount').textContent = formatMoney(await getBalance());
  }).then(el => container.querySelector('.fund-slot').appendChild(el)).catch(() => {});

  async function run(kind) {
    const isSend = kind === 'send';
    const form = await askForm({
      title: isSend ? '轉帳' : '收款',
      hint: '目前餘額 ' + formatMoney(balance),
      fields: [
        { key: 'amount', label: '金額', type: 'number', required: true, placeholder: '輸入金額' },
        { key: 'note', label: '備註（選填）', placeholder: isSend ? '轉帳支出' : '收款入帳' }
      ],
      submitLabel: isSend ? '轉帳' : '收款'
    });
    if (!form) return;
    try {
      const desc = form.note || (isSend ? '轉帳支出' : '收款入帳');
      await (isSend ? charge : credit)(form.amount, desc, { category: 'transfer' });
      createToast(isSend ? '已轉出 ' + formatMoney(form.amount) : '已收款 ' + formatMoney(form.amount));
      Router.handleRoute();
    } catch (e) {
      createToast(e instanceof WalletError ? e.message : '操作失敗', 'error');
    }
  }
  async function topup() {
    const form = await askForm({
      title: '儲值',
      hint: '虛擬錢包，自己填多少就加多少（沒有真實金流）。目前餘額 ' + formatMoney(balance),
      fields: [{ key: 'amount', label: '儲值金額', type: 'number', required: true, placeholder: '例如 5000' }],
      submitLabel: '儲值'
    });
    if (!form) return;
    try {
      await credit(form.amount, '儲值', { category: 'topup' });
      createToast('已儲值 ' + formatMoney(form.amount));
      Router.handleRoute();
    } catch (e) {
      createToast(e instanceof WalletError ? e.message : '儲值失敗', 'error');
    }
  }
  async function adjust() {
    const form = await askForm({
      title: '設定餘額',
      hint: '直接把餘額改成指定數字，可以是 0。目前餘額 ' + formatMoney(balance),
      fields: [{ key: 'amount', label: '新的餘額', type: 'text', required: true, value: balance }],
      submitLabel: '設定'
    });
    if (!form) return;
    try {
      await setBalance(form.amount);
      createToast('餘額已設為 ' + formatMoney(Number(form.amount)));
      Router.handleRoute();
    } catch (e) {
      createToast(e instanceof WalletError ? e.message : '設定失敗', 'error');
    }
  }
  container.querySelector('.action-btn.topup').onclick = topup;
  container.querySelector('.action-btn.adjust').onclick = adjust;
  container.querySelector('.action-btn.send').onclick = () => run('send');
  container.querySelector('.action-btn.receive').onclick = () => run('receive');
  return { element: container, cleanup: null };
}

export default {
  id: 'kakaopay',
  name: '支付',
  icon: 'wallet',
  routes: [{ path: '/kakaopay', render: renderKakaopay }],
  navItem: { label: '支付', icon: 'wallet', path: '/kakaopay', showInNav: true, order: 123 },
  stylesPath: 'js/apps/kakaopay/style.css'
};
