import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';

const aiPostStarters = ['今天練習結束了', '剛剛彩排回來', '想來打個招呼', '晚安前留個訊息'];
const aiPostClosers = ['你們今天也辛苦了', '等等見', '記得吃飯', '我會再來'];

let groups = [];
let activeGroupId = '';
let isArtistMode = false;
let joinedGroupIds = [];
let viewerSettings = { selectedGroupId: '', aiSourceType: 'all', selectedCharacterId: '' };
let saveTimer = null;
let pendingAvatarImageData = '';

async function loadSettings() {
    const settingsData = await SettingsDB.get('weverse_settings');
    if (settingsData) {
        viewerSettings = { ...viewerSettings, ...settingsData.viewerSettings };
        if (Array.isArray(settingsData.groups)) groups = settingsData.groups;
    }
    const groupsData = await SettingsDB.get('weverse_groups');
    if (Array.isArray(groupsData)) groups = groupsData;
    const joinedData = await SettingsDB.get('weverse_joined');
    if (Array.isArray(joinedData)) joinedGroupIds = joinedData;
}

async function saveSettings() {
    const snapshot = {
        version: 1,
        savedAt: new Date().toISOString(),
        viewerSettings,
        groups: groups.map(g => ({
            id: g.id,
            name: g.name,
            bio: g.bio,
            type: g.type,
            artistProfile: g.artistProfile || { name: g.name + ' Official', bio: '', members: [], aiSourceType: 'all' },
            posts: g.posts || [],
            stories: g.stories || []
        }))
    };
    await SettingsDB.set('weverse_settings', snapshot);
    await SettingsDB.set('weverse_groups', groups);
    await SettingsDB.set('weverse_joined', joinedGroupIds);
}

function scheduleSettingsSave() {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => saveSettings(), 260);
}

function formatCompact(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return Math.round(num / 100) / 10 + 'K';
    return String(num);
}

function randomFrom(list) {
    return list[Math.floor(Math.random() * list.length)];
}

async function generateContentWithAI(context, characterId = null) {
    try {
        const settings = await APIClient.getSettings();
        if (!settings.api_url || !settings.api_key) {
            return null;
        }

        const appContext = await buildAppContext({
            characterId: characterId,
            userMessage: context
        });

        const messages = [
            { role: 'system', content: appContext.systemPrompt },
            { role: 'user', content: context }
        ];

        const response = await fetch(settings.api_url + '/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + settings.api_key
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages,
                temperature: 0.9,
                max_tokens: 150
            })
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (error) {
        console.error('AI generation error:', error);
        if (window.showError) {
            window.showError({
                title: 'Weverse AI 生成錯誤',
                message: error.message,
                details: error.stack || ''
            });
        }
        return null;
    }
}
async function generateArtistPost(group) {
    const starter = randomFrom(aiPostStarters);
    const closer = randomFrom(aiPostClosers);
    
    ensureArtistProfile(group);
    const members = group.artistProfile?.members || [];
    const memberNames = members.length > 0 ? members.map(m => m.name).join('、') : group.name;

    const context = '請為' + memberNames + '生成一則與粉絲分享的貼文，以'' + starter + ''開頭，以'' + closer + ''結尾。內容要親切自然，像是藝人跟粉絲打招呼。';

    const characterId = viewerSettings.selectedCharacterId || null;
    const aiContent = await generateContentWithAI(context, characterId);
    
    if (aiContent) {
        return aiContent;
    }

    return starter + '！' + randomFrom(['今天天氣不錯', '有個小驚喜想跟你們分享', '想跟你們說說話']) + '。' + closer + ' ??';
}

async function generateFanReply(group) {
    const fanTemplates = [
        '永遠支持你們！加油 ??',
        '太棒了！期待下一次見面 ?',
        '辛苦了！要好好休息喔 ??',
        '最喜歡你們了！永遠愛你們 ??',
        '超級期待的！一定會支持到底 ??'
    ];

    const context = '作為' + group.name + '的粉絲，請生成一句熱情友善的留言，表達對藝人的支持與喜愛。';

    const characterId = viewerSettings.selectedCharacterId || null;
    const aiContent = await generateContentWithAI(context, characterId);
    
    if (aiContent) {
        return aiContent;
    }

    return randomFrom(fanTemplates);
}

async function generateStoryContent(group) {
    ensureArtistProfile(group);
    const members = group.artistProfile?.members || [];
    const memberName = members.length > 0 ? randomFrom(members).name : group.name;

    const context = '請為' + memberName + '生成一則限時動態的簡短文字（20字以內），像是日常生活的分享。';

    const characterId = viewerSettings.selectedCharacterId || null;
    const aiContent = await generateContentWithAI(context, characterId);
    
    if (aiContent) {
        return aiContent.substring(0, 50);
    }

    const storyTemplates = [
        '今天的天氣 ??',
        '練習中 ??',
        '早上好！',
        '晚安 ??',
        '小吃貨模式 ??'
    ];

    return randomFrom(storyTemplates);
}
function getActiveGroup() {
    return groups.find(g => g.id === activeGroupId) || null;
}

function ensureArtistProfile(group) {
    if (!group.artistProfile) group.artistProfile = { name: group.name + ' Official', bio: '', members: [] };
    if (!Array.isArray(group.artistProfile.members)) group.artistProfile.members = [];
}

function joinGroup(groupId) {
    if (!joinedGroupIds.includes(groupId)) {
        joinedGroupIds.push(groupId);
        scheduleSettingsSave();
    }
}

function leaveGroup(groupId) {
    joinedGroupIds = joinedGroupIds.filter(id => id !== groupId);
    scheduleSettingsSave();
}

function isGroupJoined(groupId) {
    return joinedGroupIds.includes(groupId);
}

function createArtistGroup(name, type, bio) {
    const newGroup = {
        id: 'artist-' + Date.now(),
        name: name.trim(),
        type: type || 'K-POP',
        bio: bio.trim() || name + ' 的官方社群',
        members: 0,
        online: 0,
        artistProfile: { name: name + ' Official', bio: '', members: [] },
        stories: [],
        posts: []
    };
    groups.push(newGroup);
    scheduleSettingsSave();
    return newGroup;
}

function deleteArtistGroup(groupId) {
    groups = groups.filter(g => g.id !== groupId);
    if (activeGroupId === groupId) activeGroupId = '';
    scheduleSettingsSave();
}

function renderGroupList() {
    const groupListEl = createElement('div', 'group-list card');
    if (isArtistMode) {
        if (activeGroupId) {
            const group = getActiveGroup();
            groupListEl.innerHTML = "`<button class=`"`group-chip back-btn`"` data-action=`"back-to-cards'><i class='fas fa-chevron-left'></i> 返回列表</button><button class='group-chip active'>' + (group?.name || '') + '</button>';
        } else {
            groupListEl.innerHTML = '';
        }
    } else {
        const joinedGroups = groups.filter(g => joinedGroupIds.includes(g.id));
        if (joinedGroups.length === 0) {
            groupListEl.innerHTML = "`<button class=`"`group-chip explore-btn`"` data-action=`"explore'>探索社群</button>';
        } else {
            groupListEl.innerHTML = joinedGroups.map(g => '<button class='group-chip ' + (g.id === activeGroupId ? 'active' : '') + '' data-group-id='' + g.id + ''>' + g.name + '</button>').join('') + '<button class='group-chip explore-btn' data-action='explore'>+ 探索</button>';
        }
    }
    return groupListEl;
}
function renderStories(group) {
    const storyStripEl = createElement('div', 'story-strip');
    ensureArtistProfile(group);
    const members = group?.artistProfile?.members || [];
    const posts = group?.posts || [];
    const storyItems = members.map(member => {
        const memberPosts = posts.filter(p => p.author && p.author.includes(member.name));
        return { id: member.id, name: member.name, avatar: member.avatar || member.name.slice(0, 2).toUpperCase(), avatarImage: member.avatarImage || '', color: member.color || 'var(--wv-accent)', hasContent: memberPosts.length > 0 };
    }).filter(s => s.hasContent);
    if (storyItems.length === 0) {
        [{ id: 'default-1', name: '官方', avatar: '官', color: 'var(--wv-accent)' }, { id: 'default-2', name: '成員', avatar: '成', color: '#f09433' }].forEach(story => {
            const item = createElement('article', 'story-item');
            item.innerHTML = "`<span class=`"`avatar`"` style=`"background:' + story.color + ''>' + story.avatar + '</span><span class='name'>' + story.name + '</span>';
            storyStripEl.appendChild(item);
        });
        return storyStripEl;
    }
    storyItems.forEach(story => {
        const item = createElement('article', 'story-item');
        item.innerHTML = "`<span class=`"`avatar `"` + (story.avatarImage ? `"has-image' : '') + '' ' + (story.avatarImage ? 'style='background-image:url(\'' + story.avatarImage + '\')'' : 'style='background:' + story.color + ''') + '>' + (story.avatarImage ? '' : story.avatar) + '</span><span class='name'>' + story.name + '</span>';
        storyStripEl.appendChild(item);
    });
    return storyStripEl;
}

function renderFeed(group) {
    const feedEl = createElement('div', 'feed');
    if (!isArtistMode && !isGroupJoined(group.id)) {
        feedEl.innerHTML = "`<div class=`"`join-prompt`"`><p>加入此社群後才能查看發文內容</p><button class=`"join-group-btn' data-group-id='' + group.id + ''>加入社群</button></div>';
        return feedEl;
    }
    if (!group.posts || group.posts.length === 0) {
        feedEl.innerHTML = "`<div class=`"`empty-feed`"`><p>目前還沒有發文</p></div>`";
        return feedEl;
    }
    group.posts.forEach(post => {
        const article = createElement('article', 'post');
        article.innerHTML = "`<div class=`"`post-head`"`><span>`" + post.author + '</span><span>' + post.time + '</span></div><div class='post-text'>' + post.text + '</div><div class='post-actions'><span>讚 ' + formatCompact(post.likes || 0) + '</span><span>留言 ' + formatCompact(post.comments || 0) + '</span></div>';
        feedEl.appendChild(article);
    });
    return feedEl;
}

function renderHeroCover(group) {
    const heroCover = createElement('div', 'hero-cover card');
    const rolePill = isArtistMode ? '<span class='role-pill'>Artist Mode</span>' : '<span class='role-pill'>Fan Mode</span>';
    if (!group) {
        if (isArtistMode) heroCover.innerHTML = "`<h2>藝人工作台</h2><p>建立並管理你的團體社群</p><div class=`"`hero-meta`"`></div>`";
        else if (joinedGroupIds.length === 0) heroCover.innerHTML = "`<h2>尚未加入社群</h2><p>探索並加入你喜歡的藝人社群，開始追蹤他們的動態！</p><div class=`"`hero-meta`"`></div>`";
        return heroCover;
    }
    heroCover.innerHTML = '<h2>' + group.name + ' ' + rolePill + '</h2><p>' + group.bio + '</p><span class='type-badge'>' + group.type + '</span><div class='hero-meta'><span>' + formatCompact(group.members || 0) + ' 成員</span><span>' + formatCompact(group.online || 0) + ' 在線</span></div>';
    return heroCover;
}

function renderComposer() {
    const composer = createElement('div', 'composer card');
    composer.innerHTML = '<input type='text' id='post-input' placeholder='' + (isArtistMode ? '以藝人身分向粉絲發文...' : '在社群裡發布貼文...') + ''><button id='post-btn'>' + (isArtistMode ? '官方發布' : '發布') + '</button>';
    return composer;
}
function renderArtistGroupCards() {
    const container = createElement('div', 'artist-group-cards');
    if (groups.length === 0) {
        container.innerHTML = "`<div class=`"`artist-empty-state`"`><p>尚未建立任何團體</p><button class=`"primary-btn' id='create-artist-group-btn'>建立新團體</button></div>';
        return container;
    }
    groups.forEach(group => {
        const card = createElement('article', 'artist-group-card');
        card.dataset.groupId = group.id;
        card.innerHTML = "`<button class=`"`delete-group-btn`"` data-group-id=`"' + group.id + ''><i class='fas fa-trash'></i></button><div class='artist-card-header'><span class='artist-card-type'>' + group.type + '</span><h4>' + group.name + '</h4></div><p class='artist-card-bio'>' + group.bio + '</p><div class='artist-card-meta'><span>' + formatCompact(group.members || 0) + ' 成員</span><span>' + formatCompact(group.online || 0) + ' 在線</span></div><div class='artist-card-members'>' + (group.artistProfile?.members?.length > 0 ? '已設定 ' + group.artistProfile.members.length + ' 位成員' : '尚未設定成員') + '</div>';
        container.appendChild(card);
    });
    const createBtn = createElement('button', 'secondary-btn create-group-btn');
    createBtn.id = 'create-artist-group-btn';
    createBtn.innerHTML = "`<i class=`"`fas fa-plus`"`></i> 建立新團體`";
    container.appendChild(createBtn);
    return container;
}

function renderExploreGroupsPage(onClose) {
    const page = createElement('div', 'explore-groups-page');
    page.innerHTML = "`<header class=`"`explore-header settings-header`"`><button class=`"icon-btn' id='explore-back-btn'><i class='fas fa-chevron-left'></i></button><h3>探索社群</h3></header><main class='settings-body'><div class='explore-groups-list'></div></main>';
    const list = page.querySelector('.explore-groups-list');
    groups.forEach(group => {
        const isJoined = joinedGroupIds.includes(group.id);
        const item = createElement('article', 'explore-group-item');
        item.innerHTML = "`<div class=`"`explore-group-info`"`><h4>`" + group.name + '</h4><span class='explore-group-type'>' + group.type + '</span><p>' + group.bio + '</p><div class='explore-group-meta'><span>' + formatCompact(group.members || 0) + ' 成員</span></div></div><button class='' + (isJoined ? 'leave-btn' : 'join-btn') + '' data-group-id='' + group.id + ''>' + (isJoined ? '已加入' : '加入') + '</button>';
        list.appendChild(item);
    });
    page.querySelector('#explore-back-btn').onclick = onClose;
    return page;
}

function createCreateGroupModal(onConfirm) {
    const modal = createElement('div', 'create-group-modal');
    modal.id = 'create-group-modal';
    modal.innerHTML = "`<div class=`"`modal-content`"`><h3>建立新團體</h3><label><span>團體名稱</span><input type=`"text' id='new-group-name' placeholder='例如：LUMEN'></label><label><span>類型</span><select id='new-group-type'><option value='K-POP'>K-POP</option><option value='J-POP'>J-POP</option><option value='Band'>Band</option><option value='Solo'>Solo</option><option value='Creator'>Creator</option></select></label><label><span>簡介</span><textarea id='new-group-bio' rows='2' placeholder='輸入團體介紹'></textarea></label><div class='modal-actions'><button class='secondary-btn' id='cancel-create-group'>取消</button><button class='primary-btn' id='confirm-create-group'>建立</button></div></div>';
    modal.querySelector('#cancel-create-group').onclick = () => modal.remove();
    modal.querySelector('#confirm-create-group').onclick = () => {
        const name = modal.querySelector('#new-group-name').value.trim();
        const type = modal.querySelector('#new-group-type').value;
        const bio = modal.querySelector('#new-group-bio').value.trim();
        if (!name) { createToast('請輸入團體名稱'); return; }
        const newGroup = createArtistGroup(name, type, bio);
        modal.remove();
        onConfirm(newGroup);
    };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    return modal;
}

async function renderCharacterSelector() {
    const container = createElement('div', 'character-selector card');
    const characters = await CharactersDB.getAll();
    
    let html = '<label class='character-select-label'><span>AI 角色：</span><select id='character-select'>';
    html += '<option value=''>預設</option>';
    characters.forEach(char => {
        const selected = viewerSettings.selectedCharacterId === char.id ? ' selected' : '';
        html += '<option value='' + char.id + ''' + selected + '>' + char.name + '</option>';
    });
    html += '</select></label>';
    
    container.innerHTML = html;
    return container;
}
async function renderWeverse(params) {
    await loadSettings();
    const container = createElement('div', 'weverse-app');
    if (isArtistMode) container.classList.add('artist-mode');
    const header = createElement('header', 'wv-header');
    header.innerHTML = "`<div class=`"`brand`"`><span class=`"brand-dot'></span></div><h1>Weverse</h1><div class='header-actions'><button class='icon-btn' id='user-settings-btn' title='粉絲設定'><i class='fas fa-user-cog'></i></button><button class='icon-btn hidden' id='artist-settings-btn' title='藝人設定'><i class='fas fa-cog'></i></button><button class='icon-btn' id='role-toggle' title='切換角色'><i class='fas fa-exchange-alt'></i></button></div>';
    if (isArtistMode) { header.querySelector('#user-settings-btn').classList.add('hidden'); header.querySelector('#artist-settings-btn').classList.remove('hidden'); }
    container.appendChild(header);
    const main = createElement('main', 'wv-main');
    let currentGroup = getActiveGroup();
    if (!isArtistMode && joinedGroupIds.length > 0 && !activeGroupId) { activeGroupId = joinedGroupIds[0]; currentGroup = getActiveGroup(); }
    main.appendChild(renderGroupList());
    main.appendChild(renderHeroCover(currentGroup));
    if (isArtistMode && !activeGroupId) main.appendChild(renderArtistGroupCards());
    else if (currentGroup) { 
        main.appendChild(renderStories(currentGroup)); 
        main.appendChild(renderFeed(currentGroup)); 
        main.appendChild(renderComposer());
        const charSelector = await renderCharacterSelector();
        main.appendChild(charSelector);
    }
    container.appendChild(main);
    const renderUI = async () => {
        const newMain = createElement('main', 'wv-main');
        newMain.appendChild(renderGroupList());
        const newCurrentGroup = getActiveGroup();
        newMain.appendChild(renderHeroCover(newCurrentGroup));
        if (isArtistMode && !activeGroupId) newMain.appendChild(renderArtistGroupCards());
        else if (newCurrentGroup) { 
            newMain.appendChild(renderStories(newCurrentGroup)); 
            newMain.appendChild(renderFeed(newCurrentGroup)); 
            newMain.appendChild(renderComposer());
            const charSelector = await renderCharacterSelector();
            newMain.appendChild(charSelector);
        }
        const oldMain = container.querySelector('.wv-main');
        if (oldMain) oldMain.replaceWith(newMain);
        bindCharacterSelectEvent(container);
    };
    const bindCharacterSelectEvent = (container) => {
        const select = container.querySelector('#character-select');
        if (select) {
            select.onchange = (e) => {
                viewerSettings.selectedCharacterId = e.target.value;
                scheduleSettingsSave();
            };
        }
    };
    header.querySelector('#role-toggle').onclick = () => {
        isArtistMode = !isArtistMode;
        if (isArtistMode) { container.classList.add('artist-mode'); header.querySelector('#user-settings-btn').classList.add('hidden'); header.querySelector('#artist-settings-btn').classList.remove('hidden'); activeGroupId = ''; }
        else { container.classList.remove('artist-mode'); header.querySelector('#user-settings-btn').classList.remove('hidden'); header.querySelector('#artist-settings-btn').classList.add('hidden'); activeGroupId = joinedGroupIds.length > 0 ? joinedGroupIds[0] : ''; }
        renderUI();
    };
    container.onclick = (e) => {
        const exploreBtn = e.target.closest('[data-action='explore']');
        if (exploreBtn) { const explorePage = renderExploreGroupsPage(() => { container.classList.remove('show-explore'); explorePage.remove(); }); container.appendChild(explorePage); container.classList.add('show-explore'); return; }
        const backBtn = e.target.closest('[data-action='back-to-cards']');
        if (backBtn) { activeGroupId = ''; renderUI(); return; }
        const chip = e.target.closest('.group-chip[data-group-id]');
        if (chip) { activeGroupId = chip.dataset.groupId; renderUI(); return; }
        const joinBtn = e.target.closest('.join-group-btn, .join-btn');
        if (joinBtn) { joinGroup(joinBtn.dataset.groupId); renderUI(); return; }
        const leaveBtn = e.target.closest('.leave-btn');
        if (leaveBtn) { leaveGroup(leaveBtn.dataset.groupId); if (activeGroupId === leaveBtn.dataset.groupId) activeGroupId = joinedGroupIds[0] || ''; renderUI(); return; }
        const artistCard = e.target.closest('.artist-group-card');
        if (artistCard && isArtistMode) { activeGroupId = artistCard.dataset.groupId; renderUI(); return; }
        const createGroupBtn = e.target.closest('#create-artist-group-btn');
        if (createGroupBtn) { container.appendChild(createCreateGroupModal((newGroup) => { activeGroupId = newGroup.id; renderUI(); })); return; }
        const deleteGroupBtn = e.target.closest('.delete-group-btn');
        if (deleteGroupBtn && confirm('確定要刪除此團體嗎？')) { deleteArtistGroup(deleteGroupBtn.dataset.groupId); renderUI(); }
    };
    const addPost = async () => {
        const input = container.querySelector('#post-input');
        const text = input?.value.trim();
        if (!text || !currentGroup) return;
        ensureArtistProfile(currentGroup);
        currentGroup.posts = currentGroup.posts || [];

        let finalText = text;
        let finalAuthor = isArtistMode ? (currentGroup.artistProfile.name || currentGroup.name + ' Official') : '你';

        if (isArtistMode && viewerSettings.aiSourceType !== 'manual') {
            const aiGenerated = await generateArtistPost(currentGroup);
            if (aiGenerated) {
                finalText = aiGenerated;
            }
        } else if (!isArtistMode && viewerSettings.aiSourceType !== 'manual') {
            const aiReply = await generateFanReply(currentGroup);
            if (aiReply) {
                finalText = aiReply;
            }
        }

        currentGroup.posts.unshift({
            author: finalAuthor,
            text: finalText,
            time: '剛剛',
            likes: 0,
            comments: 0
        });
        input.value = '';
        scheduleSettingsSave();
        renderUI();
    };
    setTimeout(() => { const postBtn = container.querySelector('#post-btn'); const postInput = container.querySelector('#post-input'); if (postBtn) postBtn.onclick = addPost; if (postInput) postInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addPost(); } }; bindCharacterSelectEvent(container); }, 100);
    return { element: container, cleanup: () => { if (saveTimer) clearTimeout(saveTimer); } };
}

export default { id: 'weverse', name: 'Weverse', icon: 'groups', routes: [{ path: '/weverse', render: renderWeverse }], navItem: { label: 'Weverse', icon: 'groups', path: '/weverse', showInNav: true, order: 27 }, stylesPath: 'js/apps/weverse/style.css' };
