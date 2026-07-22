import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

const CONFIG_KEY = 'pomodoro_config';
const COMPLETED_KEY = 'pomodoro_completed';

const defaultConfig = {
    focus: 25,
    short: 5,
    long: 15,
    longGap: 4,
    companionInterval: 5,
    companionCharId: null
};

let config = { ...defaultConfig };
let mode = 'focus';
let remaining = 25 * 60;
let timerId = null;
let running = false;
let completed = 0;
let cycle = 1;
let companionTimer = null;
let currentCompanion = null;
let isGeneratingMessage = false;
let chatMessages = [];
const MAX_CHAT_MESSAGES = 10;

async function loadConfig() {
    try {
        const data = await SettingsDB.get(CONFIG_KEY);
        return data ? { ...defaultConfig, ...data } : { ...defaultConfig };
    } catch {
        return { ...defaultConfig };
    }
}

async function saveConfig(cfg) {
    await SettingsDB.set(CONFIG_KEY, cfg);
}

async function loadCompleted() {
    try {
        const data = await SettingsDB.get(COMPLETED_KEY);
        return parseInt(data, 10) || 0;
    } catch {
        return 0;
    }
}

async function saveCompleted(val) {
    await SettingsDB.set(COMPLETED_KEY, String(val));
}

async function getCharConfig() {
    const savedId = config.companionCharId;
    if (savedId) {
        const char = await CharactersDB.getById(savedId);
        if (char) {
            return {
                id: char.id,
                name: char.name,
                personality: char.personality || '',
                background: char.description || '',
                avatar: char.avatar || ''
            };
        }
    }
    
    const activeCharName = await SettingsDB.get('sx_char_name');
    if (activeCharName) {
        const chars = await CharactersDB.getAll();
        const found = chars.find(c => c.name === activeCharName);
        if (found) {
            return {
                id: found.id,
                name: found.name,
                personality: found.personality || '',
                background: found.description || '',
                avatar: found.avatar || ''
            };
        }
    }
    
    return { id: 'default', name: 'AI 夥伴', personality: '', background: '', avatar: '' };
}

async function getUserConfig() {
    const name = await SettingsDB.get('sx_user_name') || 'User';
    const personality = await SettingsDB.get('sx_user_personality') || '';
    return { name, personality };
}

async function getApiConfig() {
    const apiUrl = await SettingsDB.get('api_url');
    const apiKey = await SettingsDB.get('api_key');
    const model = await SettingsDB.get('model');
    
    if (!apiUrl) return null;
    
    return {
        url: apiUrl,
        key: apiKey || '',
        model: model || 'gpt-3.5-turbo'
    };
}

function getDefaultEncouragement(charName, userName, phase) {
    const templates = {
        focus: [
            `${userName}加油！專注時間，${charName}陪你一起努力！`,
            `專注中！${userName}做得很好，繼續保持！`,
            `${charName}相信${userName}可以做到！加油！`,
            `專注時間！${userName}再堅持一下！`,
            `${charName}在這裡陪著${userName}，一起加油！`
        ],
        short: [
            `${userName}休息一下！${charName}覺得你做得很好！`,
            `短休時間！${userName}喝口水吧～`,
            `${charName}提醒${userName}休息一下，放鬆眼睛！`,
            `做得好！${userName}稍微休息一下吧！`,
            `${charName}說：${userName}辛苦了，休息一下！`
        ],
        long: [
            `${userName}長休息時間！${charName}覺得你今天很棒！`,
            `做得太棒了！${userName}好好休息一下！`,
            `${charName}恭喜${userName}完成一個循環！休息一下吧！`,
            `太厲害了！${userName}值得好好休息！`,
            `${charName}為${userName}感到驕傲！休息時間到！`
        ]
    };
    const msgs = templates[phase] || templates.focus;
    return msgs[Math.floor(Math.random() * msgs.length)];
}

async function generateAIEncouragement(charConfig, userConfig, phase, elapsedMinutes, remainingMinutes) {
    const apiConfig = await getApiConfig();
    if (!apiConfig || !apiConfig.url) return null;

    const charName = charConfig.name || '角色';
    const charPersonality = charConfig.personality || '';
    const charBackground = charConfig.background || '';
    const userName = userConfig.name || 'User';
    const lang = await SettingsDB.get('sxiphone_lang') || 'zh-TW';
    const phaseDesc = phase === 'focus' ? '專注時間' : phase === 'short' ? '短休息' : '長休息';

    const systemPrompt = `# CHARACTER_PROFILE
## 角色資訊
- 名字: ${charName}
- 性格特質: ${charPersonality || '友善、溫柔'}
- 背景故事: ${charBackground || '無'}

## 角色扮演指南
你現在要扮演 ${charName} 這個角色。請完全沉浸在這個角色中，用角色的視角、語氣和說話方式來生成番茄鐘鼓勵訊息。

# USER_CONTEXT
- 用戶名稱: ${userName}

# RESPONSE_GUIDELINES
1. **角色一致性**: 始終保持 ${charName} 的角色特質，包括說話方式、用詞習慣、情感表達。
2. **語言**: 使用 ${lang} 進行交流。
3. **身分保密**: 絕對不要提及你是 AI 或語言模型。
4. **語氣**: 根據角色性格決定語氣（溫柔/冷淡/活潑/嚴厲等）。
5. **長度**: 簡短自然，15-50字。

輸出格式為 JSON: {"message": "你的鼓勵訊息"}`;

    let contextPrompt = `# 番茄鐘狀態
- 目前階段: ${phaseDesc}
- 已經過時間: ${elapsedMinutes} 分鐘
- 剩餘時間: ${remainingMinutes} 分鐘

請以 ${charName} 的身分，根據上述狀態生成一句鼓勵訊息給 ${userName}。
要求：
1. 必須完全符合角色性格設定
2. 根據階段給出適當的鼓勵（專注時加油、休息時提醒放鬆）
3. 語氣和用詞要符合角色特質
4. 自然親切，像朋友間的提醒`;

    if (phase === 'focus' && remainingMinutes <= 5) {
        contextPrompt += `\n\n注意：專注時間快結束了，可以加強鼓勵${userName}堅持到底。`;
    } else if (phase !== 'focus') {
        contextPrompt += `\n\n注意：這是休息時間，提醒${userName}好好放鬆休息。`;
    }

    try {
        const endpoint = apiConfig.url.endsWith('/chat/completions')
            ? apiConfig.url
            : `${apiConfig.url.replace(/\/$/, '')}/chat/completions`;

        const headers = { 'Content-Type': 'application/json' };
        if (apiConfig.key) {
            headers.Authorization = `Bearer ${apiConfig.key}`;
        }

        const response = await fetch(endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify({
                model: apiConfig.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: contextPrompt }
                ],
                temperature: 0.9,
                max_tokens: 100
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';

        let parsed = null;
        try {
            parsed = JSON.parse(content);
        } catch {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) {
                try {
                    parsed = JSON.parse(match[0]);
                } catch {
                    return content.trim().replace(/^["']|["']$/g, '');
                }
            }
        }

        return parsed?.message || content.trim().replace(/^["']|["']$/g, '');
    } catch {
        return null;
    }
}

function modeLabel(m) {
    return m === 'focus' ? '專注' : m === 'short' ? '短休' : '長休';
}

function format(sec) {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
}

function clampNum(v, min, max) {
    const n = Number(v) || min;
    return Math.min(max, Math.max(min, n));
}

async function loadAvailableCharacters() {
    const chars = [];
    const allChars = await CharactersDB.getAll();
    
    allChars.forEach(c => {
        if (c && c.name) {
            chars.push({
                id: c.id || c.name,
                name: c.name,
                avatar: c.avatar || '',
                personality: c.personality || '',
                background: c.description || ''
            });
        }
    });
    
    if (chars.length === 0) {
        chars.push({ id: 'default', name: 'AI 夥伴', avatar: '', personality: '', background: '' });
    }
    return chars;
}

async function renderPomodoro() {
    const container = createElement('div', 'app-container pomodoro-app');
    
    config = await loadConfig();
    completed = await loadCompleted();
    remaining = config.focus * 60;
    
    const activeCompanion = await getCharConfig();
    currentCompanion = activeCompanion;
    
    container.innerHTML = `
        <header class="ios-header">
            <button class="ios-back-btn">
                <i class="fas fa-chevron-left"></i> 返回
            </button>
            <h1 class="menu-title">番茄鐘</h1>
            <button class="icon-btn ghost" id="settings-btn">
                <i class="fas fa-cog"></i>
            </button>
        </header>

        <div class="page">
            <div class="pomodoro-panel">
                <div class="mode-tabs">
                    <button class="tab active" data-mode="focus">專注</button>
                    <button class="tab" data-mode="short">短休</button>
                    <button class="tab" data-mode="long">長休</button>
                </div>
                <div class="time-display" id="time-display">${format(remaining)}</div>
                <div class="status" id="status">Ready</div>
                <div class="actions">
                    <button class="primary" id="start-btn">開始</button>
                    <button class="ghost secondary" id="reset-btn">重置</button>
                </div>
                <div class="stats">
                    <div class="stat-item">
                        <div class="stat-label">已完成</div>
                        <div class="stat-value" id="completed-count">${completed}</div>
                    </div>
                    <div class="stat-item">
                        <div class="stat-label">循環</div>
                        <div class="stat-value" id="cycle-info">${cycle} / ${config.longGap}</div>
                    </div>
                </div>
            </div>

            <div class="companion-card" id="companion-card">
                <div class="companion-avatar" id="companion-avatar" style="${currentCompanion.avatar ? `background-image: url('${currentCompanion.avatar}')` : 'background: linear-gradient(135deg, #4f8bff, #8ec5ff)'}"></div>
                <div class="companion-body">
                    <div class="companion-name" id="companion-name">${currentCompanion.name}</div>
                    <div class="companion-line" id="companion-line">開始後將定時送上鼓勵</div>
                </div>
                <button class="ghost" id="select-companion-btn" style="font-size: 12px; padding: 6px 10px;">選擇</button>
            </div>

            <div class="companion-chat" id="companion-chat"></div>
        </div>

        <div class="panel hidden" id="settings-panel">
            <div class="panel-header">
                <span>設定</span>
                <button class="ghost" id="close-settings" style="font-size: 12px; padding: 4px 8px;">關閉</button>
            </div>
            <div class="panel-grid">
                <label>專注時間 (分)
                    <input type="number" id="focus-min" value="${config.focus}" min="1" max="90">
                </label>
                <label>短休息 (分)
                    <input type="number" id="short-min" value="${config.short}" min="1" max="30">
                </label>
                <label>長休息 (分)
                    <input type="number" id="long-min" value="${config.long}" min="1" max="60">
                </label>
                <label>長休間隔
                    <input type="number" id="long-gap" value="${config.longGap}" min="1" max="12">
                </label>
                <label>夥伴提醒間隔 (分)
                    <input type="number" id="companion-interval" value="${config.companionInterval}" min="1" max="30">
                </label>
            </div>
            <div class="panel-actions">
                <button class="primary" id="save-settings">儲存</button>
            </div>
        </div>

        <div class="panel hidden" id="companion-select-panel">
            <div class="panel-header">
                <span>選擇夥伴</span>
                <button class="ghost" id="close-companion-select" style="font-size: 12px; padding: 4px 8px;">關閉</button>
            </div>
            <div class="companion-list" id="companion-list"></div>
        </div>

        <div class="companion-dialog-overlay hidden" id="companion-dialog-overlay">
            <div class="companion-dialog">
                <div class="companion-dialog-header">
                    <div class="companion-dialog-avatar" id="companion-dialog-avatar"></div>
                    <div class="companion-dialog-name" id="companion-dialog-name"></div>
                </div>
                <div class="companion-dialog-text" id="companion-dialog-text"></div>
                <input type="text" class="companion-dialog-input" id="companion-dialog-input" placeholder="回覆...">
            </div>
        </div>
    `;

    const timeDisplay = container.querySelector('#time-display');
    const statusEl = container.querySelector('#status');
    const startBtn = container.querySelector('#start-btn');
    const resetBtn = container.querySelector('#reset-btn');
    const tabs = container.querySelectorAll('.mode-tabs .tab');
    const completedEl = container.querySelector('#completed-count');
    const cycleInfoEl = container.querySelector('#cycle-info');
    const companionLine = container.querySelector('#companion-line');
    const companionAvatar = container.querySelector('#companion-avatar');
    const companionName = container.querySelector('#companion-name');
    const companionChat = container.querySelector('#companion-chat');

    function updateDisplay() {
        timeDisplay.textContent = format(remaining);
        completedEl.textContent = completed;
        cycleInfoEl.textContent = `${cycle} / ${config.longGap}`;
    }

    function setMode(next) {
        mode = next;
        tabs.forEach(tab => tab.classList.toggle('active', tab.dataset.mode === mode));
        const mins = config[mode];
        remaining = mins * 60;
        updateDisplay();
        statusEl.textContent = modeLabel(mode) + ' ready';
    }

    function tick() {
        if (!running) return;
        if (remaining <= 0) {
            nextStage();
            return;
        }
        remaining -= 1;
        updateDisplay();
    }

    function start() {
        if (running) return pause();
        running = true;
        startBtn.textContent = '暫停';
        statusEl.textContent = modeLabel(mode) + ' 中';
        timerId = setInterval(tick, 1000);
        startCompanion();
    }

    function pause() {
        running = false;
        startBtn.textContent = '開始';
        statusEl.textContent = '已暫停';
        clearInterval(timerId);
        stopCompanion();
    }

    function reset() {
        pause();
        setMode(mode);
        statusEl.textContent = 'Ready';
    }

    function nextStage() {
        pause();
        if (mode === 'focus') {
            completed += 1;
            saveCompleted(completed);
            if (completed % config.longGap === 0) {
                mode = 'long';
                cycle = 1;
            } else {
                mode = 'short';
                cycle = (cycle % config.longGap) + 1;
            }
        } else {
            mode = 'focus';
        }
        setMode(mode);
        statusEl.textContent = modeLabel(mode) + ' ready';
    }

    function getActiveMask() {
        if (currentCompanion) {
            return {
                name: currentCompanion.name,
                avatar: currentCompanion.avatar || '',
                personality: currentCompanion.personality || '',
                background: currentCompanion.background || ''
            };
        }
        return { name: 'AI 夥伴', avatar: '', personality: '', background: '' };
    }

    function showCompanionCard() {
        const mask = getActiveMask();
        companionName.textContent = mask.name || 'AI 夥伴';
        if (mask.avatar) {
            companionAvatar.style.backgroundImage = `url('${mask.avatar}')`;
        } else {
            companionAvatar.style.backgroundImage = 'linear-gradient(135deg,#4f8bff,#8ec5ff)';
        }
        companionLine.textContent = '開始後將定時送上鼓勵';
    }

    function addChatMessage(text, isCompanion = true) {
        chatMessages.push({ text, isCompanion, time: Date.now() });
        if (chatMessages.length > MAX_CHAT_MESSAGES) {
            chatMessages.shift();
        }
        renderChatMessages();
    }

    function renderChatMessages() {
        companionChat.innerHTML = '';
        chatMessages.forEach(msg => {
            const div = document.createElement('div');
            div.className = `chat-msg ${msg.isCompanion ? 'companion' : 'user'}`;
            div.textContent = msg.text;
            companionChat.appendChild(div);
        });
        companionChat.scrollTop = companionChat.scrollHeight;
    }

    function showCompanionDialog(text) {
        const mask = getActiveMask();
        const dialogOverlay = container.querySelector('#companion-dialog-overlay');
        const dialogAvatar = container.querySelector('#companion-dialog-avatar');
        const dialogName = container.querySelector('#companion-dialog-name');
        const dialogText = container.querySelector('#companion-dialog-text');
        const dialogInput = container.querySelector('#companion-dialog-input');

        dialogName.textContent = mask.name || 'AI 夥伴';
        if (mask.avatar) {
            dialogAvatar.style.backgroundImage = `url('${mask.avatar}')`;
        } else {
            dialogAvatar.style.backgroundImage = 'linear-gradient(135deg,#4f8bff,#8ec5ff)';
        }
        dialogText.textContent = text;

        addChatMessage(text, true);

        dialogOverlay.classList.remove('hidden');
        dialogOverlay.classList.add('show');

        if (dialogInput) {
            dialogInput.value = '';
            dialogInput.focus();
        }

        setTimeout(() => {
            dialogOverlay.classList.remove('show');
            setTimeout(() => dialogOverlay.classList.add('hidden'), 300);
        }, 8000);
    }

    async function pushCompanionLine() {
        if (isGeneratingMessage) return;
        isGeneratingMessage = true;

        const charConfig = await getCharConfig();
        const userConfig = await getUserConfig();

        const totalSeconds = config[mode] * 60;
        const elapsedSeconds = totalSeconds - remaining;
        const elapsedMinutes = Math.floor(elapsedSeconds / 60);
        const remainingMinutes = Math.ceil(remaining / 60);

        let message = await generateAIEncouragement(charConfig, userConfig, mode, elapsedMinutes, remainingMinutes);

        if (!message) {
            message = getDefaultEncouragement(charConfig.name, userConfig.name, mode);
        }

        if (message) {
            showCompanionDialog(message);
        }

        isGeneratingMessage = false;
    }

    function startCompanion() {
        stopCompanion();
        companionTimer = setInterval(pushCompanionLine, (config.companionInterval || 5) * 60 * 1000);
        setTimeout(pushCompanionLine, 2000);
    }

    function stopCompanion() {
        if (companionTimer) clearInterval(companionTimer);
        companionTimer = null;
    }

    async function generateAIResponse(charConfig, userConfig, userMessage) {
        const apiConfig = await getApiConfig();
        if (!apiConfig || !apiConfig.url) return null;

        const charName = charConfig.name || '角色';
        const charPersonality = charConfig.personality || '';
        const userName = userConfig.name || 'User';
        const lang = await SettingsDB.get('sxiphone_lang') || 'zh-TW';

        const systemPrompt = `# CHARACTER_PROFILE
- 名字: ${charName}
- 性格特質: ${charPersonality || '友善、溫柔'}

你是 ${charName}，正在陪伴 ${userName} 使用番茄鐘專注。
用角色特有的語氣和方式回應用戶，保持角色一致性。
輸出 JSON: {"message": "回應內容"}`;

        try {
            const endpoint = apiConfig.url.endsWith('/chat/completions')
                ? apiConfig.url
                : `${apiConfig.url.replace(/\/$/, '')}/chat/completions`;

            const headers = { 'Content-Type': 'application/json' };
            if (apiConfig.key) headers.Authorization = `Bearer ${apiConfig.key}`;

            const response = await fetch(endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: apiConfig.model || 'gpt-3.5-turbo',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: userMessage }
                    ],
                    temperature: 0.9,
                    max_tokens: 80
                })
            });

            if (!response.ok) return null;
            const data = await response.json();
            const content = data.choices?.[0]?.message?.content || '';

            try {
                return JSON.parse(content).message;
            } catch {
                const match = content.match(/\{[\s\S]*\}/);
                if (match) {
                    try { return JSON.parse(match[0]).message; } catch {}
                }
                return content.trim().replace(/^["']|["']$/g, '').slice(0, 60);
            }
        } catch {
            return null;
        }
    }

    async function renderCompanionList() {
        const companionList = container.querySelector('#companion-list');
        const chars = await loadAvailableCharacters();
        companionList.innerHTML = '';
        chars.forEach(char => {
            const item = document.createElement('div');
            item.className = 'companion-select-item';
            if (currentCompanion && currentCompanion.id === char.id) {
                item.classList.add('selected');
            }
            item.innerHTML = `
                <div class="companion-select-avatar" style="${char.avatar ? `background-image:url('${char.avatar}')` : 'background:linear-gradient(135deg,#4f8bff,#8ec5ff)'}"></div>
                <div class="companion-select-name">${char.name}</div>
            `;
            item.addEventListener('click', async () => {
                currentCompanion = {
                    id: char.id,
                    name: char.name,
                    avatar: char.avatar,
                    personality: char.personality,
                    background: char.background
                };
                config.companionCharId = char.id;
                await saveConfig(config);
                showCompanionCard();
                container.querySelector('#companion-select-panel').classList.add('hidden');
            });
            companionList.appendChild(item);
        });
    }

    const backBtn = container.querySelector('.ios-back-btn');
    backBtn.onclick = () => Router.navigate('/');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            pause();
            setMode(tab.dataset.mode || 'focus');
        });
    });

    startBtn.addEventListener('click', start);
    resetBtn.addEventListener('click', reset);

    const settingsBtn = container.querySelector('#settings-btn');
    const settingsPanel = container.querySelector('#settings-panel');
    const closeSettings = container.querySelector('#close-settings');
    const saveSettingsBtn = container.querySelector('#save-settings');
    const focusMinInput = container.querySelector('#focus-min');
    const shortMinInput = container.querySelector('#short-min');
    const longMinInput = container.querySelector('#long-min');
    const longGapInput = container.querySelector('#long-gap');
    const companionIntervalInput = container.querySelector('#companion-interval');

    settingsBtn.addEventListener('click', () => settingsPanel.classList.remove('hidden'));
    closeSettings.addEventListener('click', () => settingsPanel.classList.add('hidden'));

    saveSettingsBtn.addEventListener('click', async () => {
        config = {
            ...config,
            focus: clampNum(focusMinInput.value, 1, 90),
            short: clampNum(shortMinInput.value, 1, 30),
            long: clampNum(longMinInput.value, 1, 60),
            longGap: clampNum(longGapInput.value, 1, 12),
            companionInterval: clampNum(companionIntervalInput.value, 1, 30)
        };
        await saveConfig(config);
        pause();
        setMode('focus');
        settingsPanel.classList.add('hidden');
        createToast('設定已儲存', 'success');
    });

    const selectCompanionBtn = container.querySelector('#select-companion-btn');
    const companionSelectPanel = container.querySelector('#companion-select-panel');
    const closeCompanionSelect = container.querySelector('#close-companion-select');

    selectCompanionBtn.addEventListener('click', async () => {
        await renderCompanionList();
        companionSelectPanel.classList.remove('hidden');
    });
    closeCompanionSelect.addEventListener('click', () => {
        companionSelectPanel.classList.add('hidden');
    });

    const dialogInput = container.querySelector('#companion-dialog-input');
    dialogInput.addEventListener('keydown', async (e) => {
        if (e.key === 'Enter' && dialogInput.value.trim()) {
            const userMsg = dialogInput.value.trim();
            addChatMessage(userMsg, false);
            dialogInput.value = '';

            const charConfig = await getCharConfig();
            const userConfig = await getUserConfig();

            let response = await generateAIResponse(charConfig, userConfig, userMsg);

            if (!response) {
                const responses = ['加油！繼續保持！', '你做得很棒！', '專注得很好！', '再堅持一下！', '太棒了！'];
                response = responses[Math.floor(Math.random() * responses.length)];
            }

            setTimeout(() => {
                addChatMessage(response, true);
            }, 800);
        }
    });

    const dialogOverlay = container.querySelector('#companion-dialog-overlay');
    dialogOverlay.addEventListener('click', (e) => {
        if (e.target === dialogOverlay) {
            dialogOverlay.classList.remove('show');
            setTimeout(() => dialogOverlay.classList.add('hidden'), 300);
        }
    });

    const savePomodoroData = async () => {
        try {
            await SettingsDB.set(CONFIG_KEY, config);
            await SettingsDB.set(COMPLETED_KEY, String(completed));
        } catch (e) {
            console.warn('[pomodoro] 保存數據失敗:', e);
        }
    };

    window.addEventListener('pagehide', savePomodoroData);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') savePomodoroData();
    });
    window.addEventListener('message', (event) => {
        if (event.data?.type === 'APP_WILL_CLOSE') savePomodoroData();
    });

    Router.beforeLeave(async () => {
        await savePomodoroData();
        return true;
    });

    updateDisplay();

    return {
        element: container,
        cleanup: () => {
            if (timerId) clearInterval(timerId);
            if (companionTimer) clearInterval(companionTimer);
        }
    };
}

export default {
    id: 'pomodoro',
    name: '番茄鐘',
    icon: 'timer',
    routes: [{ path: '/pomodoro', render: renderPomodoro }],
    navItem: { label: '番茄鐘', icon: 'timer', path: '/pomodoro', showInNav: true, order: 30 },
    styles: () => import('./style.css')
};
