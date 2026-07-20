import Router from '../router.js';
import { createElement, createIcon, createKakaoBottomNav, createKakaoFAB, createKakaoChatCell, createEmptyState, createToast } from '../components.js';
import { ChatsDB } from '../db.js';

let chats = [];

async function render() {
    const container = createElement('div', 'app-container bg-surface-container-lowest');
    
    const header = createElement('header', 'sticky top-0 z-50 flex justify-between items-center h-14 px-4 bg-surface');
    
    const title = createElement('h1', 'text-xl font-bold text-kakao-brown', { textContent: '聊天' });
    header.appendChild(title);
    
    const actions = createElement('div', 'flex items-center gap-4');
    
    const searchBtn = createElement('button', 'p-2 rounded-full active:bg-surface-container transition-colors');
    searchBtn.appendChild(createIcon('search', 'text-kakao-brown text-xl'));
    actions.appendChild(searchBtn);
    
    const addBtn = createElement('button', 'p-2 rounded-full active:bg-surface-container transition-colors');
    addBtn.appendChild(createIcon('chat_add_on', 'text-kakao-brown text-xl'));
    addBtn.onclick = async () => {
        const newChat = await ChatsDB.create({ character_name: 'AI' });
        createToast('已建立新對話');
        Router.navigate(`/chat/${newChat.id}`);
    };
    actions.appendChild(addBtn);
    
    header.appendChild(actions);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    
    chats = await ChatsDB.getAll();
    
    if (chats.length === 0) {
        const emptyState = createEmptyState(
            'chat_bubble',
            '沒有對話',
            '點擊右下角按鈕開始新對話',
            {
                label: '開始對話',
                onClick: async () => {
                    const newChat = await ChatsDB.create({ character_name: 'AI' });
                    Router.navigate(`/chat/${newChat.id}`);
                }
            }
        );
        emptyState.classList.add('pt-24');
        main.appendChild(emptyState);
    } else {
        const list = createElement('section', 'flex flex-col');
        
        chats.forEach(chat => {
            const cell = createKakaoChatCell(chat, () => {
                Router.navigate(`/chat/${chat.id}`);
            });
            list.appendChild(cell);
        });
        
        main.appendChild(list);
    }
    
    container.appendChild(main);
    
    const nav = createKakaoBottomNav(
        [
            { icon: 'person', path: '/chats' },
            { icon: 'chat_bubble', path: '/chats' },
            { icon: 'explore', path: '/world-info' },
            { icon: 'more_horiz', path: '/settings' }
        ],
        1,
        (index, tab) => Router.navigate(tab.path)
    );
    container.appendChild(nav);
    
    const fab = createKakaoFAB(async () => {
        const newChat = await ChatsDB.create({ character_name: 'AI' });
        createToast('已建立新對話');
        Router.navigate(`/chat/${newChat.id}`);
    });
    container.appendChild(fab);
    
    return { element: container, cleanup: null };
}

export { render };