import Router from '../../router.js';
import { createElement } from '../../components.js';

async function renderPaymentCode(params) {
  const container = createElement('div', 'app-container payment-app');
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">付款碼</h1>
    </header>
    <div class="page">
      <div class="code-container">
        <div class="qr-placeholder">
          <i class="fas fa-qrcode"></i>
          <div class="code-text">${code}</div>
        </div>
        <p class="code-hint">請出示此碼給商家掃描</p>
        <button class="refresh-btn"><i class="fas fa-sync-alt"></i> 刷新付款碼</button>
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelector('.refresh-btn').onclick = () => renderPaymentCode(params);
  return { element: container, cleanup: null };
}

export default {
  id: 'payment-code',
  name: '付款碼',
  icon: 'qrcode',
  routes: [{ path: '/payment-code', render: renderPaymentCode }],
  navItem: { label: '付款碼', icon: 'qrcode', path: '/payment-code', showInNav: true, order: 124 },
  styles: () => import('./style.css')
};