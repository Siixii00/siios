import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

let events = [];

async function loadEvents() {
  const saved = await SettingsDB.get('timetree_events');
  if (saved) events = saved;
}

async function saveEvents() {
  await SettingsDB.set('timetree_events', events);
}

async function renderTimetree(params) {
  await loadEvents();
  const today = new Date();
  const month = today.toLocaleDateString('zh-TW', { year: 'numeric', month: 'long' });
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
  
  const container = createElement('div', 'app-container timetree-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">時間樹</h1>
    </header>
    <div class="page">
      <div class="calendar-header">${month}</div>
      <div class="calendar-grid">
        <div class="calendar-weekdays">
          <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
        </div>
        <div class="calendar-days">
          ${Array(firstDay).fill('<div class="day empty"></div>').join('')}
          ${Array(daysInMonth).fill(0).map((_, i) => {
            const day = i + 1;
            const isToday = day === today.getDate();
            const hasEvent = events.some(e => new Date(e.date).getDate() === day);
            return `<div class="day ${isToday ? 'today' : ''} ${hasEvent ? 'has-event' : ''}" data-day="${day}">${day}</div>`;
          }).join('')}
        </div>
      </div>
      <button class="add-event-btn"><i class="fas fa-plus"></i> 新增事件</button>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelector('.add-event-btn').onclick = async () => {
    const title = prompt('事件標題：');
    if (title) {
      events.push({ title, date: today.toISOString(), id: Date.now() });
      await saveEvents();
      renderTimetree(params);
    }
  };
  return { element: container, cleanup: null };
}

export default {
  id: 'timetree',
  name: '時間樹',
  icon: 'calendar-alt',
  routes: [{ path: '/timetree', render: renderTimetree }],
  navItem: { label: '時間樹', icon: 'calendar-alt', path: '/timetree', showInNav: true, order: 125 },
  styles: () => import('./style.css')
};