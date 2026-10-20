// 消消樂的純邏輯（不碰畫面），方便用機器人模擬驗證每一關的可玩性
export const SIZE = 7;
export const FRUITS = ['🍎', '🍌', '🍇', '🍓', '🍊', '🍐'];
export const LEVEL_COUNT = 30;

// 第 n 關的設定：水果種類越多越難；每 3 關有一關是「蒐集指定水果」。
// 目標是依機器人實測的平均表現乘上逐關上升的比例訂出來的（每步平均得分／蒐集量依水果種類而不同）
const SCORE_PER_MOVE = { 4: 220, 5: 92, 6: 66 };
const COLLECT_PER_MOVE = { 4: 2.3, 5: 1.1, 6: 0.75 };
export function levelConfig(n) {
    const types = n <= 4 ? 4 : n <= 14 ? 5 : 6;
    const moves = Math.max(15, 25 - Math.floor(n / 3));
    const collect = n % 3 === 0;
    const ratio = (collect ? 0.5 : 0.4) + n * 0.022;
    return {
        level: n,
        types,
        moves,
        collect,
        fruit: collect ? (n / 3) % types : null,
        goal: collect
            ? Math.max(6, Math.round(COLLECT_PER_MOVE[types] * moves * ratio))
            : Math.round(SCORE_PER_MOVE[types] * moves * ratio / 10) * 10
    };
}

const idx = (r, c) => r * SIZE + c;
const rand = types => Math.floor(Math.random() * types);

export function findMatches(b) {
    const out = new Set();
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE - 2; c++) {
            const v = b[idx(r, c)];
            if (v >= 0 && v === b[idx(r, c + 1)] && v === b[idx(r, c + 2)]) { out.add(idx(r, c)); out.add(idx(r, c + 1)); out.add(idx(r, c + 2)); }
        }
    }
    for (let c = 0; c < SIZE; c++) {
        for (let r = 0; r < SIZE - 2; r++) {
            const v = b[idx(r, c)];
            if (v >= 0 && v === b[idx(r + 1, c)] && v === b[idx(r + 2, c)]) { out.add(idx(r, c)); out.add(idx(r + 1, c)); out.add(idx(r + 2, c)); }
        }
    }
    return out;
}

export const adjacent = (a, b) => Math.abs(Math.floor(a / SIZE) - Math.floor(b / SIZE)) + Math.abs((a % SIZE) - (b % SIZE)) === 1;

function swapped(b, a, c) { const n = b.slice(); [n[a], n[c]] = [n[c], n[a]]; return n; }

// 所有「交換後會形成消除」的合法步，附上會消掉幾顆
export function validMoves(b) {
    const moves = [];
    for (let r = 0; r < SIZE; r++) {
        for (let c = 0; c < SIZE; c++) {
            for (const [dr, dc] of [[0, 1], [1, 0]]) {
                const r2 = r + dr, c2 = c + dc;
                if (r2 >= SIZE || c2 >= SIZE) continue;
                const n = swapped(b, idx(r, c), idx(r2, c2));
                const m = findMatches(n);
                if (m.size) moves.push({ a: idx(r, c), b: idx(r2, c2), size: m.size });
            }
        }
    }
    return moves;
}
export const hasMove = b => validMoves(b).length > 0;

// 清除消除的格子（設成 -1）並回傳各水果被消掉的數量
export function clearMatches(b, matches) {
    const counts = {};
    matches.forEach(i => { counts[b[i]] = (counts[b[i]] || 0) + 1; b[i] = -1; });
    return counts;
}

// 重力下落並補上新水果
export function applyGravity(b, types) {
    for (let c = 0; c < SIZE; c++) {
        const col = [];
        for (let r = SIZE - 1; r >= 0; r--) if (b[idx(r, c)] >= 0) col.push(b[idx(r, c)]);
        for (let r = SIZE - 1, k = 0; r >= 0; r--, k++) b[idx(r, c)] = k < col.length ? col[k] : rand(types);
    }
}

// 連鎖消除到穩定為止；連鎖越多倍率越高
export function resolveAll(b, types) {
    let score = 0, chain = 0;
    const counts = {};
    for (;;) {
        const m = findMatches(b);
        if (!m.size) break;
        chain++;
        score += m.size * 10 * chain;
        const c = clearMatches(b, m);
        for (const k in c) counts[k] = (counts[k] || 0) + c[k];
        applyGravity(b, types);
    }
    return { score, counts, chain };
}

// 產生一個一開始沒有現成消除、但至少有一步可走的棋盤
export function makeBoard(types) {
    for (;;) {
        const b = Array.from({ length: SIZE * SIZE }, () => rand(types));
        if (!findMatches(b).size && hasMove(b)) return b;
    }
}

// 沒有可走的步時重新洗牌
export function reshuffle(b, types) {
    for (;;) {
        for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
        if (!findMatches(b).size && hasMove(b)) return b;
        for (let i = 0; i < b.length; i++) b[i] = rand(types);
        if (!findMatches(b).size && hasMove(b)) return b;
    }
}

// 星數：達標 1 星；分數或蒐集量超過 1.4 倍 2 星，1.8 倍 3 星
export function starsFor(cfg, progress) {
    const ratio = progress / cfg.goal;
    return ratio >= 1.8 ? 3 : ratio >= 1.4 ? 2 : ratio >= 1 ? 1 : 0;
}
