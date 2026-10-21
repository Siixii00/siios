import { SettingsDB } from '../../../db.js';

// 各遊戲共用的關卡進度：依序解鎖，每關最多 3 星
const key = game => 'lv_' + game;
const GAME_NAMES = { match3: '消消樂', '2048': '2048', snake: '貪吃蛇', memory: '記憶翻牌', mines: '踩地雷', sudoku: '數獨', slide: '數字華容道', lights: '關燈', bulls: '猜數字' };

// 通關獎勵：每多拿到一顆新的星星，抽卡貨幣 +20（只有星數進步才給，重複過關不會刷）
export const GEMS_PER_STAR = 20;
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
        awardGems((stars - before) * GEMS_PER_STAR).catch(() => {});
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
