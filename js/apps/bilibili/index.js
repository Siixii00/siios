import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';

const thumbnailColors = [
    ['#ffd5e5', '#ff8fb1'],
    ['#a8edea', '#fed6e3'],
    ['#667eea', '#764ba2'],
    ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'],
    ['#43e97b', '#38f9d7']
];

const danmuPool = [
    '哈哈哈太好笑了', '笑死', 'www', '這段絕了', '前方高能',
    '爺青回', '爺青結', 'awsl', '好可愛', '太強了',
    '淩目', '破防了', '這波操作絕了', '學到了', '臥槽',
    '牛逼', '太神了', '絕絕子', '愛了愛了', '下次一定',
    '下次不一定的', '投幣了', '三連走起', '催更', '快更新',
    '這才是真正的技術', '學廢了', '我好了', '名場面', '經典'
];

const videoCategories = {
    recommend: ['熱門', '動漫', '遊戲', '音樂', '科技', '生活'],
    anime: ['新番', '完結', '經典', '國漫', '劇場版'],
    live: ['遊戲直播', '虛擬主播', '唱歌', '聊天', '戶外'],
    hot: ['本週熱門', '本月熱門', '挑戰類', '搞笑', '知識'],
    games: ['手機遊戲', '主機遊戲', 'PC遊戲', '電競', '實況']
};

const notificationTemplates = [
    { type: 'subscribe', icon: 'person_add', title: '新粉絲', templates: ['關注了你', '成為了你的粉絲', '開始追蹤你'] },
    { type: 'like', icon: 'favorite', title: '收穫讚', templates: ['讚了你的影片', '喜歡了你的動態', '給你的評論點讚'] },
    { type: 'comment', icon: 'comment', title: '新留言', templates: ['評論了你的影片', '回覆了你的評論', '在你的影片下留言'] },
    { type: 'at', icon: 'alternate_email', title: '@提醒', templates: ['在評論中提到了你', '在影片中@了你', '邀請你一起觀看'] },
    { type: 'system', icon: 'notifications', title: '系統通知', templates: ['你的影片已通過審核', '會員即將到期', '活動獎勵已發放', '新功能上線通知'] }
];

let appState = {
    currentTab: 'recommend',
    sample: {
        recommend: [],
        anime: [],
        live: [],
        hot: [],
        games: []
    },
    danmuEnabled: true,
    danmuTimer: null,
    currentWatchingChar: null,
    pendingVideoData: null,
    activeNPCs: [],
    charCommentTimer: null,
    currentMsgTab: 'notifications',
    currentChatUser: null,
    chatData: {},
    selectedCharacterId: null
};

function randomPick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function generateThumbnail() {
    const colors = randomPick(thumbnailColors);
    const patterns = [
        `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(45deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
        `radial-gradient(circle at 30% 30%, ${colors[0]}, ${colors[1]})`,
        `radial-gradient(circle at 70% 70%, ${colors[0]}, ${colors[1]})`,
        `conic-gradient(from 90deg, ${colors[0]}, ${colors[1]}, ${colors[0]})`
    ];
    return randomPick(patterns);
}

function randomViews() {
    const values = ['12萬', '38萬', '76萬', '102萬', '188萬', '256萬', '320萬'];
    return randomPick(values);
}

function randomDanmu() {
    const values = ['1,120', '2,580', '6,200', '9,450', '1.3萬', '2.1萬'];
    return randomPick(values);
}

function generateRandomTime() {
    const units = ['分鐘', '小時', '天'];
    const unit = randomPick(units);
    const value = Math.floor(Math.random() * 12) + 1;
    return `${value} ${unit}前`;
}

function convertBilibiliUrl(url) {
    if (!url) return '';
    
    const bvMatch = url.match(/bilibili\.com\/video\/(BV[a-zA-Z0-9]+)/i);
    if (bvMatch) {
        return `https://player.bilibili.com/player.html?bvid=${bvMatch[1]}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    const shortBvMatch = url.match(/b23\.tv\/(BV[a-zA-Z0-9]+)/i);
    if (shortBvMatch) {
        return `https://player.bilibili.com/player.html?bvid=${shortBvMatch[1]}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    const avMatch = url.match(/bilibili\.com\/video\/av(\d+)/i);
    if (avMatch) {
        return `https://player.bilibili.com/player.html?aid=${avMatch[1]}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    const shortAvMatch = url.match(/b23\.tv\/av(\d+)/i);
    if (shortAvMatch) {
        return `https://player.bilibili.com/player.html?aid=${shortAvMatch[1]}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    const shortIdMatch = url.match(/b23\.tv\/([a-zA-Z0-9]+)/i);
    if (shortIdMatch) {
        const id = shortIdMatch[1];
        if (id.startsWith('BV')) {
            return `https://player.bilibili.com/player.html?bvid=${id}&page=1&danmaku=0&high_quality=1&autoplay=1`;
        }
        return `https://player.bilibili.com/player.html?bvid=${id}&page=1&danmaku=0&high_quality=1&autoplay=1`;
    }
    
    return url;
}

function extractBvid(url) {
    if (!url) return null;
    const bvMatch = url.match(/(BV[a-zA-Z0-9]+)/i);
    return bvMatch ? bvMatch[1] : null;
}

function openInBilibili(url) {
    const bvid = extractBvid(url);
    const appUrl = bvid ? `bilibili://video/${bvid}` : url;
    const webUrl = bvid ? `https://www.bilibili.com/video/${bvid}` : url;
    
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = appUrl;
    document.body.appendChild(iframe);
    
    setTimeout(() => {
        iframe.remove();
        window.open(webUrl, '_blank');
    }, 500);
}

const BILI_API = 'https://siios-bilibili-worker.yaninlin.workers.dev';

async function checkBilibiliLogin() {
    const isLoggedIn = await SettingsDB.get('bilibili_logged_in');
    return isLoggedIn === true;
}

async function setBilibiliLoginStatus(status) {
    await SettingsDB.set('bilibili_logged_in', status);
}

async function startQRLogin() {
    try {
        createToast('正在生成登入二維碼...');
        
        const response = await fetch(`${BILI_API}/api/bilibili/auth/login`, { method: 'POST' });
        const data = await response.json();
        
        if (data.error === 'qrcode_banned') {
            // QR Code 被 ban，顯示手動輸入提示
            showManualCookieInput(data.instructions);
            return;
        }
        
        if (data.url) {
            showQRCodeModal(data.url, data.qrcode_key);
        }
    } catch (e) {
        console.error('QR Login error:', e);
        createToast('無法生成登入二維碼，請使用手動輸入');
        showManualCookieInput();
    }
}

function showManualCookieInput(instructions) {
    const modal = createElement('div', 'bili-login-modal');
    const content = createElement('div', 'bili-login-content');
    
    content.innerHTML = `
        <h3 style="margin: 0 0 16px;">手動輸入 Cookie</h3>
        <p style="color: #666; font-size: 13px; margin-bottom: 16px;">
            由於 Bilibili 限制，需要手動獲取 Cookie：
        </p>
        <ol style="color: #666; font-size: 12px; padding-left: 20px; margin-bottom: 16px; line-height: 1.8;">
            ${instructions ? instructions.map(i => `<li>${i}</li>`).join('') : `
                <li>在瀏覽器打開 bilibili.com 並登入</li>
                <li>按 F12 → Console 標籤</li>
                <li>輸入：<code style="background: #f5f5f5; padding: 2px 6px; border-radius: 4px;">document.cookie</code></li>
                <li>複製完整的 Cookie 字串</li>
            `}
        </ol>
        <textarea 
            id="manual-cookie-input" 
            style="width: 100%; height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 8px; font-size: 12px; font-family: monospace;"
            placeholder="貼上完整的 Cookie 字串..."
        ></textarea>
        <button id="save-manual-cookie" style="width: 100%; margin-top: 12px; padding: 12px; background: #fb7299; color: white; border: none; border-radius: 8px; cursor: pointer;">
            保存 Cookie
        </button>
        <button id="close-manual" style="width: 100%; margin-top: 8px; padding: 12px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; cursor: pointer;">
            取消
        </button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    modal.querySelector('#save-manual-cookie').onclick = async () => {
        const cookie = modal.querySelector('#manual-cookie-input').value.trim();
        
        if (!cookie || !cookie.includes('SESSDATA')) {
            createToast('Cookie 格式錯誤');
            return;
        }
        
        await SettingsDB.set('bilibili_cookie', cookie);
        await setBilibiliLoginStatus(true);
        
        modal.remove();
        createToast('✓ 已保存 Cookie');
        
        setTimeout(() => Router.navigate('/bilibili'), 500);
    };
    
    modal.querySelector('#close-manual').onclick = () => modal.remove();
}

function showQRCodeModal(qrUrl, qrcodeKey) {
    const modal = createElement('div', 'bili-login-modal');
    const content = createElement('div', 'bili-login-content');
    
    content.innerHTML = `
        <h3>掃碼登入 B 站</h3>
        <p>請使用 B 站 App 掃描以下二維碼</p>
        <div class="bili-qrcode-container">
            <img src="${qrUrl}" alt="QR Code" style="max-width: 200px; width: 100%;" />
        </div>
        <p class="bili-login-status">等待掃碼...</p>
        <button class="bili-close-btn">關閉</button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`${BILI_API}/api/bilibili/auth/poll?qrcode_key=${qrcodeKey}`);
            const data = await response.json();
            
            if (data.success && data.cookie) {
                clearInterval(pollInterval);
                
                // 保存 Cookie
                await SettingsDB.set('bilibili_cookie', data.cookie);
                await setBilibiliLoginStatus(true);
                
                modal.remove();
                createToast('✓ 登入成功！正在獲取推薦內容...');
                
                setTimeout(() => Router.navigate('/bilibili'), 500);
            } else if (data.code === 86038) {
                clearInterval(pollInterval);
                modal.querySelector('.bili-login-status').textContent = '二維碼已過期，請重新登入';
            }
        } catch (e) {
            console.error('Poll error:', e);
        }
    }, 2000);
    
    modal.querySelector('.bili-close-btn').onclick = () => {
        clearInterval(pollInterval);
        modal.remove();
    };
}

function showCookieManager() {
    const modal = createElement('div', 'bili-login-modal');
    const content = createElement('div', 'bili-login-content');
    
    content.innerHTML = `
        <h3 style="margin: 0 0 16px; font-size: 18px;">管理 Bilibili Cookie</h3>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; color: #666; margin-bottom: 8px;">
                更新 Cookie（可選）
            </label>
            <textarea 
                id="bilibili-cookie-input" 
                style="width: 100%; height: 60px; padding: 8px; border: 1px solid #ddd; border-radius: 8px; font-size: 12px; font-family: monospace;"
                placeholder="輸入新的 Cookie 以更新..."
            ></textarea>
            <button id="update-cookie-btn" style="width: 100%; margin-top: 8px; padding: 10px; background: #fb7299; color: white; border: none; border-radius: 8px; cursor: pointer;">
                更新 Cookie
            </button>
        </div>
        
        <div style="border-top: 1px solid #eee; padding-top: 16px;">
            <button id="test-cookie-btn" style="width: 100%; margin-bottom: 8px; padding: 10px; background: #4caf50; color: white; border: none; border-radius: 8px; cursor: pointer;">
                測試 Cookie 是否有效
            </button>
            <button id="logout-btn" style="width: 100%; padding: 10px; background: #f44336; color: white; border: none; border-radius: 8px; cursor: pointer;">
                登出（清除 Cookie）
            </button>
        </div>
        
        <button id="close-modal-btn" style="width: 100%; margin-top: 16px; padding: 10px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; cursor: pointer;">
            關閉
        </button>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    modal.querySelector('#update-cookie-btn').onclick = async () => {
        const cookieInput = modal.querySelector('#bilibili-cookie-input').value.trim();
        
        if (!cookieInput) {
            createToast('請輸入 Cookie');
            return;
        }
        
        await SettingsDB.set('bilibili_cookie', cookieInput);
        modal.remove();
        createToast('✓ Cookie 已更新');
    };
    
    modal.querySelector('#test-cookie-btn').onclick = async () => {
        createToast('正在測試 Cookie...');
        const videos = await fetchWithLogin();
        if (videos && videos.length > 0) {
            createToast(`✓ Cookie 有效！獲取到 ${videos.length} 部影片`);
        } else {
            createToast('✗ Cookie 無效或已過期，請重新獲取');
        }
    };
    
    modal.querySelector('#logout-btn').onclick = async () => {
        await SettingsDB.set('bilibili_cookie', '');
        await setBilibiliLoginStatus(false);
        modal.remove();
        createToast('已登出並清除 Cookie');
        Router.navigate('/bilibili');
    };
    
    modal.querySelector('#close-modal-btn').onclick = () => {
        modal.remove();
    };
}

function showLoginPrompt() {
    const modal = createElement('div', 'bili-login-modal');
    const content = createElement('div', 'bili-login-content');
    
    content.innerHTML = `
        <div style="text-align: center; margin-bottom: 20px;">
            <span class="material-symbols-outlined" style="font-size: 48px; color: #fb7299;">account_circle</span>
        </div>
        <h3 style="margin: 0 0 12px; font-size: 20px;">登入 Bilibili</h3>
        <p style="color: #999; margin: 0 0 16px; font-size: 13px; line-height: 1.6;">
            登入後可以獲取真實推薦內容
        </p>
        
        <div style="margin-bottom: 16px;">
            <label style="display: block; font-size: 12px; color: #666; margin-bottom: 8px;">
                輸入 Bilibili Cookie
            </label>
            <textarea 
                id="bilibili-cookie-input" 
                style="width: calc(100% - 16px); height: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 8px; font-size: 12px; font-family: monospace; resize: vertical;"
                placeholder="請輸入 Cookie"></textarea>
        </div>
        
        <button id="save-cookie-button" style="width: 100%; margin-bottom: 8px; padding: 12px; background: #fb7299; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
            保存 Cookie 並登入
        </button>
        
        <button id="skip-login-button" style="width: 100%; padding: 12px; background: #f5f5f5; color: #666; border: none; border-radius: 8px; cursor: pointer; font-size: 14px;">
            使用預設內容
        </button>
        
        <div style="margin-top: 16px; padding-top: 16px; border-top: 1px solid #eee;">
            <details>
                <summary style="cursor: pointer; font-size: 12px; color: #999;">如何獲取 Cookie？</summary>
                <ol style="color: #666; font-size: 11px; padding-left: 20px; margin-top: 8px; line-height: 1.8;">
                    <li>在瀏覽器打開 bilibili.com 並登入</li>
                    <li>按 F12 → Network 標籤</li>
                    <li>刷新頁面</li>
                    <li>點擊任意請求</li>
                    <li>Headers → Cookie → 複製</li>
                </ol>
            </details>
        </div>
    `;
    
    modal.appendChild(content);
    document.body.appendChild(modal);
    
    const saveBtn = modal.querySelector('#save-cookie-button');
    const skipBtn = modal.querySelector('#skip-login-button');
    const cookieInput = modal.querySelector('#bilibili-cookie-input');
    
    saveBtn.addEventListener('click', async () => {
        try {
            const cookie = cookieInput.value.trim();
            
            if (!cookie) {
                createToast('請輸入 Cookie');
                return;
            }
            
            createToast('正在保存...');
            
            await SettingsDB.set('bilibili_cookie', cookie);
            await setBilibiliLoginStatus(true);
            
            modal.remove();
            createToast('✓ 已保存 Cookie');
            
            setTimeout(() => {
                Router.navigate('/bilibili');
            }, 500);
        } catch (e) {
            console.error('Save cookie error:', e);
            createToast('保存失敗：' + e.message);
        }
    });
    
    skipBtn.addEventListener('click', () => {
        modal.remove();
    });
}

async function loadMessagesData() {
    const data = await SettingsDB.get('bilibili_messages');
    if (data) return data;
    return { notifications: [], chats: [], system: [] };
}

async function saveMessagesData(data) {
    await SettingsDB.set('bilibili_messages', data);
}

async function loadChatData() {
    const data = await SettingsDB.get('bilibili_chats');
    if (data) return data;
    return {};
}

async function saveChatData(data) {
    await SettingsDB.set('bilibili_chats', data);
}

function generateNotifications(count = 8) {
    const notifications = [];
    for (let i = 0; i < count; i++) {
        const template = randomPick(notificationTemplates);
        notifications.push({
            id: `notif_${Date.now()}_${i}`,
            type: template.type,
            icon: template.icon,
            title: template.title,
            desc: `${randomPick(['用戶', '粉絲', '觀眾', '網友'])} ${randomPick(template.templates)}`,
            time: generateRandomTime(),
            read: Math.random() > 0.3
        });
    }
    return notifications;
}

function generateSystemNotifications(count = 5) {
    const systemMessages = [
        { title: '會員提醒', desc: '你的大會員將在 7 天後到期，續費享 9 折優惠！', icon: 'workspace_premium' },
        { title: '創作激勵', desc: '本月創作激勵金已發放，共 ¥128.50', icon: 'payments' },
        { title: '活動通知', desc: '「夏日祭」活動已開始，參與贏取限定頭像框！', icon: 'card_giftcard' },
        { title: '安全提醒', desc: '你的帳號在新裝置登入，如非本人操作請修改密碼', icon: 'shield' },
        { title: '更新通知', desc: 'App 已更新至最新版本，體驗全新功能', icon: 'system_update' },
        { title: '審核通過', desc: '你投稿的影片「夏日VLOG」已通過審核', icon: 'check_circle' },
        { title: '粉絲成就', desc: '恭喜！你的粉絲數突破 1000 大關！', icon: 'groups' }
    ];
    
    return systemMessages.slice(0, count).map((msg, i) => ({
        id: `sys_${Date.now()}_${i}`,
        type: 'system',
        icon: msg.icon,
        title: msg.title,
        desc: msg.desc,
        time: generateRandomTime(),
        read: Math.random() > 0.5
    }));
}

async function loadWatchingNPCs() {
    const characters = await CharactersDB.getAll();
    
    if (characters.length === 0) {
        return [];
    }
    
    const shuffled = characters.sort(() => Math.random() - 0.5);
    const count = Math.min(shuffled.length, 3 + Math.floor(Math.random() * 6));
    
    return shuffled.slice(0, count).map(char => ({
        id: char.id,
        name: char.name || '匿名',
        avatar: char.avatar || '',
        personality: char.personality || '',
        watching: true
    }));
}

async function loadChatCharacters() {
    const characters = await CharactersDB.getAll();
    
    if (characters.length === 0) {
        return [];
    }
    
    return characters.map(char => ({
        id: char.id,
        name: char.name || '匿名',
        avatar: char.avatar || '',
        personality: char.personality || '',
        lastMessage: '點擊開始聊天',
        time: '剛剛',
        unread: 0
    }));
}

async function refreshMessages() {
    const chatUsers = await loadChatCharacters();
    const data = {
        notifications: generateNotifications(8),
        chats: chatUsers.length > 0 ? chatUsers : [],
        system: generateSystemNotifications(5)
    };
    await saveMessagesData(data);
    return data;
}

function createVideoCard(video, onPlay) {
    const card = createElement('article', 'bili-video-card');
    
    const thumb = createElement('div', 'bili-thumb');
    
    if (video.cover) {
        const img = createElement('img', '', {
            src: video.cover,
            alt: video.title,
            loading: 'lazy'
        });
        img.onerror = () => img.style.display = 'none';
        img.setAttribute('referrerpolicy', 'no-referrer');
        thumb.appendChild(img);
    } else {
        thumb.style.background = video.thumb || video.thumbGradient || generateThumbnail();
    }
    
    const tag = createElement('span', 'bili-thumb-tag', { textContent: video.tag });
    thumb.appendChild(tag);
    
    const body = createElement('div', 'bili-video-body');
    
    const title = createElement('div', 'bili-video-title', { textContent: video.title });
    body.appendChild(title);
    
    const meta = createElement('div', 'bili-video-meta');
    const views = createElement('span', '', { textContent: `▶ ${video.views}` });
    const danmu = createElement('span', '', { textContent: `💬 ${video.danmu}` });
    meta.appendChild(views);
    meta.appendChild(danmu);
    body.appendChild(meta);
    
    card.appendChild(thumb);
    card.appendChild(body);
    
    card.onclick = () => onPlay(video);
    
    return card;
}

function createEmptyFeed(onGenerate) {
    const container = createElement('div', 'bili-empty-feed');
    
    const icon = createIcon('play_circle', 'text-6xl opacity-30 text-bili-pink');
    container.appendChild(icon);
    
    const title = createElement('div', 'text-lg font-semibold', { textContent: '尚無影片內容' });
    container.appendChild(title);
    
    const desc = createElement('div', 'text-sm opacity-70', { textContent: '點擊下方按鈕生成影片' });
    container.appendChild(desc);
    
    const btn = createElement('button', 'bili-btn primary', { textContent: '生成影片' });
    btn.onclick = onGenerate;
    container.appendChild(btn);
    
    return container;
}

function createNPCSection(npcs) {
    const section = createElement('div', 'bili-npc-section');
    
    const header = createElement('div', 'bili-npc-header');
    const title = createElement('span', 'bili-npc-title');
    title.appendChild(createIcon('groups', 'text-bili-pink'));
    title.appendChild(createElement('span', '', { textContent: '正在觀看的 NPC' }));
    
    const count = createElement('span', 'bili-npc-count', { textContent: `${npcs.length} 人在看` });
    
    header.appendChild(title);
    header.appendChild(count);
    section.appendChild(header);
    
    const list = createElement('div', 'bili-npc-list');
    
    npcs.forEach(npc => {
        const item = createElement('div', 'bili-npc-item');
        const avatar = createElement('div', 'bili-npc-avatar');
        const name = createElement('span', 'bili-npc-name', { textContent: npc.name });
        item.appendChild(avatar);
        item.appendChild(name);
        list.appendChild(item);
    });
    
    section.appendChild(list);
    return section;
}

async function generateVideoContentWithAI(tab, characterId) {
    const settings = await SettingsDB.getAll();
    
    if (!settings.api_url || !settings.api_key) {
        return null;
    }
    
    const context = await buildAppContext({ characterId });
    const systemPrompt = context.systemPrompt + `\n\n你是一個影片推薦系統。根據角色性格生成適合的影片推薦。
返回格式（JSON陣列，每個影片包含title, tag, views, danmu）：
[{"title":"影片標題","tag":"分類標籤","views":"播放量","danmu":"彈幕數"}]
只返回JSON，不要其他文字。`;

    const category = randomPick(videoCategories[tab] || videoCategories.recommend);

    const userPrompt = `角色性格：${context.character?.personality || '一般用戶'}
請為這個角色生成 6-10 部${tab === 'anime' ? '動漫' : tab === 'live' ? '直播' : tab === 'hot' ? '熱門' : tab === 'games' ? '遊戲' : '推薦'}影片。`;

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.8,
                max_tokens: 1000
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) return null;
        
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return null;
        
        const videos = JSON.parse(jsonMatch[0]);
        return videos.map(v => ({
            id: `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            title: v.title || '未命名影片',
            tag: v.tag || category,
            views: v.views || randomViews(),
            danmu: v.danmu || randomDanmu(),
            thumbGradient: generateThumbnail(),
            url: ''
        }));
    } catch (e) {
        return null;
    }
}

function formatViewCount(count) {
    if (!count) return randomViews();
    if (count >= 10000) {
        return `${(count / 10000).toFixed(1)}萬`;
    }
    return `${count}`;
}

function formatDanmuCount(count) {
    if (!count) return randomDanmu();
    if (count >= 10000) {
        return `${(count / 10000).toFixed(1)}萬`;
    }
    return `${count}`;
}

function generateFallbackVideos(tab) {
    const category = randomPick(videoCategories[tab] || videoCategories.recommend);
    const count = 6 + Math.floor(Math.random() * 4);
    const videos = [];
    
    for (let i = 0; i < count; i++) {
        videos.push({
            id: `video_${Date.now()}_${i}`,
            title: `${category}精彩影片 ${i + 1}`,
            tag: category,
            views: randomViews(),
            danmu: randomDanmu(),
            thumbGradient: generateThumbnail(),
            url: ''
        });
    }
    
    return videos;
}

async function generateVideoRecommendations(tab, characterId = null) {
    console.log('從本地數據文件讀取 Bilibili 影片...');
    
    try {
        const response = await fetch('/siios/data/bilibili_videos.json');
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.videos && data.videos.length > 0) {
                console.log(`✅ 成功讀取 ${data.videos.length} 部影片`);
                console.log(`最後更新: ${data.updated_at}`);
                
                return data.videos.map(v => ({
                    id: v.bvid || `video_${Date.now()}`,
                    title: v.title || '未命名影片',
                    tag: v.tag || '影片',
                    views: formatViewCount(v.views),
                    danmu: formatDanmuCount(v.danmu),
                    thumbGradient: v.cover ? `url(${v.cover})` : generateThumbnail(),
                    url: v.bvid ? `https://www.bilibili.com/video/${v.bvid}` : '',
                    owner: v.owner,
                    duration: v.duration,
                    cover: v.cover
                }));
            }
        }
    } catch (e) {
        console.log('讀取數據文件失敗:', e.message);
    }
    
    console.log('使用預設影片列表');
    return getPresetVideos();
}

async function fetchWithLogin() {
    try {
        const savedCookie = await SettingsDB.get('bilibili_cookie');
        
        if (!savedCookie) {
            console.log('沒有保存的 Bilibili Cookie');
            return null;
        }
        
        console.log('使用保存的 Cookie 獲取數據...');
        
        // 直接調用 Bilibili API
        const response = await fetch('https://api.bilibili.com/x/web-interface/popular?ps=20', {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.bilibili.com/',
                'Cookie': savedCookie
            }
        });
        
        if (!response.ok) return null;
        
        const data = await response.json();
        
        if (data.code === 0 && data.data && data.data.list) {
            console.log('✅ 成功獲取熱門數據！');
            return formatBilibiliVideos(data.data.list);
        } else {
            console.log('API 返回錯誤:', data.message);
            return null;
        }
    } catch (e) {
        console.error('使用 Cookie 獲取失敗:', e);
    }
    
    return null;
}

function formatBilibiliVideos(list) {
    return list.map(item => ({
        id: item.bvid || `video_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        title: item.title || '未命名影片',
        tag: item.tname || '熱門',
        views: formatViewCount(item.stat?.view),
        danmu: formatDanmuCount(item.stat?.danmaku),
        thumbGradient: item.pic ? `url(${item.pic})` : generateThumbnail(),
        url: item.bvid ? `https://www.bilibili.com/video/${item.bvid}` : '',
        owner: item.owner?.name,
        duration: item.duration,
        cover: item.pic
    }));
}

function getPresetVideos() {
    const presetData = [
        { bvid: 'BV1xx411c7mD', title: '【周深】大魚', tag: '音樂' },
        { bvid: 'BV1GJ411x7h4', title: '【何同學】5G測速', tag: '科技' },
        { bvid: 'BV1uT4y1P7CX', title: '貓咪日常', tag: '生活' },
        { bvid: 'BV1vA411b7Rq', title: '遊戲實況', tag: '遊戲' },
        { bvid: 'BV1yT4y1P7CX', title: '動漫推薦', tag: '動漫' },
        { bvid: 'BV1zA411b7Rq', title: '美食製作', tag: '美食' }
    ];
    
    return presetData.map(v => ({
        id: v.bvid,
        title: v.title,
        tag: v.tag,
        views: randomViews(),
        danmu: randomDanmu(),
        thumbGradient: generateThumbnail(),
        url: `https://www.bilibili.com/video/${v.bvid}`,
        cover: null
    }));
}

async function generateNPCComments(videoTitle, characterId) {
    const settings = await SettingsDB.getAll();
    
    if (!settings.api_url || !settings.api_key) {
        return [
            { name: '匿名用戶', comment: '這影片不錯！' },
            { name: '路人甲', comment: '推推！' }
        ];
    }

    const context = await buildAppContext({ characterId });
    const systemPrompt = context.systemPrompt + `\n\n你是一個Bilibili評論生成系統。根據角色性格生成真實的評論。
返回格式（JSON陣列）：
[{"name":"評論者暱稱","comment":"評論內容"}]
只返回JSON，3-5條評論。`;

    const userPrompt = `影片標題：${videoTitle}
角色性格：${context.character?.personality || '一般用戶'}
請生成幾條符合角色風格的熱門評論。`;

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: userPrompt }
                ],
                temperature: 0.9,
                max_tokens: 500
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        const content = data.choices?.[0]?.message?.content;
        
        if (!content) return null;
        
        const jsonMatch = content.match(/\[[\s\S]*\]/);
        if (!jsonMatch) return null;
        
        return JSON.parse(jsonMatch[0]);
    } catch (e) {
        return null;
    }
}

async function generateChatResponse(chatName, characterId, messageHistory, userMessage) {
    const settings = await SettingsDB.getAll();
    
    if (!settings.api_url || !settings.api_key) {
        return randomPick(['好喔！', '了解', '收到', '哈哈', '真的嗎']);
    }

    const context = await buildAppContext({ characterId });
    const systemPrompt = context.systemPrompt + `\n\n你是一個Bilibili聊天系統中的角色。根據角色設定與用戶自然對話。
保持對話簡短、口語化，像Bilibili用戶的聊天風格。可以使用網路用語。`;

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: `你的名字是：${chatName}\n角色性格：${context.character?.personality || '一般Bilibili用戶'}` }
    ];

    messageHistory.slice(-6).forEach(msg => {
        messages.push({
            role: msg.type === 'received' ? 'assistant' : 'user',
            content: msg.text
        });
    });

    messages.push({ role: 'user', content: userMessage });

    try {
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages,
                temperature: 0.85,
                max_tokens: 100
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.choices?.[0]?.message?.content || null;
    } catch (e) {
        return null;
    }
}

async function generateVideosForTab(tab, characterId = null) {
    const finalCharId = characterId || appState.selectedCharacterId;
    const videos = await generateVideoRecommendations(tab, finalCharId);
    
    appState.sample[tab] = videos;
    await SettingsDB.set(`bilibili_${tab}_videos`, videos);
    
    return videos;
}

async function createCharacterSelector(selectedId, onChange) {
    const characters = await CharactersDB.getAll();
    
    if (characters.length === 0) return null;
    
    const container = createElement('div', 'bili-char-selector');
    const label = createElement('span', 'text-sm text-ios-muted', { textContent: '選擇角色：' });
    container.appendChild(label);
    
    const select = createElement('select', 'bili-char-select');
    
    const defaultOption = createElement('option', '', { value: '', textContent: '隨機角色' });
    if (!selectedId) defaultOption.selected = true;
    select.appendChild(defaultOption);
    
    characters.forEach(char => {
        const option = createElement('option', '', { value: char.id, textContent: char.name || '匿名' });
        if (selectedId === char.id) option.selected = true;
        select.appendChild(option);
    });
    
    select.onchange = () => {
        appState.selectedCharacterId = select.value || null;
        if (onChange) onChange(appState.selectedCharacterId);
    };
    
    container.appendChild(select);
    return container;
}

async function renderHome() {
    const container = createElement('div', 'bili-app');
    
    const isLoggedIn = await checkBilibiliLogin();
    const hasPrompted = await SettingsDB.get('bilibili_login_prompted');
    
    if (!isLoggedIn && !hasPrompted) {
        setTimeout(() => {
            showLoginPrompt();
        }, 500);
        await SettingsDB.set('bilibili_login_prompted', true);
    }
    
    if (!appState.sample[appState.currentTab] || appState.sample[appState.currentTab].length === 0) {
        const savedVideos = await SettingsDB.get(`bilibili_${appState.currentTab}_videos`);
        if (savedVideos && savedVideos.length > 0) {
            appState.sample[appState.currentTab] = savedVideos;
        }
    }
    
    const header = createIOSNavBar({
        title: 'bilibili',
        largeTitle: false,
        backPath: '/home',
        rightActions: [
            { icon: 'person', onClick: () => Router.navigate('/bilibili/profile') }
        ]
    });
    header.classList.add('bili-header');
    container.appendChild(header);
    
    const searchRow = createElement('div', 'bili-search-row');
    const searchBox = createElement('div', 'bili-search');
    searchBox.appendChild(createIcon('search', 'text-ios-muted'));
    const searchInput = createElement('input', '', { type: 'text', placeholder: '搜尋影片後按 Enter' });
    
    searchInput.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const keyword = searchInput.value.trim();
            if (keyword) {
                createToast(`正在搜尋「${keyword}」...`);
                const videos = await searchBilibiliVideos(keyword);
                
                if (videos && videos.length > 0) {
                    appState.sample[appState.currentTab] = videos;
                    await SettingsDB.set(`bilibili_${appState.currentTab}_videos`, videos);
                    createToast(`找到 ${videos.length} 部相關影片！`);
                    Router.navigate(`/bilibili/tab/${appState.currentTab}`);
                } else {
                    createToast('沒有找到相關影片，請稍後再試');
                }
            }
        }
    });
    
    searchBox.appendChild(searchInput);
    searchRow.appendChild(searchBox);
    container.appendChild(searchRow);
    
    const charSelector = await createCharacterSelector(appState.selectedCharacterId, async (charId) => {
        if (appState.sample[appState.currentTab] && appState.sample[appState.currentTab].length > 0) {
            createToast('正在重新生成影片...');
            await generateVideosForTab(appState.currentTab, charId);
            createToast('影片已更新！');
            Router.navigate(`/bilibili/tab/${appState.currentTab}`);
        }
    });
    if (charSelector) {
        container.appendChild(charSelector);
    }
    
    const tabsBar = createElement('nav', 'bili-tabs');
    const tabs = ['recommend', 'anime', 'live', 'hot', 'games'];
    const tabNames = { recommend: '推薦', anime: '番劇', live: '直播', hot: '熱門', games: '遊戲' };
    
    tabs.forEach(tab => {
        const btn = createElement('button', `bili-tab ${tab === appState.currentTab ? 'active' : ''}`, { textContent: tabNames[tab] });
        btn.onclick = async () => {
            appState.currentTab = tab;
            Router.navigate(`/bilibili/tab/${tab}`);
        };
        tabsBar.appendChild(btn);
    });
    container.appendChild(tabsBar);
    
    const feed = createElement('main', 'bili-feed');
    
    const pullRefresh = createElement('div', 'bili-pull-refresh');
    const refreshIcon = createIcon('sync', 'bili-pull-refresh-icon');
    const refreshText = createElement('span', '', { textContent: '下拉刷新' });
    pullRefresh.appendChild(refreshIcon);
    pullRefresh.appendChild(refreshText);
    feed.appendChild(pullRefresh);
    
    const feedInner = createElement('div', 'bili-feed-inner');
    
    const videos = appState.sample[appState.currentTab] || [];
    
    if (videos.length === 0) {
        feedInner.appendChild(createEmptyFeed(async () => {
            createToast('正在生成影片...');
            await generateVideosForTab(appState.currentTab, appState.selectedCharacterId);
            createToast('影片已生成！');
            Router.navigate(`/bilibili/tab/${appState.currentTab}`);
        }));
    } else {
        const videoList = createElement('section', 'bili-video-list');
        videos.forEach(video => {
            videoList.appendChild(createVideoCard(video, (v) => {
                Router.navigate(`/bilibili/player/${encodeURIComponent(v.title)}/${encodeURIComponent(v.url || '')}`);
            }));
        });
        feedInner.appendChild(videoList);
    }
    
    feed.appendChild(feedInner);
    
    let startY = 0;
    let isPulling = false;
    let isLoading = false;
    
    function startPull(clientY) {
        if (feed.scrollTop === 0 && !isLoading) {
            startY = clientY;
            isPulling = true;
        }
    }
    
    function movePull(clientY) {
        if (!isPulling || isLoading) return;
        
        const diff = clientY - startY;
        
        if (diff > 0 && feed.scrollTop === 0) {
            const pullDistance = Math.min(diff, 100);
            pullRefresh.style.transform = `translateY(${pullDistance}px)`;
            
            if (pullDistance > 60) {
                refreshText.textContent = '釋放刷新';
                pullRefresh.style.color = 'var(--bili-pink)';
            } else {
                refreshText.textContent = '下拉刷新';
                pullRefresh.style.color = 'var(--bili-muted)';
            }
        }
    }
    
    async function endPull() {
        if (!isPulling || isLoading) return;
        
        const transform = pullRefresh.style.transform;
        const match = transform.match(/translateY\((\d+)px\)/);
        const pullDistance = match ? parseInt(match[1]) : 0;
        
        if (pullDistance > 60) {
            isLoading = true;
            refreshIcon.classList.add('loading');
            refreshText.textContent = '正在刷新...';
            
            createToast('正在刷新...');
            await generateVideosForTab(appState.currentTab, appState.selectedCharacterId);
            createToast('已更新！');
            
            setTimeout(() => {
                Router.navigate(`/bilibili/tab/${appState.currentTab}`);
            }, 300);
        }
        
        pullRefresh.style.transform = 'translateY(0)';
        refreshIcon.classList.remove('loading');
        refreshText.textContent = '下拉刷新';
        pullRefresh.style.color = 'var(--bili-muted)';
        isPulling = false;
        setTimeout(() => {
            isLoading = false;
        }, 500);
    }
    
    // 手機觸摸事件
    feed.addEventListener('touchstart', (e) => {
        startPull(e.touches[0].clientY);
    }, { passive: true });
    
    feed.addEventListener('touchmove', (e) => {
        if (isPulling && feed.scrollTop === 0) {
            e.preventDefault();
        }
        movePull(e.touches[0].clientY);
    }, { passive: false });
    
    feed.addEventListener('touchend', endPull);
    
    // 電腦滑鼠事件
    feed.addEventListener('mousedown', (e) => {
        if (feed.scrollTop === 0 && !isLoading) {
            startY = e.clientY;
            isPulling = true;
            feed.style.cursor = 'grab';
        }
    });
    
    feed.addEventListener('mousemove', (e) => {
        if (!isPulling || isLoading) return;
        
        if (e.clientY - startY > 0) {
            e.preventDefault();
        }
        movePull(e.clientY);
    });
    
    feed.addEventListener('mouseup', endPull);
    
    feed.addEventListener('mouseleave', () => {
        if (isPulling && !isLoading) {
            pullRefresh.style.transform = 'translateY(0)';
            refreshIcon.classList.remove('loading');
            refreshText.textContent = '下拉刷新';
            isPulling = false;
            feed.style.cursor = '';
        }
    });
    
    container.appendChild(feed);
    
    const nav = createBiliBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

function createBiliBottomNav() {
    const nav = createElement('footer', 'bili-bottombar');
    
    const items = [
        { icon: 'home', label: '首頁', path: '/bilibili' },
        { icon: 'explore', label: '追番', path: '/bilibili/tab/anime' },
        { icon: 'add_circle', label: '', path: '/bilibili/add', isPost: true },
        { icon: 'chat_bubble', label: '訊息', path: '/bilibili/messages' },
        { icon: 'person', label: '我的', path: '/bilibili/profile' }
    ];
    
    items.forEach(item => {
        const btn = createElement('button', 'bili-nav-btn');
        
        if (item.isPost) {
            btn.classList.add('post');
        }
        
        btn.appendChild(createIcon(item.icon, 'text-xl'));
        if (item.label) {
            btn.appendChild(createElement('span', 'text-xs', { textContent: item.label }));
        }
        
        btn.onclick = () => Router.navigate(item.path);
        nav.appendChild(btn);
    });
    
    return nav;
}

async function renderPlayer(params) {
    const title = decodeURIComponent(params.title || '影片標題');
    const url = decodeURIComponent(params.url || '');
    
    const characters = await CharactersDB.getAll();
    const character = characters.length > 0 ? characters[Math.floor(Math.random() * characters.length)] : null;
    
    const container = createElement('div', 'bili-app bili-player-app');
    
    const header = createIOSNavBar({
        title: title,
        backPath: '/bilibili',
        rightActions: [
            { icon: 'more_horiz', onClick: () => {} }
        ]
    });
    container.appendChild(header);
    
    const previewCard = createElement('div', 'bili-video-preview');
    previewCard.style.background = generateThumbnail();
    previewCard.innerHTML = `
        <div class="bili-preview-content">
            <div class="bili-play-icon">▶</div>
            <div class="bili-preview-title">${title}</div>
        </div>
    `;
    container.appendChild(previewCard);
    
    const optionsCard = createElement('div', 'bili-playback-options');
    
    const externalBtn = createElement('button', 'bili-option-btn primary');
    externalBtn.innerHTML = '<span class="material-icons">open_in_new</span> 在 B 站觀看';
    externalBtn.onclick = () => openInBilibili(url);
    optionsCard.appendChild(externalBtn);
    
    const embedBtn = createElement('button', 'bili-option-btn');
    embedBtn.innerHTML = '<span class="material-icons">play_circle</span> 在 PWA 內播放';
    embedBtn.onclick = async () => {
        const isLoggedIn = await checkBilibiliLogin();
        if (isLoggedIn) {
            await playEmbed(title, url, container, character);
        } else {
            showLoginPrompt();
        }
    };
    optionsCard.appendChild(embedBtn);
    
    container.appendChild(optionsCard);
    
    return { element: container, cleanup: () => {} };
}

async function playEmbed(title, url, container, character) {
    const bvid = extractBvid(url);
    if (!bvid) {
        createToast('無效的影片連結');
        return;
    }
    
    const token = await SettingsDB.get('github_token');
    
    createToast('正在載入影片...');
    
    try {
        const infoRes = await fetch(`${BILI_API}/api/bilibili/video/info?bvid=${bvid}`);
        const info = await infoRes.json();
        
        if (info.error) {
            throw new Error(info.error);
        }
        
        const playRes = await fetch(`${BILI_API}/api/bilibili/video/playurl?bvid=${bvid}&cid=${info.cid}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const playData = await playRes.json();
        
        if (playData.error) {
            if (playData.error === 'Not logged in') {
                throw new Error('登入已過期');
            }
            throw new Error(playData.error);
        }
        
        showNativePlayer(container, info, playData, character);
    } catch (error) {
        createToast(error.message || '無法載入影片');
        if (error.message === '登入已過期') {
            startQRLogin();
        }
    }
}

function showNativePlayer(container, info, playData, character) {
    const optionsCard = container.querySelector('.bili-playback-options');
    if (optionsCard) optionsCard.remove();
    
    const previewCard = container.querySelector('.bili-video-preview');
    if (previewCard) previewCard.remove();
    
    const playerStage = createElement('div', 'bili-player-stage');
    const playerVideo = createElement('div', 'bili-player-video');
    
    if (playData.dash && playData.dash.video && playData.dash.video.length > 0) {
        const videoUrl = playData.dash.video[0].base_url;
        
        const video = createElement('video', '', {
            src: videoUrl,
            controls: true,
            autoplay: true
        });
        video.style.width = '100%';
        video.style.height = '100%';
        video.style.backgroundColor = '#000';
        playerVideo.appendChild(video);
    } else {
        const iframeUrl = convertBilibiliUrl(`https://www.bilibili.com/video/${info.bvid || ''}`);
        const iframe = createElement('iframe', '', {
            src: iframeUrl,
            allow: 'autoplay; fullscreen',
            loading: 'lazy'
        });
        playerVideo.appendChild(iframe);
    }
    
    const danmuLayer = createElement('div', 'bili-danmu-layer');
    playerVideo.appendChild(danmuLayer);
    
    playerStage.appendChild(playerVideo);
    container.insertBefore(playerStage, container.firstChild.nextSibling);
    
    const playerInfo = createElement('div', 'bili-player-info');
    
    const titleEl = createElement('div', 'font-bold', { textContent: info.title });
    playerInfo.appendChild(titleEl);
    
    const actions = createElement('div', 'bili-player-actions');
    actions.appendChild(createElement('button', 'bili-ghost-btn', { textContent: '👍 讚' }));
    actions.appendChild(createElement('button', 'bili-ghost-btn', { textContent: '⭐ 收藏' }));
    actions.appendChild(createElement('button', 'bili-ghost-btn', { textContent: '📤 分享' }));
    playerInfo.appendChild(actions);
    
    container.appendChild(playerInfo);
    
    const comments = createElement('div', 'bili-comments');
    comments.appendChild(createElement('div', 'font-bold mb-3', { textContent: '熱門留言' }));
    
    generateNPCComments(info.title, character).then(aiComments => {
        if (aiComments && aiComments.length > 0) {
            aiComments.forEach(c => {
                const comment = createElement('div', 'bili-comment');
                comment.appendChild(createElement('div', 'bili-comment-avatar'));
                const commentBody = createElement('div', '');
                commentBody.appendChild(createElement('div', 'font-semibold text-sm', { textContent: c.name }));
                commentBody.appendChild(createElement('div', 'text-ios-muted text-sm', { textContent: c.comment }));
                comment.appendChild(commentBody);
                comments.appendChild(comment);
            });
        }
    });
    
    container.appendChild(comments);
}


async function renderMessages() {
    const container = createElement('div', 'bili-app');
    
    const header = createIOSNavBar({
        title: '訊息',
        backPath: '/bilibili',
        rightActions: [
            { icon: 'refresh', onClick: async () => {
                await refreshMessages();
                createToast('已刷新');
            }}
        ]
    });
    container.appendChild(header);
    
    const tabsBar = createElement('nav', 'bili-tabs');
    const msgTabs = [
        { key: 'notifications', label: '通知' },
        { key: 'chats', label: '私訊' },
        { key: 'system', label: '系統' }
    ];
    
    msgTabs.forEach(tab => {
        const btn = createElement('button', `bili-tab ${tab.key === appState.currentMsgTab ? 'active' : ''}`, { textContent: tab.label });
        btn.onclick = () => {
            appState.currentMsgTab = tab.key;
            Router.navigate(`/bilibili/messages/${tab.key}`);
        };
        tabsBar.appendChild(btn);
    });
    container.appendChild(tabsBar);
    
    const content = createElement('main', 'bili-messages-content');
    
    const messagesData = await loadMessagesData();
    let items = [];
    
    switch (appState.currentMsgTab) {
        case 'notifications':
            items = messagesData.notifications || generateNotifications(8);
            break;
        case 'chats':
            items = messagesData.chats || generateChatUsers(6);
            break;
        case 'system':
            items = messagesData.system || generateSystemNotifications(5);
            break;
    }
    
    if (items.length === 0) {
        const empty = createElement('div', 'text-center py-12 text-ios-muted');
        empty.appendChild(createIcon('notifications', 'text-5xl opacity-50'));
        empty.appendChild(createElement('div', 'mt-2', { textContent: '暫無訊息' }));
        content.appendChild(empty);
    } else {
        if (appState.currentMsgTab === 'chats') {
            items.forEach(chat => {
                const cell = createElement('div', 'bili-message-item');
                
                const avatar = createElement('div', 'bili-message-avatar');
                cell.appendChild(avatar);
                
                const info = createElement('div', 'bili-message-info');
                info.appendChild(createElement('div', 'font-semibold', { textContent: chat.name }));
                info.appendChild(createElement('div', 'text-ios-muted text-sm truncate', { textContent: chat.lastMessage }));
                cell.appendChild(info);
                
                const meta = createElement('div', 'bili-message-meta');
                meta.appendChild(createElement('div', 'text-xs text-ios-muted', { textContent: chat.time }));
                if (chat.unread > 0) {
                    meta.appendChild(createElement('div', 'bili-badge', { textContent: chat.unread }));
                }
                cell.appendChild(meta);
                
                cell.onclick = () => Router.navigate(`/bilibili/chat/${chat.id}/${encodeURIComponent(chat.name)}`);
                content.appendChild(cell);
            });
        } else {
            items.forEach(notif => {
                const cell = createElement('div', 'bili-notification-item');
                
                const iconBadge = createElement('div', 'bili-notification-icon');
                iconBadge.appendChild(createIcon(notif.icon, 'text-white'));
                cell.appendChild(iconBadge);
                
                const info = createElement('div', 'flex-1');
                info.appendChild(createElement('div', 'font-semibold', { textContent: notif.title }));
                info.appendChild(createElement('div', 'text-ios-muted text-sm', { textContent: notif.desc }));
                cell.appendChild(info);
                
                cell.appendChild(createElement('div', 'text-xs text-ios-muted', { textContent: notif.time }));
                content.appendChild(cell);
            });
        }
    }
    
    container.appendChild(content);
    
    const nav = createBiliBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

async function renderChat(params) {
    const chatId = params.id;
    const chatName = decodeURIComponent(params.name || '聊天');
    
    const character = await CharactersDB.getById(chatId);
    const characterId = chatId;
    
    const container = createElement('div', 'bili-app bili-chat-app');
    
    const header = createIOSNavBar({
        title: chatName,
        backPath: '/bilibili/messages/chats'
    });
    container.appendChild(header);
    
    const messages = createElement('div', 'bili-chat-messages');
    
    appState.chatData = await loadChatData();
    if (!appState.chatData[chatId]) {
        appState.chatData[chatId] = [];
        await saveChatData(appState.chatData);
    }
    
    const chatHistory = appState.chatData[chatId];
    chatHistory.forEach(msg => {
        const bubble = createElement('div', `bili-chat-bubble ${msg.type}`);
        bubble.appendChild(createElement('div', '', { textContent: msg.text }));
        bubble.appendChild(createElement('div', 'bili-chat-bubble-time', { textContent: msg.time }));
        messages.appendChild(bubble);
    });
    
    container.appendChild(messages);
    
    const inputRow = createElement('div', 'bili-chat-input-row');
    const input = createElement('input', 'bili-chat-input', { type: 'text', placeholder: '輸入訊息...' });
    const sendBtn = createElement('button', 'bili-chat-send-btn');
    sendBtn.appendChild(createIcon('send', 'text-white'));
    
    sendBtn.onclick = async () => {
        const text = input.value.trim();
        if (!text) return;
        
        const userMsg = {
            id: `msg_${Date.now()}`,
            type: 'sent',
            text,
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
        };
        
        appState.chatData[chatId].push(userMsg);
        await saveChatData(appState.chatData);
        
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;
        
        const aiResponse = await generateChatResponse(chatName, characterId, appState.chatData[chatId], text);
        
        const aiMsg = {
            id: `msg_${Date.now()}_ai`,
            type: 'received',
            text: aiResponse || '好的，收到！',
            time: new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })
        };
        
        appState.chatData[chatId].push(aiMsg);
        await saveChatData(appState.chatData);
        
        input.disabled = false;
        sendBtn.disabled = false;
        
        Router.navigate(`/bilibili/chat/${chatId}/${encodeURIComponent(chatName)}`);
    };
    
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendBtn.click();
    });
    
    inputRow.appendChild(input);
    inputRow.appendChild(sendBtn);
    container.appendChild(inputRow);
    
    return { element: container, cleanup: () => {} };
}

async function renderProfile() {
    const container = createElement('div', 'bili-app');
    
    const isLoggedIn = await checkBilibiliLogin();
    
    const header = createIOSNavBar({
        title: '我的',
        backPath: '/bilibili',
        rightActions: [
            { icon: 'settings', onClick: () => Router.navigate('/settings') }
        ]
    });
    container.appendChild(header);
    
    const profile = createElement('div', 'bili-profile');
    
    const headerCard = createElement('div', 'bili-profile-header');
    const avatar = createElement('div', 'bili-profile-avatar');
    const info = createElement('div', 'bili-profile-info');
    info.appendChild(createElement('div', 'font-bold text-lg', { textContent: isLoggedIn ? 'Bilibili 用戶' : '訪客用戶' }));
    info.appendChild(createElement('div', 'text-ios-muted text-sm', { textContent: isLoggedIn ? '已登入 · 獲取真實推薦' : '未登入 · 使用預設內容' }));
    headerCard.appendChild(avatar);
    headerCard.appendChild(info);
    
    const loginBtn = createElement('button', 'bili-ghost-btn', { textContent: isLoggedIn ? '管理 Cookie' : '登入' });
    loginBtn.onclick = async () => {
        if (isLoggedIn) {
            showCookieManager();
        } else {
            showLoginPrompt();
        }
    };
    headerCard.appendChild(loginBtn);
    profile.appendChild(headerCard);
    
    const stats = createElement('div', 'bili-profile-stats');
    stats.innerHTML = `
        <div><span class="font-bold">128</span><small>關注</small></div>
        <div><span class="font-bold">3.2萬</span><small>粉絲</small></div>
        <div><span class="font-bold">56</span><small>動態</small></div>
    `;
    profile.appendChild(stats);
    
    const card1 = createElement('div', 'bili-card');
    card1.appendChild(createElement('div', 'font-semibold mb-2', { textContent: '常用功能' }));
    const grid1 = createElement('div', 'bili-grid');
    ['歷史紀錄', '我的收藏', '離線快取', '稍後再看'].forEach(label => {
        grid1.appendChild(createElement('button', 'bili-grid-btn', { textContent: label }));
    });
    card1.appendChild(grid1);
    profile.appendChild(card1);
    
    const loginStatusCard = createElement('div', 'bili-card');
    loginStatusCard.appendChild(createElement('div', 'font-semibold mb-2', { textContent: '帳號狀態' }));
    
    const loginStatusInfo = createElement('div', 'text-sm mb-2');
    loginStatusInfo.style.color = isLoggedIn ? '#4caf50' : '#999';
    loginStatusInfo.textContent = isLoggedIn ? '✓ 已登入 - 可獲取真實推薦內容' : '✗ 未登入 - 使用預設內容';
    loginStatusCard.appendChild(loginStatusInfo);
    
    const resetBtn = createElement('button', 'bili-grid-btn');
    resetBtn.textContent = '重置登入狀態（測試用）';
    resetBtn.style.marginTop = '8px';
    resetBtn.onclick = async () => {
        await SettingsDB.set('bilibili_logged_in', false);
        await SettingsDB.set('bilibili_login_prompted', false);
        createToast('已重置，重新載入後將顯示登入彈窗');
        setTimeout(() => Router.navigate('/bilibili'), 1000);
    };
    loginStatusCard.appendChild(resetBtn);
    
    profile.appendChild(loginStatusCard);
    
    const card2 = createElement('div', 'bili-card');
    card2.appendChild(createElement('div', 'font-semibold mb-2', { textContent: '創作中心' }));
    const grid2 = createElement('div', 'bili-grid');
    ['投稿', '直播中心', '草稿箱', '收益'].forEach(label => {
        grid2.appendChild(createElement('button', 'bili-grid-btn', { textContent: label }));
    });
    card2.appendChild(grid2);
    profile.appendChild(card2);
    
    container.appendChild(profile);
    
    const nav = createBiliBottomNav();
    container.appendChild(nav);
    
    return { element: container, cleanup: () => {} };
}

export default {
    id: 'bilibili',
    name: 'Bilibili',
    icon: 'play_circle',
    routes: [
        { path: '/bilibili', render: renderHome },
        { path: '/bilibili/tab/:tab', render: async (params) => {
            appState.currentTab = params.tab;
            return renderHome();
        }},
        { path: '/bilibili/player/:title/:url', render: renderPlayer },
        { path: '/bilibili/messages', render: () => {
            appState.currentMsgTab = 'notifications';
            return renderMessages();
        }},
        { path: '/bilibili/messages/:tab', render: async (params) => {
            appState.currentMsgTab = params.tab;
            return renderMessages();
        }},
        { path: '/bilibili/chat/:id/:name', render: renderChat },
        { path: '/bilibili/profile', render: renderProfile }
    ],
    navItem: {
        label: 'Bilibili',
        icon: 'play_circle',
        path: '/bilibili',
        showInNav: true,
        order: 5
    },
    stylesPath: 'js/apps/bilibili/style.css'
};
