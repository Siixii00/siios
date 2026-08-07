import { CharactersDB, ChatsDB, MessagesDB, MemoryDB, SettingsDB, WikiRecordsDB } from '../../db.js';
import { createBlock } from './templates.js';

const MESSAGES_PER_CHAT_LOG = 10;
const SYNC_BATCH_SIZE = 50;

function generateId(prefix = 'wiki') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

function formatTimestamp(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.getFullYear() + '-' +
        String(d.getMonth() + 1).padStart(2, '0') + '-' +
        String(d.getDate()).padStart(2, '0') + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' +
        String(d.getMinutes()).padStart(2, '0');
}

async function syncCharacters(existingRecords, charactersMap) {
    const characters = charactersMap ? [...charactersMap.values()] : await CharactersDB.getAll();
    const charRecords = existingRecords.filter(r => r.page_type === 'character');
    const charRecordMap = new Map(charRecords.map(r => [r.character_id, r]));
    const results = [];

    for (const char of characters) {
        let record = charRecordMap.get(char.id);
        const autoBlocks = buildCharacterAutoBlocks(char);

        if (record) {
            record.title = char.name || 'Untitled';
            record.icon = '🧑';
            record.cover_image = char.avatar || null;
            record.updated_at = Date.now();
            if (record.source_type === 'auto') {
                record.blocks = autoBlocks;
            } else {
                const manualBlocks = record.blocks.filter(b => !b.confidence);
                record.blocks = [...autoBlocks, ...manualBlocks];
            }
            await WikiRecordsDB.update(record.id, record);
        } else {
            record = await WikiRecordsDB.create({
                id: generateId('char'),
                page_type: 'character',
                title: char.name || 'Untitled',
                character_id: char.id,
                source_type: 'auto',
                source_ids: [char.id],
                confidence: 'EXTRACTED',
                blocks: autoBlocks,
                links: [],
                tags: [],
                cover_image: char.avatar || null,
                icon: '🧑'
            });
        }
        results.push(record);
    }

    return results;
}

function buildCharacterAutoBlocks(char) {
    const blocks = [];
    blocks.push(createBlock('heading1', char.name || 'Untitled'));

    blocks.push(createBlock('heading2', '基本資料'));
    if (char.description) {
        blocks.push({ ...createBlock('bulleted-list', `描述: ${char.description}`), confidence: 'EXTRACTED' });
    }
    if (char.personality) {
        blocks.push({ ...createBlock('bulleted-list', `個性: ${char.personality}`), confidence: 'EXTRACTED' });
    }
    if (char.scenario) {
        blocks.push({ ...createBlock('bulleted-list', `場景: ${char.scenario}`), confidence: 'EXTRACTED' });
    }
    if (char.first_message) {
        blocks.push({ ...createBlock('quote', char.first_message), confidence: 'EXTRACTED' });
    }

    blocks.push(createBlock('heading2', '聊天紀錄'));
    blocks.push({ ...createBlock('text', '（同步後自動生成）'), confidence: 'AMBIGUOUS' });

    blocks.push(createBlock('heading2', '社交互動'));
    blocks.push({ ...createBlock('text', '（同步後自動生成）'), confidence: 'AMBIGUOUS' });

    blocks.push(createBlock('heading2', '相關頁面'));

    return blocks;
}

async function syncChatLogs(existingRecords, characterRecords, charactersMap) {
    const chats = await ChatsDB.getAll();
    const chatLogRecords = existingRecords.filter(r => r.page_type === 'chat-log');
    const chatLogMap = new Map();

    for (const r of chatLogRecords) {
        if (!chatLogMap.has(r.character_id)) chatLogMap.set(r.character_id, []);
        chatLogMap.get(r.character_id).push(r);
    }

    const charNameToId = new Map();
    for (const cr of characterRecords) {
        if (cr.character_id) {
            const char = charactersMap ? charactersMap.get(cr.character_id) : await CharactersDB.getById(cr.character_id);
            if (char) charNameToId.set(char.name, { charId: char.id, recordId: cr.id });
        }
    }

    const allMessages = await MessagesDB.getAll();
    const messagesByChatId = new Map();
    for (const msg of allMessages) {
        if (!messagesByChatId.has(msg.chat_id)) messagesByChatId.set(msg.chat_id, []);
        messagesByChatId.get(msg.chat_id).push(msg);
    }

    const messagesByChar = new Map();

    for (const chat of chats) {
        const messages = messagesByChatId.get(chat.id) || [];
        const charName = chat.character_name;
        if (!charName) continue;
        if (!messagesByChar.has(charName)) messagesByChar.set(charName, []);
        messagesByChar.get(charName).push(...messages.map(m => ({
            ...m,
            character_name: charName
        })));
    }

    for (const [charName, allMessages] of messagesByChar) {
        allMessages.sort((a, b) => a.timestamp - b.timestamp);

        const charInfo = charNameToId.get(charName);
        if (!charInfo) continue;

        const existing = chatLogMap.get(charInfo.charId) || [];
        existing.sort((a, b) => (a.chat_log_index || 0) - (b.chat_log_index || 0));

        const totalLogs = Math.ceil(allMessages.length / MESSAGES_PER_CHAT_LOG);
        const results = [];

        for (let i = 0; i < totalLogs; i++) {
            const start = i * MESSAGES_PER_CHAT_LOG;
            const end = Math.min(start + MESSAGES_PER_CHAT_LOG, allMessages.length);
            const slice = allMessages.slice(start, end);

            let record = existing[i];
            const blocks = buildChatLogBlocks(charName, i + 1, slice);

            if (record) {
                record.blocks = blocks;
                record.message_range = { start, end: end - 1 };
                record.source_ids = slice.map(m => m.id);
                record.updated_at = Date.now();
                await WikiRecordsDB.update(record.id, record);
            } else {
                record = await WikiRecordsDB.create({
                    id: generateId('chatlog'),
                    page_type: 'chat-log',
                    title: `💬 ${charName} 聊天紀錄 #${i + 1}`,
                    character_id: charInfo.charId,
                    source_type: 'auto',
                    source_ids: slice.map(m => m.id),
                    confidence: 'EXTRACTED',
                    blocks,
                    links: [],
                    tags: [],
                    icon: '💬',
                    parent_id: charInfo.recordId,
                    chat_log_index: i + 1,
                    message_range: { start, end: end - 1 }
                });
            }
            results.push(record);
        }

        for (let i = totalLogs; i < existing.length; i++) {
            await WikiRecordsDB.delete(existing[i].id);
        }

        const charRecord = characterRecords.find(r => r.character_id === charInfo.charId);
        if (charRecord) {
            const chatLogLinks = results.map(r => `[[${r.title}]]`);
            updateCharacterSectionLinks(charRecord, '聊天紀錄', chatLogLinks, results.map(r => r.id));
        }
    }
}

function buildChatLogBlocks(charName, index, messages) {
    const blocks = [];
    blocks.push(createBlock('heading1', `${charName} 聊天紀錄 #${index}`));

    blocks.push({ ...createBlock('heading2', '時間線'), confidence: 'EXTRACTED' });
    for (const msg of messages) {
        const role = msg.role === 'user' ? '用戶' : charName;
        const time = formatTimestamp(msg.timestamp);
        const text = msg.content || '';
        const preview = text.length > 100 ? text.substring(0, 100) + '...' : text;
        blocks.push({ ...createBlock('bulleted-list', `${time} ${role}: ${preview}`), confidence: 'EXTRACTED' });
    }

    blocks.push({ ...createBlock('heading2', '摘要'), confidence: 'INFERRED' });
    blocks.push({ ...createBlock('text', '（此段對話包含 ' + messages.length + ' 則訊息）'), confidence: 'INFERRED' });

    blocks.push(createBlock('heading2', '相關頁面'));
    blocks.push({ ...createBlock('text', `[[${charName}]]`), confidence: 'EXTRACTED' });

    return blocks;
}

async function syncSocialLogs(existingRecords, characterRecords, charactersMap) {
    const socialLogRecords = existingRecords.filter(r => r.page_type === 'social-log');
    const socialLogMap = new Map(socialLogRecords.map(r => [r.character_id, r]));

    const charNameToId = new Map();
    for (const cr of characterRecords) {
        if (cr.character_id) {
            const char = charactersMap ? charactersMap.get(cr.character_id) : await CharactersDB.getById(cr.character_id);
            if (char) charNameToId.set(char.name, { charId: char.id, recordId: cr.id });
        }
    }

    const socialData = await collectSocialData();

    for (const [charName, interactions] of socialData) {
        const charInfo = charNameToId.get(charName);
        if (!charInfo) continue;

        let record = socialLogMap.get(charInfo.charId);
        const blocks = buildSocialLogBlocks(charName, interactions);

        if (record) {
            record.blocks = blocks;
            record.source_ids = interactions.map(i => i.id);
            record.updated_at = Date.now();
            await WikiRecordsDB.update(record.id, record);
        } else {
            record = await WikiRecordsDB.create({
                id: generateId('social'),
                page_type: 'social-log',
                title: `🌐 ${charName} 社交互動`,
                character_id: charInfo.charId,
                source_type: 'auto',
                source_ids: interactions.map(i => i.id),
                confidence: 'EXTRACTED',
                blocks,
                links: [],
                tags: [],
                icon: '🌐',
                parent_id: charInfo.recordId
            });
        }

        const charRecord = characterRecords.find(r => r.character_id === charInfo.charId);
        if (charRecord) {
            updateCharacterSectionLinks(charRecord, '社交互動', [`[[${record.title}]]`], [record.id]);
        }
    }
}

async function collectSocialData() {
    const data = new Map();

    const igPosts = await SettingsDB.get('instagram_posts') || [];
    const igUserPosts = await SettingsDB.get('instagram_user_posts') || [];
    for (const post of [...igPosts, ...igUserPosts]) {
        const name = post.user;
        if (!name) continue;
        if (!data.has(name)) data.set(name, []);
        data.get(name).push({
            id: post.id,
            platform: 'IG',
            type: 'post',
            text: post.caption || '',
            timestamp: post.timestamp || Date.now()
        });
    }

    const fbPosts = await SettingsDB.get('share_posts') || [];
    const fbUserPosts = await SettingsDB.get('share_user_posts') || [];
    for (const post of [...fbPosts, ...fbUserPosts]) {
        const name = post.author;
        if (!name) continue;
        if (!data.has(name)) data.set(name, []);
        data.get(name).push({
            id: post.id,
            platform: 'FB',
            type: 'post',
            text: post.text || '',
            timestamp: post.timestamp || Date.now()
        });
    }

    const twTweets = await SettingsDB.get('twitter_npc_tweets') || [];
    const twUserTweets = await SettingsDB.get('twitter_user_tweets') || [];
    for (const tweet of [...twTweets, ...twUserTweets]) {
        const name = tweet.author;
        if (!name || name === '你') continue;
        if (!data.has(name)) data.set(name, []);
        data.get(name).push({
            id: tweet.id,
            platform: 'TW',
            type: 'tweet',
            text: tweet.content || '',
            timestamp: tweet.timestamp || Date.now()
        });
    }

    const weverseGroups = await SettingsDB.get('weverse_groups') || [];
    for (const group of weverseGroups) {
        const name = group.name;
        if (!name) continue;
        if (!data.has(name)) data.set(name, []);
        const posts = group.posts || [];
        for (const post of posts) {
            data.get(name).push({
                id: `weverse_${group.id}_${Date.now()}`,
                platform: 'Weverse',
                type: 'community_post',
                text: post.text || '',
                timestamp: Date.now()
            });
        }
    }

    const lofterPosts = await SettingsDB.get('lofter_generated_posts') || [];
    for (const post of lofterPosts) {
        const title = post.title || '';
        const cpNames = title.split(/[-x×]/);
        for (const name of cpNames) {
            const trimmed = name.trim();
            if (!trimmed) continue;
            if (!data.has(trimmed)) data.set(trimmed, []);
            data.get(trimmed).push({
                id: post.id,
                platform: 'LOFTER',
                type: 'fanfic',
                text: post.title || '',
                timestamp: post.timestamp || Date.now()
            });
        }
    }

    for (const [name, items] of data) {
        items.sort((a, b) => b.timestamp - a.timestamp);
    }

    return data;
}

function buildSocialLogBlocks(charName, interactions) {
    const blocks = [];
    blocks.push(createBlock('heading1', `${charName} 社交互動`));

    blocks.push({ ...createBlock('heading2', '互動時間線'), confidence: 'EXTRACTED' });
    for (const item of interactions.slice(0, 50)) {
        const time = formatTimestamp(item.timestamp);
        const platform = item.platform;
        const text = item.text.length > 80 ? item.text.substring(0, 80) + '...' : item.text;
        blocks.push({ ...createBlock('bulleted-list', `[${platform}] ${time} ${text}`), confidence: 'EXTRACTED' });
    }
    if (interactions.length > 50) {
        blocks.push({ ...createBlock('text', `...還有 ${interactions.length - 50} 條互動記錄`), confidence: 'EXTRACTED' });
    }

    blocks.push({ ...createBlock('heading2', '互動摘要'), confidence: 'INFERRED' });
    const platformCounts = {};
    for (const item of interactions) {
        platformCounts[item.platform] = (platformCounts[item.platform] || 0) + 1;
    }
    const summary = Object.entries(platformCounts).map(([p, c]) => `${p}: ${c} 條`).join('、');
    blocks.push({ ...createBlock('text', `${charName}在社交平台上共有 ${interactions.length} 條互動（${summary}）`), confidence: 'INFERRED' });

    blocks.push(createBlock('heading2', '相關頁面'));
    blocks.push({ ...createBlock('text', `[[${charName}]]`), confidence: 'EXTRACTED' });

    return blocks;
}

async function syncMemories(existingRecords, characterRecords, charactersMap, chatsMap) {
    const memories = await MemoryDB.getAll();
    const highImportance = memories.filter(m => (m.importance || 0) >= 0.5);

    const chatIdToCharId = new Map();
    for (const [charId, chatIds] of (chatsMap || new Map())) {
        for (const chatId of chatIds) {
            chatIdToCharId.set(chatId, charId);
        }
    }

    const allChats = await ChatsDB.getAll();
    for (const chat of allChats) {
        if (chat.character_name) {
            const char = [...(charactersMap?.values() || [])].find(c => c.name === chat.character_name);
            if (char) {
                chatIdToCharId.set(chat.id, char.id);
            }
        }
    }

    for (const charRecord of characterRecords) {
        if (!charRecord.character_id) continue;
        const charMemories = highImportance.filter(m => {
            const linkedCharId = chatIdToCharId.get(m.chat_id);
            return linkedCharId === charRecord.character_id;
        });
        if (charMemories.length === 0) continue;

        const memorySectionIdx = charRecord.blocks.findIndex(b =>
            b.content && b.content.includes('記憶摘要')
        );
        if (memorySectionIdx === -1) continue;

        const insertIdx = memorySectionIdx + 1;
        const memoryBlocks = charMemories.slice(0, 10).map(m => ({
            ...createBlock('bulleted-list', m.content || ''),
            confidence: 'INFERRED'
        }));

        const existingMemoryBlocks = [];
        let i = insertIdx;
        while (i < charRecord.blocks.length &&
               charRecord.blocks[i].confidence === 'INFERRED' &&
               charRecord.blocks[i].type === 'bulleted-list') {
            existingMemoryBlocks.push(charRecord.blocks[i]);
            i++;
        }

        charRecord.blocks.splice(insertIdx, existingMemoryBlocks.length, ...memoryBlocks);
        await WikiRecordsDB.update(charRecord.id, { blocks: charRecord.blocks });
    }
}

function updateCharacterSectionLinks(charRecord, sectionName, linkTexts, linkIds) {
    const sectionIdx = charRecord.blocks.findIndex(b =>
        b.content && b.content.includes(sectionName)
    );
    if (sectionIdx === -1) return;

    let insertIdx = sectionIdx + 1;
    while (insertIdx < charRecord.blocks.length &&
           charRecord.blocks[insertIdx].content &&
           charRecord.blocks[insertIdx].content.startsWith('[[')) {
        insertIdx++;
    }

    const existingLinkCount = insertIdx - (sectionIdx + 1);
    const newLinkBlocks = linkTexts.map(text => ({
        ...createBlock('text', text),
        confidence: 'EXTRACTED'
    }));

    charRecord.blocks.splice(sectionIdx + 1, existingLinkCount, ...newLinkBlocks);

    const existingLinks = charRecord.links || [];
    const newLinks = [...new Set([...existingLinks, ...linkIds])];
    charRecord.links = newLinks;

    WikiRecordsDB.update(charRecord.id, {
        blocks: charRecord.blocks,
        links: charRecord.links
    });
}

export async function runFullSync() {
    const existingRecords = await WikiRecordsDB.getAll();
    const characters = await CharactersDB.getAll();
    const charactersMap = new Map(characters.map(c => [c.id, c]));
    const chats = await ChatsDB.getAll();
    const chatsMap = new Map();
    for (const chat of chats) {
        const charId = characters.find(c => c.name === chat.character_name)?.id;
        if (charId) {
            if (!chatsMap.has(charId)) chatsMap.set(charId, []);
            chatsMap.get(charId).push(chat.id);
        }
    }

    const characterRecords = await syncCharacters(existingRecords, charactersMap);

    await syncChatLogs(existingRecords, characterRecords, charactersMap);

    await syncSocialLogs(existingRecords, characterRecords, charactersMap);

    await syncMemories(existingRecords, characterRecords, charactersMap, chatsMap);

    await SettingsDB.set('wiki_last_sync', Date.now());

    return await WikiRecordsDB.getAll();
}

export async function incrementalSync() {
    const lastSyncTime = await SettingsDB.get('wiki_last_sync');
    if (!lastSyncTime) return runFullSync();

    const allRecords = await WikiRecordsDB.getAll();
    const characterRecords = allRecords.filter(r => r.page_type === 'character');
    const characters = await CharactersDB.getAll();
    const charactersMap = new Map(characters.map(c => [c.id, c]));

    const chats = await ChatsDB.getAll();
    const newChats = chats.filter(c => c.last_updated > lastSyncTime);

    if (newChats.length > 0) {
        await syncChatLogs(allRecords, characterRecords, charactersMap);
    }

    await syncSocialLogs(allRecords, characterRecords, charactersMap);

    await SettingsDB.set('wiki_last_sync', Date.now());

    return await WikiRecordsDB.getAll();
}
