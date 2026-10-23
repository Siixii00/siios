import Router from '../../router.js';
import { createElement, createIOSNavBar, createToast } from '../../components.js';
import { askConfirm } from '../../core/dialogs.js';
import { CharactersDB, SettingsDB } from '../../db.js';
import APIClient from '../../api.js';
import worldbookInstaller from '../../core/worldbook-installer.js';
import { parseWorldbookText } from '../../core/worldbook-parser.js';
import { parseImport, parseTranscript } from '../../core/importers/parse.js';
import { planSend, buildChatRecipeMessages, parseChatRecipe, buildCharacterMessages, parseCharacterResponse } from '../../core/importers/ai-assist.js';
import { applyImport } from '../../core/importers/apply.js';
import { memorySettingsFrom } from '../../core/memory-system/index.js';

// 匯入其他來源：SillyTavern 角色卡／聊天、ChatGPT／Claude 匯出、純文字對話。
// 先在本機解析；認不得的格式才可以（經你同意）把一小段樣本交給你自己設定的 AI。
const FIELD = 'width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:15px;background:#fff;';
const BTN = 'padding:10px 14px;border-radius:8px;background:#fff;border:1px solid #ddd;font-size:15px;';
const PRIMARY = 'width:100%;padding:12px;font-size:16px;border-radius:8px;border:none;background:#fee500;color:#3c1e1e;font-weight:600;margin-top:12px;';
const dateRange = msgs => {
    const ts = msgs.map(m => m.time).filter(t => t != null);
    if (!ts.length) return '';
    const f = t => new Date(t).toLocaleDateString('sv');
    const a = f(Math.min(...ts)), b = f(Math.max(...ts));
    return a === b ? a : `${a} ～ ${b}`;
};
const hostOf = url => { try { return new URL(url).host; } catch (_) { return url || '（未設定）'; } };

async function renderImportSettings() {
    const container = createElement('div', 'app-container bg-ios-bg');
    container.appendChild(createIOSNavBar({ title: '匯入其他來源', backPath: '/settings' }));
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.padding = '16px';
    container.appendChild(main);

    const state = { sources: [], cards: [], chats: [], messages: [], existing: [] };
    let seq = 0;

    main.appendChild(createElement('div', 'text-sm text-ios-muted', {
        textContent: '把原本在 SillyTavern、ChatGPT、Claude 或其他地方的角色與聊天紀錄搬過來。支援：Tavern 角色卡（JSON／PNG）、SillyTavern 聊天（.jsonl）、ChatGPT／Claude 匯出的 conversations.json、純文字對話（「名字：內容」）。認得的格式完全在本機轉換，不會送到任何地方。'
    }));

    const fileInput = createElement('input', '', { type: 'file' });
    fileInput.accept = '.json,.jsonl,.txt,.md,.png,text/plain,application/json,image/png';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    const pick = createElement('button', 'ios-btn', { textContent: '選擇檔案（可多選）' });
    pick.style.cssText = BTN + 'margin-top:12px;';
    pick.onclick = () => fileInput.click();
    const paste = createElement('textarea', 'ios-input', { placeholder: '或在這裡貼上文字（對話紀錄、角色設定…）' });
    paste.rows = 6;
    paste.style.cssText = FIELD + 'margin-top:10px;resize:vertical;';
    const parseBtn = createElement('button', 'ios-btn', { textContent: '解析貼上的文字' });
    parseBtn.style.cssText = BTN + 'margin-top:8px;';
    main.append(fileInput, pick, paste, parseBtn);

    const out = createElement('div');
    main.appendChild(out);

    async function addSource(src) {
        const parsed = parseImport(src);
        const id = ++seq;
        state.sources.push({ id, name: src.name || '貼上的文字', text: src.text || '', parsed });
        ingest(id, parsed);
    }

    function ingest(sourceId, parsed) {
        parsed.characters.forEach(c => state.cards.push({ key: `c${sourceId}_${state.cards.length}`, sourceId, draft: c, checked: true, importBook: !!c.book }));
        parsed.chats.forEach((ch, i) => {
            if (!ch.messages.length) return;
            state.chats.push({ key: `h${sourceId}_${i}_${state.chats.length}`, sourceId, chat: ch, checked: true, toMemory: true, target: null });
        });
    }

    // 預設對應：同名的現有角色 → 這次一起匯入的同名角色卡 → 新建一個
    function defaultTarget(item) {
        const name = item.chat.characterName;
        const ex = state.existing.find(c => c.name === name);
        if (ex) return 'ex:' + ex.id;
        const card = state.cards.find(c => c.draft.name === name);
        if (card) return 'card:' + card.key;
        return 'new';
    }

    async function aiAssist(source, mode) {
        const settings = await SettingsDB.getAll();
        if (!settings.api_url || !settings.api_key) { createToast('請先到「設定 → 聊天 API 串接」填好 API', 'error'); return; }
        const plan = planSend(source.text, mode);
        const what = mode === 'chat' ? `檔案開頭的 ${plan.chars} 字樣本（用來判斷格式，整份內容仍在本機處理）` : `${plan.chars} 字的文字內容${plan.truncated ? `（超過 ${plan.limit} 字的部分不會送出）` : ''}`;
        if (!await askConfirm(`將把${what}，送到你設定的 AI 服務（${hostOf(settings.api_url)}）請它協助分析。這份內容可能包含私人資訊，確定要送出嗎？`, { title: '交給 AI 分析', confirmLabel: '送出', cancelLabel: '不要' })) return;
        try {
            const messages = mode === 'chat' ? buildChatRecipeMessages(plan.sample) : buildCharacterMessages(plan.sample);
            const reply = await APIClient.complete(messages, { temperature: 0.1, maxTokens: mode === 'chat' ? 400 : 1200 });
            if (mode === 'chat') {
                const recipe = parseChatRecipe(reply);
                const t = recipe ? parseTranscript(source.text, { recipe }) : null;
                if (!t || !t.chats.length) { createToast('AI 給的規則無法套用到這份檔案', 'error'); return; }
                source.parsed = t;
            } else {
                const c = parseCharacterResponse(reply);
                if (!c) { createToast('AI 沒有整理出可用的角色資料', 'error'); return; }
                source.parsed = { ...source.parsed, format: 'ai-character', formatLabel: 'AI 整理的角色設定', characters: [c], chats: [] };
            }
            ingest(source.id, source.parsed);
            render();
        } catch (e) { createToast('AI 分析失敗：' + (e?.message || e), 'error'); }
    }

    function sourceRow(s) {
        const row = createElement('div', 'ios-list-cell ios-list-cell-full');
        row.style.cssText = 'padding:10px 12px;display:block;';
        row.appendChild(createElement('div', 'text-base font-semibold', { textContent: s.name }));
        const p = s.parsed;
        const found = [p.characters.length ? `${p.characters.length} 個角色` : '', p.chats.length ? `${p.chats.length} 段聊天` : ''].filter(Boolean).join('、');
        row.appendChild(createElement('div', 'text-xs text-ios-muted', { textContent: `${p.formatLabel}${found ? '：' + found : ''}` }));
        (p.warnings || []).forEach(w => row.appendChild(createElement('div', 'text-xs', { textContent: '⚠ ' + w })));
        if (p.format === 'ours') {
            row.appendChild(createElement('div', 'text-sm', { textContent: '這是 SXIOS 自己的備份檔，請用「設定 → 資料備份與還原」還原。' }));
        } else if (p.format === 'unknown' && s.text) {
            row.appendChild(createElement('div', 'text-sm', { textContent: '本機認不得這個格式。可以請你設定的 AI 幫忙（會先告訴你要送出什麼，經你同意才送）：' }));
            const b1 = createElement('button', 'ios-btn', { textContent: '當作聊天紀錄，請 AI 分析格式' });
            b1.style.cssText = BTN + 'margin:6px 6px 0 0;';
            b1.onclick = () => aiAssist(s, 'chat');
            const b2 = createElement('button', 'ios-btn', { textContent: '當作角色設定，請 AI 整理' });
            b2.style.cssText = BTN + 'margin-top:6px;';
            b2.onclick = () => aiAssist(s, 'character');
            row.append(b1, b2);
        }
        return row;
    }

    function render() {
        out.innerHTML = '';
        if (!state.sources.length) return;
        const srcList = createElement('div', 'ios-grouped-list');
        srcList.style.marginTop = '16px';
        state.sources.forEach(s => srcList.appendChild(sourceRow(s)));
        out.appendChild(srcList);

        state.chats.forEach(it => { if (!it.target) it.target = defaultTarget(it); });

        if (state.cards.length) {
            out.appendChild(createElement('div', 'text-base font-semibold', { textContent: '角色' })).style.marginTop = '16px';
            const list = createElement('div', 'ios-grouped-list');
            state.cards.forEach(c => {
                const cell = createElement('label', 'ios-list-cell ios-list-cell-full');
                cell.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:10px 12px;';
                const cb = createElement('input', '', { type: 'checkbox' });
                cb.checked = c.checked;
                cb.onchange = () => { c.checked = cb.checked; };
                const body = createElement('div', 'flex-1');
                body.style.minWidth = '0';
                body.appendChild(createElement('div', 'text-base font-semibold', { textContent: c.draft.name }));
                body.appendChild(createElement('div', 'text-sm text-ios-muted', { textContent: (c.draft.description || c.draft.personality || '（沒有說明）').slice(0, 70).replace(/\s+/g, ' ') }));
                if (c.draft.book) {
                    const bl = createElement('label', 'text-xs');
                    bl.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:4px;';
                    const bcb = createElement('input', '', { type: 'checkbox' });
                    bcb.checked = c.importBook;
                    bcb.onchange = () => { c.importBook = bcb.checked; };
                    bl.append(bcb, createElement('span', '', { textContent: `一併匯入附帶的世界書（${c.draft.book.entries.length} 條）` }));
                    body.appendChild(bl);
                }
                cell.append(cb, body);
                list.appendChild(cell);
            });
            out.appendChild(list);
        }

        if (state.chats.length) {
            out.appendChild(createElement('div', 'text-base font-semibold', { textContent: '聊天紀錄' })).style.marginTop = '16px';
            const list = createElement('div', 'ios-grouped-list');
            state.chats.forEach(it => {
                const cell = createElement('div', 'ios-list-cell ios-list-cell-full');
                cell.style.cssText = 'padding:10px 12px;display:block;';
                const top = createElement('label');
                top.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
                const cb = createElement('input', '', { type: 'checkbox' });
                cb.checked = it.checked;
                cb.onchange = () => { it.checked = cb.checked; };
                const t = createElement('div', 'flex-1');
                t.style.minWidth = '0';
                t.appendChild(createElement('div', 'text-base font-semibold', { textContent: it.chat.title }));
                t.appendChild(createElement('div', 'text-xs text-ios-muted', { textContent: `${it.chat.messages.length} 則訊息${dateRange(it.chat.messages) ? ' · ' + dateRange(it.chat.messages) : ''} · 你是「${it.chat.userName}」` }));
                top.append(cb, t);
                const sel = createElement('select', 'ios-input');
                sel.style.cssText = FIELD + 'margin-top:8px;';
                const opts = [['new', `新建角色「${it.chat.characterName}」`]];
                state.cards.forEach(c => opts.push(['card:' + c.key, `使用匯入的角色卡「${c.draft.name}」`]));
                state.existing.forEach(c => opts.push(['ex:' + c.id, `放進現有角色「${c.name}」`]));
                opts.forEach(([v, l]) => sel.appendChild(createElement('option', '', { value: v, textContent: l })));
                sel.value = opts.some(o => o[0] === it.target) ? it.target : 'new';
                it.target = sel.value;
                sel.onchange = () => { it.target = sel.value; };
                const ml = createElement('label', 'text-sm');
                ml.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:8px;';
                const mcb = createElement('input', '', { type: 'checkbox' });
                mcb.checked = it.toMemory;
                mcb.onchange = () => { it.toMemory = mcb.checked; };
                ml.append(mcb, createElement('span', '', { textContent: '同時整理成記憶（角色才會記得這些舊事）' }));
                cell.append(top, sel, ml);
                list.appendChild(cell);
            });
            out.appendChild(list);
            out.appendChild(createElement('div', 'text-xs text-ios-muted', {
                textContent: '「整理成記憶」會先把對話切成段落存起來（只做本機標記，不會送出任何東西）。之後在「設定 → 聊天 API 串接 → 記憶系統」按「立即消化記憶」，才會用你的 API 把它們整理成分類好的記憶（類型、領域、重要度、意義）。'
            })).style.marginTop = '8px';
            const maskLabel = createElement('label', 'text-sm');
            maskLabel.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:10px;';
            const mask = createElement('input', '', { type: 'checkbox' });
            mask.id = 'imp-mask';
            maskLabel.append(mask, createElement('span', '', { textContent: `順便建立使用者面具「${state.chats[0].chat.userName}」` }));
            out.appendChild(maskLabel);
        }

        const hasWork = state.cards.length || state.chats.length;
        if (hasWork) {
            const go = createElement('button', 'ios-btn', { textContent: '開始匯入' });
            go.style.cssText = PRIMARY;
            go.onclick = () => doImport(go);
            const clear = createElement('button', 'ios-btn', { textContent: '清除重來' });
            clear.style.cssText = BTN + 'width:100%;margin-top:8px;';
            clear.onclick = () => { state.sources = []; state.cards = []; state.chats = []; render(); };
            out.append(go, clear);
        }
    }

    async function doImport(btn) {
        btn.disabled = true; btn.textContent = '匯入中…';
        try {
            const cardsChosen = state.cards.filter(c => c.checked);
            const items = [];
            const drafts = new Map(); // 為「新建」的聊天角色，同名只建一次
            for (const c of cardsChosen) items.push({ character: { draft: c.draft }, parsedChat: null });
            for (const it of state.chats.filter(x => x.checked)) {
                let character;
                if (it.target.startsWith('ex:')) character = { id: it.target.slice(3) };
                else if (it.target.startsWith('card:')) {
                    const card = state.cards.find(c => c.key === it.target.slice(5));
                    if (card) { if (!card.checked) items.push({ character: { draft: card.draft }, parsedChat: null }); character = { draft: card.draft }; }
                }
                if (!character) {
                    const name = it.chat.characterName;
                    if (!drafts.has(name)) drafts.set(name, { name, description: '', personality: '', scenario: '', first_message: '', avatar: '', tags: [] });
                    character = { draft: drafts.get(name) };
                }
                items.push({ character, parsedChat: it.chat, userName: it.chat.userName, toMemory: it.toMemory });
            }
            // 角色卡「只匯入角色」的那些項目會在 applyImport 內以同一個 draft 去重，所以重複出現也只會建一次
            const mask = container.querySelector('#imp-mask');
            const result = await applyImport({ items, createUserMask: !!mask?.checked, userName: state.chats[0]?.chat.userName }, {});
            let books = 0;
            for (const c of cardsChosen.filter(x => x.importBook && x.draft.book)) {
                const wb = parseWorldbookText(JSON.stringify(c.draft.book), { fileName: c.draft.name });
                if (wb.entries.length) { const r = await worldbookInstaller.importEntries(wb.entries, 'skip'); books += r.created; }
            }
            showDone(result, books);
        } catch (e) {
            createToast('匯入失敗：' + (e?.message || e), 'error');
            btn.disabled = false; btn.textContent = '開始匯入';
        }
    }

    function showDone(r, books) {
        out.innerHTML = '';
        const box = createElement('div', 'ios-grouped-list');
        box.style.cssText = 'margin-top:16px;padding:14px;';
        box.appendChild(createElement('div', 'text-base font-semibold', { textContent: '匯入完成' }));
        box.appendChild(createElement('div', 'text-sm', {
            textContent: `新增 ${r.characters} 個角色、${r.chats} 個聊天室（${r.messages} 則訊息）${r.memories ? `、${r.memories} 筆待整理的記憶` : ''}${books ? `、${books} 條世界書` : ''}${r.userMask ? `、使用者面具「${r.userMask}」` : ''}。`
        }));
        if (r.memories) {
            const dig = createElement('button', 'ios-btn', { textContent: '現在就整理成記憶（會把記憶內容送到你設定的 API）' });
            dig.style.cssText = BTN + 'margin-top:10px;width:100%;';
            dig.onclick = async () => {
                const ms = window.App?.memorySystem;
                if (!ms) { createToast('記憶系統尚未啟動', 'error'); return; }
                if (!await askConfirm('會把剛匯入的記憶內容（一次最多 48 筆）送到你設定的 API 做分類與摘要，可重複按直到整理完。確定嗎？', { title: '整理成記憶', confirmLabel: '開始整理' })) return;
                dig.disabled = true; dig.textContent = '整理中…';
                try {
                    ms.reconfigure(memorySettingsFrom(await SettingsDB.getAll()));
                    const res = await ms.digestPending({ limit: 48 });
                    if (res.skipped === 'no_api') createToast('還沒有可用的 API', 'error');
                    else if (res.error) createToast(res.error, 'error');
                    else createToast(`已整理 ${res.digested} 筆；還有的話可以再按一次`);
                } catch (e) { createToast('整理失敗：' + (e?.message || e), 'error'); }
                dig.disabled = false; dig.textContent = '現在就整理成記憶（會把記憶內容送到你設定的 API）';
            };
            box.appendChild(dig);
        }
        const chats = createElement('button', 'ios-btn', { textContent: '到聊天室看看' });
        chats.style.cssText = BTN + 'margin-top:10px;width:100%;';
        chats.onclick = () => Router.navigate('/chats');
        box.appendChild(chats);
        out.appendChild(box);
        state.sources = []; state.cards = []; state.chats = [];
    }

    fileInput.onchange = async () => {
        state.existing = await CharactersDB.getAll();
        for (const file of Array.from(fileInput.files || [])) {
            try {
                if (/\.png$/i.test(file.name) || file.type === 'image/png') await addSource({ name: file.name, bytes: new Uint8Array(await file.arrayBuffer()) });
                else await addSource({ name: file.name, text: await file.text() });
            } catch (e) { createToast(`${file.name}：讀取失敗（${e.message}）`, 'error'); }
        }
        fileInput.value = '';
        render();
    };
    parseBtn.onclick = async () => {
        if (!paste.value.trim()) return;
        state.existing = await CharactersDB.getAll();
        await addSource({ name: '貼上的文字', text: paste.value });
        paste.value = '';
        render();
    };

    state.existing = await CharactersDB.getAll();
    return { element: container, cleanup: null };
}

export default {
    id: 'import-settings',
    name: '匯入其他來源',
    routes: [{ path: '/settings/import', render: renderImportSettings }]
};
