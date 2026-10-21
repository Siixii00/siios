// 每日挑戰的純邏輯（不碰資料庫與畫面）：每天一題，所有人同一天拿到同一題（用日期當亂數種子）
export const DAILY_BASE_GEMS = 40;
export const DAILY_STREAK_BONUS = 5; // 連續天數每多一天多給 5，最多算 7 天

export const dayStamp = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

// 字串 → 32 位元整數（簡單的雜湊，只要「同一天同一遊戲永遠一樣、不同天通常不一樣」）
export function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
}

// 可重現的亂數（mulberry32）
export function seededRng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export const dailySeed = (game, stamp = dayStamp()) => hashString(game + '|' + stamp);

// 今天挑第幾關的難度：落在全部關卡的 40%～100% 之間，每天不一樣
export function dailyLevel(game, total, stamp = dayStamp()) {
    const lo = Math.max(1, Math.floor(total * 0.4)), span = Math.max(1, total - lo + 1);
    return lo + (hashString('level|' + game + '|' + stamp) % span);
}

const dayNumber = stamp => { const [y, m, d] = stamp.split('-').map(Number); return Math.round(Date.UTC(y, m - 1, d) / 86400000); };

// 連續天數：今天已經算過就不變；昨天有玩就 +1；斷了就從 1 重新算
export function nextStreak(prev, stamp = dayStamp()) {
    if (!prev || !prev.last) return { last: stamp, count: 1 };
    if (prev.last === stamp) return prev;
    return { last: stamp, count: dayNumber(stamp) - dayNumber(prev.last) === 1 ? (prev.count || 0) + 1 : 1 };
}

export const dailyReward = streak => DAILY_BASE_GEMS + DAILY_STREAK_BONUS * Math.min(7, Math.max(1, streak)) - DAILY_STREAK_BONUS;
