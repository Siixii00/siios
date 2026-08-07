import Router from '../../router.js';
import { createElement, createIcon, createToast, createKakaoBottomSheet } from '../../components.js';
import { DiscordUserBindingDB, UsersDB } from '../../db.js';

async function renderDiscordUserBinding() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-header');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    
    const backBtn = createElement('button', 'ios-back-btn', {
        onClick: () => Router.navigate('/settings/discord')
    });
    backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回';
    header.appendChild(backBtn);
    
    const title = createElement('h1', 'menu-title');
    title.textContent = 'Discord 用戶綁定';
    header.appendChild(title);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar');
    main.style.paddingTop = 'calc(env(safe-area-inset-top, 44px) + 44px + 16px)';
    
    // 說明卡片
    const introCard = createElement('div', 'mx-4 mb-4 p-4 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-xl text-white');
    introCard.innerHTML = `
        <div class="flex items-center gap-2 mb-2">
            <span class="material-symbols-outlined">link</span>
            <h2 class="text-lg font-bold">用戶身份綁定</h2>
        </div>
        <p class="text-sm opacity-90 mb-3">綁定 Discord 帳號後，AI 角色可以識別你的身份，提供個性化的對話體驗</p>
        <div class="text-xs opacity-80">
            <div class="mb-1">✓ 跨平台身份一致</div>
            <div class="mb-1">✓ 個性化對話體驗</div>
            <div>✓ 多機器人環境正確識別</div>
        </div>
    `;
    main.appendChild(introCard);
    
    // 添加綁定按鈕
    const addBtn = createElement('button', 'ios-btn ios-btn-primary w-full mb-4 mx-4');
    addBtn.style.maxWidth = 'calc(100% - 32px)';
    addBtn.innerHTML = '<span class="material-symbols-outlined mr-2">person_add</span> 新增綁定';
    addBtn.onclick = () => showAddBindingDialog();
    main.appendChild(addBtn);
    
    // 綁定列表
    const bindings = await DiscordUserBindingDB.getAll();
    
    if (bindings.length === 0) {
        const emptyState = createElement('div', 'text-center py-12 px-4');
        emptyState.innerHTML = `
            <span class="material-symbols-outlined text-6xl text-gray-300 mb-4 block">link_off</span>
            <p class="text-gray-500 text-sm">尚未綁定任何 Discord 用戶</p>
            <p class="text-gray-400 text-xs mt-2">點擊上方按鈕開始綁定</p>
        `;
        main.appendChild(emptyState);
    } else {
        const listContainer = createElement('div', 'mx-4 space-y-3');
        
        bindings.forEach(binding => {
            const card = createElement('div', 'bg-white rounded-xl p-4 shadow-sm');
            
            const header = createElement('div', 'flex items-center justify-between mb-3');
            const userInfo = createElement('div', 'flex items-center gap-3');
            
            const avatar = createElement('div', 'w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center');
            avatar.innerHTML = '<span class="material-symbols-outlined text-blue-600">discord</span>';
            userInfo.appendChild(avatar);
            
            const names = createElement('div');
            names.appendChild(createElement('div', 'font-semibold', { textContent: binding.discord_username }));
            names.appendChild(createElement('div', 'text-sm text-gray-500', { textContent: `PWA: ${binding.user_display_name || '未設定'}` }));
            userInfo.appendChild(names);
            
            header.appendChild(userInfo);
            
            const deleteBtn = createElement('button', 'text-red-500 text-sm');
            deleteBtn.textContent = '解除';
            deleteBtn.onclick = async () => {
                if (confirm('確定要解除綁定嗎？')) {
                    await DiscordUserBindingDB.delete(binding.discord_user_id);
                    createToast('已解除綁定');
                    Router.navigate('/settings/discord/bindings');
                }
            };
            header.appendChild(deleteBtn);
            
            card.appendChild(header);
            
            const details = createElement('div', 'text-xs text-gray-500 space-y-1');
            details.innerHTML = `
                <div>Discord ID: ${binding.discord_user_id}</div>
                <div>PWA User ID: ${binding.user_id}</div>
                ${binding.character_id ? `<div>綁定角色: ${binding.character_id}</div>` : ''}
            `;
            card.appendChild(details);
            
            listContainer.appendChild(card);
        });
        
        main.appendChild(listContainer);
    }
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

async function showAddBindingDialog() {
    const users = await UsersDB.getAll();
    
    const form = createElement('div', 'p-4 space-y-4');
    
    const discordIdInput = createElement('input', 'w-full p-3 border rounded-lg text-sm');
    discordIdInput.type = 'text';
    discordIdInput.placeholder = 'Discord User ID (數字)';
    form.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-2', { textContent: 'Discord User ID' }));
    form.appendChild(discordIdInput);
    
    const discordNameInput = createElement('input', 'w-full p-3 border rounded-lg text-sm');
    discordNameInput.type = 'text';
    discordNameInput.placeholder = 'Discord 用戶名';
    form.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-2 mt-4', { textContent: 'Discord 用戶名' }));
    form.appendChild(discordNameInput);
    
    const userSelect = createElement('select', 'w-full p-3 border rounded-lg text-sm');
    users.forEach(user => {
        const option = createElement('option');
        option.value = user.id;
        option.textContent = user.display_name || user.id;
        userSelect.appendChild(option);
    });
    form.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-2 mt-4', { textContent: '對應的 PWA 用戶' }));
    form.appendChild(userSelect);
    
    const displayNameInput = createElement('input', 'w-full p-3 border rounded-lg text-sm');
    displayNameInput.type = 'text';
    displayNameInput.placeholder = '顯示名稱（選填）';
    form.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-2 mt-4', { textContent: '顯示名稱' }));
    form.appendChild(displayNameInput);
    
    const submitBtn = createElement('button', 'ios-btn ios-btn-primary w-full mt-4');
    submitBtn.textContent = '確認綁定';
    submitBtn.onclick = async () => {
        try {
            await DiscordUserBindingDB.create({
                discord_user_id: discordIdInput.value,
                discord_username: discordNameInput.value,
                user_id: userSelect.value,
                user_display_name: displayNameInput.value || discordNameInput.value
            });
            createToast('綁定成功');
            sheet.close();
            Router.navigate('/settings/discord/bindings');
        } catch (error) {
            createToast('綁定失敗：' + error.message, 'error');
        }
    };
    form.appendChild(submitBtn);
    
    const sheet = createKakaoBottomSheet([], {
        title: '新增 Discord 用戶綁定',
        customContent: form
    });
    
    sheet.open();
}

export default {
    id: 'discord-user-binding',
    name: 'Discord 用戶綁定',
    icon: 'link',
    routes: [
        { path: '/settings/discord/bindings', render: renderDiscordUserBinding }
    ],
    navItem: null
};