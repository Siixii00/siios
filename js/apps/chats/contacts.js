import Router from '../../router.js';
import { createElement, createIcon, createKakaoBottomNav, createKakaoBottomSheet, createEmptyState, createToast } from '../../components.js';
import { CharactersDB, ChatsDB } from '../../db.js';
import { CHATS_TABS } from './chats-nav.js';

async function renderContacts() {
    const container = createElement('div', 'app-container');

    const header = createElement('header', 'sticky top-0 z-50 bg-white');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';

    const headerInner = createElement('div', 'flex justify-between items-center h-[86px] px-4');

    const title = createElement('h1', 'text-[32px] font-bold text-black leading-[31px]');
    title.textContent = '建立聯絡';
    headerInner.appendChild(title);

    const actions = createElement('div', 'flex items-center gap-4');

    const addBtn = createElement('button', 'p-2 rounded-full active:bg-gray-100 transition-colors');
    addBtn.appendChild(createIcon('person_add', 'text-black text-[25px]'));
    addBtn.onclick = () => openCreateSheet();
    actions.appendChild(addBtn);

    headerInner.appendChild(actions);
    header.appendChild(headerInner);
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-[83px]');

    const characters = await CharactersDB.getAll();

    if (characters.length === 0) {
        const emptyState = createEmptyState(
            'person_add',
            '沒有聯絡人',
            '點擊右上角按鈕建立新的角色聯絡',
            {
                label: '建立聯絡',
                onClick: () => openCreateSheet()
            }
        );
        emptyState.classList.add('pt-24');
        main.appendChild(emptyState);
    } else {
        const allChats = await ChatsDB.getAll();
        const list = createElement('section', 'flex flex-col');

        characters.forEach(char => {
            const cell = createElement('div', 'kakao-chat-cell');
            cell.onclick = async () => {
                const existing = allChats.find(c => c.character_name === char.name);
                if (existing) {
                    Router.navigate('/chat/' + existing.id);
                    return;
                }
                const newChat = await ChatsDB.create({
                    character_name: char.name,
                    character_avatar: char.avatar || ''
                });
                createToast('已開始與 ' + char.name + ' 的對話');
                Router.navigate('/chat/' + newChat.id);
            };

            const avatarMargin = createElement('div', 'kakao-avatar-margin');
            const avatarContainer = createElement('div', 'relative');
            const avatar = createElement('img', 'kakao-avatar', {
                src: char.avatar || 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23E5E5EA"/><text x="50" y="60" text-anchor="middle" font-size="40" fill="%238E8E93">?</text></svg>',
                alt: char.name
            });
            avatarContainer.appendChild(avatar);
            avatarMargin.appendChild(avatarContainer);
            cell.appendChild(avatarMargin);

            const content = createElement('div', 'kakao-chat-cell-content');
            const topRow = createElement('div', 'kakao-chat-cell-top');
            topRow.appendChild(createElement('span', 'kakao-chat-cell-name', { textContent: char.name }));
            content.appendChild(topRow);

            const bottomRow = createElement('div', 'kakao-chat-cell-bottom');
            bottomRow.appendChild(createElement('span', 'kakao-chat-cell-msg', { textContent: char.description || '點擊開始對話' }));
            content.appendChild(bottomRow);

            cell.appendChild(content);
            list.appendChild(cell);
        });

        main.appendChild(list);
    }

    container.appendChild(main);

    const nav = createKakaoBottomNav(CHATS_TABS, 0, (index, tab) => Router.navigate(tab.path));
    container.appendChild(nav);

    return { element: container, cleanup: null };
}

function openCreateSheet() {
    const nameInput = createElement('input', 'kakao-chat-textarea w-full', {
        type: 'text',
        placeholder: '角色名稱'
    });
    nameInput.style.borderRadius = '12px';
    nameInput.style.height = '44px';
    nameInput.style.padding = '0 12px';

    const descInput = createElement('textarea', 'kakao-chat-textarea w-full', {
        placeholder: '角色描述（選填）',
        rows: '3'
    });
    descInput.style.borderRadius = '12px';
    descInput.style.height = '80px';

    const form = createElement('div', 'p-4 flex flex-col gap-4');
    form.appendChild(nameInput);
    form.appendChild(descInput);

    const sheet = createKakaoBottomSheet([], {
        title: '建立新聯絡',
        customContent: form
    });

    const submitBtn = createElement('button', 'kakao-send-btn w-full', {
        textContent: '建立聯絡',
        onClick: async () => {
            const name = nameInput.value.trim();
            if (!name) {
                createToast('請輸入角色名稱');
                return;
            }
            await CharactersDB.create({
                name,
                description: descInput.value.trim()
            });
            createToast('已建立聯絡：' + name);
            sheet.close();
            Router.navigate('/chats/contacts');
        }
    });
    submitBtn.style.height = '44px';
    submitBtn.style.borderRadius = '12px';
    form.appendChild(submitBtn);

    sheet.open();
}

export default {
    id: 'chats-contacts',
    routes: [
        { path: '/chats/contacts', render: renderContacts }
    ]
};
