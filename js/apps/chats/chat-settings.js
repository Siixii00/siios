import Router from '../../router.js';
import { createElement, createIcon, createKakaoBottomNav, createIOSGroupedList } from '../../components.js';
import { SettingsDB, ChatsDB, TheaterSettingsDB } from '../../db.js';
import { CHATS_TABS } from './chats-nav.js';

const THEMES = [
    { id: 'light', name: '淺色', bg: '#ffffff', text: '#333333' },
    { id: 'dark', name: '深色', bg: '#1a1a1a2e', text: '#e5e5e5' },
    { id: 'pink', name: '粉色', bg: '#fce4ec', text: '#880e4f' },
    { id: 'blue', name: '藍色', bg: '#e3f2fd', text: '#0d47a1' },
    { id: 'green', name: '綠色', bg: '#e8f5e9', text: '#2e7d32' }
];

let currentTheme = 'light';
let currentFontSize = 'medium';

async function loadSettings() {
    const saved = await SettingsDB.get('appearance_theme');
    if (saved) currentTheme = saved;
    const savedFont = await SettingsDB.get('appearance_font_size');
    if (savedFont) currentFontSize = savedFont;
}

async function renderChatSettings() {
    await loadSettings();
    const container = createElement('div', 'app-container');

    const header = createElement('header', 'sticky top-0 z-50 bg-white');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';

    const headerInner = createElement('div', 'flex justify-between items-center h-[86px] px-4');

    const title = createElement('h1', 'text-[32px] font-bold text-black leading-[31px]');
    title.textContent = '聊天設定';
    headerInner.appendChild(title);

    header.appendChild(headerInner);
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-[83px] px-4');

    const themeSection = createElement('div', 'mt-4');
    themeSection.appendChild(createElement('p', 'ios-section-header', { textContent: '主題' }));

    const themeGrid = createElement('div', 'theme-grid');
    THEMES.forEach(t => {
        const card = createElement('div', `theme-card ${t.id === currentTheme ? 'active' : ''}`);
        card.dataset.id = t.id;
        card.style.background = t.bg;
        card.style.color = t.text;
        card.style.borderRadius = '12px';
        card.style.padding = '16px';
        card.style.cursor = 'pointer';
        card.style.border = t.id === currentTheme ? '2px solid var(--kakao-brown)' : '2px solid transparent';
        card.style.transition = 'border 0.15s';

        card.appendChild(createElement('span', 'theme-name', { textContent: t.name }));
        if (t.id === currentTheme) {
            card.appendChild(createIcon('check', 'text-sm'));
        }

        card.onclick = async () => {
            currentTheme = t.id;
            await SettingsDB.set('appearance_theme', currentTheme);
            Router.navigate('/chats/settings');
        };

        themeGrid.appendChild(card);
    });
    themeGrid.style.display = 'grid';
    themeGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    themeGrid.style.gap = '8px';
    themeSection.appendChild(themeGrid);
    main.appendChild(themeSection);

    const fontSection = createElement('div', 'mt-6');
    fontSection.appendChild(createElement('p', 'ios-section-header', { textContent: '字體大小' }));

    const fontControl = createElement('div', 'flex gap-2 mt-2');
    ['small', 'medium', 'large'].forEach(size => {
        const labels = { small: '小', medium: '中', large: '大' };
        const btn = createElement('button', `flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${currentFontSize === size ? 'bg-[var(--kakao-yellow)] text-[var(--kakao-brown)]' : 'bg-gray-100 text-gray-600'}`, {
            textContent: labels[size],
            onClick: async () => {
                currentFontSize = size;
                await SettingsDB.set('appearance_font_size', currentFontSize);
                Router.navigate('/chats/settings');
            }
        });
        fontControl.appendChild(btn);
    });
    fontSection.appendChild(fontControl);
    main.appendChild(fontSection);

    const previewSection = createElement('div', 'mt-6');
    previewSection.appendChild(createElement('p', 'ios-section-header', { textContent: '預覽' }));
    const previewBox = createElement('div', 'rounded-xl p-4 mt-2');
    const theme = THEMES.find(t => t.id === currentTheme);
    previewBox.style.background = theme?.bg || '#fff';
    previewBox.style.color = theme?.text || '#333';
    previewBox.style.fontSize = currentFontSize === 'small' ? '14px' : currentFontSize === 'large' ? '20px' : '16px';
    previewBox.appendChild(createElement('p', '', { textContent: '這是預覽文字，用來展示主題效果。' }));
    previewBox.appendChild(createElement('p', '', { textContent: '當前主題：' + (theme?.name || '淺色') }));
    previewSection.appendChild(previewBox);
    main.appendChild(previewSection);

    const otherSection = createElement('div', 'mt-6 mb-4');
    otherSection.appendChild(createElement('p', 'ios-section-header', { textContent: '其他' }));

    const otherList = createIOSGroupedList([
        {
            header: '',
            items: [
                {
                    icon: 'api',
                    iconBg: 'bg-kakao-brown',
                    label: 'API 設定',
                    chevron: true,
                    onClick: () => Router.navigate('/api-config')
                },
                {
                    icon: 'smart_toy',
                    iconBg: 'bg-kakao-brown',
                    label: '系統提示詞',
                    chevron: true,
                    onClick: () => Router.navigate('/api-config?tab=prompt')
                }
            ]
        }
    ]);
    otherSection.appendChild(otherList);
    main.appendChild(otherSection);

        // Memory Settings Section
    const memorySection = createElement('div', 'mt-6 mb-4');
    memorySection.appendChild(createElement('p', 'ios-section-header', { textContent: '記憶設定' }));

    const memoryList = createIOSGroupedList([
        {
            header: '',
            items: [
                {
                    icon: 'psychology',
                    iconBg: 'bg-purple-500',
                    label: '記憶設定',
                    value: '管理劇場、來源與層級',
                    chevron: true,
                    onClick: () => Router.navigate('/memory-settings')
                }
            ]
        }
    ]);
    memorySection.appendChild(memoryList);
    main.appendChild(memorySection);

    container.appendChild(main);

    const nav = createKakaoBottomNav(CHATS_TABS, 2, (index, tab) => Router.navigate(tab.path));
    container.appendChild(nav);

    return { element: container, cleanup: null };
}

export default {
    id: 'chats-settings',
    routes: [
        { path: '/chats/settings', render: renderChatSettings }
    ]
};
