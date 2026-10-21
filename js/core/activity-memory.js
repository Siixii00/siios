// 使用者在各個 App 裡做的事（買東西、寫日記、玩遊戲、新增行程…）也要留下記憶，讓角色知道你的生活。
// 這些記憶不屬於特定角色，標記為 shared，每個角色檢索時都看得到（仍受「記憶設定」的來源開關控制）。
import { saveInteractionMemory } from './memory-saver.js';
import { MEMORY_SOURCE_IDS, SPEND_CATEGORY_TO_SOURCE } from './memory-sources.js';

const DEDUPE_MS = 10 * 60 * 1000;
const recent = new Map();


// 記錄使用者的一件事。characterId 有給就只記在那個角色；沒給就是所有角色共用。失敗一律靜默（記憶不能影響 App 本身的功能）。
export async function rememberActivity({ sourceApp, content, importance = 0.3, characterId = '', dedupeMs = DEDUPE_MS }) {
    try {
        const text = String(content || '').trim();
        if (!text || !MEMORY_SOURCE_IDS.includes(sourceApp)) return null;
        const key = sourceApp + '|' + characterId + '|' + text;
        const now = Date.now();
        if (recent.has(key) && now - recent.get(key) < dedupeMs) return null;
        recent.set(key, now);
        if (recent.size > 200) for (const [k, t] of recent) if (now - t > dedupeMs) recent.delete(k);
        return await saveInteractionMemory({
            characterId, shared: !characterId, sourceApp, sourceType: 'interaction', sourceSubtype: 'activity',
            content: text, metaContent: text, importance
        });
    } catch (error) {
        console.warn('[ActivityMemory] 記錄失敗：', error?.message || error);
        return null;
    }
}

// 錢包扣款時，替還沒有自己記憶邏輯的分類記一筆（農場、宅家、酒館、投資…各自已經會記，所以不在對應表裡）
export function rememberSpending(amount, desc, meta = {}) {
    const sourceApp = SPEND_CATEGORY_TO_SOURCE[meta.category];
    if (!sourceApp || /^Instagram/.test(String(desc))) return null;
    return rememberActivity({ sourceApp, content: `用戶花了 $${Number(amount).toLocaleString()}：${desc}`, importance: 0.3, dedupeMs: 5000 });
}
