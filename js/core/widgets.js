import { createElement } from '../components.js';
import { SettingsDB } from '../db.js';
import Router from '../router.js';

export const WIDGETS = [
    { id: 'w1', name: '天氣', icon: '☁️', size: 'small', path: '/weather' },
    { id: 'w2', name: '時鐘', icon: '🕐', size: 'small', path: null },
    { id: 'w3', name: '行事曆', icon: '📅', size: 'medium', path: '/timetree' },
    { id: 'w4', name: '音樂', icon: '🎵', size: 'medium', path: '/music' },
    { id: 'w5', name: '備忘錄', icon: '📝', size: 'small', path: null },
    { id: 'w6', name: '健康', icon: '❤️', size: 'large', path: '/health' }
];

const ACTIVE_KEY = 'widget_active';
const MEMO_KEY = 'widget_memo';

export async function getActiveWidgetIds() {
    const saved = await SettingsDB.get(ACTIVE_KEY);
    return Array.isArray(saved) ? saved.filter(id => WIDGETS.some(w => w.id === id)) : [];
}

export const setActiveWidgetIds = ids => SettingsDB.set(ACTIVE_KEY, ids);

const pad = n => String(n).padStart(2, '0');

// 元素離開畫面後自動停止計時，不需要額外的清理呼叫
function tickWhileConnected(el, fn, ms) {
    const timer = setInterval(() => {
        if (!el.isConnected) { clearInterval(timer); return; }
        fn();
    }, ms);
}

async function weatherBody(body) {
    const location = await SettingsDB.get('weather_location');
    const raw = await SettingsDB.get('weather_cache');
    let cache = null;
    try { cache = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { cache = null; }
    const temp = cache?.data?.current?.temperature_2m;
    if (!location || typeof temp !== 'number') {
        body.appendChild(createElement('div', 'hw-main', { textContent: '--°' }));
        body.appendChild(createElement('div', 'hw-sub', { textContent: location ? '點擊更新天氣' : '尚未設定地點' }));
        return;
    }
    body.appendChild(createElement('div', 'hw-main', { textContent: Math.round(temp) + '°' }));
    const ageMin = Math.max(0, Math.round((Date.now() - (cache.timestamp || Date.now())) / 60000));
    body.appendChild(createElement('div', 'hw-sub', { textContent: location + (ageMin > 60 ? '（資料較舊）' : '') }));
}

function clockBody(body) {
    const time = createElement('div', 'hw-main');
    const date = createElement('div', 'hw-sub');
    const update = () => {
        const d = new Date();
        time.textContent = pad(d.getHours()) + ':' + pad(d.getMinutes());
        date.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 週' + '日一二三四五六'[d.getDay()];
    };
    update();
    body.append(time, date);
    tickWhileConnected(body, update, 1000);
}

async function calendarBody(body) {
    const events = (await SettingsDB.get('timetree_events')) || [];
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    const today = now.getDate();
    const marked = new Set(events.map(e => new Date(e.date)).filter(d => d.getFullYear() === y && d.getMonth() === m).map(d => d.getDate()));
    body.appendChild(createElement('div', 'hw-sub', { textContent: y + ' 年 ' + (m + 1) + ' 月' }));
    const grid = createElement('div', 'hw-cal');
    '日一二三四五六'.split('').forEach(w => grid.appendChild(createElement('span', 'hw-cal-w', { textContent: w })));
    for (let i = 0; i < new Date(y, m, 1).getDay(); i++) grid.appendChild(createElement('span'));
    for (let d = 1; d <= new Date(y, m + 1, 0).getDate(); d++) {
        grid.appendChild(createElement('span', 'hw-cal-d' + (d === today ? ' today' : '') + (marked.has(d) ? ' marked' : ''), { textContent: String(d) }));
    }
    body.appendChild(grid);
    const todays = events.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === y && d.getMonth() === m && d.getDate() === today;
    });
    body.appendChild(createElement('div', 'hw-sub', { textContent: todays.length ? '今天：' + todays.map(e => e.title).join('、') : '今天沒有事件' }));
}

async function musicBody(body) {
    const playlist = await SettingsDB.get('music_playlist');
    const list = Array.isArray(playlist) ? playlist : [];
    body.appendChild(createElement('div', 'hw-main', { textContent: list.length ? list.length + ' 首歌' : '還沒有歌單' }));
    const first = list[0];
    body.appendChild(createElement('div', 'hw-sub', { textContent: first ? '最近：' + (first.title || first.name || '未命名') : '點擊匯入歌單' }));
}

async function memoBody(body) {
    const area = createElement('textarea', 'hw-memo', { placeholder: '寫點什麼…' });
    area.value = (await SettingsDB.get(MEMO_KEY)) || '';
    let timer = null;
    area.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => SettingsDB.set(MEMO_KEY, area.value), 400);
    });
    area.addEventListener('blur', () => { clearTimeout(timer); SettingsDB.set(MEMO_KEY, area.value); });
    // 在備忘錄內操作不應該觸發主畫面的滑動換頁
    ['touchstart', 'touchmove', 'mousedown'].forEach(ev => area.addEventListener(ev, e => e.stopPropagation(), { passive: true }));
    body.appendChild(area);
}

function healthBody(body) {
    const d = new Date();
    body.appendChild(createElement('div', 'hw-main', { textContent: '健康紀錄' }));
    body.appendChild(createElement('div', 'hw-sub', { textContent: (d.getMonth() + 1) + '月' + d.getDate() + '日　點擊記錄用藥與經期' }));
}

const BODIES = { w1: weatherBody, w2: clockBody, w3: calendarBody, w4: musicBody, w5: memoBody, w6: healthBody };

export async function createWidgetElement(id) {
    const w = WIDGETS.find(x => x.id === id);
    if (!w) return null;
    const card = createElement('div', 'home-widget hw-' + w.size);
    card.dataset.widget = w.id;
    card.appendChild(createElement('div', 'hw-title', { textContent: w.icon + ' ' + w.name }));
    const body = createElement('div', 'hw-body');
    card.appendChild(body);
    await BODIES[w.id](body);
    if (w.path) {
        card.style.cursor = 'pointer';
        card.addEventListener('click', () => Router.navigate(w.path));
    }
    return card;
}

export async function createWidgetsSection() {
    const ids = await getActiveWidgetIds();
    if (ids.length === 0) return null;
    const section = createElement('div', 'home-widgets');
    for (const id of ids) {
        try {
            const el = await createWidgetElement(id);
            if (el) section.appendChild(el);
        } catch { /* 單一小工具失敗不影響主畫面 */ }
    }
    return section.children.length ? section : null;
}
