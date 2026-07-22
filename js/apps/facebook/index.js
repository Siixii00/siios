import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';

const STORAGE_KEYS = {
    profile: 'facebook_profile',
    posts: 'facebook_posts',
    userPosts: 'facebook_user_posts',
    saved: 'facebook_saved',
    memories: 'facebook_memories',
    friends: 'facebook_friends',
    npcFriends: 'facebook_npc_friends',
    postSettings: 'facebook_post_settings',
    communityTone: 'facebook_community_tone',
    communityFlags: 'facebook_community_flags',
    npcPersonality: 'facebook_npc_personality',
    haterProfiles: 'facebook_hater_profiles',
    enableHaters: 'facebook_enable_haters',
    reactions: 'facebook_reactions',
    comments: 'facebook_comments',
    sponsored: 'facebook_sponsored'
};

const state = {
    profile: { userName: '你', avatar: '' },
    generatedPosts: [],
    userPosts: [],
    savedPosts: [],
    postMemories: [],
    postReactions: {},
    postComments: {},
    friends: [],
    npcFriends: [],
    postSettings: {
        generateUserPosts: true,
        generateFriendPosts: true,
        generateNpcPosts: false
    },
    communitySettings: {
        tone: 'neutral',
        flags: { criticism: true, sarcasm: true, arguments: false, trolling: false },
        npcPersonality: '',
        haterProfiles: '',
        enableHaters: false
    },
    currentAccount: 'user',
    characters: []
};

const escapeHTML = (str = '') => String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

function normalizePost(post) {
    return {
        id: post?.id || `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        author: post?.author || '匿名',
        authorType: post?.authorType || 'user',
        time: post?.time || '剛剛',
        text: post?.text || '',
        visibility: post?.visibility || 'public',
        stats: {
            like: Number(post?.stats?.like || 0),
            comment: Number(post?.stats?.comment || 0),
            share: Number(post?.stats?.share || 0)
        }
    };
}

async function loadData(key, fallback = null) {
    try {
        const data = await SettingsDB.get(key);
        return data ?? fallback;
    } catch {
        return fallback;
    }
}

async function saveData(key, value) {
    try {
        await SettingsDB.set(key, value);
    } catch (e) {
        console.error('Save failed:', e);
    }
}

async function loadAllData() {
    state.profile = await loadData(STORAGE_KEYS.profile, { userName: '你', avatar: '' });
    state.generatedPosts = (await loadData(STORAGE_KEYS.posts, [])).map(normalizePost);
    state.userPosts = (await loadData(STORAGE_KEYS.userPosts, [])).map(normalizePost);
    state.savedPosts = await loadData(STORAGE_KEYS.saved, []);
    state.postMemories = await loadData(STORAGE_KEYS.memories, []);
    state.friends = await loadData(STORAGE_KEYS.friends, []);
    state.npcFriends = await loadData(STORAGE_KEYS.npcFriends, []);
    state.postSettings = { ...state.postSettings, ...await loadData(STORAGE_KEYS.postSettings, {}) };
    state.communitySettings.tone = await loadData(STORAGE_KEYS.communityTone, 'neutral');
    state.communitySettings.flags = await loadData(STORAGE_KEYS.communityFlags, { criticism: true, sarcasm: true, arguments: false, trolling: false });
    state.communitySettings.npcPersonality = await loadData(STORAGE_KEYS.npcPersonality, '');
    state.communitySettings.haterProfiles = await loadData(STORAGE_KEYS.haterProfiles, '');
    state.communitySettings.enableHaters = await loadData(STORAGE_KEYS.enableHaters, false);
    state.postReactions = await loadData(STORAGE_KEYS.reactions, {});
    state.postComments = await loadData(STORAGE_KEYS.comments, {});
    
    try {
        state.characters = await CharactersDB.getAll();
    } catch {
        state.characters = [];
    }
}

async function saveFacebookData() {
    await saveData(STORAGE_KEYS.profile, state.profile);
    await saveData(STORAGE_KEYS.posts, state.generatedPosts);
    await saveData(STORAGE_KEYS.userPosts, state.userPosts);
    await saveData(STORAGE_KEYS.saved, state.savedPosts);
    await saveData(STORAGE_KEYS.memories, state.postMemories);
    await saveData(STORAGE_KEYS.friends, state.friends);
    await saveData(STORAGE_KEYS.npcFriends, state.npcFriends);
    await saveData(STORAGE_KEYS.postSettings, state.postSettings);
    await saveData(STORAGE_KEYS.communityTone, state.communitySettings.tone);
    await saveData(STORAGE_KEYS.communityFlags, state.communitySettings.flags);
    await saveData(STORAGE_KEYS.npcPersonality, state.communitySettings.npcPersonality);
    await saveData(STORAGE_KEYS.haterProfiles, state.communitySettings.haterProfiles);
    await saveData(STORAGE_KEYS.enableHaters, state.communitySettings.enableHaters);
    await saveData(STORAGE_KEYS.reactions, state.postReactions);
    await saveData(STORAGE_KEYS.comments, state.postComments);
}

function getAccountInfo(accountValue) {
    if (accountValue === 'user') {
        return {
            name: state.profile.userName || '你',
            avatar: state.profile.avatar || '',
            type: 'user'
        };
    }
    
    const char = state.characters.find(c => c.name === accountValue);
    if (char) {
        return {
            name: char.name,
            avatar: char.avatar || '',
            type: 'friend'
        };
    }
    
    return { name: accountValue, avatar: '', type: 'friend' };
}

function getCurrentPostingAccount(selectEl) {
    return selectEl?.value || state.currentAccount;
}

function getReactionIcon(reaction) {
    const icons = {
        like: 'thumbs-up',
        love: 'heart',
        care: 'hand-holding-heart',
        haha: 'laugh-squint',
        wow: 'surprise',
        sad: 'sad-tear',
        angry: 'angry'
    };
    return icons[reaction] || 'thumbs-up';
}

function renderReactionSummary(counts) {
    let html = '<div class="reaction-icons">';
    if (counts.like > 0) html += '<span class="reaction-icon like"><i class="fas fa-thumbs-up"></i></span>';
    if (counts.love > 0) html += '<span class="reaction-icon love"><i class="fas fa-heart"></i></span>';
    if (counts.care > 0) html += '<span class="reaction-icon care"><i class="fas fa-hand-holding-heart"></i></span>';
    if (counts.haha > 0) html += '<span class="reaction-icon haha"><i class="fas fa-laugh-squint"></i></span>';
    if (counts.wow > 0) html += '<span class="reaction-icon wow"><i class="fas fa-surprise"></i></span>';
    if (counts.sad > 0) html += '<span class="reaction-icon sad"><i class="fas fa-sad-tear"></i></span>';
    if (counts.angry > 0) html += '<span class="reaction-icon angry"><i class="fas fa-angry"></i></span>';
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    html += `<span class="reaction-count">${total}</span></div>`;
    return html;
}

function renderComments(comments) {
    if (!comments || comments.length === 0) return '';
    return comments.slice(-10).map(c => `
        <div class="comment-item">
            <div class="comment-author">${escapeHTML(c.author)}</div>
            <div class="comment-text">${escapeHTML(c.text)}</div>
            <div class="comment-time">${escapeHTML(c.time || '剛剛')}</div>
        </div>
    `).join('');
}

function getCommunityContext() {
    const tone = state.communitySettings.tone;
    const flags = state.communitySettings.flags;
    
    const toneMap = {
        friendly: '社群氛圍友善溫和，大多數用戶禮貌互動',
        neutral: '社群氛圍中立正常，混合各種態度',
        hostile: '社群氛圍充滿爭議，容易引發筆戰和攻擊',
        toxic: '社群氛圍惡意，會有罵人、攻擊性言論'
    };
    
    let context = `# 社群氛圍\n${toneMap[tone] || toneMap.neutral}\n`;
    
    const allowedTypes = [];
    if (flags.criticism) allowedTypes.push('批評言論');
    if (flags.sarcasm) allowedTypes.push('諷刺嘲諷');
    if (flags.arguments) allowedTypes.push('筆戰爭吵');
    if (flags.trolling) allowedTypes.push('釣魚引戰');
    
    if (allowedTypes.length > 0) {
        context += `允許的內容類型: ${allowedTypes.join('、')}\n`;
    }
    
    if (state.communitySettings.npcPersonality) {
        context += `\n# NPC 回應者個性\n${state.communitySettings.npcPersonality}\n`;
    }
    
    if (state.communitySettings.enableHaters && state.communitySettings.haterProfiles) {
        context += `\n# 負面回應者設定\n${state.communitySettings.haterProfiles}\n`;
    }
    
    return context;
}

async function generateAIPosts(container) {
    const apiUrl = await SettingsDB.get('api_url');
    const apiKey = await SettingsDB.get('api_key');
    const model = await SettingsDB.get('model') || 'gpt-3.5-turbo';
    
    if (!apiUrl) {
        createToast('尚未設定 API，請先到設定頁面配置', 'error');
        return;
    }
    
    const generateBtn = container.querySelector('#ai-generate-btn');
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
    }
    
    try {
        const authors = [];
        if (state.postSettings.generateUserPosts) {
            authors.push({ name: state.profile.userName, type: 'user' });
        }
        state.friends.forEach(friendName => {
            if (state.postSettings.generateFriendPosts) {
                authors.push({ name: friendName, type: 'friend' });
            }
        });
        state.npcFriends.forEach(npcName => {
            if (state.postSettings.generateNpcPosts) {
                authors.push({ name: npcName, type: 'npc' });
            }
        });
        
        if (authors.length === 0) {
            createToast('請至少選擇一個要生成貼文的對象', 'error');
            return;
        }
        
        const communityContext = getCommunityContext();
        const systemPrompt = `你是一位專業的社群媒體內容創作者，擅長根據角色設定創作符合人物性格的 Facebook 貼文。
請使用繁體中文撰寫。
輸出格式為 JSON: {"posts":[{"author":"","text":"","visibility":"public|friends","like":0,"comment":0,"share":0}]}

visibility 說明：
- public: 公開貼文，所有人可見
- friends: 好友限定貼文，只有好友可見

請為每個作者生成 1-2 則貼文。`;

        const contextStr = `使用者: ${JSON.stringify({ name: state.profile.userName, avatar: state.profile.avatar }, null, 2)}
角色列表: ${state.characters.map(c => c.name).join('、') || '無'}

${communityContext}

要生成貼文的作者: ${authors.map(a => a.name).join('、')}

要求：
1. 符合各角色性格和設定
2. 每則貼文 30-100 字
3. 語氣自然、有互動感
4. 好友的貼文可以設定為 friends 限制
5. 根據社群氛圍調整回應風格`;

        const endpoint = apiUrl.endsWith('/chat/completions')
            ? apiUrl
            : `${apiUrl.replace(/\/$/, '')}/chat/completions`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
            },
            body: JSON.stringify({
                model,
                temperature: 0.85,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: contextStr }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`API 錯誤 (${response.status})`);
        }

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';
        
        let parsed = null;
        try {
            parsed = JSON.parse(content);
        } catch {
            const match = content.match(/\{[\s\S]*\}/);
            if (match) parsed = JSON.parse(match[0]);
        }

        const posts = Array.isArray(parsed?.posts) ? parsed.posts : [];

        posts.forEach(p => {
            if (p.text) {
                const authorInfo = authors.find(a => a.name === p.author) || { type: 'user' };
                const post = normalizePost({
                    author: p.author || state.profile.userName,
                    authorType: authorInfo.type,
                    time: '剛剛',
                    text: p.text,
                    visibility: p.visibility || 'public',
                    stats: {
                        like: Number(p.like || Math.floor(20 + Math.random() * 100)),
                        comment: Number(p.comment || Math.floor(2 + Math.random() * 20)),
                        share: Number(p.share || Math.floor(1 + Math.random() * 10))
                    },
                    timestamp: Date.now()
                });
                state.generatedPosts.unshift(post);
            }
        });

        state.generatedPosts = state.generatedPosts.slice(0, 100);
        await saveFacebookData();
        renderPosts(container);
        
        if (posts.length > 0) {
            createToast(`已生成 ${posts.length} 則貼文`, 'success');
        } else {
            createToast('生成失敗，請稍後重試', 'error');
        }
    } catch (err) {
        createToast(`生成失敗: ${err.message}`, 'error');
    } finally {
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = '<i class="fas fa-wand-magic-sparkles"></i>';
        }
    }
}

function renderPosts(container) {
    const feedEl = container.querySelector('#feed');
    if (!feedEl) return;

    const allPosts = [...state.userPosts, ...state.generatedPosts];
    
    if (allPosts.length === 0) {
        feedEl.innerHTML = '<div class="card muted">尚無貼文，點擊右上角 AI 按鈕生成貼文</div>';
        return;
    }

    const userPosts = allPosts.filter(post => post.authorType === 'user');
    const savedPosts = allPosts.filter(post => state.savedPosts.includes(post.id));
    const otherPosts = allPosts.filter(post => post.authorType !== 'user' && !state.savedPosts.includes(post.id));
    
    const displayPosts = [...userPosts, ...savedPosts, ...otherPosts.slice(0, 50)];
    displayPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    feedEl.innerHTML = displayPosts.map(post => {
        const isUserPost = post.authorType === 'user';
        const isSaved = state.savedPosts.includes(post.id);
        const avatarStyle = isUserPost && state.profile.avatar 
            ? `style="background-image: url(${state.profile.avatar}); background-size: cover; background-position: center;"`
            : '';
        
        const visibilityIcon = post.visibility === 'friends' 
            ? '<i class="fas fa-user-friends" title="好友限定"></i>'
            : post.visibility === 'private'
            ? '<i class="fas fa-lock" title="僅自己"></i>'
            : '';

        const bookmarkIcon = isSaved 
            ? '<i class="fas fa-bookmark"></i>'
            : '<i class="far fa-bookmark"></i>';

        const reactions = state.postReactions[post.id] || {};
        const userReaction = reactions[state.currentAccount] || '';
        const reactionCounts = {
            like: Object.values(reactions).filter(r => r === 'like').length,
            love: Object.values(reactions).filter(r => r === 'love').length,
            care: Object.values(reactions).filter(r => r === 'care').length,
            haha: Object.values(reactions).filter(r => r === 'haha').length,
            wow: Object.values(reactions).filter(r => r === 'wow').length,
            sad: Object.values(reactions).filter(r => r === 'sad').length,
            angry: Object.values(reactions).filter(r => r === 'angry').length
        };
        const totalReactions = Object.values(reactionCounts).reduce((a, b) => a + b, 0);

        const comments = state.postComments[post.id] || [];
        const commentCount = comments.length;

        const reactionBtnClass = userReaction ? 'has-reaction' : '';
        const reactionIcon = userReaction 
            ? `<i class="fas fa-${getReactionIcon(userReaction)}"></i>`
            : '<i class="far fa-thumbs-up"></i>';

        return `
            <article class="post card" data-post-id="${post.id}">
                <div class="avatar-sm" ${avatarStyle}></div>
                <div class="post-content">
                    <div class="post-header">
                        <div>
                            <div class="post-author">${escapeHTML(post.author)} ${visibilityIcon}</div>
                            <div class="post-meta">${escapeHTML(post.time)}</div>
                        </div>
                        <button class="icon-btn" aria-label="更多"><i class="fas fa-ellipsis-h"></i></button>
                    </div>
                    <div class="post-body">${escapeHTML(post.text)}</div>
                    ${totalReactions > 0 ? `<div class="post-reactions-summary">${renderReactionSummary(reactionCounts)}</div>` : ''}
                    <div class="post-actions">
                        <button type="button" class="reaction-btn ${reactionBtnClass}" data-action="reaction" data-reaction="${userReaction || 'like'}">${reactionIcon}<span>${totalReactions || ''}</span></button>
                        <button type="button" data-action="comment"><i class="far fa-comment"></i><span>${commentCount}</span></button>
                        <button type="button" data-action="share"><i class="fas fa-share"></i><span>${post.stats.share}</span></button>
                        <button type="button" data-action="bookmark" data-saved="${isSaved}">${bookmarkIcon}</button>
                    </div>
                    <div class="reaction-picker hidden" data-post-id="${post.id}">
                        <button type="button" data-reaction-type="like" title="讚"><i class="fas fa-thumbs-up"></i></button>
                        <button type="button" data-reaction-type="love" title="愛心"><i class="fas fa-heart"></i></button>
                        <button type="button" data-reaction-type="care" title="關心"><i class="fas fa-hand-holding-heart"></i></button>
                        <button type="button" data-reaction-type="haha" title="哈哈"><i class="fas fa-laugh-squint"></i></button>
                        <button type="button" data-reaction-type="wow" title="哇"><i class="fas fa-surprise"></i></button>
                        <button type="button" data-reaction-type="sad" title="傷心"><i class="fas fa-sad-tear"></i></button>
                        <button type="button" data-reaction-type="angry" title="生氣"><i class="fas fa-angry"></i></button>
                    </div>
                    <div class="comments-section hidden" data-post-id="${post.id}">
                        <div class="comments-list">${renderComments(comments)}</div>
                        <div class="comment-input-row">
                            <input type="text" class="comment-input" placeholder="留言..." data-post-id="${post.id}">
                            <button class="comment-submit-btn" data-post-id="${post.id}"><i class="fas fa-paper-plane"></i></button>
                        </div>
                    </div>
                </div>
            </article>
        `;
    }).join('');
    
    bindPostEvents(container);
}

function bindPostEvents(container) {
    const feedEl = container.querySelector('#feed');
    if (!feedEl) return;

    feedEl.querySelectorAll('[data-action="reaction"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const postEl = btn.closest('.post');
            const picker = postEl?.querySelector('.reaction-picker');
            feedEl.querySelectorAll('.reaction-picker').forEach(p => {
                if (p !== picker) p.classList.add('hidden');
            });
            picker?.classList.toggle('hidden');
        });
    });

    feedEl.querySelectorAll('.reaction-picker button').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const postId = btn.closest('.reaction-picker')?.dataset.postId;
            const reactionType = btn.dataset.reactionType;
            if (!postId || !reactionType) return;
            
            if (!state.postReactions[postId]) state.postReactions[postId] = {};
            const currentReaction = state.postReactions[postId][state.currentAccount];
            if (currentReaction === reactionType) {
                delete state.postReactions[postId][state.currentAccount];
            } else {
                state.postReactions[postId][state.currentAccount] = reactionType;
            }
            await saveFacebookData();
            renderPosts(container);
        });
    });

    feedEl.querySelectorAll('[data-action="comment"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const postEl = btn.closest('.post');
            const commentsSection = postEl?.querySelector('.comments-section');
            commentsSection?.classList.toggle('hidden');
        });
    });

    feedEl.querySelectorAll('.comment-submit-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            const postId = btn.dataset.postId;
            const input = btn.closest('.comments-section')?.querySelector('.comment-input');
            const text = input?.value?.trim();
            if (!postId || !text) return;
            
            const accountSelect = container.querySelector('#account-select');
            const accountValue = getCurrentPostingAccount(accountSelect);
            const accountInfo = getAccountInfo(accountValue);
            
            if (!state.postComments[postId]) state.postComments[postId] = [];
            state.postComments[postId].push({
                id: `comment_${Date.now()}`,
                author: accountInfo.name,
                authorType: accountInfo.type,
                text,
                time: '剛剛',
                timestamp: Date.now()
            });
            await saveFacebookData();
            input.value = '';
            renderPosts(container);
        });
    });

    feedEl.querySelectorAll('.comment-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const btn = input.nextElementSibling;
                btn?.click();
            }
        });
    });

    feedEl.querySelectorAll('[data-action="share"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const postEl = btn.closest('.post');
            const postId = postEl?.dataset.postId;
            if (!postId) return;
            
            const allPosts = [...state.userPosts, ...state.generatedPosts];
            const originalPost = allPosts.find(p => p.id === postId);
            if (!originalPost) return;
            
            const accountSelect = container.querySelector('#account-select');
            const accountValue = getCurrentPostingAccount(accountSelect);
            const accountInfo = getAccountInfo(accountValue);
            
            const sharedPost = normalizePost({
                author: accountInfo.name,
                authorType: accountInfo.type,
                time: '剛剛',
                text: `${originalPost.text}\n\n—— 分享自 ${originalPost.author}`,
                visibility: 'public',
                stats: { like: 0, comment: 0, share: 0 },
                timestamp: Date.now(),
                sharedFrom: originalPost.author
            });
            
            state.userPosts.unshift(sharedPost);
            originalPost.stats.share = (originalPost.stats.share || 0) + 1;
            await saveFacebookData();
            renderPosts(container);
        });
    });

    feedEl.querySelectorAll('[data-action="bookmark"]').forEach(btn => {
        btn.addEventListener('click', async () => {
            const postEl = btn.closest('.post');
            const postId = postEl?.dataset.postId;
            if (!postId) return;
            
            const isSaved = state.savedPosts.includes(postId);
            if (isSaved) {
                state.savedPosts = state.savedPosts.filter(id => id !== postId);
                btn.innerHTML = '<i class="far fa-bookmark"></i>';
                btn.dataset.saved = 'false';
            } else {
                state.savedPosts.push(postId);
                btn.innerHTML = '<i class="fas fa-bookmark"></i>';
                btn.dataset.saved = 'true';
            }
            await saveFacebookData();
        });
    });
}

function renderSavedPosts(container) {
    const feedEl = container.querySelector('#feed');
    if (!feedEl) return;

    const allPosts = [...state.userPosts, ...state.generatedPosts];
    const savedPosts = allPosts.filter(post => state.savedPosts.includes(post.id));

    if (savedPosts.length === 0) {
        feedEl.innerHTML = '<div class="card muted">尚未儲存任何貼文</div>';
        return;
    }

    savedPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    feedEl.innerHTML = savedPosts.map(post => {
        const isUserPost = post.authorType === 'user';
        const avatarStyle = isUserPost && state.profile.avatar 
            ? `style="background-image: url(${state.profile.avatar}); background-size: cover; background-position: center;"`
            : '';
        
        const visibilityIcon = post.visibility === 'friends' 
            ? '<i class="fas fa-user-friends" title="好友限定"></i>'
            : post.visibility === 'private'
            ? '<i class="fas fa-lock" title="僅自己"></i>'
            : '';

        return `
            <article class="post card" data-post-id="${post.id}">
                <div class="avatar-sm" ${avatarStyle}></div>
                <div class="post-content">
                    <div class="post-header">
                        <div>
                            <div class="post-author">${escapeHTML(post.author)} ${visibilityIcon}</div>
                            <div class="post-meta">${escapeHTML(post.time)}</div>
                        </div>
                        <button class="icon-btn" aria-label="更多"><i class="fas fa-ellipsis-h"></i></button>
                    </div>
                    <div class="post-body">${escapeHTML(post.text)}</div>
                    <div class="post-actions">
                        <button type="button" data-action="like"><i class="far fa-thumbs-up"></i><span>${post.stats.like}</span></button>
                        <button type="button" data-action="comment"><i class="far fa-comment"></i><span>${post.stats.comment}</span></button>
                        <button type="button" data-action="share"><i class="fas fa-share"></i><span>${post.stats.share}</span></button>
                        <button type="button" data-action="bookmark" data-saved="true"><i class="fas fa-bookmark"></i></button>
                    </div>
                </div>
            </article>
        `;
    }).join('');
    
    bindPostEvents(container);
}

function updateAccountSelectors(container) {
    const accountSelect = container.querySelector('#account-select');
    if (!accountSelect) return;

    const options = [`<option value="user">${escapeHTML(state.profile.userName || '你')}</option>`];

    state.friends.forEach(friendName => {
        options.push(`<option value="${escapeHTML(friendName)}">${escapeHTML(friendName)}</option>`);
    });

    accountSelect.innerHTML = options.join('');
    accountSelect.value = state.currentAccount;

    accountSelect.addEventListener('change', () => {
        state.currentAccount = accountSelect.value;
    });
}

async function renderFacebook(params) {
    const container = createElement('div', 'app-container facebook-app');
    
    await loadAllData();
    
    container.innerHTML = `
        <header class="fb-topbar">
            <div class="topbar-left">
                <button class="ios-back-btn">
                    <i class="fas fa-chevron-left"></i> 返回
                </button>
                <div class="fb-logo">
                    <i class="fab fa-facebook-f"></i>
                </div>
            </div>
            <div class="topbar-search">
                <i class="fas fa-search"></i>
                <input type="text" placeholder="搜尋 Facebook" aria-label="搜尋 Facebook">
            </div>
            <div class="topbar-actions">
                <button class="icon-btn" id="ai-generate-btn" aria-label="AI生成貼文"><i class="fas fa-wand-magic-sparkles"></i></button>
                <button class="icon-btn" aria-label="通知"><i class="far fa-bell"></i></button>
                <button class="profile-entry-btn" id="profile-entry-btn" aria-label="個人頁面">
                    <div class="avatar-sm profile-avatar-bind"></div>
                </button>
            </div>
        </header>

        <main class="fb-layout">
            <aside class="fb-sidebar">
                <div class="sidebar-section">
                    <button class="nav-item active" data-tab="newsfeed"><div class="avatar-sm"></div><span>你的動態消息</span></button>
                    <button class="nav-item" data-tab="saved"><i class="far fa-bookmark"></i><span>已儲存</span></button>
                    <button class="nav-item" data-tab="friends"><i class="fas fa-user-friends"></i><span>朋友</span></button>
                    <button class="nav-item" data-tab="memories"><i class="fas fa-clock"></i><span>回憶</span></button>
                </div>
                <div class="sidebar-section">
                    <div class="section-title">好友 (${state.friends.length + state.npcFriends.length})</div>
                    <div class="friends-sidebar-list" id="friends-sidebar-list"></div>
                </div>
            </aside>

            <section class="fb-feed">
                <section class="composer card">
                    <div class="composer-row">
                        <div class="avatar profile-avatar-bind" id="composer-avatar"></div>
                        <textarea id="post-input" placeholder="${escapeHTML(state.profile.userName)}，想說些什麼？" readonly></textarea>
                    </div>
                </section>

                <section class="feed" id="feed"></section>
            </section>

            <aside class="fb-right">
                <div class="card contacts">
                    <div class="section-title">聯絡人</div>
                    <div id="online-friends-list"></div>
                </div>
            </aside>
        </main>
    `;

    const backBtn = container.querySelector('.ios-back-btn');
    backBtn.onclick = () => Router.navigate('/');

    const aiGenerateBtn = container.querySelector('#ai-generate-btn');
    aiGenerateBtn.onclick = () => generateAIPosts(container);

    const postInput = container.querySelector('#post-input');
    postInput.onclick = () => openComposeModal(container);

    container.querySelectorAll('.nav-item[data-tab]').forEach(btn => {
        btn.onclick = () => {
            container.querySelectorAll('.nav-item[data-tab]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            const tab = btn.dataset.tab;
            if (tab === 'saved') {
                renderSavedPosts(container);
            } else if (tab === 'friends') {
                showFriendsPage(container);
            } else if (tab === 'memories') {
                showMemoriesPage(container);
            } else {
                renderPosts(container);
            }
        };
    });

    const profileEntryBtn = container.querySelector('#profile-entry-btn');
    profileEntryBtn.onclick = () => showProfilePage(container, state.currentAccount);

    updateProfileAvatars(container);
    updateAccountSelectors(container);
    renderPosts(container);
    renderFriendsSidebar(container);
    renderOnlineFriends(container);

    return { element: container, cleanup: null };
}

function updateProfileAvatars(container) {
    const avatar = state.profile.avatar?.trim();
    container.querySelectorAll('.profile-avatar-bind').forEach((el) => {
        if (avatar) {
            el.style.backgroundImage = `url(${avatar})`;
            el.style.backgroundSize = 'cover';
            el.style.backgroundPosition = 'center';
        }
    });
}

function renderFriendsSidebar(container) {
    const friendsList = container.querySelector('#friends-sidebar-list');
    if (!friendsList) return;

    const allFriends = [...state.friends, ...state.npcFriends];
    if (allFriends.length === 0) {
        friendsList.innerHTML = '<div class="muted-text">尚未新增好友</div>';
        return;
    }

    friendsList.innerHTML = allFriends.map(name => `
        <div class="friend-item" data-friend="${escapeHTML(name)}">
            <div class="avatar-sm"></div>
            <span>${escapeHTML(name)}</span>
        </div>
    `).join('');
}

function renderOnlineFriends(container) {
    const onlineList = container.querySelector('#online-friends-list');
    if (!onlineList) return;

    const allFriends = [...state.friends, ...state.npcFriends];
    if (allFriends.length === 0) {
        onlineList.innerHTML = '<div class="muted-text">沒有線上好友</div>';
        return;
    }

    const onlineCount = Math.min(Math.floor(Math.random() * 3) + 1, allFriends.length);
    const onlineFriends = allFriends.slice(0, onlineCount);

    onlineList.innerHTML = onlineFriends.map(name => `
        <div class="contact">
            <div class="avatar-sm online"></div>
            <span>${escapeHTML(name)}</span>
        </div>
    `).join('');
}

function openComposeModal(container) {
    const existingModal = container.querySelector('.compose-modal');
    if (existingModal) {
        existingModal.classList.remove('hidden');
        const composeInput = existingModal.querySelector('#compose-input');
        if (composeInput) {
            composeInput.value = '';
            setTimeout(() => composeInput.focus(), 20);
        }
        return;
    }

    const modal = createElement('div', 'compose-modal');
    modal.innerHTML = `
        <div class="compose-sheet card">
            <div class="compose-header">
                <button class="icon-btn" id="compose-close" aria-label="關閉"><i class="fas fa-xmark"></i></button>
                <h3>建立貼文</h3>
                <button class="primary-btn" id="post-btn" type="button">發布</button>
            </div>
            <div class="composer-row">
                <div class="avatar profile-avatar-bind" id="compose-avatar"></div>
                <textarea id="compose-input" placeholder="${escapeHTML(state.profile.userName)}，想說些什麼？"></textarea>
            </div>
            <div class="composer-options">
                <div class="composer-account">
                    <label for="account-select">發文帳號：</label>
                    <select id="account-select" class="account-select">
                        <option value="user">${escapeHTML(state.profile.userName || '你')}</option>
                    </select>
                </div>
                <div class="composer-visibility">
                    <label for="compose-visibility">公開範圍：</label>
                    <select id="compose-visibility">
                        <option value="public">公開</option>
                        <option value="friends">好友限定</option>
                    </select>
                </div>
            </div>
        </div>
    `;
    
    container.appendChild(modal);
    updateProfileAvatars(container);
    updateAccountSelectors(container);
    
    const closeBtn = modal.querySelector('#compose-close');
    closeBtn.onclick = () => modal.classList.add('hidden');
    
    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add('hidden');
    };
    
    const postBtn = modal.querySelector('#post-btn');
    const composeInput = modal.querySelector('#compose-input');
    const visibilitySelect = modal.querySelector('#compose-visibility');
    
    postBtn.onclick = async () => {
        const content = composeInput?.value?.trim();
        if (!content) return;
        
        const accountSelect = modal.querySelector('#account-select');
        const accountValue = getCurrentPostingAccount(accountSelect);
        const accountInfo = getAccountInfo(accountValue);
        const visibility = visibilitySelect?.value || 'public';
        
        const post = normalizePost({
            author: accountInfo.name,
            authorType: accountInfo.type,
            time: '剛剛',
            text: content,
            visibility,
            stats: { like: 0, comment: 0, share: 0 },
            timestamp: Date.now()
        });
        
        state.userPosts.unshift(post);
        await saveFacebookData();
        composeInput.value = '';
        modal.classList.add('hidden');
        renderPosts(container);
        createToast('貼文已發布', 'success');
    };
    
    composeInput.onkeydown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            postBtn.click();
        }
    };
}

function showProfilePage(container, accountValue) {
    const feedSection = container.querySelector('.fb-feed');
    if (!feedSection) return;

    const accountInfo = getAccountInfo(accountValue);
    const name = accountInfo.name || '未知';
    const avatar = accountInfo.avatar || '';

    const allPosts = [...state.userPosts, ...state.generatedPosts];
    const userPosts = allPosts.filter(post => post.author === name);

    feedSection.innerHTML = `
        <div class="profile-page">
            <div class="profile-header card">
                <div class="profile-cover"></div>
                <div class="profile-avatar-large" ${avatar ? `style="background-image: url(${avatar});"` : ''}></div>
                <div class="profile-info">
                    <div class="profile-name">${escapeHTML(name)}</div>
                </div>
            </div>
            <div class="profile-posts-section">
                <div class="card">
                    <div class="section-title">貼文</div>
                </div>
                <div class="profile-posts-list" id="profile-posts-list"></div>
            </div>
        </div>
    `;

    const postsList = container.querySelector('#profile-posts-list');
    if (userPosts.length === 0) {
        postsList.innerHTML = '<div class="card muted">尚無貼文</div>';
    } else {
        userPosts.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        postsList.innerHTML = userPosts.map(post => {
            const isSaved = state.savedPosts.includes(post.id);
            const bookmarkIcon = isSaved ? '<i class="fas fa-bookmark"></i>' : '<i class="far fa-bookmark"></i>';
            const visibilityIcon = post.visibility === 'friends' 
                ? '<i class="fas fa-user-friends" title="好友限定"></i>'
                : '';

            const reactions = state.postReactions[post.id] || {};
            const totalReactions = Object.keys(reactions).length;

            return `
                <article class="post card" data-post-id="${post.id}">
                    <div class="avatar-sm" ${avatar ? `style="background-image: url(${avatar}); background-size: cover; background-position: center;"` : ''}></div>
                    <div class="post-content">
                        <div class="post-header">
                            <div>
                                <div class="post-author">${escapeHTML(post.author)} ${visibilityIcon}</div>
                                <div class="post-meta">${escapeHTML(post.time)}</div>
                            </div>
                        </div>
                        <div class="post-body">${escapeHTML(post.text)}</div>
                        <div class="post-actions">
                            <button type="button" data-action="like"><i class="far fa-thumbs-up"></i><span>${totalReactions || post.stats.like}</span></button>
                            <button type="button" data-action="comment"><i class="far fa-comment"></i><span>${post.stats.comment}</span></button>
                            <button type="button" data-action="bookmark" data-saved="${isSaved}">${bookmarkIcon}</button>
                        </div>
                    </div>
                </article>
            `;
        }).join('');
    }

    const backBtn = createElement('button', 'icon-btn back-to-feed');
    backBtn.innerHTML = '<i class="fas fa-chevron-left"></i>';
    backBtn.onclick = () => renderPosts(container);
    feedSection.insertBefore(backBtn, feedSection.firstChild);
}

function showFriendsPage(container) {
    const feedSection = container.querySelector('.fb-feed');
    if (!feedSection) return;

    feedSection.innerHTML = `
        <div class="friends-page card">
            <h3>好友管理</h3>
            <div class="friends-section">
                <h4>從角色新增好友</h4>
                <div class="char-friends-list" id="char-friends-list"></div>
            </div>
        </div>
    `;

    const charFriendsList = container.querySelector('#char-friends-list');
    if (state.characters.length === 0) {
        charFriendsList.innerHTML = '<div class="muted-text">尚未建立角色</div>';
        return;
    }

    charFriendsList.innerHTML = state.characters.map(char => {
        const name = char.name || '未命名';
        const isFriend = state.friends.includes(name);
        return `
            <div class="friend-select-item">
                <label>
                    <input type="checkbox" class="char-friend-check" data-char-name="${escapeHTML(name)}" ${isFriend ? 'checked' : ''}>
                    <span>${escapeHTML(name)}</span>
                </label>
            </div>
        `;
    }).join('');

    charFriendsList.querySelectorAll('.char-friend-check').forEach(async check => {
        check.onchange = async () => {
            const charName = check.dataset.charName;
            if (check.checked) {
                if (!state.friends.includes(charName)) {
                    state.friends.push(charName);
                }
            } else {
                state.friends = state.friends.filter(n => n !== charName);
            }
            await saveFacebookData();
            renderFriendsSidebar(container);
            renderOnlineFriends(container);
        };
    });
}

function showMemoriesPage(container) {
    const feedSection = container.querySelector('.fb-feed');
    if (!feedSection) return;

    if (state.postMemories.length === 0) {
        feedSection.innerHTML = '<div class="card muted">尚無回憶</div>';
        return;
    }

    feedSection.innerHTML = `
        <div class="memories-page">
            <div class="card">
                <h3>回憶</h3>
            </div>
            <div class="memories-list">
                ${state.postMemories.slice(-50).reverse().map(memory => `
                    <article class="post card">
                        <div class="avatar-sm"></div>
                        <div class="post-content">
                            <div class="post-header">
                                <div>
                                    <div class="post-author">${escapeHTML(memory.author)}</div>
                                    <div class="post-meta">${escapeHTML(memory.date || memory.time)}</div>
                                </div>
                            </div>
                            <div class="post-body">${escapeHTML(memory.text)}</div>
                        </div>
                    </article>
                `).join('')}
            </div>
        </div>
    `;
}

export default {
    id: 'facebook',
    name: '臉書',
    icon: 'facebook',
    routes: [{ path: '/facebook', render: renderFacebook }],
    navItem: { label: '臉書', icon: 'facebook', path: '/facebook', showInNav: true, order: 20 },
    styles: () => import('./style.css')
};
