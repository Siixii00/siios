// 記憶來源清單與檢索偏好的預設值（純資料，不依賴瀏覽器，方便測試）
// 記憶來源（設定頁的勾選清單、預設啟用的來源、記憶的標籤都從這裡來）
export const MEMORY_SOURCES = [
    { id: 'chat', name: '對話', icon: 'chat' },
    { id: 'discord', name: 'Discord', icon: 'forum' },
    { id: 'youtube', name: 'YouTube', icon: 'play_circle' },
    { id: 'instagram', name: 'Instagram', icon: 'camera_alt' },
    { id: 'facebook', name: 'Facebook', icon: 'thumb_up' },
    { id: 'pub', name: '酒館', icon: 'local_bar' },
    { id: 'invest', name: '投資模擬器', icon: 'show_chart' },
    { id: 'farm', name: '農場', icon: 'agriculture' },
    { id: 'home', name: '宅家', icon: 'chair' },
    { id: 'music', name: '音樂', icon: 'music_note' },
    { id: 'pomodoro', name: '番茄鐘', icon: 'timer' },
    { id: 'weather', name: '天氣', icon: 'cloud' },
    { id: 'chrome', name: 'Chrome', icon: 'language' },
    { id: 'dating', name: '約會', icon: 'favorite' },
    { id: 'bubbles', name: 'Bubbles', icon: 'bubble' },
    { id: 'weverse', name: 'Weverse', icon: 'groups' },
    { id: 'bilibili', name: 'Bilibili', icon: 'smart_display' },
    { id: 'twitch', name: 'Twitch', icon: 'videocam' },
    { id: 'twitter', name: 'Twitter', icon: 'tag' },
    { id: 'drift-bottle', name: '漂流瓶', icon: 'sailing' },
    { id: 'health', name: '健康', icon: 'monitor_heart' },
    { id: 'mcp', name: '工具（MCP）', icon: 'extension' },
    { id: 'ao3', name: 'AO3（虛構）', icon: 'auto_stories' },
    { id: 'lofter', name: 'Lofter（虛構）', icon: 'article' },
    { id: 'theater', name: '劇場（虛構）', icon: 'theater_comedy' }
];
export const MEMORY_SOURCE_IDS = MEMORY_SOURCES.map(s => s.id);

export const DEFAULT_MEMORY_PREFS = {
    selected_sources: MEMORY_SOURCE_IDS,
    memory_level: 'meta',
    include_fiction: false,
    bound_theater_id: null
};

// 設定頁加入新來源之前就存過設定的使用者，新來源預設啟用一次（known_sources 記錄他看過哪些）
export function resolveMemoryPrefs(saved) {
    const prefs = { ...DEFAULT_MEMORY_PREFS, ...(saved || {}) };
    if (saved) {
        const known = new Set(saved.known_sources || []);
        const fresh = MEMORY_SOURCE_IDS.filter(id => known.size && !known.has(id));
        prefs.selected_sources = [...new Set([...(saved.selected_sources || []), ...fresh])];
    }
    return prefs;
}
