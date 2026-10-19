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

const STATE_KEY = 'home_state';
const MAX_HISTORY = 50;

async function loadState() {
  const saved = await SettingsDB.get(STATE_KEY);
  const energy = typeof saved?.energy === 'number' ? Math.max(0, Math.min(100, saved.energy)) : 50;
  return { energy, activities: Array.isArray(saved?.activities) ? saved.activities : [] };
}

const fmtTime = ts => {
  const d = new Date(ts);
  return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
};

async function renderHome() {
  const state = await loadState();
  const container = createElement('div', 'app-container home-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">Stay</h1>
    </header>
    <div class="page">
      <div class="energy-bar">
        <span class="energy-label">精力值</span>
        <div class="energy-track"><div class="energy-fill" style="width: ${state.energy}%"></div></div>
        <span class="energy-value">${state.energy}%</span>
      </div>
      <div class="activity-grid"></div>
      <div class="status-msg">${state.energy > 70 ? '精神飽滿！' : state.energy > 30 ? '還行，繼續宅吧～' : '該休息了...'}</div>
      <div class="home-history"><h3>最近活動</h3><div class="history-list"></div></div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();

  const grid = container.querySelector('.activity-grid');
  ACTIVITIES.forEach(a => {
    const btn = createElement('button', 'activity-btn');
    btn.innerHTML = `<span class="activity-icon">${a.icon}</span><span class="activity-name">${a.name}（${a.energy > 0 ? '+' : ''}${a.energy}）</span>`;
    btn.onclick = async () => {
      const s = await loadState();
      s.energy = Math.max(0, Math.min(100, s.energy + a.energy));
      s.activities.push({ id: a.id, time: Date.now() });
      s.activities = s.activities.slice(-MAX_HISTORY);
      await SettingsDB.set(STATE_KEY, s);
      Router.handleRoute();
    };
    grid.appendChild(btn);
  });

  const history = container.querySelector('.history-list');
  const recent = state.activities.slice(-6).reverse();
  if (recent.length === 0) history.appendChild(createElement('div', 'empty-history', { textContent: '還沒有活動紀錄' }));
  recent.forEach(h => {
    const a = ACTIVITIES.find(x => x.id === h.id);
    if (!a) return;
    history.appendChild(createElement('div', 'history-row', { textContent: a.icon + ' ' + a.name + '　' + fmtTime(h.time) }));
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'stay',
  name: '宅家',
  icon: 'couch',
  routes: [{ path: '/stay', render: renderHome }],
  navItem: { label: '宅家', icon: 'couch', path: '/stay', showInNav: true, order: 126 },
  stylesPath: 'js/apps/home/style.css'
};
