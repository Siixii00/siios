import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB, CharactersDB, UsersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { askForm } from '../../core/dialogs.js';

const POSTS_KEY = 'facebook_posts';
const PREFS_KEY = 'facebook_prefs';
const PROFILE_KEY = 'facebook_profile';
const MAX_POSTS = 200;
const REACTIONS = { like: '👍', love: '❤️', haha: '😆', wow: '😮', sad: '😢', angry: '😡' };

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => 'fb-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);

function timeAgo(ts) {
    const s = Math.max(0, (Date.now() - ts) / 1000);
    if (s < 60) return '剛剛';
    if (s < 3600) return Math.floor(s / 60) + ' 分鐘前';
    if (s < 86400) return Math.floor(s / 3600) + ' 小時前';
    if (s < 86400 * 7) return Math.floor(s / 86400) + ' 天前';
    const d = new Date(ts);
    return d.getFullYear() + '/' + (d.getMonth() + 1) + '/' + d.getDate();
}

// 所有寫入都排隊並重新讀取最新資料，避免背景的 AI 回覆蓋掉使用者剛做的修改
let writeQueue = Promise.resolve();
async function loadPosts() {
    const v = await SettingsDB.get(POSTS_KEY);
    return Array.isArray(v) ? v : [];
}
function updatePosts(fn) {
    const run = writeQueue.then(async () => {
        const posts = await loadPosts();
        fn(posts);
        posts.sort((a, b) => b.createdAt - a.createdAt);
        const kept = posts.slice(0, MAX_POSTS);
        await SettingsDB.set(POSTS_KEY, kept);
        return kept;
    });
    writeQueue = run.catch(() => {});
    return run;
}

async function loadPrefs() {
    const v = await SettingsDB.get(PREFS_KEY);
    return { disabledIds: Array.isArray(v?.disabledIds) ? v.disabledIds : [] };
}

async function loadProfile() {
    const saved = (await SettingsDB.get(PROFILE_KEY)) || {};
    const user = (await UsersDB.getAll())[0] || null;
    return { id: user?.id || '', name: saved.name || user?.name || '我', bio: saved.bio || '', avatar: user?.avatar || '' };
}

async function apiReady() {
    const s = await APIClient.getSettings();
    return !!(s.api_url && s.api_key);
}

function cleanReply(text) {
    return String(text || '').replace(/^```[a-z]*\n?|```$/g, '').trim().replace(/^["「『]+|["」』]+$/g, '').trim();
}

async function askCharacter(characterId, instruction) {
    const context = await buildAppContext({ characterId });
    const system = (context.systemPrompt || '') + '\n\n你正在使用 Facebook。你就是這個角色本人，用第一人稱、符合角色性格與說話方式回應，使用繁體中文，不要提到自己是 AI，不要加任何說明或前後綴，只輸出要發布的內容。';
    const text = cleanReply(await APIClient.complete([{ role: 'system', content: system }, { role: 'user', content: instruction }], { temperature: 0.9, maxTokens: 400 }));
    if (!text) throw new Error('角色沒有回應內容');
    return { text, character: context.character };
}

function remember(characterId, userId, content) {
    return saveInteractionMemory({ characterId, userId, sourceApp: 'facebook', sourceType: 'interaction', sourceSubtype: 'social', content, importance: 0.4 });
}

// 圖片縮到 800px 以內再存，避免塞爆 IndexedDB
function readImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('讀取圖片失敗'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('不是有效的圖片'));
            img.onload = () => {
                const scale = Math.min(1, 800 / Math.max(img.width, img.height));
                const canvas = document.createElement('canvas');
                canvas.width = Math.round(img.width * scale);
                canvas.height = Math.round(img.height * scale);
                canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
                resolve(canvas.toDataURL('image/jpeg', 0.82));
            };
            img.src = reader.result;
        };
        reader.readAsDataURL(file);
    });
}

function avatarHtml(name, avatar, size = '') {
    return avatar
        ? `<img class="fb-avatar ${size}" src="${esc(avatar)}" alt="">`
        : `<span class="fb-avatar ${size} fb-avatar-text">${esc((name || '?').slice(0, 1))}</span>`;
}

function reactionSummary(post) {
    const all = [post.userReaction, ...Object.values(post.charReactions || {})].filter(Boolean);
    if (!all.length) return '';
    const kinds = [...new Set(all)].slice(0, 3).map(k => REACTIONS[k]).join('');
    return `${kinds} ${all.length}`;
}

function postHtml(post, ctx) {
    const mine = post.authorType === 'user';
    const comments = (post.comments || []).map(c => `
        <div class="fb-comment" data-comment="${c.id}">
            ${avatarHtml(c.name, c.avatar, 'sm')}
            <div class="fb-comment-body">
                <div class="fb-comment-bubble"><strong>${esc(c.name)}</strong><span>${esc(c.text)}</span></div>
                <div class="fb-comment-meta">${timeAgo(c.createdAt)}${c.authorType === 'user' ? ' · <button data-action="del-comment" data-post="' + post.id + '" data-comment="' + c.id + '">刪除</button>' : ''}</div>
            </div>
        </div>`).join('');
    const pending = ctx.pending.has(post.id) ? '<div class="fb-pending">朋友正在回應…</div>' : '';
    const my = post.userReaction;
    return `
    <article class="fb-card" data-post="${post.id}">
        <header class="fb-post-head">
            ${avatarHtml(post.authorName, post.authorAvatar)}
            <div class="fb-post-who"><strong>${esc(post.authorName)}</strong><span>${timeAgo(post.createdAt)} · 🌐</span></div>
            ${mine ? `<button class="fb-icon-btn" data-action="del-post" data-post="${post.id}" title="刪除貼文">✕</button>` : ''}
        </header>
        ${post.text ? `<p class="fb-text">${esc(post.text)}</p>` : ''}
        ${post.image ? `<img class="fb-post-img" src="${esc(post.image)}" alt="">` : ''}
        <div class="fb-counts"><span>${reactionSummary(post)}</span><span>${(post.comments || []).length ? (post.comments.length + ' 則留言') : ''}</span></div>
        <div class="fb-actions">
            <button data-action="like" data-post="${post.id}" class="${my ? 'on' : ''}">${my ? REACTIONS[my] : '👍'} ${my ? '' : '讚'}</button>
            <button data-action="picker" data-post="${post.id}">😀 表情</button>
            <button data-action="focus-comment" data-post="${post.id}">💬 留言</button>
        </div>
        <div class="fb-picker" data-picker="${post.id}" hidden>${Object.entries(REACTIONS).map(([k, e]) => `<button data-action="react" data-post="${post.id}" data-kind="${k}">${e}</button>`).join('')}</div>
        <div class="fb-comments">${comments}${pending}</div>
        <form class="fb-comment-form" data-post="${post.id}">
            <input type="text" maxlength="500" placeholder="寫下留言…" autocomplete="off">
            <button type="submit">送出</button>
        </form>
    </article>`;
}

async function renderFacebook() {
    const container = createElement('div', 'fb-app');
    let alive = true;
    let tab = 'feed';
    let composerImage = '';
    const ctx = { pending: new Set(), generating: false };

    const [characters, profile, prefs] = await Promise.all([CharactersDB.getAll(), loadProfile(), loadPrefs()]);
    let posts = await loadPosts();
    const friends = () => characters.filter(c => !prefs.disabledIds.includes(c.id));

    const apply = fn => updatePosts(fn).then(p => { posts = p; if (alive) draw(); return p; });

    function draw() {
        const scroll = container.querySelector('.fb-body')?.scrollTop || 0;
        const draft = container.querySelector('#fb-draft')?.value || '';
        const commentDrafts = [...container.querySelectorAll('.fb-comment-form')].map(f => [f.dataset.post, f.querySelector('input').value]).filter(([, v]) => v);
        container.innerHTML = `
        <header class="fb-top">
            <button class="fb-icon-btn" data-action="back" title="返回">‹</button>
            <h1>facebook</h1>
            <button class="fb-icon-btn" data-action="gen" title="讓朋友發文" ${ctx.generating ? 'disabled' : ''}>${ctx.generating ? '…' : '✨'}</button>
        </header>
        <nav class="fb-tabs">
            ${[['feed', '動態'], ['me', '個人檔案'], ['friends', '朋友']].map(([k, l]) => `<button data-action="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}
        </nav>
        <main class="fb-body">${tab === 'feed' ? feedHtml() : tab === 'me' ? meHtml() : friendsHtml()}</main>`;
        const draftEl = container.querySelector('#fb-draft');
        if (draftEl) draftEl.value = draft;
        commentDrafts.forEach(([id, v]) => { const i = container.querySelector(`.fb-comment-form[data-post="${id}"] input`); if (i) i.value = v; });
        container.querySelector('.fb-body').scrollTop = scroll;
    }

    function composerHtml() {
        return `
        <section class="fb-card fb-composer">
            <div class="fb-composer-row">${avatarHtml(profile.name, profile.avatar)}
                <textarea id="fb-draft" rows="2" maxlength="2000" placeholder="${esc(profile.name)}，你在想些什麼？"></textarea></div>
            ${composerImage ? `<div class="fb-preview"><img src="${esc(composerImage)}" alt=""><button data-action="rm-image">✕</button></div>` : ''}
            <div class="fb-composer-bar">
                <label class="fb-attach">🖼 照片<input type="file" accept="image/*" id="fb-file" hidden></label>
                <button class="fb-primary" data-action="publish">發佈</button>
            </div>
        </section>`;
    }

    function feedHtml() {
        const list = posts.map(p => postHtml(p, ctx)).join('');
        const empty = `<div class="fb-empty"><div>📰</div><p>還沒有任何貼文</p><p class="fb-muted">發佈第一則貼文，或按右上角 ✨ 讓朋友發文。</p></div>`;
        return composerHtml() + (list || empty);
    }

    function meHtml() {
        const mine = posts.filter(p => p.authorType === 'user');
        return `
        <section class="fb-card fb-profile">
            <div class="fb-cover"></div>
            ${avatarHtml(profile.name, profile.avatar, 'lg')}
            <h2>${esc(profile.name)}</h2>
            <p class="fb-muted">${esc(profile.bio) || '還沒有自我介紹'}</p>
            <button class="fb-secondary" data-action="edit-profile">編輯個人檔案</button>
            <p class="fb-muted">${mine.length} 則貼文 · ${friends().length} 位朋友</p>
        </section>
        ${mine.map(p => postHtml(p, ctx)).join('') || '<div class="fb-empty"><p class="fb-muted">你還沒有發佈過貼文</p></div>'}`;
    }

    function friendsHtml() {
        if (!characters.length) return '<div class="fb-empty"><div>👥</div><p>還沒有任何角色</p><p class="fb-muted">先到設定建立角色，他們就會成為你的朋友。</p></div>';
        return `
        <section class="fb-card">
            <h3>朋友（${friends().length}/${characters.length}）</h3>
            <p class="fb-muted">關閉的朋友不會發文，也不會回應你的貼文與留言。</p>
            ${characters.map(c => `
            <label class="fb-friend">
                ${avatarHtml(c.name, c.avatar)}
                <span>${esc(c.name)}</span>
                <input type="checkbox" data-action="toggle-friend" data-id="${c.id}" ${prefs.disabledIds.includes(c.id) ? '' : 'checked'}>
            </label>`).join('')}
        </section>`;
    }

    // 角色以自己的身分發文
    async function generatePosts() {
        if (ctx.generating) return;
        if (!(await apiReady())) return createToast('請先到設定填寫 API', 'error');
        const pool = friends();
        if (!pool.length) return createToast('沒有可發文的朋友（到「朋友」分頁開啟）', 'error');
        ctx.generating = true; draw();
        const picked = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
        let ok = 0; const errors = [];
        await Promise.all(picked.map(async c => {
            try {
                const recent = posts.filter(p => p.characterId === c.id).slice(0, 3).map(p => '- ' + p.text).join('\n');
                const { text } = await askCharacter(c.id, '請以你的身分在 Facebook 發一則動態，可以是日常、心情、想法或生活片段，30~120 字。' + (recent ? '\n你最近發過這些，請避免重複：\n' + recent : ''));
                await apply(list => list.push({ id: uid(), authorType: 'char', characterId: c.id, authorName: c.name, authorAvatar: c.avatar || '', text, image: '', createdAt: Date.now(), userReaction: null, charReactions: {}, comments: [] }));
                ok++;
            } catch (e) { errors.push(c.name + '：' + e.message); }
        }));
        ctx.generating = false; if (alive) draw();
        if (ok) createToast('朋友發了 ' + ok + ' 則動態', 'success');
        if (errors.length) createToast('部分失敗：' + errors[0], 'error');
    }

    // 使用者貼文發佈後：朋友隨機按表情，並由最多 3 位朋友用 AI 留言
    async function friendsRespond(postId, text) {
        const pool = friends();
        if (!pool.length) return;
        const reactions = {};
        pool.forEach(c => { if (Math.random() < 0.7) reactions[c.id] = Object.keys(REACTIONS)[Math.floor(Math.random() * 3)]; });
        await apply(list => { const p = list.find(x => x.id === postId); if (p) p.charReactions = reactions; });
        if (!(await apiReady())) return;
        ctx.pending.add(postId); if (alive) draw();
        const commenters = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
        await Promise.all(commenters.map(async c => {
            try {
                const { text: reply } = await askCharacter(c.id, `${profile.name} 在 Facebook 發了這則貼文：\n「${text}」\n請以你的身分留一則簡短自然的留言（5~40 字）。`);
                await apply(list => { const p = list.find(x => x.id === postId); if (p) p.comments.push({ id: uid(), authorType: 'char', characterId: c.id, name: c.name, avatar: c.avatar || '', text: reply, createdAt: Date.now() }); });
                remember(c.id, profile.id, `${profile.name} 在 Facebook 發文：「${text.slice(0, 80)}」，我留言：「${reply.slice(0, 80)}」`);
            } catch (e) { console.warn('[Facebook] 朋友留言失敗', c.name, e); }
        }));
        ctx.pending.delete(postId); if (alive) draw();
    }

    // 使用者留言後：貼文作者（角色）或最近留言的朋友回覆
    async function characterReplies(postId, userText) {
        const post = posts.find(p => p.id === postId);
        if (!post) return;
        const lastChar = [...(post.comments || [])].reverse().find(c => c.authorType === 'char');
        const charId = post.characterId || lastChar?.characterId;
        const c = characters.find(x => x.id === charId);
        if (!c || prefs.disabledIds.includes(c.id) || !(await apiReady())) return;
        ctx.pending.add(postId); if (alive) draw();
        try {
            const thread = (post.comments || []).slice(-6).map(x => `${x.name}：${x.text}`).join('\n');
            const { text: reply } = await askCharacter(c.id, `貼文（${post.authorName}）：「${post.text}」\n留言串：\n${thread}\n${profile.name} 剛留言：「${userText}」\n請以你的身分回覆這則留言（5~40 字）。`);
            await apply(list => { const p = list.find(x => x.id === postId); if (p) p.comments.push({ id: uid(), authorType: 'char', characterId: c.id, name: c.name, avatar: c.avatar || '', text: reply, createdAt: Date.now() }); });
            remember(c.id, profile.id, `${profile.name} 在 Facebook 留言「${userText.slice(0, 80)}」，我回覆：「${reply.slice(0, 80)}」`);
        } catch (e) {
            createToast('角色回覆失敗：' + e.message, 'error');
        } finally { ctx.pending.delete(postId); if (alive) draw(); }
    }

    async function publish() {
        const text = container.querySelector('#fb-draft').value.trim();
        if (!text && !composerImage) return createToast('請輸入內容或選擇照片', 'error');
        const post = { id: uid(), authorType: 'user', characterId: '', authorName: profile.name, authorAvatar: profile.avatar, text, image: composerImage, createdAt: Date.now(), userReaction: null, charReactions: {}, comments: [] };
        composerImage = '';
        container.querySelector('#fb-draft').value = '';
        await apply(list => list.push(post));
        createToast('已發佈', 'success');
        friendsRespond(post.id, text);
    }

    async function onClick(e) {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const { action, post: postId } = btn.dataset;
        if (action === 'back') return Router.back();
        if (action === 'tab') { tab = btn.dataset.tab; return draw(); }
        if (action === 'gen') return generatePosts();
        if (action === 'publish') return publish();
        if (action === 'rm-image') { composerImage = ''; return draw(); }
        if (action === 'picker') { const p = container.querySelector(`[data-picker="${postId}"]`); p.hidden = !p.hidden; return; }
        if (action === 'focus-comment') return container.querySelector(`.fb-comment-form[data-post="${postId}"] input`).focus();
        if (action === 'like' || action === 'react') {
            const kind = action === 'like' ? 'like' : btn.dataset.kind;
            return apply(list => { const p = list.find(x => x.id === postId); if (p) p.userReaction = (action === 'like' && p.userReaction) || p.userReaction === kind ? null : kind; });
        }
        if (action === 'del-post') {
            if (!confirm('刪除這則貼文？')) return;
            return apply(list => { const i = list.findIndex(x => x.id === postId); if (i >= 0) list.splice(i, 1); });
        }
        if (action === 'del-comment') return apply(list => { const p = list.find(x => x.id === postId); if (p) p.comments = p.comments.filter(c => c.id !== btn.dataset.comment); });
        if (action === 'edit-profile') {
            const form = await askForm({ title: '編輯個人檔案', fields: [{ key: 'name', label: '名稱', value: profile.name, required: true }, { key: 'bio', label: '自我介紹', value: profile.bio }] });
            if (!form) return;
            profile.name = form.name; profile.bio = form.bio;
            await SettingsDB.set(PROFILE_KEY, { name: form.name, bio: form.bio });
            return draw();
        }
    }

    async function onChange(e) {
        if (e.target.dataset.action === 'toggle-friend') {
            const id = e.target.dataset.id;
            prefs.disabledIds = e.target.checked ? prefs.disabledIds.filter(x => x !== id) : [...prefs.disabledIds, id];
            await SettingsDB.set(PREFS_KEY, { disabledIds: prefs.disabledIds });
            draw();
        } else if (e.target.id === 'fb-file' && e.target.files[0]) {
            try { composerImage = await readImage(e.target.files[0]); } catch (err) { createToast(err.message, 'error'); }
            draw();
        }
    }

    async function onSubmit(e) {
        const form = e.target.closest('.fb-comment-form');
        if (!form) return;
        e.preventDefault();
        const input = form.querySelector('input');
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        const postId = form.dataset.post;
        await apply(list => { const p = list.find(x => x.id === postId); if (p) p.comments.push({ id: uid(), authorType: 'user', characterId: '', name: profile.name, avatar: profile.avatar, text, createdAt: Date.now() }); });
        characterReplies(postId, text);
    }

    container.addEventListener('click', onClick);
    container.addEventListener('change', onChange);
    container.addEventListener('submit', onSubmit);
    draw();
    return { element: container, cleanup: () => { alive = false; } };
}

export default {
    id: 'facebook',
    name: 'Facebook',
    icon: 'thumb_up',
    routes: [{ path: '/facebook', render: renderFacebook }],
    navItem: { label: 'Facebook', icon: 'thumb_up', path: '/facebook', showInNav: true, order: 23 },
    stylesPath: 'js/apps/facebook/style.css'
};
