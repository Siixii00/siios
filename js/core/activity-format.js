// 把使用者最近的網路活動（瀏覽器擴充功能／其他裝置同步來的）整理成給角色看的一小段文字。純函式，不依賴瀏覽器。
// 隱私等級（設定 → 活動同步）：basic 只給平台與次數；summary 加上標題；detailed 再加內容片段。

const TYPE_LABEL = {
    view: '瀏覽', watch: '觀看', video_view: '觀看影片', like: '按讚', share: '分享', comment: '留言', post: '發文',
    tweet: '發推', search: '搜尋', follow: '追蹤', subscribe: '訂閱', message: '傳訊息', notification: '收到通知', general: '活動'
};
const PLATFORM_LABEL = { youtube: 'YouTube', twitter: 'Twitter', x: 'Twitter', instagram: 'Instagram', facebook: 'Facebook', discord: 'Discord', tiktok: 'TikTok' };

const clip = (text, n) => {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
};
const ago = (ts, now) => {
    const m = Math.max(0, Math.round((now - ts) / 60000));
    if (m < 60) return (m || 1) + ' 分鐘前';
    if (m < 60 * 24) return Math.round(m / 60) + ' 小時前';
    return Math.round(m / 60 / 24) + ' 天前';
};

export function formatActivityContext(activities, { level = 'basic', hours = 24, now = Date.now(), maxItems = 8 } = {}) {
    const cutoff = now - hours * 3600 * 1000;
    const recent = (activities || []).filter(a => a && a.timestamp >= cutoff).sort((a, b) => b.timestamp - a.timestamp);
    if (!recent.length) return null;

    const byPlatform = {};
    for (const a of recent) {
        const p = PLATFORM_LABEL[String(a.platform).toLowerCase()] || a.platform || '其他';
        byPlatform[p] = (byPlatform[p] || 0) + 1;
    }
    const counts = Object.entries(byPlatform).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p} ${n} 次`).join('、');
    let text = `過去 ${hours} 小時內，用戶在網路上的活動共 ${recent.length} 次（${counts}）。`;

    if (level === 'summary' || level === 'detailed') {
        const lines = [];
        const seen = new Set();
        for (const a of recent) {
            const title = clip(a.title || a.summary?.title || a.page_title, 40); // 擴充功能的「摘要」隱私等級把標題放在 summary.title
            if (!title) continue;
            const key = (a.platform || '') + '|' + title;
            if (seen.has(key)) continue;
            seen.add(key);
            const p = PLATFORM_LABEL[String(a.platform).toLowerCase()] || a.platform || '其他';
            const type = TYPE_LABEL[a.activity_type] || a.activity_type || '活動';
            const extra = level === 'detailed' && a.content ? '：' + clip(a.content, 60) : '';
            lines.push(`- ${p}：${type}「${title}」${extra}（${ago(a.timestamp, now)}）`);
            if (lines.length >= maxItems) break;
        }
        if (lines.length) text += '\n' + lines.join('\n');
    }
    return text;
}

// 使用者在「設定 → 活動同步」授權才給 AI 看：要開啟活動同步、且打開「允許 AI 角色存取」；只包含使用者沒有關掉的平台
export function activitiesForAi(activities, settings) {
    if (!settings?.global_enabled || !settings?.ai_access_enabled) return [];
    const platforms = settings.platforms || {};
    return (activities || []).filter(a => platforms[String(a.platform).toLowerCase()]?.enabled !== false);
}
