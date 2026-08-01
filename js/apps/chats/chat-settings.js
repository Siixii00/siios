import Router from '../../router.js';
import { createElement, createIcon, createKakaoBottomNav, createIOSGroupedList, createToast, createKakaoBottomSheet } from '../../components.js';
import { SettingsDB, ChatsDB, TheaterSettingsDB, CharactersDB, MCPConfigDB } from '../../db.js';
import { CHATS_TABS } from './chats-nav.js';

const THEMES = [
    { id: 'light', name: '淺色', vars: { chatBg: '#FAF9F6', bubbleLeftBg: '#FFFFFF', bubbleLeftText: '#000000', bubbleRightBg: '#FEE500', bubbleRightText: '#625B71', inputBg: '#F5F5F5' } },
    { id: 'dark', name: '深色', vars: { chatBg: '#1C1C1E', bubbleLeftBg: '#2C2C2E', bubbleLeftText: '#FFFFFF', bubbleRightBg: '#3A3A3C', bubbleRightText: '#FFFFFF', inputBg: '#2C2C2E' } },
    { id: 'pink', name: '粉色', vars: { chatBg: '#FFF0F5', bubbleLeftBg: '#FFFFFF', bubbleLeftText: '#333333', bubbleRightBg: '#FFB6C1', bubbleRightText: '#8B0A50', inputBg: '#FFE4E9' } },
    { id: 'blue', name: '藍色', vars: { chatBg: '#E8F4FD', bubbleLeftBg: '#FFFFFF', bubbleLeftText: '#000000', bubbleRightBg: '#B3C7D5', bubbleRightText: '#1D1B20', inputBg: '#D6E6F4' } },
    { id: 'green', name: '綠色', vars: { chatBg: '#E8F5E9', bubbleLeftBg: '#FFFFFF', bubbleLeftText: '#000000', bubbleRightBg: '#A5D6A7', bubbleRightText: '#1B5E20', inputBg: '#C8E6C9' } }
];

let currentTheme = 'light';
let currentFontSize = 'medium';
let customTheme = null;

async function loadSettings() {
    const saved = await SettingsDB.get('appearance_theme');
    if (saved) currentTheme = saved;
    const savedFont = await SettingsDB.get('appearance_font_size');
    if (savedFont) currentFontSize = savedFont;
    customTheme = await SettingsDB.get('chat_custom_theme');
}

function applyThemeToRoot(vars) {
    const root = document.documentElement;
    root.style.setProperty('--kakao-chat-bg', vars.chatBg);
    root.style.setProperty('--kakao-bubble-left-bg', vars.bubbleLeftBg);
    root.style.setProperty('--kakao-bubble-left-text', vars.bubbleLeftText);
    root.style.setProperty('--kakao-bubble-right-bg', vars.bubbleRightBg);
    root.style.setProperty('--kakao-bubble-right-text', vars.bubbleRightText);
    root.style.setProperty('--kakao-input-bg', vars.inputBg);
}

function updatePreview(previewBox, vars) {
    if (!previewBox) return;
    
    previewBox.style.background = vars.chatBg;
    
    const leftBubble = previewBox.querySelector('.preview-bubble-left');
    const rightBubble = previewBox.querySelector('.preview-bubble-right');
    
    if (leftBubble) {
        leftBubble.style.background = vars.bubbleLeftBg;
        leftBubble.style.color = vars.bubbleLeftText;
    }
    
    if (rightBubble) {
        rightBubble.style.background = vars.bubbleRightBg;
        rightBubble.style.color = vars.bubbleRightText;
    }
}

function createColorPicker(label, value, onChange) {
    const row = createElement('div', 'flex items-center justify-between py-3');
    const labelEl = createElement('span', 'text-base', { textContent: label });
    row.appendChild(labelEl);
    
    const colorWrapper = createElement('div', 'flex items-center gap-2');
    const preview = createElement('div', 'w-10 h-10 rounded-lg border-2 border-gray-300 cursor-pointer');
    preview.style.backgroundColor = value;
    preview.style.transition = 'all 0.15s';
    
    const input = createElement('input', 'absolute cursor-pointer', {
        type: 'color',
        value: value
    });
    input.style.width = '40px';
    input.style.height = '40px';
    input.style.opacity = '0';
    input.style.position = 'absolute';
    
    const pickerWrapper = createElement('div', 'relative inline-flex items-center justify-center');
    pickerWrapper.style.width = '40px';
    pickerWrapper.style.height = '40px';
    pickerWrapper.appendChild(preview);
    pickerWrapper.appendChild(input);
    
    input.oninput = (e) => {
        preview.style.backgroundColor = e.target.value;
        onChange(e.target.value);
    };
    
    preview.onclick = () => {
        input.click();
    };
    
    colorWrapper.appendChild(pickerWrapper);
    row.appendChild(colorWrapper);
    
    return row;
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
    themeGrid.style.display = 'grid';
    themeGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    themeGrid.style.gap = '8px';

    THEMES.forEach(t => {
        const card = createElement('div', `theme-card ${t.id === currentTheme ? 'active' : ''}`);
        card.dataset.id = t.id;
        card.style.background = t.vars.chatBg;
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
            // 更新主題
            currentTheme = t.id;
            customTheme = null;
            await SettingsDB.set('appearance_theme', currentTheme);
            await SettingsDB.set('chat_custom_theme', null);
            applyThemeToRoot(t.vars);
            
            // 更新視覺狀態而不重新載入頁面
            themeGrid.querySelectorAll('.theme-card').forEach(c => {
                c.classList.remove('active');
                c.style.border = '2px solid transparent';
                // 移除勾選圖標
                const checkIcon = c.querySelector('.material-symbols-outlined');
                if (checkIcon) checkIcon.remove();
            });
            
            // 標記當前選中
            card.classList.add('active');
            card.style.border = '2px solid var(--kakao-brown)';
            card.appendChild(createIcon('check', 'text-sm'));
            
            // 更新預覽
            updatePreview(previewBox, t.vars);
            
            createToast('已切換到 ' + t.name + ' 主題', 'success');
        };

        themeGrid.appendChild(card);
    });

    const customCard = createElement('div', `theme-card ${currentTheme === 'custom' ? 'active' : ''}`);
    customCard.dataset.id = 'custom';
    customCard.style.background = '#FFFFFF';
    customCard.style.borderRadius = '12px';
    customCard.style.padding = '16px';
    customCard.style.cursor = 'pointer';
    customCard.style.border = currentTheme === 'custom' ? '2px solid var(--kakao-brown)' : '2px solid transparent';
    customCard.style.transition = 'border 0.15s';
    customCard.appendChild(createElement('span', 'theme-name', { textContent: '自定義' }));
    if (currentTheme === 'custom') {
        customCard.appendChild(createIcon('check', 'text-sm'));
    }

    customCard.onclick = async () => {
        currentTheme = 'custom';
        await SettingsDB.set('appearance_theme', 'custom');
        
        // 更新視覺狀態
        themeGrid.querySelectorAll('.theme-card').forEach(c => {
            c.classList.remove('active');
            c.style.border = '2px solid transparent';
            const checkIcon = c.querySelector('.material-symbols-outlined');
            if (checkIcon) checkIcon.remove();
        });
        
        customCard.classList.add('active');
        customCard.style.border = '2px solid var(--kakao-brown)';
        customCard.appendChild(createIcon('check', 'text-sm'));
        
        // 應用自定義主題（如果有）
        if (customTheme) {
            applyThemeToRoot(customTheme);
            updatePreview(previewBox, customTheme);
        }
        
        createToast('已切換到自定義主題', 'success');
        
        // 重新載入以顯示顏色選擇器
        Router.navigate('/chats/settings');
    };

    themeGrid.appendChild(customCard);
    themeSection.appendChild(themeGrid);
    main.appendChild(themeSection);

    if (currentTheme === 'custom') {
        const customSection = createElement('div', 'mt-6');
        customSection.appendChild(createElement('p', 'ios-section-header', { textContent: '自定義顏色' }));

        const customBox = createElement('div', 'bg-white rounded-xl shadow-sm mt-2 px-4');

        const defaults = customTheme || {
            chatBg: '#FAF9F6',
            bubbleLeftBg: '#FFFFFF',
            bubbleLeftText: '#000000',
            bubbleRightBg: '#FEE500',
            bubbleRightText: '#625B71',
            inputBg: '#F5F5F5'
        };

        const colorInputs = {};

        colorInputs.chatBg = createColorPicker('聊天室底色', defaults.chatBg, async (val) => {
            defaults.chatBg = val;
            customTheme = { ...defaults };
            await SettingsDB.set('chat_custom_theme', customTheme);
            applyThemeToRoot(customTheme);
        });
        customBox.appendChild(colorInputs.chatBg);

        colorInputs.bubbleLeftBg = createColorPicker('對方氣泡背景', defaults.bubbleLeftBg, async (val) => {
            defaults.bubbleLeftBg = val;
            customTheme = { ...defaults };
            await SettingsDB.set('chat_custom_theme', customTheme);
            applyThemeToRoot(customTheme);
        });
        customBox.appendChild(colorInputs.bubbleLeftBg);

        colorInputs.bubbleLeftText = createColorPicker('對方氣泡文字', defaults.bubbleLeftText, async (val) => {
            defaults.bubbleLeftText = val;
            customTheme = { ...defaults };
            await SettingsDB.set('chat_custom_theme', customTheme);
            applyThemeToRoot(customTheme);
        });
        customBox.appendChild(colorInputs.bubbleLeftText);

        colorInputs.bubbleRightBg = createColorPicker('我的氣泡背景', defaults.bubbleRightBg, async (val) => {
            defaults.bubbleRightBg = val;
            customTheme = { ...defaults };
            await SettingsDB.set('chat_custom_theme', customTheme);
            applyThemeToRoot(customTheme);
        });
        customBox.appendChild(colorInputs.bubbleRightBg);

        colorInputs.bubbleRightText = createColorPicker('我的氣泡文字', defaults.bubbleRightText, async (val) => {
            defaults.bubbleRightText = val;
            customTheme = { ...defaults };
            await SettingsDB.set('chat_custom_theme', customTheme);
            applyThemeToRoot(customTheme);
        });
        customBox.appendChild(colorInputs.bubbleRightText);

        colorInputs.inputBg = createColorPicker('輸入區域背景', defaults.inputBg, async (val) => {
            defaults.inputBg = val;
            customTheme = { ...defaults };
            await SettingsDB.set('chat_custom_theme', customTheme);
            applyThemeToRoot(customTheme);
        });
        customBox.appendChild(colorInputs.inputBg);

        customSection.appendChild(customBox);
        main.appendChild(customSection);
    }

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
    
    const previewBox = createElement('div', 'rounded-xl p-4 mt-2 flex flex-col gap-3');
    
    let previewVars;
    if (currentTheme === 'custom' && customTheme) {
        previewVars = customTheme;
    } else {
        const theme = THEMES.find(t => t.id === currentTheme);
        previewVars = theme?.vars || THEMES[0].vars;
    }
    
    previewBox.style.background = previewVars.chatBg;
    previewBox.style.fontSize = currentFontSize === 'small' ? '14px' : currentFontSize === 'large' ? '20px' : '16px';
    
    const leftBubble = createElement('div', 'inline-block px-3 py-2 rounded-xl max-w-[70%] preview-bubble-left');
    leftBubble.style.background = previewVars.bubbleLeftBg;
    leftBubble.style.color = previewVars.bubbleLeftText;
    leftBubble.textContent = '對方的訊息';
    previewBox.appendChild(leftBubble);
    
    const rightBubble = createElement('div', 'inline-block px-3 py-2 rounded-xl max-w-[70%] self-end preview-bubble-right');
    rightBubble.style.background = previewVars.bubbleRightBg;
    rightBubble.style.color = previewVars.bubbleRightText;
    rightBubble.textContent = '我的訊息';
    previewBox.appendChild(rightBubble);
    
    previewSection.appendChild(previewBox);
    main.appendChild(previewSection);

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
                    
                    const addBtnInner = createElement('button', 'px-3 py-1 rounded-lg bg-kakao-yellow text-kakao-brown text-sm font-medium');
                    addBtnInner.textContent = '加入';
                    addBtnInner.onclick = async () => {
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
                    row.appendChild(addBtnInner);
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
        
        const mcpSection = createElement('div', 'mt-6');
        mcpSection.appendChild(createElement('p', 'ios-section-header', { textContent: 'MCP 工具' }));
        
        const mcpEnabled = chat.enabled_mcp_ids && chat.enabled_mcp_ids.length > 0;
        
        const mcpToggleBox = createElement('div', 'bg-white rounded-xl shadow-sm mt-2');
        const mcpToggleRow = createElement('div', 'flex items-center justify-between p-4');
        mcpToggleRow.appendChild(createElement('span', 'text-base', { textContent: '啟用 MCP 工具' }));
        
        const toggle = createElement('button', 'relative w-12 h-7 rounded-full transition-colors');
        toggle.className = mcpEnabled ? 'bg-green-500' : 'bg-gray-300';
        const toggleKnob = createElement('div', 'absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform');
        toggleKnob.style.transform = mcpEnabled ? 'translateX(24px)' : 'translateX(4px)';
        toggle.appendChild(toggleKnob);
        mcpToggleRow.appendChild(toggle);
        mcpToggleBox.appendChild(mcpToggleRow);
        
        const mcpConfigs = await MCPConfigDB.getAll();
        
        if (mcpEnabled) {
            const divider = createElement('div', 'h-px bg-gray-200 mx-4');
            mcpToggleBox.appendChild(divider);
            
            const mcpListTitle = createElement('div', 'px-4 pt-3 pb-1');
            mcpListTitle.appendChild(createElement('span', 'text-sm text-gray-500', { textContent: '選擇要啟用的 MCP 伺服器' }));
            mcpToggleBox.appendChild(mcpListTitle);
            
            const enabledIds = chat.enabled_mcp_ids || [];
            
            for (const config of mcpConfigs) {
                const mcpRow = createElement('div', 'flex items-center justify-between px-4 py-3');
                mcpRow.appendChild(createElement('span', 'text-base', { textContent: config.name || '未命名' }));
                
                const checkbox = createElement('div', `w-6 h-6 rounded-md border-2 flex items-center justify-center transition-colors ${enabledIds.includes(config.id) ? 'bg-green-500 border-green-500' : 'border-gray-300 bg-white'}`);
                if (enabledIds.includes(config.id)) {
                    checkbox.innerHTML = '<svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
                }
                
                checkbox.onclick = async () => {
                    let newEnabledIds;
                    if (enabledIds.includes(config.id)) {
                        newEnabledIds = enabledIds.filter(id => id !== config.id);
                    } else {
                        newEnabledIds = [...enabledIds, config.id];
                    }
                    
                    await ChatsDB.update(chatId, { enabled_mcp_ids: newEnabledIds });
                    createToast('已更新', 'success');
                    Router.navigate('/chats/settings/' + chatId);
                };
                
                mcpRow.appendChild(checkbox);
                mcpToggleBox.appendChild(mcpRow);
            }
        }
        
        toggle.onclick = async () => {
            if (mcpEnabled) {
                await ChatsDB.update(chatId, { enabled_mcp_ids: [] });
                createToast('已停用 MCP 工具', 'success');
            } else {
                await ChatsDB.update(chatId, { enabled_mcp_ids: mcpConfigs.map(c => c.id) });
                createToast('已啟用 MCP 工具', 'success');
            }
            Router.navigate('/chats/settings/' + chatId);
        };
        
        mcpSection.appendChild(mcpToggleBox);
        main.appendChild(mcpSection);
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