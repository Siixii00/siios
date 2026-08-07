import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';

const PRIVACY_LEVELS = [
    { 
        id: 'basic', 
        name: '基本統計', 
        desc: '僅記錄平台、活動類型、時間與次數',
        examples: ['Instagram 按? 3 次', 'LINE 使用 15 分鐘']
    },
    { 
        id: 'summary', 
        name: '包含摘要', 
        desc: '記錄互動對象、標題等摘要資訊',
        examples: ['與小明通話 10 分鐘', '觀看「某影片」']
    },
    { 
        id: 'detailed', 
        name: '詳細資訊', 
        desc: '記錄通知內容摘要、搜尋關鍵字',
        examples: ['收到「會議提醒」通知', '搜尋「某關鍵字」'],
        requiresPassword: true
    }
];

const PLATFORM_SETTINGS = [
    { 
        id: 'twitter', 
        name: 'Twitter/X', 
        icon: 'alternate_email', 
        color: '#1DA1F2',
        defaultLevel: 'basic',
        activities: ['推文', '按讚', '轉推', '回覆', '觀看']
    },
    { 
        id: 'instagram', 
        name: 'Instagram', 
        icon: 'photo_camera', 
        color: '#E1306C',
        defaultLevel: 'basic',
        activities: ['貼文', '按讚', '留言', '觀看', '限動']
    },
    { 
        id: 'line', 
        name: 'LINE', 
        icon: 'chat', 
        color: '#00B900',
        defaultLevel: 'basic',
        activities: ['訊息', '通話', '貼圖']
    },
    { 
        id: 'facebook', 
        name: 'Facebook', 
        icon: 'thumb_up', 
        color: '#1877F2',
        defaultLevel: 'basic',
        activities: ['貼文', '按讚', '留言', '觀看']
    },
    { 
        id: 'youtube', 
        name: 'YouTube', 
        icon: 'play_circle', 
        color: '#FF0000',
        defaultLevel: 'basic',
        activities: ['觀看', '訂閱', '留言']
    },
    { 
        id: 'discord', 
        name: 'Discord', 
        icon: 'discord', 
        color: '#5865F2',
        defaultLevel: 'basic',
        activities: ['訊息', '語音', '伺服器活動']
    },
    { 
        id: 'tiktok', 
        name: 'TikTok', 
        icon: 'music_note', 
        color: '#000000',
        defaultLevel: 'basic',
        activities: ['觀看', '按讚', '留言', '分享']
    },
    { 
        id: 'call', 
        name: '通話記錄', 
        icon: 'call', 
        color: '#00C7BE',
        defaultLevel: 'summary',
        activities: ['撥打', '接聽', '未接來電']
    },
    { 
        id: 'message', 
        name: '簡訊', 
        icon: 'message', 
        color: '#34C759',
        defaultLevel: 'basic',
        activities: ['發送', '接收']
    },
    { 
        id: 'email', 
        name: 'Email', 
        icon: 'mail', 
        color: '#FF9500',
        defaultLevel: 'basic',
        activities: ['發送', '接收', '閱讀']
    }
];

async function renderActivityPrivacySettings() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-header');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    
    const backBtn = createElement('button', 'ios-back-btn', {
        onClick: () => Router.navigate('/activity')
    });
    backBtn.innerHTML = "`<i class=`"`fas fa-chevron-left`"`></i> 返回`";
    header.appendChild(backBtn);
    
    const title = createElement('h1', 'menu-title');
    title.textContent = '隱私設定';
    header.appendChild(title);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar');
    main.style.paddingTop = 'calc(env(safe-area-inset-top, 44px) + 44px + 16px)';
    
    const savedSettings = await SettingsDB.get('activity_privacy_settings') || {
        global_enabled: false,
        global_level: 'basic',
        retention_days: 30,
        platforms: {}
    };
    
    const globalEnabledSwitch = createElement('div', 'mx-4 mb-4 p-4 bg-gradient-to-r from-green-500 to-teal-500 rounded-xl text-white');
    const globalEnabledContent = `
        <div class='flex items-center justify-between'>
            <div>
                <h2 class='text-lg font-bold mb-1'>活動同步</h2>
                <p class='text-sm opacity-90'>開啟後，系統將記錄您的數位活動</p>
            </div>
            <label class='relative inline-flex items-center cursor-pointer'>
                <input type='checkbox' id='global-enabled-switch' class='sr-only peer' ${savedSettings.global_enabled ? 'checked' : ''}>
                <div class='w-11 h-6 bg-white bg-opacity-30 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-white peer-checked:bg-opacity-100'></div>
            </label>
        </div>
    `;
    globalEnabledSwitch.innerHTML = globalEnabledContent;
    main.appendChild(globalEnabledSwitch);
    
    const privacyLevelSection = createElement('div', 'mx-4 mb-4');
    privacyLevelSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '隱私等級' }));
    
    const privacyLevelCard = createElement('div', 'bg-white rounded-xl shadow-sm overflow-hidden');
    PRIVACY_LEVELS.forEach((level, index) => {
        const levelItem = createElement('div', `p-4 ${index < PRIVACY_LEVELS.length - 1 ? 'border-b border-gray-100' : ''}`);
        
        const levelHeader = createElement('label', 'flex items-center justify-between cursor-pointer');
        const radioInput = createElement('input', 'sr-only', { 
            type: 'radio', 
            name: 'privacy-level',
            value: level.id,
            checked: savedSettings.global_level === level.id
        });
        
        const radioVisual = createElement('div', 'w-5 h-5 rounded-full border-2 border-gray-300 flex items-center justify-center');
        if (savedSettings.global_level === level.id) {
            radioVisual.classList.add('border-green-500');
            const inner = createElement('div', 'w-3 h-3 rounded-full bg-green-500');
            radioVisual.appendChild(inner);
        }
        
        const levelInfo = createElement('div', 'flex-1 ml-3');
        levelInfo.appendChild(createElement('h3', 'font-semibold text-sm', { textContent: level.name }));
        levelInfo.appendChild(createElement('p', 'text-xs text-ios-muted mt-0.5', { textContent: level.desc }));
        
        if (level.requiresPassword) {
            const badge = createElement('span', 'ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded');
            badge.textContent = '需密碼';
            levelInfo.appendChild(badge);
        }
        
        levelHeader.appendChild(radioInput);
        levelHeader.appendChild(radioVisual);
        levelHeader.appendChild(levelInfo);
        
        levelHeader.onclick = () => {
            privacyLevelCard.querySelectorAll('.rounded-full.border-2').forEach(el => {
                el.classList.remove('border-green-500');
                el.innerHTML = '';
            });
            radioVisual.classList.add('border-green-500');
            const inner = createElement('div', 'w-3 h-3 rounded-full bg-green-500');
            radioVisual.appendChild(inner);
            radioInput.checked = true;
        };
        
        levelItem.appendChild(levelHeader);
        
        const examplesDiv = createElement('div', 'mt-2 ml-8 text-xs text-ios-muted');
        examplesDiv.appendChild(createElement('p', 'font-medium mb-1', { textContent: '範例：' }));
        const exampleList = createElement('div', 'space-y-1');
        level.examples.forEach(ex => {
            exampleList.appendChild(createElement('div', '', { textContent: `‧ ${ex}` }));
        });
        examplesDiv.appendChild(exampleList);
        levelItem.appendChild(examplesDiv);
        
        privacyLevelCard.appendChild(levelItem);
    });
    privacyLevelSection.appendChild(privacyLevelCard);
    main.appendChild(privacyLevelSection);
    
    const retentionSection = createElement('div', 'mx-4 mb-4');
    retentionSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '資料保留期限' }));
    
    const retentionCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm');
    const retentionSelect = createElement('select', 'ios-input w-full');
    [7, 14, 30, 60, 90].forEach(days => {
        const option = createElement('option', '', { 
            value: days, 
            textContent: `${days} 天`,
            selected: savedSettings.retention_days === days
        });
        retentionSelect.appendChild(option);
    });
    retentionCard.appendChild(retentionSelect);
    
    const retentionHint = createElement('p', 'text-xs text-ios-muted mt-2');
    retentionHint.textContent = '超過期限的記錄將自動刪除';
    retentionCard.appendChild(retentionHint);
    
    retentionSection.appendChild(retentionCard);
    main.appendChild(retentionSection);
    
    const platformsSection = createElement('div', 'mx-4 mb-4');
    platformsSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: '平台設定' }));
    
    const platformsCard = createElement('div', 'bg-white rounded-xl shadow-sm overflow-hidden');
    PLATFORM_SETTINGS.forEach((platform, index) => {
        const platformItem = createElement('div', `p-4 ${index < PLATFORM_SETTINGS.length - 1 ? 'border-b border-gray-100' : ''}`);
        
        const platformHeader = createElement('div', 'flex items-center justify-between');
        
        const leftInfo = createElement('div', 'flex items-center gap-3');
        const iconDiv = createElement('div', 'w-10 h-10 rounded-full flex items-center justify-center text-white');
        iconDiv.style.backgroundColor = platform.color;
        
        if (platform.icon === 'discord') {
            iconDiv.innerHTML = "`<i class=`"`fab fa-discord text-lg`"`></i>`";
        } else {
            iconDiv.appendChild(createIcon(platform.icon, 'text-lg'));
        }
        leftInfo.appendChild(iconDiv);
        
        const platformText = createElement('div');
        platformText.appendChild(createElement('h3', 'font-semibold text-sm', { textContent: platform.name }));
        platformText.appendChild(createElement('p', 'text-xs text-ios-muted', { 
            textContent: platform.activities.slice(0, 3).join('、') 
        }));
        leftInfo.appendChild(platformText);
        
        platformHeader.appendChild(leftInfo);
        
        const toggle = createElement('label', 'relative inline-flex items-center cursor-pointer');
        const platformEnabled = savedSettings.platforms[platform.id]?.enabled ?? true;
        toggle.innerHTML = `
            <input type='checkbox' class='sr-only peer platform-toggle' data-platform='${platform.id}' ${platformEnabled ? 'checked' : ''}>
            <div class='w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500'></div>
        `;
        platformHeader.appendChild(toggle);
        
        platformItem.appendChild(platformHeader);
        platformsCard.appendChild(platformItem);
    });
    platformsSection.appendChild(platformsCard);
    main.appendChild(platformsSection);
    
    const aiAccessSection = createElement('div', 'mx-4 mb-4');
    aiAccessSection.appendChild(createElement('p', 'ios-section-header mb-2', { textContent: 'AI 存取控制' }));
    
    const aiAccessCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm');
    const aiAccessContent = `
        <div class='flex items-center justify-between mb-3'>
            <div>
                <h3 class='font-semibold text-sm'>允許 AI 角色存取</h3>
                <p class='text-xs text-ios-muted'>AI 可查看您的活動記錄以提供個人化回應</p>
            </div>
            <label class='relative inline-flex items-center cursor-pointer'>
                <input type='checkbox' id='ai-access-switch' class='sr-only peer' ${savedSettings.ai_access_enabled ? 'checked' : ''}>
                <div class='w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500'></div>
            </label>
        </div>
        <div class='text-xs text-ios-muted p-3 bg-gray-50 rounded-lg'>
            <p class='font-medium mb-1'>AI 僅可存取：</p>
            <ul class='space-y-1'>
                <li>‧ 您授權的平台活動</li>
                <li>‧ 符合隱私等級的資訊</li>
                <li>‧ 保留期限內的記錄</li>
            </ul>
        </div>
    `;
    aiAccessCard.innerHTML = aiAccessContent;
    aiAccessSection.appendChild(aiAccessCard);
    main.appendChild(aiAccessSection);
    
    const deleteSection = createElement('div', 'mx-4 mb-8');
    const deleteCard = createElement('div', 'bg-red-50 rounded-xl p-4 border border-red-200');
    
    const deleteBtn = createElement('button', 'w-full text-red-600 font-semibold text-sm');
    deleteBtn.textContent = '清除所有活動記錄';
    deleteBtn.onclick = async () => {
        if (confirm('確定要清除所有活動記錄？此操作無法復原。')) {
            const { ActivityDB } = await import('../../db.js');
            await ActivityDB.clear();
            createToast('已清除所有活動記錄', 'success');
        }
    };
    deleteCard.appendChild(deleteBtn);
    
    const deleteHint = createElement('p', 'text-xs text-red-500 mt-2 text-center');
    deleteHint.textContent = '此操作將立即刪除本地所有記錄';
    deleteCard.appendChild(deleteHint);
    
    deleteSection.appendChild(deleteCard);
    main.appendChild(deleteSection);
    
    const saveBtn = createElement('button', 'ios-btn ios-btn-primary w-full mx-4 mb-8');
    saveBtn.style.maxWidth = 'calc(100% - 32px)';
    saveBtn.textContent = '保存設定';
    saveBtn.onclick = async () => {
        const globalEnabled = document.getElementById('global-enabled-switch').checked;
        const selectedLevel = document.querySelector('input[name='privacy-level']:checked')?.value || 'basic';
        const aiAccessEnabled = document.getElementById('ai-access-switch').checked;
        
        const platforms = {};
        document.querySelectorAll('.platform-toggle').forEach(toggle => {
            const platformId = toggle.dataset.platform;
            platforms[platformId] = {
                enabled: toggle.checked,
                level: selectedLevel
            };
        });
        
        const settings = {
            global_enabled: globalEnabled,
            global_level: selectedLevel,
            retention_days: parseInt(retentionSelect.value),
            ai_access_enabled: aiAccessEnabled,
            platforms
        };
        
        await SettingsDB.set('activity_privacy_settings', settings);
        createToast('設定已保存', 'success');
        Router.navigate('/activity');
    };
    main.appendChild(saveBtn);
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

export default {
    id: 'activity-privacy-settings',
    name: '活動隱私設定',
    routes: [
        { path: '/activity/privacy', render: renderActivityPrivacySettings }
    ]
};
