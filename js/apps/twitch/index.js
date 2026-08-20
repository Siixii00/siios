import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { CharactersDB, SettingsDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';

const streamThumbnailColors = [
    ['#9146FF', '#772CE8'],
    ['#FF6B9D', '#C850C0'],
    ['#00D4FF', '#7B2FF7'],
    ['#FF4757', '#FF6B81'],
    ['#00C9FF', '#92FE9D'],
    ['#FC466B', '#3F5EFB']
];

let state = {
    currentCategory: 'all',
    currentTab: 'home',
    currentStream: null,
    isFollowing: false,
    carouselIndex: 0,
    sidebarOpen: false,
    searchOpen: false,
    streamPageOpen: false,
    isPlaying: false,
    chatGenerationInterval: null,
    customCategories: [],
    characters: [],
    currentCharacterId: null,
    chatMessages: [],
    liveStreams: [],
    followers: [],
    suggestedStreams: []
};

function formatViewers(num) {
    if (num >= 10000) return (num / 10000).toFixed(1) + '萬';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function generateThumbnail() {
    const colors = streamThumbnailColors[Math.floor(Math.random() * streamThumbnailColors.length)];
    const patterns = [
        `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(45deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
        `radial-gradient(circle at 30% 30%, ${colors[0]}, ${colors[1]})`,
        `radial-gradient(circle at 70% 70%, ${colors[0]}, ${colors[1]})`
    ];
    return patterns[Math.floor(Math.random() * patterns.length)];
}

function randomViewers() {
    const values = [128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768];
    return values[Math.floor(Math.random() * values.length)];
}

async function loadCharacters() {
    try {
        const chars = await CharactersDB.getAll();
        state.characters = chars || [];
        if (!state.currentCharacterId && state.characters.length > 0) {
            state.currentCharacterId = state.characters[0].id;
        }
    } catch (e) {
        state.characters = [];
    }
}

async function generateStreamTitle(character) {
    const settings = await SettingsDB.getAll();
    
    if (!settings.api_url || !settings.api_key) {
        return `${character?.name || '主播'}的直播時間！`;
    }

    const context = await buildAppContext({ characterId: character?.id });
    const systemPrompt = context.systemPrompt + `\n\n你是一個Twitch直播標題生成系統。根據角色設定生成吸引人的直播標題。
返回格式（純文字，只要一個標題，不要引號）：
一個簡短有力的直播標題（20字以內）`;

    const userPrompt = `角色名稱：${character?.name || '主播'}
角色性格：${character?.personality || '一般主播'}
請生成一個符合角色風格的直播標題。`;

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.9,
                max_tokens: 50
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
        return null;
    }
}

async function generateChatMessage(character, context) {
    const settings = await SettingsDB.getAll();
    
    if (!settings.api_url || !settings.api_key) {
        const fallbackMessages = [
            '好看！', '加油！', '太強了', '哈囉！', '初次見面',
            '推推', '太神了', '學到了', '哈哈哈', '牛逼'
        ];
        return fallbackMessages[Math.floor(Math.random() * fallbackMessages.length)];
    }

    const appContext = await buildAppContext({ characterId: character?.id });
    const systemPrompt = appContext.systemPrompt + `\n\n你是一個Twitch聊天室觀眾。根據角色設定生成真實的聊天訊息。
返回格式（純文字，只要一則留言）：
一則簡短的聊天室留言（30字以內）`;

    const userPrompt = `角色名稱：${character?.name || '觀眾'}
角色性格：${character?.personality || '一般觀眾'}
直播情境：${context || '正在觀看直播'}
請生成一則符合角色風格的聊天留言。`;

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.95,
                max_tokens: 60
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
        return null;
    }
}

async function generateStreamerResponse(character, viewerMessage) {
    const settings = await SettingsDB.getAll();
    
    if (!settings.api_url || !settings.api_key) {
        const fallbackResponses = [
            '謝謝支持！', '太感謝了！', '你們最棒了', '愛你們！', '哈哈謝啦'
        ];
        return fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)];
    }

    const context = await buildAppContext({ characterId: character?.id });
    const systemPrompt = context.systemPrompt + `\n\n你是正在直播的主播。根據角色設定回應觀眾的留言。
返回格式（純文字，只要一則回應）：
一則簡短自然的直播回應（50字以內）`;

    const userPrompt = `主播名稱：${character?.name || '主播'}
主播性格：${character?.personality || '一般主播'}
觀眾留言：${viewerMessage}
請以主播身份回應這則留言。`;

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.9,
                max_tokens: 100
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (e) {
        return null;
    }
}

function createCharacterSelector() {
    const container = createElement('div', 'twitch-char-selector');
    
    const label = createElement('span', 'twitch-char-label', { textContent: '選擇角色：' });
    container.appendChild(label);
    
    const select = createElement('select', 'twitch-char-select');
    select.innerHTML = '<option value="">-- 選擇角色 --</option>';
    
    state.characters.forEach(char => {
        const option = createElement('option', '', { 
            value: char.id, 
            textContent: char.name || '未命名' 
        });
        if (char.id === state.currentCharacterId) {
            option.selected = true;
        }
        select.appendChild(option);
    });
    
    select.onchange = (e) => {
        state.currentCharacterId = e.target.value || null;
    };
    
    container.appendChild(select);
    return container;
}

function createStreamCard(stream, onClick) {
    const card = createElement('article', 'twitch-stream-card');
    
    const thumb = createElement('div', 'twitch-stream-thumb');
    thumb.style.background = stream.thumbGradient || generateThumbnail();
    
    const liveBadge = createElement('span', 'twitch-live-badge', { textContent: 'LIVE' });
    thumb.appendChild(liveBadge);
    
    const viewerBadge = createElement('span', 'twitch-viewer-badge', { 
        textContent: `${formatViewers(stream.viewers)} 觀眾` 
    });
    thumb.appendChild(viewerBadge);
    
    const body = createElement('div', 'twitch-stream-body');
    
    const avatar = createElement('div', 'twitch-stream-avatar');
    if (stream.avatar) {
        avatar.style.backgroundImage = `url(${stream.avatar})`;
    }
    body.appendChild(avatar);
    
    const info = createElement('div', 'twitch-stream-info');
    const title = createElement('div', 'twitch-stream-title', { textContent: stream.title });
    const streamer = createElement('div', 'twitch-stream-name', { textContent: stream.streamer });
    const game = createElement('div', 'twitch-stream-game', { textContent: stream.game || 'Just Chatting' });
    
    info.appendChild(title);
    info.appendChild(streamer);
    info.appendChild(game);
    body.appendChild(info);
    
    card.appendChild(thumb);
    card.appendChild(body);
    
    card.onclick = () => onClick(stream);
    
    return card;
}

function createChatMessage(msg, isStreamer = false) {
    const container = createElement('div', `twitch-chat-msg ${isStreamer ? 'streamer' : ''}`);
    
    const author = createElement('span', 'twitch-chat-author', { 
        textContent: msg.author,
        style: `color: ${msg.color || getRandomChatColor()}`
    });
    
    const text = createElement('span', 'twitch-chat-text', { textContent: `: ${msg.text}` });
    
    container.appendChild(author);
    container.appendChild(text);
    
    return container;
}

function getRandomChatColor() {
    const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function createTwitchBottomNav() {
    const nav = createElement('footer', 'twitch-bottombar');
    
    const items = [
        { icon: 'home', label: '首頁', path: '/twitch' },
        { icon: 'explore', label: '探索', path: '/twitch/explore' },
        { icon: 'follow', label: '追隨', path: '/twitch/following' },
        { icon: 'person', label: '我的', path: '/twitch/profile' }
    ];
    
    items.forEach(item => {
        const btn = createElement('button', 'twitch-nav-btn');
        btn.appendChild(createIcon(item.icon, 'text-xl'));
        btn.appendChild(createElement('span', 'text-xs', { textContent: item.label }));
        btn.onclick = () => Router.navigate(item.path);
        nav.appendChild(btn);
    });
    
    return nav;
}

async function generateLivestreams(count = 8) {
    const streams = [];
    const games = ['Just Chatting', 'League of Legends', 'Valorant', 'Minecraft', 'Apex Legends', 'Genshin Impact', 'Fortnite', 'GTA V'];
    
    for (let i = 0; i < count; i++) {
        const char = state.characters[i % state.characters.length] || null;
        
        let title = char?.name ? `${char.name}的直播時間！` : `精彩直播 ${i + 1}`;
        
        if (char && state.currentCharacterId === char.id) {
            const aiTitle = await generateStreamTitle(char);
            if (aiTitle) title = aiTitle;
        }
        
        streams.push({
            id: `stream_${Date.now()}_${i}`,
            title,
            streamer: char?.name || `主播${i + 1}`,
            game: games[Math.floor(Math.random() * games.length)],
            viewers: randomViewers(),
            thumbGradient: generateThumbnail(),
            avatar: char?.avatar || '',
            characterId: char?.id || null
        });
    }
    
    return streams;
}

async function renderHome() {
    const container = createElement('div', 'twitch-app');
    
    const header = createIOSNavBar({
        title: 'twitch',
        largeTitle: false,
        backPath: '/home',
        rightActions: [
            { icon: 'search', onClick: () => {} },
            { icon: 'notifications', onClick: () => Router.navigate('/twitch/notifications') }
        ]
    });
    header.classList.add('twitch-header');
    container.appendChild(header);
    
    const charSelector = createCharacterSelector();
    container.appendChild(charSelector);
    
    const categories = createElement('div', 'twitch-categories');
    const categoryList = ['全部', '遊戲', '聊天', '音樂', '創作', '戶外'];
    categoryList.forEach((cat, i) => {
        const btn = createElement('button', `twitch-cat-btn ${i === 0 ? 'active' : ''}`, { textContent: cat });
        btn.onclick = () => {
            container.querySelectorAll('.twitch-cat-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
        categories.appendChild(btn);
    });
    container.appendChild(categories);
    
    const main = createElement('main', 'twitch-main');
    
    const section = createElement('section', 'twitch-section');
    section.appendChild(createElement('div', 'twitch-section-title', { textContent: '為你推薦' }));
    
    const feed = createElement('div', 'twitch-feed');
    
    if (state.liveStreams.length === 0) {
        state.liveStreams = await generateLivestreams(8);
    }
    
    state.liveStreams.forEach(stream => {
        feed.appendChild(createStreamCard(stream, (s) => {
            Router.navigate(`/twitch/stream/${s.id}/${encodeURIComponent(s.title)}/${encodeURIComponent(s.streamer)}`);
        }));
    });
    
    section.appendChild(feed);
    main.appendChild(section);
    container.appendChild(main);
    
    const nav = createTwitchBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

async function renderStream(params) {
    const streamId = params.id;
    const streamTitle = decodeURIComponent(params.title || '直播');
    const streamerName = decodeURIComponent(params.streamer || '主播');
    
    const character = state.characters.find(c => c.id === state.currentCharacterId);
    
    const container = createElement('div', 'twitch-app twitch-stream-page');
    
    const header = createIOSNavBar({
        title: streamerName,
        backPath: '/twitch',
        rightActions: [
            { icon: 'more_horiz', onClick: () => {} }
        ]
    });
    container.appendChild(header);
    
    const player = createElement('div', 'twitch-player');
    const video = createElement('div', 'twitch-video');
    video.style.background = generateThumbnail();
    
    const playBtn = createElement('button', 'twitch-play-btn');
    playBtn.appendChild(createIcon('play_arrow', 'text-5xl'));
    playBtn.onclick = () => {
        state.isPlaying = !state.isPlaying;
        playBtn.innerHTML = '';
        if (state.isPlaying) {
            playBtn.appendChild(createIcon('pause', 'text-5xl'));
        } else {
            playBtn.appendChild(createIcon('play_arrow', 'text-5xl'));
        }
    };
    video.appendChild(playBtn);
    
    player.appendChild(video);
    container.appendChild(player);
    
    const streamInfo = createElement('div', 'twitch-stream-info-panel');
    
    const titleEl = createElement('div', 'twitch-stream-page-title', { textContent: streamTitle });
    streamInfo.appendChild(titleEl);
    
    const streamerInfo = createElement('div', 'twitch-streamer-info');
    const avatar = createElement('div', 'twitch-streamer-avatar');
    const nameAndGame = createElement('div', 'twitch-streamer-meta');
    nameAndGame.appendChild(createElement('div', 'font-semibold', { textContent: streamerName }));
    nameAndGame.appendChild(createElement('div', 'text-sm opacity-70', { textContent: 'Just Chatting' }));
    streamerInfo.appendChild(avatar);
    streamerInfo.appendChild(nameAndGame);
    
    const followBtn = createElement('button', 'twitch-follow-btn', { textContent: '追隨' });
    followBtn.onclick = () => {
        state.isFollowing = !state.isFollowing;
        followBtn.textContent = state.isFollowing ? '已追隨' : '追隨';
        followBtn.classList.toggle('following', state.isFollowing);
        createToast(state.isFollowing ? '已追隨！' : '已取消追隨');
    };
    streamerInfo.appendChild(followBtn);
    
    streamInfo.appendChild(streamerInfo);
    container.appendChild(streamInfo);
    
    const chatSection = createElement('div', 'twitch-chat-section');
    chatSection.appendChild(createElement('div', 'twitch-chat-header', { textContent: '直播聊天室' }));
    
    const chatMessages = createElement('div', 'twitch-chat-messages');
    chatSection.appendChild(chatMessages);
    
    const chatInput = createElement('div', 'twitch-chat-input-row');
    const input = createElement('input', 'twitch-chat-input', { type: 'text', placeholder: '傳送訊息...' });
    const sendBtn = createElement('button', 'twitch-chat-send');
    sendBtn.appendChild(createIcon('send', 'text-white'));
    
    sendBtn.onclick = async () => {
        const text = input.value.trim();
        if (!text) return;
        
        const msg = createChatMessage({ author: '你', text, color: '#00D4FF' });
        chatMessages.appendChild(msg);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        input.value = '';
        
        if (character) {
            const response = await generateStreamerResponse(character, text);
            if (response) {
                const streamerMsg = createChatMessage({ author: streamerName, text: response, color: '#9146FF' }, true);
                chatMessages.appendChild(streamerMsg);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                if (character?.id) {
                    await saveInteractionMemory({
                        characterId: character.id,
                        sourceApp: 'twitch',
                        sourceType: 'interaction',
                        sourceSubtype: 'social',
                        content: `觀眾: ${text}\n主播: ${response}`,
                        importance: 0.5
                    });
                }
            }
        }
    };
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendBtn.click();
    });
    
    chatInput.appendChild(input);
    chatInput.appendChild(sendBtn);
    chatSection.appendChild(chatInput);
    container.appendChild(chatSection);
    
    if (state.chatGenerationInterval) {
        clearInterval(state.chatGenerationInterval);
    }
    
    state.chatGenerationInterval = setInterval(async () => {
        if (state.characters.length > 0) {
            const randomChar = state.characters[Math.floor(Math.random() * state.characters.length)];
            const message = await generateChatMessage(randomChar, streamTitle);
            if (message) {
                const msg = createChatMessage({ 
                    author: randomChar.name || '觀眾', 
                    text: message 
                });
                chatMessages.appendChild(msg);
                chatMessages.scrollTop = chatMessages.scrollHeight;
                
                if (chatMessages.children.length > 50) {
                    chatMessages.removeChild(chatMessages.firstChild);
                }
            }
        }
    }, 3000 + Math.random() * 5000);
    
    return { 
        element: container, 
        cleanup: () => {
            if (state.chatGenerationInterval) {
                clearInterval(state.chatGenerationInterval);
                state.chatGenerationInterval = null;
            }
        }
    };
}

async function renderExplore() {
    const container = createElement('div', 'twitch-app');
    
    const header = createIOSNavBar({
        title: '探索',
        backPath: '/twitch'
    });
    container.appendChild(header);
    
    const search = createElement('div', 'twitch-search-row');
    const searchBox = createElement('div', 'twitch-search');
    searchBox.appendChild(createIcon('search', 'text-ios-muted'));
    searchBox.appendChild(createElement('input', '', { type: 'text', placeholder: '搜尋直播或頻道' }));
    search.appendChild(searchBox);
    container.appendChild(search);
    
    const main = createElement('main', 'twitch-main');
    
    const gamesSection = createElement('section', 'twitch-section');
    gamesSection.appendChild(createElement('div', 'twitch-section-title', { textContent: '熱門分類' }));
    
    const games = ['Just Chatting', 'League of Legends', 'Valorant', 'Minecraft', 'Genshin Impact'];
    const gamesGrid = createElement('div', 'twitch-games-grid');
    
    games.forEach(game => {
        const card = createElement('div', 'twitch-game-card');
        card.style.background = generateThumbnail();
        card.appendChild(createElement('div', 'twitch-game-name', { textContent: game }));
        gamesGrid.appendChild(card);
    });
    
    gamesSection.appendChild(gamesGrid);
    main.appendChild(gamesSection);
    container.appendChild(main);
    
    const nav = createTwitchBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

async function renderFollowing() {
    const container = createElement('div', 'twitch-app');
    
    const header = createIOSNavBar({
        title: '追隨',
        backPath: '/twitch'
    });
    container.appendChild(header);
    
    const main = createElement('main', 'twitch-main');
    
    if (state.characters.length === 0) {
        const empty = createElement('div', 'twitch-empty');
        empty.appendChild(createIcon('person_add', 'text-5xl opacity-30'));
        empty.appendChild(createElement('div', 'mt-2', { textContent: '尚未追隨任何頻道' }));
        main.appendChild(empty);
    } else {
        const section = createElement('section', 'twitch-section');
        section.appendChild(createElement('div', 'twitch-section-title', { textContent: '已追隨頻道' }));
        
        const list = createElement('div', 'twitch-following-list');
        
        state.characters.forEach(char => {
            const item = createElement('div', 'twitch-following-item');
            const avatar = createElement('div', 'twitch-following-avatar');
            if (char.avatar) {
                avatar.style.backgroundImage = `url(${char.avatar})`;
            }
            const info = createElement('div', 'twitch-following-info');
            info.appendChild(createElement('div', 'font-semibold', { textContent: char.name || '未命名' }));
            info.appendChild(createElement('div', 'text-sm text-ios-muted', { textContent: Math.random() > 0.5 ? '正在直播' : '離線' }));
            
            item.appendChild(avatar);
            item.appendChild(info);
            
            item.onclick = () => {
                state.currentCharacterId = char.id;
                Router.navigate(`/twitch/stream/${char.id}/${encodeURIComponent(char.name)}/${encodeURIComponent(char.name)}`);
            };
            
            list.appendChild(item);
        });
        
        section.appendChild(list);
        main.appendChild(section);
    }
    
    container.appendChild(main);
    
    const nav = createTwitchBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

async function renderProfile() {
    const container = createElement('div', 'twitch-app');
    
    const header = createIOSNavBar({
        title: '我的',
        backPath: '/twitch',
        rightActions: [
            { icon: 'settings', onClick: () => Router.navigate('/settings') }
        ]
    });
    container.appendChild(header);
    
    const profile = createElement('div', 'twitch-profile');
    
    const headerCard = createElement('div', 'twitch-profile-header');
    const avatar = createElement('div', 'twitch-profile-avatar');
    const info = createElement('div', 'twitch-profile-info');
    info.appendChild(createElement('div', 'font-bold text-lg', { textContent: 'Twitch用戶' }));
    info.appendChild(createElement('div', 'text-ios-muted text-sm', { textContent: '@twitch_user' }));
    headerCard.appendChild(avatar);
    headerCard.appendChild(info);
    headerCard.appendChild(createElement('button', 'twitch-ghost-btn', { textContent: '編輯' }));
    profile.appendChild(headerCard);
    
    const stats = createElement('div', 'twitch-profile-stats');
    stats.innerHTML = `
        <div><span class="font-bold">32</span><small>追隨</small></div>
        <div><span class="font-bold">1.2K</span><small>觀看時數</small></div>
        <div><span class="font-bold">8</span><small>收藏</small></div>
    `;
    profile.appendChild(stats);
    
    container.appendChild(profile);
    
    const nav = createTwitchBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

async function renderNotifications() {
    const container = createElement('div', 'twitch-app');
    
    const header = createIOSNavBar({
        title: '通知',
        backPath: '/twitch'
    });
    container.appendChild(header);
    
    const main = createElement('main', 'twitch-main');
    
    const empty = createElement('div', 'twitch-empty');
    empty.appendChild(createIcon('notifications', 'text-5xl opacity-30'));
    empty.appendChild(createElement('div', 'mt-2', { textContent: '暫無新通知' }));
    main.appendChild(empty);
    
    container.appendChild(main);
    
    return { element: container, cleanup: () => {} };
}

export default {
    id: 'twitch',
    name: 'Twitch',
    icon: 'videocam',
    
    async init() {
        await loadCharacters();
        state.liveStreams = await generateLivestreams(8);
    },
    
    routes: [
        { path: '/twitch', render: renderHome },
        { path: '/twitch/explore', render: renderExplore },
        { path: '/twitch/following', render: renderFollowing },
        { path: '/twitch/profile', render: renderProfile },
        { path: '/twitch/notifications', render: renderNotifications },
        { path: '/twitch/stream/:id/:title/:streamer', render: renderStream }
    ],
    
    navItem: {
        label: 'Twitch',
        icon: 'videocam',
        path: '/twitch',
        showInNav: true,
        order: 6
    },
    
    stylesPath: 'js/apps/twitch/style.css'
};
