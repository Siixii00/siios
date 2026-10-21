// PWA ⇄ Discord 機器人（Cloudflare Worker）的記憶同步。
//   推：PWA 的記憶 → Worker（機器人回覆時會讀到，見 worker 的 character_id 比對）
//   拉：Worker 上機器人累積的記憶 → PWA（不含對話日誌、也不含本來就是從 PWA 推上去的）
// 只送精簡欄位（不帶向量與感官等大欄位），並用 pushed_at 做增量，避免每次整包上傳。
import { MemoryDB, SettingsDB, CharactersDB, ChatsDB } from '../db.js';
import { workerFetch } from './discord-worker-client.js';
import { loadDislikes, formatDislikePrompt, mergeRemoteDislikes } from './dislikes.js';

const PUSH_BATCH = 40; // Worker 每筆記憶一次 D1 寫入，批次小一點才不會碰到單次請求的子請求上限
const AUTO_INTERVAL_MS = 30 * 60 * 1000;

const isFromDiscord = m => m.origin === 'discord' || m.source_app === 'discord';

export function toWorkerMemory(m, characterId) {
    return {
        id: m.id,
        chat_id: m.chat_id || '',
        character_id: characterId,
        content: m.content,
        memory_type: m.memory_type || 'dynamic',
        importance: m.importance ?? 0.5,
        timestamp: m.timestamp || m.created_at || Date.now(),
        metadata: { source: 'siios', platform: 'siios' }
    };
}

async function discordCharacters() {
    return (await CharactersDB.getAll()).filter(c => c.discord_enabled && c.discord_channel_id);
}

// all: true 時不看增量、不限已綁定的角色（手動按鈕用），所有有歸屬角色的記憶都推
export async function pushMemories(workerUrl, { all = false } = {}) {
    const startedAt = Date.now();
    const last = all ? 0 : (await SettingsDB.get('discord_memory_pushed_at')) || 0;
    const allowed = all ? null : new Set((await discordCharacters()).map(c => c.id));
    const chatCache = new Map();
    const owner = async m => {
        let id = m.character_id || m.characterId;
        if (!id && m.chat_id) {
            if (!chatCache.has(m.chat_id)) chatCache.set(m.chat_id, (await ChatsDB.getById(m.chat_id))?.character_id || '');
            id = chatCache.get(m.chat_id);
        }
        return id || '';
    };
    const out = [];
    for (const m of await MemoryDB.getAll()) {
        if (!m.content || isFromDiscord(m)) continue;
        if ((m.created_at || m.timestamp || 0) <= last) continue;
        const characterId = await owner(m);
        if (!characterId || (allowed && !allowed.has(characterId))) continue;
        out.push(toWorkerMemory(m, characterId));
    }
    // 用戶討厭的事：每次同步都推一則固定 id 的永久記憶（重要度 1），內容更新就覆蓋，機器人回覆時最優先讀到
    const dislikes = await loadDislikes();
    const dislikeText = formatDislikePrompt(dislikes);
    if (dislikeText) {
        const targets = all ? (await CharactersDB.getAll()).map(c => c.id) : [...allowed];
        for (const id of targets) out.push({ id: 'dislikes-' + id, chat_id: '', character_id: id, content: dislikeText, memory_type: 'permanent', importance: 1, timestamp: Date.now(), metadata: { source: 'siios', platform: 'siios', kind: 'dislikes', items: dislikes } });
    }
    let count = 0;
    for (let i = 0; i < out.length; i += PUSH_BATCH) {
        const res = await workerFetch(`${workerUrl}/sync/memories`, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ memories: out.slice(i, i + PUSH_BATCH) })
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.success) throw new Error(data.error || `同步記憶失敗（${res.status}）`);
        count += data.count || 0;
    }
    if (!all) await SettingsDB.set('discord_memory_pushed_at', startedAt);
    return count;
}

export async function pullDiscordMemories(workerUrl) {
    let count = 0;
    for (const char of await discordCharacters()) {
        const res = await workerFetch(`${workerUrl}/sync/chat?character_id=${encodeURIComponent(char.id)}&memories_only=1`);
        if (!res.ok) continue;
        const data = await res.json().catch(() => ({}));
        if (!data.success || !Array.isArray(data.memories) || !data.memories.length) continue;
        // Discord 學到的「用戶討厭的事」併進本機清單，不當一般記憶匯入
        const isDislikes = m => String(m.id || '').startsWith('dislikes-');
        for (const m of data.memories.filter(isDislikes)) {
            try { await mergeRemoteDislikes(JSON.parse(m.metadata || '{}').items || []); } catch (_) {}
        }
        count += await MemoryDB.importMany(data.memories.filter(m => !isDislikes(m)));
    }
    return count;
}

// 開啟 App 時自動同步（每 30 分鐘最多一次）；沒設定 Worker 網址或失敗都靜默略過
export async function autoSyncMemories() {
    try {
        const workerUrl = String((await SettingsDB.get('discord_worker_url')) || '').replace(/\/+$/, '');
        if (!workerUrl) return null;
        const lastRun = (await SettingsDB.get('discord_memory_synced_at')) || 0;
        if (Date.now() - lastRun < AUTO_INTERVAL_MS) return null;
        await SettingsDB.set('discord_memory_synced_at', Date.now());
        // 先拉再推：先把 Discord 學到的討厭的事併進本機，再把合併後的清單推回去，兩邊才不會互相覆蓋
        const pulled = await pullDiscordMemories(workerUrl);
        const pushed = await pushMemories(workerUrl);
        return { pushed, pulled };
    } catch (error) {
        console.warn('[DiscordMemorySync] 自動同步失敗：', error.message);
        return null;
    }
}
