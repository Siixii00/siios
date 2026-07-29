import Router from '../../router.js';
import { createElement, createIcon, createKakaoBottomNav, createKakaoChatCell, createEmptyState, createToast } from '../../components.js';
import { ChatsDB } from '../../db.js';
import { CHATS_TABS } from './chats-nav.js';

let chats = [];

async function renderChatsList() {
    const container = createElement('div', 'app-container');
    
    const header = createElement('header', 'ios-header');
    
    const backBtn = createElement('button', 'ios-back-btn', {
        onClick: () => Router.navigate('/home')
    });
    backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回';
    header.appendChild(backBtn);
    
    const title = createElement('h1', 'menu-title');
    title.textContent = 'Chat';
    header.appendChild(title);
    
    const actions = createElement('div', 'header-actions');
    
    const addBtn = createElement('button', 'header-action', {
        title: '新增對話'
    });
    addBtn.innerHTML = '<i class="fas fa-plus"></i>';
    addBtn.onclick = async () => {
        const newChat = await ChatsDB.create({ character_name: 'AI' });
        createToast('已建立新對話');
        Router.navigate('/chat/' + newChat.id);
    };
    actions.appendChild(addBtn);
    
    header.appendChild(actions);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-[83px]');
    
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
                    Router.navigate('/chat/' + newChat.id);
                }
            }
        );
        emptyState.classList.add('pt-24');
        main.appendChild(emptyState);
    } else {
        const list = createElement('section', 'flex flex-col');
        
        chats.forEach(chat => {
            const cell = createKakaoChatCell(chat, () => {
                Router.navigate('/chat/' + chat.id);
            });
            list.appendChild(cell);
        });
        
        main.appendChild(list);
    }
    
    container.appendChild(main);
    
    const nav = createKakaoBottomNav(CHATS_TABS, 1, (index, tab) => Router.navigate(tab.path));
    container.appendChild(nav);
    
    return { element: container, cleanup: null };
}

export default {
    id: 'chats',
    name: '聊天',
    icon: 'chat_bubble',
    routes: [
        { path: '/chats', render: renderChatsList }
    ],
    navItem: {
        label: 'Chats',
        icon: 'chat_bubble',
        path: '/chats',
        showInNav: true,
        order: 1
    },
    stylesPath: 'js/apps/chats/style.css'
};
