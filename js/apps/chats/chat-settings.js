import Router from '../../router.js';
import { createElement, createIcon, createKakaoBottomNav, createIOSGroupedList, createToast, createKakaoBottomSheet } from '../../components.js';
import { SettingsDB, ChatsDB, TheaterSettingsDB, CharactersDB } from '../../db.js';
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

async function renderPerChatSettings(params) {
    const chatId = params.id;
    const chat = await ChatsDB.getById(chatId);
    if (!chat) {
        Router.navigate('/chats');
        return { element: createElement('div'), cleanup: null };
    }

    const container = createElement('div', 'app-container');

    const header = createElement('header', 'sticky top-0 z-50 bg-white');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';

    const headerInner = createElement('div', 'flex justify-between items-center h-[86px] px-4');

    const backBtn = createElement('button', 'ios-back-btn', {
        onClick: () => Router.back()
    });
    backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回';
    headerInner.appendChild(backBtn);

    const title = createElement('h1', 'text-[32px] font-bold text-black leading-[31px]');
    title.textContent = chat.is_group ? '群組設定' : '聊天設定';
    headerInner.appendChild(title);

    header.appendChild(headerInner);
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-[83px] px-4');

    if (chat.is_group) {
        const groupSection = createElement('div', 'mt-4');
        groupSection.appendChild(createElement('p', 'ios-section-header', { textContent: '群組成員' }));
        
        const memberIds = chat.member_ids || [];
        const memberList = createElement('div', 'ios-grouped-list shadow-sm mt-2');
        
        for (const mid of memberIds) {
            const char = await CharactersDB.getById(mid);
            const memberRow = createElement('div', 'ios-list-cell');
            
            const avatar = createElement('img', 'w-10 h-10 rounded-full object-cover mr-3', {
                src: char?.avatar || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23E5E5EA"/><text x="50" y="60" text-anchor="middle" font-size="40" fill="%238E8E93">?</text></svg>',
                alt: char?.name || 'Unknown'
            });
            memberRow.appendChild(avatar);
            
            const nameSpan = createElement('span', 'flex-1 text-body-lg');
            nameSpan.textContent = char?.name || '未知角色';
            memberRow.appendChild(nameSpan);
            
            if (memberIds.length > 1) {
                const removeBtn = createElement('button', 'px-3 py-1 rounded-lg bg-red-100 text-red-600 text-sm');
                removeBtn.textContent = '移除';
                removeBtn.onclick = async () => {
                    const newMemberIds = memberIds.filter(id => id !== mid);
                    const primaryCharId = newMemberIds[0];
                    const primaryChar = await CharactersDB.getById(primaryCharId);
                    await ChatsDB.update(chatId, {
                        member_ids: newMemberIds,
                        character_id: primaryCharId,
                        character_name: primaryChar?.name || '群組聊天',
                        character_avatar: primaryChar?.avatar || '',
                        bound_user_id: primaryChar?.bound_user_id || null
                    });
                    createToast('已移除成員');
                    Router.navigate('/chats/settings/' + chatId);
                };
                memberRow.appendChild(removeBtn);
            }
            
            memberList.appendChild(memberRow);
        }
        
        groupSection.appendChild(memberList);
        main.appendChild(groupSection);
        
        const addSection = createElement('div', 'mt-4');
        addSection.appendChild(createElement('p', 'ios-section-header', { textContent: '加入成員' }));
        
        const addBtn = createElement('button', 'w-full py-3 rounded-lg bg-kakao-yellow text-kakao-brown font-medium mt-2', {
            textContent: '選擇角色加入群組',
            onClick: async () => {
                const characters = await CharactersDB.getAll();
                const available = characters.filter(c => !memberIds.includes(c.id));
                
                if (available.length === 0) {
                    createToast('沒有可加入的角色');
                    return;
                }
                
                const form = createElement('div', 'p-4 flex flex-col gap-3');
                const list = createElement('div', 'flex flex-col gap-2');
                
                available.forEach(char => {
                    const row = createElement('div', 'flex items-center gap-3 p-3 rounded-lg bg-gray-50');
                    const avatar = createElement('img', 'w-10 h-10 rounded-full object-cover', {
                        src: char.avatar || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23E5E5EA"/><text x="50" y="60" text-anchor="middle" font-size="40" fill="%238E8E93">?</text></svg>',
                        alt: char.name
                    });
                    row.appendChild(avatar);
                    
                    const name = createElement('span', 'flex-1 text-body-lg');
                    name.textContent = char.name;
                    row.appendChild(name);
                    
                    const addBtn = createElement('button', 'px-3 py-1 rounded-lg bg-kakao-yellow text-kakao-brown text-sm font-medium');
                    addBtn.textContent = '加入';
                    addBtn.onclick = async () => {
                        const newMemberIds = [...memberIds, char.id];
                        if (newMemberIds.length > 4) {
                            createToast('群組最多 4 個成員');
                            return;
                        }
                        await ChatsDB.update(chatId, { member_ids: newMemberIds });
                        createToast('已加入 ' + char.name);
                        sheet.close();
                        Router.navigate('/chats/settings/' + chatId);
                    };
                    row.appendChild(addBtn);
                    list.appendChild(row);
                });
                
                form.appendChild(list);
                
                const sheet = createKakaoBottomSheet([], {
                    title: '加入成員',
                    customContent: form
                });
                sheet.open();
            }
        });
        addSection.appendChild(addBtn);
        main.appendChild(addSection);
    } else {
        const chatSection = createElement('div', 'mt-4');
        chatSection.appendChild(createElement('p', 'ios-section-header', { textContent: '聊天資訊' }));
        
        const infoList = createIOSGroupedList([
            {
                header: '',
                items: [
                    {
                        icon: 'smart_toy',
                        iconBg: 'bg-kakao-brown',
                        label: '角色',
                        value: chat.character_name,
                        chevron: true,
                        onClick: () => Router.navigate('/characters/' + chat.character_id)
                    }
                ]
            }
        ]);
        chatSection.appendChild(infoList);
        main.appendChild(chatSection);
    }

    container.appendChild(main);

    return { element: container, cleanup: null };
}

export default {
    id: 'chats-settings',
    routes: [
        { path: '/chats/settings', render: renderChatSettings },
        { path: '/chats/settings/:id', render: renderPerChatSettings }
    ]
};
