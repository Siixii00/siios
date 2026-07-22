import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

let keys = [];

async function loadKeys() {
  const saved = await SettingsDB.get('passkey_keys');
  if (saved) keys = saved;
}

async function saveKeys() {
  await SettingsDB.set('passkey_keys', keys);
}

function generateKey() {
  return Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

async function renderPasskey(params) {
  await loadKeys();
  const container = createElement('div', 'app-container passkey-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">Passkey</h1>
    </header>
    <div class="page">
      <div class="info-card">
        <i class="fas fa-key"></i>
        <p>Passkey 是一種安全的身份驗證方式，用於取代傳統密碼。</p>
      </div>
      <button class="create-btn"><i class="fas fa-plus"></i> 建立新 Passkey</button>
      <div class="key-list">
        <h3>已建立的 Passkey</h3>
        ${keys.length > 0 
          ? keys.map(k => `
              <div class="key-item">
                <span class="key-name">${k.name}</span>
                <span class="key-date">${new Date(k.created).toLocaleDateString('zh-TW')}</span>
              </div>
            `).join('')
          : '<div class="empty-keys">尚無 Passkey</div>'
        }
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelector('.create-btn').onclick = async () => {
    const name = prompt('Passkey 名稱：');
    if (name) {
      keys.push({ name, key: generateKey(), created: Date.now() });
      await saveKeys();
      renderPasskey(params);
    }
  };
  return { element: container, cleanup: null };
}

export default {
  id: 'passkey',
  name: 'Passkey',
  icon: 'key',
  routes: [{ path: '/passkey', render: renderPasskey }],
  navItem: { label: 'Passkey', icon: 'key', path: '/passkey', showInNav: true, order: 144 },
  styles: () => import('./style.css')
};