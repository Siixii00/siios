import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB, CharactersDB, UsersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { getBalance, charge, formatMoney, WalletError } from '../../core/wallet.js';

const MAX_HISTORY = 100;
const SOBER_MINUTES = 10; // 每 10 分鐘退一級醉意
const MAX_TIPSY = 5;
const TIPSY_LABELS = ['清醒', '微醺', '半醉', '醉了', '很醉', '爛醉'];

const MENU = [
    { id: 'beer', emoji: '🍺', name: '生啤酒', price: 80, alc: 1 },
    { id: 'wine', emoji: '🍷', name: '紅酒', price: 160, alc: 1 },
    { id: 'sake', emoji: '🍶', name: '清酒', price: 140, alc: 1 },
    { id: 'plum', emoji: '🍹', name: '梅酒蘇打', price: 120, alc: 1 },
    { id: 'gin', emoji: '🍸', name: '琴通寧', price: 180, alc: 2 },
    { id: 'whisky', emoji: '🥃', name: '威士忌', price: 220, alc: 2 },
    { id: 'soda', emoji: '🥤', name: '氣泡水', price: 60, alc: 0, sober: 0 },
    { id: 'tea', emoji: '🍵', name: '熱茶（解酒）', price: 50, alc: 0, sober: 1 },
    { id: 'fries', emoji: '🍟', name: '炸薯條（墊胃）', price: 90, alc: 0, sober: 1 }
];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const chatKey = id => 'pub_chat_' + id;
const stateKey = id => 'pub_state_' + id;

async function loadChat(id) {
    const v = await SettingsDB.get(chatKey(id));
    return Array.isArray(v) ? v : [];
}
const saveChat = (id, list) => SettingsDB.set(chatKey(id), list.slice(-MAX_HISTORY));

// 醉意會隨時間自然退去
async function loadState(id) {
    const v = (await SettingsDB.get(stateKey(id))) || {};
    const state = { user: v.user || 0, char: v.char || 0, ts: v.ts || Date.now(), drinks: Array.isArray(v.drinks) ? v.drinks : [], savedUpTo: v.savedUpTo || 0 };
    const drop = Math.floor((Date.now() - state.ts) / (SOBER_MINUTES * 60000));
    if (drop > 0) {
        state.user = Math.max(0, state.user - drop);
        state.char = Math.max(0, state.char - drop);
        state.ts = Date.now();
        if (state.user === 0 && state.char === 0) state.drinks = [];
    }
    return state;
}
const saveState = (id, s) => SettingsDB.set(stateKey(id), s);

async function apiReady() {
    const s = await APIClient.getSettings();
    return !!(s.api_url && s.api_key);
}

function avatarHtml(name, avatar, cls = '') {
    return avatar ? `<img class="pub-avatar ${cls}" src="${esc(avatar)}" alt="">` : `<span class="pub-avatar ${cls} pub-avatar-text">${esc((name || '?').slice(0, 1))}</span>`;
}

async function renderPub() {
    const container = createElement('div', 'pub-app');
    let alive = true;
    let view = 'list';
    let char = null;
    let history = [];
    let state = null;
    let busy = false;
    let menuOpen = false;
    let balance = await getBalance();
    const [characters, user] = await Promise.all([CharactersDB.getAll(), UsersDB.getAll().then(u => u[0] || null)]);
    const userName = user?.name || '你';

    const refreshBalance = async () => { balance = await getBalance(); };

    function draw() {
        const keep = container.querySelector('#pub-input')?.value || '';
        container.innerHTML = view === 'list' ? listHtml() : tableHtml();
        const input = container.querySelector('#pub-input');
        if (input) input.value = keep;
        const log = container.querySelector('.pub-log');
        if (log) log.scrollTop = log.scrollHeight;
    }

    function header(title, back) {
        return `<header class="pub-top"><button class="pub-icon" data-action="${back}">‹</button><h1>${title}</h1><span class="pub-wallet">${formatMoney(balance)}</span></header>`;
    }

    function listHtml() {
        const body = characters.length
            ? characters.map(c => `
            <button class="pub-seat" data-action="sit" data-id="${c.id}">
                ${avatarHtml(c.name, c.avatar, 'lg')}
                <span class="pub-seat-name">${esc(c.name)}</span>
                <span class="pub-seat-hint">坐到 TA 旁邊</span>
            </button>`).join('')
            : '<div class="pub-empty"><div>🍺</div><p>酒館裡還沒有人</p><p>先到設定建立角色，就能邀他們來喝一杯。</p></div>';
        return `${header('酒館', 'back')}<main class="pub-list"><p class="pub-sign">🏮 今晚想和誰喝一杯？</p><div class="pub-seats">${body}</div><p class="pub-note">請適量飲酒。這裡的酒都是虛擬的，用錢包的錢支付。</p></main>`;
    }

    function bubble(m) {
        if (m.role === 'system') return `<div class="pub-sys">${esc(m.text)}</div>`;
        const mine = m.role === 'user';
        return `<div class="pub-row ${mine ? 'me' : ''}">${mine ? '' : avatarHtml(char.name, char.avatar, 'sm')}<div class="pub-bubble">${esc(m.text)}</div></div>`;
    }

    function tableHtml() {
        const level = (n) => `<span class="pub-tipsy t${n}">${TIPSY_LABELS[n]}</span>`;
        const menu = menuOpen ? `
        <div class="pub-sheet">
            <div class="pub-sheet-head"><strong>酒單</strong><button data-action="menu">✕</button></div>
            <p class="pub-note">點給誰？</p>
            <div class="pub-target"><button data-action="target" data-t="user" class="${targetUser ? 'on' : ''}">我自己</button><button data-action="target" data-t="char" class="${targetUser ? '' : 'on'}">請 ${esc(char.name)}</button></div>
            ${MENU.map(d => `<button class="pub-drink" data-action="order" data-id="${d.id}" ${busy ? 'disabled' : ''}><span>${d.emoji} ${d.name}</span><span class="pub-muted">${d.alc ? '酒精 ' + '●'.repeat(d.alc) : '無酒精'}</span><strong>${formatMoney(d.price)}</strong></button>`).join('')}
        </div>` : '';
        return `
        ${header(esc(char.name), 'leave')}
        <div class="pub-status">${avatarHtml(char.name, char.avatar, 'sm')} ${level(state.char)}<span class="pub-gap"></span>${esc(userName)} ${level(state.user)}</div>
        <main class="pub-log">${history.length ? history.map(bubble).join('') : '<div class="pub-sys">你在吧檯坐下，' + esc(char.name) + ' 轉過頭來看你。</div>'}${busy ? '<div class="pub-sys">…</div>' : ''}</main>
        <footer class="pub-bar">
            <button class="pub-icon" data-action="menu" title="點酒">🍸</button>
            <input id="pub-input" type="text" maxlength="500" placeholder="說點什麼…" autocomplete="off">
            <button class="pub-send" data-action="send" ${busy ? 'disabled' : ''}>送出</button>
        </footer>${menu}`;
    }
    let targetUser = true;

    // 角色回應：把歷史轉成對話訊息，並告知雙方目前的醉意
    async function reply() {
        if (!(await apiReady())) { createToast('請先到設定填寫 API', 'error'); return; }
        busy = true; draw();
        try {
            const context = await buildAppContext({ characterId: char.id });
            const system = (context.systemPrompt || '') + `\n\n【場景】你正和 ${userName} 在一間氣氛溫暖的小酒館並肩而坐，一邊喝酒一邊聊天。你就是這個角色本人，用第一人稱、符合性格與說話方式，使用繁體中文。每次回覆 1~3 句，可以用（）描寫簡短動作，不要提到自己是 AI，不要替 ${userName} 說話。\n你現在的狀態：${TIPSY_LABELS[state.char]}；${userName} 的狀態：${TIPSY_LABELS[state.user]}。醉意越高，你越放鬆、話越多、越坦率，口齒也可以略顯鬆散，但保持角色本性。${state.drinks.length ? '\n今晚點過：' + state.drinks.slice(-6).join('、') + '。' : ''}`;
            const messages = [{ role: 'system', content: system }, ...history.slice(-14).map(m => ({ role: m.role === 'char' ? 'assistant' : 'user', content: m.role === 'system' ? '【場景】' + m.text : m.text }))];
            const text = await APIClient.complete(messages, { temperature: 0.9, maxTokens: 300 });
            history.push({ role: 'char', text: text.trim(), ts: Date.now() });
            await saveChat(char.id, history);
        } catch (e) {
            createToast('角色沒有回應：' + e.message, 'error');
        } finally {
            busy = false; if (alive) draw();
        }
    }

    async function order(drinkId) {
        const d = MENU.find(x => x.id === drinkId);
        if (!d || busy) return;
        const forUser = targetUser;
        try {
            await charge(d.price, '酒館：' + d.name, { category: 'pub' });
        } catch (e) {
            createToast(e instanceof WalletError ? e.message : '付款失敗：' + e.message, 'error');
            return;
        }
        await refreshBalance();
        const who = forUser ? 'user' : 'char';
        state[who] = Math.max(0, Math.min(MAX_TIPSY, state[who] + d.alc - (d.sober || 0)));
        state.ts = Date.now();
        state.drinks.push(d.emoji + d.name);
        history.push({ role: 'system', text: forUser ? `${userName} 點了一杯${d.name}（${formatMoney(d.price)}）` : `${userName} 請 ${char.name} 喝了一杯${d.name}（${formatMoney(d.price)}）`, ts: Date.now() });
        await Promise.all([saveChat(char.id, history), saveState(char.id, state)]);
        menuOpen = false;
        draw();
        await reply();
    }

    async function send() {
        const input = container.querySelector('#pub-input');
        const text = input.value.trim();
        if (!text || busy) return;
        input.value = '';
        history.push({ role: 'user', text, ts: Date.now() });
        await saveChat(char.id, history);
        await reply();
    }

    // 離開時把這次的對話存成角色的記憶（只存還沒存過的部分）
    async function rememberVisit() {
        if (!char || history.length <= state.savedUpTo) return;
        const fresh = history.slice(state.savedUpTo);
        if (!fresh.some(m => m.role === 'user')) return;
        const transcript = fresh.map(m => (m.role === 'user' ? userName : m.role === 'char' ? char.name : '（場景）') + '：' + m.text).join('\n');
        let content = `在酒館和 ${userName} 喝酒聊天${state.drinks.length ? '（點了 ' + state.drinks.slice(-5).join('、') + '）' : ''}。對話節錄：\n${transcript.slice(-600)}`;
        try {
            if (await apiReady()) {
                const summary = await APIClient.complete([{ role: 'system', content: '把下面的酒館對話濃縮成 60 字內的第一人稱記憶（我＝' + char.name + '，對象是' + userName + '），只輸出記憶內容。' }, { role: 'user', content: transcript.slice(-1500) }], { temperature: 0.3, maxTokens: 200 });
                if (summary) content = summary;
            }
        } catch (e) { console.warn('[Pub] 摘要失敗，改存節錄', e); }
        const saved = await saveInteractionMemory({ characterId: char.id, userId: user?.id || '', sourceApp: 'pub', sourceType: 'interaction', sourceSubtype: 'social', content, importance: 0.5 });
        if (saved) { state.savedUpTo = history.length; await saveState(char.id, state); }
    }

    async function onClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const a = btn.dataset.action;
        if (a === 'back') return Router.back();
        if (a === 'sit') {
            char = characters.find(c => c.id === btn.dataset.id);
            [history, state] = await Promise.all([loadChat(char.id), loadState(char.id)]);
            await refreshBalance();
            view = 'table'; menuOpen = false; return draw();
        }
        if (a === 'leave') {
            await rememberVisit();
            view = 'list'; char = null; menuOpen = false; await refreshBalance(); return draw();
        }
        if (a === 'menu') { menuOpen = !menuOpen; return draw(); }
        if (a === 'target') { targetUser = btn.dataset.t === 'user'; return draw(); }
        if (a === 'order') return order(btn.dataset.id);
        if (a === 'send') return send();
    }

    container.addEventListener('click', onClick);
    container.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.id === 'pub-input') { e.preventDefault(); send(); } });
    draw();
    return {
        element: container,
        cleanup: () => { alive = false; rememberVisit().catch(() => {}); }
    };
}

export default {
    id: 'pub',
    name: '酒館',
    icon: 'local_bar',
    routes: [{ path: '/pub', render: renderPub }],
    navItem: { label: '酒館', icon: 'local_bar', path: '/pub', showInNav: true, order: 113 },
    stylesPath: 'js/apps/pub/style.css'
};
