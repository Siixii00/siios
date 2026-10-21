import { ActivityDB, ActivitySettingsDB } from '../db.js';
import { formatActivityContext, activitiesForAi } from './activity-format.js';

// 聊天室送給模型的「用戶最近的網路活動」。只有在「設定 → 活動同步」開啟、並打開「允許 AI 角色存取」時才會有；沒有活動或沒開就回傳 null。
export async function loadActivityContext() {
    try {
        const settings = await ActivitySettingsDB.get();
        if (!settings?.global_enabled || !settings?.ai_access_enabled) return null;
        const activities = activitiesForAi(await ActivityDB.getAll(300), settings);
        const text = formatActivityContext(activities, { level: settings.global_level || 'basic', hours: 24 });
        if (!text) return null;
        return `[User Recent Activity - For Your Information Only]\n${text}\n\n只在對話自然提到時才用得上這些資訊（例如對方剛看完的影片），不要主動逐條報告，也不要讓對方覺得被監視。\n[/User Recent Activity]`;
    } catch {
        return null;
    }
}
