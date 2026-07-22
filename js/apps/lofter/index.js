import Router from '../../router.js';
import { createElement, createIcon, createKakaoBottomNav, createToast, createEmptyState } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

const STORAGE_KEYS = {
    cp_follow: 'lofter_cp_follow',
    follow_posts: 'lofter_follow_posts',
    idea_selection: 'lofter_idea_selection',
    selected_cp: 'lofter_selected_cp',
    content_rating: 'lofter_content_rating',
    content_length: 'lofter_content_length',
    bookmarks: 'lofter_bookmarks',
    cp_bodytypes: 'lofter_cp_bodytypes',
    generated_posts: 'lofter_generated_posts'
};

const AUTHOR_NAMES = [
    '夜貓子', '路人甲', '匿名用戶', '潛水員', '路人乙',
    '小透明', '吃瓜群眾', '佛系青年', '鹹魚一條', '摸魚達人',
    '社畜日常', '打工人', '搬磚人', '碼農一號', '設計師阿'
];

const worldSettings = [
    { title: 'ABO 設定', desc: 'Alpha/Beta/Omega 三種第二性別，基於信息素與生理本能的階級社會。', tags: ['#ABO', '#世界觀'] },
    { title: '哨兵嚮導', desc: '感官極端敏銳的哨兵與精神力量強大的嚮導。', tags: ['#哨兵嚮導', '#世界觀'] },
    { title: '哈利波特', desc: '隱藏在現代倫敦之下的魔法世界。', tags: ['#HP', '#魔法校園'] },
    { title: '日式高中校園', desc: '青春曖昧的校園生活。', tags: ['#校園', '#青春'] },
    { title: '辦公室職場', desc: '權力等級與禁止戀愛的辦公室。', tags: ['#職場', '#辦公室'] }
];

const interactionTropes = [
    { title: '重逢', desc: '多年後再次相遇，彼此都變了卻又沒變。', tags: ['#重逢', '#情感'] },
    { title: '誤會解開', desc: '一直以來的誤會終於解開，但似乎太遲了。', tags: ['#誤會', '#虐心'] },
    { title: '告白', desc: '終於鼓起勇氣說出心意。', tags: ['#告白', '#甜'] },
    { title: '契約關係', desc: '因利益被迫假扮情侶或夫妻。', tags: ['#假戲真做', '#契約'] },
    { title: '死對頭', desc: '雙方處於完全對立的立場。', tags: ['#宿敵', '#對立'] },
    { title: '身體互換', desc: '因意外或詛咒交換靈魂/身體。', tags: ['#身體互換', '#靈魂'] }
];

let currentPage = 'home';
let currentTab = 'recommend';
let postData = { recommend: [], follow: [], latest: [] };
let characters = [];

function escapeHTML(str = '') {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getRandomAuthorName() {
    return AUTHOR_NAMES[Math.floor(Math.random() * AUTHOR_NAMES.length)];
}

async function getStorageItem(key) {
    const value = await SettingsDB.get(key);
    return value !== undefined ? value : null;
}

async function setStorageItem(key, value) {
    await SettingsDB.set(key, value);
}

async function loadGeneratedPosts() {
    const data = await getStorageItem(STORAGE_KEYS.generated_posts);
    return Array.isArray(data) ? data : [];
}

async function saveGeneratedPost(post) {
    const posts = await loadGeneratedPosts();
    posts.unshift(post);
    await setStorageItem(STORAGE_KEYS.generated_posts, posts.slice(0, 50));
}

async function loadCharacters() {
    characters = await CharactersDB.getAll();
    return characters;
}

async function renderLofterApp() {
    await loadCharacters();
    const generatedPosts = await loadGeneratedPosts();
    postData.recommend = [...generatedPosts];
    postData.follow = [...generatedPosts];

    const container = createElement('div', 'lofter-app');
    
    const header = createHeader();
    container.appendChild(header);
    
    const main = createElement('main', 'lofter-content');
    main.appendChild(createHomePage());
    main.appendChild(createDiscoverPage());
    main.appendChild(createLikesPage());
    main.appendChild(createFollowPage());
    main.appendChild(createProfilePage());
    container.appendChild(main);
    
    const nav = createBottomNav();
    container.appendChild(nav);
    
    bindEvents(container);
    
    return { element: container, cleanup: null };
}

function createHeader() {
    const header = createElement('header', 'lofter-topbar');
    
    const backBtn = createElement('button', 'icon-btn', {
        onClick: () => Router.navigate('/home')
    });
    backBtn.appendChild(createIcon('chevron_left', 'text-white'));
    header.appendChild(backBtn);
    
    const brand = createElement('div', 'brand');
    const logoMark = createElement('span', 'logo-mark', { textContent: 'L' });
    const logoText = createElement('span', 'logo-text', { textContent: 'LOFTER' });
    brand.appendChild(logoMark);
    brand.appendChild(logoText);
    header.appendChild(brand);
    
    const publishBtn = createElement('button', 'publish-btn', {
        textContent: '發佈',
        onClick: handlePublish
    });
    header.appendChild(publishBtn);
    
    return header;
}

function createHomePage() {
    const page = createElement('section', 'page page-home is-active');
    page.dataset.page = 'home';
    
    const tabStrip = createElement('div', 'tab-strip');
    const tabList = createElement('div', 'tab-list');
    
    ['recommend', 'follow', 'latest'].forEach(tab => {
        const btn = createElement('button', `tab-btn ${tab === 'recommend' ? 'active' : ''}`, {
            textContent: tab === 'recommend' ? '推薦' : tab === 'follow' ? '關注' : '最新',
            dataTab: tab,
            onClick: () => switchTab(tab, page)
        });
        tabList.appendChild(btn);
    });
    
    tabStrip.appendChild(tabList);
    
    const viewToggle = createElement('button', 'view-toggle', {
        textContent: '瀑布流',
        onClick: () => toggleView(page)
    });
    tabStrip.appendChild(viewToggle);
    page.appendChild(tabStrip);
    
    const feed = createElement('section', 'feed');
    feed.id = 'lofter-feed';
    page.appendChild(feed);
    
    renderFeed(feed);
    
    return page;
}

function createDiscoverPage() {
    const page = createElement('section', 'page page-discover');
    page.dataset.page = 'discover';
    
    const grid = createElement('section', 'discover-grid');
    
    grid.appendChild(createWorldBookCard());
    grid.appendChild(createCpSetupCard());
    grid.appendChild(createIdeaCard());
    
    page.appendChild(grid);
    return page;
}

function createWorldBookCard() {
    const card = createElement('article', 'discover-card');
    card.appendChild(createElement('h3', '', { textContent: '世界書管理' }));
    card.appendChild(createElement('p', '', { textContent: '分類主題與時間線，集中管理角色、地點與事件條目。' }));
    
    const list = createElement('div', 'worldbook-list');
    list.id = 'lofter-worldbook-list';
    card.appendChild(list);
    
    const btn = createElement('button', 'discover-action', {
        textContent: '開啟世界書',
        onClick: () => Router.navigate('/world-info')
    });
    card.appendChild(btn);
    
    return card;
}

function createCpSetupCard() {
    const card = createElement('article', 'discover-card');
    card.appendChild(createElement('h3', '', { textContent: '正在關注的CP' }));
    card.appendChild(createElement('p', '', { textContent: '設定想看的 CP 向創作。' }));
    
    const form = createElement('div', 'cp-form');
    
    const topSelect = createElement('select', '');
    topSelect.id = 'lofter-cp-top';
    topSelect.appendChild(createElement('option', '', { value: '', textContent: '選擇攻方角色' }));
    characters.forEach(c => {
        topSelect.appendChild(createElement('option', '', { value: c.name, textContent: c.name }));
    });
    form.appendChild(createLabel('攻方角色', topSelect));
    
    const bottomSelect = createElement('select', '');
    bottomSelect.id = 'lofter-cp-bottom';
    bottomSelect.appendChild(createElement('option', '', { value: '', textContent: '選擇受方角色' }));
    characters.forEach(c => {
        bottomSelect.appendChild(createElement('option', '', { value: c.name, textContent: c.name }));
    });
    form.appendChild(createLabel('受方角色', bottomSelect));
    
    const addBtn = createElement('button', 'discover-action', {
        textContent: '加入關注',
        onClick: handleAddCp
    });
    form.appendChild(addBtn);
    
    const cpList = createElement('div', 'cp-list');
    cpList.id = 'lofter-cp-list';
    form.appendChild(cpList);
    
    card.appendChild(form);
    return card;
}

function createIdeaCard() {
    const card = createElement('article', 'discover-card');
    card.appendChild(createElement('h3', '', { textContent: '梗集便利貼' }));
    card.appendChild(createElement('p', '', { textContent: '快速收錄「如果…」的靈感。' }));
    
    const btn = createElement('button', 'discover-action', {
        textContent: '進入梗集',
        onClick: () => switchPage('idea')
    });
    card.appendChild(btn);
    
    return card;
}

function createLabel(text, input) {
    const label = createElement('label', 'cp-field');
    label.appendChild(createElement('span', '', { textContent: text }));
    label.appendChild(input);
    return label;
}

function createLikesPage() {
    const page = createElement('section', 'page page-likes');
    page.dataset.page = 'likes';
    
    const panel = createElement('section', 'likes-panel');
    
    panel.appendChild(createCpSelectSection());
    panel.appendChild(createContentSettings());
    
    const worldSection = createElement('section', 'trope-section');
    worldSection.appendChild(createElement('h3', 'trope-section-title', { textContent: '世界觀設定' }));
    const worldGrid = createElement('section', 'idea-grid');
    worldGrid.id = 'worldsetting-grid';
    renderIdeaGrid(worldGrid, worldSettings);
    worldSection.appendChild(worldGrid);
    panel.appendChild(worldSection);
    
    const interactionSection = createElement('section', 'trope-section');
    interactionSection.appendChild(createElement('h3', 'trope-section-title', { textContent: '互動梗' }));
    const interactionGrid = createElement('section', 'idea-grid');
    interactionGrid.id = 'interaction-grid';
    renderIdeaGrid(interactionGrid, interactionTropes);
    interactionSection.appendChild(interactionGrid);
    panel.appendChild(interactionSection);
    
    page.appendChild(panel);
    return page;
}

function createCpSelectSection() {
    const section = createElement('div', '');
    
    const cpList = createElement('div', 'cp-checkbox-list');
    cpList.id = 'lofter-cp-checkbox-list';
    renderCpCheckboxList(cpList);
    
    const label = createLabel('選擇 CP（可多選）', cpList);
    section.appendChild(label);
    
    return section;
}

function createContentSettings() {
    const container = createElement('div', '');
    
    const ratingLabel = createElement('label', 'cp-field');
    ratingLabel.appendChild(createElement('span', '', { textContent: '內容分級' }));
    const ratingBtns = createElement('div', 'rating-buttons');
    ['general', 'r18'].forEach(rating => {
        const btn = createElement('button', `rating-btn ${rating === 'general' ? 'active' : ''}`, {
            textContent: rating === 'general' ? '一般向' : 'R18 成人向',
            dataRating: rating,
            onClick: (e) => {
                ratingBtns.querySelectorAll('.rating-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                setStorageItem(STORAGE_KEYS.content_rating, rating);
            }
        });
        ratingBtns.appendChild(btn);
    });
    ratingLabel.appendChild(ratingBtns);
    container.appendChild(ratingLabel);
    
    const lengthLabel = createElement('label', 'cp-field');
    lengthLabel.appendChild(createElement('span', '', { textContent: '文章長度' }));
    const lengthBtns = createElement('div', 'length-buttons');
    [{ key: 'short', text: '短篇' }, { key: 'medium', text: '長篇' }, { key: 'series', text: '連載' }].forEach(item => {
        const btn = createElement('button', `length-btn ${item.key === 'medium' ? 'active' : ''}`, {
            textContent: item.text,
            dataLength: item.key,
            onClick: (e) => {
                lengthBtns.querySelectorAll('.length-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                setStorageItem(STORAGE_KEYS.content_length, item.key);
            }
        });
        lengthBtns.appendChild(btn);
    });
    lengthLabel.appendChild(lengthBtns);
    container.appendChild(lengthLabel);
    
    const generateBtn = createElement('button', 'idea-primary', {
        textContent: '生成同人文',
        onClick: handleGenerate
    });
    container.appendChild(generateBtn);
    
    return container;
}

function createFollowPage() {
    const page = createElement('section', 'page page-follow');
    page.dataset.page = 'follow';
    
    const header = createElement('header', 'discover-header');
    header.appendChild(createElement('h2', '', { textContent: '追蹤' }));
    page.appendChild(header);
    
    const feed = createElement('section', 'feed');
    feed.id = 'follow-feed';
    page.appendChild(feed);
    
    renderFollowFeed(feed);
    
    return page;
}

function createProfilePage() {
    const page = createElement('section', 'page page-profile');
    page.dataset.page = 'profile';
    
    const card = createElement('article', 'post-card');
    const postHead = createElement('header', 'post-head');
    postHead.appendChild(createElement('div', 'avatar'));
    
    const info = createElement('div', '');
    info.appendChild(createElement('div', 'author', { textContent: '霧夜寫手' }));
    info.appendChild(createElement('div', 'meta', { textContent: 'ID：sx-0413' }));
    postHead.appendChild(info);
    card.appendChild(postHead);
    
    card.appendChild(createElement('p', 'post-text', { textContent: '偏好：長篇連載 · 角色獨白 · AU' }));
    page.appendChild(card);
    
    return page;
}

function createBottomNav() {
    const nav = createElement('nav', 'bottom-nav');
    
    const items = [
        { page: 'home', icon: 'home', label: '首頁' },
        { page: 'discover', icon: 'explore', label: '發現' },
        { page: 'likes', icon: 'favorite', label: '喜歡' },
        { page: 'follow', icon: 'star', label: '追蹤' },
        { page: 'profile', icon: 'person', label: '我的' }
    ];
    
    items.forEach(item => {
        const btn = createElement('button', `nav-item ${item.page === 'home' ? 'active' : ''}`, {
            onClick: () => switchPage(item.page)
        });
        btn.appendChild(createIcon(item.icon, ''));
        btn.appendChild(createElement('span', '', { textContent: item.label }));
        nav.appendChild(btn);
    });
    
    return nav;
}

function switchPage(pageName) {
    currentPage = pageName;
    const container = document.querySelector('.lofter-app');
    if (!container) return;
    
    container.querySelectorAll('.page').forEach(page => {
        page.classList.toggle('is-active', page.dataset.page === pageName);
    });
    
    container.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
    });
    const activeNav = container.querySelector(`.nav-item:nth-child(${['home', 'discover', 'likes', 'follow', 'profile'].indexOf(pageName) + 1})`);
    if (activeNav) activeNav.classList.add('active');
}

function switchTab(tab, page) {
    currentTab = tab;
    const tabList = page.querySelector('.tab-list');
    if (!tabList) return;
    
    tabList.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tab);
    });
    
    const feed = page.querySelector('#lofter-feed');
    if (feed) renderFeed(feed);
}

function toggleView(page) {
    const feed = page.querySelector('#lofter-feed');
    if (!feed) return;
    feed.classList.toggle('waterfall');
}

async function renderFeed(feed) {
    if (!feed) return;
    
    const posts = postData[currentTab] || [];
    
    if (posts.length === 0) {
        feed.innerHTML = '';
        const empty = createEmptyState('article', '尚無文章', '開始探索同人文創作');
        feed.appendChild(empty);
        return;
    }
    
    feed.innerHTML = '';
    posts.forEach((post, index) => {
        const card = createPostCard(post, index);
        feed.appendChild(card);
    });
}

function createPostCard(post, index) {
    const card = createElement('article', 'post-card post-card-compact');
    card.dataset.index = index;
    
    const header = createElement('div', 'post-card-header', {
        onClick: () => card.classList.toggle('is-expanded')
    });
    header.appendChild(createElement('h2', 'post-title', { textContent: post.title }));
    header.appendChild(createElement('p', 'post-summary', { textContent: post.summary || post.text?.slice(0, 100) }));
    
    const meta = createElement('div', 'post-card-meta');
    meta.appendChild(createElement('span', 'post-author', { textContent: post.author }));
    meta.appendChild(createElement('span', 'post-time', { textContent: post.time }));
    header.appendChild(meta);
    
    card.appendChild(header);
    
    const content = createElement('div', 'post-card-content');
    content.appendChild(createElement('div', 'post-full-content', { textContent: post.fullContent || post.text }));
    
    const tags = createElement('div', 'post-tags');
    (post.tags || []).forEach(tag => {
        tags.appendChild(createElement('span', 'post-tag', { textContent: tag }));
    });
    content.appendChild(tags);
    
    const actions = createElement('footer', 'post-actions');
    actions.appendChild(createElement('button', 'action', { textContent: '♥ ' + (post.likes || 0) }));
    actions.appendChild(createElement('button', 'action', { textContent: '💬 ' + (post.comments || 0) }));
    actions.appendChild(createElement('button', 'action', {
        textContent: '🔖 書籤',
        onClick: async () => {
            await saveBookmark(post);
            createToast('已加入書籤');
        }
    }));
    content.appendChild(actions);
    
    card.appendChild(content);
    return card;
}

function renderIdeaGrid(grid, items) {
    grid.innerHTML = '';
    items.forEach((item, index) => {
        const card = createElement('article', 'idea-card', {
            onClick: () => card.classList.toggle('selected')
        });
        card.dataset.index = index;
        card.appendChild(createElement('h3', '', { textContent: item.title }));
        card.appendChild(createElement('p', '', { textContent: item.desc }));
        
        const tags = createElement('div', 'idea-tags');
        item.tags.forEach(tag => {
            tags.appendChild(createElement('span', 'idea-tag', { textContent: tag }));
        });
        card.appendChild(tags);
        
        grid.appendChild(card);
    });
}

async function renderCpCheckboxList(container) {
    const cpList = await getStorageItem(STORAGE_KEYS.cp_follow) || [];
    
    if (cpList.length === 0) {
        container.appendChild(createElement('div', 'cp-empty', { textContent: '尚未設定關注 CP' }));
        return;
    }
    
    const selectedCp = await getStorageItem(STORAGE_KEYS.selected_cp) || [];
    const selectedSet = new Set(selectedCp);
    
    container.innerHTML = '';
    cpList.forEach((item, index) => {
        const cpName = `${item.top} × ${item.bottom}`;
        const isSelected = selectedSet.has(cpName);
        
        const itemDiv = createElement('div', `cp-checkbox-item ${isSelected ? 'selected' : ''}`);
        itemDiv.dataset.cp = cpName;
        
        const checkbox = createElement('input', '');
        checkbox.type = 'checkbox';
        checkbox.id = `cp-${index}`;
        checkbox.checked = isSelected;
        checkbox.addEventListener('change', () => saveCpSelection(container));
        
        const label = createElement('label', '');
        label.htmlFor = checkbox.id;
        label.textContent = cpName;
        
        itemDiv.appendChild(checkbox);
        itemDiv.appendChild(label);
        container.appendChild(itemDiv);
    });
}

async function saveCpSelection(container) {
    const selected = [];
    container.querySelectorAll('input[type="checkbox"]:checked').forEach(cb => {
        const item = cb.closest('.cp-checkbox-item');
        if (item?.dataset?.cp) selected.push(item.dataset.cp);
    });
    await setStorageItem(STORAGE_KEYS.selected_cp, selected);
}

async function renderFollowFeed(feed) {
    if (!feed) return;
    
    const followPosts = await getStorageItem(STORAGE_KEYS.follow_posts) || [];
    
    if (followPosts.length === 0) {
        feed.innerHTML = '';
        const empty = createEmptyState('star', '尚未追蹤任何文章', '在文章中點擊「追蹤」按鈕即可追蹤');
        feed.appendChild(empty);
        return;
    }
    
    feed.innerHTML = '';
    followPosts.forEach((post, index) => {
        const card = createPostCard(post, index);
        feed.appendChild(card);
    });
}

async function handleAddCp() {
    const topSelect = document.getElementById('lofter-cp-top');
    const bottomSelect = document.getElementById('lofter-cp-bottom');
    
    if (!topSelect?.value || !bottomSelect?.value) {
        createToast('請選擇攻方與受方角色');
        return;
    }
    
    const cpList = await getStorageItem(STORAGE_KEYS.cp_follow) || [];
    cpList.unshift({ top: topSelect.value, bottom: bottomSelect.value });
    await setStorageItem(STORAGE_KEYS.cp_follow, cpList);
    
    topSelect.value = '';
    bottomSelect.value = '';
    
    const cpListEl = document.getElementById('lofter-cp-list');
    if (cpListEl) renderCpListElement(cpListEl);
    
    const cpCheckboxList = document.getElementById('lofter-cp-checkbox-list');
    if (cpCheckboxList) renderCpCheckboxList(cpCheckboxList);
    
    createToast('已加入關注');
}

async function renderCpListElement(container) {
    const cpList = await getStorageItem(STORAGE_KEYS.cp_follow) || [];
    
    container.innerHTML = '';
    if (cpList.length === 0) {
        container.appendChild(createElement('div', 'cp-item', { textContent: '尚未設定關注 CP' }));
        return;
    }
    
    cpList.forEach((item, index) => {
        const itemDiv = createElement('div', 'cp-item');
        itemDiv.appendChild(createElement('span', '', { textContent: `${item.top} × ${item.bottom}` }));
        
        const removeBtn = createElement('button', '', {
            textContent: '移除',
            onClick: async () => {
                cpList.splice(index, 1);
                await setStorageItem(STORAGE_KEYS.cp_follow, cpList);
                renderCpListElement(container);
            }
        });
        itemDiv.appendChild(removeBtn);
        container.appendChild(itemDiv);
    });
}

async function handlePublish() {
    const selectedCp = await getStorageItem(STORAGE_KEYS.selected_cp) || [];
    if (selectedCp.length === 0) {
        createToast('請先選擇要生成的 CP');
        switchPage('likes');
        return;
    }
    await handleGenerate();
}

async function handleGenerate() {
    const selectedCp = await getStorageItem(STORAGE_KEYS.selected_cp) || [];
    if (selectedCp.length === 0) {
        createToast('請先選擇 CP');
        return;
    }
    
    const worldGrid = document.getElementById('worldsetting-grid');
    const interactionGrid = document.getElementById('interaction-grid');
    
    const selectedWorldSettings = [];
    worldGrid?.querySelectorAll('.idea-card.selected').forEach(card => {
        const index = parseInt(card.dataset.index);
        if (worldSettings[index]) selectedWorldSettings.push(worldSettings[index]);
    });
    
    const selectedInteractions = [];
    interactionGrid?.querySelectorAll('.idea-card.selected').forEach(card => {
        const index = parseInt(card.dataset.index);
        if (interactionTropes[index]) selectedInteractions.push(interactionTropes[index]);
    });
    
    const rating = await getStorageItem(STORAGE_KEYS.content_rating) || 'general';
    const length = await getStorageItem(STORAGE_KEYS.content_length) || 'medium';
    
    const post = {
        id: Date.now().toString(),
        title: `${selectedCp[0]} - ${selectedInteractions[0]?.title || '互動'}`,
        author: getRandomAuthorName(),
        category: '同人文',
        text: '這是一篇由 AI 生成的同人文，請設定 API 以實際生成內容。',
        fullContent: '這是一篇由 AI 生成的同人文。\n\n請在設定頁面配置 API 以啟用實際的內容生成功能。\n\n目前支援 OpenAI 相容 API 和 Gemini API。',
        tags: [...selectedCp, '#同人文', ...(selectedWorldSettings[0]?.tags || []), ...(selectedInteractions[0]?.tags || [])],
        time: '剛剛',
        likes: 0,
        comments: 0,
        isR18: rating === 'r18',
        contentLength: length
    };
    
    await saveGeneratedPost(post);
    postData.recommend.unshift(post);
    postData.follow.unshift(post);
    
    const feed = document.getElementById('lofter-feed');
    if (feed) renderFeed(feed);
    
    createToast('已生成同人文');
    switchPage('home');
}

async function saveBookmark(post) {
    const bookmarks = await getStorageItem(STORAGE_KEYS.bookmarks) || [];
    bookmarks.unshift({ ...post, bookmarkedAt: Date.now() });
    await setStorageItem(STORAGE_KEYS.bookmarks, bookmarks.slice(0, 100));
}

function bindEvents(container) {
    container.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => {
            const pageIndex = Array.from(container.querySelectorAll('.nav-item')).indexOf(item);
            const pages = ['home', 'discover', 'likes', 'follow', 'profile'];
            if (pages[pageIndex]) switchPage(pages[pageIndex]);
        });
    });
}

export default {
    id: 'lofter',
    name: 'LOFTER',
    icon: 'article',
    routes: [
        { path: '/lofter', render: renderLofterApp }
    ],
    navItem: {
        label: 'LOFTER',
        icon: 'article',
        path: '/lofter',
        showInNav: true,
        order: 20
    },
    styles: () => import('./style.css')
};
