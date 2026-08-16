import Router from '../../router.js';
import { createElement, createIcon, createKakaoBubble, createToast, createKakaoBottomSheet, createKakaoSideMenu, createGroupTypingIndicator } from '../../components.js';
import { ChatsDB, MessagesDB, SettingsDB, MemoryDB, CharactersDB, UsersDB } from '../../db.js';
import APIClient from '../../api.js';

let currentChat = null;
let messages = [];
let activeResponseCount = 0;
let messageCount = 0;
let batchProcessing = false;
let streamingPlaceholders = new Map();
let awaitingResponse = false;

const MODE_OPTIONS = [
    { id: 'full', label: '完整模式', desc: '包含動作、場景、對話等描述，不少於 400 字' },
    { id: 'dialogue_single', label: '對話模式（單句回應）', desc: '每次只用一句話回應' },
    { id: 'dialogue_multi', label: '對話模式（多句回應）', desc: '用多句話自然回應' },
    { id: 'custom', label: '自定義模式', desc: '自行輸入想要的回應方式' }
];

function getModeLabel(mode) {
    const found = MODE_OPTIONS.find(o => o.id === mode);
    return found ? found.label : '對話模式（多句回應）';
}

async function applyCustomTheme() {
    const theme = await SettingsDB.get('chat_custom_theme');
    const savedTheme = await SettingsDB.get('appearance_theme');
    
    if (savedTheme === 'custom' && theme) {
        const root = document.documentElement;
        root.style.setProperty('--kakao-chat-bg', theme.chatBg);
        root.style.setProperty('--kakao-bubble-left-bg', theme.bubbleLeftBg);
        root.style.setProperty('--kakao-bubble-left-text', theme.bubbleLeftText);
        root.style.setProperty('--kakao-bubble-right-bg', theme.bubbleRightBg);
        root.style.setProperty('--kakao-bubble-right-text', theme.bubbleRightText);
        root.style.setProperty('--kakao-input-bg', theme.inputBg);
        root.style.setProperty('--kakao-input-text', theme.inputText || '#000000');
    }
}

async function renderChat(params) {
    try {
        const chatId = params.id;
        console.log('[Chat] 開始渲染聊天:', chatId);
        
        console.log('[Chat] 應用自定義主題...');
        await applyCustomTheme();
        
        console.log('[Chat] 載入聊天數據...');
        currentChat = await ChatsDB.getById(chatId);
        if (!currentChat) {
            console.error('[Chat] 找不到聊天:', chatId);
            window.showError({
                message: '找不到聊天 ID: ' + chatId,
                title: '聊天不存在'
            });
            Router.navigate('/chats');
            return { element: createElement('div'), cleanup: null };
        }
        console.log('[Chat] 聊天數據載入成功:', currentChat.character_name);
        
        console.log('[Chat] 載入訊息...');
        messages = await MessagesDB.getByChatId(chatId);
        console.log('[Chat] 訊息載入成功，共', messages.length, '條');
        const lastMsg = messages[messages.length - 1];
        awaitingResponse = !!lastMsg && lastMsg.role === 'user';
        
        const container = createElement('div', 'app-container kakao-chat-bg');
        
        const header = createElement('header', 'kakao-header');
        header.style.paddingTop = 'env(safe-area-inset-top, 0px)';
        
        const backBtn = createElement('button', 'flex items-center gap-1');
        backBtn.appendChild(createIcon('chevron_left'));
        backBtn.appendChild(createElement('span', '', { textContent: '返回' }));
        backBtn.style.cssText = 'color:#141413;font-size:17px;font-family:-apple-system,BlinkMacSystemFont,Arial,sans-serif;background:transparent;border:none;cursor:pointer;padding:6px 0;';
        backBtn.onclick = () => Router.navigate('/chats');
    header.appendChild(backBtn);
    
    const title = createElement('h1', '');
    
    if (currentChat.is_group) {
        title.textContent = '群組聊天';
        const memberIds = currentChat.member_ids || [];
        const avatarStack = createElement('div', 'flex -space-x-2 ml-2');
        const displayMembers = memberIds.slice(0, 3);
        for (const mid of displayMembers) {
            const char = await CharactersDB.getById(mid);
            if (char) {
                const avatar = createElement('img', 'w-7 h-7 rounded-full border-2 border-white object-cover', {
                    src: char.avatar || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23E5E5EA"/><text x="50" y="60" text-anchor="middle" font-size="40" fill="%238E8E93">?</text></svg>',
                    alt: char.name
                });
                avatarStack.appendChild(avatar);
            }
        }
        if (memberIds.length > 3) {
            const overflow = createElement('div', 'w-7 h-7 rounded-full border-2 border-white bg-gray-200 flex items-center justify-center text-xs text-gray-600');
            overflow.textContent = '+' + (memberIds.length - 3);
            avatarStack.appendChild(overflow);
        }
        const titleRow = createElement('div', 'flex items-center');
        titleRow.appendChild(title);
        titleRow.appendChild(avatarStack);
        header.appendChild(titleRow);
    } else {
        title.textContent = currentChat.character_name;
        header.appendChild(title);
    }
    
    const menuBtn = createElement('button', '');
    menuBtn.appendChild(createIcon('menu'));
    menuBtn.style.cssText = 'color:#141413;background:transparent;border:none;cursor:pointer;padding:6px 8px;';
    
    async function showWeatherLocationDialog() {
        const inputSheet = createKakaoBottomSheet([], {
            title: 'Set Weather Location',
            customContent: (() => {
                const wrapper = createElement('div', 'p-4');
                const input = createElement('input', 'w-full p-3 border rounded-lg text-base');
                input.type = 'text';
                input.placeholder = 'Enter city name (e.g., Taipei, Tokyo)';
                input.value = currentChat.weather_location || '';
                const hint = createElement('div', 'text-sm text-gray-500 mt-2');
                hint.textContent = 'Supports Chinese or English city names';
                const saveBtn = createElement('button', 'w-full mt-4 p-3 bg-kakao-yellow text-kakao-brown font-bold rounded-lg');
                saveBtn.textContent = 'Save';
                saveBtn.onclick = async () => {
                    const value = input.value.trim();
                    if (value) {
                        await ChatsDB.update(chatId, { weather_location: value });
                        currentChat = await ChatsDB.getById(chatId);
                        createToast('已儲存天氣地點：' + value);
                        inputSheet.close();
                    }
                };
                wrapper.appendChild(input);
                wrapper.appendChild(hint);
                wrapper.appendChild(saveBtn);
                return wrapper;
            })()
        });
        inputSheet.open();
    }
    
    async function openOutputModeSheet() {
        const currentMode = currentChat.response_mode || 'dialogue_multi';
        const currentCustom = currentChat.custom_response_prompt || '';
        
        const wrapper = createElement('div', 'p-4 flex flex-col gap-2');
        
        const renderOptions = () => {
            wrapper.innerHTML = '';
            MODE_OPTIONS.forEach(opt => {
                const row = createElement('div', 'flex items-center gap-3 p-3 rounded-lg cursor-pointer border ' + (opt.id === currentMode ? 'border-kakao-yellow bg-kakao-yellow/10' : 'border-gray-100 bg-gray-50'));
                const name = createElement('div', 'flex-1');
                name.appendChild(createElement('div', 'font-medium', { textContent: opt.label }));
                name.appendChild(createElement('div', 'text-xs text-gray-500 mt-0.5', { textContent: opt.desc }));
                row.appendChild(name);
                if (opt.id === currentMode) {
                    row.appendChild(createElement('span', 'text-kakao-yellow font-bold', { textContent: '✓' }));
                }
                row.onclick = () => {
                    if (opt.id === 'custom') {
                        renderCustomInput();
                    } else {
                        ChatsDB.update(chatId, { response_mode: opt.id }).then(async () => {
                            currentChat = await ChatsDB.getById(chatId);
                            createToast('已切換為「' + opt.label + '」');
                            sheet.close();
                        });
                    }
                };
                wrapper.appendChild(row);
            });
        };
        
        const renderCustomInput = () => {
            wrapper.innerHTML = '';
            wrapper.appendChild(createElement('div', 'font-medium mb-2', { textContent: '輸入你想要的回應方式：' }));
            const textarea = createElement('textarea', 'w-full p-3 border rounded-lg text-base', {
                rows: '4',
                placeholder: '例：用詩意的語氣回覆，每一段結尾加上一句感想…'
            });
            textarea.value = currentCustom;
            wrapper.appendChild(textarea);
            const saveBtn = createElement('button', 'w-full mt-3 p-3 bg-kakao-yellow text-kakao-brown font-bold rounded-lg', { textContent: '儲存' });
            saveBtn.onclick = async () => {
                const prompt = textarea.value.trim();
                await ChatsDB.update(chatId, { response_mode: 'custom', custom_response_prompt: prompt });
                currentChat = await ChatsDB.getById(chatId);
                createToast('已儲存自定義模式');
                sheet.close();
            };
            wrapper.appendChild(saveBtn);
            const backBtn = createElement('button', 'w-full mt-2 p-3 border rounded-lg font-medium', { textContent: '返回' });
            backBtn.onclick = () => renderOptions();
            wrapper.appendChild(backBtn);
        };
        
        renderOptions();
        
        const sheet = createKakaoBottomSheet([], {
            title: '輸出模式',
            customContent: wrapper
        });
        sheet.open();
    }
    
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (isIOS) {
        const iosStyle = document.createElement('style');
        iosStyle.textContent = '.kakao-message-row .kakao-bubble-text { -webkit-user-select: none !important; user-select: none !important; -webkit-touch-callout: none !important; }';
        document.head.appendChild(iosStyle);
    }
    
    function setupBubbleLongPress(bubbleEl, messageId, role) {
        let longPressTimer = null;
        const clear = () => { if (longPressTimer) { clearTimeout(longPressTimer); longPressTimer = null; } };
        bubbleEl.addEventListener('touchstart', (e) => {
            longPressTimer = setTimeout(() => {
                e.preventDefault();
                showBubbleMenu(messageId, bubbleEl, role);
            }, 600);
        }, { passive: false });
        bubbleEl.addEventListener('touchmove', clear, { passive: true });
        bubbleEl.addEventListener('touchend', clear, { passive: true });
        bubbleEl.addEventListener('touchcancel', clear, { passive: true });
        bubbleEl.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showBubbleMenu(messageId, bubbleEl, role);
        });
    }
    
    function showBubbleMenu(messageId, bubbleEl, role) {
        const content = bubbleEl.querySelector('.kakao-bubble-text')?.textContent || '';
        const sheet = createKakaoBottomSheet([
            { icon: 'edit', label: '編輯該句聊天', onSelect: () => editMessage(messageId, content, bubbleEl) },
            { icon: 'delete', label: '刪除該句聊天', onSelect: () => deleteMessage(messageId, bubbleEl) },
            { icon: 'star', label: '設定為重要記憶', onSelect: () => saveAsImportantMemory(content, role) }
        ], { title: '訊息操作' });
        sheet.open();
    }
    
    async function deleteMessage(messageId, bubbleEl) {
        await MessagesDB.delete(messageId);
        bubbleEl.remove();
        messages = await MessagesDB.getByChatId(chatId);
        messageCount = messages.length;
        createToast('已刪除');
    }
    
    async function editMessage(messageId, originalContent, bubbleEl) {
        const textEl = bubbleEl.querySelector('.kakao-bubble-text');
        if (!textEl) return;
        
        const textarea = document.createElement('textarea');
        textarea.value = originalContent;
        textarea.rows = 3;
        textarea.style.cssText = 'width:100%;min-height:60px;resize:vertical;font-size:14px;padding:8px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = '取消';
        cancelBtn.style.cssText = 'padding:4px 12px;font-size:13px;border:none;border-radius:6px;background:#f0f0f0;cursor:pointer;';
        const saveBtn = document.createElement('button');
        saveBtn.textContent = '儲存';
        saveBtn.style.cssText = 'padding:4px 12px;font-size:13px;border:none;border-radius:6px;background:#FEE500;cursor:pointer;font-weight:500;';
        
        const btnBar = document.createElement('div');
        btnBar.style.cssText = 'display:flex;gap:8px;margin-top:8px;justify-content:flex-end;';
        btnBar.appendChild(cancelBtn);
        btnBar.appendChild(saveBtn);
        
        const wrapper = document.createElement('div');
        wrapper.appendChild(textarea);
        wrapper.appendChild(btnBar);
        
        textEl.replaceWith(wrapper);
        
        const restore = () => {
            wrapper.replaceWith(textEl);
            textEl.textContent = originalContent;
        };
        
        cancelBtn.onclick = restore;
        saveBtn.onclick = async () => {
            const newContent = textarea.value.trim();
            if (!newContent || newContent === originalContent) {
                restore();
                return;
            }
            await MessagesDB.update(messageId, { content: newContent });
            textEl.textContent = newContent;
            wrapper.replaceWith(textEl);
            createToast('已更新');
        };
    }
    
    async function saveAsImportantMemory(content, role) {
        if (!content) return;
        await MemoryDB.create({
            chat_id: chatId,
            content,
            importance: 1.0,
            memory_type: 'important',
            domain: role === 'user' ? 'user_message' : 'assistant_message'
        });
        createToast('已設為重要記憶');
    }
    
    async function exportChatToHTML() {
        const msgs = await MessagesDB.getByChatId(chatId);
        const char = currentChat;
        const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Chat with ${char.character_name}</title>
    <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
        .msg { padding: 12px; margin: 8px 0; border-radius: 16px; max-width: 80%; }
        .user { background: #FEE500; margin-left: auto; text-align: right; }
        .ai { background: white; }
        .avatar { width: 40px; height: 40px; border-radius: 20px; object-fit: cover; }
        .header { display: flex; align-items: center; gap: 12px; margin-bottom: 20px; }
        .time { font-size: 12px; color: #999; }
    </style>
</head>
<body>
    <div class="header">
        <img class="avatar" src="${char.character_avatar || ''}" alt="${char.character_name}">
        <h1>${char.character_name}</h1>
    </div>
    ${msgs.map(m => `<div class="msg ${m.role}">${m.content}<div class="time">${new Date(m.timestamp).toLocaleString()}</div></div>`).join('')}
</body>
</html>`;
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `chat-${char.character_name}-${Date.now()}.html`;
        a.click();
        URL.revokeObjectURL(url);
        createToast('Chat exported successfully');
    }
    
    async function generateMemorySummary() {
        if (!window.App?.memorySystem) {
            createToast('Memory system not available');
            return;
        }
        createToast('Generating memory summary...');
        try {
            const msgs = await MessagesDB.getByChatId(chatId);
            if (msgs.length === 0) {
                createToast('No messages to summarize');
                return;
            }
            const last10 = msgs.slice(-10);
            const primaryCharId = currentChat.is_group ? ((currentChat.member_ids && currentChat.member_ids[0]) || null) : currentChat.character_id;
            await window.App.memorySystem.processBatch(last10, chatId, primaryCharId);
            createToast('Memory summary generated');
        } catch (e) {
            createToast('Failed to generate summary: ' + e.message, 'error');
        }
    }
    
    async function forceSleepCycle() {
        if (!window.App?.memorySystem?.runSleepCycle) {
            createToast('Memory system sleep cycle not available');
            return;
        }
        createToast('Running memory sleep cycle...');
        try {
            await window.App.memorySystem.runSleepCycle();
            createToast('Sleep cycle completed');
        } catch (e) {
            createToast('Failed: ' + e.message, 'error');
        }
    }
    
    async function createDailyBackup() {
        const msgs = await MessagesDB.getByChatId(chatId);
        const char = currentChat;
        const backup = {
            chat_id: chatId,
            character_id: char.character_id,
            character_name: char.character_name,
            messages: msgs,
            timestamp: Date.now(),
            type: 'daily_backup'
        };
        const backupKey = `backup_${chatId}_${Date.now()}`;
        await SettingsDB.set(backupKey, backup);
        createToast('Daily backup created');
    }
    
    async function blockCharacter() {
        const hours = 1;
        const blockedUntil = Date.now() + hours * 60 * 60 * 1000;
        await ChatsDB.update(chatId, { blocked_until: blockedUntil });
        createToast(`Character blocked for ${hours} hour(s)`);
    }
    
    async function clearMemory() {
        const memories = await MemoryDB.getByChatId(chatId);
        if (memories.length === 0) {
            createToast('No memories to clear');
            return;
        }
        for (const m of memories) {
            await MemoryDB.delete(m.id);
        }
        createToast('Memory cleared');
    }
    
    async function openGroupMemberSheet() {
        const characters = await CharactersDB.getAll();
        const memberIds = currentChat.member_ids || [];
        
        const form = createElement('div', 'p-4 flex flex-col gap-3');
        
        const hint = createElement('div', 'text-sm text-gray-500 mb-2');
        hint.textContent = '選擇要加入群組的角色（最多 4 個）';
        form.appendChild(hint);
        
        const list = createElement('div', 'flex flex-col gap-2');
        
        characters.forEach(char => {
            const isMember = memberIds.includes(char.id);
            const row = createElement('div', 'flex items-center gap-3 p-3 rounded-lg bg-gray-50');
            
            const avatar = createElement('img', 'w-10 h-10 rounded-full object-cover', {
                src: char.avatar || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23E5E5EA"/><text x="50" y="60" text-anchor="middle" font-size="40" fill="%238E8E93">?</text></svg>',
                alt: char.name
            });
            row.appendChild(avatar);
            
            const name = createElement('span', 'flex-1 text-body-lg');
            name.textContent = char.name + (isMember ? ' (已加入)' : '');
            row.appendChild(name);
            
            if (!isMember) {
                const addBtn = createElement('button', 'px-3 py-1 rounded-lg bg-kakao-yellow text-kakao-brown text-sm font-medium');
                addBtn.textContent = '加入';
                addBtn.onclick = async () => {
                    const newMemberIds = [...memberIds, char.id];
                    if (newMemberIds.length > 4) {
                        createToast('群組最多 4 個成員');
                        return;
                    }
                    await ChatsDB.update(chatId, { member_ids: newMemberIds });
                    currentChat = await ChatsDB.getById(chatId);
                    createToast('已加入 ' + char.name);
                    sheet.close();
                    Router.navigate('/chat/' + chatId);
                };
                row.appendChild(addBtn);
            }
            
            list.appendChild(row);
        });
        
        form.appendChild(list);
        
        const sheet = createKakaoBottomSheet([], {
            title: '群組成員',
            customContent: form
        });
        
        sheet.open();
    }
    
    const sideMenuItems = [
        {
            icon: 'person',
            label: '角色資訊',
            onClick: () => currentChat.is_group ? createToast('群組聊天') : Router.navigate('/characters/' + currentChat.character_id)
        },
        { icon: 'account_circle', label: '使用者形象', onClick: () => createToast('使用者形象功能開發中') },
        { icon: 'public', label: '世界觀設定', onClick: () => createToast('世界觀設定功能開發中') }
    ];
    
    if (currentChat.is_group) {
        const memberIds = currentChat.member_ids || [];
        sideMenuItems.push({
            icon: 'group',
            label: '群組成員',
            value: memberIds.length + ' 位成員',
            onClick: openGroupMemberSheet
        });
    }
    
    const sideMenu = createKakaoSideMenu({
        title: currentChat.is_group ? '群組聊天' : currentChat.character_name,
        sections: [
            {
                title: '資訊',
                items: sideMenuItems
            },
            {
                title: '輸出模式',
                items: [
                    { icon: 'chat', label: '回應模式', value: getModeLabel(currentChat.response_mode || 'dialogue_multi'), onClick: openOutputModeSheet }
                ]
            },
            {
                title: '設定',
                items: [
                    { icon: 'settings', label: '聊天設定', onClick: () => Router.navigate('/chats/settings/' + chatId) },
                    { icon: 'location_on', label: '天氣地點', value: currentChat.weather_location || '未設定', onClick: showWeatherLocationDialog },
                    { icon: 'wb_sunny', label: '真實世界資訊', toggle: currentChat.enable_real_world_info || false, onToggle: async (val) => {
                        await ChatsDB.update(chatId, { enable_real_world_info: val });
                        currentChat = await ChatsDB.getById(chatId);
                        createToast(val ? '已啟用真實世界資訊' : '已停用真實世界資訊');
                    }}
                ]
            },
            {
                title: '匯出與記憶',
                items: [
                    { icon: 'download', label: '匯出聊天記錄', onClick: exportChatToHTML },
                    { icon: 'psychology', label: '生成記憶摘要', onClick: generateMemorySummary },
                    { icon: 'bedtime', label: '執行休眠', onClick: forceSleepCycle }
                ]
            },
            {
                title: '每日',
                items: [
                    { icon: 'backup', label: '每日備份', onClick: createDailyBackup },
                    { icon: 'history_edu', label: '每日紀錄', onClick: () => createToast('每日紀錄功能開發中') }
                ]
            },
            {
                title: '危險區',
                items: [
                    { divider: true },
                    { icon: 'block', label: '封鎖角色', danger: true, onClick: blockCharacter },
                    { icon: 'delete', label: '清空聊天', danger: true, onClick: async () => {
                        await MessagesDB.clearByChatId(chatId);
                        createToast('聊天記錄已清空');
                        Router.navigate('/chats');
                    }},
                    { icon: 'delete_forever', label: '清除記憶', danger: true, onClick: clearMemory }
                ]
            }
        ]
    });
    
    menuBtn.onclick = () => sideMenu.open();
    header.appendChild(menuBtn);
    
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar px-0 pt-[87px] pb-[101px] flex flex-col gap-0');
    
    if (messages.length > 0) {
        const firstMessageDate = new Date(messages[0].timestamp);
        const dateDivider = createElement('div', 'kakao-date-divider');
        const dateSpan = createElement('span', '', { 
            textContent: firstMessageDate.getFullYear() + '年' + (firstMessageDate.getMonth() + 1) + '月' + firstMessageDate.getDate() + '日'
        });
        dateDivider.appendChild(dateSpan);
        main.appendChild(dateDivider);
    }
    
    for (const msg of messages) {
        let avatar = currentChat.character_avatar;
        let name = currentChat.character_name;
        
        if (msg.role === 'assistant' && msg.speaker_character_id) {
            const speakerChar = await CharactersDB.getById(msg.speaker_character_id);
            if (speakerChar) {
                avatar = speakerChar.avatar || avatar;
                name = speakerChar.name || name;
            }
        }
        
        const bubble = createKakaoBubble(
            msg.role === 'user' ? 'user' : 'ai',
            msg.content,
            avatar,
            name,
            msg.speaker_character_id || undefined
        );
        setupBubbleLongPress(bubble, msg.id, msg.role);
        main.appendChild(bubble);
    }
    
    container.appendChild(main);
    
    const inputArea = createElement('div', 'kakao-chat-input-area');
    
    const inputWrapper = createElement('div', 'kakao-chat-input-wrapper');
    
    const addBtn = createElement('button', 'text-ios-muted');
    addBtn.style.cssText = 'background:transparent;border:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;width:24px;height:28px;';
    addBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="25" height="28" viewBox="0 0 25 28" fill="none"><path d="M11.0378 14.9722H5.20447V13.0278H11.0378V7.19443H12.9822V13.0278H18.8156V14.9722H12.9822V20.8055H11.0378V14.9722Z" fill="#6B6B6B"/></svg>';
    
    const plusMenu = createKakaoBottomSheet([
        { icon: 'psychology', label: '思維鏈', onSelect: () => createToast('思維鏈功能開發中') },
        { icon: 'favorite', label: '心聲', onSelect: () => createToast('心聲功能開發中') },
        { icon: 'summarize', label: '生成總結', onSelect: () => createToast('生成總結功能開發中') },
        { icon: 'import_contacts', label: 'Wiki', onSelect: () => createToast('Wiki功能開發中') },
        { icon: 'photo_library', label: '相簿', onSelect: () => createToast('相簿功能開發中') },
        { icon: 'photo_camera', label: '拍照', onSelect: () => createToast('拍照功能開發中') },
        { icon: 'videocam', label: '影片', onSelect: () => createToast('影片功能開發中') },
        { icon: 'mic', label: '語音', onSelect: () => createToast('語音功能開發中') },
        { icon: 'attach_file', label: '檔案', onSelect: () => createToast('檔案功能開發中') },
        { icon: 'emoji_emotions', label: '表情', onSelect: () => createToast('表情功能開發中') },
        { icon: 'redeem', label: 'Icon', onSelect: () => createToast('Icon功能開發中') },
        { icon: 'share', label: '分享', onSelect: () => createToast('分享功能開發中') },
        { icon: 'location_on', label: '位置', onSelect: () => createToast('位置功能開發中') },
        { icon: 'schedule', label: '日程', onSelect: () => createToast('日程功能開發中') },
        { icon: 'payments', label: '轉帳', onSelect: () => createToast('轉帳功能開發中') },
        { icon: 'shopping_bag', label: '購物', onSelect: () => createToast('購物功能開發中') },
        { icon: 'restaurant', label: '外送', onSelect: () => createToast('外送功能開發中') },
        { icon: 'map', label: '地圖', onSelect: () => createToast('地圖功能開發中') },
        { icon: 'music_note', label: '音樂', onSelect: () => createToast('音樂功能開發中') },
        { icon: '', label: '', onSelect: null }
    ], { title: '功能選單' });
    
    addBtn.onclick = () => plusMenu.open();
    inputWrapper.appendChild(addBtn);
    
    const textarea = createElement('textarea', 'kakao-chat-textarea', {
        placeholder: '輸入訊息',
        rows: '1'
    });
    textarea.addEventListener('input', () => {
        textarea.style.height = 'auto';
        textarea.style.height = Math.min(textarea.scrollHeight, 100) + 'px';
    });
    inputWrapper.appendChild(textarea);
    
    const sendBtn = createElement('button', 'kakao-send-btn', { textContent: '傳送' });
    sendBtn.disabled = true;
    
    textarea.addEventListener('input', () => {
        sendBtn.disabled = textarea.value.trim() === '' || activeResponseCount > 0;
    });
    
    const sendMessage = async () => {
        const content = textarea.value.trim();
        if (!content || activeResponseCount > 0) return;
        
        textarea.value = '';
        textarea.style.height = '';
        
        const msg = await MessagesDB.create(chatId, 'user', content);
        
        const userBubble = createKakaoBubble('user', content);
        setupBubbleLongPress(userBubble, msg.id, 'user');
        main.appendChild(userBubble);
        
        requestAnimationFrame(() => {
            main.scrollTop = main.scrollHeight;
        });
        
        messages = await MessagesDB.getByChatId(chatId);
        messageCount = messages.length;
        awaitingResponse = true;
        updateInputDisabled();
    };
    
    sendBtn.onclick = sendMessage;
    
    const generateBtn = createElement('button', 'kakao-generate-btn');
    generateBtn.style.cssText = 'background:transparent;border:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;width:28px;height:28px;margin-left:4px;';
    generateBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24"></path><path d="M21 3v6h-6"></path></svg>';
    generateBtn.style.color = '#6B6B6B';
    generateBtn.title = '生成回應';
    
    async function startGroupResponses(userMessage) {
        const memberIds = currentChat.member_ids || [];
        if (memberIds.length === 0) return;
        
        activeResponseCount = memberIds.length;
        updateInputDisabled();
        
        const memberChars = new Map();
        for (const mid of memberIds) {
            memberChars.set(mid, await CharactersDB.getById(mid));
        }
        
        for (const mid of memberIds) {
            const char = memberChars.get(mid);
            const avatar = char?.avatar || '';
            const name = char?.name || 'AI';
            const placeholder = createGroupTypingIndicator(avatar, name);
            streamingPlaceholders.set(mid, placeholder);
            main.appendChild(placeholder);
        }
        main.scrollTop = main.scrollHeight;
        
        const callbacks = memberIds.map((memberId) => {
            const char = memberChars.get(memberId);
            const avatar = char?.avatar || '';
            const name = char?.name || 'AI';
            
            return {
                onChunk: (chunk, fullContent) => {
                    const placeholder = streamingPlaceholders.get(memberId);
                    if (placeholder) {
                        const bubbleText = placeholder.querySelector('.kakao-bubble-text');
                        if (bubbleText) {
                            bubbleText.textContent = fullContent;
                        }
                    }
                    main.scrollTop = main.scrollHeight;
                },
                onComplete: async (fullContent) => {
                    const msg = await MessagesDB.create(chatId, 'assistant', fullContent, memberId);
                    
                    const placeholder = streamingPlaceholders.get(memberId);
                    if (placeholder) {
                        const finalBubble = createKakaoBubble('ai', fullContent, avatar, name, memberId);
                        setupBubbleLongPress(finalBubble, msg.id, 'assistant');
                        placeholder.replaceWith(finalBubble);
                        streamingPlaceholders.delete(memberId);
                    }
                    
                    await ChatsDB.update(chatId, { last_message: fullContent.substring(0, 50) });
                    
                    messageCount++;
                    if (messageCount % 10 === 0 && window.App?.memorySystem && !batchProcessing) {
                        const settings = await SettingsDB.getAll();
                        if (settings.memory_enabled) {
                            batchProcessing = true;
                            const recentMessages = await MessagesDB.getByChatId(chatId);
                            const last10 = recentMessages.slice(-10);
                            const primaryCharId = (currentChat.member_ids && currentChat.member_ids[0]) || currentChat.character_id;
                            window.App.memorySystem.processBatch(last10, chatId, primaryCharId)
                                .catch(() => {})
                                .finally(() => { batchProcessing = false; });
                        }
                    }
                    
                    messages = await MessagesDB.getByChatId(chatId);
                    messageCount = messages.length;
                    
                    activeResponseCount--;
                    if (activeResponseCount === 0) awaitingResponse = false;
                    updateInputDisabled();
                },
                onError: (error) => {
                    const placeholder = streamingPlaceholders.get(memberId);
                    if (placeholder) {
                        placeholder.remove();
                        streamingPlaceholders.delete(memberId);
                    }
                    createToast(name + ': ' + error, 'error');
                    activeResponseCount--;
                    if (activeResponseCount === 0) awaitingResponse = false;
                    updateInputDisabled();
                }
            };
        });
        
        await APIClient.groupStream(chatId, userMessage, memberIds, callbacks);
    }
    
    function updateInputDisabled() {
        const isEmpty = textarea.value.trim() === '';
        sendBtn.disabled = isEmpty || activeResponseCount > 0;
        
        if (activeResponseCount > 0) {
            generateBtn.style.color = '#141413';
        } else {
            generateBtn.style.color = '#6B6B6B';
            generateBtn.querySelector('svg').style.animation = '';
        }
    }
    
    let styleSheet = null;
    
    const generateResponse = async () => {
        if (activeResponseCount > 0) return;
        
        const msgs = await MessagesDB.getByChatId(chatId);
        const lastUser = [...msgs].reverse().find(m => m.role === 'user');
        if (!lastUser) {
            awaitingResponse = false;
            updateInputDisabled();
            return;
        }
        const content = lastUser.content;
        main.scrollTop = main.scrollHeight;
        
        if (currentChat.is_group) {
            generateBtn.style.color = '#141413';
            generateBtn.querySelector('svg').style.animation = 'spin 1s linear infinite';
            
            if (!styleSheet) {
                styleSheet = document.createElement('style');
                styleSheet.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
                document.head.appendChild(styleSheet);
            }
            
            await startGroupResponses(content);
        } else {
            activeResponseCount = 1;
            updateInputDisabled();
            
            generateBtn.style.color = '#141413';
            generateBtn.querySelector('svg').style.animation = 'spin 1s linear infinite';
            
            if (!styleSheet) {
                styleSheet = document.createElement('style');
                styleSheet.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
                document.head.appendChild(styleSheet);
            }
            
            const streamingBubble = createElement('div', 'kakao-message-row ai hidden');
            const streamingContent = createElement('div', 'kakao-message-content');
            streamingContent.appendChild(createElement('span', 'kakao-message-name has-name', { textContent: currentChat.character_name }));
            const streamingBubbleInner = createElement('div', 'kakao-bubble-left');
            streamingBubbleInner.appendChild(createElement('span', 'kakao-bubble-text'));
            streamingContent.appendChild(streamingBubbleInner);
            streamingBubble.appendChild(createElement('img', 'kakao-message-avatar', { src: currentChat.character_avatar }));
            streamingBubble.appendChild(streamingContent);
            main.appendChild(streamingBubble);
            
            streamingBubble.classList.remove('hidden');
            const bubbleText = streamingBubble.querySelector('.kakao-bubble-text');
            bubbleText.textContent = '';
            
            await APIClient.stream(
                chatId,
                content,
                (chunk, fullContent) => {
                    bubbleText.textContent = fullContent;
                    main.scrollTop = main.scrollHeight;
                },
                async (fullContent) => {
                    const msg = await MessagesDB.create(chatId, 'assistant', fullContent);
                    
                    const aiBubble = createKakaoBubble('ai', fullContent, currentChat.character_avatar, currentChat.character_name);
                    setupBubbleLongPress(aiBubble, msg.id, 'assistant');
                    streamingBubble.replaceWith(aiBubble);
                    
                    await ChatsDB.update(chatId, { last_message: fullContent.substring(0, 50) });
                    
                    messageCount++;
                    if (messageCount % 10 === 0 && window.App?.memorySystem && !batchProcessing) {
                        const settings = await SettingsDB.getAll();
                        if (settings.memory_enabled) {
                            batchProcessing = true;
                            const recentMessages = await MessagesDB.getByChatId(chatId);
                            const last10 = recentMessages.slice(-10);
                            window.App.memorySystem.processBatch(last10, chatId, currentChat.character_id)
                                .catch(() => {})
                                .finally(() => { batchProcessing = false; });
                        }
                    }
                    
                    messages = await MessagesDB.getByChatId(chatId);
                    messageCount = messages.length;
                    
                    activeResponseCount = 0;
                    awaitingResponse = false;
                    updateInputDisabled();
                },
                (error) => {
                    streamingBubble.classList.add('hidden');
                    createToast(error, 'error');
                    activeResponseCount = 0;
                    awaitingResponse = false;
                    updateInputDisabled();
                }
            );
        }
    };
    
    generateBtn.onclick = generateResponse;
    
    inputWrapper.appendChild(generateBtn);
    inputWrapper.appendChild(sendBtn);
    inputArea.appendChild(inputWrapper);
    container.appendChild(inputArea);
    
    setTimeout(() => {
        main.scrollTop = main.scrollHeight;
    }, 100);
    
    console.log('[Chat] 聊天界面渲染完成');
    return { element: container, cleanup: null };
    } catch (error) {
        console.error('[Chat] 渲染失敗:', error);
        window.showError({
            message: '無法載入聊天界面: ' + error.message,
            title: '聊天錯誤',
            details: error.stack || ''
        });
        Router.navigate('/chats');
        return { element: createElement('div'), cleanup: null };
    }
}

export default {
    id: 'chat',
    name: '對話',
    icon: 'chat',
    routes: [
        { path: '/chat/:id', render: renderChat }
    ],
    navItem: null
};
