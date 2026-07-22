import Router from '../../router.js';
import { createElement, createIcon, createKakaoBubble, createToast } from '../../components.js';
import { ChatsDB, MessagesDB } from '../../db.js';
import APIClient from '../../api.js';

let currentChat = null;
let messages = [];
let isStreaming = false;

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
    header.style.paddingTop = 'env(safe-area-inset-top)';
    
    const backBtn = createElement('button', 'flex items-center text-kakao-brown');
    backBtn.appendChild(createIcon('chevron_left'));
    backBtn.appendChild(createElement('span', '', { textContent: '聊天' }));
    backBtn.onclick = () => Router.navigate('/chats');
    header.appendChild(backBtn);
    
    const title = createElement('h1', 'absolute left-1/2 -translate-x-1/2 font-bold text-kakao-brown');
    title.textContent = currentChat.character_name;
    header.appendChild(title);
    
    const menuBtn = createElement('button', 'text-kakao-brown');
    menuBtn.appendChild(createIcon('menu'));
    header.appendChild(menuBtn);
    
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar px-3 pt-20 pb-28 flex flex-col gap-3');
    
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
    streamingContent.appendChild(createElement('span', 'kakao-message-name', { textContent: currentChat.character_name }));
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
    addBtn.appendChild(createIcon('add', 'text-2xl'));
    inputWrapper.appendChild(addBtn);
    
    const textarea = createElement('textarea', 'kakao-chat-textarea', {
        placeholder: '輸入訊息',
        rows: '1'
    });
    textarea.style.height = '36px';
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
        textarea.style.height = '36px';
        
        await MessagesDB.create(chatId, 'user', content);
        
        const userBubble = createKakaoBubble('user', content);
        main.appendChild(userBubble);
        
        main.scrollTop = main.scrollHeight;
        
        streamingBubble.classList.remove('hidden');
        const bubbleText = streamingBubble.querySelector('.kakao-bubble-text');
        bubbleText.textContent = '';
        
        await APIClient.stream(
            chatId,
            content,
            {},
            messages,
            (chunk, fullContent) => {
                bubbleText.textContent = fullContent;
                main.scrollTop = main.scrollHeight;
            },
            async (fullContent) => {
                await MessagesDB.create(chatId, 'assistant', fullContent);
                
                const aiBubble = createKakaoBubble('ai', fullContent, currentChat.character_avatar, currentChat.character_name);
                streamingBubble.replaceWith(aiBubble);
                
                await ChatsDB.update(chatId, { last_message: fullContent.substring(0, 50) });
                
                isStreaming = false;
                sendBtn.disabled = textarea.value.trim() === '';
            },
            (error) => {
                streamingBubble.classList.add('hidden');
                createToast(error, 'error');
                isStreaming = false;
                sendBtn.disabled = textarea.value.trim() === '';
            }
        );
        
        messages = await MessagesDB.getByChatId(chatId);
    };
    
    sendBtn.onclick = sendMessage;
    
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
