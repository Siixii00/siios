import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { CharactersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { SHOPS, KINDS, isShopUrl, shopLinks } from '../../core/real-shops.js';
import { OCCASIONS, FREQUENCIES, formatPriceRange } from '../../core/gift-ideas.js';
import {
    loadPrefs, savePrefs, loadSelectedChar, saveSelectedChar, loadWishlist, addWish, removeWish, loadRecords, addRecord, saveDecisionMemory,
    loadProposals, updateProposal, refreshProposals, generateIdeas, NoApiError, DEFAULT_BUDGET, isShown
} from '../../core/shopping-store.js';
import { loadGiftLog } from '../../core/gift-log.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MANUAL_OCCASIONS = ['request', 'cheer', 'thanks', 'celebrate'];
const DECLINE_REASONS = ['太貴了', '不是我的風格', '已經有了', '用不到', '其他'];
const STATUS_LABEL = { accepted: '💝 收下', bought: '🛍 真的買了', declined: '🤍 不需要' };

let tab = 'pick';

async function renderShopping() {
    const container = createElement('div', 'app-container taobao-app');
    container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">購物</h1>
    </header>
    <div class="tb-tabs">
      <button data-tab="pick">為你挑選</button><button data-tab="wish">願望清單</button><button data-tab="log">紀錄</button><button data-tab="set">設定</button>
    </div>
    <div class="page" id="tb-page"></div>`;
    container.querySelector('.ios-back-btn').onclick = () => Router.back();
    const page = container.querySelector('#tb-page');

    const characters = await CharactersDB.getAll();
    let prefs = await loadPrefs();
    let charId = (await loadSelectedChar()) || characters[0]?.id || '';
    if (!characters.some(c => c.id === charId)) charId = characters[0]?.id || '';
    const charOf = id => characters.find(c => c.id === id);

    // 本次挑選的狀態（切換分頁不會消失）
    let occasion = 'request', kinds = new Set(), ideas = [], ideasMeta = null, loading = false, reactions = {}, decided = {};

    async function draw() {
        container.querySelectorAll('.tb-tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
        page.replaceChildren();
        if (!characters.length) { page.innerHTML = '<div class="tb-empty">請先建立角色，他才能幫你挑禮物</div>'; return; }
        if (tab === 'pick') await drawPick();
        else if (tab === 'wish') await drawWish();
        else if (tab === 'log') await drawLog();
        else drawSettings();
    }
    container.querySelectorAll('.tb-tabs button').forEach(b => { b.onclick = () => { tab = b.dataset.tab; draw(); }; });

    // ───── 為你挑選 ─────
    function charSelect() {
        const wrap = createElement('div', 'tb-card');
        const sel = createElement('select', 'tb-select');
        sel.innerHTML = characters.map(c => `<option value="${esc(c.id)}"${c.id === charId ? ' selected' : ''}>${esc(c.name)}</option>`).join('');
        sel.onchange = async () => { charId = sel.value; await saveSelectedChar(charId); ideas = []; ideasMeta = null; draw(); };
        wrap.append(createElement('div', 'tb-label', { textContent: '請誰幫你挑？' }), sel);
        return wrap;
    }

    async function drawPick() {
        page.appendChild(charSelect());
        const name = charOf(charId)?.name || '角色';

        // 他想送你東西（重要日子的提議）
        const props = (await loadProposals()).filter(p => isShown(p));
        if (props.length) {
            const box = createElement('div', 'tb-card tb-props');
            box.appendChild(createElement('div', 'tb-label', { textContent: '💝 他想送你東西' }));
            props.forEach(p => {
                const c = charOf(p.characterId);
                if (!c) return;
                const row = createElement('div', 'tb-prop');
                row.innerHTML = `<div><strong>${esc(c.name)}</strong> ${p.type === 'return' ? '想回送你一份禮物' : `想為「${esc(p.label)}」送你一份禮物`}<small>${new Date(p.dueAt).toLocaleDateString('zh-TW', { month: 'numeric', day: 'numeric' })}</small></div>`;
                const btn = createElement('button', 'tb-btn', { textContent: p.status === 'ready' ? '看看他挑了什麼' : '請他挑' });
                btn.onclick = () => openProposal(p);
                row.appendChild(btn);
                box.appendChild(row);
            });
            page.appendChild(box);
        }

        const form = createElement('div', 'tb-card');
        form.innerHTML = `<div class="tb-label">這次是什麼場合？</div>
          <div class="tb-chips" id="oc">${MANUAL_OCCASIONS.map(o => `<button class="tb-chip${o === occasion ? ' on' : ''}" data-oc="${o}">${esc(OCCASIONS[o].label)}</button>`).join('')}</div>
          <div class="tb-label">預算（每個約）</div>
          <div class="tb-row"><input type="number" id="bmin" min="0" value="${prefs.budget.min}"><span>～</span><input type="number" id="bmax" min="0" value="${prefs.budget.max}"><span>元</span></div>
          <div class="tb-label">想要的類別（可不選）</div>
          <div class="tb-chips" id="kd">${KINDS.map(k => `<button class="tb-chip${kinds.has(k.id) ? ' on' : ''}" data-kd="${k.id}">${esc(k.name)}</button>`).join('')}</div>`;
        const go = createElement('button', 'tb-btn tb-big', { textContent: `請 ${name} 幫我挑` });
        go.disabled = loading;
        form.appendChild(go);
        form.querySelectorAll('[data-oc]').forEach(b => { b.onclick = () => { occasion = b.dataset.oc; form.querySelectorAll('[data-oc]').forEach(x => x.classList.toggle('on', x === b)); }; });
        form.querySelectorAll('[data-kd]').forEach(b => { b.onclick = () => { const id = b.dataset.kd; kinds.has(id) ? kinds.delete(id) : kinds.add(id); b.classList.toggle('on'); }; });
        go.onclick = async () => {
            const min = Math.max(0, +form.querySelector('#bmin').value || 0), max = Math.max(min, +form.querySelector('#bmax').value || DEFAULT_BUDGET.max);
            prefs = { ...prefs, budget: { min, max } }; await savePrefs({ ...prefs, shops: prefs.shops });
            await pick({ occasion, label: OCCASIONS[occasion].label, kindNames: [...kinds].map(id => KINDS.find(k => k.id === id).name), proposalId: null });
        };
        page.appendChild(form);

        const results = createElement('div', 'tb-results');
        page.appendChild(results);
        drawIdeas(results);
    }

    async function pick({ occasion: oc, label, kindNames = [], proposalId = null, extra = '' }) {
        if (loading) return;
        loading = true; ideas = []; ideasMeta = { occasion: oc, label, proposalId, characterId: charId };
        const results = page.querySelector('.tb-results');
        if (results) results.innerHTML = '<div class="tb-loading">他正在想要送你什麼…</div>';
        try {
            ideas = await generateIdeas({ characterId: charId, occasion: oc, label, budget: prefs.budget, kinds: kindNames, extra });
            decided = {}; reactions = {};
            if (proposalId) await updateProposal(proposalId, { status: 'ready', ideas });
        } catch (e) {
            ideasMeta = null;
            if (results) results.innerHTML = `<div class="tb-empty">${esc(e instanceof NoApiError ? e.message : (e?.message || '挑選失敗'))}</div>`;
            loading = false;
            return;
        }
        loading = false;
        if (page.querySelector('.tb-results')) drawIdeas(page.querySelector('.tb-results'));
    }

    async function openProposal(p) {
        charId = p.characterId; await saveSelectedChar(charId);
        ideas = []; decided = {}; reactions = {};
        if (p.status === 'ready' && Array.isArray(p.ideas) && p.ideas.length) { ideas = p.ideas; ideasMeta = { occasion: p.occasion, label: p.label, proposalId: p.id, characterId: charId }; await draw(); return; }
        await draw();
        await pick({ occasion: p.occasion, label: p.label, proposalId: p.id, extra: p.extra || `今天是「${p.label}」` });
    }

    function drawIdeas(host) {
        host.replaceChildren();
        if (!ideas.length) return;
        const c = charOf(ideasMeta?.characterId || charId);
        host.appendChild(createElement('div', 'tb-label tb-from', { textContent: `${c?.name || '他'}挑了這幾樣（${ideasMeta?.label || ''}）` }));
        ideas.forEach(idea => host.appendChild(ideaCard(idea, c)));
    }

    function linkButtons(idea) {
        const links = shopLinks(idea, prefs.shops).filter(l => isShopUrl(l.url));
        const wrap = createElement('div', 'tb-links');
        if (/^https?:\/\//i.test(idea.real?.link || '')) {
            const a = createElement('a', 'tb-link', { textContent: `查到的商品：${idea.real.source || '商店'} ↗` });
            a.href = idea.real.link; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = idea.real.title;
            wrap.appendChild(a);
        }
        links.forEach((l, i) => {
            const a = createElement('a', 'tb-link' + (i >= 4 ? ' more' : ''), { textContent: l.name });
            a.href = l.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; a.title = `在「${l.name}」搜尋：${l.query}`;
            wrap.appendChild(a);
        });
        if (links.length > 4) {
            const more = createElement('button', 'tb-link tb-more', { textContent: `更多 ▾` });
            more.onclick = () => { wrap.classList.toggle('open'); more.textContent = wrap.classList.contains('open') ? '收起 ▴' : '更多 ▾'; };
            wrap.appendChild(more);
        }
        if (!links.length) wrap.appendChild(createElement('small', 'tb-muted', { textContent: '到「設定」開啟至少一個購物平台' }));
        return wrap;
    }

    function ideaCard(idea, c) {
        const card = createElement('div', 'tb-idea');
        const state = decided[idea.id];
        card.innerHTML = `
          <div class="tb-idea-head"><span class="tb-kind">${esc(KINDS.find(k => k.id === idea.kind)?.name || '')}</span><strong>${esc(idea.name)}</strong><span class="tb-price">${esc(formatPriceRange(idea))}</span></div>
          ${idea.reason ? `<p class="tb-reason">${esc(idea.reason)}</p>` : ''}
          ${idea.message ? `<p class="tb-say">「${esc(idea.message)}」<small>— ${esc(c?.name || '')}</small></p>` : ''}
          <small class="tb-muted">${idea.real ? '價格是剛剛查到的標價，可能隨時變動；' : '價格是估計，請以商店為準；'}不會自動購買，要不要買由你決定。</small>`;
        card.appendChild(linkButtons(idea));
        const actions = createElement('div', 'tb-actions');
        if (state) {
            actions.appendChild(createElement('span', 'tb-done', { textContent: STATUS_LABEL[state.status] + (state.reason ? `（${state.reason}）` : '') }));
        } else {
            const mk = (text, fn, cls = '') => { const b = createElement('button', 'tb-btn small ' + cls, { textContent: text }); b.onclick = fn; actions.appendChild(b); };
            mk('💝 收下', () => decide(idea, 'accepted'));
            mk('🛍 我買了', () => decide(idea, 'bought'));
            mk('🤍 加入願望清單', async () => { await addWish({ name: idea.name, note: idea.reason?.slice(0, 40) || '', price: idea.priceMax }); createToast('已加入願望清單'); });
            mk('不用了', () => askDecline(idea, card), 'ghost');
        }
        card.appendChild(actions);
        if (reactions[idea.id]) card.appendChild(createElement('div', 'tb-reaction', { textContent: `${c?.name || ''}：${reactions[idea.id]}` }));
        return card;
    }

    function askDecline(idea, card) {
        const box = createElement('div', 'tb-reasons');
        DECLINE_REASONS.forEach(r => { const b = createElement('button', 'tb-chip', { textContent: r }); b.onclick = () => decide(idea, 'declined', r === '其他' ? '' : r); box.appendChild(b); });
        card.querySelector('.tb-actions').replaceWith(box);
    }

    async function decide(idea, status, reason = '') {
        const cid = ideasMeta?.characterId || charId, c = charOf(cid);
        decided[idea.id] = { status, reason };
        const rec = await addRecord({ characterId: cid, name: idea.name, status, reason, occasion: ideasMeta?.occasion || 'request', priceMin: idea.priceMin, priceMax: idea.priceMax, kind: idea.kind });
        saveDecisionMemory(rec, c?.name || '角色').catch(() => {});
        // 這張提議的 3 個點子都處理過了就算完成
        if (ideasMeta?.proposalId && ideas.every(i => decided[i.id])) await updateProposal(ideasMeta.proposalId, { status: 'resolved', resolvedAt: Date.now() });
        reactions[idea.id] = fallbackReaction(status);
        const host = page.querySelector('.tb-results'); if (host) drawIdeas(host);
        reactionFor(cid, idea, status, reason).then(text => { if (text) { reactions[idea.id] = text; const h = page.querySelector('.tb-results'); if (h && tab === 'pick') drawIdeas(h); } }).catch(() => {});
    }

    const fallbackReaction = status => ({ accepted: '收下了呀，太好了。', bought: '真的買了？我會很期待你用它的樣子。', declined: '好，沒關係，下次我再想想別的。' }[status]);

    async function reactionFor(cid, idea, status, reason) {
        const s = await APIClient.getSettings();
        if (!s.api_url || !s.api_key) return null;
        const ctx = await buildAppContext({ characterId: cid, userMessage: idea.name });
        const did = status === 'bought' ? '收下了，而且真的去買了' : status === 'accepted' ? '收下了' : `這次不需要${reason ? '（' + reason + '）' : ''}`;
        const text = await APIClient.complete([
            { role: 'system', content: `${ctx.systemPrompt}\n\n你剛才幫用戶挑了禮物「${idea.name}」，用戶${did}。用你的口吻回一句話（40 字內）。自然就好：不要邀功、不要重複送禮的細節；沒買也不要勉強或失落地糾纏。只輸出那句話。` },
            { role: 'user', content: '（用戶做了決定）' }
        ], { temperature: 0.8, maxTokens: 120 });
        return text.replace(/^[「"]|[」"]$/g, '').slice(0, 80);
    }

    // ───── 願望清單 ─────
    async function drawWish() {
        const form = createElement('div', 'tb-card');
        form.innerHTML = `<div class="tb-label">想要的東西（他會知道，可能會從裡面挑）</div>
          <input type="text" id="wn" placeholder="名稱，例如：降噪耳機" maxlength="40">
          <input type="url" id="wu" placeholder="商品連結（選填，只收 https）">
          <div class="tb-row"><input type="number" id="wp" min="0" placeholder="價格（選填）"><input type="text" id="wt" placeholder="備註（選填）" maxlength="100"></div>`;
        const add = createElement('button', 'tb-btn', { textContent: '加入' });
        add.onclick = async () => {
            try { await addWish({ name: form.querySelector('#wn').value, url: form.querySelector('#wu').value, price: form.querySelector('#wp').value, note: form.querySelector('#wt').value }); draw(); }
            catch (e) { createToast(e.message, 'error'); }
        };
        form.appendChild(add);
        page.appendChild(form);
        const list = await loadWishlist();
        if (!list.length) page.appendChild(createElement('div', 'tb-empty', { textContent: '還沒有想要的東西' }));
        list.forEach(w => {
            const row = createElement('div', 'tb-card tb-wish');
            row.innerHTML = `<div class="tb-idea-head"><strong>${esc(w.name)}</strong>${w.price ? `<span class="tb-price">約 $${w.price.toLocaleString()}</span>` : ''}</div>${w.note ? `<p class="tb-reason">${esc(w.note)}</p>` : ''}`;
            if (w.url) { const a = createElement('a', 'tb-link', { textContent: '開啟你存的連結' }); a.href = w.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; row.appendChild(a); }
            row.appendChild(linkButtons({ name: w.name, kind: 'daily', queries: { zh: w.name } }));
            const del = createElement('button', 'tb-btn small ghost', { textContent: '刪除' });
            del.onclick = async () => { await removeWish(w.id); draw(); };
            row.appendChild(del);
            page.appendChild(row);
        });
    }

    // ───── 紀錄 ─────
    async function drawLog() {
        const records = (await loadRecords()).slice().reverse();
        const given = (await loadGiftLog()).slice().reverse();
        if (!records.length && !given.length) { page.innerHTML = '<div class="tb-empty">還沒有紀錄。請他挑一次禮物，你的決定會記在這裡。</div>'; return; }
        given.forEach(r => {
            const row = createElement('div', 'tb-card tb-record');
            row.innerHTML = `<div class="tb-idea-head"><strong>🎁 ${esc(r.name)}</strong>${r.price ? `<span class="tb-price">$${Number(r.price).toLocaleString()}</span>` : ''}</div><small class="tb-muted">你送給 ${esc(charOf(r.characterId)?.name || '')} · ${new Date(r.at).toLocaleDateString('zh-TW')}</small>`;
            page.appendChild(row);
        });
        records.forEach(r => {
            const row = createElement('div', 'tb-card tb-record');
            row.innerHTML = `<div class="tb-idea-head"><strong>${esc(r.name)}</strong><span class="tb-price">${esc(formatPriceRange(r))}</span></div>
              <small class="tb-muted">${esc(charOf(r.characterId)?.name || '')} · ${esc(OCCASIONS[r.occasion]?.label || '')} · ${new Date(r.at).toLocaleDateString('zh-TW')}</small>
              <div class="tb-done">${esc(STATUS_LABEL[r.status] || r.status)}${r.reason ? `（${esc(r.reason)}）` : ''}</div>`;
            page.appendChild(row);
        });
    }

    // ───── 設定 ─────
    function drawSettings() {
        const shops = createElement('div', 'tb-card');
        shops.appendChild(createElement('div', 'tb-label', { textContent: '購物平台（開啟的才會出現搜尋連結，順序就是顯示順序）' }));
        const enabled = prefs.shops.enabled;
        const all = [...enabled, ...SHOPS.map(s => s.id).filter(id => !enabled.includes(id))];
        all.forEach((id, idx) => {
            const s = SHOPS.find(x => x.id === id);
            const row = createElement('div', 'tb-shop-row');
            const on = enabled.includes(id);
            row.innerHTML = `<label><input type="checkbox" ${on ? 'checked' : ''}> ${esc(s.name)} <small class="tb-muted">${esc(s.host)}</small></label>`;
            row.querySelector('input').onchange = async e => {
                const next = e.target.checked ? [...enabled, id] : enabled.filter(x => x !== id);
                prefs = { ...prefs, shops: { enabled: next } }; await savePrefs(prefs); draw();
            };
            if (on) {
                const mv = (d, t) => { const b = createElement('button', 'tb-chip', { textContent: t }); b.onclick = async () => { const i = enabled.indexOf(id), j = i + d; if (j < 0 || j >= enabled.length) return; const next = enabled.slice(); [next[i], next[j]] = [next[j], next[i]]; prefs = { ...prefs, shops: { enabled: next } }; await savePrefs(prefs); draw(); }; return b; };
                row.append(mv(-1, '↑'), mv(1, '↓'));
            }
            shops.appendChild(row);
        });
        page.appendChild(shops);

        const pro = createElement('div', 'tb-card');
        pro.appendChild(createElement('div', 'tb-label', { textContent: '主動送禮（重要日子他會準備一份）' }));
        pro.appendChild(createElement('small', 'tb-muted', { textContent: '生日、認識紀念日、節日、行事曆裡的生日或紀念。沒有背景推播：打開 App 時才會檢查，你點開才會請他挑（不會偷偷用掉 API 額度）。' }));
        characters.forEach(c => {
            const row = createElement('div', 'tb-shop-row');
            const sel = createElement('select', 'tb-select');
            sel.innerHTML = Object.entries(FREQUENCIES).map(([k, v]) => `<option value="${k}"${(prefs.proactive[c.id] || 'normal') === k ? ' selected' : ''}>${esc(v)}</option>`).join('');
            sel.onchange = async () => { prefs = { ...prefs, proactive: { ...prefs.proactive, [c.id]: sel.value } }; await savePrefs(prefs); };
            row.append(createElement('span', '', { textContent: c.name }), sel);
            pro.appendChild(row);
        });
        pro.appendChild(createElement('small', 'tb-muted', { textContent: '你的生日取自「年齡確認」填的生日；認識紀念日預設是第一次聊天的日子，也可以在角色設定裡填。' }));
        page.appendChild(pro);
    }

    // 進來時順便檢查有沒有新的重要日子
    refreshProposals().catch(() => {}).finally(() => { if (tab === 'pick' && !loading && !ideas.length) draw(); });
    await draw();
    return { element: container, cleanup: null };
}

export default {
    id: 'taobao',
    name: '購物',
    icon: 'shopping_bag',
    routes: [{ path: '/taobao', render: renderShopping }],
    navItem: { label: '購物', icon: 'shopping_bag', path: '/taobao', showInNav: true, order: 122 },
    stylesPath: 'js/apps/taobao/style.css'
};
