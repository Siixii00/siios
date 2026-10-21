import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { CharactersDB, SettingsDB, UsersDB, ChatsDB, MessagesDB, GlobalSettingsDB, KeywordSettingsDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { askConfirm } from '../../core/dialogs.js';
import { learnDislikesFromText } from '../../core/dislikes.js';
import { recordGiftGiven } from '../../core/gift-log.js';
import { GIFTS, getInventoryCounts, consumeGift } from '../../core/gifts.js';
import { charge, formatMoney } from '../../core/wallet.js';
import {
    STAGES, relationStage, effAffection, checkUnlock, interactionUnlock, chatStatsFromMessages, applyChatEstimate, setRelationship, detectRelationHint, formatWorldFacts,
    timeSlot, SCENES, sceneById, customScene, INTERACTIONS, buildDatePrompt, parseReply, renderNarration, esc,
    emptyRelation, applyAffection, finishDate, localSummary, clampDelta, clampAffection
} from './dating-data.js';

const RELATIONS_KEY = 'dating_relations';
const HISTORY_TURNS = 14; // 送給模型的最近訊息數

// 約會進行中的狀態（離開頁面時會自動收尾）
let st = freshState();
function freshState() {
    return { view: 'select', character: null, userName: '', scene: null, slot: null, messages: [], mood: '', turns: 0, startedAt: 0, startAffection: 0, busy: false, panel: false, notedCap: false };
}

let ui = { characters: [], go: () => {} }; // 目前畫面的 characters 與換頁函式（面板重畫後重新綁事件用）
let relations = {};
async function loadRelations() {
    const saved = await SettingsDB.get(RELATIONS_KEY);
    relations = saved && typeof saved === 'object' ? saved : {};
}
const relOf = id => ({ ...emptyRelation(), ...(relations[id] || {}) });
async function saveRelation(id, rel) {
    relations[id] = rel;
    await SettingsDB.set(RELATIONS_KEY, relations);
}

// 用聊天室判斷好感：統計這個角色的聊天（含 Discord 同步進來的），好感度只會被往上拉到評估值。
// 評估結果記在關係紀錄裡，6 小時內不重算（聊天室很長時避免每次都全部讀一遍）
const CHAT_REFRESH_MS = 6 * 60 * 60 * 1000;
async function readRelationHint(charId) {
    try {
        const c = await CharactersDB.getById(charId);
        if (!c) return null;
        const sources = [{ kind: 'card', name: '角色設定', text: [c.personality, c.scenario, c.description].filter(Boolean).join('\n') }];
        for (const e of [...await GlobalSettingsDB.getAll(), ...await KeywordSettingsDB.getAll()]) {
            if (e.enabled && e.content) sources.push({ kind: 'world', name: e.name, text: e.content });
        }
        return detectRelationHint({ charName: c.name, sources });
    } catch (e) {
        console.warn('[Dating] 讀取世界書失敗：', e);
        return null;
    }
}

async function refreshFromChats(charId, force = false) {
    let rel = relOf(charId);
    // 世界書／角色設定可能隨時被改，每次進關係頁都重新判斷（只是讀文字，很快）
    const hint = await readRelationHint(charId);
    if (JSON.stringify(hint) !== JSON.stringify(rel.hint || null)) { rel = { ...rel, hint }; await saveRelation(charId, rel); }
    if (!force && rel.chat && Date.now() - rel.chat.at < CHAT_REFRESH_MS) return rel;
    try {
        const chats = (await ChatsDB.getAll()).filter(c => !c.is_group && (c.character_id === charId || (c.member_ids || []).includes(charId)));
        const ids = [...new Set([...chats.map(c => c.id), charId])]; // charId：Discord 同步的訊息以角色 id 當聊天室
        const msgs = [];
        for (const id of ids) msgs.push(...await MessagesDB.getByChatId(id));
        const next = applyChatEstimate(rel, chatStatsFromMessages(msgs));
        await saveRelation(charId, next);
        return next;
    } catch (e) {
        console.warn('[Dating] 讀取聊天紀錄失敗：', e);
        return rel;
    }
}

// ───── 畫面入口 ─────
async function renderDating() {
    const container = createElement('div', 'app-container dating-app');
    await loadRelations();
    st = freshState();
    const characters = await CharactersDB.getAll();

    container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">約會</h1>
    </header>
    <div class="page dt-page" id="dating-page"></div>`;

    const page = () => container.querySelector('#dating-page');
    const go = (view) => { st.view = view; draw(); };
    ui = { characters, go };

    container.querySelector('.ios-back-btn').onclick = async () => {
        if (st.busy) return;
        if (st.view === 'date') {
            if (st.turns > 0 && !(await askConfirm('要結束這場約會嗎？\n會替你們整理一份回憶，並記錄好感度。', { title: '結束約會', confirmLabel: '結束' }))) return;
            await endDate(container, go);
        } else if (st.view === 'scenes') go('hub');
        else if (st.view === 'hub') { st.character = null; go('select'); }
        else if (st.view === 'summary') go('hub');
        else Router.back();
    };

    function draw() {
        const el = page();
        if (!el) return;
        if (st.view === 'select') el.innerHTML = viewSelect(characters);
        else if (st.view === 'hub') el.innerHTML = viewHub();
        else if (st.view === 'scenes') el.innerHTML = viewScenes();
        else if (st.view === 'date') el.innerHTML = viewDate();
        else if (st.view === 'summary') el.innerHTML = viewSummary();
        bind(container, characters, go);
        const msgs = container.querySelector('#dt-messages');
        if (msgs) msgs.scrollTop = msgs.scrollHeight;
    }
    draw();

    return {
        element: container,
        // 離開頁面時，進行到一半的約會用本地摘要收尾（不呼叫 API），好感度與回憶不會白費
        cleanup: () => { if (st.view === 'date' && st.turns > 0) endDate(null, null, { offline: true }); }
    };
}

// ───── 各畫面 ─────
const avatarHtml = (c, cls = '') => `<div class="dt-avatar ${cls}">${c.avatar ? `<img src="${esc(c.avatar)}" alt="">` : '<i class="fas fa-user"></i>'}</div>`;
const affectionBar = a => `<div class="dt-bar"><div class="dt-bar-fill" style="width:${clampAffection(a)}%"></div></div>`;

function ago(ts) {
    if (!ts) return '還沒約會過';
    const days = Math.floor((Date.now() - ts) / 86400000);
    return days <= 0 ? '今天' : days === 1 ? '昨天' : `${days} 天前`;
}

function viewSelect(characters) {
    if (!characters.length) return `<div class="dt-empty"><i class="fas fa-user-slash"></i><h2>尚無角色</h2><p>請先建立角色以開始約會</p></div>`;
    return `<div class="dt-wrap">
      <h2 class="dt-title">今天想和誰見面？</h2>
      <div class="dt-list">${characters.map(c => {
          const r = relOf(c.id), stage = relationStage(r);
          return `<button class="dt-card" data-char="${esc(c.id)}">
            ${avatarHtml(c)}
            <div class="dt-card-info">
              <h3>${esc(c.name)}<span class="dt-chip">${stage.name}</span></h3>
              <p>${esc((c.personality || '神秘的角色').slice(0, 40))}</p>
              ${affectionBar(r.affection)}
              <small>約會 ${r.dates} 次 · ${ago(r.lastDate)}</small>
            </div></button>`;
      }).join('')}</div></div>`;
}

function viewHub() {
    const c = st.character, r = relOf(c.id), stage = relationStage(r);
    const next = STAGES.find(s => !s.manual && s.min > r.affection && STAGES.indexOf(s) > STAGES.indexOf(stage));
    const chat = r.chat;
    const hist = r.history.slice(0, 5);
    return `<div class="dt-wrap">
      <div class="dt-hub">
        ${avatarHtml(c, 'dt-avatar-lg')}
        <h2>${esc(c.name)}</h2>
        <span class="dt-chip dt-chip-lg">${stage.name}</span>
        ${affectionBar(r.affection)}
        <p class="dt-muted">好感度 ${r.affection}/100${next ? ` · 再 ${next.min - r.affection} 到「${next.name}」` : ' · 已是最親密的關係'}</p>
        <p class="dt-muted">約會 ${r.dates} 次 · 上次：${ago(r.lastDate)}</p>
        ${r.note ? `<p class="dt-note">${esc(r.note)}</p>` : ''}
        ${r.hint && r.autoChat !== false ? `<p class="dt-muted">📖 依「${esc(r.hint.source)}」判斷為「${esc(STAGES.find(s => s.id === r.hint.stageId)?.name || '')}」（${esc(r.hint.snippet)}…）。不對的話到「關係設定」手動指定。</p>` : ''}
        ${chat && chat.userMsgs ? `<p class="dt-muted">聊天紀錄評估：約 ${chat.estimate}（你說了 ${chat.userMsgs} 句、聊過 ${chat.activeDays} 天${r.autoChat === false ? '，目前為手動指定' : ''}）</p>` : ''}
        <button class="dt-primary" data-act="to-scenes"><i class="fas fa-heart"></i> 開始約會</button>
        <button class="dt-link" data-act="relation"><i class="fas fa-sliders-h"></i> 關係設定</button>
      </div>
      <h3 class="dt-sub">約會回憶</h3>
      ${hist.length ? hist.map(h => `<div class="dt-memory">
          <div class="dt-memory-head"><span><i class="fas ${esc(h.icon || 'fa-heart')}"></i> ${esc(h.sceneName)}</span><span class="dt-muted">${new Date(h.endedAt).toLocaleDateString('zh-TW')} · ${h.delta >= 0 ? '+' : ''}${h.delta}</span></div>
          <p>${esc(h.summary)}</p></div>`).join('') : '<p class="dt-muted dt-center">還沒有回憶，去創造第一個吧</p>'}
    </div>`;
}

function viewScenes() {
    const r = relOf(st.character.id), now = timeSlot();
    return `<div class="dt-wrap">
      <h2 class="dt-title">要去哪裡？</h2>
      <p class="dt-muted dt-center">現在是${now.name}，標有「適合現在」的地方氣氛最好</p>
      <div class="dt-list">${SCENES.map(s => {
          const lock = checkUnlock(s.unlock, r), locked = !lock.ok;
          return `<button class="dt-card dt-scene${locked ? ' dt-locked' : ''}" data-scene="${s.id}">
            <div class="dt-scene-icon"><i class="fas ${locked ? 'fa-lock' : s.icon}"></i></div>
            <div class="dt-card-info">
              <h3>${esc(s.name)}${s.best.includes(now.id) && !locked ? '<span class="dt-chip dt-chip-hot">適合現在</span>' : ''}</h3>
              <p>${esc(s.desc)}</p>
              <small>${locked ? `解鎖條件：${lock.missing.join('、')}` : s.cost ? `預計花費 ${formatMoney(s.cost)}` : '免費'}</small>
            </div></button>`;
      }).join('')}
        <button class="dt-card dt-scene" data-scene="custom">
          <div class="dt-scene-icon"><i class="fas fa-map-marker-alt"></i></div>
          <div class="dt-card-info"><h3>自訂地點</h3><p>想去的任何地方，自己描述</p><small>免費</small></div>
        </button>
      </div></div>`;
}

function headerHtml() {
    const c = st.character, r = relOf(c.id), stage = relationStage(r);
    return `<div class="dt-head">
      ${avatarHtml(c)}
      <div class="dt-head-info">
        <h3>${esc(c.name)}<span class="dt-chip">${stage.name}</span>${st.mood ? `<span class="dt-chip dt-chip-mood">${esc(st.mood)}</span>` : ''}</h3>
        ${affectionBar(r.affection)}
        <small id="dt-aff-label">好感度 ${r.affection}%</small>
      </div>
      <div class="dt-badge"><i class="fas ${esc(st.scene.icon)}"></i> ${esc(st.scene.name)} · ${esc(st.slot.name)}</div>
    </div>`;
}

function messageHtml(m) {
    if (m.hidden) return '';
    if (m.role === 'narration') return `<div class="dt-narration">${renderNarration(m.content)}</div>`;
    if (m.role === 'assistant') return `<div class="dt-msg dt-them">${avatarHtml(st.character, 'dt-avatar-sm')}<div class="dt-bubble">${renderNarration(m.content)}</div></div>`;
    return `<div class="dt-msg dt-me"><div class="dt-bubble${m.kind === 'action' ? ' dt-bubble-act' : ''}">${renderNarration(m.content)}</div></div>`;
}

function panelHtml() {
    const rel = relOf(st.character.id);
    return `<div class="dt-panel" id="dt-panel"${st.panel ? '' : ' hidden'}>
      <div class="dt-panel-title">這裡可以做的事</div>
      <div class="dt-chips">${st.scene.activities.map(a => `<button class="dt-act-btn" data-activity="${a.id}"><i class="fas ${esc(a.icon)}"></i> ${esc(a.name)}</button>`).join('')}</div>
      <div class="dt-panel-title">互動</div>
      <div class="dt-chips">${INTERACTIONS.map(i => {
          const lock = checkUnlock(interactionUnlock(i), rel);
          return lock.ok
              ? `<button class="dt-act-btn" data-interaction="${i.id}"><i class="fas ${i.icon}"></i> ${i.name}</button>`
              : `<button class="dt-act-btn dt-locked" disabled title="${esc(lock.missing.join('、'))}"><i class="fas fa-lock"></i> ${i.name}</button>`;
      }).join('')}</div>
      <div class="dt-lock-hint">${(() => { const n = INTERACTIONS.find(i => !checkUnlock(interactionUnlock(i), rel).ok); return n ? `下一個互動「${esc(n.name)}」：${esc(checkUnlock(interactionUnlock(n), rel).missing.join('、'))}` : ''; })()}</div>
      <div class="dt-panel-title">其他</div>
      <div class="dt-chips">
        <button class="dt-act-btn" data-act="gift"><i class="fas fa-gift"></i> 送禮</button>
        <button class="dt-act-btn" data-act="event"><i class="fas fa-dice"></i> 小插曲</button>
        <button class="dt-act-btn dt-end" data-act="end"><i class="fas fa-door-open"></i> 結束約會</button>
      </div></div>`;
}

function viewDate() {
    return `<div class="dt-date">
      ${headerHtml()}
      <div class="dt-messages" id="dt-messages">${st.messages.map(messageHtml).join('')}</div>
      ${panelHtml()}
      <div class="dt-input-area">
        <button class="dt-plus" data-act="toggle-panel" aria-label="更多動作"><i class="fas fa-plus"></i></button>
        <input type="text" id="dt-input" placeholder="說點什麼…（也可以用（）描寫動作）" maxlength="500">
        <button class="dt-send" data-act="send" aria-label="送出"><i class="fas fa-paper-plane"></i></button>
      </div></div>`;
}

function viewSummary() {
    const s = st.summary;
    return `<div class="dt-wrap dt-center">
      <div class="dt-summary-icon"><i class="fas ${esc(s.icon)}"></i></div>
      <h2>${esc(s.sceneName)}的約會結束了</h2>
      <p class="dt-muted">${esc(s.slotName)} · ${s.turns} 輪對話</p>
      <div class="dt-memory dt-memory-big"><p>${esc(s.summary)}</p></div>
      <div class="dt-delta">好感度 ${s.before} → <b>${s.after}</b> <span class="${s.delta >= 0 ? 'dt-up' : 'dt-down'}">(${s.delta >= 0 ? '+' : ''}${s.delta})</span></div>
      ${s.stageUp ? `<div class="dt-stage-up">💞 你們的關係進展到了「${esc(s.stageUp)}」</div>` : ''}
      <button class="dt-primary" data-act="to-hub"><i class="fas fa-heart"></i> 回到 ${esc(st.character.name)}</button>
    </div>`;
}

// ───── 事件 ─────
function bind(container, characters, go) {
    const on = (sel, fn) => container.querySelectorAll(sel).forEach(el => { el.onclick = e => fn(el, e); });

    on('[data-char]', async el => {
        const c = characters.find(x => x.id === el.dataset.char) || await CharactersDB.getById(el.dataset.char);
        if (!c) return;
        st.character = c;
        await refreshFromChats(c.id);
        go('hub');
    });
    on('[data-act="relation"]', () => openRelationSheet(container, go));
    on('[data-act="to-scenes"]', () => go('scenes'));
    on('[data-act="to-hub"]', () => go('hub'));

    on('[data-scene]', async el => {
        if (el.dataset.scene === 'custom') return askCustomScene(container, scene => startDate(container, go, scene));
        const scene = sceneById(el.dataset.scene);
        if (!scene) return;
        const lock = checkUnlock(scene.unlock, relOf(st.character.id));
        if (!lock.ok) return createToast(`還不能去這裡：${lock.missing.join('、')}`, 'info');
        await startDate(container, go, scene);
    });

    on('[data-act="toggle-panel"]', () => {
        st.panel = !st.panel;
        const p = container.querySelector('#dt-panel');
        if (p) p.hidden = !st.panel;
    });
    on('[data-activity]', async el => {
        const a = st.scene.activities.find(x => x.id === el.dataset.activity);
        if (a) await act(container, { display: `（${a.text}）`, api: `（${a.text}）`, base: a.delta });
    });
    on('[data-interaction]', async el => {
        const i = INTERACTIONS.find(x => x.id === el.dataset.interaction);
        if (i) await act(container, { display: `（${i.text}）`, api: `（${i.text}）`, base: i.delta });
    });
    on('[data-act="gift"]', () => openGifts(container));
    on('[data-act="event"]', async () => {
        const ev = st.scene.events[Math.floor(Math.random() * st.scene.events.length)];
        await act(container, { narration: ev, api: `（旁白：${ev}）`, base: 0 });
    });
    on('[data-act="end"]', async () => {
        if (st.busy) return;
        if (st.turns === 0 || await askConfirm('要結束這場約會嗎？\n會替你們整理一份回憶，並記錄好感度。', { title: '結束約會', confirmLabel: '結束' })) await endDate(container, go);
    });

    const input = container.querySelector('#dt-input');
    const send = async () => {
        const text = input.value.trim();
        if (!text || st.busy) return;
        input.value = '';
        learnDislikesFromText(text, 'dating');
        await act(container, { display: text, api: text, base: 1, kind: 'talk' });
    };
    on('[data-act="send"]', send);
    if (input) input.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) send(); };
}

// 關係設定：自動（依聊天紀錄）或直接指定目前的關係，並補充一段說明給角色參考
function openRelationSheet(container, go) {
    const c = st.character, r = relOf(c.id);
    const current = r.autoChat === false || r.stageFloor ? (r.stageFloor || relationStage(r).id) : 'auto';
    const sheet = openSheet(container, `
      <h3 class="dt-sub">和${esc(c.name)}的關係</h3>
      <p class="dt-muted">選「自動」會依你們的聊天紀錄判斷好感度（只會往上調），也會讀世界書與角色設定裡寫的關係（例如「已婚」）。如果判斷得不對，或你們已經是別的關係，可以直接指定，例如交往中或已婚；指定後會解鎖該階段的場景與互動，並且不再採用世界書的判斷。</p>
      <select id="dt-rel-stage">
        <option value="auto"${current === 'auto' ? ' selected' : ''}>自動（依聊天紀錄）</option>
        ${STAGES.map(s => `<option value="${s.id}"${current === s.id ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}
      </select>
      <textarea id="dt-rel-note" rows="3" maxlength="300" placeholder="補充說明（選填），例如：從小一起長大的青梅竹馬，已經同居兩年">${esc(r.note || '')}</textarea>
      <button class="dt-primary" id="dt-rel-save">儲存</button>`);
    sheet.querySelector('#dt-rel-save').onclick = async () => {
        const stageId = sheet.querySelector('#dt-rel-stage').value;
        const note = sheet.querySelector('#dt-rel-note').value;
        let stats = null;
        if (stageId === 'auto') {
            await refreshFromChats(c.id, true);
            const cached = relOf(c.id).chat;
            stats = cached ? { userMsgs: cached.userMsgs, activeDays: cached.activeDays, lastAt: Date.now() } : null;
        }
        await saveRelation(c.id, setRelationship(relOf(c.id), { stageId, note }, stats));
        sheet.closest('.dt-overlay').remove();
        createToast('關係設定已儲存');
        go('hub');
    };
}

function askCustomScene(container, onPick) {
    const sheet = openSheet(container, `
      <h3 class="dt-sub">自訂約會地點</h3>
      <input type="text" id="dt-cs-name" placeholder="地點名稱，例如：小時候的操場" maxlength="20">
      <textarea id="dt-cs-desc" placeholder="描述這個地方的樣子與氣氛（選填）" maxlength="200" rows="3"></textarea>
      <button class="dt-primary" id="dt-cs-go">出發</button>`);
    sheet.querySelector('#dt-cs-go').onclick = () => {
        const scene = customScene(sheet.querySelector('#dt-cs-name').value, sheet.querySelector('#dt-cs-desc').value);
        sheet.closest('.dt-overlay').remove();
        onPick(scene);
    };
}

function openSheet(container, html) {
    container.querySelector('.dt-overlay')?.remove();
    const overlay = createElement('div', 'dt-overlay');
    overlay.innerHTML = `<div class="dt-sheet">${html}<button class="dt-sheet-close" aria-label="關閉">取消</button></div>`;
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };
    overlay.querySelector('.dt-sheet-close').onclick = () => overlay.remove();
    container.appendChild(overlay);
    return overlay.querySelector('.dt-sheet');
}

async function openGifts(container) {
    if (st.busy) return;
    const counts = await getInventoryCounts();
    const owned = GIFTS.filter(g => counts[g.id] > 0);
    const sheet = openSheet(container, owned.length
        ? `<h3 class="dt-sub">送一份禮物</h3><div class="dt-chips">${owned.map(g => `<button class="dt-act-btn dt-gift" data-gift="${g.id}">${g.icon} ${esc(g.name)} ×${counts[g.id]}</button>`).join('')}</div>`
        : `<h3 class="dt-sub">送一份禮物</h3><p class="dt-muted">背包裡還沒有禮物。到「禮物商店」買一份再來吧。</p>`);
    sheet.querySelectorAll('[data-gift]').forEach(b => {
        b.onclick = async () => {
            const g = GIFTS.find(x => x.id === b.dataset.gift);
            sheet.closest('.dt-overlay').remove();
            if (!g || !(await consumeGift(g.id))) return createToast('這份禮物已經沒有了', 'error');
            recordGiftGiven({ characterId: st.character.id, charName: st.character.name, gift: g });
            await act(container, { display: `（把${g.icon}${g.name}遞給對方）`, api: `（把${g.name}送給對方）`, base: 0, kind: 'action', gift: g });
        };
    });
}

// ───── 開始／進行／結束 ─────
async function startDate(container, go, scene) {
    const c = st.character;
    if (scene.cost > 0) {
        // 共同基金夠付的話，先問要不要用基金付（選「從錢包付」就走原本的扣款）
        const { getFund, spendFromFund } = await import('../../core/fund-store.js');
        const fund = await getFund(c.id).catch(() => null);
        const byFund = fund && fund.balance >= scene.cost
            && await askConfirm(`你們的共同基金有 ${formatMoney(fund.balance)}，約會預計花 ${formatMoney(scene.cost)}。\n要用共同基金付嗎？`, { title: '付款方式', confirmLabel: '用共同基金', cancelLabel: '從錢包付' });
        if (!byFund && !(await askConfirm(`在${scene.name}約會預計花費 ${formatMoney(scene.cost)}（從錢包扣款）。\n要出發嗎？`, { title: '出發', confirmLabel: '出發' }))) return;
        try {
            if (byFund) await spendFromFund(c.id, scene.cost, `約會：${scene.name}`);
            else await charge(scene.cost, `約會：${scene.name}`, { category: 'dating' });
        } catch (e) { return createToast(e?.message || '扣款失敗', 'error'); }
    }
    const user = c.bound_user_id ? await UsersDB.getById(c.bound_user_id).catch(() => null) : null;
    const rel = relOf(c.id);
    st = { ...freshState(), view: 'date', character: c, userName: user?.name || '', scene, slot: timeSlot(), startedAt: Date.now(), startAffection: rel.affection };
    go('date');
    // 開場：旁白讓角色先反應（這則不顯示）
    st.messages.push({ role: 'user', hidden: true, api: `（旁白：你們約好在${st.slot.name}的${scene.name}見面。見面的瞬間開始。）` });
    await reply(container, { base: 0, opening: true });
}

async function act(container, { display, narration, api, base = 1, kind = 'action', gift = null }) {
    if (st.busy) return;
    if (narration) st.messages.push({ role: 'narration', content: narration, api });
    else st.messages.push({ role: 'user', content: display, api, kind });
    st.turns++;
    refreshMessages(container);
    await reply(container, { base, gift });
}

function refreshMessages(container) {
    const msgs = container.querySelector('#dt-messages');
    if (!msgs) return;
    msgs.innerHTML = st.messages.map(messageHtml).join('');
    msgs.scrollTop = msgs.scrollHeight;
}

function setBusy(container, busy) {
    st.busy = busy;
    container.querySelectorAll('.dt-input-area button, .dt-input-area input, .dt-panel button').forEach(el => { el.disabled = busy || (el.classList.contains('dt-locked')); });
    const msgs = container.querySelector('#dt-messages');
    if (!msgs) return;
    msgs.querySelector('.dt-typing')?.remove();
    if (busy) {
        const t = document.createElement('div');
        t.className = 'dt-msg dt-them dt-typing';
        t.innerHTML = `${avatarHtml(st.character, 'dt-avatar-sm')}<div class="dt-bubble"><span class="dt-dot"></span><span class="dt-dot"></span><span class="dt-dot"></span></div>`;
        msgs.appendChild(t);
        msgs.scrollTop = msgs.scrollHeight;
    }
}

// 給模型的訊息：旁白與動作都以使用者的話送出（模型只有 user／assistant 兩種角色要處理）；local 是只給畫面看的系統提示，不送出
function apiHistory() {
    return st.messages.filter(m => !m.local).slice(-HISTORY_TURNS).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.api || m.content }));
}

async function reply(container, { base = 1, gift = null, opening = false }) {
    const c = st.character;
    setBusy(container, true);
    let text = '', delta = null, mood = null;
    try {
        const settings = await SettingsDB.getAll();
        if (!settings.api_url || !settings.api_key) throw new Error('NO_API');
        const last = st.messages[st.messages.length - 1];
        const recentText = st.messages.filter(m => !m.local).slice(-4).map(m => m.api || m.content).join('\n');
        const ctx = await buildAppContext({ characterId: c.id, userMessage: (last.content || last.api || '').replace(/[（）]/g, ''), keywordText: [recentText, st.scene.name, st.scene.desc, relOf(c.id).note].join('\n') });
        const system = [ctx.systemPrompt, buildDatePrompt({ charName: c.name, userName: st.userName, scene: st.scene, slot: st.slot, affection: effAffection(relOf(c.id)), stage: relationStage(relOf(c.id)), note: relOf(c.id).note, worldFacts: formatWorldFacts(ctx.worldInfo), cardFacts: [c.personality && `性格：${String(c.personality).slice(0, 600)}`, c.scenario && `背景：${String(c.scenario).slice(0, 600)}`].filter(Boolean).join('\n'), mood: st.mood, turns: opening ? 0 : st.turns, gift })].filter(Boolean).join('\n\n');
        const raw = await APIClient.complete([{ role: 'system', content: system }, ...apiHistory()], { temperature: 0.9, maxTokens: 800 });
        ({ text, delta, mood } = parseReply(raw));
    } catch (e) {
        if (e?.message !== 'NO_API') createToast('取得回應失敗：' + (e?.message || e), 'error');
        else if (!st.notedApi) { st.notedApi = true; createToast('還沒設定 AI，先用預設的回應（到設定 → API 設定）', 'info'); }
        text = fallbackLine(opening, base);
    }
    if (!text) text = fallbackLine(opening, base);
    st.messages.push({ role: 'assistant', content: text });
    if (mood) st.mood = mood;

    // 好感度：以角色這一輪的感受為準；模型沒給就用動作的基本值（開場不變動）
    // 送禮只是一種往來：這一輪不算好感度的增減（反應與記憶照常）
    const raw = opening || gift ? 0 : (delta ?? clampDelta(base));
    const before = relOf(c.id);
    const res = applyAffection(before, raw);
    await saveRelation(c.id, res.relation);
    const stageBefore = relationStage(before), stageAfter = relationStage(res.relation);
    if (stageAfter.id !== stageBefore.id && res.applied > 0) st.messages.push({ role: 'narration', local: true, content: `💞 你們的關係進展到了「${stageAfter.name}」` });
    if (res.capped && !st.notedCap) { st.notedCap = true; st.messages.push({ role: 'narration', local: true, content: '今天已經相處得很開心了，好感度明天再繼續累積吧。' }); }

    setBusy(container, false);
    const el = container.querySelector('.dt-date');
    if (el && st.view === 'date') {
        el.querySelector('.dt-head').outerHTML = headerHtml();
        el.querySelector('#dt-panel').outerHTML = panelHtml();
        if (el.querySelector('#dt-panel')) el.querySelector('#dt-panel').hidden = !st.panel;
        refreshMessages(container);
        rebindPanel(container);
    }
}

// 面板內容重畫後，按鈕要重新綁事件
function rebindPanel(container) {
    bind(container, ui.characters, ui.go);
}

function fallbackLine(opening, base) {
    const c = st.character, stage = relationStage(relOf(c.id));
    if (opening) return `（${c.name}早一步到了，看見你便微微揚起嘴角）「來了啊。${st.scene.name}的氣氛還不錯，我們慢慢逛吧。」`;
    const pool = {
        stranger: [`（${c.name}禮貌地點點頭）「嗯，我明白你的意思。」`, `（${c.name}看向周圍，輕輕笑了笑）「這裡的感覺不錯呢。」`],
        friend: [`（${c.name}笑著看你）「哈哈，你這個人真有趣。」`, `（${c.name}放鬆地靠近了一點）「跟你在一起很自在。」`],
        close: [`（${c.name}別開視線，耳根有些泛紅）「……你這樣說，我會不好意思的。」`, `（${c.name}偷偷看了你一眼）「我也很喜歡今天。」`],
        lover: [`（${c.name}自然地靠近你）「有你在身邊，我就很安心。」`, `（${c.name}握緊了你的手）「今天真的很幸福。」`]
    }[stage.id] || ['（對方笑了笑）「嗯。」'];
    return pool[Math.floor(Math.random() * pool.length)];
}

async function endDate(container, go, { offline = false } = {}) {
    const c = st.character, scene = st.scene, slot = st.slot, turns = st.turns;
    if (!c || !scene) { if (go) go('hub'); return; }
    const rel0 = relOf(c.id);
    const before = st.startAffection, after = rel0.affection;
    const stageUp = relationStage({ ...rel0, affection: after }).id !== relationStage({ ...rel0, affection: before }).id && after > before ? relationStage(rel0).name : '';
    let summary = localSummary({ scene, slot, turns, before, after });

    if (turns > 0 && !offline) {
        const wait = container?.querySelector('.dt-date');
        if (wait) wait.insertAdjacentHTML('beforeend', '<div class="dt-overlay dt-wait"><div class="dt-sheet dt-center">正在整理這次約會的回憶…</div></div>');
        st.busy = true;
        try {
            const settings = await SettingsDB.getAll();
            if (settings.api_url && settings.api_key) {
                const transcript = st.messages.filter(m => !m.hidden).slice(-24).map(m => `${m.role === 'assistant' ? c.name : '對方'}：${(m.api || m.content).slice(0, 200)}`).join('\n');
                const out = await APIClient.complete([
                    { role: 'system', content: `你是「${c.name}」。請以第一人稱，用 2 到 3 句話寫下今天和${st.userName || '對方'}在${scene.name}（${slot.name}）約會的回憶：要有具體發生的事與你當下的感受，語氣符合你的個性。只輸出回憶本身。` },
                    { role: 'user', content: transcript }
                ], { temperature: 0.7, maxTokens: 300 });
                if (out.trim()) summary = out.trim();
            }
        } catch (_) { /* 摘要失敗就用本地的 */ }
        st.busy = false;
    }

    if (turns > 0) {
        const entry = { id: 'd' + Date.now(), sceneId: scene.id, sceneName: scene.name, icon: scene.icon, startedAt: st.startedAt, endedAt: Date.now(), turns, before, after, delta: after - before, summary };
        await saveRelation(c.id, finishDate(relOf(c.id), entry));
        // 一場約會只記一則記憶（不是每句話都記）；好感變化大或關係進展時更重要
        await saveInteractionMemory({
            characterId: c.id, sourceApp: 'dating', sourceType: 'interaction', sourceSubtype: 'dating',
            content: `和${st.userName || '對方'}在${scene.name}約會（${slot.name}）。${summary}（好感度 ${before}→${after}${stageUp ? `，關係進展到「${stageUp}」` : ''}）`,
            metaContent: `在${scene.name}約會：${summary.slice(0, 40)}`,
            importance: Math.min(0.9, 0.5 + Math.max(0, after - before) / 40 + (stageUp ? 0.15 : 0))
        }).catch(() => {});
    }

    const summaryData = { sceneName: scene.name, icon: scene.icon, slotName: slot.name, turns, summary, before, after, delta: after - before, stageUp };
    const character = c;
    st = { ...freshState(), view: 'summary', character, summary: summaryData };
    if (go) go(turns > 0 ? 'summary' : 'hub');
}

export default {
    id: 'dating',
    name: '約會',
    icon: 'heart_plus',
    routes: [{ path: '/dating', render: renderDating }],
    navItem: { label: '約會', icon: 'heart_plus', path: '/dating', showInNav: true, order: 110 },
    stylesPath: 'js/apps/dating/style.css'
};
