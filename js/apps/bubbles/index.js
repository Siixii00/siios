import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

let state = {
  artistName: '',
  artistAvatar: '',
  messages: [],
  fanName: '팬',
  mode: 'artist'
};

async function loadState() {
  const saved = await SettingsDB.get('bubbles_state');
  if (saved) {
    state = { ...state, ...saved };
  }
}

async function saveState() {
  await SettingsDB.set('bubbles_state', state);
}

function renderFeed(container) {
  const feed = container.querySelector('.bubbles-feed');
  if (!feed) return;
  
  feed.innerHTML = state.messages.map(msg => `
    <div class="bubble-msg ${msg.role}">
      ${msg.fanName ? `<span class="fan-name">${msg.fanName}</span>` : ''}
      ${msg.text}
    </div>
  `).join('') || '<div class="empty-msg">尚無訊息</div>';
  
  feed.scrollTop = feed.scrollHeight;
}

function sendMessage(container) {
  const input = container.querySelector('.bubble-input');
  if (!input) return;
  
  const text = input.value.trim();
  if (!text) return;
  
  state.messages.push({
    role: state.mode,
    text,
    fanName: state.mode === 'fan' ? state.fanName : null
  });
  
  input.value = '';
  renderFeed(container);
  saveState();
}

async function renderBubbles(params) {
  await loadState();
  
  const container = createElement('div', 'app-container bubbles-app');
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">Bubble</h1>
    </header>
    
    <div class="page">
      <div class="bubbles-settings">
        <div class="mode-switch">
          <button class="mode-btn ${state.mode === 'artist' ? 'active' : ''}" data-mode="artist">
            <i class="fas fa-star"></i> 藝人模式
          </button>
          <button class="mode-btn ${state.mode === 'fan' ? 'active' : ''}" data-mode="fan">
            <i class="fas fa-heart"></i> 粉絲模式
          </button>
        </div>
        
        <div class="settings-row">
          <label>藝人名稱</label>
          <input type="text" class="artist-name-input" value="${state.artistName}" placeholder="輸入藝人名稱">
        </div>
        
        ${state.mode === 'fan' ? `
          <div class="settings-row">
            <label>粉絲名稱</label>
            <input type="text" class="fan-name-input" value="${state.fanName}" placeholder="輸入粉絲名稱">
          </div>
        ` : ''}
      </div>
      
      <div class="bubbles-feed"></div>
      
      <div class="bubbles-input-area">
        <input type="text" class="bubble-input" placeholder="輸入訊息...">
        <button class="send-btn">
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.navigate('/');
  
  container.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = async () => {
      state.mode = btn.dataset.mode;
      await saveState();
      renderBubbles(params);
    };
  });
  
  const artistNameInput = container.querySelector('.artist-name-input');
  if (artistNameInput) {
    artistNameInput.onchange = async () => {
      state.artistName = artistNameInput.value;
      await saveState();
    };
  }
  
  const fanNameInput = container.querySelector('.fan-name-input');
  if (fanNameInput) {
    fanNameInput.onchange = async () => {
      state.fanName = fanNameInput.value;
      await saveState();
    };
  }
  
  const sendBtn = container.querySelector('.send-btn');
  const input = container.querySelector('.bubble-input');
  
  if (sendBtn) {
    sendBtn.onclick = () => sendMessage(container);
  }
  
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        sendMessage(container);
      }
    };
  }
  
  renderFeed(container);
  
  return { element: container, cleanup: null };
}

export default {
  id: 'bubbles',
  name: 'Bubble',
  icon: 'comment-dots',
  routes: [{ path: '/bubbles', render: renderBubbles }],
  navItem: { label: 'Bubble', icon: 'comment-dots', path: '/bubbles', showInNav: true, order: 102 },
  styles: () => import('./style.css')
};