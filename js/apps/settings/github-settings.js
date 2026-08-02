import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';

async function renderGithubSettings() {
    const githubToken = await SettingsDB.get('github_token') || '';
    const githubUser = await SettingsDB.get('github_user') || null;
    const appearance = await SettingsDB.get('appearance_theme') || 'light';

    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: 'Github 設定',
        backPath: '/settings'
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-8');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';

    const appearanceSection = createElement('div', 'mb-2 ml-8');
    appearanceSection.appendChild(createElement('p', 'ios-section-header', { textContent: '預設外觀' }));

    const appearanceGroup = createElement('div', 'ios-grouped-list mx-4');

    const darkCell = createElement('div', 'ios-list-cell ios-list-cell-full cursor-pointer');
    darkCell.appendChild(createIcon('dark_mode', 'text-xl'));
    darkCell.appendChild(createElement('span', 'flex-1 ml-3', { textContent: '深色模式' }));
    const darkCheck = appearance === 'dark' ? createIcon('check', 'text-ios-blue text-xl') : createElement('span', '');
    darkCell.appendChild(darkCheck);
    darkCell.onclick = async () => {
        await SettingsDB.set('appearance_theme', 'dark');
        createToast('已切換為深色模式');
        Router.navigate('/settings/github');
    };
    appearanceGroup.appendChild(darkCell);

    const lightCell = createElement('div', 'ios-list-cell ios-list-cell-full cursor-pointer');
    lightCell.appendChild(createIcon('light_mode', 'text-xl'));
    lightCell.appendChild(createElement('span', 'flex-1 ml-3', { textContent: '淺色模式' }));
    const lightCheck = appearance === 'light' ? createIcon('check', 'text-ios-blue text-xl') : createElement('span', '');
    lightCell.appendChild(lightCheck);
    lightCell.onclick = async () => {
        await SettingsDB.set('appearance_theme', 'light');
        createToast('已切換為淺色模式');
        Router.navigate('/settings/github');
    };
    appearanceGroup.appendChild(lightCell);

    main.appendChild(appearanceSection);
    main.appendChild(appearanceGroup);

    const githubSection = createElement('div', 'mb-2 ml-8 mt-6');
    githubSection.appendChild(createElement('p', 'ios-section-header', { textContent: 'Github 備份串接' }));

    const githubGroup = createElement('div', 'ios-grouped-list mx-4');

    const statusCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    const statusIcon = createElement('div', `ios-icon-badge ${githubToken ? 'bg-green-500' : 'bg-gray-400'}`);
    statusIcon.appendChild(createIcon(githubToken ? 'cloud_done' : 'cloud_off', 'text-white text-sm'));
    statusCell.appendChild(statusIcon);
    const statusText = createElement('div', 'flex-1');
    statusText.appendChild(createElement('span', 'text-body-lg', { textContent: githubToken ? '已連接' : '未連接' }));
    if (githubUser) {
        statusText.appendChild(createElement('span', 'block text-sm text-ios-muted', { textContent: '@' + githubUser.login }));
    }
    statusCell.appendChild(statusText);
    githubGroup.appendChild(statusCell);

    const tokenCell = createElement('div', 'p-4');
    tokenCell.appendChild(createElement('label', 'text-sm text-ios-muted mb-2 block', { textContent: 'Personal Access Token' }));
    const tokenInput = createElement('input', 'ios-input', {
        type: 'password',
        placeholder: 'ghp_xxxxxxxxxxxx',
        value: githubToken
    });
    tokenCell.appendChild(tokenInput);
    githubGroup.appendChild(tokenCell);

    const connectBtn = createElement('button', 'ios-btn ios-btn-primary w-full py-3 mt-2', {
        textContent: githubToken ? '重新連接' : '連接 Github'
    });
    connectBtn.onclick = async () => {
        const token = tokenInput.value.trim();
        if (!token) {
            createToast('請輸入 Token');
            return;
        }
        connectBtn.textContent = '連接中...';
        connectBtn.disabled = true;

        try {
            const userRes = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': 'token ' + token }
            });
            if (!userRes.ok) throw new Error('Token 無效');
            const userData = await userRes.json();

            await SettingsDB.set('github_token', token);
            await SettingsDB.set('github_user', {
                login: userData.login,
                name: userData.name || userData.login,
                avatar_url: userData.avatar_url
            });

            const repoName = 'siios-backup';
            const repoRes = await fetch('https://api.github.com/user/repos', {
                method: 'POST',
                headers: {
                    'Authorization': 'token ' + token,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    name: repoName,
                    private: true,
                    description: 'SXIOS 備份倉庫',
                    auto_init: true
                })
            });

            if (repoRes.ok) {
                createToast('已建立隱私備份倉庫：' + repoName);
            } else if (repoRes.status === 422) {
                createToast('備份倉庫已存在，跳過建立');
            } else {
                createToast('倉庫建立失敗，但連接成功');
            }

            createToast('已連接 Github：' + (userData.name || userData.login));
            Router.navigate('/settings/github');
        } catch (e) {
            createToast('連接失敗：' + e.message);
            connectBtn.textContent = '連接 Github';
            connectBtn.disabled = false;
        }
    };
    tokenCell.appendChild(connectBtn);

    if (githubToken) {
        const disconnectBtn = createElement('button', 'ios-btn w-full py-3 mt-2 text-red-500', {
            textContent: '中斷連接',
            onClick: async () => {
                await SettingsDB.set('github_token', '');
                await SettingsDB.set('github_user', null);
                createToast('已中斷 Github 連接');
                Router.navigate('/settings/github');
            }
        });
        tokenCell.appendChild(disconnectBtn);
    }

    main.appendChild(githubSection);
    main.appendChild(githubGroup);

    container.appendChild(main);

    return { element: container, cleanup: null };
}

export default {
    id: 'github-settings',
    routes: [
        { path: '/settings/github', render: renderGithubSettings }
    ]
};
