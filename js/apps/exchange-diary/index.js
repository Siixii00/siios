import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const MOOD_OPTIONS = [
  { id: 'sunny', label: '晴朗', icon: '🌤️' },
  { id: 'rainy', label: '雨露', icon: '🌧️' },
  { id: 'starry', label: '星夜', icon: '🌙' },
  { id: 'cozy', label: '暖被', icon: '🫖' },
  { id: 'wild', label: '冒險', icon: '🧭' }
];

let entries = [];
let activeMood = 'sunny';

async function loadEntries() {
  const saved = await SettingsDB.get('diary_entries');
  if (saved) {
    entries = saved;
  }
}

async function saveEntries() {
  await SettingsDB.set('diary_entries', entries);
}

function renderEntries(container) {
  const list = container.querySelector('.entry-list');
  if (!list) return;
  
  list.innerHTML = entries.length > 0 
    ? entries.map((entry, idx) => `
        <div class="entry-item">
          <div class="entry-header">
            <span class="entry-mood">${MOOD_OPTIONS.find(m => m.id === entry.mood)?.icon || '📝'}</span>
            <span class="entry-date">${new Date(entry.date).toLocaleDateString('zh-TW')}</span>
          </div>
          <div class="entry-content">${entry.content}</div>
          ${entry.npcReply ? `<div class="npc-reply">${entry.npcReply}</div>` : ''}
        </div>
      `).join('')
    : '<div class="empty-entries">尚無日記</div>';
}

async function renderExchangeDiary(params) {
  await loadEntries();
  
  const container = createElement('div', 'app-container diary-app');
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">交換日記</h1>
    </header>
    
    <div class="page">
      <div class="mood-selector">
        ${MOOD_OPTIONS.map(m => `
          <button class="mood-btn ${m.id === activeMood ? 'active' : ''}" data-mood="${m.id}">
            ${m.icon} ${m.label}
          </button>
        `).join('')}
      </div>
      
      <div class="entry-input-area">
        <textarea class="entry-input" placeholder="寫下今天的心情..."></textarea>
        <button class="save-entry-btn">
          <i class="fas fa-book"></i> 寫入日記
        </button>
      </div>
      
      <div class="entry-list"></div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.navigate('/');
  
  container.querySelectorAll('.mood-btn').forEach(btn => {
    btn.onclick = () => {
      activeMood = btn.dataset.mood;
      container.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });
  
  const saveBtn = container.querySelector('.save-entry-btn');
  const input = container.querySelector('.entry-input');
  
  if (saveBtn && input) {
    saveBtn.onclick = async () => {
      const content = input.value.trim();
      if (!content) return;
      
      entries.unshift({
        date: Date.now(),
        mood: activeMood,
        content,
        npcReply: null
      });
      
      input.value = '';
      await saveEntries();
      renderEntries(container);
    };
  }
  
  renderEntries(container);
  
  return { element: container, cleanup: null };
}

export default {
  id: 'exchange-diary',
  name: '交換日記',
  icon: 'book',
  routes: [{ path: '/exchange-diary', render: renderExchangeDiary }],
  navItem: { label: '交換日記', icon: 'book', path: '/exchange-diary', showInNav: true, order: 111 },
  styles: () => import('./style.css')
};