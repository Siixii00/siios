import Router from '../../router.js';
import { createElement, createIcon, createToast, createEmptyState } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

let userTweets = [];
let npcTweets = [];
let bookmarks = [];
let notifications = [];
let pendingReactions = [];
let activeTab = 'forYou';
let fabMenuOpen = false;
let notificationInterval = null;

const DEFAULT_AVATAR = 'linear-gradient(135deg, #2d89ef, #8ec5ff)';

async function getSetting(key, defaultValue) {
    const value = await SettingsDB.get(key);
    return value !== undefined ? value : defaultValue;
}

async function setSetting(key, value) {
    await SettingsDB.set(key, value);
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
    if (diff < 86400000) return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    if (diff < 604800000) return ['日', '一', '二', '三', '四', '五', '六'][date.getDay()];
    
    return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatTimeAgo(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return '剛剛';
    if (minutes < 60) return `${minutes}分鐘前`;
    if (hours < 24) return `${hours}小時前`;
    if (days < 7) return `${days}天前`;
    
    return new Date(timestamp).toLocaleDateString('zh-TW');
}

async function getProfile() {
    const saved = await getSetting('twitter_profile', null);
    if (saved) return saved;
    
    return {
        name: 'User',
        handle: '@user',
        bio: '',
        avatarGradient: DEFAULT_AVATAR
    };
}

async function getUserTweets() {
    const saved = await getSetting('twitter_user_tweets', []);
    return Array.isArray(saved) ? saved : [];
}

async function saveUserTweets() {
    userTweets.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    await setSetting('twitter_user_tweets', userTweets);
}

async function getNpcTweets() {
    const saved = await getSetting('twitter_npc_tweets', []);
    return Array.isArray(saved) ? saved : [];
}

async function saveNpcTweets() {
    const bookmarkIds = new Set(bookmarks.map(b => b.id || b.timestamp));
    const preservedTweets = npcTweets.filter(t => bookmarkIds.has(t.id || t.timestamp));
    const regularTweets = npcTweets.filter(t => !bookmarkIds.has(t.id || t.timestamp));
    const trimmedRegular = regularTweets.slice(0, 50);
    const finalTweets = [...preservedTweets, ...trimmedRegular];
    finalTweets.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    await setSetting('twitter_npc_tweets', finalTweets);
    npcTweets = finalTweets;
}

async function getBookmarks() {
    const saved = await getSetting('twitter_bookmarks', []);
    return Array.isArray(saved) ? saved : [];
}

async function saveBookmarks() {
    await setSetting('twitter_bookmarks', bookmarks);
}

async function getNotifications() {
    const saved = await getSetting('twitter_notifications', []);
    return Array.isArray(saved) ? saved : [];
}

async function saveNotifications() {
    if (notifications.length > 100) notifications.length = 100;
    await setSetting('twitter_notifications', notifications);
}

async function getPendingReactions() {
    const saved = await getSetting('twitter_pending_reactions', []);
    return Array.isArray(saved) ? saved : [];
}

async function savePendingReactions() {
    await setSetting('twitter_pending_reactions', pendingReactions);
}

async function getNpcFollows() {
    const saved = await getSetting('twitter_npc_follows', []);
    return Array.isArray(saved) ? saved : [];
}

async function saveNpcFollows(follows) {
    await setSetting('twitter_npc_follows', follows);
}

async function getMemories() {
    const saved = await getSetting('twitter_memories', []);
    return Array.isArray(saved) ? saved : [];
}

async function saveMemories(memories) {
    if (memories.length > 500) memories = memories.slice(-500);
    await setSetting('twitter_memories', memories);
}

function escapeHtml(text) {
    return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function createTweetEl(tweet, profile, isBookmarked = false) {
    const tweetId = tweet.id || tweet.timestamp;
    const isUserTweet = tweet.author === '你';
    const avatarStyle = isUserTweet ? `background: ${profile.avatarGradient || DEFAULT_AVATAR}` : '';
    const displayName = isUserTweet ? profile.name : tweet.author;
    const displayHandle = isUserTweet ? profile.handle : tweet.handle;
    
    const article = createElement('article', 'tweet', { dataTweetId: tweetId });
    
    article.innerHTML = `
        <div class="avatar" style="${avatarStyle}"></div>
        <div class="tweet-content-wrapper">
            <div class="tweet-header">
                <div>
                    <span class="tweet-author">${escapeHtml(displayName)}</span>
                    <span class="tweet-meta">${escapeHtml(displayHandle)} · ${tweet.time || formatTime(tweet.timestamp)}</span>
                </div>
                <button class="icon-btn tweet-menu-btn" aria-label="更多"><i class="fas fa-ellipsis"></i></button>
            </div>
            <div class="tweet-body">${escapeHtml(tweet.content)}</div>
            <div class="tweet-actions">
                <button type="button" data-action="reply"><i class="far fa-comment"></i><span>${tweet.stats?.reply || 0}</span></button>
                <button type="button" data-action="retweet"><i class="fas fa-retweet"></i><span>${tweet.stats?.retweet || 0}</span></button>
                <button type="button" data-action="like"><i class="far fa-heart"></i><span>${tweet.stats?.like || 0}</span></button>
                <button type="button" data-action="bookmark" class="${isBookmarked ? 'bookmarked' : ''}"><i class="${isBookmarked ? 'fas' : 'far'} fa-bookmark"></i></button>
            </div>
        </div>
    `;
    
    return article;
}

function createNotificationEl(notif) {
    const timeStr = formatTimeAgo(notif.timestamp);
    const unreadClass = notif.read ? '' : 'unread';
    
    let icon = 'fa-bell';
    let iconColor = 'var(--twitter-accent)';
    let actionText = '';
    
    switch (notif.type) {
        case 'like':
            icon = 'fa-heart';
            iconColor = '#f91880';
            actionText = '喜歡了你的推文';
            break;
        case 'retweet':
            icon = 'fa-retweet';
            iconColor = '#00ba7c';
            actionText = '轉發了你的推文';
            break;
        case 'reply':
            icon = 'fa-comment';
            iconColor = 'var(--twitter-accent)';
            actionText = '回覆了你的推文';
            break;
    }
    
    const section = createElement('section', `card notification-card ${unreadClass}`, { dataId: notif.id });
    section.innerHTML = `
        <div class="notification-icon" style="color: ${iconColor}">
            <i class="fas ${icon}"></i>
        </div>
        <div class="notification-content">
            <div class="notification-header">
                <span class="notification-author">${escapeHtml(notif.fromName)}</span>
                <span class="notification-action">${actionText}</span>
            </div>
            ${notif.tweetContent ? `<div class="notification-tweet">${escapeHtml(notif.tweetContent.slice(0, 80))}${notif.tweetContent.length > 80 ? '...' : ''}</div>` : ''}
            ${notif.replyContent ? `<div class="notification-reply">${escapeHtml(notif.replyContent)}</div>` : ''}
            <div class="notification-time">${timeStr}</div>
        </div>
    `;
    
    section.onclick = async () => {
        const index = notifications.findIndex(n => n.id === notif.id);
        if (index !== -1) {
            notifications[index].read = true;
            await saveNotifications();
            section.classList.remove('unread');
        }
    };
    
    return section;
}

async function addTweet(content) {
    const trimmed = content.trim();
    if (!trimmed) return;
    
    const profile = await getProfile();
    const tweet = {
        id: Date.now().toString(),
        author: '你',
        handle: profile.handle,
        content: trimmed,
        stats: { reply: 0, retweet: 0, like: 0 },
        timestamp: Date.now(),
        time: '現在'
    };
    
    userTweets.unshift(tweet);
    await saveUserTweets();
    
    scheduleReactionsForTweet(tweet);
    
    createToast('推文已發布');
}

async function addNpcTweet(npcName, content) {
    const trimmed = content.trim();
    if (!trimmed) return;
    
    const tweet = {
        id: Date.now().toString(),
        author: npcName,
        handle: `@${npcName.toLowerCase().replace(/\s+/g, '_')}`,
        content: trimmed,
        stats: { reply: 0, retweet: 0, like: 0 },
        timestamp: Date.now(),
        time: '現在'
    };
    
    npcTweets.unshift(tweet);
    await saveNpcTweets();
}

function isTweetBookmarked(tweetId) {
    return bookmarks.some(b => (b.id || b.timestamp) === tweetId);
}

async function toggleTweetBookmark(tweet) {
    const tweetId = tweet.id || tweet.timestamp;
    const existingIndex = bookmarks.findIndex(b => (b.id || b.timestamp) === tweetId);
    
    if (existingIndex >= 0) {
        bookmarks.splice(existingIndex, 1);
        await saveBookmarks();
        return false;
    } else {
        bookmarks.unshift({
            id: tweetId,
            author: tweet.author,
            handle: tweet.handle,
            content: tweet.content,
            timestamp: tweet.timestamp,
            bookmarkedAt: Date.now(),
            stats: tweet.stats
        });
        await saveBookmarks();
        return true;
    }
}

async function addNotification(notification) {
    notifications.unshift({
        ...notification,
        id: Date.now() + Math.random(),
        timestamp: Date.now(),
        read: false
    });
    await saveNotifications();
}

async function scheduleReactionsForTweet(tweet) {
    const npcFollows = await getNpcFollows();
    
    if (npcFollows.length === 0) return;
    
    for (const npcName of npcFollows) {
        if (Math.random() > 0.5) continue;
        
        const reactionType = Math.random();
        const minDelay = 30000;
        const maxDelay = 28800000;
        const delay = Math.random() * (maxDelay - minDelay) + minDelay;
        const scheduledTime = Date.now() + delay;
        
        if (reactionType < 0.4) {
            pendingReactions.push({
                type: 'like',
                fromName: npcName,
                tweetContent: tweet.content,
                tweetAuthor: tweet.author,
                scheduledTime
            });
        } else if (reactionType < 0.7) {
            pendingReactions.push({
                type: 'retweet',
                fromName: npcName,
                tweetContent: tweet.content,
                tweetAuthor: tweet.author,
                scheduledTime
            });
        } else {
            pendingReactions.push({
                type: 'reply',
                fromName: npcName,
                tweetContent: tweet.content,
                tweetAuthor: tweet.author,
                scheduledTime
            });
        }
    }
    
    await savePendingReactions();
}

async function processPendingReactions() {
    const now = Date.now();
    const remaining = [];
    
    for (const reaction of pendingReactions) {
        if (now >= reaction.scheduledTime) {
            await executeReaction(reaction);
        } else {
            remaining.push(reaction);
        }
    }
    
    pendingReactions = remaining;
    await savePendingReactions();
}

async function executeReaction(reaction) {
    const { type, fromName, tweetContent, tweetAuthor } = reaction;
    
    switch (type) {
        case 'like':
            await addNotification({
                type: 'like',
                fromName,
                tweetContent,
                tweetAuthor
            });
            break;
            
        case 'retweet':
            await addNotification({
                type: 'retweet',
                fromName,
                tweetContent,
                tweetAuthor
            });
            await addNpcTweet(fromName, `轉發了 @${tweetAuthor} 的推文\n${tweetContent}`);
            break;
            
        case 'reply':
            const replies = ['這個觀點很有趣！', '同意！', '說得好', '推一個', '真的假的？', '哈哈沒錯', '我也這麼覺得', '太扯了吧', '感謝分享！', '學到了新東西'];
            const replyContent = replies[Math.floor(Math.random() * replies.length)];
            await addNotification({
                type: 'reply',
                fromName,
                tweetContent,
                replyContent
            });
            await addNpcTweet(fromName, replyContent);
            break;
    }
}

function startNotificationSystem() {
    if (notificationInterval) return;
    notificationInterval = setInterval(processPendingReactions, 10000);
    processPendingReactions();
}

function stopNotificationSystem() {
    if (notificationInterval) {
        clearInterval(notificationInterval);
        notificationInterval = null;
    }
}

async function renderFeed(container) {
    const profile = await getProfile();
    const npcFollows = await getNpcFollows();
    
    let all = [...userTweets];
    
    if (npcFollows.length > 0) {
        const followedNpcTweets = npcTweets.filter(t => npcFollows.includes(t.author));
        all = [...all, ...followedNpcTweets];
    }
    
    const bookmarkIds = new Set(bookmarks.map(b => b.id || b.timestamp));
    const userIds = new Set(userTweets.map(t => t.id || t.timestamp));
    const preservedIds = new Set([...bookmarkIds, ...userIds]);
    
    const preservedTweets = all.filter(t => preservedIds.has(t.id || t.timestamp));
    const regularTweets = all.filter(t => !preservedIds.has(t.id || t.timestamp));
    const displayTweets = [...preservedTweets, ...regularTweets.slice(0, 50)];
    
    displayTweets.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    
    if (displayTweets.length === 0) {
        const emptyState = createEmptyState(
            'chat_bubble',
            '歡迎使用推特',
            '點擊右下角按鈕發布推文',
            {
                label: '發布推文',
                onClick: () => showComposeModal()
            }
        );
        container.appendChild(emptyState);
        return;
    }
    
    const feed = createElement('section', 'feed');
    
    for (const tweet of displayTweets) {
        const tweetId = tweet.id || tweet.timestamp;
        const isBookmarked = isTweetBookmarked(tweetId);
        const tweetEl = createTweetEl(tweet, profile, isBookmarked);
        
        const bookmarkBtn = tweetEl.querySelector('[data-action="bookmark"]');
        bookmarkBtn.onclick = async () => {
            const nowBookmarked = await toggleTweetBookmark(tweet);
            bookmarkBtn.classList.toggle('bookmarked', nowBookmarked);
            const icon = bookmarkBtn.querySelector('i');
            icon.className = nowBookmarked ? 'fas fa-bookmark' : 'far fa-bookmark';
        };
        
        feed.appendChild(tweetEl);
    }
    
    container.appendChild(feed);
}

async function renderBookmarksList(container) {
    if (bookmarks.length === 0) {
        const emptyState = createEmptyState(
            'bookmark',
            '尚無書籤',
            '在首頁點擊推文的書籤圖示即可收藏'
        );
        container.appendChild(emptyState);
        return;
    }
    
    const profile = await getProfile();
    const list = createElement('section', 'feed');
    
    for (const tweet of bookmarks) {
        const tweetEl = createTweetEl(tweet, profile, true);
        const bookmarkBtn = tweetEl.querySelector('[data-action="bookmark"]');
        
        bookmarkBtn.onclick = async () => {
            const tweetId = tweet.id || tweet.timestamp;
            const index = bookmarks.findIndex(b => (b.id || b.timestamp) === tweetId);
            if (index !== -1) {
                bookmarks.splice(index, 1);
                await saveBookmarks();
                tweetEl.remove();
                createToast('已移除書籤');
            }
        };
        
        list.appendChild(tweetEl);
    }
    
    container.appendChild(list);
}

async function renderNotificationsList(container) {
    if (notifications.length === 0) {
        const emptyState = createEmptyState(
            'notifications',
            '沒有通知',
            '當有人互動時會顯示在這裡'
        );
        container.appendChild(emptyState);
        return;
    }
    
    const list = createElement('section', 'notifications-list');
    
    for (const notif of notifications) {
        const notifEl = createNotificationEl(notif);
        list.appendChild(notifEl);
    }
    
    container.appendChild(list);
}

function showComposeModal() {
    const overlay = createElement('div', 'compose-modal-overlay');
    const modal = createElement('div', 'compose-modal card');
    
    modal.innerHTML = `
        <div class="compose-header">
            <button class="icon-btn compose-close" aria-label="關閉"><i class="fas fa-times"></i></button>
            <h3>發布推文</h3>
            <button class="primary-btn compose-submit" disabled>發布</button>
        </div>
        <div class="compose-body">
            <div class="avatar" style="background: ${DEFAULT_AVATAR}"></div>
            <textarea class="compose-textarea" placeholder="有什麼新鮮事？" rows="4"></textarea>
        </div>
    `;
    
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    
    const textarea = modal.querySelector('.compose-textarea');
    const submitBtn = modal.querySelector('.compose-submit');
    const closeBtn = modal.querySelector('.compose-close');
    
    textarea.oninput = () => {
        submitBtn.disabled = !textarea.value.trim();
    };
    
    submitBtn.onclick = async () => {
        const content = textarea.value.trim();
        if (!content) return;
        
        await addTweet(content);
        overlay.remove();
    };
    
    closeBtn.onclick = () => overlay.remove();
    overlay.onclick = (e) => {
        if (e.target === overlay) overlay.remove();
    };
    
    textarea.focus();
}

function showFabMenu(fabBtn, fabMenu) {
    fabMenuOpen = !fabMenuOpen;
    fabMenu.classList.toggle('show', fabMenuOpen);
    fabBtn.classList.toggle('open', fabMenuOpen);
}

function closeFabMenu(fabBtn, fabMenu) {
    fabMenuOpen = false;
    fabMenu.classList.remove('show');
    fabBtn.classList.remove('open');
}

async function renderTwitterHome() {
    userTweets = await getUserTweets();
    npcTweets = await getNpcTweets();
    bookmarks = await getBookmarks();
    notifications = await getNotifications();
    pendingReactions = await getPendingReactions();
    
    const container = createElement('div', 'twitter-app');
    
    const header = createElement('header', 'top-bar');
    header.innerHTML = `
        <button class="icon-btn" aria-label="返回"><i class="fas fa-chevron-left"></i></button>
        <div class="logo"><i class="fab fa-twitter"></i></div>
        <button class="icon-btn menu-toggle" aria-label="選單"><i class="fas fa-bars"></i></button>
    `;
    
    header.querySelector('.icon-btn').onclick = () => Router.back();
    container.appendChild(header);
    
    const main = createElement('main', 'content');
    
    const tabs = createElement('section', 'tabs card');
    tabs.innerHTML = `
        <button class="tab ${activeTab === 'forYou' ? 'active' : ''}" data-tab="forYou">為你推薦</button>
        <button class="tab ${activeTab === 'following' ? 'active' : ''}" data-tab="following">正在追蹤</button>
    `;
    
    tabs.querySelectorAll('.tab').forEach(tab => {
        tab.onclick = () => {
            activeTab = tab.dataset.tab;
            tabs.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === activeTab));
            const feed = main.querySelector('.feed');
            if (feed) {
                feed.innerHTML = '';
                renderFeed(feed);
            }
        };
    });
    
    main.appendChild(tabs);
    
    const feedContainer = createElement('div', 'feed-container');
    await renderFeed(feedContainer);
    main.appendChild(feedContainer);
    
    container.appendChild(main);
    
    const fabBtn = createElement('button', 'fab-btn', { ariaLabel: '發推' });
    fabBtn.innerHTML = '<i class="fas fa-plus"></i>';
    
    const fabMenu = createElement('div', 'fab-menu');
    fabMenu.innerHTML = `
        <button class="fab-menu-item fab-ai-generate">
            <i class="fas fa-wand-magic-sparkles"></i>
            <span>AI 生成推文</span>
        </button>
        <button class="fab-menu-item fab-compose">
            <i class="fas fa-pen"></i>
            <span>撰寫推文</span>
        </button>
    `;
    
    fabMenu.querySelector('.fab-compose').onclick = () => {
        closeFabMenu(fabBtn, fabMenu);
        showComposeModal();
    };
    
    fabMenu.querySelector('.fab-ai-generate').onclick = () => {
        closeFabMenu(fabBtn, fabMenu);
        createToast('AI 生成功能開發中');
    };
    
    fabBtn.onclick = () => showFabMenu(fabBtn, fabMenu);
    
    document.addEventListener('click', (e) => {
        if (fabMenuOpen && !fabMenu.contains(e.target) && !fabBtn.contains(e.target)) {
            closeFabMenu(fabBtn, fabMenu);
        }
    });
    
    container.appendChild(fabMenu);
    container.appendChild(fabBtn);
    
    startNotificationSystem();
    
    return { element: container, cleanup: stopNotificationSystem };
}

async function renderTwitterBookmarks() {
    bookmarks = await getBookmarks();
    
    const container = createElement('div', 'twitter-app');
    
    const header = createElement('header', 'top-bar');
    header.innerHTML = `
        <button class="icon-btn" aria-label="返回"><i class="fas fa-chevron-left"></i></button>
        <div class="logo"><i class="fab fa-twitter"></i></div>
        <button class="icon-btn" aria-label="選單" style="visibility:hidden"><i class="fas fa-bars"></i></button>
    `;
    
    header.querySelector('.icon-btn').onclick = () => Router.navigate('/twitter');
    container.appendChild(header);
    
    const main = createElement('main', 'content');
    
    const titleCard = createElement('section', 'card');
    titleCard.innerHTML = `
        <div class="tweet-header">
            <div>
                <span class="tweet-author">書籤</span>
            </div>
        </div>
    `;
    main.appendChild(titleCard);
    
    const feedContainer = createElement('div', 'feed-container');
    await renderBookmarksList(feedContainer);
    main.appendChild(feedContainer);
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

async function renderTwitterNotifications() {
    notifications = await getNotifications();
    
    const container = createElement('div', 'twitter-app');
    
    const header = createElement('header', 'top-bar');
    header.innerHTML = `
        <button class="icon-btn" aria-label="返回"><i class="fas fa-chevron-left"></i></button>
        <div class="logo"><i class="fab fa-twitter"></i></div>
        <button class="icon-btn" aria-label="選單" style="visibility:hidden"><i class="fas fa-bars"></i></button>
    `;
    
    header.querySelector('.icon-btn').onclick = () => Router.navigate('/twitter');
    container.appendChild(header);
    
    const main = createElement('main', 'content');
    
    const titleCard = createElement('section', 'card');
    titleCard.innerHTML = `
        <div class="tweet-header">
            <div>
                <span class="tweet-author">通知</span>
            </div>
        </div>
    `;
    main.appendChild(titleCard);
    
    const feedContainer = createElement('div', 'feed-container');
    await renderNotificationsList(feedContainer);
    main.appendChild(feedContainer);
    
    container.appendChild(main);
    
    startNotificationSystem();
    
    return { element: container, cleanup: stopNotificationSystem };
}

export default {
    id: 'twitter',
    name: 'Twitter',
    icon: 'tag',
    routes: [
        { path: '/twitter', render: renderTwitterHome },
        { path: '/twitter/bookmarks', render: renderTwitterBookmarks },
        { path: '/twitter/notifications', render: renderTwitterNotifications }
    ],
    navItem: {
        label: 'Twitter',
        icon: 'tag',
        path: '/twitter',
        showInNav: true,
        order: 3
    },
    styles: () => import('./style.css')
};