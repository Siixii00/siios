import { SettingsDB } from '../db.js';

const KEY = 'timetree_events';

// 事件：{ id, title, date(ISO，當天中午), time('HH:MM'，可省略) }。舊版事件沒有 time，一樣相容。
export async function loadEvents() {
    const list = await SettingsDB.get(KEY);
    return Array.isArray(list) ? list.filter(e => e && e.title && !Number.isNaN(new Date(e.date).getTime())) : [];
}

const saveEvents = list => SettingsDB.set(KEY, list);

export function dateKey(dateLike) {
    const d = new Date(dateLike);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// dateStr: 'YYYY-MM-DD'（本地日期）
function noonISO(dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d, 12).toISOString();
}

let queue = Promise.resolve();
function serial(fn) {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
}

export function addEvent({ title, dateStr, time }) {
    return serial(async () => {
        const list = await loadEvents();
        const event = { id: Date.now() + Math.floor(Math.random() * 1000), title: title.trim(), date: noonISO(dateStr), ...(time ? { time } : {}) };
        list.push(event);
        await saveEvents(list);
        import('./activity-memory.js').then(m => m.rememberActivity({ sourceApp: 'timetree', content: `用戶在時間樹新增了行程「${event.title}」（${event.date.slice(0, 10)}${event.time ? ' ' + event.time : ''}）`, importance: 0.4 })).catch(() => {});
        return event;
    });
}

export function updateEvent(id, { title, dateStr, time }) {
    return serial(async () => {
        const list = await loadEvents();
        const e = list.find(x => x.id === id);
        if (!e) return null;
        if (title !== undefined) e.title = title.trim();
        if (dateStr) e.date = noonISO(dateStr);
        if (time !== undefined) { if (time) e.time = time; else delete e.time; }
        await saveEvents(list);
        return e;
    });
}

export function deleteEvent(id) {
    return serial(async () => {
        const list = await loadEvents();
        await saveEvents(list.filter(x => x.id !== id));
    });
}

export function eventsOn(list, dateStr) {
    return list
        .filter(e => dateKey(e.date) === dateStr)
        .sort((a, b) => (a.time || '99:99').localeCompare(b.time || '99:99'));
}

// 今天起 days 天內（含今天）的行程，依日期時間排序
export function upcomingEvents(list, days = 7, now = new Date()) {
    const start = dateKey(now);
    const end = dateKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
    return list
        .map(e => ({ ...e, key: dateKey(e.date) }))
        .filter(e => e.key >= start && e.key < end)
        .sort((a, b) => a.key.localeCompare(b.key) || (a.time || '99:99').localeCompare(b.time || '99:99'));
}

// 給 AI 看的文字；沒有行程時回傳空字串
export function describeUpcoming(list, days = 7, now = new Date()) {
    const items = upcomingEvents(list, days, now);
    if (items.length === 0) return '';
    const weekdays = '日一二三四五六';
    return items.map(e => {
        const d = new Date(e.date);
        return '- ' + (d.getMonth() + 1) + '/' + d.getDate() + '（週' + weekdays[d.getDay()] + '）' + (e.time ? ' ' + e.time : '') + ' ' + e.title;
    }).join('\n');
}
