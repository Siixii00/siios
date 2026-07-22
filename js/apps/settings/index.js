import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { SettingsDB, ChatsDB, WorldInfoDB, CharactersDB } from '../../db.js';

async function renderSettings() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createIOSNavBar({
        title: '設定',
        largeTitle: true
    });
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-2 pb-24');
    
    const profileSection = createElement('div', 'ios-grouped-list mx-4');
    const profileCard = createElement('div', 'flex items-center p-4 bg-white rounded-xl shadow-sm');
    
    const avatar = createElement('div', 'w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center');
    avatar.appendChild(createIcon('account_circle', 'text-white text-3xl'));
    profileCard.appendChild(avatar);
    
    const profileInfo = createElement('div', 'flex-1 ml-4');
    profileInfo.appendChild(createElement('h2', 'font-semibold', { textContent: '使用者' }));
    profileInfo.appendChild(createElement('p', 'text-sm text-ios-muted', { textContent: '管理您的設定與同步' }));
    profileCard.appendChild(profileInfo);
    
    profileCard.appendChild(createIcon('chevron_right', 'text-ios-muted'));
    profileSection.appendChild(profileCard);
    
    main.appendChild(profileSection);
    
    const aiSection = createElement('div', 'mt-8 ml-8');
    aiSection.appendChild(createElement('p', 'ios-section-header', { textContent: '智慧功能' }));
    
    const aiGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const apiCell = createListCell('smart_toy', 'API 設定', null, 'kakao-brown', true);
    apiCell.onclick = () => Router.navigate('/api-config');
    aiGroup.appendChild(apiCell);
    
    main.appendChild(aiSection);
    main.appendChild(aiGroup);
    
    const aboutSection = createElement('div', 'mt-8 ml-8');
    aboutSection.appendChild(createElement('p', 'ios-section-header', { textContent: '關於' }));
    
    const aboutGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const versionCell = createListCell(null, '版本', '1.0.0');
    aboutGroup.appendChild(versionCell);
    
    main.appendChild(aboutSection);
    main.appendChild(aboutGroup);
    
    const footer = createElement('div', 'text-center py-6 text-sm text-ios-muted');
    footer.appendChild(createElement('p', '', { textContent: '2024 SXIOS' }));
    main.appendChild(footer);
    
    container.appendChild(main);
    
    const nav = createElement('div', 'ios-bottom-nav safe-area-bottom');
    
    const chatsTab = createElement('a', 'ios-bottom-nav-item', {
        href: '/#/chats',
        onClick: (e) => {
            e.preventDefault();
            Router.navigate('/chats');
        }
    });
    chatsTab.appendChild(createIcon('chat_bubble'));
    chatsTab.appendChild(createElement('span', 'label', { textContent: 'Chats' }));
    nav.appendChild(chatsTab);
    
    const worldInfoTab = createElement('a', 'ios-bottom-nav-item', {
        href: '/#/world-info',
        onClick: (e) => {
            e.preventDefault();
            Router.navigate('/world-info');
        }
    });
    worldInfoTab.appendChild(createIcon('menu_book'));
    worldInfoTab.appendChild(createElement('span', 'label', { textContent: 'World Info' }));
    nav.appendChild(worldInfoTab);
    
    const settingsTab = createElement('a', 'ios-bottom-nav-item active');
    settingsTab.appendChild(createIcon('settings', '', true));
    settingsTab.appendChild(createElement('span', 'label', { textContent: 'Settings' }));
    nav.appendChild(settingsTab);
    
    container.appendChild(nav);
    
    return { element: container, cleanup: null };
}

function createListCell(icon, label, value, iconBg, chevron) {
    const cell = createElement('div', 'ios-list-cell');
    
    if (icon) {
        const badge = createElement('div', 'ios-icon-badge bg-' + iconBg);
        badge.appendChild(createIcon(icon, 'text-white text-sm'));
        cell.appendChild(badge);
    }
    
    cell.appendChild(createElement('span', 'flex-1', { textContent: label }));
    
    if (value) {
        cell.appendChild(createElement('span', 'text-ios-muted', { textContent: value }));
    }
    
    if (chevron) {
        cell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
    }
    
    return cell;
}

export default {
    id: 'settings',
    name: '設定',
    icon: 'settings',
    routes: [
        { path: '/settings', render: renderSettings }
    ],
    navItem: {
        label: 'Settings',
        icon: 'settings',
        path: '/settings',
        showInNav: true,
        order: 3
    },
    styles: () => import('./style.css')
};