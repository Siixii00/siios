import { createElement, createToast, createKakaoBottomSheet } from '../../components.js';
import { MessagesDB, SettingsDB, CharactersDB, UsersDB, ChatsDB } from '../../db.js';
import APIClient, { describeMessageForAI } from '../../api.js';

const TRANSCRIPT_LIMIT = 40;

function dateKey(ts) {
    const d = new Date(ts);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

async function loadCharacter(chat, characterId) {
    const id = characterId || chat.character_id;
    return id ? await CharactersDB.getById(id) : null;
}

function personaPrompt(char) {
    if (!char) return '你是聊天室中的角色。';
    const parts = ['你是「' + (char.name || '角色') + '」。'];
    if (char.description) parts.push(char.description);
    if (char.personality) parts.push('性格：' + char.personality);
    if (char.scenario) parts.push('場景：' + char.scenario);
    return parts.join('\n');
}

async function speakerNames(chat) {
    const names = new Map();
    const ids = chat.is_group ? (chat.member_ids || []) : [chat.character_id];
    for (const id of ids) {
        const c = id ? await CharactersDB.getById(id) : null;
        if (c) names.set(id, c.name || '角色');
    }
    const user = chat.bound_user_id ? await UsersDB.getById(chat.bound_user_id) : null;
    return { names, userName: user?.name || '使用者', fallback: chat.character_name || '角色' };
}

async function transcript(chat, msgs) {
    const { names, userName, fallback } = await speakerNames(chat);
    return msgs.map(m => {
        const who = m.role === 'user' ? userName : (names.get(m.speaker_character_id) || fallback);
        return who + '：' + describeMessageForAI(m);
    }).join('\n');
}

// 以角色身份「回顧」某則回覆；結果快取在 message.meta[field]，之後不再呼叫 API
async function recallForMessage(chat, message, field, instruction, { force = false } = {}) {
    if (!force && message.meta?.[field]) return message.meta[field];
    const all = await MessagesDB.getByChatId(chat.id);
    const idx = all.findIndex(m => m.id === message.id);
    const context = all.slice(Math.max(0, idx - 10), idx);
    const char = await loadCharacter(chat, message.speaker_character_id);
    const text = await APIClient.complete([
        { role: 'system', content: personaPrompt(char) + '\n' + instruction },
        {
            role: 'user',
            content: '【先前的對話】\n' + (await transcript(chat, context)) +
                '\n\n【你的那則回覆】\n' + describeMessageForAI(message)
        }
    ], { maxTokens: 400 });
    const updated = await MessagesDB.update(message.id, { meta: { ...(message.meta || {}), [field]: text } });
    message.meta = updated.meta;
    return text;
}

export function getThought(chat, message, options) {
    return recallForMessage(chat, message, 'thought',
        '請以第一人稱寫出你寫下那則回覆時內心的思考過程：你如何理解對方的意圖、考慮了什麼、為什麼這樣回應。3 到 6 句，不要重複回覆原文，不要使用標題或引號。', options);
}

export function getInnerVoice(chat, message, options) {
    return recallForMessage(chat, message, 'inner_voice',
        '請寫出你說完那則回覆後，沒有說出口的真實內心想法。1 到 3 句，第一人稱，口語、真誠，不要複述已說出口的內容，不要使用標題或引號。', options);
}

export async function generateSummary(chat) {
    const all = await MessagesDB.getByChatId(chat.id);
    if (all.length === 0) throw new Error('還沒有任何訊息可以總結');
    const recent = all.slice(-TRANSCRIPT_LIMIT);
    return APIClient.complete([
        {
            role: 'system',
            content: '你是聊天記錄整理助手。請把以下對話整理成給使用者閱讀的總結，使用繁體中文條列：重點話題、雙方情緒或關係的變化、提到的承諾或待辦。總長不超過 200 字，不要加入對話中沒有的內容。'
        },
        { role: 'user', content: await transcript(chat, recent) }
    ], { maxTokens: 600, temperature: 0.3 });
}

// ---- 每日紀錄 ----
const logKey = chatId => 'daily_log:' + chatId;

export async function listLogDates(chatId) {
    const all = await MessagesDB.getByChatId(chatId);
    const saved = (await SettingsDB.get(logKey(chatId))) || {};
    const dates = [...new Set(all.map(m => dateKey(m.timestamp)))].sort().reverse();
    return dates.map(d => ({ date: d, saved: !!saved[d] }));
}

export async function getDailyLog(chat, date, { force = false } = {}) {
    const saved = (await SettingsDB.get(logKey(chat.id))) || {};
    if (!force && saved[date]) return saved[date];
    const all = await MessagesDB.getByChatId(chat.id);
    const dayMsgs = all.filter(m => dateKey(m.timestamp) === date);
    if (dayMsgs.length === 0) throw new Error('這一天沒有對話');
    const char = await loadCharacter(chat);
    const text = await APIClient.complete([
        {
            role: 'system',
            content: personaPrompt(char) + '\n請以第一人稱寫一篇這一天的日記（' + date + '），記錄今天和對方聊了什麼、你的感受與心情變化。150 到 300 字，繁體中文，口吻符合你的性格，不要加入對話中沒有發生的事。'
        },
        { role: 'user', content: await transcript(chat, dayMsgs.slice(-TRANSCRIPT_LIMIT)) }
    ], { maxTokens: 800 });
    saved[date] = text;
    await SettingsDB.set(logKey(chat.id), saved);
    return text;
}

// ---- 共用：顯示「載入中 → 結果 / 錯誤」的底部面板 ----
export function openResultSheet({ title, note, load }) {
    const content = createElement('div', 'p-4 flex flex-col gap-3');
    const noteEl = note ? createElement('div', 'text-xs text-gray-500', { textContent: note }) : null;
    const body = createElement('div', 'text-sm whitespace-pre-wrap', { textContent: '生成中…' });
    body.style.lineHeight = '1.6';
    const bar = createElement('div', 'flex gap-2 justify-end');
    const copyBtn = createElement('button', 'px-3 py-1 rounded-lg text-sm', { textContent: '複製' });
    const regenBtn = createElement('button', 'px-3 py-1 rounded-lg text-sm bg-kakao-yellow text-kakao-brown font-medium', { textContent: '重新生成' });
    copyBtn.style.cssText = 'border:1px solid #ddd;background:transparent;';
    bar.append(copyBtn, regenBtn);
    if (noteEl) content.appendChild(noteEl);
    content.append(body, bar);

    let current = '';
    const run = async (force) => {
        body.textContent = '生成中…';
        regenBtn.disabled = true;
        try {
            current = await load(force);
            body.textContent = current;
        } catch (e) {
            current = '';
            body.textContent = '生成失敗：' + (e.message || e);
        } finally {
            regenBtn.disabled = false;
        }
    };
    copyBtn.onclick = async () => {
        if (!current) return;
        try {
            await navigator.clipboard.writeText(current);
            createToast('已複製');
        } catch {
            createToast('無法複製，請手動選取文字');
        }
    };
    regenBtn.onclick = () => run(true);

    const sheet = createKakaoBottomSheet([], { title, customContent: content });
    sheet.open();
    run(false);
    return sheet;
}

export async function openDailyLogSheet(chatId) {
    const chat = await ChatsDB.getById(chatId);
    const dates = await listLogDates(chatId);
    if (dates.length === 0) {
        createToast('還沒有對話，無法產生紀錄');
        return;
    }
    const content = createElement('div', 'p-4 flex flex-col gap-2');
    content.appendChild(createElement('div', 'text-xs text-gray-500', { textContent: '選擇日期，由角色寫成當天的日記（已生成的會直接顯示）' }));
    let sheet;
    dates.forEach(({ date, saved }) => {
        const row = createElement('button', 'flex justify-between items-center px-3 py-3 rounded-lg');
        row.style.cssText = 'border:1px solid #eee;background:transparent;text-align:left;cursor:pointer;';
        row.appendChild(createElement('span', '', { textContent: date }));
        row.appendChild(createElement('span', 'text-xs text-gray-500', { textContent: saved ? '已生成' : '尚未生成' }));
        row.onclick = () => {
            sheet.close();
            openResultSheet({
                title: date + ' 日記',
                load: force => getDailyLog(chat, date, { force })
            });
        };
        content.appendChild(row);
    });
    sheet = createKakaoBottomSheet([], { title: '每日紀錄', customContent: content });
    sheet.open();
}
