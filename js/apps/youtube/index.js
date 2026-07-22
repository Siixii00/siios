import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

const thumbnailColors = [
    ['#ff6b6b', '#feca57'],
    ['#48dbfb', '#0abde3'],
    ['#ff9ff3', '#f368e0'],
    ['#54a0ff', '#2e86de'],
    ['#5f27cd', '#341f97'],
    ['#00d2d3', '#01a3a4'],
    ['#ff6b6b', '#ee5a24'],
    ['#1dd1a1', '#10ac84'],
    ['#ffeaa7', '#fdcb6e'],
    ['#dfe6e9', '#b2bec3'],
    ['#fd79a8', '#e84393'],
    ['#a29bfe', '#6c5ce7'],
    ['#fab1a0', '#e17055'],
    ['#81ecec', '#00cec9'],
    ['#74b9ff', '#0984e3']
];

const adTexts = [
    '🔥 限時優惠！立即點擊查看！',
    '🎁 獨家折扣碼：YOUTUBE2026',
    '⚡️ 熱銷商品，錯過不再！',
    '💎 VIP 會員專屬福利等你領',
    '🚀 立即下載 APP 享受更多優惠',
    '💰 賺錢秘訣大公開，點擊了解！',
    '📱 全新遊戲上線，首儲送大獎！',
    '🏥 健康保健，專家推薦！'
];

const adPopupMessages = [
    { icon: '🎉', title: '恭喜你中獎了！', text: '你是今日第 1000 位訪客，獲得特別獎勵！' },
    { icon: '⚠️', title: '警告！', text: '你的裝置可能存在風險，請立即掃描！' },
    { icon: '📱', title: '更新可用', text: '有新版本可供下載，立即更新享受新功能！' },
    { icon: '🔔', title: '提醒', text: '你有 3 則未讀通知，點擊查看詳情。' },
    { icon: '💰', title: '賺錢機會', text: '在家工作月入 10 萬！立即了解更多！' }
];

let currentFeed = [];
let currentCollections = [];
let myVideos = [];
let likedVideos = [];
let charWatchHistory = [];
let currentChip = 'all';
let pendingVideoData = null;
let currentWatchingChar = null;
let charCommentTimer = null;
let charCommentInterval = 8000;
let adTimer = null;
let adCountdown = 0;
let adShowing = false;
let uploadedThumbData = null;
let isGeneratingCharFeed = false;
let isGeneratingVideos = false;
let aiVideoGenState = { isGenerating: false, generatedVideoUrl: null, generatedPrompt: null };

function randomPick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function randomViews() {
    const values = ['1.2萬', '3.8萬', '7.6萬', '10.2萬', '18.8萬', '25.6萬', '32萬', '56萬', '102萬'];
    return randomPick(values);
}

function randomTime() {
    const values = ['剛剛', '1 小時前', '3 小時前', '6 小時前', '1 天前', '2 天前', '3 天前', '1 週前'];
    return randomPick(values);
}

function randomDuration() {
    const mins = Math.floor(Math.random() * 15) + 1;
    const secs = Math.floor(Math.random() * 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function generateThumbnail() {
    const colors = randomPick(thumbnailColors);
    const patterns = [
        `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(45deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(90deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(180deg, ${colors[0]}, ${colors[1]})`,
        `linear-gradient(225deg, ${colors[0]}, ${colors[1]})`,
        `radial-gradient(circle at 30% 30%, ${colors[0]}, ${colors[1]})`,
        `radial-gradient(circle at 70% 70%, ${colors[0]}, ${colors[1]})`,
        `conic-gradient(from 45deg, ${colors[0]}, ${colors[1]}, ${colors[0]})`
    ];
    return randomPick(patterns);
}

function parseJSON(value, fallback) {
    try { return JSON.parse(value); } catch { return fallback; }
}

async function loadAllData() {
    currentFeed = await SettingsDB.get('youtube_feed') || [];
    currentCollections = await SettingsDB.get('youtube_collections') || [];
    myVideos = await SettingsDB.get('youtube_my_videos') || [];
    likedVideos = await SettingsDB.get('youtube_liked') || [];
    charWatchHistory = await SettingsDB.get('youtube_char_watch') || [];
}

async function saveAllData() {
    await SettingsDB.set('youtube_feed', currentFeed);
    await SettingsDB.set('youtube_collections', currentCollections);
    await SettingsDB.set('youtube_my_videos', myVideos);
    await SettingsDB.set('youtube_liked', likedVideos);
    await SettingsDB.set('youtube_char_watch', charWatchHistory);
}

async function loadCharacters() {
    return await CharactersDB.getAll();
}

function renderFeed(container) {
    const feedEl = container.querySelector('.yt-feed');
    if (!feedEl) return;
    
    const filtered = currentChip === 'all' 
        ? currentFeed 
        : currentFeed.filter(v => v.tag === currentChip);
    
    if (filtered.length === 0) {
        feedEl.innerHTML = `
            <div class="yt-empty-state">
                <span class="material-symbols-outlined">play_disabled</span>
                <div class="yt-empty-state-title">尚無影片內容</div>
                <div class="yt-empty-state-desc">點擊下方按鈕讓 AI 生成符合角色興趣的影片</div>
                <button class="yt-primary-btn" data-action="ai-generate">
                    <span class="material-symbols-outlined">auto_awesome</span> AI 生成影片
                </button>
            </div>
        `;
        return;
    }
    
    feedEl.innerHTML = filtered.map(video => {
        const bgStyle = video.thumb 
            ? `background-image: url('${video.thumb}'); background-size: cover; background-position: center;`
            : `background: ${video.thumbGradient || 'linear-gradient(135deg, #2c2c2e, #1f1f21)'}`;
        return `
        <article class="yt-card" data-video-id="${video.id}">
            <div class="yt-thumb" style="${bgStyle}">
                <span class="yt-duration">${video.duration}</span>
            </div>
            <div class="yt-meta">
                <div class="yt-channel"></div>
                <div>
                    <div class="yt-title">${video.title}</div>
                    <div class="yt-info">${video.channel} · ${video.views} · ${video.time}</div>
                </div>
                <button class="yt-more" type="button" aria-label="更多" data-action="video-more">
                    <span class="material-symbols-outlined">more_vert</span>
                </button>
            </div>
        </article>
    `}).join('');
}

function renderCollections(container) {
    const list = container.querySelector('.yt-collections-list');
    if (!list) return;
    
    if (currentCollections.length === 0) {
        list.innerHTML = `
            <div class="yt-collection-empty">
                <span class="material-symbols-outlined">folder_open</span>
                <div>尚未建立收藏夾</div>
                <div style="font-size:12px;margin-top:8px;">點擊右上角 + 新增收藏夾</div>
            </div>
        `;
        return;
    }
    list.innerHTML = currentCollections.map((col, index) => `
        <div class="yt-collection-item" data-collection-index="${index}">
            <div>
                <div class="yt-collection-name">${col.name}</div>
                <div class="yt-collection-count">${col.videos.length} 部影片</div>
            </div>
            <button class="yt-collection-delete" data-action="delete-collection" data-index="${index}" aria-label="刪除">
                <span class="material-symbols-outlined">delete</span>
            </button>
        </div>
    `).join('');
}

function renderMeView(container) {
    const meName = container.querySelector('.yt-me-name');
    const meSub = container.querySelector('.yt-me-sub');
    const meAvatar = container.querySelector('.yt-me-avatar');
    const meVideosEl = container.querySelector('.yt-me-videos');
    
    const userName = 'User';
    
    if (meName) meName.textContent = userName;
    if (meSub) meSub.textContent = `@${userName.toLowerCase().replace(/\s+/g, '')}`;
    
    if (meVideosEl) {
        if (myVideos.length === 0) {
            meVideosEl.innerHTML = `<div style="color:var(--muted);font-size:12px;padding:20px;text-align:center;">尚未創建影片</div>`;
        } else {
            meVideosEl.innerHTML = myVideos.slice(0, 4).map(v => `
                <div class="yt-me-video">
                    ${v.thumb ? `<img class="yt-me-video-thumb" src="${v.thumb}" alt="">` : ''}
                    <span class="yt-me-video-duration">${v.duration}</span>
                </div>
            `).join('');
        }
    }
}

function renderSaveList(container, videoId) {
    const saveList = container.querySelector('.yt-save-list');
    if (!saveList) return;
    
    saveList.innerHTML = currentCollections.map(col => {
        const isSaved = col.videos.some(v => v.id === videoId);
        return `
            <div class="yt-save-item ${isSaved ? 'saved' : ''}" data-collection-id="${col.id}">
                <span class="yt-save-item-name">${col.name}</span>
                ${isSaved ? '<span class="material-symbols-outlined yt-save-item-check">check</span>' : ''}
            </div>
        `;
    }).join('');
}

function getCharReaction(char, video) {
    const personality = (char?.personality || '').trim();
    const background = (char?.background || '').trim();
    const title = video?.title || '這部影片';
    
    if (!personality && !background) {
        return `${title}看起來不錯呢。`;
    }
    
    const sentences = [];
    const personalityParts = personality.split(/[，,、。；;\s]+/).filter(p => p.trim());
    const bgParts = background.split(/[，,、。；;\s]+/).filter(p => p.trim());
    
    if (personalityParts.length > 0) {
        const randomTrait = personalityParts[Math.floor(Math.random() * personalityParts.length)];
        sentences.push(`以我${randomTrait}的個性來看，${title}挺有意思的。`);
    }
    
    if (bgParts.length > 0 && Math.random() > 0.5) {
        const randomBg = bgParts[Math.floor(Math.random() * bgParts.length)];
        sentences.push(`${randomBg}的我，覺得這影片很有感覺。`);
    }
    
    if (sentences.length === 0) {
        sentences.push(`${title}看起來挺有趣的。`);
    }
    
    return sentences.join(' ');
}

function getCharLiveComment(char, video) {
    const personality = (char?.personality || '').trim();
    const background = (char?.background || '').trim();
    
    if (!personality && !background) {
        return '這個影片不錯呢。';
    }
    
    const sentences = [];
    const personalityParts = personality.split(/[，,、。；;\s]+/).filter(p => p.trim());
    const bgParts = background.split(/[，,、。；;\s]+/).filter(p => p.trim());
    
    const videoKeywords = ['畫面', '內容', '音樂', '劇情', '節奏', '風格', '氛圍', '主題', '解說', '呈現'];
    const reactions = ['不錯', '有趣', '特別', '精彩', '吸引人', '有意思', '很棒', '有深度'];
    
    if (personalityParts.length > 0) {
        const randomTrait = personalityParts[Math.floor(Math.random() * personalityParts.length)];
        const randomKeyword = videoKeywords[Math.floor(Math.random() * videoKeywords.length)];
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
        sentences.push(`以我${randomTrait}的個性來看，這${randomKeyword}挺${randomReaction}的。`);
    }
    
    if (bgParts.length > 0 && Math.random() > 0.5) {
        const randomBg = bgParts[Math.floor(Math.random() * bgParts.length)];
        sentences.push(`${randomBg}的我，覺得這部分很有感覺。`);
    }
    
    if (sentences.length === 0) {
        const randomKeyword = videoKeywords[Math.floor(Math.random() * videoKeywords.length)];
        const randomReaction = reactions[Math.floor(Math.random() * reactions.length)];
        sentences.push(`這${randomKeyword}${randomReaction}呢。`);
    }
    
    return sentences.join(' ');
}

function calculateCommentInterval(char) {
    const personality = (char?.personality || '').toLowerCase();
    let baseInterval = 10000;
    
    if (personality.includes('活潑') || personality.includes('調皮') || personality.includes('開朗') || personality.includes('熱情')) {
        baseInterval = 6000;
    } else if (personality.includes('高冷') || personality.includes('冷淡') || personality.includes('酷') || personality.includes('冷靜')) {
        baseInterval = 15000;
    } else if (personality.includes('病嬌') || personality.includes('佔有') || personality.includes('嫉妒') || personality.includes('腹黑')) {
        baseInterval = 7000;
    } else if (personality.includes('溫柔') || personality.includes('體貼') || personality.includes('善良')) {
        baseInterval = 9000;
    } else if (personality.includes('激動') || personality.includes('熱血')) {
        baseInterval = 5000;
    }
    
    const variance = baseInterval * 0.3;
    return baseInterval + (Math.random() * variance * 2 - variance);
}

function showCharCommentBubble(container, text) {
    const bubble = container.querySelector('.yt-char-comment-bubble');
    const textEl = container.querySelector('.yt-char-comment-text');
    
    if (!bubble || !textEl) return;
    
    textEl.textContent = text;
    bubble.removeAttribute('hidden');
    
    setTimeout(() => {
        bubble.setAttribute('hidden', '');
    }, 4000);
}

function startCharCompanion(container, char, video) {
    const companion = container.querySelector('.yt-char-companion');
    const avatar = container.querySelector('.yt-char-companion-avatar');
    const nameEl = container.querySelector('.yt-char-companion-name');
    
    if (!companion || !char) return;
    
    if (avatar) {
        if (char.avatar) {
            avatar.style.backgroundImage = `url('${char.avatar}')`;
        } else {
            avatar.style.backgroundImage = '';
            avatar.style.background = 'linear-gradient(135deg, #667eea, #764ba2)';
        }
    }
    if (nameEl) nameEl.textContent = char.name || '角色';
    
    companion.removeAttribute('hidden');
    
    if (charCommentTimer) clearInterval(charCommentTimer);
    
    charCommentInterval = calculateCommentInterval(char);
    
    setTimeout(() => {
        const initialComment = getCharLiveComment(char, video);
        showCharCommentBubble(container, initialComment);
    }, 2000);
    
    charCommentTimer = setInterval(() => {
        if (!pendingVideoData) return;
        const comment = getCharLiveComment(char, pendingVideoData);
        showCharCommentBubble(container, comment);
        charCommentInterval = calculateCommentInterval(char);
    }, charCommentInterval);
}

function stopCharCompanion(container) {
    const companion = container.querySelector('.yt-char-companion');
    const bubble = container.querySelector('.yt-char-comment-bubble');
    
    companion?.setAttribute('hidden', '');
    bubble?.setAttribute('hidden', '');
    
    if (charCommentTimer) {
        clearInterval(charCommentTimer);
        charCommentTimer = null;
    }
}

function showAd(container) {
    const overlay = container.querySelector('.yt-ad-overlay');
    const skipBtn = container.querySelector('.yt-ad-skip-btn');
    const skipText = container.querySelector('.yt-ad-skip');
    const countdownEl = container.querySelector('.yt-ad-countdown');
    const bannerText = container.querySelector('.yt-ad-banner-text');
    const banner = container.querySelector('.yt-ad-banner');
    const progressBar = container.querySelector('.yt-ad-progress-bar');
    
    if (!overlay) return;
    
    overlay.removeAttribute('hidden');
    adShowing = true;
    
    if (bannerText) bannerText.textContent = randomPick(adTexts);
    if (banner) banner.removeAttribute('hidden');
    if (skipBtn) skipBtn.setAttribute('hidden', '');
    if (skipText) skipText.removeAttribute('hidden');
    
    adCountdown = 5 + Math.floor(Math.random() * 10);
    if (countdownEl) countdownEl.textContent = adCountdown;
    
    let progress = 0;
    const totalDuration = adCountdown * 1000;
    const progressInterval = 100;
    
    const progressTimer = setInterval(() => {
        progress += (progressInterval / totalDuration) * 100;
        if (progressBar) progressBar.style.width = `${Math.min(progress, 100)}%`;
    }, progressInterval);
    
    adTimer = setInterval(() => {
        adCountdown--;
        if (countdownEl) countdownEl.textContent = adCountdown;
        
        if (Math.random() < 0.3) {
            showAdPopup(container);
        }
        
        if (adCountdown <= 0) {
            clearInterval(adTimer);
            clearInterval(progressTimer);
            adTimer = null;
            if (skipBtn) {
                skipBtn.removeAttribute('hidden');
                skipBtn.onclick = () => skipAd(container);
            }
            if (skipText) skipText.setAttribute('hidden', '');
        }
    }, 1000);
}

function skipAd(container) {
    const overlay = container.querySelector('.yt-ad-overlay');
    if (overlay) overlay.setAttribute('hidden', '');
    adShowing = false;
    
    if (Math.random() < 0.5) {
        showAdPopup(container);
    }
}

function closeAdBanner(container) {
    const banner = container.querySelector('.yt-ad-banner');
    if (banner) banner.setAttribute('hidden', '');
}

function showAdPopup(container) {
    const existingPopup = container.querySelector('.yt-ad-popup');
    if (existingPopup) return;
    
    const msg = randomPick(adPopupMessages);
    const popup = createElement('div', 'yt-ad-popup');
    popup.innerHTML = `
        <div class="yt-ad-popup-card">
            <div class="yt-ad-popup-icon">${msg.icon}</div>
            <div class="yt-ad-popup-title">${msg.title}</div>
            <div class="yt-ad-popup-text">${msg.text}</div>
            <div class="yt-ad-popup-actions">
                <button class="yt-ad-popup-btn primary" data-action="ad-continue">繼續觀看</button>
                <button class="yt-ad-popup-btn secondary" data-action="ad-learn-more">了解更多</button>
            </div>
        </div>
    `;
    
    container.appendChild(popup);
}

function closeAdPopup(container) {
    const popup = container.querySelector('.yt-ad-popup');
    if (popup) popup.remove();
}

function updateCharWatchUI(container, char, video) {
    const nameEl = container.querySelector('.yt-char-watch-name');
    const statusEl = container.querySelector('.yt-char-watch-status');
    const avatarEl = container.querySelector('.yt-char-watch-avatar');
    
    if (char) {
        if (nameEl) nameEl.textContent = char.name || '角色';
        if (statusEl) statusEl.textContent = `正在觀看「${video?.title || '影片'}」`;
        if (avatarEl && char.avatar) {
            avatarEl.style.backgroundImage = `url('${char.avatar}')`;
            avatarEl.style.backgroundSize = 'cover';
            avatarEl.style.backgroundPosition = 'center';
        }
    } else {
        if (nameEl) nameEl.textContent = '選擇角色';
        if (statusEl) statusEl.textContent = '點擊上方選擇角色一起觀看';
        if (avatarEl) avatarEl.style.backgroundImage = '';
    }
}

function showCharReaction(container, char, video) {
    const reactionEl = container.querySelector('.yt-char-watch-reaction');
    const textEl = container.querySelector('.yt-char-reaction-text');
    const timeEl = container.querySelector('.yt-char-reaction-time');
    
    if (!char || !video) {
        reactionEl?.setAttribute('hidden', '');
        return;
    }
    
    const reaction = getCharReaction(char, video);
    if (textEl) textEl.textContent = reaction;
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });
    reactionEl?.removeAttribute('hidden');
    
    const historyEntry = {
        id: `watch_${Date.now()}`,
        charId: currentWatchingChar,
        charName: char.name,
        videoId: video.id,
        videoTitle: video.title,
        reaction,
        watchedAt: new Date().toISOString()
    };
    
    charWatchHistory.unshift(historyEntry);
    if (charWatchHistory.length > 50) {
        charWatchHistory = charWatchHistory.slice(0, 50);
    }
}

function renderCharWatchHistory(container) {
    const list = container.querySelector('.yt-char-history-list');
    if (!list) return;
    
    if (charWatchHistory.length === 0) {
        list.innerHTML = '<div class="yt-char-empty">尚無觀看紀錄</div>';
        return;
    }
    
    list.innerHTML = charWatchHistory.slice(0, 20).map(entry => `
        <div class="yt-char-history-item">
            <div class="yt-char-history-item-video">${entry.videoTitle}</div>
            <div class="yt-char-history-item-meta">
                <span><span class="material-symbols-outlined" style="font-size:14px;">person</span> ${entry.charName}</span>
                <span><span class="material-symbols-outlined" style="font-size:14px;">schedule</span> ${new Date(entry.watchedAt).toLocaleString('zh-TW', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
            </div>
            <div class="yt-char-history-item-reaction">${entry.reaction}</div>
        </div>
    `).join('');
}

function openPlayerPage(container, video) {
    pendingVideoData = video;
    container.querySelector('.yt-main')?.setAttribute('hidden', '');
    container.querySelector('.yt-player-page')?.removeAttribute('hidden');
    
    const playerTitleMain = container.querySelector('.yt-player-title-main');
    const playerSub = container.querySelector('.yt-player-sub');
    const playerChannelName = container.querySelector('.yt-player-channel-name');
    const playerDesc = container.querySelector('.yt-player-desc');
    const playerFrame = container.querySelector('#yt-player-video iframe');
    
    if (playerTitleMain) playerTitleMain.textContent = video.title;
    if (playerSub) playerSub.textContent = `${video.views} · ${video.time}`;
    if (playerChannelName) playerChannelName.textContent = video.channel;
    if (playerDesc) playerDesc.textContent = video.title;
    
    if (playerFrame && video.url) {
        playerFrame.src = video.url;
    }
    
    const likeBtn = container.querySelector('[data-action="like-video"]');
    if (likeBtn) {
        likeBtn.classList.toggle('liked', likedVideos.some(v => v.id === video.id));
    }
    
    updateCharWatchUI(container, null, video);
    container.querySelector('.yt-char-watch-reaction')?.setAttribute('hidden', '');
    
    const charWatchSelect = container.querySelector('#yt-char-watch-select');
    if (charWatchSelect) charWatchSelect.value = '';
    
    stopCharCompanion(container);
    currentWatchingChar = null;
    
    if (Math.random() < 0.8) {
        showAd(container);
    }
}

function closePlayerPage(container) {
    container.querySelector('.yt-player-page')?.setAttribute('hidden', '');
    container.querySelector('.yt-main')?.removeAttribute('hidden');
    const playerFrame = container.querySelector('#yt-player-video iframe');
    if (playerFrame) playerFrame.src = '';
    stopCharCompanion(container);
    currentWatchingChar = null;
    
    const overlay = container.querySelector('.yt-ad-overlay');
    if (overlay) overlay.setAttribute('hidden', '');
    if (adTimer) {
        clearInterval(adTimer);
        adTimer = null;
    }
    adShowing = false;
    
    closeAdPopup(container);
}

function openAddModal(container) {
    container.querySelector('.yt-add-modal')?.removeAttribute('hidden');
    const addTitleInput = container.querySelector('#add-video-title');
    const addUrlInput = container.querySelector('#add-video-url');
    const addTagSelect = container.querySelector('#add-video-tag');
    
    if (addTitleInput) addTitleInput.value = '';
    if (addUrlInput) addUrlInput.value = '';
    if (addTagSelect) addTagSelect.value = currentChip === 'all' ? 'all' : currentChip;
    uploadedThumbData = null;
    
    const addThumbPreview = container.querySelector('.yt-thumb-preview');
    if (addThumbPreview) {
        addThumbPreview.style.backgroundImage = '';
        addThumbPreview.classList.remove('has-image');
        addThumbPreview.innerHTML = '<span class="material-symbols-outlined">image</span><span>點擊上傳封面</span>';
    }
    if (addTitleInput) addTitleInput.focus();
}

function closeAddModal(container) {
    container.querySelector('.yt-add-modal')?.setAttribute('hidden', '');
    uploadedThumbData = null;
}

function handleThumbUpload(container, event) {
    const file = event.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
        createToast('請選擇圖片檔案', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        uploadedThumbData = e.target.result;
        const addThumbPreview = container.querySelector('.yt-thumb-preview');
        if (addThumbPreview) {
            addThumbPreview.style.backgroundImage = `url('${uploadedThumbData}')`;
            addThumbPreview.classList.add('has-image');
            addThumbPreview.innerHTML = '';
        }
    };
    reader.readAsDataURL(file);
}

function addVideo(container) {
    const addTitleInput = container.querySelector('#add-video-title');
    const addUrlInput = container.querySelector('#add-video-url');
    const addTagSelect = container.querySelector('#add-video-tag');
    
    const title = addTitleInput?.value?.trim() || '我的影片';
    const url = addUrlInput?.value?.trim() || '';
    const tag = addTagSelect?.value || 'all';
    
    const newVideo = {
        id: `vid_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title,
        channel: '我的頻道',
        views: '新上架',
        time: '剛剛',
        duration: randomDuration(),
        tag: tag === 'all' ? randomPick(['live', 'music', 'game', 'tech', 'diy']) : tag,
        url,
        thumb: uploadedThumbData || '',
        thumbGradient: uploadedThumbData ? '' : generateThumbnail(),
        createdAt: new Date().toISOString(),
        isMyVideo: true
    };
    
    myVideos.unshift(newVideo);
    currentFeed.unshift(newVideo);
    
    renderFeed(container);
    closeAddModal(container);
    saveAllData();
}

function openCollectionModal(container) {
    container.querySelector('.yt-collection-modal')?.removeAttribute('hidden');
    const collectionNameInput = container.querySelector('#collection-name');
    if (collectionNameInput) {
        collectionNameInput.value = '';
        collectionNameInput.focus();
    }
}

function closeCollectionModal(container) {
    container.querySelector('.yt-collection-modal')?.setAttribute('hidden', '');
}

function createCollection(container) {
    const collectionNameInput = container.querySelector('#collection-name');
    const name = collectionNameInput?.value?.trim() || '我的收藏';
    
    const newCollection = {
        id: `col_${Date.now()}`,
        name,
        videos: [],
        createdAt: new Date().toISOString()
    };
    
    currentCollections.push(newCollection);
    renderCollections(container);
    closeCollectionModal(container);
    saveAllData();
}

function deleteCollection(container, index) {
    if (index >= 0 && index < currentCollections.length) {
        currentCollections.splice(index, 1);
        renderCollections(container);
        saveAllData();
    }
}

function openSaveModal(container, videoId) {
    pendingVideoData = currentFeed.find(v => v.id === videoId) || myVideos.find(v => v.id === videoId);
    renderSaveList(container, videoId);
    container.querySelector('.yt-save-modal')?.removeAttribute('hidden');
}

function closeSaveModal(container) {
    container.querySelector('.yt-save-modal')?.setAttribute('hidden', '');
    pendingVideoData = null;
}

function toggleSaveToCollection(container, collectionId) {
    if (!pendingVideoData) return;
    
    const collection = currentCollections.find(c => c.id === collectionId);
    if (!collection) return;
    
    const existingIndex = collection.videos.findIndex(v => v.id === pendingVideoData.id);
    if (existingIndex >= 0) {
        collection.videos.splice(existingIndex, 1);
    } else {
        collection.videos.push(pendingVideoData);
    }
    
    renderSaveList(container, pendingVideoData.id);
    saveAllData();
}

function toggleLike(container) {
    if (!pendingVideoData) return;
    
    const existingIndex = likedVideos.findIndex(v => v.id === pendingVideoData.id);
    if (existingIndex >= 0) {
        likedVideos.splice(existingIndex, 1);
    } else {
        likedVideos.push(pendingVideoData);
    }
    
    const likeBtn = container.querySelector('[data-action="like-video"]');
    if (likeBtn) {
        likeBtn.classList.toggle('liked', likedVideos.some(v => v.id === pendingVideoData.id));
    }
    saveAllData();
}

function showView(container, viewName) {
    container.querySelector('.yt-main')?.setAttribute('hidden', '');
    container.querySelector('.yt-collections')?.setAttribute('hidden', '');
    container.querySelector('.yt-me-view')?.setAttribute('hidden', '');
    container.querySelector('.yt-player-page')?.setAttribute('hidden', '');
    
    if (viewName === 'home') {
        container.querySelector('.yt-main')?.removeAttribute('hidden');
    } else if (viewName === 'collections') {
        container.querySelector('.yt-collections')?.removeAttribute('hidden');
        renderCollections(container);
    } else if (viewName === 'me') {
        container.querySelector('.yt-me-view')?.removeAttribute('hidden');
        renderMeView(container);
    }
}

async function generateAIVideos(container) {
    if (isGeneratingVideos) {
        createToast('正在生成中，請稍候...', 'info');
        return;
    }
    
    isGeneratingVideos = true;
    
    try {
        const videos = [];
        for (let i = 0; i < 3; i++) {
            videos.push({
                title: `AI 生成影片 #${currentFeed.length + i + 1}`,
                channel: 'AI Studio',
                views: randomViews(),
                time: randomTime(),
                duration: randomDuration(),
                tag: currentChip === 'all' ? randomPick(['live', 'music', 'game', 'tech', 'diy']) : currentChip,
                url: '',
                thumb: '',
                thumbGradient: generateThumbnail(),
                createdAt: new Date().toISOString()
            });
        }
        
        videos.forEach((video) => {
            currentFeed.unshift({
                id: `ai-vid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                ...video
            });
        });
        
        if (videos.length > 0) {
            renderFeed(container);
            saveAllData();
            createToast(`已生成 ${videos.length} 部影片`, 'success');
        }
    } catch (err) {
        createToast(`生成失敗: ${err.message}`, 'error');
    } finally {
        isGeneratingVideos = false;
    }
}

function resetAIVideoGenModal(container) {
    container.querySelector('.yt-ai-video-gen-status')?.setAttribute('hidden', '');
    container.querySelector('.yt-ai-video-gen-form')?.removeAttribute('hidden');
    container.querySelector('.yt-ai-video-gen-preview')?.setAttribute('hidden', '');
    
    const progressBar = container.querySelector('.yt-ai-video-gen-progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    
    const startBtn = container.querySelector('#yt-start-video-gen-btn');
    if (startBtn) {
        startBtn.disabled = false;
        startBtn.innerHTML = '<span class="material-symbols-outlined">auto_awesome</span> 開始生成';
    }
    
    aiVideoGenState.isGenerating = false;
    aiVideoGenState.generatedVideoUrl = null;
    aiVideoGenState.generatedPrompt = null;
}

function openAIVideoGenModal(container) {
    resetAIVideoGenModal(container);
    container.querySelector('.yt-ai-video-gen-modal')?.removeAttribute('hidden');
}

function closeAIVideoGenModal(container) {
    container.querySelector('.yt-ai-video-gen-modal')?.setAttribute('hidden', '');
    resetAIVideoGenModal(container);
}

async function startYTAIVideoGeneration(container) {
    const promptInput = container.querySelector('#yt-ai-video-prompt');
    const prompt = promptInput?.value?.trim();
    
    if (!prompt) {
        createToast('請輸入影片描述', 'error');
        return;
    }
    
    if (aiVideoGenState.isGenerating) return;
    
    aiVideoGenState.isGenerating = true;
    aiVideoGenState.generatedPrompt = prompt;
    
    const startBtn = container.querySelector('#yt-start-video-gen-btn');
    if (startBtn) {
        startBtn.disabled = true;
        startBtn.innerHTML = '<span class="material-symbols-outlined">progress_activity</span> 生成中...';
    }
    
    container.querySelector('.yt-ai-video-gen-status')?.removeAttribute('hidden');
    container.querySelector('.yt-ai-video-gen-form')?.setAttribute('hidden', '');
    
    createToast('AI 影片生成功能需要外部 API 支援', 'info');
    
    setTimeout(() => {
        resetAIVideoGenModal(container);
    }, 2000);
}

function addYTGeneratedVideoToFeed(container) {
    if (!aiVideoGenState.generatedPrompt) {
        createToast('沒有可加入的影片', 'error');
        return;
    }
    
    const newVideo = {
        id: `ai-vid-${Date.now()}`,
        title: aiVideoGenState.generatedPrompt || 'AI 生成影片',
        channel: 'AI Studio',
        views: randomViews(),
        time: '剛剛',
        duration: '0:02',
        tag: currentChip || 'all',
        url: '',
        thumb: '',
        thumbGradient: generateThumbnail(),
        isAIGenerated: true,
        createdAt: new Date().toISOString()
    };
    
    currentFeed.unshift(newVideo);
    renderFeed(container);
    saveAllData();
    closeAIVideoGenModal(container);
}

async function renderYouTube(params) {
    const container = createElement('div', 'app-container yt-app');
    await loadAllData();
    const characters = await loadCharacters();
    
    container.innerHTML = `
        <header class="yt-topbar">
            <div class="yt-logo">
                <div class="yt-play">
                    <span class="material-symbols-outlined" style="font-size:12px;color:#fff;">play_arrow</span>
                </div>
                <span class="yt-text">YouTube</span>
            </div>
            <div class="yt-actions">
                <button class="yt-icon" data-action="ai-video-gen" title="AI 影片生成">
                    <span class="material-symbols-outlined">auto_awesome</span>
                </button>
                <button class="yt-icon" data-action="open-char-view" title="角色視角">
                    <span class="material-symbols-outlined">person</span>
                </button>
            </div>
        </header>

        <section class="yt-main">
            <div class="yt-chips">
                <select class="yt-filter-select" id="yt-filter-select">
                    <option value="all">全部</option>
                    <option value="live">直播</option>
                    <option value="music">音樂</option>
                    <option value="game">遊戲</option>
                    <option value="tech">科技</option>
                    <option value="diy">DIY</option>
                </select>
            </div>
            <div class="yt-feed"></div>
        </section>

        <section class="yt-collections" hidden>
            <header class="yt-collections-topbar">
                <button class="yt-icon" data-action="close-collections">
                    <span class="material-symbols-outlined">chevron_left</span>
                </button>
                <div class="yt-collections-title">收藏夾</div>
                <button class="yt-icon" data-action="add-collection">
                    <span class="material-symbols-outlined">add</span>
                </button>
            </header>
            <div class="yt-collections-list"></div>
        </section>

        <section class="yt-me-view" hidden>
            <header class="yt-me-topbar">
                <button class="yt-icon" data-action="close-me">
                    <span class="material-symbols-outlined">chevron_left</span>
                </button>
                <div class="yt-me-title">我的頻道</div>
                <button class="yt-icon"><span class="material-symbols-outlined">settings</span></button>
            </header>
            <div class="yt-me-header">
                <div class="yt-me-avatar"></div>
                <div>
                    <div class="yt-me-name">User</div>
                    <div class="yt-me-sub">@user</div>
                </div>
            </div>
            <div class="yt-me-stats">
                <div><span>${myVideos.length}</span><small>影片</small></div>
                <div><span>${likedVideos.length}</span><small>喜歡</small></div>
                <div><span>${currentCollections.length}</span><small>收藏</small></div>
            </div>
            <div class="yt-me-card">
                <div class="yt-me-card-title">我的影片</div>
                <div class="yt-me-videos"></div>
            </div>
        </section>

        <section class="yt-player-page" hidden>
            <header class="yt-player-topbar">
                <button class="yt-icon" data-action="close-player">
                    <span class="material-symbols-outlined">chevron_left</span>
                </button>
                <div class="yt-player-title">播放影片</div>
                <button class="yt-icon"><span class="material-symbols-outlined">more_vert</span></button>
            </header>
            <div class="yt-player-stage">
                <div class="yt-player-video" id="yt-player-video">
                    <iframe allowfullscreen></iframe>
                </div>
                <div class="yt-char-companion" hidden>
                    <div class="yt-char-companion-avatar"></div>
                    <span class="yt-char-companion-name">角色</span>
                    <button class="yt-char-companion-close" data-action="remove-companion">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="yt-char-comment-bubble" hidden>
                    <div class="yt-char-comment-text"></div>
                </div>
            </div>
            <div class="yt-ad-overlay" hidden>
                <div class="yt-ad-container">
                    <div class="yt-ad-video">
                        <div class="yt-ad-placeholder">
                            <span class="material-symbols-outlined" style="font-size:64px;">play_circle</span>
                            <span>廣告播放中</span>
                        </div>
                    </div>
                    <div class="yt-ad-info">
                        <span class="yt-ad-skip">可跳過廣告 <span class="yt-ad-countdown">5</span></span>
                        <button class="yt-ad-skip-btn" hidden data-action="skip-ad">
                            <span class="material-symbols-outlined">skip_next</span> 略過
                        </button>
                    </div>
                    <div class="yt-ad-progress">
                        <div class="yt-ad-progress-bar"></div>
                    </div>
                </div>
                <div class="yt-ad-banner" hidden>
                    <div class="yt-ad-banner-content">
                        <span class="yt-ad-banner-text">限時優惠！</span>
                        <button class="yt-ad-banner-btn" data-action="click-ad">了解詳情</button>
                    </div>
                    <button class="yt-ad-banner-close" data-action="close-ad-banner">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
            </div>
            <div class="yt-player-info">
                <div class="yt-player-meta">
                    <div class="yt-player-title-main"></div>
                    <div class="yt-player-sub"></div>
                </div>
                <div class="yt-player-actions">
                    <button class="yt-action-btn" data-action="like-video">
                        <span class="material-symbols-outlined">thumb_up</span>
                        <span>喜歡</span>
                    </button>
                    <button class="yt-action-btn" data-action="save-video">
                        <span class="material-symbols-outlined">bookmark</span>
                        <span>儲存</span>
                    </button>
                    <button class="yt-action-btn" data-action="share-video">
                        <span class="material-symbols-outlined">share</span>
                        <span>分享</span>
                    </button>
                    <button class="yt-action-btn">
                        <span class="material-symbols-outlined">download</span>
                        <span>下載</span>
                    </button>
                </div>
            </div>
            <div class="yt-char-watch-section">
                <div class="yt-char-watch-header">
                    <div class="yt-char-watch-avatar"></div>
                    <div class="yt-char-watch-info">
                        <div class="yt-char-watch-name">選擇角色</div>
                        <div class="yt-char-watch-status">點擊上方選擇角色一起觀看</div>
                    </div>
                    <select id="yt-char-watch-select">
                        <option value="">選擇角色</option>
                        ${characters.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
                    </select>
                </div>
                <div class="yt-char-watch-reaction" hidden>
                    <div class="yt-char-reaction-text"></div>
                    <div class="yt-char-reaction-time"></div>
                </div>
                <div class="yt-char-watch-actions">
                    <button class="yt-ghost-btn" data-action="char-react">
                        <span class="material-symbols-outlined">chat</span> 角色回應
                    </button>
                    <button class="yt-ghost-btn" data-action="char-watch-history">
                        <span class="material-symbols-outlined">history</span> 紀錄
                    </button>
                </div>
            </div>
            <div class="yt-player-channel">
                <div class="yt-player-channel-avatar"></div>
                <div>
                    <div class="yt-player-channel-name"></div>
                    <div class="yt-player-channel-sub">訂閱</div>
                </div>
                <button class="yt-subscribe-btn">訂閱</button>
            </div>
            <div class="yt-player-desc"></div>
        </section>

        <div class="yt-modal yt-add-modal" hidden>
            <div class="yt-modal-backdrop" data-action="close-add-modal"></div>
            <div class="yt-modal-card">
                <div class="yt-modal-header">
                    <span class="yt-modal-title">新增影片</span>
                    <button class="yt-icon small" data-action="close-add-modal">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="yt-modal-body">
                    <div class="yt-thumb-upload">
                        <div class="yt-thumb-preview" data-action="upload-thumb">
                            <span class="material-symbols-outlined">image</span>
                            <span>點擊上傳封面</span>
                        </div>
                        <input type="file" id="add-video-thumb-file" accept="image/*" hidden>
                    </div>
                    <input type="text" class="yt-text-input" id="add-video-title" placeholder="影片標題">
                    <input type="text" class="yt-text-input" id="add-video-url" placeholder="影片連結 (選填)">
                    <select id="add-video-tag">
                        <option value="all">全部</option>
                        <option value="live">直播</option>
                        <option value="music">音樂</option>
                        <option value="game">遊戲</option>
                        <option value="tech">科技</option>
                        <option value="diy">DIY</option>
                    </select>
                    <div class="yt-modal-actions">
                        <button class="yt-ghost-btn" data-action="close-add-modal">取消</button>
                        <button class="yt-primary-btn" data-action="add-video">新增</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="yt-modal yt-collection-modal" hidden>
            <div class="yt-modal-backdrop" data-action="close-collection-modal"></div>
            <div class="yt-modal-card">
                <div class="yt-modal-header">
                    <span class="yt-modal-title">新增收藏夾</span>
                    <button class="yt-icon small" data-action="close-collection-modal">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="yt-modal-body">
                    <input type="text" class="yt-text-input" id="collection-name" placeholder="收藏夾名稱">
                    <div class="yt-modal-actions">
                        <button class="yt-ghost-btn" data-action="close-collection-modal">取消</button>
                        <button class="yt-primary-btn" data-action="create-collection">建立</button>
                    </div>
                </div>
            </div>
        </div>

        <div class="yt-modal yt-save-modal" hidden>
            <div class="yt-modal-backdrop" data-action="close-save-modal"></div>
            <div class="yt-modal-card">
                <div class="yt-modal-header">
                    <span class="yt-modal-title">儲存到收藏夾</span>
                    <button class="yt-icon small" data-action="close-save-modal">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="yt-modal-body">
                    <div class="yt-save-list"></div>
                </div>
            </div>
        </div>

        <div class="yt-modal yt-ai-video-gen-modal" hidden>
            <div class="yt-modal-backdrop" data-action="close-ai-video-gen"></div>
            <div class="yt-modal-card yt-ai-video-gen-modal-card">
                <div class="yt-modal-header">
                    <span class="yt-modal-title">AI 影片生成</span>
                    <button class="yt-icon small" data-action="close-ai-video-gen">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="yt-modal-body">
                    <div class="yt-ai-video-gen-form">
                        <textarea class="yt-text-input yt-ai-video-textarea" id="yt-ai-video-prompt" placeholder="描述你想生成的影片內容..."></textarea>
                        <div class="yt-ai-video-advanced-toggle">
                            <button class="yt-ghost-btn" data-action="toggle-advanced">
                                進階選項 <span class="material-symbols-outlined">expand_more</span>
                            </button>
                        </div>
                        <div class="yt-ai-video-advanced-options" hidden id="yt-ai-video-advanced-options">
                            <div class="yt-modal-row">
                                <span class="yt-modal-label">長度</span>
                                <input type="range" id="yt-ai-video-duration" min="1" max="10" step="0.5" value="2">
                                <span class="yt-ai-video-range-value" id="yt-ai-video-duration-value">2s</span>
                            </div>
                            <div class="yt-modal-row">
                                <span class="yt-modal-label">寬度</span>
                                <input type="range" id="yt-ai-video-width" min="256" max="1024" step="64" value="704">
                                <span class="yt-ai-video-range-value" id="yt-ai-video-width-value">704</span>
                            </div>
                        </div>
                        <div class="yt-modal-actions">
                            <button class="yt-primary-btn" id="yt-start-video-gen-btn" data-action="start-video-gen">
                                <span class="material-symbols-outlined">auto_awesome</span> 開始生成
                            </button>
                        </div>
                    </div>
                    <div class="yt-ai-video-gen-status" hidden>
                        <div class="yt-ai-video-gen-progress">
                            <div class="yt-ai-video-gen-progress-bar"></div>
                        </div>
                        <div class="yt-ai-video-gen-message">準備中...</div>
                    </div>
                    <div class="yt-ai-video-gen-preview" hidden>
                        <video id="yt-ai-video-preview-player" controls></video>
                        <div class="yt-ai-video-gen-preview-actions">
                            <button class="yt-ghost-btn" data-action="download-video">
                                <span class="material-symbols-outlined">download</span> 下載
                            </button>
                            <button class="yt-primary-btn" data-action="add-to-feed">
                                <span class="material-symbols-outlined">add</span> 加入影片庫
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <nav class="yt-tabbar">
            <button class="tab active" data-view="home">
                <span class="material-symbols-outlined">home</span>
                <span>首頁</span>
            </button>
            <button class="tab" data-action="open-add-modal">
                <div class="tab-plus">+</div>
            </button>
            <button class="tab" data-view="collections">
                <span class="material-symbols-outlined">folder</span>
                <span>收藏</span>
            </button>
            <button class="tab" data-view="me">
                <span class="material-symbols-outlined">person</span>
                <span>我的</span>
            </button>
        </nav>
    `;
    
    renderFeed(container);
    renderCollections(container);
    
    const filterSelect = container.querySelector('#yt-filter-select');
    filterSelect?.addEventListener('change', () => {
        currentChip = filterSelect.value;
        renderFeed(container);
    });
    
    container.querySelectorAll('.tab[data-view]').forEach(tab => {
        tab.addEventListener('click', () => {
            const view = tab.dataset.view;
            container.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            showView(container, view);
        });
    });
    
    container.querySelector('.yt-feed')?.addEventListener('click', event => {
        const card = event.target.closest('.yt-card');
        const moreBtn = event.target.closest('[data-action="video-more"]');
        
        if (moreBtn && card) {
            const videoId = card.dataset.videoId;
            const video = currentFeed.find(v => v.id === videoId);
            if (video) openSaveModal(container, videoId);
            return;
        }
        
        if (card) {
            const videoId = card.dataset.videoId;
            const video = currentFeed.find(v => v.id === videoId);
            if (video) {
                if (video.url || video.videoUrl) {
                    openPlayerPage(container, video);
                } else {
                    createToast('此影片尚未設定連結', 'info');
                }
            }
        }
    });
    
    container.querySelector('.yt-collections-list')?.addEventListener('click', event => {
        const deleteBtn = event.target.closest('[data-action="delete-collection"]');
        if (deleteBtn) {
            event.stopPropagation();
            const index = parseInt(deleteBtn.dataset.index, 10);
            deleteCollection(container, index);
            return;
        }
        
        const item = event.target.closest('.yt-collection-item');
        if (item) {
            const index = parseInt(item.dataset.collectionIndex, 10);
            const collection = currentCollections[index];
            if (collection && collection.videos.length > 0) {
                currentFeed = collection.videos;
                showView(container, 'home');
                renderFeed(container);
            }
        }
    });
    
    container.querySelector('.yt-save-list')?.addEventListener('click', event => {
        const item = event.target.closest('.yt-save-item');
        if (item) {
            const collectionId = item.dataset.collectionId;
            toggleSaveToCollection(container, collectionId);
        }
    });
    
    const charWatchSelectEl = container.querySelector('#yt-char-watch-select');
    charWatchSelectEl?.addEventListener('change', async () => {
        const charId = charWatchSelectEl.value;
        if (charId === '') {
            currentWatchingChar = null;
            updateCharWatchUI(container, null, pendingVideoData);
            container.querySelector('.yt-char-watch-reaction')?.setAttribute('hidden', '');
            stopCharCompanion(container);
        } else {
            const char = characters.find(c => c.id === charId);
            currentWatchingChar = charId;
            updateCharWatchUI(container, char, pendingVideoData);
            if (char && pendingVideoData) {
                startCharCompanion(container, char, pendingVideoData);
            }
        }
    });
    
    const addThumbFileInput = container.querySelector('#add-video-thumb-file');
    addThumbFileInput?.addEventListener('change', (e) => handleThumbUpload(container, e));
    
    container.querySelector('.yt-thumb-preview')?.addEventListener('click', () => {
        addThumbFileInput?.click();
    });
    
    container.addEventListener('click', async (event) => {
        const target = event.target.closest('[data-action]');
        if (!target) return;
        
        const action = target.dataset.action;
        
        switch (action) {
            case 'open-add-modal':
                openAddModal(container);
                break;
            case 'close-add-modal':
                closeAddModal(container);
                break;
            case 'add-video':
                addVideo(container);
                break;
            case 'upload-thumb':
                addThumbFileInput?.click();
                break;
            case 'add-collection':
                openCollectionModal(container);
                break;
            case 'close-collection-modal':
                closeCollectionModal(container);
                break;
            case 'create-collection':
                createCollection(container);
                break;
            case 'close-save-modal':
                closeSaveModal(container);
                break;
            case 'close-collections':
                showView(container, 'home');
                break;
            case 'close-me':
                showView(container, 'home');
                break;
            case 'close-player':
                closePlayerPage(container);
                break;
            case 'like-video':
                toggleLike(container);
                break;
            case 'save-video':
                if (pendingVideoData) openSaveModal(container, pendingVideoData.id);
                break;
            case 'char-react':
                if (currentWatchingChar && pendingVideoData) {
                    const char = characters.find(c => c.id === currentWatchingChar);
                    if (char) showCharReaction(container, char, pendingVideoData);
                }
                break;
            case 'char-watch-history':
                renderCharWatchHistory(container);
                break;
            case 'remove-companion':
                stopCharCompanion(container);
                if (charWatchSelectEl) charWatchSelectEl.value = '';
                currentWatchingChar = null;
                updateCharWatchUI(container, null, pendingVideoData);
                break;
            case 'skip-ad':
                skipAd(container);
                break;
            case 'close-ad-banner':
                closeAdBanner(container);
                break;
            case 'click-ad':
                showAdPopup(container);
                break;
            case 'ad-continue':
                closeAdPopup(container);
                break;
            case 'ad-learn-more':
                closeAdPopup(container);
                showAd(container);
                break;
            case 'ai-generate':
                await generateAIVideos(container);
                break;
            case 'open-char-view':
                createToast('角色視角功能已整合至播放器', 'info');
                break;
            case 'ai-video-gen':
                openAIVideoGenModal(container);
                break;
            case 'close-ai-video-gen':
                closeAIVideoGenModal(container);
                break;
            case 'toggle-advanced':
                const advOpts = container.querySelector('#yt-ai-video-advanced-options');
                if (advOpts) advOpts.hidden = !advOpts.hidden;
                break;
            case 'start-video-gen':
                await startYTAIVideoGeneration(container);
                break;
            case 'download-video':
                createToast('下載功能需要外部 API 支援', 'info');
                break;
            case 'add-to-feed':
                addYTGeneratedVideoToFeed(container);
                break;
        }
    });
    
    container.querySelectorAll('input[type="range"]').forEach(input => {
        input.addEventListener('input', (e) => {
            const id = e.target.id;
            const value = e.target.value;
            const suffix = id.includes('duration') ? 's' : '';
            const displayId = id + '-value';
            const display = container.querySelector(`#${displayId}`);
            if (display) display.textContent = value + suffix;
        });
    });
    
    return { 
        element: container, 
        cleanup: () => { 
            stopCharCompanion(container);
            if (adTimer) clearInterval(adTimer);
        } 
    };
}

export default {
    id: 'youtube',
    name: 'YouTube',
    icon: 'play_circle',
    routes: [{ path: '/youtube', render: renderYouTube }],
    navItem: { label: 'YouTube', icon: 'play_circle', path: '/youtube', showInNav: true, order: 25 },
    styles: () => import('./style.css')
};
