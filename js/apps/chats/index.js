import Router from '../../router.js';
import { createElement, createIcon, createKakaoBottomNav, createKakaoChatCell, createEmptyState, createToast, createKakaoBottomSheet } from '../../components.js';
import { ChatsDB, CharactersDB } from '../../db.js';
import { CHATS_TABS } from './chats-nav.js';

let chats = [];
let selectedGroupMemberIds = [];

async function renderChatsList() {
    const container = createElement('div', 'app-container');
    
    const header = createElement('header', 'ios-header');
    
    const backBtn = createElement('button', 'ios-back-btn', {
        onClick: () => Router.navigate('/home')
    });
    backBtn.innerHTML = '<i class='fas fa-chevron-left'></i> 返回';
    header.appendChild(backBtn);
    
    const title = createElement('h1', 'menu-title');
    title.textContent = 'Chat';
    header.appendChild(title);
    
    const actions = createElement('div', 'header-actions');
    
    const addBtn = createElement('button', 'header-action', {
        title: '新增對話'
    });
    addBtn.innerHTML = '<i class='fas fa-plus'></i>';
    addBtn.onclick = async () => {
        const newChat = await ChatsDB.create({ character_name: 'AI' });
        createToast('已建立新對話');
        Router.navigate('/chat/' + newChat.id);
    };
    actions.appendChild(addBtn);
    
    const groupBtn = createElement('button', 'header-action', {
        title: '新增群組'
    });
    groupBtn.innerHTML = '<i class='fas fa-users'></i>';
    groupBtn.onclick = () => openGroupSheet();
    actions.appendChild(groupBtn);
    
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

async function openGroupSheet() {
    const characters = await CharactersDB.getAll();
    selectedGroupMemberIds = [];
    
    const form = createElement('div', 'p-4 flex flex-col gap-3');
    
    const hint = createElement('div', 'text-sm text-gray-500 mb-2');
    hint.textContent = '選擇 2-4 個角色加入群組';
    form.appendChild(hint);
    
    const list = createElement('div', 'flex flex-col gap-2');
    
    characters.forEach(char => {
        const row = createElement('div', 'flex items-center gap-3 p-3 rounded-lg bg-gray-50 cursor-pointer group-member-row');
        row.dataset.charId = char.id;
        
        const avatar = createElement('img', 'w-10 h-10 rounded-full object-cover', {
            src: char.avatar || 'data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><circle cx='50' cy='50' r='50' fill='%23E5E5EA'/><text x='50' y='60' text-anchor='middle' font-size='40' fill='%238E8E93'>?</text></svg>',
            alt: char.name
        });
        row.appendChild(avatar);
        
        const name = createElement('span', 'flex-1 text-body-lg');
        name.textContent = char.name;
        row.appendChild(name);
        
        const checkbox = createElement('div', 'w-5 h-5 rounded border-2 border-gray-300 flex items-center justify-center group-checkbox');
        row.appendChild(checkbox);
        
        row.onclick = () => {
            const idx = selectedGroupMemberIds.indexOf(char.id);
            if (idx >= 0) {
                selectedGroupMemberIds.splice(idx, 1);
                checkbox.classList.remove('bg-kakao-brown', 'border-kakao-brown');
                checkbox.classList.add('border-gray-300');
                checkbox.innerHTML = '';
            } else {
                if (selectedGroupMemberIds.length >= 4) {
                    createToast('最多選擇 4 個角色');
                    return;
                }
                selectedGroupMemberIds.push(char.id);
                checkbox.classList.remove('border-gray-300');
                checkbox.classList.add('bg-kakao-brown', 'border-kakao-brown');
                checkbox.innerHTML = '<svg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='4'><path d='M20 6L9 17l-5-5'/></svg>';
            }
        };
        
        list.appendChild(row);
    });
    
    form.appendChild(list);
    
    const submitBtn = createElement('button', 'kakao-send-btn w-full', {
        textContent: '建立群組',
        onClick: async () => {
            if (selectedGroupMemberIds.length < 2) {
                createToast('請至少選擇 2 個角色');
                return;
            }
            const primaryCharId = selectedGroupMemberIds[0];
            const primaryChar = await CharactersDB.getById(primaryCharId);
            const groupChat = await ChatsDB.create({
                is_group: true,
                member_ids: [...selectedGroupMemberIds],
                character_id: primaryCharId,
                character_name: '群組聊天',
                character_avatar: '',
                bound_user_id: primaryChar?.bound_user_id || null
            });
            createToast('已建立群組');
            sheet.close();
            Router.navigate('/chat/' + groupChat.id);
        }
    });
    submitBtn.style.height = '44px';
    submitBtn.style.borderRadius = '12px';
    form.appendChild(submitBtn);
    
    const sheet = createKakaoBottomSheet([], {
        title: '建立群組聊天',
        customContent: form
    });
    
    sheet.open();
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
