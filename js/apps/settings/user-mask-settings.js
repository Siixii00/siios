import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { UsersDB, CharactersDB } from '../../db.js';

async function renderUserList() {
    const users = await UsersDB.getAll();

    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: 'User 面具設定',
        backPath: '/settings',
        rightActions: [
            {
                icon: 'add',
                onClick: async () => {
                    const newUser = await UsersDB.create({ name: '新面具' });
                    createToast('已建立新面具');
                    Router.navigate('/settings/user/' + newUser.id);
                }
            }
        ]
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-8');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';

    if (users.length === 0) {
        const empty = createElement('div', 'flex flex-col items-center justify-center pt-24');
        empty.appendChild(createIcon('person', 'text-ios-muted text-5xl mb-4'));
        empty.appendChild(createElement('p', 'text-ios-muted', { textContent: '尚未建立任何面具' }));
        const addBtn = createElement('button', 'ios-btn ios-btn-primary mt-4', {
            textContent: '建立面具',
            onClick: async () => {
                const newUser = await UsersDB.create({ name: '新面具' });
                createToast('已建立新面具');
                Router.navigate('/settings/user/' + newUser.id);
            }
        });
        empty.appendChild(addBtn);
        main.appendChild(empty);
    } else {
        const group = createElement('div', 'ios-grouped-list mx-4');

        users.forEach(user => {
            const cell = createElement('div', 'ios-list-cell cursor-pointer', {
                onClick: () => Router.navigate('/settings/user/' + user.id)
            });

            if (user.avatar) {
                const avatarImg = createElement('img', 'w-10 h-10 rounded-full object-cover', {
                    src: user.avatar,
                    alt: user.name
                });
                cell.appendChild(avatarImg);
            } else {
                const avatarPlaceholder = createElement('div', 'w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center');
                avatarPlaceholder.appendChild(createIcon('person', 'text-blue-500 text-lg'));
                cell.appendChild(avatarPlaceholder);
            }

            const info = createElement('div', 'flex-1 ml-3 min-w-0');
            info.appendChild(createElement('span', 'text-body-lg font-medium', { textContent: user.name || '未命名' }));
            info.appendChild(createElement('span', 'block text-xs text-ios-muted font-mono truncate', { textContent: user.id }));
            if (user.nicknames && user.nicknames.length > 0) {
                info.appendChild(createElement('span', 'block text-sm text-ios-muted truncate', { textContent: user.nicknames.join(', ') }));
            } else if (user.personality) {
                info.appendChild(createElement('span', 'block text-sm text-ios-muted truncate', { textContent: user.personality }));
            }
            cell.appendChild(info);

            cell.appendChild(createIcon('chevron_right', 'text-ios-muted text-xl'));
            group.appendChild(cell);
        });

        main.appendChild(group);
    }

    container.appendChild(main);

    return { element: container, cleanup: null };
}

async function renderUserEdit(params) {
    const user = await UsersDB.getById(params.id);
    if (!user) {
        createToast('面具不存在');
        Router.navigate('/settings/user');
        return { element: createElement('div', ''), cleanup: null };
    }

    const allChars = await CharactersDB.getAll();

    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: user.name || '面具設定',
        backPath: '/settings/user'
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-8');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';

    const avatarSection = createElement('div', 'mb-2 ml-8');
    avatarSection.appendChild(createElement('p', 'ios-section-header', { textContent: '大頭貼' }));
    const avatarGroup = createElement('div', 'ios-grouped-list mx-4');
    const avatarCell = createElement('div', 'p-4 flex items-center gap-4');

    const avatarPreview = user.avatar
        ? createElement('img', 'w-16 h-16 rounded-full object-cover', { src: user.avatar, alt: user.name })
        : createElement('div', 'w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center');
    if (!user.avatar) avatarPreview.appendChild(createIcon('person', 'text-blue-500 text-3xl'));
    avatarCell.appendChild(avatarPreview);

    const avatarInput = createElement('input', 'ios-input flex-1', {
        type: 'url',
        placeholder: 'https://catbox.moe/...',
        value: user.avatar || ''
    });
    avatarCell.appendChild(avatarInput);
    avatarGroup.appendChild(avatarCell);
    main.appendChild(avatarSection);
    main.appendChild(avatarGroup);

    const nameSection = createElement('div', 'mb-2 ml-8 mt-4');
    nameSection.appendChild(createElement('p', 'ios-section-header', { textContent: '名稱' }));
    const nameGroup = createElement('div', 'ios-grouped-list mx-4');
    const nameCell = createElement('div', 'p-4');
    const nameInput = createElement('input', 'ios-input w-full', {
        type: 'text',
        placeholder: '面具名稱',
        value: user.name || ''
    });
    nameCell.appendChild(nameInput);
    nameGroup.appendChild(nameCell);
    main.appendChild(nameSection);
    main.appendChild(nameGroup);

    const idSection = createElement('div', 'mb-2 ml-8 mt-4');
    idSection.appendChild(createElement('p', 'ios-section-header', { textContent: '用戶 ID（Discord /bindme 綁定用）' }));
    const idGroup = createElement('div', 'ios-grouped-list mx-4');
    const idCell = createElement('div', 'p-4 flex items-center gap-3');
    const idText = createElement('span', 'flex-1 font-mono text-sm text-ios-muted break-all', { textContent: user.id });
    const copyBtn = createElement('button', 'ios-btn text-sm px-3 py-1', { textContent: '複製' });
    copyBtn.onclick = async () => {
        try {
            await navigator.clipboard.writeText(user.id);
            createToast('已複製用戶 ID');
        } catch (e) {
            createToast('複製失敗：' + e.message, 'error');
        }
    };
    idCell.appendChild(idText);
    idCell.appendChild(copyBtn);
    idGroup.appendChild(idCell);
    main.appendChild(idSection);
    main.appendChild(idGroup);

    const nickSection = createElement('div', 'mb-2 ml-8 mt-4');
    nickSection.appendChild(createElement('p', 'ios-section-header', { textContent: '暱稱' }));
    const nickGroup = createElement('div', 'ios-grouped-list mx-4');
    const nickCell = createElement('div', 'p-4');
    const nickInput = createElement('input', 'ios-input w-full', {
        type: 'text',
        placeholder: '用逗號分隔多個暱稱，例如：小明,明哥',
        value: (user.nicknames || []).join(', ')
    });
    nickCell.appendChild(nickInput);
    nickGroup.appendChild(nickCell);
    main.appendChild(nickSection);
    main.appendChild(nickGroup);

    const personalitySection = createElement('div', 'mb-2 ml-8 mt-4');
    personalitySection.appendChild(createElement('p', 'ios-section-header', { textContent: '個性描述' }));
    const personalityGroup = createElement('div', 'ios-grouped-list mx-4');
    const personalityCell = createElement('div', 'p-4');
    const personalityInput = createElement('textarea', 'ios-input w-full', {
        placeholder: '描述此面具的個性特質...',
        rows: '4'
    });
    personalityInput.value = user.personality || '';
    personalityCell.appendChild(personalityInput);
    personalityGroup.appendChild(personalityCell);
    main.appendChild(personalitySection);
    main.appendChild(personalityGroup);

    const mbtiSection = createElement('div', 'mb-2 ml-8 mt-4');
    mbtiSection.appendChild(createElement('p', 'ios-section-header', { textContent: 'MBTI' }));
    const mbtiGroup = createElement('div', 'ios-grouped-list mx-4');
    const mbtiCell = createElement('div', 'p-4');
    const mbtiInput = createElement('input', 'ios-input w-full', {
        type: 'text',
        placeholder: '例如：ENFP',
        value: user.mbti || ''
    });
    mbtiCell.appendChild(mbtiInput);
    mbtiGroup.appendChild(mbtiCell);
    main.appendChild(mbtiSection);
    main.appendChild(mbtiGroup);

    const styleSection = createElement('div', 'mb-2 ml-8 mt-4');
    styleSection.appendChild(createElement('p', 'ios-section-header', { textContent: '說話風格 / 對話舉例' }));
    const styleGroup = createElement('div', 'ios-grouped-list mx-4');
    const styleCell = createElement('div', 'p-4');
    const styleInput = createElement('textarea', 'ios-input w-full', {
        placeholder: '描述此面具的說話方式，或提供對話範例...',
        rows: '4'
    });
    styleInput.value = user.speech_style || '';
    styleCell.appendChild(styleInput);
    styleGroup.appendChild(styleCell);
    main.appendChild(styleSection);
    main.appendChild(styleGroup);

    const sleepSection = createElement('div', 'mb-2 ml-8 mt-4');
    sleepSection.appendChild(createElement('p', 'ios-section-header', { textContent: '睡眠時間（記憶重整）' }));
    const sleepGroup = createElement('div', 'ios-grouped-list mx-4');
    const sleepCell = createElement('div', 'p-4 flex gap-4');
    const sleepStart = createElement('div', 'flex-1');
    sleepStart.appendChild(createElement('label', 'text-sm text-ios-muted mb-1 block', { textContent: '入睡時間' }));
    const sleepStartInput = createElement('input', 'ios-input w-full', {
        type: 'time',
        value: user.sleep_start || '23:00'
    });
    sleepStart.appendChild(sleepStartInput);
    sleepCell.appendChild(sleepStart);
    const sleepEnd = createElement('div', 'flex-1');
    sleepEnd.appendChild(createElement('label', 'text-sm text-ios-muted mb-1 block', { textContent: '起床時間' }));
    const sleepEndInput = createElement('input', 'ios-input w-full', {
        type: 'time',
        value: user.sleep_end || '07:00'
    });
    sleepEnd.appendChild(sleepEndInput);
    sleepCell.appendChild(sleepEndInput);
    sleepGroup.appendChild(sleepCell);
    main.appendChild(sleepSection);
    main.appendChild(sleepGroup);

    const charSection = createElement('div', 'mb-2 ml-8 mt-4');
    charSection.appendChild(createElement('p', 'ios-section-header', { textContent: '對應的 Char' }));
    const charGroup = createElement('div', 'ios-grouped-list mx-4');
    const charCell = createElement('div', 'p-4');
    const charInput = createElement('input', 'ios-input w-full', {
        type: 'text',
        placeholder: '用逗號分隔多個 Char 名稱',
        value: (user.assigned_chars || []).join(', ')
    });
    charCell.appendChild(charInput);
    charGroup.appendChild(charCell);
    main.appendChild(charSection);
    main.appendChild(charGroup);

    const tabooSection = createElement('div', 'mb-2 ml-8 mt-4');
    tabooSection.appendChild(createElement('p', 'ios-section-header', { textContent: 'Char 禁忌 / 避免用詞' }));
    const tabooGroup = createElement('div', 'ios-grouped-list mx-4');
    const tabooCell = createElement('div', 'p-4');
    const tabooInput = createElement('textarea', 'ios-input w-full', {
        placeholder: '用逗號或換行列出需要避免的用詞或話題...',
        rows: '3'
    });
    tabooInput.value = (user.taboos || []).join(', ');
    tabooCell.appendChild(tabooInput);
    tabooGroup.appendChild(tabooCell);
    main.appendChild(tabooSection);
    main.appendChild(tabooGroup);

    const saveSection = createElement('div', 'mx-4 mt-6');
    const saveBtn = createElement('button', 'ios-btn ios-btn-primary w-full py-3', { textContent: '儲存面具設定' });
    saveBtn.onclick = async () => {
        const nicknames = nickInput.value.split(',').map(s => s.trim()).filter(Boolean);
        const assignedChars = charInput.value.split(',').map(s => s.trim()).filter(Boolean);
        const taboos = tabooInput.value.split(',').map(s => s.trim()).filter(Boolean);

        await UsersDB.update(params.id, {
            avatar: avatarInput.value.trim(),
            name: nameInput.value.trim() || '未命名',
            nicknames,
            personality: personalityInput.value.trim(),
            mbti: mbtiInput.value.trim().toUpperCase(),
            speech_style: styleInput.value.trim(),
            sleep_start: sleepStartInput.value,
            sleep_end: sleepEndInput.value,
            assigned_chars: assignedChars,
            taboos
        });
        createToast('面具設定已儲存');
        Router.navigate('/settings/user/' + params.id);
    };
    saveSection.appendChild(saveBtn);
    main.appendChild(saveSection);

    const deleteSection = createElement('div', 'mx-4 mt-4 mb-4');
    const deleteBtn = createElement('button', 'ios-btn w-full py-3 text-red-500', { textContent: '刪除此面具' });
    deleteBtn.onclick = async () => {
        if (confirm('確定要刪除「' + (user.name || '此面具') + '」？此操作無法復原。')) {
            await UsersDB.delete(params.id);
            createToast('已刪除面具');
            Router.navigate('/settings/user');
        }
    };
    deleteSection.appendChild(deleteBtn);
    main.appendChild(deleteSection);

    container.appendChild(main);

    return { element: container, cleanup: null };
}

export default {
    id: 'user-mask-settings',
    routes: [
        { path: '/settings/user', render: renderUserList },
        { path: '/settings/user/:id', render: renderUserEdit }
    ]
};
