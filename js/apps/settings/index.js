import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar } from '../../components.js';
import { SettingsDB } from '../../db.js';

async function renderSettings() {
    const githubUser = await SettingsDB.get('github_user') || null;
    const displayName = githubUser ? (githubUser.name || githubUser.login) : '使用者';
    const avatarSrc = githubUser ? githubUser.avatar_url : null;

    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: '設定',
        largeTitle: true
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-2 pb-8');

    const profileSection = createElement('div', 'ios-grouped-list mx-4');
    const profileCard = createElement('div', 'flex items-center p-4 bg-white rounded-xl shadow-sm cursor-pointer', {
        onClick: () => Router.navigate('/settings/github')
    });

    let avatar;
    if (avatarSrc) {
        avatar = createElement('img', 'w-14 h-14 rounded-full object-cover', {
            src: avatarSrc,
            alt: displayName
        });
    } else {
        avatar = createElement('div', 'w-14 h-14 rounded-full bg-gray-800 flex items-center justify-center');
        avatar.appendChild(createIcon('account_circle', 'text-white text-3xl'));
    }
    profileCard.appendChild(avatar);

    const profileInfo = createElement('div', 'flex-1 ml-4');
    profileInfo.appendChild(createElement('h2', 'font-semibold', { textContent: displayName }));
    profileInfo.appendChild(createElement('p', 'text-sm text-ios-muted', { textContent: '管理您的設定與同步' }));
    profileCard.appendChild(profileInfo);

    profileCard.appendChild(createIcon('chevron_right', 'text-ios-muted'));
    profileSection.appendChild(profileCard);

    main.appendChild(profileSection);

    const cards = [
        {
            icon: 'smart_toy',
            iconBg: 'bg-purple-500',
            title: 'Char 設定',
            desc: '管理角色的人格、外貌與行為設定',
            path: '/settings/char'
        },
        {
            icon: 'person',
            iconBg: 'bg-blue-500',
            title: 'User 面具設定',
            desc: '管理使用者面具與身份設定',
            path: '/settings/user'
        },
        {
            icon: 'api',
            iconBg: 'bg-orange-500',
            title: '聊天 API 串接設定',
            desc: '設定 API 端點、金鑰與模型參數',
            path: '/api-config'
        },
        {
            icon: 'extension',
            iconBg: 'bg-green-500',
            title: 'MCP 工具整合',
            desc: '連接外部工具，讓角色執行實際動作',
            path: '/settings/mcp'
        },
        {
            icon: 'discord',
            iconBg: 'bg-indigo-600',
            title: 'Discord 整合',
            desc: '讓 AI 角色在 Discord 上即時對話',
            path: '/settings/discord'
        },
        {
            icon: 'sync',
            iconBg: 'bg-indigo-500',
            title: '活動同步',
            desc: '記錄手機活動，讓 AI 了解你的日常',
            path: '/activity'
        },
        {
            icon: 'backup',
            iconBg: 'bg-gradient-to-r from-blue-500 to-purple-600',
            title: '資料備份與還原',
            desc: '本地 + GitHub + Google Drive 三重備份',
            path: '/settings/backup'
        }
    ];

    const group = createElement('div', 'ios-grouped-list mx-4');

    cards.forEach(card => {
        const cell = createElement('div', 'ios-list-cell cursor-pointer', {
            onClick: () => Router.navigate(card.path)
        });

        const badge = createElement('div', `ios-icon-badge ${card.iconBg}`);
        badge.appendChild(createIcon(card.icon, 'text-white text-sm'));
        cell.appendChild(badge);

        const content = createElement('div', 'flex-1 min-w-0');
        content.appendChild(createElement('span', 'text-body-lg font-medium', { textContent: card.title }));
        content.appendChild(createElement('span', 'block text-sm text-ios-muted truncate', { textContent: card.desc }));
        cell.appendChild(content);

        cell.appendChild(createIcon('chevron_right', 'text-ios-muted text-xl'));

        group.appendChild(cell);
    });

    main.appendChild(group);

    const devSection = createElement('div', 'ios-grouped-list mx-4 mt-6');
    const devCell = createElement('div', 'ios-list-cell cursor-pointer');
    const devBadge = createElement('div', 'ios-icon-badge bg-gray-700');
    devBadge.appendChild(createIcon('code', 'text-white text-sm'));
    devCell.appendChild(devBadge);
    devCell.appendChild(createElement('span', 'flex-1', { textContent: '開發者資訊' }));
    const devArrow = createIcon('expand_more', 'text-ios-muted text-xl transition-transform duration-200');
    devCell.appendChild(devArrow);
    devSection.appendChild(devCell);

    const devPanel = createElement('div', 'overflow-hidden transition-all duration-200');
    devPanel.style.maxHeight = '0';
    devPanel.style.opacity = '0';
    const devContent = createElement('div', 'p-4 text-sm text-ios-muted space-y-2');
    devContent.appendChild(createElement('p', '', { textContent: '版本：v1.0.0' }));
    devContent.appendChild(createElement('p', '', { textContent: '待補充資訊' }));
    devPanel.appendChild(devContent);
    devSection.appendChild(devPanel);

    let devOpen = false;
    devCell.onclick = () => {
        devOpen = !devOpen;
        if (devOpen) {
            devPanel.style.maxHeight = devContent.scrollHeight + 'px';
            devPanel.style.opacity = '1';
            devArrow.style.transform = 'rotate(180deg)';
        } else {
            devPanel.style.maxHeight = '0';
            devPanel.style.opacity = '0';
            devArrow.style.transform = 'rotate(0deg)';
        }
    };

    main.appendChild(devSection);

    const footer = createElement('div', 'text-center py-6 text-sm text-ios-muted');
    footer.appendChild(createElement('p', '', { textContent: 'SXIOS v1.0.0' }));
    main.appendChild(footer);

    container.appendChild(main);

    return { element: container, cleanup: null };
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
    stylesPath: 'js/apps/settings/style.css'
};
