import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const EMOJIS = [
  { id: 'e1', name: '笑臉', emoji: '😊', price: 0 },
  { id: 'e2', name: '愛心', emoji: '❤️', price: 20 },
  { id: 'e3', name: '星星', emoji: '⭐', price: 20 },
  { id: 'e4', name: '彩虹', emoji: '🌈', price: 50 },
  { id: 'e5', name: '閃電', emoji: '⚡', price: 50 },
  { id: 'e6', name: '皇冠', emoji: '👑', price: 100 }
];

let owned = [];

async function loadOwned() {
  const saved = await SettingsDB.get('emoji_owned');
  if (saved) owned = saved;
}

async function saveOwned() {
  await SettingsDB.set('emoji_owned', owned);
}

async function renderEmojiShop(params) {
  await loadOwned();
  const container = createElement('div', 'app-container emoji-shop-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">表情商店</h1>
    </header>
    <div class="page">
      <div class="emoji-grid">
        ${EMOJIS.map(e => `
          <div class="emoji-item ${owned.includes(e.id) ? 'owned' : ''}" data-id="${e.id}">
            <span class="emoji-icon">${e.emoji}</span>
            <span class="emoji-name">${e.name}</span>
            <span class="${owned.includes(e.id) ? 'owned' : 'price'}">${owned.includes(e.id) ? '已擁有' : (e.price === 0 ? '免費' : e.price + ' 幣')}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelectorAll('.emoji-item:not(.owned)').forEach(item => {
    item.onclick = async () => {
      const emoji = EMOJIS.find(e => e.id === item.dataset.id);
      if (emoji.price === 0 || confirm(`購買「${emoji.name}」表情？`)) {
        owned.push(emoji.id);
        await saveOwned();
        renderEmojiShop(params);
      }
    };
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'emoji-shop',
  name: '表情商店',
  icon: 'smile',
  routes: [{ path: '/emoji-shop', render: renderEmojiShop }],
  navItem: { label: '表情商店', icon: 'smile', path: '/emoji-shop', showInNav: true, order: 142 },
  styles: () => import('./style.css')
};