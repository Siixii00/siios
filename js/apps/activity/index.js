import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { ActivityDB } from '../../db.js';

const PLATFORMS = [
    { id: 'line', name: 'LINE', icon: 'chat', color: '#00B900' },
    { id: 'instagram', name: 'Instagram', icon: 'photo_camera', color: '#E1306C' },
    { id: 'twitter', name: 'Twitter/X', icon: 'alternate_email', color: '#1DA1F2' },
    { id: 'facebook', name: 'Facebook', icon: 'thumb_up', color: '#1877F2' },
    { id: 'youtube', name: 'YouTube', icon: 'play_circle', color: '#FF0000' },
    { id: 'tiktok', name: 'TikTok', icon: 'music_note', color: '#000000' },
    { id: 'message', name: '簡訊', icon: 'message', color: '#34C759' },
    { id: 'call', name: '通話', icon: 'call', color: '#00C7BE' },
    { id: 'email', name: 'Email', icon: 'mail', color: '#FF9500' },
    { id: 'other', name: '其他', icon: 'more_horiz', color: '#8E8E93' }
];

const ACTIVITY_TYPES = [
    { id: 'message', name: '訊息' },
    { id: 'post', name: '貼文' },
    { id: 'like', name: '按讚' },
    { id: 'comment', name: '留言' },
    { id: 'share', name: '分享' },
    { id: 'view', name: '觀看' },
    { id: 'call', name: '通話' },
    { id: 'email', name: '郵件' },
    { id: 'notification', name: '通知' },
    { id: 'other', name: '其他' }
];

async function renderActivitySync() {
    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: '活動同步',
        backPath: '/settings',
        rightActions: [
            {
                icon: 'delete',
                onClick: async () => {
                    if (confirm('確定要清除所有活動記錄？')) {
                        await ActivityDB.clear();
                        createToast('已清除所有活動記錄', 'success');
                        Router.navigate('/activity');
                    }
                }
            }
        ]
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-2 pb-8');

    const summary = await ActivityDB.getSummary(24);

    const summarySection = createElement('div', 'mx-4');
    const summaryCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm');
    
    const summaryHeader = createElement('div', 'flex items-center justify-between mb-3');
    summaryHeader.appendChild(createElement('span', 'font-semibold', { textContent: '今日活動摘要' }));
    summaryHeader.appendChild(createElement('span', 'text-sm text-ios-muted', { textContent: `共 ${summary.total} 筆` }));
    summaryCard.appendChild(summaryHeader);

    if (summary.total > 0) {
        const platformStats = createElement('div', 'flex flex-wrap gap-2');
        for (const [platform, count] of Object.entries(summary.platforms)) {
            const platformInfo = PLATFORMS.find(p => p.id === platform) || { name: platform, color: '#8E8E93' };
            const badge = createElement('div', 'px-2 py-1 rounded-full text-xs text-white');
            badge.style.backgroundColor = platformInfo.color;
            badge.textContent = `${platformInfo.name} ${count}`;
            platformStats.appendChild(badge);
        }
        summaryCard.appendChild(platformStats);
    } else {
        summaryCard.appendChild(createElement('p', 'text-ios-muted text-sm', { textContent: '尚未記錄任何活動' }));
    }
    
    summarySection.appendChild(summaryCard);
    main.appendChild(summarySection);

    const addSection = createElement('div', 'mx-4 mt-4');
    addSection.appendChild(createElement('p', 'ios-section-header', { textContent: '新增活動' }));
    
    const addCard = createElement('div', 'bg-white rounded-xl p-4 shadow-sm');

    const platformSelect = createElement('select', 'ios-input w-full mb-3');
    PLATFORMS.forEach(p => {
        const option = createElement('option', '', { value: p.id, textContent: p.name });
        platformSelect.appendChild(option);
    });
    addCard.appendChild(platformSelect);

    const typeSelect = createElement('select', 'ios-input w-full mb-3');
    ACTIVITY_TYPES.forEach(t => {
        const option = createElement('option', '', { value: t.id, textContent: t.name });
        typeSelect.appendChild(option);
    });
    addCard.appendChild(typeSelect);

    const titleInput = createElement('input', 'ios-input w-full mb-3', {
        type: 'text',
        placeholder: '活動標題（選填）'
    });
    addCard.appendChild(titleInput);

    const contentInput = createElement('textarea', 'ios-input w-full mb-3', {
        placeholder: '活動內容描述...',
        rows: 3
    });
    addCard.appendChild(contentInput);

    const addBtn = createElement('button', 'ios-btn ios-btn-primary w-full');
    addBtn.textContent = '記錄活動';
    addBtn.onclick = async () => {
        if (!platformSelect.value || !typeSelect.value) {
            createToast('請選擇平台和活動類型', 'error');
            return;
        }

        await ActivityDB.create({
            platform: platformSelect.value,
            activity_type: typeSelect.value,
            title: titleInput.value.trim(),
            content: contentInput.value.trim()
        });

        createToast('活動已記錄', 'success');
        titleInput.value = '';
        contentInput.value = '';
        Router.navigate('/activity');
    };
    addCard.appendChild(addBtn);

    addSection.appendChild(addCard);
    main.appendChild(addSection);

    const activities = await ActivityDB.getAll(50);

    const listSection = createElement('div', 'mx-4 mt-4');
    listSection.appendChild(createElement('p', 'ios-section-header', { textContent: '活動記錄' }));

    const listCard = createElement('div', 'bg-white rounded-xl shadow-sm overflow-hidden');

    if (activities.length === 0) {
        listCard.appendChild(createElement('div', 'p-4 text-center text-ios-muted', { textContent: '尚未有任何活動記錄' }));
    } else {
        activities.forEach((activity, index) => {
            const item = createElement('div', `p-4 border-b border-gray-100 ${index === activities.length - 1 ? 'border-b-0' : ''}`);
            
            const itemHeader = createElement('div', 'flex items-center gap-2 mb-1');
            const platformInfo = PLATFORMS.find(p => p.id === activity.platform) || { name: activity.platform, icon: 'more_horiz', color: '#8E8E93' };
            
            const platformBadge = createElement('span', 'px-2 py-0.5 rounded-full text-xs text-white');
            platformBadge.style.backgroundColor = platformInfo.color;
            platformBadge.textContent = platformInfo.name;
            itemHeader.appendChild(platformBadge);
            
            const typeInfo = ACTIVITY_TYPES.find(t => t.id === activity.activity_type) || { name: activity.activity_type };
            itemHeader.appendChild(createElement('span', 'text-sm text-ios-muted', { textContent: typeInfo.name }));
            
            const time = new Date(activity.timestamp);
            const timeStr = time.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
            itemHeader.appendChild(createElement('span', 'text-xs text-ios-muted ml-auto', { textContent: timeStr }));
            
            item.appendChild(itemHeader);

            if (activity.title) {
                item.appendChild(createElement('p', 'font-medium text-sm', { textContent: activity.title }));
            }
            if (activity.content) {
                item.appendChild(createElement('p', 'text-sm text-ios-muted', { textContent: activity.content }));
            }

            listCard.appendChild(item);
        });
    }

    listSection.appendChild(listCard);
    main.appendChild(listSection);

    container.appendChild(main);

    return { element: container, cleanup: null };
}

export default {
    id: 'activity',
    name: '活動同步',
    icon: 'sync',
    routes: [
        { path: '/activity', render: renderActivitySync }
    ]
};