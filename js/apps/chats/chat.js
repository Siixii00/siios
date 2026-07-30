import Router from '../../router.js';
import { createElement, createIcon, createKakaoBubble, createToast, createKakaoBottomSheet } from '../../components.js';
import { ChatsDB, MessagesDB, SettingsDB } from '../../db.js';
import APIClient from '../../api.js';

let currentChat = null;
let messages = [];
let isStreaming = false;
let messageCount = 0;
let batchProcessing = false;

async function renderChat(params) {
    const chatId = params.id;
    
    currentChat = await ChatsDB.getById(chatId);
    if (!currentChat) {
        Router.navigate('/chats');
        return { element: createElement('div'), cleanup: null };
    }
    
    messages = await MessagesDB.getByChatId(chatId);
    
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
    title.textContent = currentChat.character_name;
    header.appendChild(title);
    
    const menuBtn = createElement('button', '');
    menuBtn.appendChild(createIcon('menu'));
    menuBtn.style.cssText = 'color:#141413;background:transparent;border:none;cursor:pointer;padding:6px 8px;';
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
    
    messages.forEach(msg => {
        const bubble = createKakaoBubble(
            msg.role === 'user' ? 'user' : 'ai',
            msg.content,
            currentChat.character_avatar,
            currentChat.character_name
        );
        main.appendChild(bubble);
    });
    
    const streamingBubble = createElement('div', 'kakao-message-row ai hidden');
    const streamingContent = createElement('div', 'kakao-message-content');
    streamingContent.appendChild(createElement('span', 'kakao-message-name has-name', { textContent: currentChat.character_name }));
    const streamingBubbleInner = createElement('div', 'kakao-bubble-left');
    streamingBubbleInner.appendChild(createElement('span', 'kakao-bubble-text'));
    streamingContent.appendChild(streamingBubbleInner);
    streamingBubble.appendChild(createElement('img', 'kakao-message-avatar', { src: currentChat.character_avatar }));
    streamingBubble.appendChild(streamingContent);
    main.appendChild(streamingBubble);
    
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
        sendBtn.disabled = textarea.value.trim() === '' || isStreaming;
    });
    
    const sendMessage = async () => {
        const content = textarea.value.trim();
        if (!content || isStreaming) return;
        
        isStreaming = true;
        sendBtn.disabled = true;
        textarea.value = '';
        textarea.style.height = '';
        
        await MessagesDB.create(chatId, 'user', content);
        
        const userBubble = createKakaoBubble('user', content);
        main.appendChild(userBubble);
        
        main.scrollTop = main.scrollHeight;
        
        messages = await MessagesDB.getByChatId(chatId);
        messageCount = messages.length;
        isStreaming = false;
        generateBtn.disabled = textarea.value.trim() === '';
    };
    
    sendBtn.onclick = sendMessage;
    
    const generateBtn = createElement('button', 'kakao-generate-btn');
    generateBtn.style.cssText = 'background:transparent;border:none;cursor:pointer;padding:0;display:flex;align-items:center;justify-content:center;width:28px;height:28px;margin-left:4px;';
    generateBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.85.83 6.72 2.24"></path><path d="M21 3v6h-6"></path></svg>';
    generateBtn.style.color = '#6B6B6B';
    generateBtn.title = '生成回應';
    generateBtn.disabled = true;
    
    textarea.addEventListener('input', () => {
        generateBtn.disabled = textarea.value.trim() === '' || isStreaming;
    });
    
    let styleSheet = null;
    
    const generateResponse = async () => {
        const content = textarea.value.trim();
        if (!content || isStreaming) return;
        
        isStreaming = true;
        generateBtn.disabled = true;
        generateBtn.style.color = '#141413';
        generateBtn.querySelector('svg').style.animation = 'spin 1s linear infinite';
        
        if (!styleSheet) {
            styleSheet = document.createElement('style');
            styleSheet.textContent = '@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }';
            document.head.appendChild(styleSheet);
        }
        
        await MessagesDB.create(chatId, 'user', content);
        
        const userBubble = createKakaoBubble('user', content);
        main.appendChild(userBubble);
        
        textarea.value = '';
        textarea.style.height = '';
        
        main.scrollTop = main.scrollHeight;
        
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
                
                isStreaming = false;
                generateBtn.style.color = '#6B6B6B';
                generateBtn.querySelector('svg').style.animation = '';
                generateBtn.disabled = textarea.value.trim() === '';
            },
            (error) => {
                streamingBubble.classList.add('hidden');
                createToast(error, 'error');
                isStreaming = false;
                generateBtn.style.color = '#6B6B6B';
                generateBtn.querySelector('svg').style.animation = '';
                generateBtn.disabled = textarea.value.trim() === '';
            }
        );
    };
    
    generateBtn.onclick = generateResponse;
    
    inputWrapper.appendChild(generateBtn);
    inputWrapper.appendChild(sendBtn);
    inputArea.appendChild(inputWrapper);
    container.appendChild(inputArea);
    
    setTimeout(() => {
        main.scrollTop = main.scrollHeight;
    }, 100);
    
    return { element: container, cleanup: null };
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
