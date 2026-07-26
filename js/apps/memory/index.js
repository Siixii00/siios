import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createIOSSearchBar, createIOSSegmentedControl, createToast } from '../../components.js';
import { MemoryDB } from '../../db.js';

let memories = [];
let currentFilter = 0;
let searchTerm = '';

const TYPE_TABS = ['全部', '動態', '永久', '情感', '計畫', '書信', '自我', '歸檔'];
const TYPE_MAP = { 1: 'dynamic', 2: 'permanent', 3: 'feel', 4: 'plan', 5: 'letter', 6: 'i', 7: 'archive' };
const TYPE_LABELS = { dynamic: '動態', permanent: '永久', feel: '情感', plan: '計畫', letter: '書信', i: '自我', archive: '歸檔' };

function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    if (diff < 60000) return '剛剛';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分鐘前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小時前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;
    const date = new Date(timestamp);
    return `${date.getMonth() + 1}/${date.getDate()}`;
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
    const container = createElement('div', 'app-container memory-app');

    const header = createIOSNavBar({
        title: '記憶管理',
        largeTitle: false,
        backPath: '/home',
        rightActions: [
            {
                icon: 'add',
                onClick: () => Router.navigate('/memory/new')
            }
        ]
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-2 pb-24');

    const searchBar = createIOSSearchBar((term) => {
        searchTerm = term;
        renderList();
    });
    searchBar.classList.add('mb-2');
    main.appendChild(searchBar);

    const segmented = createIOSSegmentedControl(
        TYPE_TABS,
        (index) => {
            currentFilter = index;
            renderList();
        },
        currentFilter
    );
    segmented.classList.add('mx-4', 'mb-4');
    main.appendChild(segmented);

    const listContainer = createElement('div', 'px-4');
    main.appendChild(listContainer);

    container.appendChild(main);

    const nav = createElement('div', 'ios-bottom-nav safe-area-bottom');

    const chatsTab = createElement('a', 'ios-bottom-nav-item', {
        href: '/#/chats',
        onClick: (e) => {
            e.preventDefault();
            Router.navigate('/chats');
        }
    });
    chatsTab.appendChild(createIcon('chat_bubble'));
    chatsTab.appendChild(createElement('span', 'label', { textContent: 'Chats' }));
    nav.appendChild(chatsTab);

    const worldInfoTab = createElement('a', 'ios-bottom-nav-item', {
        href: '/#/world-info',
        onClick: (e) => {
            e.preventDefault();
            Router.navigate('/world-info');
        }
    });
    worldInfoTab.appendChild(createIcon('menu_book'));
    worldInfoTab.appendChild(createElement('span', 'label', { textContent: 'World Info' }));
    nav.appendChild(worldInfoTab);

    const memoryTab = createElement('a', 'ios-bottom-nav-item active');
    memoryTab.appendChild(createIcon('psychology', '', true));
    memoryTab.appendChild(createElement('span', 'label', { textContent: 'Memory' }));
    nav.appendChild(memoryTab);

    const settingsTab = createElement('a', 'ios-bottom-nav-item', {
        href: '/#/settings',
        onClick: (e) => {
            e.preventDefault();
            Router.navigate('/settings');
        }
    });
    settingsTab.appendChild(createIcon('settings'));
    settingsTab.appendChild(createElement('span', 'label', { textContent: 'Settings' }));
    nav.appendChild(settingsTab);

    container.appendChild(nav);

    async function renderList() {
        listContainer.innerHTML = '';
        memories = await MemoryDB.getAll();
        const filtered = getFilteredMemories();

        if (filtered.length === 0) {
            const emptyState = createElement('div', 'flex flex-col items-center justify-center py-16');
            emptyState.appendChild(createIcon('psychology', 'riso-empty-icon text-5xl mb-4'));
            emptyState.appendChild(createElement('h3', 'riso-empty-title text-lg font-semibold mb-1', { textContent: '沒有記憶' }));
            emptyState.appendChild(createElement('p', 'riso-empty-text text-sm', { textContent: '記憶將在對話中自動產生' }));
            listContainer.appendChild(emptyState);
            return;
        }

        const group = createElement('div', 'ios-grouped-list');

        filtered.forEach(memory => {
            const stage = getDecayStage(memory);
            const cell = createElement('div', 'ios-list-cell ios-list-cell-full', {
                onClick: () => Router.navigate('/memory/' + memory.id)
            });

            const leftContent = createElement('div', 'flex-1 min-h-[64px] flex flex-col justify-center');

            const topRow = createElement('div', 'flex items-center gap-2 mb-1');
            topRow.appendChild(createElement('span', 'text-base font-semibold line-clamp-1', { textContent: memory.content.slice(0, 50) }));

            const badge = createElement('span', `inline-block w-2 h-2 rounded-full ${stage.dotClass}`);
            topRow.appendChild(badge);
            leftContent.appendChild(topRow);

            const bottomRow = createElement('div', 'flex items-center gap-2');
            bottomRow.appendChild(createElement('span', 'text-sm text-ios-muted', { textContent: formatRelativeTime(memory.timestamp || memory.created_at) }));
            bottomRow.appendChild(createElement('span', `text-xs px-1.5 py-0.5 rounded ${stage.badgeClass}`, { textContent: stage.label }));
            const typeLabel = TYPE_LABELS[memory.memory_type] || memory.memory_type || '動態';
            bottomRow.appendChild(createElement('span', 'text-xs px-1.5 py-0.5 rounded bg-ios-bg2', { textContent: typeLabel }));
            if (memory.domain) {
                bottomRow.appendChild(createElement('span', 'text-xs text-ios-muted', { textContent: memory.domain }));
            }
            leftContent.appendChild(bottomRow);

            cell.appendChild(leftContent);
            cell.appendChild(createIcon('chevron_right', 'text-ios-muted'));

            group.appendChild(cell);
        });

        listContainer.appendChild(group);
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

    const container = createElement('div', 'app-container memory-app');

    const header = createIOSNavBar({
        title: '記憶詳情',
        backPath: '/memory'
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-2 pb-24');

    const contentCard = createElement('div', 'ios-grouped-list mx-4 mb-4');
    const contentCell = createElement('div', 'ios-list-cell ios-list-cell-full p-4');
    contentCell.appendChild(createElement('p', 'text-base leading-relaxed', { textContent: memory.content }));
    contentCard.appendChild(contentCell);
    main.appendChild(contentCard);

    const classSection = createElement('div', 'ml-8 mb-2');
    classSection.appendChild(createElement('p', 'ios-section-header', { textContent: '分類' }));
    main.appendChild(classSection);

    const classCard = createElement('div', 'ios-grouped-list mx-4 mb-4');
    const typeLabel = TYPE_LABELS[memory.memory_type] || memory.memory_type || '動態';
    const classData = [
        { label: '類型', value: typeLabel },
        { label: '領域', value: memory.domain || '—' },
        { label: '意義', value: memory.meaning || '—' }
    ];
    if (memory.memory_type === 'plan') {
        classData.push({ label: '狀態', value: memory.status || 'active' });
    }
    classData.forEach((d, i) => {
        const cell = createElement('div', `ios-list-cell ${i === classData.length - 1 ? 'ios-list-cell-full' : ''}`);
        cell.appendChild(createElement('span', 'flex-1 text-ios-muted', { textContent: d.label }));
        cell.appendChild(createElement('span', 'text-right', { textContent: d.value }));
        classCard.appendChild(cell);
    });
    main.appendChild(classCard);

    const sensorySection = createElement('div', 'ml-8 mb-2');
    sensorySection.appendChild(createElement('p', 'ios-section-header', { textContent: '感官' }));
    main.appendChild(sensorySection);

    const sensoryCard = createElement('div', 'ios-grouped-list mx-4 mb-4');
    const sensoryData = [
        { label: '視覺', items: memory.sensory?.visual || [] },
        { label: '聽覺', items: memory.sensory?.auditory || [] },
        { label: '嗅覺', items: memory.sensory?.olfactory || [] },
        { label: '觸覺', items: memory.sensory?.tactile || [] },
        { label: '味覺', items: memory.sensory?.gustatory || [] }
    ];
    sensoryData.forEach((s, i) => {
        const cell = createElement('div', `ios-list-cell ${i === sensoryData.length - 1 ? 'ios-list-cell-full' : ''}`);
        cell.appendChild(createElement('span', 'flex-1 text-ios-muted', { textContent: s.label }));
        const tags = createElement('div', 'flex flex-wrap gap-1');
        if (s.items.length === 0) {
            tags.appendChild(createElement('span', 'text-xs text-ios-muted', { textContent: '—' }));
        } else {
            s.items.forEach(item => {
                tags.appendChild(createElement('span', 'riso-sensory-tag', { textContent: item }));
            });
        }
        cell.appendChild(tags);
        sensoryCard.appendChild(cell);
    });
    main.appendChild(sensoryCard);

    const spatioSection = createElement('div', 'ml-8 mb-2');
    spatioSection.appendChild(createElement('p', 'ios-section-header', { textContent: '時空' }));
    main.appendChild(spatioSection);

    const spatioCard = createElement('div', 'ios-grouped-list mx-4 mb-4');
    const spatioData = [
        { label: '地點', value: memory.spatiotemporal?.location || '—' },
        { label: '環境', value: memory.spatiotemporal?.environment || '—' },
        { label: '活動', value: memory.spatiotemporal?.activity || '—' },
        { label: '情境', value: memory.spatiotemporal?.context || '—' }
    ];
    spatioData.forEach((s, i) => {
        const cell = createElement('div', `ios-list-cell ${i === spatioData.length - 1 ? 'ios-list-cell-full' : ''}`);
        cell.appendChild(createElement('span', 'flex-1 text-ios-muted', { textContent: s.label }));
        cell.appendChild(createElement('span', 'text-right', { textContent: s.value }));
        spatioCard.appendChild(cell);
    });
    main.appendChild(spatioCard);

    const emotionalSection = createElement('div', 'ml-8 mb-2');
    emotionalSection.appendChild(createElement('p', 'ios-section-header', { textContent: '情感' }));
    main.appendChild(emotionalSection);

    const emotionalCard = createElement('div', 'ios-grouped-list mx-4 mb-4');
    const valence = memory.emotional?.valence || 0;
    const arousal = memory.emotional?.arousal || 0;
    const valenceLabel = valence > 0.3 ? '正面' : valence < -0.3 ? '負面' : '中性';
    const arousalLabel = arousal > 0.3 ? '高' : arousal < -0.3 ? '低' : '中';

    const valenceCell = createElement('div', 'ios-list-cell');
    valenceCell.appendChild(createElement('span', 'flex-1 text-ios-muted', { textContent: '效價' }));
    valenceCell.appendChild(createElement('span', '', { textContent: `${valenceLabel} (${valence.toFixed(2)})` }));
    emotionalCard.appendChild(valenceCell);

    const arousalCell = createElement('div', 'ios-list-cell');
    arousalCell.appendChild(createElement('span', 'flex-1 text-ios-muted', { textContent: '喚醒度' }));
    arousalCell.appendChild(createElement('span', '', { textContent: `${arousalLabel} (${arousal.toFixed(2)})` }));
    emotionalCard.appendChild(arousalCell);

    const emotionsCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    emotionsCell.appendChild(createElement('span', 'flex-1 text-ios-muted', { textContent: '情緒' }));
    const emotionTags = createElement('div', 'flex flex-wrap gap-1');
    const emotions = memory.emotional?.emotions || [];
    if (emotions.length === 0) {
        emotionTags.appendChild(createElement('span', 'text-xs text-ios-muted', { textContent: '—' }));
    } else {
        emotions.forEach(em => {
            emotionTags.appendChild(createElement('span', 'riso-emotion-tag', { textContent: em }));
        });
    }
    emotionsCell.appendChild(emotionTags);
    emotionalCard.appendChild(emotionsCell);
    main.appendChild(emotionalCard);

    const decaySection = createElement('div', 'ml-8 mb-2');
    decaySection.appendChild(createElement('p', 'ios-section-header', { textContent: '衰變資訊' }));
    main.appendChild(decaySection);

    const decayCard = createElement('div', 'ios-grouped-list mx-4 mb-4');
    const decayData = [
        { label: '衰變因子', value: (memory.decayFactor || 1.0).toFixed(2) },
        { label: '重要性', value: (memory.importance || 0.5).toFixed(2) },
        { label: '存取次數', value: String(memory.accessCount || 0) },
        { label: '強化次數', value: String(memory.reinforcementCount || 0) },
        { label: '最後存取', value: formatRelativeTime(memory.lastAccessed || memory.created_at) }
    ];
    decayData.forEach((d, i) => {
        const cell = createElement('div', `ios-list-cell ${i === decayData.length - 1 ? 'ios-list-cell-full' : ''}`);
        cell.appendChild(createElement('span', 'flex-1 text-ios-muted', { textContent: d.label }));
        cell.appendChild(createElement('span', '', { textContent: d.value }));
        decayCard.appendChild(cell);
    });
    main.appendChild(decayCard);

    const actionsCard = createElement('div', 'ios-grouped-list mx-4 mb-4');
    const reinforceCell = createElement('div', 'ios-list-cell justify-center');
    const reinforceBtn = createElement('button', 'riso-action-btn w-full text-center py-2', {
        textContent: '強化記憶',
        onClick: async () => {
            await MemoryDB.reinforce(id);
            createToast('記憶已強化');
            Router.navigate('/memory/' + id);
        }
    });
    reinforceCell.appendChild(reinforceBtn);
    actionsCard.appendChild(reinforceCell);

    const permanentCell = createElement('div', 'ios-list-cell justify-center');
    const permanentBtn = createElement('button', 'riso-action-btn w-full text-center py-2', {
        textContent: '標為永久',
        onClick: async () => {
            await MemoryDB.update(id, { memory_type: 'permanent', decayFactor: 5.0 });
            createToast('已標為永久記憶');
            Router.navigate('/memory/' + id);
        }
    });
    permanentCell.appendChild(permanentBtn);
    actionsCard.appendChild(permanentCell);

    const archiveCell = createElement('div', 'ios-list-cell justify-center');
    const archiveBtn = createElement('button', 'riso-action-btn w-full text-center py-2', {
        textContent: '歸檔',
        onClick: async () => {
            await MemoryDB.update(id, { memory_type: 'archive' });
            createToast('記憶已歸檔');
            Router.navigate('/memory');
        }
    });
    archiveCell.appendChild(archiveBtn);
    actionsCard.appendChild(archiveCell);

    const deleteCell = createElement('div', 'ios-list-cell ios-list-cell-full justify-center');
    const deleteBtn = createElement('button', 'riso-danger-btn w-full text-center py-2', {
        textContent: '刪除記憶',
        onClick: () => {
            if (confirm('確定要刪除此記憶？此操作無法復原。')) {
                MemoryDB.delete(id);
                createToast('記憶已刪除');
                Router.navigate('/memory');
            }
        }
    });
    deleteCell.appendChild(deleteBtn);
    actionsCard.appendChild(deleteCell);
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
