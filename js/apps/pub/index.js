import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

let messages = [];
let characters = [];
let activeChar = null;

async function loadData() {
  characters = await CharactersDB.getAll();
  const savedMsgs = await SettingsDB.get('pub_messages');
  if (savedMsgs) messages = savedMsgs;
  const savedActive = await SettingsDB.get('pub_active_char');
  if (savedActive && characters.find(c => c.id === savedActive)) {
    activeChar = savedActive;
  } else if (characters.length > 0) {
    activeChar = characters[0].id;
  }
}

async function saveData() {
  await SettingsDB.set('pub_messages', messages);
  await SettingsDB.set('pub_active_char', activeChar);
}

function renderMessages(container) {
  const log = container.querySelector('.chat-log');
  if (!log) return;
  const char = characters.find(c => c.id === activeChar);
  const charName = char?.name || '角色';
  log.innerHTML = messages.length > 0
    ? messages.map(m => `<div class="msg ${m.role}">${m.role === 'assistant' ? `<span class="char-name">${charName}</span>` : ''}${m.content}</div>`).join('')
    : '<div class="empty-chat">開始對話吧！</div>';
  log.scrollTop = log.scrollHeight;
}

async function sendMessage(container) {
  const input = container.querySelector('.chat-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  messages.push({ role: 'user', content: text });
  input.value = '';
  renderMessages(container);
  const replies = ['嗯，我聽到了。', '有趣的想法呢。', '你說得對。', '讓我想想...', '原來如此！', '我同意你的看法。', '這個話題很棒！'];
  setTimeout(async () => {
    messages.push({ role: 'assistant', content: replies[Math.floor(Math.random() * replies.length)] });
    renderMessages(container);
    await saveData();
  }, 500);
  await saveData();
}

async function renderPub(params) {
  await loadData();
  const container = createElement('div', 'app-container pub-app');
  const charOptions = characters.length > 0 
    ? characters.map(c => `<option value="${c.id}" ${c.id === activeChar ? 'selected' : ''}>${c.name}</option>`).join('')
    : '<option value="">尚未建立角色</option>';
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">酒館</h1>
    </header>
    <div class="page">
      <div class="char-selector"><select class="char-select">${charOptions}</select></div>
      <div class="chat-log"></div>
      <div class="chat-input-area">
        <input type="text" class="chat-input" placeholder="輸入訊息...">
        <button class="send-btn"><i class="fas fa-paper-plane"></i></button>
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  const charSelect = container.querySelector('.char-select');
  if (charSelect) {
    charSelect.onchange = async () => {
      activeChar = charSelect.value;
      await saveData();
      renderMessages(container);
    };
  }
  container.querySelector('.send-btn').onclick = () => sendMessage(container);
  container.querySelector('.chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendMessage(container); };
  renderMessages(container);
  return { element: container, cleanup: null };
}

export default {
  id: 'pub',
  name: '酒館',
  icon: 'wine-glass',
  routes: [{ path: '/pub', render: renderPub }],
  navItem: { label: '酒館', icon: 'wine-glass', path: '/pub', showInNav: true, order: 113 },
  styles: () => import('./style.css')
};