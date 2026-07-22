import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';

const thumbnailColors = [
    ['#ffd5e5', '#ff8fb1'],
    ['#a8edea', '#fed6e3'],
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7']
];

const danmuPool = [
    '哈哈哈太好笑了', '笑死', 'www', '這段絕了', '前方高能',
    '爺青回', '爺青結', 'awsl', '好可愛', '太強了',
    '淩目', '破防了', '這波操作絕了', '學到了', '臥槽',
    '牛逼', '太神了', '絕絕子', '愛了愛了', '下次一定',
    '下次不一定的', '投幣了', '三連走起', '催更', '快更新',
    '這才是真正的技術', '學廢了', '我好了', '名場面', '經典'
];

const npcNames = [
    '小櫻', '阿明', '美琪', '大偉', '小雪', '阿傑', '小芳', '阿豪',
    '琪琪', '小龍', '阿寶', '小美', '阿強', '小玲', '阿輝', '小君',
    '星空', '月光', '流星', '彩虹', '白雲', '微風', '晨曦', '晚霞'
];

const chatUserNames = [
    '小櫻', '阿明', '美琪', '大偉', '小雪', '阿傑', '小芳', '阿豪',
    '琪琪', '小龍', '阿寶', '小美', '阿強', '小玲', '阿輝', '小君',
    '星空', '月光', '流星', '彩虹', '白雲', '微風', '晨曦', '晚霞'
];

const chatMessageTemplates = {
    received: [
        '你好呀～最近在追什麼番？',
        '那個影片超好看的！',
        '明天要一起看直播嗎？',
        '推薦你一部新番！',
        '你的影片做得好棒！',
        '最近有什麼好看的嗎？',
        '哈哈那個梗太笑了',
        '這週末有空嗎？',
        '我找到一個超讚的MAD',
        '你追的那部番更新了！'
    ],
    sent: [
        '好喔！',
        '真的假的',
        '我看看',
        '不錯耶',
        '推推',
        '好笑死',
        '謝啦',
        '晚點回你',
        '收到',
        'OK'
    ]
};

const notificationTemplates = [
    { type: 'subscribe', icon: 'person_add', title: '新粉絲', templates: ['關注了你', '成為了你的粉絲', '開始追蹤你'] },
    { type: 'like', icon: 'favorite', title: '收穫讚', templates: ['讚了你的影片', '喜歡了你的動態', '給你的評論點讚'] },
    { type: 'comment', icon: 'comment', title: '新留言', templates: ['評論了你的影片', '回覆了你的評論', '在你的影片下留言'] },
    { type: 'at', icon: 'alternate_email', title: '@提醒', templates: ['在評論中提到了你', '在影片中@了你', '邀請你一起觀看'] },
    { type: 'system', icon: 'notifications', title: '系統通知', templates: ['你的影片已通過審核', '會員即將到期', '活動獎勵已發放', '新功能上線通知'] }
];

let appState = {
    currentTab: 'recommend',
    sample: {
        recommend: [],
        anime: [],
        live: [],
        hot: [],
        games: []
    },
    danmuEnabled: true,
    danmuTimer: null,
    currentWatchingChar: null,
    pendingVideoData: null,
    activeNPCs: [],
    charCommentTimer: null,
    currentMsgTab: 'notifications',
    currentChatUser: null,
    chatData: {}
};

function randomPick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function generateThumbnail() {
    const colors = randomPick(thumbnailColors);
    const patterns = [
        `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(45deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
        `radial-gradient(circle at 30% 30%, ${colors[0]}, ${colors[1]})`,
        `radial-gradient(circle at 70% 70%, ${colors[0]}, ${colors[1]})`,
        `conic-gradient(from 90deg, ${colors[0]}, ${colors[1]}, ${colors[0]})`
    ];
    return randomPick(patterns);
}

function randomViews() {
    const values = ['12萬', '38萬', '76萬', '102萬', '188萬', '256萬', '320萬'];
    return randomPick(values);
}

function randomDanmu() {
    const values = ['1,120', '2,580', '6,200', '9,450', '1.3萬', '2.1萬'];
    return randomPick(values);
}

function generateRandomTime() {
    const units = ['分鐘', '小時', '天'];
    const unit = randomPick(units);
    const value = Math.floor(Math.random() * 12) + 1;
    return `${value} ${unit}前`;
}

function convertBilibiliUrl(url) {
    if (!url) return '';
    
    const bvMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i);
    if (bvMatch) {
        return `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    const shortBvMatch = url.match(/b23\.tv\/(BV[a-zA-Z0-9]+)/i);
    if (shortBvMatch) {
        return `https://player.bilibili.com/player.html?bvid=${shortBvMatch[1]}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    const avMatch = url.match(/bilibili\.com\/video\/av(\d+)/i);
    if (avMatch) {
        return `https://player.bilibili.com/player.html?aid=${avMatch[1]}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    const shortAvMatch = url.match(/b23\.tv\/av(\d+)/i);
    if (shortAvMatch) {
        return `https://player.bilibili.com/player.html?aid=${shortAvMatch[1]}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    const shortIdMatch = url.match(/b23\.tv\/([a-zA-Z0-9]+)/i);
    if (shortIdMatch) {
        const id = shortIdMatch[1];
        if (id.startsWith('BV')) {
            return `https://player.bilibili.com/player.html?bvid=${id}&page=1&danmaku=0&high_quality=1&autoplay=1`;
        }
        return `https://player.bilibili.com/player.html?bvid=${id}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    return url;
}

async function loadMessagesData() {
    const data = await SettingsDB.get('bilibili_messages');
    if (data) return data;
    return { notifications: [], chats: [], system: [] };
}

async function saveMessagesData(data) {
    await SettingsDB.set('bilibili_messages', data);
}

async function loadChatData() {
    const data = await SettingsDB.get('bilibili_chats');
    if (data) return data;
    return {};
}

async function saveChatData(data) {
    await SettingsDB.set('bilibili_chats', data);
}

function generateNotifications(count = 8) {
    const notifications = [];
    for (let i = 0; i < count; i++) {
        const template = randomPick(notificationTemplates);
        notifications.push({
            id: `notif_${Date.now()}_${i}`,
            type: template.type,
            icon: template.icon,
            title: template.title,
            desc: `${randomPick(chatUserNames)} ${randomPick(template.templates)}`,
            time: generateRandomTime(),
            read: Math.random() > 0.3
        });
    }
    return notifications;
}

function generateSystemNotifications(count = 5) {
    const systemMessages = [
        { title: '會員提醒', desc: '你的大會員將在 7 天後到期，續費享 9 折優惠！', icon: 'workspace_premium' },
        { title: '創作激勵', desc: '本月創作激勵金已發放，共 ¥128.50', icon: 'payments' },
        { title: '活動通知', desc: '「夏日祭」活動已開始，參與贏取限定頭像框！', icon: 'card_giftcard' },
        { title: '安全提醒', desc: '你的帳號在新裝置登入，如非本人操作請修改密碼', icon: 'shield' },
        { title: '更新通知', desc: 'App 已更新至最新版本，體驗全新功能', icon: 'system_update' },
        { title: '審核通過', desc: '你投稿的影片「夏日VLOG」已通過審核', icon: 'check_circle' },
        { title: '粉絲成就', desc: '恭喜！你的粉絲數突破 1000 大關！', icon: 'groups' }
    ];
    
    return systemMessages.slice(0, count).map((msg, i) => ({
        id: `sys_${Date.now()}_${i}`,
        type: 'system',
        icon: msg.icon,
        title: msg.title,
        desc: msg.desc,
        time: generateRandomTime(),
        read: Math.random() > 0.5
    }));
}

function generateChatUsers(count = 6) {
    const users = [];
    const shuffledNames = [...chatUserNames].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < count; i++) {
        const name = shuffledNames[i];
        users.push({
            id: `user_${Date.now()}_${i}`,
            name,
            avatar: '',
            lastMessage: randomPick(chatMessageTemplates.received),
            time: generateRandomTime(),
            unread: Math.floor(Math.random() * 5)
        });
    }
    return users;
}

function generateChatHistory(userId, count = 10) {
    const messages = [];
    for (let i = 0; i < count; i++) {
        const isReceived = Math.random() > 0.4;
        messages.push({
            id: `msg_${Date.now()}_${i}`,
            type: isReceived ? 'received' : 'sent',
            text: randomPick(isReceived ? chatMessageTemplates.received : chatMessageTemplates.sent),
            time: new Date(Date.now() - (count - i) * 60000 * Math.random() * 30).toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
        });
    }
    return messages.sort((a, b) => new Date(a.time) - new Date(b.time));
}

async function refreshMessages() {
    const data = {
        notifications: generateNotifications(8),
        chats: generateChatUsers(6),
        system: generateSystemNotifications(5)
    };
    await saveMessagesData(data);
    return data;
}

function createVideoCard(video, onPlay) {
    const card = createElement('article', 'bili-video-card');
    
    const thumb = createElement('div', 'bili-thumb');
    thumb.style.background = video.thumb || video.thumbGradient || generateThumbnail();
    
    const tag = createElement('span', 'bili-thumb-tag', { textContent: video.tag });
    thumb.appendChild(tag);
    
    const body = createElement('div', 'bili-video-body');
    
    const title = createElement('div', 'bili-video-title', { textContent: video.title });
    body.appendChild(title);
    
    const meta = createElement('div', 'bili-video-meta');
    const views = createElement('span', '', { textContent: `▶ ${video.views}` });
    const danmu = createElement('span', '', { textContent: `💬 ${video.danmu}` });
    meta.appendChild(views);
    meta.appendChild(danmu);
    body.appendChild(meta);
    
    card.appendChild(thumb);
    card.appendChild(body);
    
    card.onclick = () => onPlay(video);
    
    return card;
}

function createEmptyFeed(onGenerate) {
    const container = createElement('div', 'bili-empty-feed');
    
    const icon = createIcon('play_circle', 'text-6xl opacity-30 text-bili-pink');
    container.appendChild(icon);
    
    const title = createElement('div', 'text-lg font-semibold', { textContent: '尚無影片內容' });
    container.appendChild(title);
    
    const desc = createElement('div', 'text-sm opacity-70', { textContent: '點擊下方按鈕生成影片' });
    container.appendChild(desc);
    
    const btn = createElement('button', 'bili-btn primary', { textContent: '生成影片' });
    btn.onclick = onGenerate;
    container.appendChild(btn);
    
    return container;
}

function createNPCSection(npcs) {
    const section = createElement('div', 'bili-npc-section');
    
    const header = createElement('div', 'bili-npc-header');
    const title = createElement('span', 'bili-npc-title');
    title.appendChild(createIcon('groups', 'text-bili-pink'));
    title.appendChild(createElement('span', '', { textContent: '正在觀看的 NPC' }));
    
    const count = createElement('span', 'bili-npc-count', { textContent: `${npcs.length} 人在看` });
    
    header.appendChild(title);
    header.appendChild(count);
    section.appendChild(header);
    
    const list = createElement('div', 'bili-npc-list');
    
    npcs.forEach(npc => {
        const item = createElement('div', 'bili-npc-item');
        const avatar = createElement('div', 'bili-npc-avatar');
        const name = createElement('span', 'bili-npc-name', { textContent: npc.name });
        item.appendChild(avatar);
        item.appendChild(name);
        list.appendChild(item);
    });
    
    section.appendChild(list);
    return section;
}

function generateNPCs(count = 8) {
    const npcs = [];
    for (let i = 0; i < count; i++) {
        npcs.push({
            id: `npc_${Date.now()}_${i}`,
            name: randomPick(npcNames),
            avatar: '',
            watching: true
        });
    }
    return npcs;
}

async function renderHome() {
    const container = createElement('div', 'bili-app');
    
    const header = createIOSNavBar({
        title: 'bilibili',
        largeTitle: false,
        backPath: '/home',
        rightActions: [
            { icon: 'settings', onClick: () => Router.navigate('/settings') },
            { icon: 'person', onClick: () => Router.navigate('/bilibili/profile') }
        ]
    });
    header.classList.add('bili-header');
    container.appendChild(header);
    
    const searchRow = createElement('div', 'bili-search-row');
    const searchBox = createElement('div', 'bili-search');
    searchBox.appendChild(createIcon('search', 'text-ios-muted'));
    const searchInput = createElement('input', '', { type: 'text', placeholder: '動漫、番劇、直播' });
    searchBox.appendChild(searchInput);
    searchRow.appendChild(searchBox);
    container.appendChild(searchRow);
    
    const tabsBar = createElement('nav', 'bili-tabs');
    const tabs = ['recommend', 'anime', 'live', 'hot', 'games'];
    const tabNames = { recommend: '推薦', anime: '番劇', live: '直播', hot: '熱門', games: '遊戲' };
    
    tabs.forEach(tab => {
        const btn = createElement('button', `bili-tab ${tab === appState.currentTab ? 'active' : ''}`, { textContent: tabNames[tab] });
        btn.onclick = async () => {
            appState.currentTab = tab;
            Router.navigate(`/bilibili/tab/${tab}`);
        };
        tabsBar.appendChild(btn);
    });
    container.appendChild(tabsBar);
    
    const feed = createElement('main', 'bili-feed');
    const feedInner = createElement('div', 'bili-feed-inner');
    
    const videos = appState.sample[appState.currentTab] || [];
    
    if (videos.length === 0) {
        feedInner.appendChild(createEmptyFeed(async () => {
            createToast('影片生成功能尚未實裝');
        }));
    } else {
        const videoList = createElement('section', 'bili-video-list');
        videos.forEach(video => {
            videoList.appendChild(createVideoCard(video, (v) => {
                Router.navigate(`/bilibili/player/${encodeURIComponent(v.title)}/${encodeURIComponent(v.url || '')}`);
            }));
        });
        feedInner.appendChild(videoList);
    }
    
    feed.appendChild(feedInner);
    container.appendChild(feed);
    
    const nav = createBiliBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

function createBiliBottomNav() {
    const nav = createElement('footer', 'bili-bottombar');
    
    const items = [
        { icon: 'home', label: '首頁', path: '/bilibili' },
        { icon: 'explore', label: '追番', path: '/bilibili/tab/anime' },
        { icon: 'add_circle', label: '', path: '/bilibili/add', isPost: true },
        { icon: 'chat_bubble', label: '訊息', path: '/bilibili/messages' },
        { icon: 'person', label: '我的', path: '/bilibili/profile' }
    ];
    
    items.forEach(item => {
        const btn = createElement('button', 'bili-nav-btn');
        
        if (item.isPost) {
            btn.classList.add('post');
        }
        
        btn.appendChild(createIcon(item.icon, 'text-xl'));
        if (item.label) {
            btn.appendChild(createElement('span', 'text-xs', { textContent: item.label }));
        }
        
        btn.onclick = () => Router.navigate(item.path);
        nav.appendChild(btn);
    });
    
    return nav;
}

async function renderPlayer(params) {
    const title = decodeURIComponent(params.title || '影片標題');
    const url = decodeURIComponent(params.url || '');
    const convertedUrl = convertBilibiliUrl(url);
    
    const container = createElement('div', 'bili-app bili-player-app');
    
    const header = createIOSNavBar({
        title: title,
        backPath: '/bilibili',
        rightActions: [
            { icon: 'more_horiz', onClick: () => {} }
        ]
    });
    container.appendChild(header);
    
    const playerStage = createElement('div', 'bili-player-stage');
    const playerVideo = createElement('div', 'bili-player-video');
    
    if (convertedUrl) {
        const iframe = createElement('iframe', '', {
            src: convertedUrl,
            allow: 'autoplay; fullscreen',
            loading: 'lazy'
        });
        playerVideo.appendChild(iframe);
    }
    
    const danmuLayer = createElement('div', 'bili-danmu-layer');
    playerVideo.appendChild(danmuLayer);
    
    playerStage.appendChild(playerVideo);
    container.appendChild(playerStage);
    
    appState.activeNPCs = generateNPCs(5 + Math.floor(Math.random() * 8));
    container.appendChild(createNPCSection(appState.activeNPCs));
    
    const playerInfo = createElement('div', 'bili-player-info');
    
    const titleEl = createElement('div', 'font-bold', { textContent: title });
    playerInfo.appendChild(titleEl);
    
    const actions = createElement('div', 'bili-player-actions');
    actions.appendChild(createElement('button', 'bili-ghost-btn', { textContent: '👍 讚' }));
    actions.appendChild(createElement('button', 'bili-ghost-btn', { textContent: '⭐ 收藏' }));
    actions.appendChild(createElement('button', 'bili-ghost-btn', { textContent: '📤 分享' }));
    playerInfo.appendChild(actions);
    
    container.appendChild(playerInfo);
    
    const comments = createElement('div', 'bili-comments');
    comments.appendChild(createElement('div', 'font-bold mb-3', { textContent: '熱門留言' }));
    
    const comment1 = createElement('div', 'bili-comment');
    comment1.appendChild(createElement('div', 'bili-comment-avatar'));
    const comment1Body = createElement('div', '');
    comment1Body.appendChild(createElement('div', 'font-semibold text-sm', { textContent: 'Momo' }));
    comment1Body.appendChild(createElement('div', 'text-ios-muted text-sm', { textContent: '這集超好看，已經重刷三次！' }));
    comment1.appendChild(comment1Body);
    comments.appendChild(comment1);
    
    const comment2 = createElement('div', 'bili-comment');
    comment2.appendChild(createElement('div', 'bili-comment-avatar'));
    const comment2Body = createElement('div', '');
    comment2Body.appendChild(createElement('div', 'font-semibold text-sm', { textContent: 'Kirin' }));
    comment2Body.appendChild(createElement('div', 'text-ios-muted text-sm', { textContent: '畫面好精緻，推薦朋友一起看。' }));
    comment2.appendChild(comment2Body);
    comments.appendChild(comment2);
    
    container.appendChild(comments);
    
    return { element: container, cleanup: () => {} };
}

async function renderMessages() {
    const container = createElement('div', 'bili-app');
    
    const header = createIOSNavBar({
        title: '訊息',
        backPath: '/bilibili',
        rightActions: [
            { icon: 'refresh', onClick: async () => {
                await refreshMessages();
                createToast('已刷新');
            }}
        ]
    });
    container.appendChild(header);
    
    const tabsBar = createElement('nav', 'bili-tabs');
    const msgTabs = [
        { key: 'notifications', label: '通知' },
        { key: 'chats', label: '私訊' },
        { key: 'system', label: '系統' }
    ];
    
    msgTabs.forEach(tab => {
        const btn = createElement('button', `bili-tab ${tab.key === appState.currentMsgTab ? 'active' : ''}`, { textContent: tab.label });
        btn.onclick = () => {
            appState.currentMsgTab = tab.key;
            Router.navigate(`/bilibili/messages/${tab.key}`);
        };
        tabsBar.appendChild(btn);
    });
    container.appendChild(tabsBar);
    
    const content = createElement('main', 'bili-messages-content');
    
    const messagesData = await loadMessagesData();
    let items = [];
    
    switch (appState.currentMsgTab) {
        case 'notifications':
            items = messagesData.notifications || generateNotifications(8);
            break;
        case 'chats':
            items = messagesData.chats || generateChatUsers(6);
            break;
        case 'system':
            items = messagesData.system || generateSystemNotifications(5);
            break;
    }
    
    if (items.length === 0) {
        const empty = createElement('div', 'text-center py-12 text-ios-muted');
        empty.appendChild(createIcon('notifications', 'text-5xl opacity-50'));
        empty.appendChild(createElement('div', 'mt-2', { textContent: '暫無訊息' }));
        content.appendChild(empty);
    } else {
        if (appState.currentMsgTab === 'chats') {
            items.forEach(chat => {
                const cell = createElement('div', 'bili-message-item');
                
                const avatar = createElement('div', 'bili-message-avatar');
                cell.appendChild(avatar);
                
                const info = createElement('div', 'bili-message-info');
                info.appendChild(createElement('div', 'font-semibold', { textContent: chat.name }));
                info.appendChild(createElement('div', 'text-ios-muted text-sm truncate', { textContent: chat.lastMessage }));
                cell.appendChild(info);
                
                const meta = createElement('div', 'bili-message-meta');
                meta.appendChild(createElement('div', 'text-xs text-ios-muted', { textContent: chat.time }));
                if (chat.unread > 0) {
                    meta.appendChild(createElement('div', 'bili-badge', { textContent: chat.unread }));
                }
                cell.appendChild(meta);
                
                cell.onclick = () => Router.navigate(`/bilibili/chat/${chat.id}/${encodeURIComponent(chat.name)}`);
                content.appendChild(cell);
            });
        } else {
            items.forEach(notif => {
                const cell = createElement('div', 'bili-notification-item');
                
                const iconBadge = createElement('div', 'bili-notification-icon');
                iconBadge.appendChild(createIcon(notif.icon, 'text-white'));
                cell.appendChild(iconBadge);
                
                const info = createElement('div', 'flex-1');
                info.appendChild(createElement('div', 'font-semibold', { textContent: notif.title }));
                info.appendChild(createElement('div', 'text-ios-muted text-sm', { textContent: notif.desc }));
                cell.appendChild(info);
                
                cell.appendChild(createElement('div', 'text-xs text-ios-muted', { textContent: notif.time }));
                content.appendChild(cell);
            });
        }
    }
    
    container.appendChild(content);
    
    const nav = createBiliBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

async function renderChat(params) {
    const chatId = params.id;
    const chatName = decodeURIComponent(params.name || '聊天');
    
    const container = createElement('div', 'bili-app bili-chat-app');
    
    const header = createIOSNavBar({
        title: chatName,
        backPath: '/bilibili/messages/chats'
    });
    container.appendChild(header);
    
    const messages = createElement('div', 'bili-chat-messages');
    
    appState.chatData = await loadChatData();
    if (!appState.chatData[chatId]) {
        appState.chatData[chatId] = generateChatHistory(chatId, 8);
        await saveChatData(appState.chatData);
    }
    
    const chatHistory = appState.chatData[chatId];
    chatHistory.forEach(msg => {
        const bubble = createElement('div', `bili-chat-bubble ${msg.type}`);
        bubble.appendChild(createElement('div', '', { textContent: msg.text }));
        bubble.appendChild(createElement('div', 'bili-chat-bubble-time', { textContent: msg.time }));
        messages.appendChild(bubble);
    });
    
    container.appendChild(messages);
    
    const inputRow = createElement('div', 'bili-chat-input-row');
    const input = createElement('input', 'bili-chat-input', { type: 'text', placeholder: '輸入訊息...' });
    const sendBtn = createElement('button', 'bili-chat-send-btn');
    sendBtn.appendChild(createIcon('send', 'text-white'));
    
    sendBtn.onclick = async () => {
        const text = input.value.trim();
        if (!text) return;
        
        const newMsg = {
            id: `msg_${Date.now()}`,
            type: 'sent',
            text,
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
        };
        
        appState.chatData[chatId].push(newMsg);
        await saveChatData(appState.chatData);
        
        input.value = '';
        Router.navigate(`/bilibili/chat/${chatId}/${encodeURIComponent(chatName)}`);
    };
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendBtn.click();
    });
    
    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    container.appendChild(inputRow);
    
    return { element: container, cleanup: () => {} };
}

async function renderProfile() {
    const container = createElement('div', 'bili-app');
    
    const header = createIOSNavBar({
        title: '我的',
        backPath: '/bilibili',
        rightActions: [
            { icon: 'settings', onClick: () => Router.navigate('/settings') }
        ]
    });
    container.appendChild(header);
    
    const profile = createElement('div', 'bili-profile');
    
    const headerCard = createElement('div', 'bili-profile-header');
    const avatar = createElement('div', 'bili-profile-avatar');
    const info = createElement('div', 'bili-profile-info');
    info.appendChild(createElement('div', 'font-bold text-lg', { textContent: 'SXi User' }));
    info.appendChild(createElement('div', 'text-ios-muted text-sm', { textContent: 'Lv.5 · 追番中' }));
    headerCard.appendChild(avatar);
    headerCard.appendChild(info);
    headerCard.appendChild(createElement('button', 'bili-ghost-btn', { textContent: '編輯' }));
    profile.appendChild(headerCard);
    
    const stats = createElement('div', 'bili-profile-stats');
    stats.innerHTML = `
        <div><span class="font-bold">128</span><small>關注</small></div>
        <div><span class="font-bold">3.2萬</span><small>粉絲</small></div>
        <div><span class="font-bold">56</span><small>動態</small></div>
    `;
    profile.appendChild(stats);
    
    const card1 = createElement('div', 'bili-card');
    card1.appendChild(createElement('div', 'font-semibold mb-2', { textContent: '常用功能' }));
    const grid1 = createElement('div', 'bili-grid');
    ['歷史紀錄', '我的收藏', '離線快取', '稍後再看'].forEach(label => {
        grid1.appendChild(createElement('button', 'bili-grid-btn', { textContent: label }));
    });
    card1.appendChild(grid1);
    profile.appendChild(card1);
    
    const card2 = createElement('div', 'bili-card');
    card2.appendChild(createElement('div', 'font-semibold mb-2', { textContent: '創作中心' }));
    const grid2 = createElement('div', 'bili-grid');
    ['投稿', '直播中心', '草稿箱', '收益'].forEach(label => {
        grid2.appendChild(createElement('button', 'bili-grid-btn', { textContent: label }));
    });
    card2.appendChild(grid2);
    profile.appendChild(card2);
    
    container.appendChild(profile);
    
    const nav = createBiliBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

export default {
    id: 'bilibili',
    name: 'Bilibili',
    icon: 'play_circle',
    routes: [
        { path: '/bilibili', render: renderHome },
        { path: '/bilibili/tab/:tab', render: async (params) => {
            appState.currentTab = params.tab;
            return renderHome();
        }},
        { path: '/bilibili/player/:title/:url', render: renderPlayer },
        { path: '/bilibili/messages', render: () => {
            appState.currentMsgTab = 'notifications';
            return renderMessages();
        }},
        { path: '/bilibili/messages/:tab', render: async (params) => {
            appState.currentMsgTab = params.tab;
            return renderMessages();
        }},
        { path: '/bilibili/chat/:id/:name', render: renderChat },
        { path: '/bilibili/profile', render: renderProfile }
    ],
    navItem: {
        label: 'Bilibili',
        icon: 'play_circle',
        path: '/bilibili',
        showInNav: true,
        order: 5
    },
    styles: () => import('./style.css')
};