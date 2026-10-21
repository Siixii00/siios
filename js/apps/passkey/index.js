import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import {askForm, askConfirm } from '../../core/dialogs.js';

const KEYS_KEY = 'passkey_keys';

async function loadKeys() {
  const list = await SettingsDB.get(KEYS_KEY);
  return Array.isArray(list) ? list : [];
}

// 使用瀏覽器的安全亂數，不用 Math.random
function generateKey() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
}

async function renderPasskey() {
  const keys = await loadKeys();
  const container = createElement('div', 'app-container passkey-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">Passkey</h1>
    </header>
    <div class="page">
      <div class="info-card">
        <i class="fas fa-key"></i>
        <p>在這裡建立與管理 App 內使用的金鑰。金鑰只存在這台裝置上，不會上傳。</p>
      </div>
      <button class="create-btn"><i class="fas fa-plus"></i> 建立新 Passkey</button>
      <div class="key-list"><h3>已建立的 Passkey</h3><div class="key-items"></div></div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();

  const items = container.querySelector('.key-items');
  if (keys.length === 0) items.appendChild(createElement('div', 'empty-keys', { textContent: '尚無 Passkey' }));
  keys.forEach(k => {
    const row = createElement('div', 'key-item');
    const info = createElement('div');
    info.append(
      createElement('div', 'key-name', { textContent: k.name }),
      createElement('div', 'key-date', { textContent: new Date(k.created).toLocaleDateString('zh-TW') + '　' + k.key.slice(0, 4) + '…' + k.key.slice(-4) })
    );
    row.appendChild(info);
    const actions = createElement('div', 'key-actions');
    const copy = createElement('button', 'key-btn', { textContent: '複製' });
    copy.onclick = async () => {
      try { await navigator.clipboard.writeText(k.key); createToast('已複製金鑰'); } catch { createToast('無法複製，請手動選取', 'error'); }
    };
    const del = createElement('button', 'key-btn danger', { textContent: '刪除', 'aria-label': '刪除：' + k.name });
    del.onclick = async () => {
      if (!await askConfirm('刪除「' + k.name + '」？刪除後無法復原。')) return;
      await SettingsDB.set(KEYS_KEY, (await loadKeys()).filter(x => x.key !== k.key));
      createToast('已刪除');
      Router.handleRoute();
    };
    actions.append(copy, del);
    row.appendChild(actions);
    items.appendChild(row);
  });

  container.querySelector('.create-btn').onclick = async () => {
    const form = await askForm({ title: '建立 Passkey', fields: [{ key: 'name', label: '名稱', required: true, placeholder: '例如：我的筆電' }], submitLabel: '建立' });
    if (!form) return;
    const all = await loadKeys();
    all.push({ name: form.name, key: generateKey(), created: Date.now() });
    await SettingsDB.set(KEYS_KEY, all);
    createToast('已建立「' + form.name + '」');
    Router.handleRoute();
  };
  return { element: container, cleanup: null };
}

export default {
  id: 'passkey',
  name: 'Passkey',
  icon: 'key',
  routes: [{ path: '/passkey', render: renderPasskey }],
  navItem: { label: 'Passkey', icon: 'key', path: '/passkey', showInNav: true, order: 144 },
  stylesPath: 'js/apps/passkey/style.css'
};
