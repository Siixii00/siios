import { SettingsDB } from '../../../db.js';

// 各遊戲共用的關卡進度：依序解鎖，每關最多 3 星
const key = game => 'lv_' + game;

export async function loadProgress(game) {
    const v = (await SettingsDB.get(key(game))) || {};
    return { unlocked: v.unlocked || 1, stars: v.stars || {} };
}

// 過關後記錄星數並解鎖下一關，回傳更新後的進度
export async function completeLevel(game, level, stars, total) {
    const p = await loadProgress(game);
    p.stars[level] = Math.max(p.stars[level] || 0, stars);
    if (level >= p.unlocked && level < total) p.unlocked = level + 1;
    await SettingsDB.set(key(game), p);
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
