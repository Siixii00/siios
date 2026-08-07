import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

let currentCode = null;
let codeGeneratedAt = null;

async function loadCode() {
  const saved = await SettingsDB.get('payment_code');
  const savedAt = await SettingsDB.get('payment_code_time');
  if (saved && savedAt && (Date.now() - savedAt < 300000)) {
    currentCode = saved;
    codeGeneratedAt = savedAt;
  } else {
    currentCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    codeGeneratedAt = Date.now();
    await SettingsDB.set('payment_code', currentCode);
    await SettingsDB.set('payment_code_time', codeGeneratedAt);
  }
}

async function renderPaymentCode(params) {
  await loadCode();
  const container = createElement('div', 'app-container payment-app');
  container.innerHTML = `
    <header class='ios-header'>
      <button class='ios-back-btn'><i class='fas fa-chevron-left'></i> 返回</button>
      <h1 class='menu-title'>付款碼</h1>
    </header>
    <div class='page'>
      <div class='code-container'>
        <div class='qr-placeholder'>
          <i class='fas fa-qr_code_2'></i>
          <div class='code-text'>${currentCode}</div>
        </div>
        <p class='code-hint'>請出示此碼給商家掃描</p>
        <button class='refresh-btn'><i class='fas fa-sync-alt'></i> 刷新付款碼</button>
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  container.querySelector('.refresh-btn').onclick = async () => {
    currentCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    codeGeneratedAt = Date.now();
    await SettingsDB.set('payment_code', currentCode);
    await SettingsDB.set('payment_code_time', codeGeneratedAt);
    renderPaymentCode(params);
  };
  return { element: container, cleanup: null };
}

export default {
  id: 'payment-code',
  name: '付款碼',
  icon: 'qr_code_2',
  routes: [{ path: '/payment-code', render: renderPaymentCode }],
  navItem: { label: '付款碼', icon: 'qr_code_2', path: '/payment-code', showInNav: true, order: 124 },
  stylesPath: 'js/apps/payment-code/style.css'
};