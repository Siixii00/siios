import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const WIDGETS = [
  { id: 'w1', name: '天氣', icon: '☁️', size: 'small' },
  { id: 'w2', name: '時鐘', icon: '🕐', size: 'small' },
  { id: 'w3', name: '行事曆', icon: '📅', size: 'medium' },
  { id: 'w4', name: '音樂', icon: '🎵', size: 'medium' },
  { id: 'w5', name: '備忘錄', icon: '📝', size: 'small' },
  { id: 'w6', name: '健康', icon: '❤️', size: 'large' }
];

let activeWidgets = [];

async function loadWidgets() {
  const saved = await SettingsDB.get('widget_active');
  if (saved) activeWidgets = saved;
}

async function saveWidgets() {
  await SettingsDB.set('widget_active', activeWidgets);
}

async function renderWidget(params) {
  await loadWidgets();
  const container = createElement('div', 'app-container widget-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">小工具</h1>
    </header>
    <div class="page">
      <div class="widget-preview">
        ${activeWidgets.map(wid => {
          const w = WIDGETS.find(x => x.id === wid);
          if (!w) return '';
          return `<div class="widget-card ${w.size}"><span class="w-icon">${w.icon}</span><span class="w-name">${w.name}</span></div>`;
        }).join('') || '<div class="empty-preview">點擊下方小工具加入</div>'}
      </div>
      <h3 class="section-title">可用小工具</h3>
      <div class="widget-list">
        ${WIDGETS.map(w => `
          <div class="widget-item ${activeWidgets.includes(w.id) ? 'active' : ''}" data-id="${w.id}">
            <span class="w-icon">${w.icon}</span>
            <span class="w-name">${w.name}</span>
            <span class="w-size">${w.size}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelectorAll('.widget-item').forEach(item => {
    item.onclick = async () => {
      const id = item.dataset.id;
      if (activeWidgets.includes(id)) {
        activeWidgets = activeWidgets.filter(x => x !== id);
      } else {
        activeWidgets.push(id);
      }
      await saveWidgets();
      renderWidget(params);
    };
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'widget',
  name: '小工具',
  icon: 'th-large',
  routes: [{ path: '/widget', render: renderWidget }],
  navItem: { label: '小工具', icon: 'th-large', path: '/widget', showInNav: true, order: 146 },
  styles: () => import('./style.css')
};