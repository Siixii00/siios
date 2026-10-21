import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import {askForm, askConfirm } from '../../core/dialogs.js';
import { loadEvents, addEvent, updateEvent, deleteEvent, eventsOn, dateKey } from '../../core/calendar.js';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

// 目前檢視的月份與選取日期（離開 app 再回來時重置為今天）
let viewYear = null;
let viewMonth = null;
let selected = null;

const pad = n => String(n).padStart(2, '0');
const keyOf = (y, m, d) => y + '-' + pad(m + 1) + '-' + pad(d);

async function renderTimetree() {
  const now = new Date();
  if (viewYear === null) { viewYear = now.getFullYear(); viewMonth = now.getMonth(); selected = dateKey(now); }
  const todayKey = dateKey(now);

  const container = createElement('div', 'app-container timetree-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">時間樹</h1>
    </header>
    <div class="page">
      <div class="calendar-nav">
        <button class="cal-prev" aria-label="上個月">‹</button>
        <button class="calendar-header cal-title"></button>
        <button class="cal-next" aria-label="下個月">›</button>
      </div>
      <div class="calendar-grid">
        <div class="calendar-weekdays">${WEEKDAYS.map(w => `<span>${w}</span>`).join('')}</div>
        <div class="calendar-days"></div>
      </div>
      <div class="day-events">
        <div class="day-events-head"><h3 class="day-events-title"></h3></div>
        <div class="day-events-list"></div>
      </div>
      <button class="add-event-btn"><i class="fas fa-plus"></i> 新增事件</button>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();

  const daysEl = container.querySelector('.calendar-days');
  const titleEl = container.querySelector('.cal-title');
  const listEl = container.querySelector('.day-events-list');
  const dayTitle = container.querySelector('.day-events-title');

  async function draw() {
    const events = await loadEvents();
    titleEl.textContent = viewYear + ' 年 ' + (viewMonth + 1) + ' 月';
    daysEl.replaceChildren();
    const first = new Date(viewYear, viewMonth, 1).getDay();
    const count = new Date(viewYear, viewMonth + 1, 0).getDate();
    for (let i = 0; i < first; i++) daysEl.appendChild(createElement('div', 'day empty'));
    for (let d = 1; d <= count; d++) {
      const k = keyOf(viewYear, viewMonth, d);
      const cell = createElement('button', 'day' + (k === todayKey ? ' today' : '') + (k === selected ? ' selected' : '') + (eventsOn(events, k).length ? ' has-event' : ''), { textContent: String(d) });
      cell.onclick = () => { selected = k; draw(); };
      daysEl.appendChild(cell);
    }

    const [sy, sm, sd] = selected.split('-').map(Number);
    dayTitle.textContent = sm + ' 月 ' + sd + ' 日（週' + WEEKDAYS[new Date(sy, sm - 1, sd).getDay()] + '）' + (selected === todayKey ? ' 今天' : '');
    listEl.replaceChildren();
    const todays = eventsOn(events, selected);
    if (todays.length === 0) listEl.appendChild(createElement('div', 'no-events', { textContent: '這天沒有事件' }));
    todays.forEach(e => {
      const row = createElement('div', 'event-row');
      row.appendChild(createElement('span', 'event-time', { textContent: e.time || '全天' }));
      row.appendChild(createElement('span', 'event-title', { textContent: e.title }));
      const edit = createElement('button', 'event-btn', { textContent: '編輯' });
      edit.onclick = () => openForm(e);
      const del = createElement('button', 'event-btn danger', { textContent: '刪除' });
      del.onclick = async () => {
        if (!await askConfirm('刪除「' + e.title + '」？')) return;
        await deleteEvent(e.id);
        createToast('已刪除');
        draw();
      };
      row.append(edit, del);
      listEl.appendChild(row);
    });
  }

  async function openForm(existing) {
    const form = await askForm({
      title: existing ? '編輯事件' : '新增事件（' + selected + '）',
      fields: [
        { key: 'title', label: '標題', required: true, placeholder: '例如：開會', value: existing?.title },
        { key: 'time', label: '時間（選填）', type: 'time', value: existing?.time || '' },
        ...(existing ? [{ key: 'date', label: '日期', type: 'date', required: true, value: dateKey(existing.date) }] : [])
      ],
      submitLabel: existing ? '儲存' : '新增'
    });
    if (!form) return;
    if (existing) await updateEvent(existing.id, { title: form.title, time: form.time, dateStr: form.date });
    else await addEvent({ title: form.title, time: form.time, dateStr: selected });
    createToast(existing ? '已更新' : '已新增');
    if (existing && form.date) {
      const [y, m] = form.date.split('-').map(Number);
      selected = form.date; viewYear = y; viewMonth = m - 1;
    }
    draw();
  }

  container.querySelector('.cal-prev').onclick = () => { viewMonth--; if (viewMonth < 0) { viewMonth = 11; viewYear--; } draw(); };
  container.querySelector('.cal-next').onclick = () => { viewMonth++; if (viewMonth > 11) { viewMonth = 0; viewYear++; } draw(); };
  titleEl.onclick = () => { const t = new Date(); viewYear = t.getFullYear(); viewMonth = t.getMonth(); selected = dateKey(t); draw(); };
  container.querySelector('.add-event-btn').onclick = () => openForm(null);

  await draw();
  return { element: container, cleanup: () => { viewYear = null; viewMonth = null; selected = null; } };
}

export default {
  id: 'timetree',
  name: '時間樹',
  icon: 'calendar_month',
  routes: [{ path: '/timetree', render: renderTimetree }],
  navItem: { label: '時間樹', icon: 'calendar_month', path: '/timetree', showInNav: true, order: 125 },
  stylesPath: 'js/apps/timetree/style.css'
};
