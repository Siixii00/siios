import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { CharactersDB, SettingsDB, UsersDB } from '../../db.js';

async function renderCharList() {
    const characters = await CharactersDB.getAll();

    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: 'Char 設定',
        backPath: '/settings',
        rightActions: [
            {
                icon: 'add',
                onClick: async () => {
                    const newChar = await CharactersDB.create({ name: '新角色' });
                    createToast('已建立新角色');
                    Router.navigate('/settings/char/' + newChar.id);
                }
            }
        ]
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-8');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';

    if (characters.length === 0) {
        const empty = createElement('div', 'flex flex-col items-center justify-center pt-24');
        empty.appendChild(createIcon('smart_toy', 'text-ios-muted text-5xl mb-4'));
        empty.appendChild(createElement('p', 'text-ios-muted', { textContent: '尚未建立任何角色' }));
        const addBtn = createElement('button', 'ios-btn ios-btn-primary mt-4', {
            textContent: '建立角色',
            onClick: async () => {
                const newChar = await CharactersDB.create({ name: '新角色' });
                createToast('已建立新角色');
                Router.navigate('/settings/char/' + newChar.id);
            }
        });
        empty.appendChild(addBtn);
        main.appendChild(empty);
    } else {
        const group = createElement('div', 'ios-grouped-list mx-4');

        characters.forEach(char => {
            const cell = createElement('div', 'ios-list-cell cursor-pointer', {
                onClick: () => Router.navigate('/settings/char/' + char.id)
            });

            if (char.avatar) {
                const avatarImg = createElement('img', 'w-10 h-10 rounded-full object-cover', {
                    src: char.avatar,
                    alt: char.name
                });
                cell.appendChild(avatarImg);
            } else {
                const avatarPlaceholder = createElement('div', 'w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center');
                avatarPlaceholder.appendChild(createIcon('smart_toy', 'text-purple-500 text-lg'));
                cell.appendChild(avatarPlaceholder);
            }

            const info = createElement('div', 'flex-1 ml-3 min-w-0');
            info.appendChild(createElement('span', 'text-body-lg font-medium', { textContent: char.name || '未命名' }));
            if (char.nicknames && char.nicknames.length > 0) {
                info.appendChild(createElement('span', 'block text-sm text-ios-muted truncate', { textContent: char.nicknames.join(', ') }));
            } else if (char.description) {
                info.appendChild(createElement('span', 'block text-sm text-ios-muted truncate', { textContent: char.description }));
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

async function renderCharEdit(params) {
    const char = await CharactersDB.getById(params.id);
    if (!char) {
        createToast('角色不存在');
        Router.navigate('/settings/char');
        return { element: createElement('div', ''), cleanup: null };
    }

    const allChars = await CharactersDB.getAll();
    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: char.name || '角色設定',
        backPath: '/settings/char'
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-8');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';

    const avatarSection = createElement('div', 'mb-2 ml-8');
    avatarSection.appendChild(createElement('p', 'ios-section-header', { textContent: '大頭貼' }));
    const avatarGroup = createElement('div', 'ios-grouped-list mx-4');
    const avatarCell = createElement('div', 'p-4 flex items-center gap-4');

    const avatarPreview = char.avatar
        ? createElement('img', 'w-16 h-16 rounded-full object-cover', { src: char.avatar, alt: char.name })
        : createElement('div', 'w-16 h-16 rounded-full bg-purple-100 flex items-center justify-center');
    if (!char.avatar) avatarPreview.appendChild(createIcon('smart_toy', 'text-purple-500 text-3xl'));
    avatarCell.appendChild(avatarPreview);

    const avatarInput = createElement('input', 'ios-input flex-1', {
        type: 'url',
        placeholder: 'https://catbox.moe/...',
        value: char.avatar || ''
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
        placeholder: '角色名稱',
        value: char.name || ''
    });
    nameCell.appendChild(nameInput);
    nameGroup.appendChild(nameCell);
    main.appendChild(nameSection);
    main.appendChild(nameGroup);

    const nickSection = createElement('div', 'mb-2 ml-8 mt-4');
    nickSection.appendChild(createElement('p', 'ios-section-header', { textContent: '暱稱' }));
    const nickGroup = createElement('div', 'ios-grouped-list mx-4');
    const nickCell = createElement('div', 'p-4');
    const nickInput = createElement('input', 'ios-input w-full', {
        type: 'text',
        placeholder: '用逗號分隔多個暱稱，例如：小紫,紫紫',
        value: (char.nicknames || []).join(', ')
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
        placeholder: '描述角色的個性特質...',
        rows: '4'
    });
    personalityInput.value = char.personality || '';
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
        placeholder: '例如：INFP',
        value: char.mbti || ''
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
        placeholder: '描述角色的說話方式，或提供對話範例...',
        rows: '4'
    });
    styleInput.value = char.speech_style || '';
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
        value: char.sleep_start || '23:00'
    });
    sleepStart.appendChild(sleepStartInput);
    sleepCell.appendChild(sleepStart);
    const sleepEnd = createElement('div', 'flex-1');
    sleepEnd.appendChild(createElement('label', 'text-sm text-ios-muted mb-1 block', { textContent: '起床時間' }));
    const sleepEndInput = createElement('input', 'ios-input w-full', {
        type: 'time',
        value: char.sleep_end || '07:00'
    });
    sleepEnd.appendChild(sleepEndInput);
    sleepCell.appendChild(sleepEndInput);
    sleepGroup.appendChild(sleepCell);
    main.appendChild(sleepSection);
    main.appendChild(sleepGroup);

    const birthSection = createElement('div', 'mb-2 ml-8 mt-4');
    birthSection.appendChild(createElement('p', 'ios-section-header', { textContent: '出生資訊（紫微斗數分析）' }));
    const birthGroup = createElement('div', 'ios-grouped-list mx-4');

    const birthDateCell = createElement('div', 'p-4 flex gap-4');
    const birthDateField = createElement('div', 'flex-1');
    birthDateField.appendChild(createElement('label', 'text-sm text-ios-muted mb-1 block', { textContent: '出生日期' }));
    const birthDateInput = createElement('input', 'ios-input w-full', {
        type: 'date',
        value: char.birth_date || ''
    });
    birthDateField.appendChild(birthDateInput);
    birthDateCell.appendChild(birthDateField);

    const birthTimeField = createElement('div', 'flex-1');
    birthTimeField.appendChild(createElement('label', 'text-sm text-ios-muted mb-1 block', { textContent: '出生時間' }));
    const birthTimeInput = createElement('input', 'ios-input w-full', {
        type: 'time',
        value: char.birth_time || ''
    });
    birthTimeField.appendChild(birthTimeInput);
    birthDateCell.appendChild(birthTimeField);
    birthGroup.appendChild(birthDateCell);

    const birthLocationCell = createElement('div', 'p-4');
    birthLocationCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-1 block', { textContent: '出生地點' }));
    const birthLocationInput = createElement('input', 'ios-input w-full', {
        type: 'text',
        placeholder: '例如：台北市',
        value: char.birth_location || ''
    });
    birthLocationCell.appendChild(birthLocationInput);
    birthGroup.appendChild(birthLocationCell);

    const genderCell = createElement('div', 'p-4 flex gap-4');
    const genderField = createElement('div', 'flex-1');
    genderField.appendChild(createElement('label', 'text-sm text-ios-muted mb-1 block', { textContent: '性別' }));
    const genderSelect = createElement('select', 'ios-input w-full');
    genderSelect.innerHTML = `
        <option value=''>未設定</option>
        <option value='male'>男</option>
        <option value='female'>女</option>
    `;
    genderSelect.value = char.gender || '';
    genderField.appendChild(genderSelect);
    genderCell.appendChild(genderField);

    const calendarField = createElement('div', 'flex-1');
    calendarField.appendChild(createElement('label', 'text-sm text-ios-muted mb-1 block', { textContent: '曆法' }));
    const calendarSelect = createElement('select', 'ios-input w-full');
    calendarSelect.innerHTML = `
        <option value='solar'>國曆</option>
        <option value='lunar'>農曆</option>
    `;
    calendarSelect.value = char.birth_calendar_type || 'solar';
    calendarField.appendChild(calendarSelect);
    genderCell.appendChild(calendarField);
    birthGroup.appendChild(genderCell);

    main.appendChild(birthSection);
    main.appendChild(birthGroup);

    const users = await UsersDB.getAll();
    
    const userSection = createElement('div', 'mb-2 ml-8 mt-4');
    userSection.appendChild(createElement('p', 'ios-section-header', { textContent: '綁定 User 面具' }));
    const userGroup = createElement('div', 'ios-grouped-list mx-4');
    const userCell = createElement('div', 'p-4');
    const userSelect = createElement('select', 'ios-input w-full');
    const defaultOption = createElement('option', '', {
        value: '',
        textContent: '不綁定（使用預設身份）'
    });
    if (!char.bound_user_id) defaultOption.selected = true;
    userSelect.appendChild(defaultOption);
    users.forEach(user => {
        const option = createElement('option', '', {
            value: user.id,
            textContent: user.name || '未命名'
        });
        if (char.bound_user_id === user.id) option.selected = true;
        userSelect.appendChild(option);
    });
    userCell.appendChild(userSelect);
    userGroup.appendChild(userCell);
    main.appendChild(userSection);
    main.appendChild(userGroup);


    const saveSection = createElement('div', 'mx-4 mt-6');
    const saveBtn = createElement('button', 'ios-btn ios-btn-primary w-full py-3', { textContent: '儲存角色設定' });
    saveBtn.onclick = async () => {
        const nicknames = nickInput.value.split(',').map(s => s.trim()).filter(Boolean);
        const boundUserId = userSelect.value || null;

        await CharactersDB.update(params.id, {
            avatar: avatarInput.value.trim(),
            name: nameInput.value.trim() || '未命名',
            nicknames,
            personality: personalityInput.value.trim(),
            mbti: mbtiInput.value.trim().toUpperCase(),
            speech_style: styleInput.value.trim(),
            sleep_start: sleepStartInput.value,
            sleep_end: sleepEndInput.value,
            bound_user_id: boundUserId,
            birth_date: birthDateInput.value || null,
            birth_time: birthTimeInput.value || null,
            birth_location: birthLocationInput.value.trim() || null,
            birth_calendar_type: calendarSelect.value,
            gender: genderSelect.value || null
        });
        createToast('角色設定已儲存');
        Router.navigate('/settings/char/' + params.id);
    };
    saveSection.appendChild(saveBtn);
    main.appendChild(saveSection);

    const deleteSection = createElement('div', 'mx-4 mt-4 mb-4');
    const deleteBtn = createElement('button', 'ios-btn w-full py-3 text-red-500', { textContent: '刪除此角色' });
    deleteBtn.onclick = async () => {
        if (confirm('確定要刪除「' + (char.name || '此角色') + '」？此操作無法復原。')) {
            await CharactersDB.delete(params.id);
            createToast('已刪除角色');
            Router.navigate('/settings/char');
        }
    };
    deleteSection.appendChild(deleteBtn);
    main.appendChild(deleteSection);

    container.appendChild(main);

    return { element: container, cleanup: null };
}

export default {
    id: 'char-settings',
    routes: [
        { path: '/settings/char', render: renderCharList },
        { path: '/settings/char/:id', render: renderCharEdit }
    ]
};
