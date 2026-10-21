import { SettingsDB } from '../../../db.js';
import { dayStamp, nextStreak, dailyReward } from './daily.js';
import { createToast } from '../../../components.js';
import { credit } from '../../../core/wallet.js';
import { incomeFor, applyCap } from '../../../core/arcade-income.js';

// 各遊戲共用的關卡進度：依序解鎖，每關最多 3 星
const key = game => 'lv_' + game;
const GAME_NAMES = { match3: '消消樂', '2048': '2048', snake: '貪吃蛇', memory: '記憶翻牌', mines: '踩地雷', sudoku: '數獨', slide: '數字華容道', lights: '關燈', bulls: '猜數字' };

// 通關獎勵：每多拿到一顆新的星星，抽卡貨幣 +20（只有星數進步才給，重複過關不會刷）
export const GEMS_PER_STAR = 20;

// 街機廳也會賺錢包的錢：新的星星、每日挑戰（有每日上限，見 core/arcade-income.js）。回傳實際給的金額
let payQueue = Promise.resolve();
export function payArcade(amount, desc) {
    const run = payQueue.then(async () => {
        if (!(amount > 0)) return 0;
        const { granted, state } = applyCap(await SettingsDB.get('arcade_income'), amount, dayStamp());
        if (!granted) return 0;
        await SettingsDB.set('arcade_income', state);
        await credit(granted, desc, { category: 'arcade' });
        return granted;
    });
    payQueue = run.catch(() => {});
    return run;
}
export async function awardGems(n) {
    const saved = (await SettingsDB.get('arcade_gacha')) || {};
    saved.currency = (saved.currency ?? 16000) + n;
    await SettingsDB.set('arcade_gacha', saved);
}

export async function loadProgress(game) {
    const v = (await SettingsDB.get(key(game))) || {};
    return { unlocked: v.unlocked || 1, stars: v.stars || {} };
}

// 過關後記錄星數並解鎖下一關，回傳更新後的進度
export async function completeLevel(game, level, stars, total) {
    const p = await loadProgress(game);
    const before = p.stars[level] || 0;
    p.stars[level] = Math.max(before, stars);
    if (level >= p.unlocked && level < total) p.unlocked = level + 1;
    await SettingsDB.set(key(game), p);
    // 只在第一次過這一關、或星數進步時記一筆
    if (stars > before) {
        const gems = (stars - before) * GEMS_PER_STAR;
        awardGems(gems).catch(() => {});
        payArcade(incomeFor({ newStars: stars - before }), `街機廳：${GAME_NAMES[game] || game} 第 ${level} 關`)
            .then(money => createToast(`★ 新的星星！抽卡貨幣 +${gems}${money ? `，錢包 +$${money}` : ''}`))
            .catch(() => createToast(`★ 新的星星！抽卡貨幣 +${gems}`));
        import('../../../core/activity-memory.js').then(m => m.rememberActivity({ sourceApp: game === 'match3' ? 'match-3' : 'arcade', content: `用戶在${GAME_NAMES[game] || game}通過了第 ${level} 關（${stars} 星）`, importance: 0.3 })).catch(() => {});
    }
    return p;
}

export const starText = n => '★'.repeat(n) + '☆'.repeat(3 - n);

// 關卡選單：label(n) 可回傳每關的簡短說明
export function levelGridHtml(progress, total, label = () => '') {
    let html = '<div class="lv-grid">';
    for (let n = 1; n <= total; n++) {
        const locked = n > progress.unlocked;
        const st = progress.stars[n] || 0;
        html += `<button class="lv-btn ${locked ? 'locked' : ''} ${st ? 'done' : ''}" data-lv="${n}" ${locked ? 'disabled' : ''}>
            <strong>${locked ? '🔒' : n}</strong><span class="lv-stars">${locked ? '' : starText(st)}</span><small>${locked ? '' : label(n)}</small></button>`;
    }
    return html + '</div>';
}

export const totalStars = progress => Object.values(progress.stars).reduce((a, b) => a + b, 0);

// ───── 每日挑戰 ─────
// 每個遊戲一天一題（題目由日期決定，見 daily.js）；當天第一次完成給抽卡貨幣，連續天數越多越多。重複玩不會重複給
const dailyKey = game => 'daily_' + game;
export async function loadDaily(game) {
    const v = await SettingsDB.get(dailyKey(game));
    return v && v.date === dayStamp() ? v : null; // 只看今天的紀錄
}
export async function loadStreak() {
    const v = await SettingsDB.get('arcade_daily_streak');
    if (!v?.last) return 0;
    const today = dayStamp(), yesterday = dayStamp(new Date(Date.now() - 86400000));
    return v.last === today || v.last === yesterday ? v.count : 0; // 昨天之前就斷了
}
// 回傳 { first, gems, streak }：first 為當天第一次完成這個遊戲的挑戰
export async function completeDaily(game, stars) {
    const today = dayStamp(), prev = await loadDaily(game);
    if (prev) {
        if (stars > prev.stars) await SettingsDB.set(dailyKey(game), { date: today, stars });
        return { first: false, gems: 0, streak: await loadStreak() };
    }
    await SettingsDB.set(dailyKey(game), { date: today, stars });
    const streak = nextStreak(await SettingsDB.get('arcade_daily_streak'), today);
    await SettingsDB.set('arcade_daily_streak', streak);
    const gems = dailyReward(streak.count);
    await awardGems(gems);
    const money = await payArcade(incomeFor({ daily: { first: true, streak: streak.count } }), `街機廳：${GAME_NAMES[game] || game} 每日挑戰`).catch(() => 0);
    import('../../../core/activity-memory.js').then(m => m.rememberActivity({ sourceApp: 'arcade', content: `用戶完成了今天的${GAME_NAMES[game] || game}每日挑戰（${stars} 星，連續 ${streak.count} 天）`, importance: 0.3 })).catch(() => {});
    return { first: true, gems, money, streak: streak.count };
}

// 選單上的每日挑戰按鈕
export function dailyButtonHtml(daily, level) {
    return `<button class="ag-btn daily-btn" data-act="daily">📅 今日挑戰（難度同第 ${level} 關）${daily ? ' · 已完成 ' + starText(daily.stars) : ''}</button>`;
}

export const dailyOverlayNote = r => (r && r.first ? `<p class="daily-note">📅 每日挑戰完成！抽卡貨幣 +${r.gems}${r.money ? `、錢包 +$${r.money}` : ''}（連續 ${r.streak} 天）</p>` : '');
