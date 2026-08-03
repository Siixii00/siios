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
    
    const helpText = createElement('div', 'mb-4');
    helpText.innerHTML = `
        <p class="text-sm text-ios-muted mb-2">如何獲取 Personal Access Token：</p>
        <ol class="text-xs text-ios-muted space-y-1" style="padding-left: 16px;">
            <li>1. 前往 <a href="https://github.com/settings/tokens" target="_blank" class="text-ios-blue">GitHub Token 設定</a></li>
            <li>2. 點擊「Generate new token (classic)」</li>
            <li>3. 勾選 <code>repo</code> 權限</li>
            <li>4. 點擊「Generate token」</li>
            <li>5. 複製 token（只會顯示一次）</li>
        </ol>
    `;
    tokenCell.appendChild(helpText);
    
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
        
        if (!token.startsWith('ghp_')) {
            createToast('Token 格式錯誤，應以 ghp_ 開頭');
            return;
        }
        
        connectBtn.textContent = '連接中...';
        connectBtn.disabled = true;

        try {
            createToast('正在驗證 Token...');
            
            const userRes = await fetch('https://api.github.com/user', {
                headers: { 'Authorization': 'token ' + token }
            });
            
            if (!userRes.ok) {
                if (userRes.status === 401) {
                    throw new Error('Token 無效或已過期');
                } else if (userRes.status === 403) {
                    throw new Error('API 請求次數已達上限，請稍後再試');
                } else {
                    throw new Error('無法連接到 GitHub (' + userRes.status + ')');
                }
            }
            
            const userData = await userRes.json();
            createToast('Token 驗證成功！正在設置...');

            await SettingsDB.set('github_token', token);
            await SettingsDB.set('github_user', {
                login: userData.login,
                name: userData.name || userData.login,
                avatar_url: userData.avatar_url
            });

            createToast('正在創建備份倉庫...');
            
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
                    description: 'Siios 備份倉庫',
                    auto_init: true
                })
            });

            if (repoRes.ok) {
                createToast('✓ 已建立隱私備份倉庫：' + repoName);
            } else if (repoRes.status === 422) {
                createToast('✓ 備份倉庫已存在');
            } else {
                createToast('⚠ 倉庫建立失敗，但連接成功');
            }

            createToast('✓ 已成功連接 GitHub：' + (userData.name || userData.login));
            setTimeout(() => {
                Router.navigate('/settings/github');
            }, 1000);
        } catch (e) {
            createToast('✗ 連接失敗：' + e.message, 'error');
            connectBtn.textContent = githubToken ? '重新連接' : '連接 Github';
            connectBtn.disabled = false;
        }
    };
    tokenCell.appendChild(connectBtn);

    if (githubToken) {
        const testBtn = createElement('button', 'ios-btn w-full py-3 mt-2', {
            textContent: '測試連接',
            onClick: async () => {
                testBtn.textContent = '測試中...';
                testBtn.disabled = true;
                
                try {
                    const userRes = await fetch('https://api.github.com/user', {
                        headers: { 'Authorization': 'token ' + githubToken }
                    });
                    
                    if (userRes.ok) {
                        const userData = await userRes.json();
                        createToast('✓ 連接正常，用戶：' + userData.login);
                    } else {
                        createToast('✗ Token 已失效，請重新連接', 'error');
                    }
                } catch (e) {
                    createToast('✗ 連接失敗：' + e.message, 'error');
                }
                
                testBtn.textContent = '測試連接';
                testBtn.disabled = false;
            }
        });
        tokenCell.appendChild(testBtn);
        
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
