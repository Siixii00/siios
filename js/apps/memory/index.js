import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { MemoryDB } from '../../db.js';

let memories = [];
let currentFilter = 0;
let searchTerm = '';

const TYPE_TABS = ['全部', '動態', '永久', '情感', '計畫', '書信', '自我', '歸檔'];
const TYPE_MAP = { 1: 'dynamic', 2: 'permanent', 3: 'feel', 4: 'plan', 5: 'letter', 6: 'i', 7: 'archive' };
const TYPE_LABELS = { dynamic: '動態', permanent: '永久', feel: '情感', plan: '計畫', letter: '書信', i: '自我', archive: '歸檔' };

const SOURCE_LABELS = {
    'chat': '對話',
    'youtube': 'YouTube',
    'instagram': 'Instagram',
    'chrome': 'Chrome',
    'dating': '約會',
    'bubbles': 'Bubbles',
    'weverse': 'Weverse',
    'bilibili': 'Bilibili',
    'twitch': 'Twitch',
    'twitter': 'Twitter',
    'ao3': 'AO3',
    'lofter': 'Lofter',
    'theater': '劇場'
};

function getSourceLabel(sourceApp) {
    return SOURCE_LABELS[sourceApp] || sourceApp || '未知';
}

function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分鐘前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小時前';
    if (diff < 604800000) return Math.floor(diff / 86400000) + ' 天前';
    const date = new Date(timestamp);
    return (date.getMonth() + 1) + '/' + date.getDate();
}

function getDecayStage(memory) {
    const importance = memory.importance || 0.5;
    const decayFactor = memory.decayFactor || 1.0;
    const effective = importance * decayFactor;
    if (effective >= 0.7) return { label: '鮮明', dotClass: 'decay-dot-fresh', badgeClass: 'decay-badge-fresh' };
    if (effective >= 0.4) return { label: '模糊', dotClass: 'decay-dot-fading', badgeClass: 'decay-badge-fading' };
    if (effective >= 0.1) return { label: '衰退', dotClass: 'decay-dot-decaying', badgeClass: 'decay-badge-decaying' };
    return { label: '微弱', dotClass: 'decay-dot-weak', badgeClass: 'decay-badge-weak' };
}

function getFilteredMemories() {
    let filtered = [...memories];
    const typeFilter = TYPE_MAP[currentFilter];
    if (typeFilter) {
        filtered = filtered.filter(m => m.memory_type === typeFilter);
    }
    if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        filtered = filtered.filter(m =>
            m.content.toLowerCase().includes(lower) ||
            (m.aiTags || []).some(t => t.toLowerCase().includes(lower)) ||
            (m.domain || '').includes(lower) ||
            (m.meaning || '').toLowerCase().includes(lower)
        );
    }
    return filtered.sort((a, b) => (b.timestamp || b.created_at) - (a.timestamp || a.created_at));
}

async function renderMemoryList() {
    const container = createElement('div', 'app-container memory-app bg-ios-bg');

    const header = createIOSNavBar({
        title: '記憶管理',
        largeTitle: false,
        backPath: '/home',
        rightActions: [{ icon: 'add', onClick: () => Router.navigate('/memory/new') }]
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-16 pb-8');

    const searchContainer = createElement('div', 'mx-4 mb-4');
    const searchBox = createElement('div', 'flex items-center bg-white rounded-lg px-4 py-3 shadow-sm');
    searchBox.appendChild(createIcon('search', 'text-ios-muted mr-3'));
    const searchInput = createElement('input', 'flex-1 bg-transparent outline-none text-sm', {
        type: 'text',
        placeholder: '搜尋記憶...',
        onInput: (e) => {
            searchTerm = e.target.value;
            renderList();
        }
    });
    searchBox.appendChild(searchInput);
    searchContainer.appendChild(searchBox);
    main.appendChild(searchContainer);

    const categoryGrid = createElement('div', 'grid grid-cols-4 gap-2 mx-4 mb-6');
    TYPE_TABS.forEach((tab, index) => {
        const card = createElement('div', 'flex flex-col items-center justify-center p-3 rounded-lg cursor-pointer transition-all ' + 
            (currentFilter === index ? 'bg-claude-primary text-white shadow-md' : 'bg-white hover:shadow-md'), {
            onClick: () => {
                currentFilter = index;
                renderList();
            }
        });
        const iconMap = ['inventory_2', 'auto_awesome', 'bookmark', 'favorite', 'event_note', 'mail', 'person', 'archive'];
        card.appendChild(createIcon(iconMap[index] || 'folder', 'text-2xl mb-1'));
        card.appendChild(createElement('span', 'text-xs font-medium', { textContent: tab }));
        categoryGrid.appendChild(card);
    });
    main.appendChild(categoryGrid);

    const listContainer = createElement('div', 'px-4');
    main.appendChild(listContainer);
    container.appendChild(main);

    async function renderList() {
        listContainer.innerHTML = '';
        memories = await MemoryDB.getAll();
        const filtered = getFilteredMemories();

        if (filtered.length === 0) {
            const emptyState = createElement('div', 'flex flex-col items-center justify-center py-16');
            emptyState.appendChild(createIcon('psychology', 'text-5xl mb-4 opacity-30'));
            emptyState.appendChild(createElement('h3', 'text-lg font-semibold mb-1', { textContent: '沒有記憶' }));
            emptyState.appendChild(createElement('p', 'text-sm text-ios-muted', { textContent: '記憶將在對話中自動產生' }));
            listContainer.appendChild(emptyState);
            return;
        }

        filtered.forEach(memory => {
            const stage = getDecayStage(memory);
            const card = createElement('div', 'bg-white rounded-lg p-4 mb-3 shadow-sm cursor-pointer hover:shadow-md transition-shadow', {
                onClick: () => Router.navigate('/memory/' + memory.id)
            });

            const headerRow = createElement('div', 'flex items-start justify-between mb-2');
            const content = createElement('p', 'text-sm leading-relaxed flex-1', { textContent: memory.content.slice(0, 120) });
            const badge = createElement('span', 'inline-block w-2 h-2 rounded-full ' + stage.dotClass + ' mt-1 ml-2 flex-shrink-0');
            headerRow.appendChild(content);
            headerRow.appendChild(badge);
            card.appendChild(headerRow);

            const metaRow = createElement('div', 'flex flex-wrap items-center gap-2 text-xs');
            metaRow.appendChild(createElement('span', 'text-ios-muted', { textContent: formatRelativeTime(memory.timestamp || memory.created_at) }));
            metaRow.appendChild(createElement('span', 'px-2 py-0.5 rounded ' + stage.badgeClass, { textContent: stage.label }));
            const typeLabel = TYPE_LABELS[memory.memory_type] || memory.memory_type || '動態';
            metaRow.appendChild(createElement('span', 'px-2 py-0.5 rounded bg-gray-100', { textContent: typeLabel }));
            
            if (memory.source_app && memory.source_app !== 'chat') {
                metaRow.appendChild(createElement('span', 'px-2 py-0.5 rounded bg-blue-50 text-blue-600', { textContent: getSourceLabel(memory.source_app) }));
            }
            if (memory.is_fiction) {
                metaRow.appendChild(createElement('span', 'px-2 py-0.5 rounded bg-orange-50 text-orange-600', { textContent: '虛擬' }));
            }
            card.appendChild(metaRow);

            if (memory.aiTags && memory.aiTags.length > 0) {
                const tagsRow = createElement('div', 'flex flex-wrap gap-1 mt-2');
                memory.aiTags.slice(0, 3).forEach(tag => {
                    tagsRow.appendChild(createElement('span', 'text-xs px-2 py-0.5 rounded bg-gray-50 text-gray-500', { textContent: tag }));
                });
                card.appendChild(tagsRow);
            }

            listContainer.appendChild(card);
        });
    }

    await renderList();
    return { element: container, cleanup: null };
}

async function renderMemoryDetail(params) {
    const { id } = params;
    const memory = await MemoryDB.access(id);
    if (!memory) {
        createToast('記憶不存在');
        Router.navigate('/memory');
        return { element: createElement('div'), cleanup: null };
    }

    const container = createElement('div', 'app-container memory-app bg-ios-bg');
    const header = createIOSNavBar({ title: '記憶詳情', backPath: '/memory' });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-16 pb-8');

    const contentCard = createElement('div', 'bg-white rounded-lg mx-4 mb-4 p-4 shadow-sm');
    contentCard.appendChild(createElement('p', 'text-base leading-relaxed', { textContent: memory.content }));
    main.appendChild(contentCard);

    const typeLabel = TYPE_LABELS[memory.memory_type] || memory.memory_type || '動態';
    const stage = getDecayStage(memory);
    
    const categoryCards = [
        { icon: 'category', iconBg: 'bg-claude-primary', title: '類型', value: typeLabel },
        { icon: 'place', iconBg: 'bg-blue-500', title: '領域', value: memory.domain || '—' },
        { icon: 'lightbulb', iconBg: 'bg-yellow-500', title: '意義', value: memory.meaning || '—' },
        { icon: 'schedule', iconBg: 'bg-purple-500', title: '衰變', value: stage.label }
    ];

    const categoryGrid = createElement('div', 'grid grid-cols-2 gap-3 mx-4 mb-4');
    categoryCards.forEach(cat => {
        const card = createElement('div', 'bg-white rounded-lg p-3 shadow-sm');
        const iconWrapper = createElement('div', 'w-8 h-8 ' + cat.iconBg + ' rounded-lg flex items-center justify-center mb-2');
        iconWrapper.appendChild(createIcon(cat.icon, 'text-white text-sm'));
        card.appendChild(iconWrapper);
        card.appendChild(createElement('p', 'text-xs text-ios-muted mb-1', { textContent: cat.title }));
        card.appendChild(createElement('p', 'text-sm font-medium', { textContent: cat.value }));
        categoryGrid.appendChild(card);
    });
    main.appendChild(categoryGrid);

    if (memory.sensory && Object.keys(memory.sensory).length > 0) {
        const sensoryCard = createElement('div', 'bg-white rounded-lg mx-4 mb-4 p-4 shadow-sm');
        sensoryCard.appendChild(createElement('h3', 'text-sm font-semibold mb-3', { textContent: '感官記憶' }));
        const sensoryData = [
            { label: '視覺', items: memory.sensory.visual || [] },
            { label: '聽覺', items: memory.sensory.auditory || [] },
            { label: '嗅覺', items: memory.sensory.olfactory || [] },
            { label: '觸覺', items: memory.sensory.tactile || [] },
            { label: '味覺', items: memory.sensory.gustatory || [] }
        ];
        sensoryData.forEach(s => {
            if (s.items.length > 0) {
                const row = createElement('div', 'mb-2');
                row.appendChild(createElement('span', 'text-xs text-ios-muted mr-2', { textContent: s.label + ':' }));
                const tags = createElement('span', 'text-xs');
                tags.textContent = s.items.join(', ');
                row.appendChild(tags);
                sensoryCard.appendChild(row);
            }
        });
        main.appendChild(sensoryCard);
    }

    if (memory.emotional) {
        const emotionalCard = createElement('div', 'bg-white rounded-lg mx-4 mb-4 p-4 shadow-sm');
        emotionalCard.appendChild(createElement('h3', 'text-sm font-semibold mb-3', { textContent: '情感分析' }));
        const valence = memory.emotional.valence || 0;
        const arousal = memory.emotional.arousal || 0;
        const valenceLabel = valence > 0.3 ? '正面' : valence < -0.3 ? '負面' : '中性';
        const arousalLabel = arousal > 0.3 ? '高' : arousal < -0.3 ? '低' : '中';
        const emotionalGrid = createElement('div', 'grid grid-cols-2 gap-4');
        const valenceDiv = createElement('div');
        valenceDiv.innerHTML = '<p class="text-xs text-ios-muted">效價</p><p class="text-sm font-medium">' + valenceLabel + '</p>';
        emotionalGrid.appendChild(valenceDiv);
        const arousalDiv = createElement('div');
        arousalDiv.innerHTML = '<p class="text-xs text-ios-muted">喚醒度</p><p class="text-sm font-medium">' + arousalLabel + '</p>';
        emotionalGrid.appendChild(arousalDiv);
        emotionalCard.appendChild(emotionalGrid);
        if (memory.emotional.emotions && memory.emotional.emotions.length > 0) {
            const emotionsRow = createElement('div', 'flex flex-wrap gap-1 mt-3');
            memory.emotional.emotions.forEach(em => {
                emotionsRow.appendChild(createElement('span', 'text-xs px-2 py-1 rounded-full bg-pink-50 text-pink-600', { textContent: em }));
            });
            emotionalCard.appendChild(emotionsRow);
        }
        main.appendChild(emotionalCard);
    }

    const decayCard = createElement('div', 'bg-white rounded-lg mx-4 mb-4 p-4 shadow-sm');
    decayCard.appendChild(createElement('h3', 'text-sm font-semibold mb-3', { textContent: '衰變資訊' }));
    const decayData = [
        { label: '衰變因子', value: (memory.decayFactor || 1.0).toFixed(2) },
        { label: '重要性', value: (memory.importance || 0.5).toFixed(2) },
        { label: '存取次數', value: String(memory.accessCount || 0) },
        { label: '強化次數', value: String(memory.reinforcementCount || 0) }
    ];
    const decayGrid = createElement('div', 'grid grid-cols-2 gap-4');
    decayData.forEach(d => {
        const div = createElement('div');
        div.innerHTML = '<p class="text-xs text-ios-muted">' + d.label + '</p><p class="text-sm font-medium">' + d.value + '</p>';
        decayGrid.appendChild(div);
    });
    decayCard.appendChild(decayGrid);
    main.appendChild(decayCard);

    const actionsCard = createElement('div', 'bg-white rounded-lg mx-4 mb-4 p-4 shadow-sm');
    const actionsGrid = createElement('div', 'grid grid-cols-2 gap-2');
    const reinforceBtn = createElement('button', 'bg-claude-primary text-white rounded-lg py-2.5 text-sm font-medium', {
        textContent: '強化記憶',
        onClick: async () => {
            await MemoryDB.reinforce(id);
            createToast('記憶已強化');
            Router.navigate('/memory/' + id);
        }
    });
    actionsGrid.appendChild(reinforceBtn);
    const permanentBtn = createElement('button', 'bg-claude-success text-white rounded-lg py-2.5 text-sm font-medium', {
        textContent: '標為永久',
        onClick: async () => {
            await MemoryDB.update(id, { memory_type: 'permanent', decayFactor: 5.0 });
            createToast('已標為永久記憶');
            Router.navigate('/memory/' + id);
        }
    });
    actionsGrid.appendChild(permanentBtn);
    actionsCard.appendChild(actionsGrid);

    const actionsGrid2 = createElement('div', 'grid grid-cols-2 gap-2 mt-2');
    const archiveBtn = createElement('button', 'bg-gray-100 text-gray-700 rounded-lg py-2.5 text-sm font-medium', {
        textContent: '歸檔',
        onClick: async () => {
            await MemoryDB.update(id, { memory_type: 'archive' });
            createToast('記憶已歸檔');
            Router.navigate('/memory');
        }
    });
    actionsGrid2.appendChild(archiveBtn);
    const deleteBtn = createElement('button', 'bg-claude-danger text-white rounded-lg py-2.5 text-sm font-medium', {
        textContent: '刪除',
        onClick: () => {
            if (confirm('確定要刪除此記憶？此操作無法復原。')) {
                MemoryDB.delete(id);
                createToast('記憶已刪除');
                Router.navigate('/memory');
            }
        }
    });
    actionsGrid2.appendChild(deleteBtn);
    actionsCard.appendChild(actionsGrid2);
    main.appendChild(actionsCard);

    container.appendChild(main);
    return { element: container, cleanup: null };
}

export default {
    id: 'memory',
    name: '記憶管理',
    icon: 'psychology',
    routes: [
        { path: '/memory', render: renderMemoryList },
        { path: '/memory/:id', render: renderMemoryDetail }
    ],
    navItem: {
        label: 'Memory',
        icon: 'psychology',
        path: '/memory',
        showInNav: true,
        order: 4
    },
    stylesPath: 'js/apps/memory/style.css'
};
