import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const THEMES = [
  { id: 'light', name: '淺色', bg: '#ffffff', text: '#333333' },
  { id: 'dark', name: '深色', bg: '#1a1a2e', text: '#e5e5e5' },
  { id: 'pink', name: '粉色', bg: '#fce4ec', text: '#880e4f' },
  { id: 'blue', name: '藍色', bg: '#e3f2fd', text: '#0d47a1' },
  { id: 'green', name: '綠色', bg: '#e8f5e9', text: '#2e7d32' }
];

let currentTheme = 'light';

async function loadTheme() {
  const saved = await SettingsDB.get('appearance_theme');
  if (saved) currentTheme = saved;
}

async function saveTheme() {
  await SettingsDB.set('appearance_theme', currentTheme);
}

async function renderAppearance(params) {
  await loadTheme();
  const container = createElement('div', 'app-container appearance-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">外觀設定</h1>
    </header>
    <div class="page">
      <h2 class="section-title">主題</h2>
      <div class="theme-grid">
        ${THEMES.map(t => `
          <div class="theme-card ${t.id === currentTheme ? 'active' : ''}" data-id="${t.id}" style="background: ${t.bg}; color: ${t.text};">
            <span class="theme-name">${t.name}</span>
            ${t.id === currentTheme ? '<i class="fas fa-check"></i>' : ''}
          </div>
        `).join('')}
      </div>
      <h2 class="section-title">字體大小</h2>
      <div class="font-size-control">
        <button class="font-btn small">小</button>
        <button class="font-btn medium active">中</button>
        <button class="font-btn large">大</button>
      </div>
      <h2 class="section-title">預覽</h2>
      <div class="preview-box" style="background: ${THEMES.find(t => t.id === currentTheme)?.bg}; color: ${THEMES.find(t => t.id === currentTheme)?.text};">
        <p>這是預覽文字，用來展示主題效果。</p>
        <p>當前主題：${THEMES.find(t => t.id === currentTheme)?.name}</p>
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelectorAll('.theme-card').forEach(card => {
    card.onclick = async () => {
      currentTheme = card.dataset.id;
      await saveTheme();
      renderAppearance(params);
    };
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'appearance',
  name: '外觀設定',
  icon: 'palette',
  routes: [{ path: '/appearance', render: renderAppearance }],
  navItem: { label: '外觀', icon: 'palette', path: '/appearance', showInNav: true, order: 140 },
  styles: () => import('./style.css')
};