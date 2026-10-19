import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';
import qrcode from '../../vendor/qrcode-generator.js';

const CODE_TTL_MS = 5 * 60 * 1000;
const PAYLOAD_PREFIX = 'SXIOS-PAY:';
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // 去掉容易混淆的 I O 0 1

function newCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, b => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
}

// 舊版的付款碼是 6 碼；沿用相同的儲存鍵，但過期或格式不符就重新產生
async function loadCode(force = false) {
  const saved = await SettingsDB.get('payment_code');
  const savedAt = await SettingsDB.get('payment_code_time');
  if (!force && typeof saved === 'string' && saved.length >= 6 && typeof savedAt === 'number' && Date.now() - savedAt < CODE_TTL_MS) {
    return { code: saved, at: savedAt };
  }
  const code = newCode();
  const at = Date.now();
  await SettingsDB.set('payment_code', code);
  await SettingsDB.set('payment_code_time', at);
  return { code, at };
}

function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
}

async function renderPaymentCode() {
  let current = await loadCode();
  const container = createElement('div', 'app-container payment-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">付款碼</h1>
    </header>
    <div class="page">
      <div class="code-container">
        <div class="qr-box"></div>
        <div class="code-text"></div>
        <p class="code-hint">請出示此碼給商家掃描</p>
        <p class="code-expiry"></p>
        <button class="refresh-btn"><i class="fas fa-sync-alt"></i> 刷新付款碼</button>
      </div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const box = container.querySelector('.qr-box');
  const text = container.querySelector('.code-text');
  const expiry = container.querySelector('.code-expiry');

  function drawCode() {
    box.innerHTML = qrSvg(PAYLOAD_PREFIX + current.code);
    const svg = box.querySelector('svg');
    if (svg) { svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', '付款 QR Code'); }
    text.textContent = current.code;
  }

  async function tick() {
    const left = Math.max(0, current.at + CODE_TTL_MS - Date.now());
    if (left === 0) {
      current = await loadCode(true);
      drawCode();
      return;
    }
    expiry.textContent = '付款碼將在 ' + Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0') + ' 後自動更新';
  }

  container.querySelector('.refresh-btn').onclick = async () => {
    current = await loadCode(true);
    drawCode();
    tick();
  };
  drawCode();
  await tick();
  const timer = setInterval(tick, 1000);
  return { element: container, cleanup: () => clearInterval(timer) };
}

export default {
  id: 'payment-code',
  name: '付款碼',
  icon: 'qr_code_2',
  routes: [{ path: '/payment-code', render: renderPaymentCode }],
  navItem: { label: '付款碼', icon: 'qr_code_2', path: '/payment-code', showInNav: true, order: 124 },
  stylesPath: 'js/apps/payment-code/style.css'
};
