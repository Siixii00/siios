// 把解析好的結果寫進資料庫：角色、聊天室與訊息（保留原本的時間）、原始記憶（之後交給「記憶消化」整理）。
// 沒有任何網路請求；匯入的記憶只做本機的五感／情緒／時空標記，分類與摘要由使用者之後自己啟動「記憶消化」。
import { initDB, CharactersDB, ChatsDB, MemoryDB, UsersDB } from '../../db.js';
import { SensoryExtractor } from '../memory-system/sensory-extractor.js';
import { EmotionTagger } from '../memory-system/emotion-tagger.js';
import { SpatiotemporalTagger } from '../memory-system/spatiotemporal-tagger.js';
import { chunkConversation, fillTimes } from './parse.js';

const sensory = new SensoryExtractor();
const emotion = new EmotionTagger();
const spatio = new SpatiotemporalTagger();
const clip = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
const dateLabel = ms => ms ? new Date(ms).toLocaleDateString('sv') : '';

export async function createCharacterFromDraft(draft) {
    return CharactersDB.create({
        name: draft.name,
        avatar: draft.avatar || '',
        description: draft.description || '',
        personality: draft.personality || '',
        scenario: draft.scenario || '',
        first_message: draft.first_message || '',
        imported_from: 'import',
        tags: draft.tags || []
    });
}

async function createChatFor(character, parsed, userName) {
    const msgs = fillTimes(parsed.messages);
    const last = msgs[msgs.length - 1];
    const chat = await ChatsDB.create({
        character_id: character.id,
        character_name: character.name,
        character_avatar: character.avatar || '',
        character_personality: character.personality || '',
        character_scenario: character.scenario || '',
        character_first_message: character.first_message || '',
        character_description: character.description || '',
        last_message: clip(last.content, 40),
        imported: true
    });
    const db = await initDB();
    const tx = db.transaction('messages', 'readwrite');
    let n = 0;
    for (const m of msgs) {
        await tx.store.put({
            id: `imp_${chat.id}_${n++}`,
            chat_id: chat.id,
            role: m.role,
            content: m.content,
            speaker_character_id: null,
            timestamp: m.time
        });
    }
    await tx.done;
    await ChatsDB.update(chat.id, { last_message: clip(last.content, 40) });
    return { chat, count: msgs.length, msgs };
}

async function createRawMemories(character, chat, msgs, userName) {
    const chunks = chunkConversation(msgs, { charName: character.name, userName });
    const existing = new Set((await MemoryDB.getAll()).filter(m => (m.character_id || m.characterId) === character.id).map(m => m.content));
    let created = 0;
    for (const c of chunks) {
        const content = `（匯入的舊對話${c.time ? ' · ' + dateLabel(c.time) : ''}）\n${c.text}`;
        if (existing.has(content)) continue;
        const e = emotion.tag(c.text);
        const sensoryData = sensory.extract(c.text);
        const importance = Math.min(1, 0.4 + Math.abs(e.valence) * e.arousal * 0.25 + sensory.getSensoryScore(sensoryData) * 0.15);
        const mem = await MemoryDB.create({
            chat_id: chat.id,
            character_id: character.id,
            characterId: character.id,
            content,
            full_content: content,
            meta_content: clip(c.text, 40),
            memory_level: 'full',
            source_app: 'import',
            source_type: 'interaction',
            source_subtype: 'imported_chat',
            sensory: sensoryData,
            emotional: e,
            spatiotemporal: spatio.tag(c.text, { timestamp: c.time ? new Date(c.time).toISOString() : undefined }),
            importance,
            memory_type: 'dynamic',
            timestamp: c.time || Date.now(),
            digested: false
        });
        // 舊對話的日期很早：從匯入這一刻才開始算衰減，否則一匯入就被當成「很久以前」而淡掉
        await MemoryDB.update(mem.id, { lastDecayed: Date.now() });
        created++;
    }
    return created;
}

// plan.items: [{ character: { id } | { draft }, parsedChat, userName, toMemory }]
export async function applyImport(plan, { onProgress } = {}) {
    const result = { characters: 0, chats: 0, messages: 0, memories: 0, characterIds: [] };
    const made = new Map(); // draft 物件 → 已建立的角色（同一個角色卡對到多個聊天只建一次）
    let i = 0;
    for (const item of plan.items || []) {
        onProgress?.(++i, plan.items.length);
        let character;
        if (item.character.id) character = await CharactersDB.getById(item.character.id);
        else {
            character = made.get(item.character.draft);
            if (!character) { character = await createCharacterFromDraft(item.character.draft); made.set(item.character.draft, character); result.characters++; }
        }
        if (!character) continue;
        if (!result.characterIds.includes(character.id)) result.characterIds.push(character.id);
        if (item.parsedChat?.messages?.length) {
            const { chat, count, msgs } = await createChatFor(character, item.parsedChat, item.userName);
            result.chats++; result.messages += count;
            if (item.toMemory) result.memories += await createRawMemories(character, chat, msgs, item.userName || '使用者');
        }
    }
    if (plan.createUserMask && plan.userName) {
        const users = await UsersDB.getAll();
        if (!users.some(u => u.name === plan.userName)) { await UsersDB.create({ name: plan.userName }); result.userMask = plan.userName; }
    }
    return result;
}
