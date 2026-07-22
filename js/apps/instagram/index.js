import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

const STORAGE_KEYS = {
    stories: 'instagram_stories',
    posts: 'instagram_posts',
    userPosts: 'instagram_user_posts',
    saved: 'instagram_saved',
    memories: 'instagram_memories'
};

let storiesData = [
    { id: 'story-1', name: 'sunny._.lia', avatar: 'https://images.unsplash.com/photo-1503023345310-bd7c1de61c7d?auto=format&fit=crop&w=200&q=60' },
    { id: 'story-2', name: 'studiochoco', avatar: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=200&q=60' },
    { id: 'story-3', name: 'coffee.ca', avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?auto=format&fit=crop&w=200&q=60' },
    { id: 'story-4', name: 'voyager', avatar: 'https://images.unsplash.com/photo-1459257868276-5e65389e2722?auto=format&fit=crop&w=200&q=60' }
];

let postsData = [
    { id: 'post-1', user: 'circularstudio', location: 'Taipei, Taiwan', avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=60', image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=60', liked: false, likes: 1287, caption: 'Color grading session with gradient murals. #art #studio', time: '1 小時前' },
    { id: 'post-2', user: 'neon.night', location: 'Shibuya', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=200&q=60', image: 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=800&q=60', liked: true, likes: 40211, caption: '雨後的霓虹總是讓人重啟靈感。', time: '4 小時前' },
    { id: 'post-3', user: 'nomad.eats', location: 'Lisbon', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=200&q=60', image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=800&q=60', liked: false, likes: 987, caption: '橄欖油、海鹽與太陽的味道。', time: '昨天' }
];

let isGeneratingPosts = false;
let isGeneratingStories = false;

async function getFromSettings(key, fallback = null) {
    const value = await SettingsDB.get(key);
    return value !== undefined ? value : fallback;
}

async function setToSettings(key, value) {
    await SettingsDB.set(key, value);
}

async function getPostMemories() {
    const raw = await getFromSettings(STORAGE_KEYS.memories, '[]');
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function savePostMemories(memories) {
    const trimmed = memories.length > 500 ? memories.slice(-500) : memories;
    await setToSettings(STORAGE_KEYS.memories, JSON.stringify(trimmed));
}

async function addPostMemory(post) {
    if (post.isUserPost) return;
    const memories = await getPostMemories();
    if (memories.find(m => m.id === post.id)) return;
    const date = new Date(post.timestamp || Date.now());
    const dateStr = `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
    memories.push({ id: post.id, user: post.user, caption: post.caption, date: dateStr, timestamp: post.timestamp });
    await savePostMemories(memories);
}

async function getSavedPosts() {
    const raw = await getFromSettings(STORAGE_KEYS.saved, '[]');
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveSavedPosts(savedIds) {
    await setToSettings(STORAGE_KEYS.saved, JSON.stringify(savedIds));
}

async function getUserPosts() {
    const raw = await getFromSettings(STORAGE_KEYS.userPosts, '[]');
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveUserPosts(posts) {
    posts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    await setToSettings(STORAGE_KEYS.userPosts, JSON.stringify(posts));
}

async function getStoredPosts() {
    const raw = await getFromSettings(STORAGE_KEYS.posts, '[]');
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveStoredPosts(posts) {
    const savedIds = new Set(await getSavedPosts());
    const userIds = new Set((await getUserPosts()).map(p => p.id));
    const preservedIds = new Set([...savedIds, ...userIds]);
    const toRemove = posts.filter(p => !preservedIds.has(p.id));
    for (const post of toRemove) await addPostMemory(post);
    const preservedPosts = posts.filter(p => preservedIds.has(p.id));
    const regularPosts = posts.filter(p => !preservedIds.has(p.id));
    const trimmedRegular = regularPosts.slice(0, 50);
    const finalPosts = [...preservedPosts, ...trimmedRegular];
    finalPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    await setToSettings(STORAGE_KEYS.posts, JSON.stringify(finalPosts));
}

async function getIgStories() {
    const raw = await getFromSettings(STORAGE_KEYS.stories, '[]');
    try {
        return JSON.parse(raw);
    } catch {
        return [];
    }
}

async function saveIgStory(story) {
    const stories = await getIgStories();
    stories.unshift({ ...story, id: `ig-story-${Date.now()}`, createdAt: Date.now() });
    const trimmed = stories.slice(0, 20);
    await setToSettings(STORAGE_KEYS.stories, JSON.stringify(trimmed));
}

async function addIgStory(authorName, content) {
    const story = { name: authorName, content: content, avatar: '' };
    const characters = await CharactersDB.getAll();
    const charData = characters.find(c => c.name === authorName);
    if (charData && charData.avatar) story.avatar = charData.avatar;
    await saveIgStory(story);
}

async function getApiConfig() {
    const apiUrl = await getFromSettings('api_url');
    const apiKey = await getFromSettings('api_key');
    const model = await getFromSettings('model', 'gpt-3.5-turbo');
    if (!apiUrl) return null;
    return { url: apiUrl, key: apiKey, model: model };
}

async function callAIAPI(messages, temperature) {
    const temp = temperature || 0.85;
    const config = await getApiConfig();
    if (!config || !config.url) throw new Error('尚未設定 API');
    const endpoint = config.url.endsWith('/chat/completions') ? config.url : `${config.url.replace(/\/$/, '')}/chat/completions`;
    const headers = { 'Content-Type': 'application/json' };
    if (config.key) headers.Authorization = `Bearer ${config.key}`;
    const response = await fetch(endpoint, { method: 'POST', headers: headers, body: JSON.stringify({ model: config.model, messages: messages, temperature: temp }) });
    if (!response.ok) throw new Error(`API 錯誤 (${response.status})`);
    const data = await response.json();
    return data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '';
}

async function buildInstagramContext() {
    const characters = await CharactersDB.getAll();
    const char = characters.length > 0 ? characters[0] : null;
    let context = '# 使用者設定\n名稱: User\n';
    if (char) {
        context += `\n# 角色設定\n名稱: ${char.name}\n`;
        if (char.personality) context += `性格: ${char.personality}\n`;
        if (char.description) context += `背景: ${char.description}\n`;
    }
    return context;
}

async function generateAIPosts(container) {
    if (isGeneratingPosts) { createToast('正在生成中，請稍候...'); return; }
    isGeneratingPosts = true;
    const generateBtn = container.querySelector('#ai-generate-posts-btn');
    if (generateBtn) { generateBtn.disabled = true; generateBtn.textContent = '生成中...'; }
    try {
        const context = await buildInstagramContext();
        const systemPrompt = '你是一位專業的社群媒體內容創作者，擅長根據角色設定和使用者背景創作符合人物性格的 Instagram 貼文。請使用繁體中文撰寫。輸出格式為 JSON: {"posts": [{"user": "用戶名", "location": "地點", "caption": "貼文說明", "likes": 隨機讚數}]}';
        const prompt = `${context}\n\n請生成 3 則 Instagram 貼文，要求：\n1. 符合角色性格和使用者設定\n2. 每則貼文說明 30-100 字\n3. 可以包含適當的表情符號和標標籤\n\n輸出 JSON 格式。`;
        const result = await callAIAPI([{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]);
        let parsed = null;
        try { parsed = JSON.parse(result); } catch (e) { const match = result.match(/\{[\s\S]*\}/); if (match) parsed = JSON.parse(match[0]); }
        const posts = Array.isArray(parsed && parsed.posts) ? parsed.posts : [];
        const storedPosts = await getStoredPosts();
        posts.forEach((post, index) => {
            if (post.caption) {
                const newPost = {
                    id: `ai-post-${Date.now()}-${index}`,
                    user: post.user || 'User',
                    location: post.location || '',
                    avatar: 'https://images.unsplash.com/photo-1544723795-3fb6469f5b39?auto=format&fit=crop&w=200&q=60',
                    image: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?auto=format&fit=crop&w=800&q=60',
                    liked: false,
                    likes: post.likes || Math.floor(Math.random() * 5000),
                    caption: post.caption,
                    time: '剛剛',
                    timestamp: Date.now(),
                    isUserPost: post.user === 'User'
                };
                storedPosts.unshift(newPost);
            }
        });
        await saveStoredPosts(storedPosts);
        if (posts.length > 0) { await renderFeed(container); } else { createToast('生成失敗，請稍後重試'); }
    } catch (err) { createToast(`生成失敗: ${err.message}`); } finally {
        isGeneratingPosts = false;
        if (generateBtn) { generateBtn.disabled = false; generateBtn.textContent = 'AI 生成貼文'; }
    }
}

async function generateAIStories(container) {
    if (isGeneratingStories) { createToast('正在生成中，請稍候...'); return; }
    isGeneratingStories = true;
    const generateBtn = container.querySelector('#ai-generate-story-btn');
    if (generateBtn) { generateBtn.disabled = true; generateBtn.textContent = '生成中...'; }
    try {
        const context = await buildInstagramContext();
        const characters = await CharactersDB.getAll();
        const authors = ['User'].concat(characters.slice(0, 1).map(c => c.name));
        const systemPrompt = '你是一位專業的社群媒體內容創作者，擅長創作 Instagram 限時動態。請使用繁體中文撰寫。輸出格式為 JSON: {"stories": [{"author": "作者名", "content": "限動內容"}]}';
        const prompt = `${context}\n\n請為以下作者各生成 1 則限時動態：${authors.join('、')}\n\n要求：\n1. 符合各角色性格和設定\n2. 簡短有趣、生活化\n3. 20-50 字\n\n輸出 JSON 格式。`;
        const result = await callAIAPI([{ role: 'system', content: systemPrompt }, { role: 'user', content: prompt }]);
        let parsed = null;
        try { parsed = JSON.parse(result); } catch (e) { const match = result.match(/\{[\s\S]*\}/); if (match) parsed = JSON.parse(match[0]); }
        const stories = Array.isArray(parsed && parsed.stories) ? parsed.stories : [];
        for (const story of stories) { if (story.author && story.content) await addIgStory(story.author, story.content); }
        if (stories.length > 0) { await renderStories(container); } else { createToast('生成失敗，請稍後重試'); }
    } catch (err) { createToast(`生成失敗: ${err.message}`); } finally {
        isGeneratingStories = false;
        if (generateBtn) { generateBtn.disabled = false; generateBtn.textContent = 'AI 生成限動'; }
    }
}

function formatLikes(num) {
    if (num >= 10000) return `${(num / 1000).toFixed(1)}k`;
    return num.toLocaleString('zh-TW');
}

async function renderStories(container) {
    const storiesTrack = container.querySelector('#stories-track');
    if (!storiesTrack) return;
    storiesTrack.innerHTML = '';
    const igStories = await getIgStories();
    igStories.forEach((story) => {
        const button = createElement('button', 'story');
        if (story.avatar) {
            button.innerHTML = `<div class="avatar"><img src="${story.avatar}" alt="${story.name} story"></div><span>${story.name}</span>`;
        } else {
            button.innerHTML = `<div class="avatar" style="background: linear-gradient(135deg, #f09433, #e6683c, #dc2743, #cc2366, #bc1888);"></div><span>${story.name}</span>`;
        }
        button.addEventListener('click', () => button.classList.add('seen'));
        storiesTrack.appendChild(button);
    });
    storiesData.forEach((story) => {
        const button = createElement('button', 'story');
        button.innerHTML = `<div class="avatar"><img src="${story.avatar}" alt="${story.name} story"></div><span>${story.name}</span>`;
        button.addEventListener('click', () => button.classList.add('seen'));
        storiesTrack.appendChild(button);
    });
}

function createPostElement(post) {
    const article = createElement('article', 'post');
    article.dataset.postId = post.id;
    article.innerHTML = `
        <div class="post-header">
            <div class="post-user">
                <div class="avatar-ring"><img src="${post.avatar}" alt="${post.user}"></div>
                <div>
                    <strong>${post.user}</strong>
                    <div class="post-meta">${post.location}</div>
                </div>
            </div>
            <button class="icon-btn"><i class="fa-solid fa-ellipsis"></i></button>
        </div>
        <div class="post-image">
            <img src="${post.image}" alt="${post.user} post">
            <i class="fa-solid fa-heart like-heart"></i>
        </div>
        <div class="post-actions">
            <div>
                <button class="like-btn"><i class="fa${post.liked ? '-solid' : '-regular'} fa-heart"></i></button>
                <button><i class="fa-regular fa-comment"></i></button>
                <button><i class="fa-regular fa-paper-plane"></i></button>
            </div>
            <button class="bookmark-btn" data-post-id="${post.id}"><i class="fa-regular fa-bookmark"></i></button>
        </div>
        <div class="post-stats"><strong class="likes-count">${formatLikes(post.likes)} 個讚</strong></div>
        <div class="caption"><strong>${post.user}</strong>${post.caption}</div>
        <div class="view-comments">查看全部 37 則留言</div>
        <div class="view-comments">${post.time}</div>
    `;
    bindPostInteractions(article, post);
    return article;
}

async function bindPostInteractions(article, post) {
    const likeBtn = article.querySelector('.like-btn');
    const likesCount = article.querySelector('.likes-count');
    const heartOverlay = article.querySelector('.like-heart');
    const image = article.querySelector('.post-image');
    const bookmarkBtn = article.querySelector('.bookmark-btn');
    const updateIcon = () => {
        likeBtn.innerHTML = `<i class="fa${post.liked ? '-solid' : '-regular'} fa-heart"></i>`;
        likeBtn.classList.toggle('active', post.liked);
        likesCount.textContent = `${formatLikes(post.likes)} 個讚`;
    };
    const toggleLike = (triggerOverlay) => {
        post.liked = !post.liked;
        post.likes += post.liked ? 1 : -1;
        updateIcon();
        if (triggerOverlay) {
            heartOverlay.classList.remove('active');
            void heartOverlay.offsetWidth;
            heartOverlay.classList.add('active');
        }
    };
    likeBtn.addEventListener('click', () => toggleLike(false));
    image.addEventListener('dblclick', () => {
        if (!post.liked) toggleLike(true);
        else {
            heartOverlay.classList.remove('active');
            void heartOverlay.offsetWidth;
            heartOverlay.classList.add('active');
        }
    });
    bookmarkBtn.addEventListener('click', async () => {
        const savedIds = await getSavedPosts();
        const isSaved = savedIds.includes(post.id);
        if (isSaved) {
            const newSavedIds = savedIds.filter(id => id !== post.id);
            await saveSavedPosts(newSavedIds);
            bookmarkBtn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
        } else {
            savedIds.push(post.id);
            await saveSavedPosts(savedIds);
            bookmarkBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        }
    });
}

async function renderFeed(container) {
    const feedEl = container.querySelector('#feed');
    if (!feedEl) return;
    const userPosts = await getUserPosts();
    const storedPosts = await getStoredPosts();
    const savedIds = new Set(await getSavedPosts());
    let allPosts = userPosts.concat(storedPosts);
    const userIds = new Set(userPosts.map(p => p.id));
    const preservedIds = new Set(Array.from(savedIds).concat(Array.from(userIds)));
    const preservedPosts = allPosts.filter(p => preservedIds.has(p.id));
    const regularPosts = allPosts.filter(p => !preservedIds.has(p.id));
    const displayPosts = preservedPosts.concat(regularPosts.slice(0, 50));
    displayPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (displayPosts.length === 0) displayPosts.push.apply(displayPosts, postsData);
    feedEl.innerHTML = '';
    displayPosts.forEach(post => feedEl.appendChild(createPostElement(post)));
}

async function renderInstagram(params) {
    const container = createElement('div', 'ig-app');
    container.innerHTML = `
        <header class="ig-header">
            <button class="icon-btn" id="back-btn" aria-label="返回">
                <i class="fa-solid fa-chevron-left"></i>
            </button>
            <h1 class="logo">Instagram</h1>
            <div class="header-actions">
                <button class="icon-btn" id="ai-generate-story-btn" aria-label="生成限動">
                    <i class="fa-solid fa-wand-magic-sparkles"></i>
                </button>
                <button class="icon-btn" id="ai-generate-posts-btn" aria-label="生成貼文">
                    <i class="fa-solid fa-robot"></i>
                </button>
            </div>
        </header>
        <section class="stories" aria-label="Stories">
            <button class="story camera" aria-label="Add Story">
                <div class="avatar">
                    <i class="fa-solid fa-plus"></i>
                </div>
                <span>你的限動</span>
            </button>
            <div class="stories-track" id="stories-track"></div>
        </section>
        <main class="feed" id="feed" aria-live="polite"></main>
        <nav class="bottom-nav" aria-label="主要導覽">
            <button class="nav-btn active" data-tab="home"><i class="fa-solid fa-house"></i></button>
            <button class="nav-btn" data-tab="search"><i class="fa-regular fa-compass"></i></button>
            <button class="nav-btn" data-tab="reels"><i class="fa-solid fa-clapperboard"></i></button>
            <button class="nav-btn" data-tab="shop"><i class="fa-regular fa-bag-shopping"></i></button>
            <button class="nav-btn" data-tab="profile" id="profile-btn">
                <span class="nav-avatar"></span>
            </button>
        </nav>
    `;
    container.querySelector('#back-btn').onclick = () => Router.navigate('/');
    container.querySelector('#ai-generate-posts-btn').onclick = () => generateAIPosts(container);
    container.querySelector('#ai-generate-story-btn').onclick = () => generateAIStories(container);
    const navButtons = container.querySelectorAll('.bottom-nav .nav-btn');
    navButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            navButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });
    await renderStories(container);
    await renderFeed(container);
    return { element: container, cleanup: null };
}

export default {
    id: 'instagram',
    name: 'Instagram',
    icon: 'photo_camera',
    routes: [{ path: '/instagram', render: renderInstagram }],
    navItem: { label: 'Instagram', icon: 'photo_camera', path: '/instagram', showInNav: true, order: 30 },
    styles: () => import('./style.css')
};
