import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const ACTIVITIES = [
  { id: 'a1', name: '看電影', icon: '🎬', energy: -1 },
  { id: 'a2', name: '打遊戲', icon: '🎮', energy: -2 },
  { id: 'a3', name: '聽音樂', icon: '🎵', energy: 1 },
  { id: 'a4', name: '閱讀', icon: '📚', energy: 2 },
  { id: 'a5', name: '小睡', icon: '😴', energy: 3 },
  { id: 'a6', name: '吃零食', icon: '🍿', energy: 1 }
];

let state = { energy: 50, activities: [] };

async function loadState() {
  const saved = await SettingsDB.get('home_state');
  if (saved) state = saved;
}

async function saveState() {
  await SettingsDB.set('home_state', state);
}

async function renderHome(params) {
  await loadState();
  const container = createElement('div', 'app-container home-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">宅家</h1>
    </header>
    <div class="page">
      <div class="energy-bar">
        <span class="energy-label">精力值</span>
        <div class="energy-track">
          <div class="energy-fill" style="width: ${state.energy}%"></div>
        </div>
        <span class="energy-value">${state.energy}%</span>
      </div>
      <div class="activity-grid">
        ${ACTIVITIES.map(a => `
          <button class="activity-btn" data-id="${a.id}" data-energy="${a.energy}">
            <span class="activity-icon">${a.icon}</span>
            <span class="activity-name">${a.name}</span>
          </button>
        `).join('')}
      </div>
      <div class="status-msg">
        ${state.energy > 70 ? '精神飽滿！' : state.energy > 30 ? '還行，繼續宅吧～' : '該休息了...'}
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelectorAll('.activity-btn').forEach(btn => {
    btn.onclick = async () => {
      const e = parseInt(btn.dataset.energy);
      state.energy = Math.max(0, Math.min(100, state.energy + e));
      state.activities.push({ id: btn.dataset.id, time: Date.now() });
      await saveState();
      renderHome(params);
    };
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'home',
  name: '宅家',
  icon: 'couch',
  routes: [{ path: '/home', render: renderHome }],
  navItem: { label: '宅家', icon: 'couch', path: '/home', showInNav: true, order: 126 },
  styles: () => import('./style.css')
};