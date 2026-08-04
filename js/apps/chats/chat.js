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
                        createToast('Weather location saved: ' + value);
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
            label: 'Character Info',
            onClick: () => currentChat.is_group ? createToast('群組聊天') : Router.navigate('/characters/' + currentChat.character_id)
        },
        { icon: 'account_circle', label: 'User Mask', onClick: () => createToast('User mask feature in development') },
        { icon: 'public', label: 'World Setting', onClick: () => createToast('World setting feature in development') }
    ];
    
    if (currentChat.is_group) {
        const memberIds = currentChat.member_ids || [];
        sideMenuItems.push({
            icon: 'group',
            label: 'Participants',
            value: memberIds.length + ' members',
            onClick: openGroupMemberSheet
        });
    }
    
    const sideMenu = createKakaoSideMenu({
        title: currentChat.is_group ? '群組聊天' : currentChat.character_name,
        sections: [
            {
                title: 'Info',
                items: sideMenuItems
            },
            {
                title: 'Settings',
                items: [
                    { icon: 'settings', label: 'Chat Settings', onClick: () => Router.navigate('/chats/settings/' + chatId) },
                    { icon: 'location_on', label: 'Weather Location', value: currentChat.weather_location || 'Not set', onClick: showWeatherLocationDialog },
                    { icon: 'wb_sunny', label: 'Real World Info', toggle: currentChat.enable_real_world_info || false, onToggle: async (val) => {
                        await ChatsDB.update(chatId, { enable_real_world_info: val });
                        currentChat = await ChatsDB.getById(chatId);
                        createToast(val ? 'Real world info enabled' : 'Real world info disabled');
                    }}
                ]
            },
            {
                title: 'Export & Memory',
                items: [
                    { icon: 'download', label: 'Export Chat', onClick: exportChatToHTML },
                    { icon: 'psychology', label: 'Generate Memory Summary', onClick: generateMemorySummary },
                    { icon: 'bedtime', label: 'Force Sleep', onClick: forceSleepCycle }
                ]
            },
            {
                title: 'Daily',
                items: [
                    { icon: 'backup', label: 'Daily Backup', onClick: createDailyBackup },
                    { icon: 'history_edu', label: 'Daily Record', onClick: () => createToast('Daily record feature in development') }
                ]
            },
            {
                title: 'Danger Zone',
                items: [
                    { divider: true },
                    { icon: 'block', label: 'Block Character', danger: true, onClick: blockCharacter },
                    { icon: 'delete', label: 'Clear Chat', danger: true, onClick: async () => {
                        await MessagesDB.clearByChatId(chatId);
                        createToast('Chat cleared');
                        Router.navigate('/chats');
                    }},
                    { icon: 'delete_forever', label: 'Clear Memory', danger: true, onClick: clearMemory }
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
        main.appendChild(bubble);
    }
    
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
        
        await MessagesDB.create(chatId, 'user', content);
        
        const userBubble = createKakaoBubble('user', content);
        main.appendChild(userBubble);
        
        main.scrollTop = main.scrollHeight;
        
        messages = await MessagesDB.getByChatId(chatId);
        messageCount = messages.length;
    };
    
    sendBtn.onclick = sendMessage;
    
    const generateBtn = createElement('button', 'kakao-generate-btn');
    generateBtn.style.cssText = 'background:transparent;border:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;width:28px;height:28px;margin-left:4px;';
    generateBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24"></path><path d="M21 3v6h-6"></path></svg>';
    generateBtn.style.color = '#6B6B6B';
    generateBtn.title = '生成回應';
    generateBtn.disabled = true;
    
    textarea.addEventListener('input', () => {
        generateBtn.disabled = textarea.value.trim() === '' || activeResponseCount > 0;
    });
    
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
                    await MessagesDB.create(chatId, 'assistant', fullContent, memberId);
                    
                    const placeholder = streamingPlaceholders.get(memberId);
                    if (placeholder) {
                        const finalBubble = createKakaoBubble('ai', fullContent, avatar, name, memberId);
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
                    updateInputDisabled();
                }
            };
        });
        
        await APIClient.groupStream(chatId, userMessage, memberIds, callbacks);
    }
    
    function updateInputDisabled() {
        const isEmpty = textarea.value.trim() === '';
        sendBtn.disabled = isEmpty || activeResponseCount > 0;
        generateBtn.disabled = isEmpty || activeResponseCount > 0;
        
        if (activeResponseCount > 0) {
            generateBtn.style.color = '#141413';
        } else {
            generateBtn.style.color = '#6B6B6B';
            generateBtn.querySelector('svg').style.animation = '';
        }
    }
    
    let styleSheet = null;
    
    const generateResponse = async () => {
        const content = textarea.value.trim();
        if (!content || activeResponseCount > 0) return;
        
        textarea.value = '';
        textarea.style.height = '';
        
        await MessagesDB.create(chatId, 'user', content);
        
        const userBubble = createKakaoBubble('user', content);
        main.appendChild(userBubble);
        
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
                    await MessagesDB.create(chatId, 'assistant', fullContent);
                    
                    const aiBubble = createKakaoBubble('ai', fullContent, currentChat.character_avatar, currentChat.character_name);
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
                    updateInputDisabled();
                },
                (error) => {
                    streamingBubble.classList.add('hidden');
                    createToast(error, 'error');
                    activeResponseCount = 0;
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
