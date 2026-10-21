// 翻牌配對的純邏輯（不碰畫面），方便用機器人驗證每一關的難度
export const EMOJI = ['🍎', '🍋', '🍇', '🍓', '🍒', '🥝', '🍑', '🍍', '🥥', '🍉', '🌶️', '🥕', '🍔', '🍩', '🥑', '🍪', '🍕', '🌽', '🍄', '🥨', '🍌', '🥦', '🍰', '🧀'];

// 每關的對數與步數上限（一步 = 翻開兩張）：前幾關很寬鬆，越後面對數越多、上限越緊。
// 上限是用「只記得最近 6 張牌」的機器人實測訂的（tests/unit/arcade-difficulty.test.mjs）：後期關卡要記得住才過得了
export const LEVELS = [
    [3, 8], [4, 10], [5, 12], [6, 13], [6, 12], [7, 14], [8, 16], [8, 15],
    [9, 17], [10, 19], [10, 18], [12, 24], [12, 22], [14, 28], [16, 33],
    // 第 16 關起是高手挑戰：最多 20 對（40 張）。最後一關連「完美記憶」的機器人也只有 97%
    [17, 36], [17, 34], [18, 37], [18, 35], [19, 39], [19, 37], [20, 41], [20, 39], [20, 37], [20, 35], [20, 34], [20, 33]
].map(([pairs, limit]) => ({ pairs, limit }));

export const cols = pairs => (pairs * 2 <= 12 ? 4 : pairs * 2 <= 20 ? 5 : pairs * 2 <= 30 ? 6 : 8);

export function makeDeck(pairs, rng = Math.random) {
    const faces = EMOJI.slice(0, pairs);
    return [...faces, ...faces].map((face, id) => ({ id, face, r: rng() })).sort((a, b) => a.r - b.r).map(({ id, face }) => ({ id, face }));
}

// 星數：步數（兩張一步）越少越高
export const starsFor = (pairs, moves) => (moves <= pairs * 1.6 ? 3 : moves <= pairs * 2.1 ? 2 : 1);
