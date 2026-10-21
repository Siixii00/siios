// 記憶檢索的使用者偏好（「設定 → 記憶設定」存的 chat_memory_settings）。
// 聊天室與各 App 取記憶時都要套用同一份，否則設定頁的「來源」「虛構內容」開關只是裝飾。
import { SettingsDB } from '../db.js';
import { DEFAULT_MEMORY_PREFS, resolveMemoryPrefs } from './memory-sources.js';

export async function loadMemoryPrefs() {
    try {
        return resolveMemoryPrefs(await SettingsDB.get('chat_memory_settings'));
    } catch {
        return { ...DEFAULT_MEMORY_PREFS };
    }
}

// 組出 retrieveMemories 的 filters。options 可覆蓋個別項目（例如劇場 theaterId）
export async function buildMemoryFilters({ characterId, options = {} } = {}) {
    const prefs = await loadMemoryPrefs();
    const filters = {
        character_id: characterId,
        include_main_memories: options.includeMainMemories !== false,
        include_fiction: options.includeFiction ?? prefs.include_fiction,
        selected_sources: options.selectedSources || prefs.selected_sources,
        memory_level: options.memoryLevel || prefs.memory_level
    };
    const theaterId = options.theaterId ?? prefs.bound_theater_id;
    if (theaterId) filters.theater_id = theaterId;
    return filters;
}
