import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, CharactersDB } from '../../db.js';
import APIClient from '../../api.js';

const aiPostStarters = ['隞予蝺渡?蝯?鈭?, '??敶拇???', '?喃?????, '????????];
const aiPostClosers = ['雿?憭拐?颲鈭?, '蝑?閬?, '閮??ㄞ', '????'];

let groups = [];
let activeGroupId = '';
let isArtistMode = false;
let joinedGroupIds = [];
let viewerSettings = { selectedGroupId: '', aiSourceType: 'all' };
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

        let personality = '';
        let characterName = '';
        if (characterId) {
            const character = await CharactersDB.getById(characterId);
            if (character) {
                personality = character.personality || '';
                characterName = character.name || '';
            }
        }

        const systemPrompt = personality 
            ? `雿${characterName}??{personality}\n\n隢誑${characterName}?澈???摰對?靽?閫?寞扯?憸冽?
            : '雿銝????蝎結嚗?甇∟??犖鈭????????望???蝯脩?閮??;

        const messages = [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: context }
        ];

        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
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
        return null;
    }
}

async function generateArtistPost(group) {
    const starter = randomFrom(aiPostStarters);
    const closer = randomFrom(aiPostClosers);
    
    ensureArtistProfile(group);
    const members = group.artistProfile?.members || [];
    const memberNames = members.length > 0 ? members.map(m => m.name).join('??) : group.name;

    const context = `隢${memberNames}??銝??蝎結?澈?票??隞?${starter}"?嚗誑"${closer}"蝯偏?摰寡?閬芸??芰嚗??航?鈭箄?蝎結???潦;

    const aiContent = await generateContentWithAI(context, null);
    
    if (aiContent) {
        return aiContent;
    }

    return `${starter}嚗?{randomFrom(['隞予憭拇除銝', '??撽??唾?雿?鈭?, '?唾?雿牧隤芾店'])}??{closer} ??`;
}

async function generateFanReply(group) {
    const fanTemplates = [
        '瘞賊??舀?雿??硃 ?',
        '憭芣?鈭???銝?甈∟?????,
        '颲鈭?閬末憟賭??臬? ?弘',
        '??迭雿?嚗偶??雿???',
        '頞?????銝摰??舀??啣? ??'
    ];

    const context = `雿${group.name}??蝯莎?隢????亦??????嚗”???犖??????;

    const aiContent = await generateContentWithAI(context, null);
    
    if (aiContent) {
        return aiContent;
    }

    return randomFrom(fanTemplates);
}

async function generateStoryContent(group) {
    ensureArtistProfile(group);
    const members = group.artistProfile?.members || [];
    const memberName = members.length > 0 ? randomFrom(members).name : group.name;

    const context = `隢${memberName}??銝??????蝪∠??嚗?0摮誑?改?嚗??舀撣貊?瘣餌??澈?;

    const aiContent = await generateContentWithAI(context, null);
    
    if (aiContent) {
        return aiContent.substring(0, 50);
    }

    const storyTemplates = [
        '隞予?予瘞??儭?,
        '蝺渡?銝??',
        '?拐?憟踝?',
        '?? ??',
        '撠?鞎冽芋撘??'
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
        bio: bio.trim() || name + ' ???寧冗蝢?,
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
            groupListEl.innerHTML = '<button class="group-chip back-btn" data-action="back-to-cards"><i class="fas fa-chevron-left"></i> 餈??”</button><button class="group-chip active">' + (group?.name || '') + '</button>';
        } else {
            groupListEl.innerHTML = '';
        }
    } else {
        const joinedGroups = groups.filter(g => joinedGroupIds.includes(g.id));
        if (joinedGroups.length === 0) {
            groupListEl.innerHTML = '<button class="group-chip explore-btn" data-action="explore">?Ｙ揣蝷曄黎</button>';
        } else {
            groupListEl.innerHTML = joinedGroups.map(g => '<button class="group-chip ' + (g.id === activeGroupId ? 'active' : '') + '" data-group-id="' + g.id + '">' + g.name + '</button>').join('') + '<button class="group-chip explore-btn" data-action="explore">+ ?Ｙ揣</button>';
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
        [{ id: 'default-1', name: '摰', avatar: '摰?, color: 'var(--wv-accent)' }, { id: 'default-2', name: '?', avatar: '??, color: '#f09433' }].forEach(story => {
            const item = createElement('article', 'story-item');
            item.innerHTML = '<span class="avatar" style="background:' + story.color + '">' + story.avatar + '</span><span class="name">' + story.name + '</span>';
            storyStripEl.appendChild(item);
        });
        return storyStripEl;
    }
    storyItems.forEach(story => {
        const item = createElement('article', 'story-item');
        item.innerHTML = `<span class="avatar ${story.avatarImage ? 'has-image' : ''}" ${story.avatarImage ? `style="background-image:url('${story.avatarImage}')"` : `style="background:${story.color}"`}>${story.avatarImage ? '' : story.avatar}</span><span class="name">${story.name}</span>`;
        storyStripEl.appendChild(item);
    });
    return storyStripEl;
}

function renderFeed(group) {
    const feedEl = createElement('div', 'feed');
    if (!isArtistMode && !isGroupJoined(group.id)) {
        feedEl.innerHTML = '<div class="join-prompt"><p>?甇斤冗蝢文???亦??潭??批捆</p><button class="join-group-btn" data-group-id="' + group.id + '">?蝷曄黎</button></div>';
        return feedEl;
    }
    if (!group.posts || group.posts.length === 0) {
        feedEl.innerHTML = '<div class="empty-feed"><p>?桀??????/p></div>';
        return feedEl;
    }
    group.posts.forEach(post => {
        const article = createElement('article', 'post');
        article.innerHTML = '<div class="post-head"><span>' + post.author + '</span><span>' + post.time + '</span></div><div class="post-text">' + post.text + '</div><div class="post-actions"><span>霈?' + formatCompact(post.likes || 0) + '</span><span>?? ' + formatCompact(post.comments || 0) + '</span></div>';
        feedEl.appendChild(article);
    });
    return feedEl;
}

function renderHeroCover(group) {
    const heroCover = createElement('div', 'hero-cover card');
    const rolePill = isArtistMode ? '<span class="role-pill">Artist Mode</span>' : '<span class="role-pill">Fan Mode</span>';
    if (!group) {
        if (isArtistMode) heroCover.innerHTML = '<h2>?犖撌乩???/h2><p>撱箇?銝衣恣????擃冗蝢?/p><div class="hero-meta"></div>';
        else if (joinedGroupIds.length === 0) heroCover.innerHTML = '<h2>撠?蝷曄黎</h2><p>?Ｙ揣銝血??乩??迭??鈭箇冗蝢歹???餈質馱隞???嚗?/p><div class="hero-meta"></div>';
        return heroCover;
    }
    heroCover.innerHTML = '<h2>' + group.name + ' ' + rolePill + '</h2><p>' + group.bio + '</p><span class="type-badge">' + group.type + '</span><div class="hero-meta"><span>' + formatCompact(group.members || 0) + ' ?</span><span>' + formatCompact(group.online || 0) + ' ?函?</span></div>';
    return heroCover;
}

function renderComposer() {
    const composer = createElement('div', 'composer card');
    composer.innerHTML = '<input type="text" id="post-input" placeholder="' + (isArtistMode ? '隞亥?鈭箄澈??蝎結?潭?...' : '?函冗蝢方ㄐ?澆?鞎潭?...') + '"><button id="post-btn">' + (isArtistMode ? '摰?澆?' : '?澆?') + '</button>';
    return composer;
}
function renderArtistGroupCards() {
    const container = createElement('div', 'artist-group-cards');
    if (groups.length === 0) {
        container.innerHTML = '<div class="artist-empty-state"><p>撠撱箇?隞颱???</p><button class="primary-btn" id="create-artist-group-btn">撱箇??啣?擃?/button></div>';
        return container;
    }
    groups.forEach(group => {
        const card = createElement('article', 'artist-group-card');
        card.dataset.groupId = group.id;
        card.innerHTML = '<button class="delete-group-btn" data-group-id="' + group.id + '"><i class="fas fa-trash"></i></button><div class="artist-card-header"><span class="artist-card-type">' + group.type + '</span><h4>' + group.name + '</h4></div><p class="artist-card-bio">' + group.bio + '</p><div class="artist-card-meta"><span>' + formatCompact(group.members || 0) + ' ?</span><span>' + formatCompact(group.online || 0) + ' ?函?</span></div><div class="artist-card-members">' + (group.artistProfile?.members?.length > 0 ? '撌脰身摰?' + group.artistProfile.members.length + ' 雿??? : '撠閮剖??') + '</div>';
        container.appendChild(card);
    });
    const createBtn = createElement('button', 'secondary-btn create-group-btn');
    createBtn.id = 'create-artist-group-btn';
    createBtn.innerHTML = '<i class="fas fa-plus"></i> 撱箇??啣?擃?;
    container.appendChild(createBtn);
    return container;
}

function renderExploreGroupsPage(onClose) {
    const page = createElement('div', 'explore-groups-page');
    page.innerHTML = '<header class="explore-header settings-header"><button class="icon-btn" id="explore-back-btn"><i class="fas fa-chevron-left"></i></button><h3>?Ｙ揣蝷曄黎</h3></header><main class="settings-body"><div class="explore-groups-list"></div></main>';
    const list = page.querySelector('.explore-groups-list');
    groups.forEach(group => {
        const isJoined = joinedGroupIds.includes(group.id);
        const item = createElement('article', 'explore-group-item');
        item.innerHTML = '<div class="explore-group-info"><h4>' + group.name + '</h4><span class="explore-group-type">' + group.type + '</span><p>' + group.bio + '</p><div class="explore-group-meta"><span>' + formatCompact(group.members || 0) + ' ?</span></div></div><button class="' + (isJoined ? 'leave-btn' : 'join-btn') + '" data-group-id="' + group.id + '">' + (isJoined ? '撌脣??? : '?') + '</button>';
        list.appendChild(item);
    });
    page.querySelector('#explore-back-btn').onclick = onClose;
    return page;
}

function createCreateGroupModal(onConfirm) {
    const modal = createElement('div', 'create-group-modal');
    modal.id = 'create-group-modal';
    modal.innerHTML = '<div class="modal-content"><h3>撱箇??啣?擃?/h3><label><span>???迂</span><input type="text" id="new-group-name" placeholder="靘?嚗UMEN"></label><label><span>憿?</span><select id="new-group-type"><option value="K-POP">K-POP</option><option value="J-POP">J-POP</option><option value="Band">Band</option><option value="Solo">Solo</option><option value="Creator">Creator</option></select></label><label><span>蝪∩?</span><textarea id="new-group-bio" rows="2" placeholder="頛詨??隞晶"></textarea></label><div class="modal-actions"><button class="secondary-btn" id="cancel-create-group">??</button><button class="primary-btn" id="confirm-create-group">撱箇?</button></div></div>';
    modal.querySelector('#cancel-create-group').onclick = () => modal.remove();
    modal.querySelector('#confirm-create-group').onclick = () => {
        const name = modal.querySelector('#new-group-name').value.trim();
        const type = modal.querySelector('#new-group-type').value;
        const bio = modal.querySelector('#new-group-bio').value.trim();
        if (!name) { createToast('隢撓?亙?擃?蝔?); return; }
        const newGroup = createArtistGroup(name, type, bio);
        modal.remove();
        onConfirm(newGroup);
    };
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    return modal;
}
async function renderWeverse(params) {
    await loadSettings();
    const container = createElement('div', 'weverse-app');
    if (isArtistMode) container.classList.add('artist-mode');
    const header = createElement('header', 'wv-header');
    header.innerHTML = '<div class="brand"><span class="brand-dot"></span></div><h1>Weverse</h1><div class="header-actions"><button class="icon-btn" id="user-settings-btn" title="蝎結閮剖?"><i class="fas fa-user-cog"></i></button><button class="icon-btn hidden" id="artist-settings-btn" title="?犖閮剖?"><i class="fas fa-cog"></i></button><button class="icon-btn" id="role-toggle" title="??閫"><i class="fas fa-exchange-alt"></i></button></div>';
    if (isArtistMode) { header.querySelector('#user-settings-btn').classList.add('hidden'); header.querySelector('#artist-settings-btn').classList.remove('hidden'); }
    container.appendChild(header);
    const main = createElement('main', 'wv-main');
    let currentGroup = getActiveGroup();
    if (!isArtistMode && joinedGroupIds.length > 0 && !activeGroupId) { activeGroupId = joinedGroupIds[0]; currentGroup = getActiveGroup(); }
    main.appendChild(renderGroupList());
    main.appendChild(renderHeroCover(currentGroup));
    if (isArtistMode && !activeGroupId) main.appendChild(renderArtistGroupCards());
    else if (currentGroup) { main.appendChild(renderStories(currentGroup)); main.appendChild(renderFeed(currentGroup)); main.appendChild(renderComposer()); }
    container.appendChild(main);
    const renderUI = () => {
        const newMain = createElement('main', 'wv-main');
        newMain.appendChild(renderGroupList());
        const newCurrentGroup = getActiveGroup();
        newMain.appendChild(renderHeroCover(newCurrentGroup));
        if (isArtistMode && !activeGroupId) newMain.appendChild(renderArtistGroupCards());
        else if (newCurrentGroup) { newMain.appendChild(renderStories(newCurrentGroup)); newMain.appendChild(renderFeed(newCurrentGroup)); newMain.appendChild(renderComposer()); }
        const oldMain = container.querySelector('.wv-main');
        if (oldMain) oldMain.replaceWith(newMain);
    };
    header.querySelector('#role-toggle').onclick = () => {
        isArtistMode = !isArtistMode;
        if (isArtistMode) { container.classList.add('artist-mode'); header.querySelector('#user-settings-btn').classList.add('hidden'); header.querySelector('#artist-settings-btn').classList.remove('hidden'); activeGroupId = ''; }
        else { container.classList.remove('artist-mode'); header.querySelector('#user-settings-btn').classList.remove('hidden'); header.querySelector('#artist-settings-btn').classList.add('hidden'); activeGroupId = joinedGroupIds.length > 0 ? joinedGroupIds[0] : ''; }
        renderUI();
    };
    container.onclick = (e) => {
        const exploreBtn = e.target.closest('[data-action="explore"]');
        if (exploreBtn) { const explorePage = renderExploreGroupsPage(() => { container.classList.remove('show-explore'); explorePage.remove(); }); container.appendChild(explorePage); container.classList.add('show-explore'); return; }
        const backBtn = e.target.closest('[data-action="back-to-cards"]');
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
        if (deleteGroupBtn && confirm('蝣箏?閬?斗迨????')) { deleteArtistGroup(deleteGroupBtn.dataset.groupId); renderUI(); }
    };
    const addPost = async () => {
        const input = container.querySelector('#post-input');
        const text = input?.value.trim();
        if (!text || !currentGroup) return;
        ensureArtistProfile(currentGroup);
        currentGroup.posts = currentGroup.posts || [];

        let finalText = text;
        let finalAuthor = isArtistMode ? (currentGroup.artistProfile.name || currentGroup.name + ' Official') : '雿?;

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
            time: '??',
            likes: 0,
            comments: 0
        });
        input.value = '';
        scheduleSettingsSave();
        renderUI();
    };
    setTimeout(() => { const postBtn = container.querySelector('#post-btn'); const postInput = container.querySelector('#post-input'); if (postBtn) postBtn.onclick = addPost; if (postInput) postInput.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); addPost(); } }; }, 100);
    return { element: container, cleanup: () => { if (saveTimer) clearTimeout(saveTimer); } };
}

export default { id: 'weverse', name: 'Weverse', icon: 'groups', routes: [{ path: '/weverse', render: renderWeverse }], navItem: { label: 'Weverse', icon: 'groups', path: '/weverse', showInNav: true, order: 27 }, stylesPath: 'js/apps/weverse/style.css' };

