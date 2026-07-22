import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';

const HISTORY_KEY = 'phone_history';
const RECORDINGS_KEY = 'voice_call_recordings';

const favorites = [
    { name: '小魚', number: '0912123456', label: '家人' },
    { name: '工作群組', number: '0223456789', label: '辦公室' },
    { name: '慢跑同伴', number: '0987654321', label: '朋友' }
];

let historyEntries = [];
let currentTab = 'keypad';
let currentAudio = null;
let statusTimer = null;

const state = {
    number: '',
    silent: false
};

async function loadHistory() {
    try {
        const data = await SettingsDB.get(HISTORY_KEY);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

async function saveHistory(entries) {
    await SettingsDB.set(HISTORY_KEY, entries.slice(0, 30));
}

async function loadRecordings() {
    try {
        const data = await SettingsDB.get(RECORDINGS_KEY);
        return Array.isArray(data) ? data : [];
    } catch {
        return [];
    }
}

async function saveRecordings(recordings) {
    await SettingsDB.set(RECORDINGS_KEY, recordings.slice(0, 100));
}

async function addRecording(recording) {
    const recordings = await loadRecordings();
    recordings.unshift(recording);
    await saveRecordings(recordings);
}

async function deleteRecording(id) {
    const recordings = await loadRecordings();
    const filtered = recordings.filter(r => r.id !== id);
    await saveRecordings(filtered);
}

async function clearAllRecordings() {
    await saveRecordings([]);
}

const formatDuration = (seconds) => {
    if (!seconds) return '未接';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (!mins) return `${secs} 秒`;
    return `${mins} 分 ${secs.toString().padStart(2, '0')} 秒`;
};

const formatTimestamp = (ts) => {
    const date = new Date(ts);
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();
    const time = date.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    if (sameDay) return `今天 ${time}`;
    if (isYesterday) return `昨天 ${time}`;
    return date.toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' }) + ' ' + time;
};

const formatDialText = (value) => {
    const condensed = value.replace(/\s+/g, '');
    if (/^\d+$/.test(condensed)) {
        return condensed.replace(/(.{4})/g, '$1 ').trim();
    }
    return condensed;
};

const findContactByNumber = (number) => {
    const target = number.replace(/\D/g, '');
    return favorites.find(contact => contact.number.replace(/\D/g, '') === target);
};

function updateDialedNumber(container) {
    const el = container.querySelector('#dialed-number');
    if (!el) return;
    if (!state.number) {
        el.textContent = '輸入號碼';
        el.classList.add('muted');
        return;
    }
    el.textContent = formatDialText(state.number) || state.number;
    el.classList.remove('muted');
}

function setStatus(message, container) {
    const el = container.querySelector('#status-banner');
    if (!el) return;
    el.textContent = message;
    el.classList.add('active');
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
        el?.classList.remove('active');
    }, 1600);
}

function appendDigit(value, container) {
    if (!value) return;
    if (state.number.length >= 24) {
        setStatus('號碼已達上限', container);
        return;
    }
    state.number += value;
    updateDialedNumber(container);
}

function eraseDigit(container) {
    if (!state.number) return;
    state.number = state.number.slice(0, -1);
    updateDialedNumber(container);
}

function clearNumber(container) {
    if (!state.number) {
        setStatus('沒有號碼可清除', container);
        return;
    }
    state.number = '';
    updateDialedNumber(container);
    setStatus('已清除號碼', container);
}

async function simulateCall(container, options = {}) {
    if (!state.number) {
        setStatus('請先輸入號碼', container);
        return;
    }
    const digits = state.number.replace(/\s+/g, '');
    const contact = findContactByNumber(digits);
    const label = options.label || contact?.name || `聯絡人 ${digits.slice(-4)}`;
    const duration = options.duration ?? Math.floor(30 + Math.random() * 210);
    const entry = {
        id: `call-${Date.now()}`,
        name: contact?.name || '',
        number: digits,
        type: options.type || 'outgoing',
        timestamp: Date.now(),
        duration
    };
    historyEntries = [entry, ...historyEntries].slice(0, 30);
    await saveHistory(historyEntries);
    renderHistory(container);
    setStatus(`已撥出至 ${label}`, container);
    state.number = '';
    updateDialedNumber(container);
}

async function clearHistory(container) {
    if (!historyEntries.length) {
        setStatus('沒有紀錄可清除', container);
        return;
    }
    historyEntries = [];
    await saveHistory([]);
    renderHistory(container);
    setStatus('通話紀錄已清除', container);
}

function renderHistory(container) {
    const list = container.querySelector('#history-list');
    if (!list) return;
    list.innerHTML = '';
    if (!historyEntries.length) {
        const empty = document.createElement('li');
        empty.className = 'history-empty';
        empty.textContent = '暫無通話紀錄';
        list.appendChild(empty);
        return;
    }
    historyEntries.forEach(entry => {
        const item = document.createElement('li');
        item.className = 'history-item';
        const main = document.createElement('div');
        main.className = 'history-main';
        const type = document.createElement('div');
        type.className = `history-type ${entry.type}`;
        type.textContent = entry.type === 'incoming' ? '↙' : entry.type === 'missed' ? '⚠' : '↗';
        const meta = document.createElement('div');
        meta.className = 'history-meta';
        const numberDisplay = formatDialText(entry.number);
        const name = entry.name || numberDisplay || '未知號碼';
        meta.innerHTML = `<h3>${name}</h3><p>${entry.name ? numberDisplay : '未儲存'}</p>`;
        main.append(type, meta);
        const extra = document.createElement('div');
        extra.className = 'history-extra';
        extra.innerHTML = `<div>${formatTimestamp(entry.timestamp)}</div><div>${formatDuration(entry.duration)}</div>`;
        item.append(main, extra);
        item.addEventListener('dblclick', () => {
            state.number = entry.number;
            updateDialedNumber(container);
            simulateCall(container, { label: entry.name || numberDisplay });
        });
        list.appendChild(item);
    });
}

function renderFavorites(container) {
    const grid = container.querySelector('#favorite-grid');
    if (!grid) return;
    grid.innerHTML = '';
    favorites.forEach(contact => {
        const card = document.createElement('button');
        card.type = 'button';
        card.className = 'favorite-card';
        card.innerHTML = `
            <div class="favorite-avatar">${contact.name.slice(0, 2)}</div>
            <div class="favorite-meta">
                <h3>${contact.name}</h3>
                <p>${contact.label}</p>
            </div>
        `;
        card.addEventListener('click', () => {
            state.number = contact.number;
            updateDialedNumber(container);
            setStatus(`已填入 ${contact.name}`, container);
        });
        grid.appendChild(card);
    });
}

function shuffleFavorites(container) {
    for (let i = favorites.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [favorites[i], favorites[j]] = [favorites[j], favorites[i]];
    }
    renderFavorites(container);
    setStatus('已重新排序常用聯絡人', container);
}

function saveContact(container) {
    if (!state.number) {
        setStatus('請先輸入號碼', container);
        return;
    }
    const exists = favorites.some(contact => contact.number.replace(/\D/g, '') === state.number.replace(/\D/g, ''));
    if (exists) {
        setStatus('號碼已在常用聯絡人中', container);
        return;
    }
    const suffix = state.number.slice(-4).padStart(4, '0');
    const name = `聯絡人 ${suffix}`;
    favorites.unshift({ name, number: state.number, label: '快速加入' });
    renderFavorites(container);
    setStatus(`${name} 已加入常用`, container);
}

function updateConnectionStatus(container) {
    const el = container.querySelector('#connection-status');
    if (!el) return;
    const battery = Math.max(65, Math.min(99, Math.floor(80 + Math.random() * 15)));
    el.textContent = `${state.silent ? '靜音' : '4G'} · ${battery}%`;
}

function playRecording(rec) {
    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }
    if (rec.audioData) {
        const audio = new Audio(rec.audioData);
        currentAudio = audio;
        audio.play().catch(() => {});
    }
}

function downloadRecording(rec) {
    if (!rec.audioData) return;
    const link = document.createElement('a');
    link.href = rec.audioData;
    link.download = `通話錄音_${rec.charName}_${new Date(rec.timestamp).toISOString().slice(0, 10)}.webm`;
    link.click();
}

async function renderRecordings(container) {
    const list = container.querySelector('#recordings-list');
    if (!list) return;
    const recordings = await loadRecordings();
    list.innerHTML = '';
    if (!recordings.length) {
        const empty = document.createElement('li');
        empty.className = 'recordings-empty';
        empty.innerHTML = '<i class="fas fa-microphone-slash"></i><p>尚無錄音紀錄</p><span>通話錄音將自動保存在這裡</span>';
        list.appendChild(empty);
        return;
    }
    recordings.forEach(rec => {
        const item = document.createElement('li');
        item.className = 'recording-item';
        const playBtn = document.createElement('button');
        playBtn.className = 'recording-play';
        playBtn.innerHTML = '<i class="fas fa-play"></i>';
        playBtn.addEventListener('click', () => playRecording(rec));
        const info = document.createElement('div');
        info.className = 'recording-info';
        info.innerHTML = `
            <h3><i class="fas fa-user"></i> ${rec.charName}</h3>
            <p>${formatTimestamp(rec.timestamp)} · ${formatDuration(rec.duration)}</p>
        `;
        if (rec.transcript && rec.transcript.length > 0) {
            const transcriptToggle = document.createElement('button');
            transcriptToggle.className = 'transcript-toggle';
            transcriptToggle.innerHTML = '<i class="fas fa-comment-dots"></i> 通話內容';
            transcriptToggle.addEventListener('click', () => {
                const details = item.querySelector('.recording-transcript');
                if (details) {
                    details.classList.toggle('open');
                    transcriptToggle.classList.toggle('active', details.classList.contains('open'));
                }
            });
            info.appendChild(transcriptToggle);
            const transcriptDiv = document.createElement('div');
            transcriptDiv.className = 'recording-transcript';
            rec.transcript.forEach(entry => {
                const line = document.createElement('div');
                line.className = `transcript-line ${entry.role === 'user' ? 'transcript-user' : 'transcript-char'}`;
                const label = entry.role === 'user' ? '我' : rec.charName;
                line.innerHTML = `<span class="transcript-label">${label}:</span> ${entry.text}`;
                transcriptDiv.appendChild(line);
            });
            item.append(playBtn, info, transcriptDiv);
        } else {
            item.append(playBtn, info);
        }
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'recording-actions';
        const downloadBtn = document.createElement('button');
        downloadBtn.className = 'recording-download';
        downloadBtn.innerHTML = '<i class="fas fa-download"></i>';
        downloadBtn.addEventListener('click', () => downloadRecording(rec));
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'recording-delete';
        deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
        deleteBtn.addEventListener('click', async () => {
            if (confirm('確定刪除此錄音？')) {
                await deleteRecording(rec.id);
                renderRecordings(container);
            }
        });
        actionsDiv.append(downloadBtn, deleteBtn);
        item.appendChild(actionsDiv);
        list.appendChild(item);
    });
}

function switchTab(tab, container) {
    currentTab = tab;
    container.querySelectorAll('.phone-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
    container.querySelectorAll('.tab-panel').forEach(p => p.classList.toggle('active', p.id === `${tab}-tab`));
    if (tab === 'recordings') {
        renderRecordings(container);
    }
}

function bindKeypad(container) {
    const keypad = container.querySelector('#keypad');
    if (!keypad) return;
    const longPressTimers = new WeakMap();
    const longPressState = new WeakMap();
    const startTimer = (button, event) => {
        if (event.type === 'touchstart') event.preventDefault();
        if (!button.dataset.alt) return;
        clearTimer(button);
        const timer = window.setTimeout(() => {
            appendDigit(button.dataset.alt, container);
            longPressState.set(button, true);
        }, 550);
        longPressTimers.set(button, timer);
    };
    const clearTimer = (button) => {
        const timer = longPressTimers.get(button);
        if (timer) {
            clearTimeout(timer);
            longPressTimers.delete(button);
        }
    };
    const endPress = (button) => {
        clearTimer(button);
    };
    keypad.querySelectorAll('.key[data-value]').forEach(button => {
        button.addEventListener('mousedown', (event) => startTimer(button, event));
        button.addEventListener('touchstart', (event) => startTimer(button, event), { passive: false });
        ['mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => {
            button.addEventListener(evt, () => endPress(button));
        });
        button.addEventListener('click', (event) => {
            event.preventDefault();
            const usedAlt = longPressState.get(button);
            if (usedAlt) {
                longPressState.delete(button);
                return;
            }
            appendDigit(button.dataset.value || '', container);
        });
    });
}

function bindEvents(container) {
    container.querySelector('#call-button')?.addEventListener('click', () => simulateCall(container));
    container.querySelector('#backspace')?.addEventListener('click', () => eraseDigit(container));
    container.querySelector('#hold-button')?.addEventListener('click', () => {
        appendDigit(',', container);
        setStatus('已插入暫停符號', container);
    });
    container.querySelector('#save-contact')?.addEventListener('click', () => saveContact(container));
    container.querySelector('#clear-number')?.addEventListener('click', () => clearNumber(container));
    container.querySelector('#history-clear')?.addEventListener('click', () => clearHistory(container));
    container.querySelector('#favorite-shuffle')?.addEventListener('click', () => shuffleFavorites(container));
    container.querySelector('#toggle-silent')?.addEventListener('click', () => {
        state.silent = !state.silent;
        const btn = container.querySelector('#toggle-silent');
        btn.setAttribute('aria-pressed', state.silent ? 'true' : 'false');
        btn.textContent = state.silent ? '🔕' : '🔔';
        setStatus(state.silent ? '已啟用靜音' : '已恢復鈴聲', container);
        updateConnectionStatus(container);
    });
    container.querySelectorAll('.phone-tab').forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab, container));
    });
    container.querySelector('#clear-recordings')?.addEventListener('click', async () => {
        if (confirm('確定清除所有錄音？此操作無法復原。')) {
            await clearAllRecordings();
            renderRecordings(container);
            setStatus('已清除所有錄音', container);
        }
    });
    const keyHandler = (event) => {
        if (/^Digit\d$/.test(event.code) || /^Numpad\d$/.test(event.code)) {
            appendDigit(event.key, container);
            return;
        }
        if (event.key === '+' || event.key === '*' || event.key === '#') {
            appendDigit(event.key, container);
            return;
        }
        if (event.key === 'Backspace') {
            eraseDigit(container);
            return;
        }
        if (event.key === 'Enter') {
            simulateCall(container);
        }
    };
    document.addEventListener('keydown', keyHandler);
    return () => document.removeEventListener('keydown', keyHandler);
}

async function renderPhone() {
    const container = createElement('div', 'app-container phone-app');

    historyEntries = await loadHistory();

    container.innerHTML = `
        <header class="ios-header">
            <button class="ios-back-btn">
                <i class="fas fa-chevron-left"></i> 返回
            </button>
            <h1 class="menu-title">電話</h1>
            <div class="header-actions">
                <button class="icon-btn" id="toggle-silent" aria-pressed="false">🔔</button>
            </div>
        </header>

        <div class="phone-tabs">
            <button class="phone-tab active" data-tab="keypad">鍵盤</button>
            <button class="phone-tab" data-tab="history">紀錄</button>
            <button class="phone-tab" data-tab="favorites">常用</button>
            <button class="phone-tab" data-tab="recordings">錄音</button>
        </div>

        <div class="tab-panel active" id="keypad-tab">
            <div class="call-display">
                <div class="dialed-number muted" id="dialed-number">輸入號碼</div>
                <p class="status-banner" id="status-banner"></p>
                <div class="call-actions">
                    <button class="ghost-btn" id="hold-button">暫停 ,</button>
                    <button class="ghost-btn" id="save-contact">加入常用</button>
                    <button class="ghost-btn ghost-danger" id="clear-number">清除</button>
                </div>
            </div>

            <div class="keypad" id="keypad">
                <button class="key" data-value="1" data-alt=""><span>1</span><small>&nbsp;</small></button>
                <button class="key" data-value="2" data-alt="A"><span>2</span><small>ABC</small></button>
                <button class="key" data-value="3" data-alt="D"><span>3</span><small>DEF</small></button>
                <button class="key" data-value="4" data-alt="G"><span>4</span><small>GHI</small></button>
                <button class="key" data-value="5" data-alt="J"><span>5</span><small>JKL</small></button>
                <button class="key" data-value="6" data-alt="M"><span>6</span><small>MNO</small></button>
                <button class="key" data-value="7" data-alt="P"><span>7</span><small>PQRS</small></button>
                <button class="key" data-value="8" data-alt="T"><span>8</span><small>TUV</small></button>
                <button class="key" data-value="9" data-alt="W"><span>9</span><small>WXYZ</small></button>
                <button class="key action" data-value="*" data-alt=""><span>*</span></button>
                <button class="key" data-value="0" data-alt="+"><span>0</span><small>+</small></button>
                <button class="key action" data-value="#" data-alt=""><span>#</span></button>
            </div>

            <div class="keypad-actions">
                <button class="key call" id="call-button"><i class="fas fa-phone"></i></button>
                <button class="key action" id="backspace"><i class="fas fa-backspace"></i></button>
            </div>

            <p class="status-line" id="connection-status">4G · 85%</p>
        </div>

        <div class="tab-panel" id="history-tab">
            <div class="call-history">
                <div class="history-header">
                    <h2>通話紀錄</h2>
                    <button class="ghost-btn ghost-sm ghost-danger" id="history-clear">清除</button>
                </div>
                <ul class="history-list" id="history-list"></ul>
            </div>
        </div>

        <div class="tab-panel" id="favorites-tab">
            <div class="favorite-strip">
                <div class="favorite-header">
                    <h2>常用聯絡人</h2>
                    <button class="ghost-btn ghost-sm" id="favorite-shuffle">隨機排序</button>
                </div>
                <div class="favorite-grid" id="favorite-grid"></div>
            </div>
        </div>

        <div class="tab-panel" id="recordings-tab">
            <div class="recordings-header">
                <h2>通話錄音</h2>
                <button class="clear-recordings-btn" id="clear-recordings">清除全部</button>
            </div>
            <ul class="recordings-list" id="recordings-list"></ul>
        </div>
    `;

    const backBtn = container.querySelector('.ios-back-btn');
    backBtn.onclick = () => Router.navigate('/');

    renderFavorites(container);
    renderHistory(container);
    updateDialedNumber(container);
    updateConnectionStatus(container);
    bindKeypad(container);
    const cleanupKeyHandler = bindEvents(container);

    const connInterval = setInterval(() => updateConnectionStatus(container), 15000);

    return {
        element: container,
        cleanup: () => {
            clearInterval(connInterval);
            if (cleanupKeyHandler) cleanupKeyHandler();
            if (currentAudio) {
                currentAudio.pause();
                currentAudio = null;
            }
        }
    };
}

export default {
    id: 'phone',
    name: '電話',
    icon: 'phone',
    routes: [{ path: '/phone', render: renderPhone }],
    navItem: { label: '電話', icon: 'phone', path: '/phone', showInNav: true, order: 20 },
    styles: () => import('./style.css')
};
