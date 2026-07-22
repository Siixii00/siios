import Router from '../../router.js';
import { createElement, createIcon } from '../../components.js';
import { SettingsDB } from '../../db.js';

const mockData = {
    streams: [
        { id: 'stream-1', title: '【傳說對決】挑戰傳說段位！一起衝分！', streamer: '電競小王子', streamerAvatar: 'https://placehold.co/80x80/9146ff/ffffff?text=王', game: '傳說對決', viewers: 12580, thumbnail: 'https://placehold.co/640x360/1a1a2e/9146ff?text=傳說對決', isLive: true, category: 'gaming' },
        { id: 'stream-2', title: '【英雄聯盟】台服菁英之路 Day 3', streamer: 'LOL大師兄', streamerAvatar: 'https://placehold.co/80x80/ff6b6b/ffffff?text=L', game: '英雄聯盟', viewers: 8920, thumbnail: 'https://placehold.co/640x360/1a1a2e/ff6b6b?text=英雄聯盟', isLive: true, category: 'gaming' },
        { id: 'stream-3', title: '晚安聊天室～今天過得怎麼樣？', streamer: '甜心主播', streamerAvatar: 'https://placehold.co/80x80/ff9ff3/ffffff?text=甜', game: 'Just Chatting', viewers: 5630, thumbnail: 'https://placehold.co/640x360/1a1a2e/ff9ff3?text=聊天', isLive: true, category: 'irl' },
        { id: 'stream-4', title: '【原神】4.5版本新角色抽抽樂！', streamer: '原神攻略組', streamerAvatar: 'https://placehold.co/80x80/4ecdc4/ffffff?text=原', game: '原神', viewers: 7840, thumbnail: 'https://placehold.co/640x360/1a1a2e/4ecdc4?text=原神', isLive: true, category: 'gaming' },
        { id: 'stream-5', title: '深夜音樂電台～放鬆一下', streamer: 'DJ小夜', streamerAvatar: 'https://placehold.co/80x80/45b7d1/ffffff?text=D', game: 'Music', viewers: 3210, thumbnail: 'https://placehold.co/640x360/1a1a2e/45b7d1?text=音樂', isLive: true, category: 'music' },
        { id: 'stream-6', title: '【VALORANT】特戰英豪排位賽', streamer: 'FPS戰神', streamerAvatar: 'https://placehold.co/80x80/ff6348/ffffff?text=F', game: 'VALORANT', viewers: 6540, thumbnail: 'https://placehold.co/640x360/1a1a2e/ff6348?text=VALORANT', isLive: true, category: 'esports' },
        { id: 'stream-7', title: '繪圖直播～今天來畫風景畫', streamer: '繪師小櫻', streamerAvatar: 'https://placehold.co/80x80/ffa502/ffffff?text=繪', game: 'Art', viewers: 1890, thumbnail: 'https://placehold.co/640x360/1a1a2e/ffa502?text=繪圖', isLive: true, category: 'creative' },
        { id: 'stream-8', title: '【Minecraft】生存建築挑戰！', streamer: '麥塊達人', streamerAvatar: 'https://placehold.co/80x80/2ed573/ffffff?text=麥', game: 'Minecraft', viewers: 4320, thumbnail: 'https://placehold.co/640x360/1a1a2e/2ed573?text=Minecraft', isLive: true, category: 'gaming' }
    ],
    categories: [
        { id: 'cat-1', name: '傳說對決', viewers: 45680, cover: 'https://placehold.co/300x400/9146ff/ffffff?text=傳說對決' },
        { id: 'cat-2', name: '英雄聯盟', viewers: 38420, cover: 'https://placehold.co/300x400/ff6b6b/ffffff?text=英雄聯盟' },
        { id: 'cat-3', name: 'Just Chatting', viewers: 28930, cover: 'https://placehold.co/300x400/ff9ff3/ffffff?text=聊天' },
        { id: 'cat-4', name: '原神', viewers: 24560, cover: 'https://placehold.co/300x400/4ecdc4/ffffff?text=原神' },
        { id: 'cat-5', name: 'VALORANT', viewers: 19870, cover: 'https://placehold.co/300x400/ff6348/ffffff?text=VALORANT' },
        { id: 'cat-6', name: 'Minecraft', viewers: 16430, cover: 'https://placehold.co/300x400/2ed573/ffffff?text=Minecraft' }
    ],
    followedChannels: [
        { id: 'follow-1', name: '電競小王子', game: '傳說對決', viewers: 12580, avatar: 'https://placehold.co/60x60/9146ff/ffffff?text=王', isLive: true },
        { id: 'follow-2', name: '甜心主播', game: 'Just Chatting', viewers: 5630, avatar: 'https://placehold.co/60x60/ff9ff3/ffffff?text=甜', isLive: true },
        { id: 'follow-3', name: '遊戲實況主', game: '', viewers: 0, avatar: 'https://placehold.co/60x60/71717a/ffffff?text=遊', isLive: false }
    ],
    featuredStreams: [
        { id: 'featured-1', title: '【電競錦標賽】總決賽直播', streamer: '官方直播', game: '電競賽事', viewers: 156780, thumbnail: 'https://placehold.co/1280x720/1a1a2e/9146ff?text=電競錦標賽' },
        { id: 'featured-2', title: '【新遊戲發表會】2024春季發表會', streamer: '遊戲官方', game: 'Special Events', viewers: 89340, thumbnail: 'https://placehold.co/1280x720/1a1a2e/ff6b6b?text=發表會' },
        { id: 'featured-3', title: '【音樂祭】線上演唱會直播', streamer: '音樂頻道', game: 'Music', viewers: 45620, thumbnail: 'https://placehold.co/1280x720/1a1a2e/45b7d1?text=音樂祭' }
    ],
    searchHistory: ['傳說對決', 'LOL', '原神', 'Just Chatting'],
    trendingSearches: ['電競錦標賽', '新遊戲發表會', '音樂祭', '抽卡實況', '生存挑戰']
};

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
    customCategories: []
};

function formatViewers(num) {
    if (num >= 10000) return (num / 10000).toFixed(1) + '萬';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

async function loadCustomCategories() {
    const cats = await SettingsDB.get('twitch_categories');
    if (Array.isArray(cats)) state.customCategories = cats;
}

async function saveCustomCategories() {
    await SettingsDB.set('twitch_categories', state.customCategories);
}

async function renderTwitch() {
    await loadCustomCategories();
    
    const container = createElement('div', 'app-container twitch-app');
    
    container.innerHTML = `
        <header class="twitch-top-nav">
            <div class="nav-left">
                <button class="nav-btn" id="menu-btn">
                    <span class="material-symbols-outlined">menu</span>
                </button>
                <div class="nav-logo">
                    <svg class="twitch-logo" width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3.406 1.406L0 4.813v15.375h5.5V24l3.5-3.5h3.5L21 12V1.406H3.406zM19.25 11.25l-4 4h-3.5l-2.625 2.625v-2.625H5.5V3.156h13.75v8.094z"/>
                        <path d="M16.25 5.906h-1.75v5.25h1.75v-5.25zM12 5.906h-1.75v5.25H12v-5.25z"/>
                    </svg>
                    <span class="twitch-logo-wordmark">Twitch</span>
                </div>
            </div>
            <div class="nav-actions">
                <button class="nav-btn" id="search-btn">
                    <span class="material-symbols-outlined">search</span>
                </button>
            </div>
        </header>

        <aside class="twitch-sidebar" id="sidebar">
            <div class="sidebar-section">
                <div class="sidebar-title">推薦頻道</div>
                <div class="channel-list" id="recommended-channels"></div>
            </div>
            <div class="sidebar-section">
                <div class="sidebar-title">已追蹤</div>
                <div class="channel-list" id="followed-channels"></div>
            </div>
        </aside>

        <main class="twitch-main" id="main-content">
            <div class="category-nav">
                <select class="category-select" id="category-select">
                    <option value="all">所有分類</option>
                    <option value="gaming">遊戲</option>
                    <option value="irl">生活</option>
                    <option value="music">音樂</option>
                    <option value="esports">電競</option>
                    <option value="creative">創作</option>
                </select>
                <button class="category-add-btn" id="add-category-btn">
                    <span class="material-symbols-outlined">add</span>
                </button>
            </div>

            <section class="featured-section">
                <div class="featured-carousel" id="featured-carousel"></div>
                <div class="carousel-dots" id="carousel-dots"></div>
            </section>

            <section class="streams-section">
                <div class="section-header">
                    <h2 class="section-title">推薦直播</h2>
                </div>
                <div class="streams-grid" id="streams-grid"></div>
            </section>

            <section class="categories-section">
                <div class="section-header">
                    <h2 class="section-title">熱門分類</h2>
                </div>
                <div class="categories-grid" id="categories-grid"></div>
            </section>
        </main>

        <div class="twitch-search-panel" id="search-panel">
            <div class="search-header">
                <button class="nav-btn" id="close-search-btn">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <div class="search-input-wrapper">
                    <input type="text" id="search-input" placeholder="搜尋直播、遊戲、實況主...">
                </div>
            </div>
            <div class="search-results">
                <div class="search-history">
                    <h3>搜尋紀錄</h3>
                    <div class="history-list" id="history-list"></div>
                </div>
                <div class="trending-searches">
                    <h3>熱門搜尋</h3>
                    <div class="trending-list" id="trending-list"></div>
                </div>
            </div>
        </div>

        <div class="stream-page" id="stream-page">
            <header class="stream-header">
                <button class="nav-btn" id="close-stream-btn">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
                <div class="stream-info-header">
                    <span class="streamer-name" id="streamer-name"></span>
                    <span class="stream-category" id="stream-category"></span>
                </div>
                <button class="follow-btn" id="follow-btn">追蹤</button>
            </header>
            <div class="stream-player">
                <div class="video-placeholder" id="video-placeholder">
                    <span class="material-symbols-outlined" style="font-size: 64px;">play_circle</span>
                </div>
                <div class="stream-controls">
                    <button class="control-btn" id="play-btn">
                        <span class="material-symbols-outlined">play_arrow</span>
                    </button>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progress-fill"></div>
                    </div>
                </div>
            </div>
            <div class="stream-tabs">
                <button class="stream-tab active" data-tab="chat">聊天室</button>
                <button class="stream-tab" data-tab="info">資訊</button>
            </div>
            <div class="stream-content">
                <div class="chat-panel" id="chat-panel">
                    <div class="chat-messages" id="chat-messages"></div>
                    <div class="chat-input-area">
                        <input type="text" id="chat-input" placeholder="發送訊息...">
                        <button class="send-btn" id="send-chat-btn">
                            <span class="material-symbols-outlined">send</span>
                        </button>
                    </div>
                </div>
                <div class="info-panel" id="info-panel" style="display:none">
                    <div class="streamer-card">
                        <img class="streamer-avatar-lg" id="streamer-avatar" src="" alt="">
                        <div class="streamer-details">
                            <h3 id="streamer-title"></h3>
                            <p id="streamer-bio"></p>
                            <div class="streamer-stats">
                                <span id="viewer-count"></span>
                                <span id="follower-count"></span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <nav class="twitch-bottom-nav">
            <button class="nav-item active" data-tab="home">
                <span class="material-symbols-outlined">home</span>
                <span>首頁</span>
            </button>
            <button class="nav-item" data-tab="following">
                <span class="material-symbols-outlined">favorite</span>
                <span>追蹤</span>
            </button>
            <button class="nav-item" data-tab="browse">
                <span class="material-symbols-outlined">explore</span>
                <span>探索</span>
            </button>
        </nav>
    `;

    let carouselTimer = null;

    function renderChannels(container, channels) {
        container.innerHTML = '';
        channels.forEach(channel => {
            const item = createElement('div', 'channel-item');
            item.innerHTML = `
                <div class="channel-avatar">
                    <img src="${channel.avatar}" alt="${channel.name}">
                </div>
                <div class="channel-info">
                    <div class="channel-name">${channel.name}</div>
                    <div class="channel-game">${channel.game || '離線'}</div>
                </div>
                ${channel.isLive ? `
                    <div class="channel-viewers">
                        <span class="live-indicator"></span>
                        <span>${formatViewers(channel.viewers)}</span>
                    </div>
                ` : ''}
            `;
            item.onclick = () => {
                if (channel.isLive) {
                    const stream = mockData.streams.find(s => s.streamer === channel.name);
                    if (stream) openStreamPage(stream);
                }
            };
            container.appendChild(item);
        });
    }

    function renderFeaturedCarousel() {
        const carousel = container.querySelector('#featured-carousel');
        const dots = container.querySelector('#carousel-dots');
        carousel.innerHTML = '';
        dots.innerHTML = '';
        
        mockData.featuredStreams.forEach((stream, index) => {
            const item = createElement('div', `featured-item ${index === 0 ? 'active' : ''}`);
            item.innerHTML = `
                <img class="featured-thumbnail" src="${stream.thumbnail}" alt="${stream.title}">
                <div class="featured-overlay">
                    <div class="featured-live-badge">
                        <span class="material-symbols-outlined" style="font-size: 12px;">circle</span>
                        直播中
                    </div>
                    <div class="featured-title">${stream.title}</div>
                    <div class="featured-streamer">${stream.streamer}</div>
                    <div class="featured-game">${stream.game} · ${formatViewers(stream.viewers)} 位觀眾</div>
                </div>
            `;
            item.onclick = () => {
                openStreamPage({ ...stream, streamerAvatar: 'https://placehold.co/80x80/9146ff/ffffff?text=官' });
            };
            carousel.appendChild(item);
            
            const dot = createElement('button', `carousel-dot ${index === 0 ? 'active' : ''}`);
            dot.onclick = () => goToSlide(index);
            dots.appendChild(dot);
        });
    }

    function goToSlide(index) {
        state.carouselIndex = index;
        const items = container.querySelectorAll('.featured-item');
        const dots = container.querySelectorAll('.carousel-dot');
        items.forEach((item, i) => item.classList.toggle('active', i === index));
        dots.forEach((dot, i) => dot.classList.toggle('active', i === index));
    }

    function startCarouselRotation() {
        carouselTimer = setInterval(() => {
            const nextIndex = (state.carouselIndex + 1) % mockData.featuredStreams.length;
            goToSlide(nextIndex);
        }, 5000);
    }

    function renderStreams(category = 'all') {
        const grid = container.querySelector('#streams-grid');
        grid.innerHTML = '';
        
        let streams = mockData.streams;
        if (category !== 'all') {
            streams = streams.filter(s => s.category === category);
        }
        
        streams.forEach(stream => {
            const card = createElement('div', 'stream-card');
            card.innerHTML = `
                <div class="stream-thumbnail">
                    <img src="${stream.thumbnail}" alt="${stream.title}">
                    <span class="stream-live-badge">直播中</span>
                    <span class="stream-viewers">
                        <span class="material-symbols-outlined" style="font-size: 12px;">visibility</span>
                        ${formatViewers(stream.viewers)}
                    </span>
                </div>
                <div class="stream-info">
                    <div class="streamer-avatar">
                        <img src="${stream.streamerAvatar}" alt="${stream.streamer}">
                    </div>
                    <div class="stream-details">
                        <div class="stream-title">${stream.title}</div>
                        <div class="stream-channel">${stream.streamer}</div>
                        <div class="stream-game">${stream.game}</div>
                    </div>
                </div>
            `;
            card.onclick = () => openStreamPage(stream);
            grid.appendChild(card);
        });
    }

    function renderCategories() {
        const grid = container.querySelector('#categories-grid');
        grid.innerHTML = '';
        
        mockData.categories.forEach(category => {
            const card = createElement('div', 'category-card');
            card.innerHTML = `
                <div class="category-cover">
                    <img src="${category.cover}" alt="${category.name}">
                </div>
                <div class="category-name">${category.name}</div>
                <div class="category-viewers">${formatViewers(category.viewers)} 位觀眾</div>
            `;
            card.onclick = () => {
                const categoryMap = {
                    '傳說對決': 'gaming',
                    '英雄聯盟': 'gaming',
                    'Just Chatting': 'irl',
                    '原神': 'gaming',
                    'VALORANT': 'esports',
                    'Minecraft': 'gaming'
                };
                renderStreams(categoryMap[category.name] || 'all');
            };
            grid.appendChild(card);
        });
    }

    function renderSearchHistory() {
        const list = container.querySelector('#history-list');
        list.innerHTML = '';
        mockData.searchHistory.forEach(term => {
            const item = createElement('div', 'history-item');
            item.innerHTML = `
                <span class="material-symbols-outlined">history</span>
                <span>${term}</span>
            `;
            item.onclick = () => performSearch(term);
            list.appendChild(item);
        });
    }

    function renderTrendingSearches() {
        const list = container.querySelector('#trending-list');
        list.innerHTML = '';
        mockData.trendingSearches.forEach(term => {
            const item = createElement('div', 'trending-item');
            item.innerHTML = `
                <span class="material-symbols-outlined">trending_up</span>
                <span>${term}</span>
            `;
            item.onclick = () => performSearch(term);
            list.appendChild(item);
        });
    }

    function renderChatMessages() {
        const messages = container.querySelector('#chat-messages');
        const initialMessages = [
            { username: '小明', message: '主播好強！', type: 'normal' },
            { username: '管理員', message: '歡迎大家來到直播間～', type: 'moderator' },
            { username: '訂閱者A', message: '已訂閱三個月了！', type: 'subscriber' },
            { username: '路人甲', message: '第一次來看直播', type: 'normal' },
            { username: '粉絲B', message: '主播加油！', type: 'normal' }
        ];
        
        messages.innerHTML = '';
        initialMessages.forEach(msg => addChatMessage(msg.username, msg.message, msg.type));
    }

    function addChatMessage(username, message, type = 'normal') {
        const messages = container.querySelector('#chat-messages');
        const msgEl = createElement('div', 'chat-message');
        msgEl.innerHTML = `
            <span class="chat-username ${type}">${username}:</span>
            <span class="chat-text">${message}</span>
        `;
        messages.appendChild(msgEl);
        messages.scrollTop = messages.scrollHeight;
    }

    function openStreamPage(stream) {
        state.currentStream = stream;
        state.isFollowing = false;
        
        container.querySelector('#streamer-name').textContent = stream.streamer;
        container.querySelector('#stream-category').textContent = stream.game;
        container.querySelector('#streamer-title').textContent = stream.streamer;
        container.querySelector('#streamer-bio').textContent = `歡迎來到 ${stream.streamer} 的直播間！`;
        container.querySelector('#streamer-avatar').src = stream.streamerAvatar;
        container.querySelector('#viewer-count').textContent = `${formatViewers(stream.viewers)} 位觀眾`;
        container.querySelector('#follower-count').textContent = `${Math.floor(Math.random() * 100 + 10)}K 位追蹤者`;
        
        updateFollowButton();
        renderChatMessages();
        
        container.querySelector('#stream-page').classList.add('open');
        state.streamPageOpen = true;
    }

    function closeStreamPage() {
        container.querySelector('#stream-page').classList.remove('open');
        state.streamPageOpen = false;
        state.currentStream = null;
        stopLiveChatGeneration();
    }

    function togglePlay() {
        state.isPlaying = !state.isPlaying;
        const placeholder = container.querySelector('#video-placeholder');
        const playBtn = container.querySelector('#play-btn');
        
        if (state.isPlaying) {
            placeholder.innerHTML = `
                <div class="live-playing-indicator">
                    <span class="material-symbols-outlined" style="font-size: 48px; animation: pulse 1s infinite;">circle</span>
                    <span>直播進行中</span>
                </div>
            `;
            playBtn.innerHTML = '<span class="material-symbols-outlined">pause</span>';
            startLiveChatGeneration();
        } else {
            placeholder.innerHTML = '<span class="material-symbols-outlined" style="font-size: 64px;">play_circle</span>';
            playBtn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span>';
            stopLiveChatGeneration();
        }
    }

    function toggleFollow() {
        state.isFollowing = !state.isFollowing;
        updateFollowButton();
    }

    function updateFollowButton() {
        const btn = container.querySelector('#follow-btn');
        btn.textContent = state.isFollowing ? '已追蹤' : '追蹤';
        btn.classList.toggle('following', state.isFollowing);
    }

    function openSearch() {
        container.querySelector('#search-panel').classList.add('open');
        state.searchOpen = true;
        container.querySelector('#search-input').focus();
    }

    function closeSearch() {
        container.querySelector('#search-panel').classList.remove('open');
        state.searchOpen = false;
        container.querySelector('#search-input').value = '';
    }

    function performSearch(query) {
        if (!query.trim()) return;
        const results = mockData.streams.filter(s => 
            s.title.toLowerCase().includes(query.toLowerCase()) ||
            s.streamer.toLowerCase().includes(query.toLowerCase()) ||
            s.game.toLowerCase().includes(query.toLowerCase())
        );
        closeSearch();
        if (results.length > 0) {
            renderStreams();
        }
    }

    function toggleSidebar() {
        state.sidebarOpen = !state.sidebarOpen;
        container.querySelector('#sidebar').classList.toggle('open', state.sidebarOpen);
    }

    function switchCategory(category) {
        state.currentCategory = category;
        container.querySelector('#category-select').value = category;
        renderStreams(category);
    }

    async function addCategory() {
        const categoryName = prompt('請輸入新主題名稱：');
        if (!categoryName || !categoryName.trim()) return;
        
        const categoryId = categoryName.trim().toLowerCase().replace(/\s+/g, '-');
        state.customCategories.push({ id: categoryId, name: categoryName.trim() });
        await saveCustomCategories();
        
        const select = container.querySelector('#category-select');
        const option = createElement('option', '');
        option.value = categoryId;
        option.textContent = categoryName.trim();
        select.appendChild(option);
        select.value = categoryId;
        switchCategory(categoryId);
    }

    function startLiveChatGeneration() {
        if (state.chatGenerationInterval) return;
        state.chatGenerationInterval = setInterval(() => {
            const usernames = ['小明', '觀眾A', '粉絲B', '路人', '鐵粉'];
            const messages = ['主播加油！', '好強！', '這操作太帥了', '第一次來', '追了！'];
            addChatMessage(
                usernames[Math.floor(Math.random() * usernames.length)],
                messages[Math.floor(Math.random() * messages.length)],
                Math.random() > 0.7 ? 'subscriber' : 'normal'
            );
        }, 3000 + Math.random() * 2000);
    }

    function stopLiveChatGeneration() {
        if (state.chatGenerationInterval) {
            clearInterval(state.chatGenerationInterval);
            state.chatGenerationInterval = null;
        }
        state.isPlaying = false;
    }

    function sendChatMessage() {
        const input = container.querySelector('#chat-input');
        const message = input.value.trim();
        if (!message) return;
        addChatMessage('我', message, 'normal');
        input.value = '';
    }

    container.querySelector('#menu-btn').onclick = toggleSidebar;
    container.querySelector('#search-btn').onclick = openSearch;
    container.querySelector('#close-search-btn').onclick = closeSearch;
    container.querySelector('#close-stream-btn').onclick = closeStreamPage;
    container.querySelector('#follow-btn').onclick = toggleFollow;
    container.querySelector('#play-btn').onclick = togglePlay;
    container.querySelector('#send-chat-btn').onclick = sendChatMessage;
    container.querySelector('#add-category-btn').onclick = addCategory;

    container.querySelector('#category-select').onchange = (e) => switchCategory(e.target.value);
    container.querySelector('#search-input').onkeypress = (e) => {
        if (e.key === 'Enter') performSearch(e.target.value);
    };
    container.querySelector('#chat-input').onkeypress = (e) => {
        if (e.key === 'Enter') sendChatMessage();
    };

    container.querySelectorAll('.stream-tab').forEach(tab => {
        tab.onclick = () => {
            container.querySelectorAll('.stream-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const tabName = tab.dataset.tab;
            container.querySelector('#chat-panel').style.display = tabName === 'chat' ? 'flex' : 'none';
            container.querySelector('#info-panel').style.display = tabName === 'info' ? 'block' : 'none';
        };
    });

    container.querySelectorAll('.nav-item').forEach(item => {
        item.onclick = () => {
            container.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            state.currentTab = item.dataset.tab;
            if (state.currentTab === 'following') {
                renderStreams('all');
            } else {
                renderStreams(state.currentCategory);
            }
        };
    });

    document.onkeydown = (e) => {
        if (e.key === 'Escape') {
            if (state.streamPageOpen) closeStreamPage();
            else if (state.searchOpen) closeSearch();
            else if (state.sidebarOpen) toggleSidebar();
        }
    };

    renderChannels(container.querySelector('#recommended-channels'), mockData.followedChannels.slice(0, 3));
    renderChannels(container.querySelector('#followed-channels'), mockData.followedChannels);
    renderFeaturedCarousel();
    renderStreams();
    renderCategories();
    renderSearchHistory();
    renderTrendingSearches();
    startCarouselRotation();

    return {
        element: container,
        cleanup: () => {
            if (carouselTimer) clearInterval(carouselTimer);
            stopLiveChatGeneration();
        }
    };
}

export default {
    id: 'twitch',
    name: 'Twitch',
    icon: 'live_tv',
    routes: [{ path: '/twitch', render: renderTwitch }],
    navItem: { label: 'Twitch', icon: 'live_tv', path: '/twitch', showInNav: true, order: 25 },
    styles: () => import('./style.css')
};