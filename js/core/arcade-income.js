// 街機廳賺錢包的錢：新的星星、每日挑戰會給一小筆，每天有上限（避免被刷）。純函式，錢包的存取在 games/levels.js。
export const STAR_MONEY = 10;
export const DAILY_MONEY = 100;
export const DAILY_STREAK_MONEY = 10; // 連續天數每多一天多 10，最多算 7 天
export const DAILY_CAP = 300;

// newStars：這次新增的星星數（只在星數進步時才有）；daily：{ first, streak }（當天第一次完成每日挑戰）
export function incomeFor({ newStars = 0, daily = null } = {}) {
    let money = Math.max(0, newStars) * STAR_MONEY;
    if (daily?.first) money += DAILY_MONEY + DAILY_STREAK_MONEY * (Math.min(7, Math.max(1, daily.streak || 1)) - 1);
    return money;
}

// state：{ day, earned }（今天已經賺了多少）。回傳 { granted, state }：granted 是實際給的（受每日上限限制）
export function applyCap(state, amount, day, cap = DAILY_CAP) {
    const s = state && state.day === day ? { day, earned: state.earned || 0 } : { day, earned: 0 };
    const granted = Math.max(0, Math.min(Math.round(amount), cap - s.earned));
    return { granted, state: { day, earned: s.earned + granted } };
}
