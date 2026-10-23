import Router from '../../router.js';
import { createElement, createIOSNavBar, createToast } from '../../components.js';
import { askConfirm } from '../../core/dialogs.js';
import { CharactersDB, SettingsDB } from '../../db.js';
import APIClient from '../../api.js';
import worldbookInstaller from '../../core/worldbook-installer.js';
import { parseWorldbookText } from '../../core/worldbook-parser.js';
import { parseImport, parseTranscript } from '../../core/importers/parse.js';
import { planSend, buildChatRecipeMessages, parseChatRecipe, buildCharacterMessages, parseCharacterResponse, buildPersonaMessages, parsePersonaResponse } from '../../core/importers/ai-assist.js';
import { applyImport } from '../../core/importers/apply.js';
import { memorySettingsFrom } from '../../core/memory-system/index.js';

// 匯入其他來源：SillyTavern 角色卡／聊天、ChatGPT／Claude 匯出、純文字對話、使用者人設。
// 先在本機解析；認不得的格式才可以（經你同意）把一小段樣本交給你自己設定的 AI。
// SillyTavern 角色卡可能來自任何人，所以會偵測並強烈警告，額外的系統提示預設不匯入，要看過並勾選「我已檢查過」才能匯入。
const FIELD = 'width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:15px;background:#fff;';
const BTN = 'padding:10px 14px;border-radius:8px;background:#fff;border:1px solid #ddd;font-size:15px;';
const PRIMARY = 'width:100%;padding:12px;font-size:16px;border-radius:8px;border:none;background:#fee500;color:#3c1e1e;font-weight:600;margin-top:12px;';
const WARN = 'margin-top:8px;padding:10px 12px;border-radius:8px;background:#fff4e5;border:1px solid #f5a623;color:#7a4a00;font-size:13px;line-height:1.6;';
const DANGER = 'margin-top:8px;padding:10px 12px;border-radius:8px;background:#fdecec;border:1px solid #d33;color:#8a1111;font-size:13px;line-height:1.6;';
const dateRange = msgs => {
    const ts = msgs.map(m => m.time).filter(t => t != null);
    if (!ts.length) return '';
    const f = t => new Date(t).toLocaleDateString('sv');
    const a = f(Math.min(...ts)), b = f(Math.max(...ts));
    return a === b ? a : `${a} ～ ${b}`;
};
const hostOf = url => { try { return new URL(url).host; } catch (_) { return url || '（未設定）'; } };
const isSt = c => c.draft.origin === 'sillytavern';

async function renderImportSettings() {
    const container = createElement('div', 'app-container bg-ios-bg');
    container.appendChild(createIOSNavBar({ title: '匯入其他來源', backPath: '/settings' }));
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.padding = '16px';
    container.appendChild(main);

    const state = { sources: [], cards: [], chats: [], personas: [], existing: [] };
    let seq = 0;

    main.appendChild(createElement('div', 'text-sm text-ios-muted', {
        textContent: '把原本在 SillyTavern、ChatGPT、Claude 或其他地方的角色、聊天紀錄與使用者人設搬過來。支援：Tavern 角色卡（JSON／PNG）、SillyTavern 聊天（.jsonl）與設定檔（人設）、ChatGPT／Claude 匯出的 conversations.json、純文字對話（「名字：內容」）。認得的格式完全在本機轉換，不會送到任何地方。'
    }));
    const stNote = createElement('div', '', { textContent: '⚠ SillyTavern 角色卡不能直接當作這個 App 的角色使用：它是別的軟體的格式，而且可能來自任何人，可能夾帶要求 AI 無視規則、解除限制的提示詞。匯入時會自動偵測並標示風險，額外的系統提示預設不匯入，你要先看過內容、勾選確認才能匯入。' });
    stNote.style.cssText = WARN;
    main.appendChild(stNote);

    const fileInput = createElement('input', '', { type: 'file' });
    fileInput.accept = '.json,.jsonl,.txt,.md,.png,text/plain,application/json,image/png';
    fileInput.multiple = true;
    fileInput.style.display = 'none';
    const pick = createElement('button', 'ios-btn', { textContent: '選擇檔案（可多選）' });
    pick.style.cssText = BTN + 'margin-top:12px;';
    pick.onclick = () => fileInput.click();
    const paste = createElement('textarea', 'ios-input', { placeholder: '或在這裡貼上文字（對話紀錄、角色設定、使用者人設…）' });
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
        parsed.characters.forEach(c => state.cards.push({
            key: `c${sourceId}_${state.cards.length}`, sourceId, draft: c,
            // SillyTavern 角色卡一開始不勾選，看過並確認後才會勾
            checked: !isSt({ draft: c }), ack: false, importBook: false,
            extraChoice: { system: false, postHistory: false, depth: false }
        }));
        (parsed.personas || []).forEach(p => state.personas.push({ key: `p${sourceId}_${state.personas.length}`, persona: p, checked: true }));
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

    async function aiAssist(source, mode, extra = {}) {
        const settings = await SettingsDB.getAll();
        if (!settings.api_url || !settings.api_key) { createToast('請先到「設定 → 聊天 API 串接」填好 API', 'error'); return; }
        const plan = planSend(source.text, mode);
        const what = mode === 'chat' ? `檔案開頭的 ${plan.chars} 字樣本（用來判斷格式，整份內容仍在本機處理）` : `${plan.chars} 字的文字內容${plan.truncated ? `（超過 ${plan.limit} 字的部分不會送出）` : ''}`;
        if (!await askConfirm(`將把${what}，送到你設定的 AI 服務（${hostOf(settings.api_url)}）請它協助分析。這份內容可能包含私人資訊，確定要送出嗎？`, { title: '交給 AI 分析', confirmLabel: '送出', cancelLabel: '不要' })) return;
        try {
            if (mode === 'chat') {
                const recipe = parseChatRecipe(await APIClient.complete(buildChatRecipeMessages(plan.sample), { temperature: 0.1, maxTokens: 400 }));
                const t = recipe ? parseTranscript(source.text, { recipe }) : null;
                if (!t || !t.chats.length) { createToast('AI 給的規則無法套用到這份檔案', 'error'); return; }
                source.parsed = t;
            } else if (mode === 'persona') {
                const p = parsePersonaResponse(await APIClient.complete(buildPersonaMessages(plan.sample), { temperature: 0.1, maxTokens: 800 }));
                if (!p) { createToast('AI 沒有整理出可用的人設', 'error'); return; }
                source.parsed = { ...source.parsed, format: 'ai-persona', formatLabel: 'AI 整理的使用者人設', characters: [], chats: [], personas: [p] };
            } else {
                const c = parseCharacterResponse(await APIClient.complete(buildCharacterMessages(plan.sample), { temperature: 0.1, maxTokens: 1200 }));
                if (!c) { createToast('AI 沒有整理出可用的角色資料', 'error'); return; }
                source.parsed = { ...source.parsed, format: 'ai-character', formatLabel: 'AI 整理的角色設定', characters: [c], chats: [], personas: [] };
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
        const found = [p.characters.length ? `${p.characters.length} 個角色` : '', p.personas?.length ? `${p.personas.length} 個使用者人設` : '', p.chats.length ? `${p.chats.length} 段聊天` : ''].filter(Boolean).join('、');
        row.appendChild(createElement('div', 'text-xs text-ios-muted', { textContent: `${p.formatLabel}${found ? '：' + found : ''}` }));
        (p.warnings || []).forEach(w => row.appendChild(createElement('div', 'text-xs', { textContent: '⚠ ' + w })));
        if (p.format === 'ours') {
            row.appendChild(createElement('div', 'text-sm', { textContent: '這是 SXIOS 自己的備份檔，請用「設定 → 資料備份與還原」還原。' }));
        } else if (p.format === 'unknown' && s.text) {
            row.appendChild(createElement('div', 'text-sm', { textContent: '本機認不得這個格式。這份內容是：' }));
            const mk = (label, fn) => { const b = createElement('button', 'ios-btn', { textContent: label }); b.style.cssText = BTN + 'margin:6px 6px 0 0;'; b.onclick = fn; return b; };
            row.append(
                mk('聊天紀錄（請 AI 分析格式）', () => aiAssist(s, 'chat')),
                mk('角色設定（請 AI 整理）', () => aiAssist(s, 'character')),
                mk('使用者人設（請 AI 整理）', () => aiAssist(s, 'persona'))
            );
            // 不想用 AI：自己填名字，整段文字就是人設描述
            const nameIn = createElement('input', 'ios-input', { type: 'text', placeholder: '或不用 AI：輸入你的名字，這段文字直接當作人設' });
            nameIn.style.cssText = FIELD + 'margin-top:8px;';
            const direct = mk('直接當作使用者人設', () => {
                const name = nameIn.value.trim();
                if (!name) { createToast('請先輸入名字', 'error'); return; }
                state.personas.push({ key: `p${s.id}_d${state.personas.length}`, persona: { name, description: s.text.trim() }, checked: true });
                s.parsed = { ...s.parsed, format: 'manual-persona', formatLabel: '手動指定的使用者人設', personas: [{ name }] };
                render();
            });
            row.append(nameIn, direct);
        }
        return row;
    }

    function previewBlock(label, text) {
        if (!text) return null;
        const b = createElement('div', 'text-xs');
        b.style.cssText = 'margin-top:6px;white-space:pre-wrap;word-break:break-word;';
        b.appendChild(createElement('b', '', { textContent: label + '：' }));
        b.appendChild(document.createTextNode(text.length > 700 ? text.slice(0, 700) + '…（共 ' + text.length + ' 字）' : text));
        return b;
    }

    function cardCell(c) {
        const cell = createElement('div', 'ios-list-cell ios-list-cell-full');
        cell.style.cssText = 'padding:10px 12px;display:block;';
        const top = createElement('label');
        top.style.cssText = 'display:flex;gap:10px;align-items:flex-start;';
        const cb = createElement('input', '', { type: 'checkbox' });
        const blocked = !!c.draft.risk?.blocked;
        cb.checked = c.checked && !blocked;
        cb.disabled = blocked || (isSt(c) && !c.ack);
        cb.onchange = () => { c.checked = cb.checked; };
        const body = createElement('div', 'flex-1');
        body.style.minWidth = '0';
        body.appendChild(createElement('div', 'text-base font-semibold', { textContent: c.draft.name }));
        body.appendChild(createElement('div', 'text-sm text-ios-muted', { textContent: (c.draft.description || c.draft.personality || '（沒有說明）').slice(0, 70).replace(/\s+/g, ' ') }));
        top.append(cb, body);
        cell.appendChild(top);

        if (isSt(c)) {
            const risk = c.draft.risk || { flags: [], blocked: false };
            const box = createElement('div');
            box.style.cssText = blocked ? DANGER : WARN;
            box.appendChild(createElement('b', '', { textContent: blocked ? '⛔ 無法匯入這張角色卡' : '⚠ 這是 SillyTavern 角色卡（別的軟體的格式）' }));
            if (blocked) box.appendChild(createElement('div', '', { textContent: '偵測到疑似涉及未成年角色的性內容，不提供匯入。' }));
            else box.appendChild(createElement('div', '', { textContent: '來源不明的角色卡可能夾帶要求 AI 無視規則的提示詞，或你不想要的內容。請先看過內容再決定。' }));
            if (risk.flags.length) {
                const ul = createElement('ul', 'text-xs');
                ul.style.cssText = 'margin:6px 0 0 18px;list-style:disc;';
                risk.flags.forEach(f => ul.appendChild(createElement('li', '', { textContent: f.label })));
                box.appendChild(ul);
            } else {
                box.appendChild(createElement('div', 'text-xs', { textContent: '沒有偵測到明顯的風險關鍵字，但自動偵測不可能抓到所有情況。' })).style.marginTop = '6px';
            }
            cell.appendChild(box);

            const det = createElement('details');
            det.style.marginTop = '8px';
            det.appendChild(createElement('summary', 'text-sm', { textContent: '查看卡片內容（建議先看過）' }));
            [['說明', c.draft.description], ['個性', c.draft.personality], ['情境', c.draft.scenario], ['開場白', c.draft.first_message], ['作者備註', c.draft.creator_notes]]
                .map(([l, t]) => previewBlock(l, t)).filter(Boolean).forEach(el => det.appendChild(el));
            cell.appendChild(det);

            const extras = [['system', '系統提示', c.draft.extra?.system_prompt], ['postHistory', '後置指令', c.draft.extra?.post_history], ['depth', '深度提示', c.draft.extra?.depth_prompt]].filter(e => e[2]);
            if (extras.length && !blocked) {
                const ex = createElement('div', 'text-xs');
                ex.style.cssText = 'margin-top:8px;padding:8px;border:1px dashed #f5a623;border-radius:8px;';
                ex.appendChild(createElement('div', '', { textContent: '這張卡還附帶會影響整個對話的額外指令。預設「不匯入」，要的話請看過內容再勾選：' }));
                extras.forEach(([key, label, text]) => {
                    const l = createElement('label');
                    l.style.cssText = 'display:block;margin-top:6px;';
                    const x = createElement('input', '', { type: 'checkbox' });
                    x.checked = c.extraChoice[key];
                    x.onchange = () => { c.extraChoice[key] = x.checked; };
                    l.append(x, createElement('b', '', { textContent: ` 匯入${label}` }));
                    l.appendChild(createElement('div', '', { textContent: text.length > 500 ? text.slice(0, 500) + '…' : text })).style.cssText = 'white-space:pre-wrap;word-break:break-word;color:#555;margin-left:20px;';
                    ex.appendChild(l);
                });
                cell.appendChild(ex);
            }

            if (c.draft.book && !blocked) {
                const bl = createElement('label', 'text-xs');
                bl.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:8px;';
                const bcb = createElement('input', '', { type: 'checkbox' });
                bcb.checked = c.importBook;
                bcb.onchange = () => { c.importBook = bcb.checked; };
                bl.append(bcb, createElement('span', '', { textContent: `一併匯入附帶的世界書（${c.draft.book.entries.length} 條，內容同樣請先檢查）` }));
                cell.appendChild(bl);
            }

            if (!blocked) {
                const al = createElement('label', 'text-sm');
                al.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:10px;font-weight:600;';
                const acb = createElement('input', '', { type: 'checkbox' });
                acb.checked = c.ack;
                acb.onchange = () => { c.ack = acb.checked; c.checked = acb.checked; render(); };
                al.append(acb, createElement('span', '', { textContent: '我已看過這張角色卡的內容，確定要匯入' }));
                cell.appendChild(al);
            }
        } else if (c.draft.book) {
            const bl = createElement('label', 'text-xs');
            bl.style.cssText = 'display:flex;gap:6px;align-items:center;margin-top:6px;';
            const bcb = createElement('input', '', { type: 'checkbox' });
            bcb.checked = c.importBook;
            bcb.onchange = () => { c.importBook = bcb.checked; };
            bl.append(bcb, createElement('span', '', { textContent: `一併匯入附帶的世界書（${c.draft.book.entries.length} 條）` }));
            cell.appendChild(bl);
        }

        // 其實是人設：很多「人設」檔案長得跟角色卡一樣，只有名字和描述
        const asP = createElement('button', 'ios-btn', { textContent: '這其實是我的使用者人設，不是角色' });
        asP.style.cssText = 'margin-top:8px;padding:6px 10px;border-radius:8px;background:#fff;border:1px solid #ddd;font-size:13px;';
        asP.onclick = () => {
            state.cards = state.cards.filter(x => x !== c);
            state.personas.push({ key: `p_conv${state.personas.length}`, persona: { name: c.draft.name, description: [c.draft.description, c.draft.personality].filter(Boolean).join('\n\n') }, checked: true });
            render();
        };
        cell.appendChild(asP);
        return cell;
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
            state.cards.forEach(c => list.appendChild(cardCell(c)));
            out.appendChild(list);
        }

        if (state.personas.length) {
            out.appendChild(createElement('div', 'text-base font-semibold', { textContent: '使用者人設（會建立成「User 面具」）' })).style.marginTop = '16px';
            const list = createElement('div', 'ios-grouped-list');
            state.personas.forEach(p => {
                const cell = createElement('label', 'ios-list-cell ios-list-cell-full');
                cell.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:10px 12px;';
                const cb = createElement('input', '', { type: 'checkbox' });
                cb.checked = p.checked;
                cb.onchange = () => { p.checked = cb.checked; };
                const body = createElement('div', 'flex-1');
                body.style.minWidth = '0';
                body.appendChild(createElement('div', 'text-base font-semibold', { textContent: p.persona.name }));
                body.appendChild(createElement('div', 'text-sm text-ios-muted', { textContent: (p.persona.description || '（沒有說明，只建立名字）').slice(0, 80).replace(/\s+/g, ' ') }));
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
                state.cards.filter(c => !(c.draft.risk?.blocked)).forEach(c => opts.push(['card:' + c.key, `使用匯入的角色卡「${c.draft.name}」`]));
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
            maskLabel.append(mask, createElement('span', '', { textContent: `順便建立使用者面具「${state.chats[0].chat.userName}」（只有名字）` }));
            out.appendChild(maskLabel);
        }

        if (state.cards.length || state.chats.length || state.personas.length) {
            const go = createElement('button', 'ios-btn', { textContent: '開始匯入' });
            go.style.cssText = PRIMARY;
            go.onclick = () => doImport(go);
            const clear = createElement('button', 'ios-btn', { textContent: '清除重來' });
            clear.style.cssText = BTN + 'width:100%;margin-top:8px;';
            clear.onclick = () => { state.sources = []; state.cards = []; state.chats = []; state.personas = []; render(); };
            out.append(go, clear);
        }
    }

    // 可以匯入的角色卡：被擋下的不行；SillyTavern 角色卡一定要勾「我已檢查過」
    const importable = c => c.checked && !c.draft.risk?.blocked && (!isSt(c) || c.ack);

    async function doImport(btn) {
        const pendingAck = state.cards.filter(c => c.checked && isSt(c) && !c.ack && !c.draft.risk?.blocked);
        if (pendingAck.length) { createToast('請先看過 SillyTavern 角色卡的內容，並勾選「我已看過」', 'error'); return; }
        if (!state.cards.some(importable) && !state.chats.some(c => c.checked) && !state.personas.some(p => p.checked)) { createToast('沒有勾選任何可以匯入的項目（SillyTavern 角色卡要先勾選「我已看過」）', 'error'); return; }
        btn.disabled = true; btn.textContent = '匯入中…';
        try {
            const cardsChosen = state.cards.filter(importable);
            const items = [];
            const drafts = new Map(); // 為「新建」的聊天角色，同名只建一次
            const withChoice = c => ({ ...c.draft, extraChoice: c.extraChoice });
            const draftOf = new Map(cardsChosen.map(c => [c.key, withChoice(c)]));
            for (const c of cardsChosen) items.push({ character: { draft: draftOf.get(c.key) }, parsedChat: null });
            for (const it of state.chats.filter(x => x.checked)) {
                let character;
                if (it.target.startsWith('ex:')) character = { id: it.target.slice(3) };
                else if (it.target.startsWith('card:')) {
                    const card = state.cards.find(c => c.key === it.target.slice(5));
                    if (card && importable(card)) character = { draft: draftOf.get(card.key) };
                }
                if (!character) {
                    const name = it.chat.characterName;
                    if (!drafts.has(name)) drafts.set(name, { name, description: '', personality: '', scenario: '', first_message: '', avatar: '', tags: [] });
                    character = { draft: drafts.get(name) };
                }
                items.push({ character, parsedChat: it.chat, userName: it.chat.userName, toMemory: it.toMemory });
            }
            const mask = container.querySelector('#imp-mask');
            const result = await applyImport({
                items, createUserMask: !!mask?.checked, userName: state.chats[0]?.chat.userName,
                personas: state.personas.filter(p => p.checked).map(p => p.persona)
            }, {});
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
            textContent: `新增 ${r.characters} 個角色、${r.chats} 個聊天室（${r.messages} 則訊息）${r.memories ? `、${r.memories} 筆待整理的記憶` : ''}${books ? `、${books} 條世界書` : ''}${r.personas ? `、${r.personas} 個使用者人設` : ''}${r.userMask ? `、使用者面具「${r.userMask}」` : ''}。`
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
        const go = createElement('button', 'ios-btn', { textContent: r.personas && !r.chats ? '到 User 面具看看' : '到聊天室看看' });
        go.style.cssText = BTN + 'margin-top:10px;width:100%;';
        go.onclick = () => Router.navigate(r.personas && !r.chats ? '/settings/user' : '/chats');
        box.appendChild(go);
        out.appendChild(box);
        state.sources = []; state.cards = []; state.chats = []; state.personas = [];
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
