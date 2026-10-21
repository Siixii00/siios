// 數獨的純邏輯（不碰畫面）：解題、出題（保證唯一解、而且只靠「唯一候選數」與「唯一位置」兩種基本推理就能解開）
export const SIZES = { 4: { n: 4, br: 2, bc: 2 }, 6: { n: 6, br: 2, bc: 3 }, 9: { n: 9, br: 3, bc: 3 } };

// 關卡：棋盤大小與提示數（越少越難）。提示數是「想要的」，出題時盡量逼近
export const LEVELS = [
    { size: 4, clues: 10 }, { size: 4, clues: 8 },
    { size: 6, clues: 20 }, { size: 6, clues: 16 },
    { size: 9, clues: 44 }, { size: 9, clues: 40 }, { size: 9, clues: 36 }, { size: 9, clues: 33 },
    { size: 9, clues: 31 }, { size: 9, clues: 29 }, { size: 9, clues: 27 }, { size: 9, clues: 25 }
];

const geo = size => {
    const { n, br, bc } = SIZES[size];
    const row = i => Math.floor(i / n), col = i => i % n, box = i => Math.floor(row(i) / br) * (n / bc) + Math.floor(col(i) / bc);
    const peers = Array.from({ length: n * n }, (_, i) => {
        const s = new Set();
        for (let j = 0; j < n * n; j++) if (j !== i && (row(j) === row(i) || col(j) === col(i) || box(j) === box(i))) s.add(j);
        return [...s];
    });
    const units = [];
    for (let r = 0; r < n; r++) units.push(Array.from({ length: n }, (_, c) => r * n + c));
    for (let c = 0; c < n; c++) units.push(Array.from({ length: n }, (_, r) => r * n + c));
    const boxes = n;
    for (let b = 0; b < boxes; b++) units.push(Array.from({ length: n * n }, (_, i) => i).filter(i => box(i) === b));
    return { n, peers, units };
};
const geoCache = {};
export const geometry = size => (geoCache[size] ||= geo(size));

export function candidates(grid, size, i) {
    const { n, peers } = geometry(size);
    const used = new Set(peers[i].map(j => grid[j]).filter(Boolean));
    const out = [];
    for (let v = 1; v <= n; v++) if (!used.has(v)) out.push(v);
    return out;
}

// 回溯解題（每次挑候選最少的格子）；rng 有給就隨機排候選順序（出題用）。回傳解答或 null
export function solve(grid, size, rng = null) {
    const g = grid.slice();
    const go = () => {
        let best = -1, bestC = null;
        for (let i = 0; i < g.length; i++) {
            if (g[i]) continue;
            const c = candidates(g, size, i);
            if (!c.length) return false;
            if (!bestC || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
        }
        if (best < 0) return true;
        const order = rng ? bestC.map(v => ({ v, r: rng() })).sort((a, b) => a.r - b.r).map(o => o.v) : bestC;
        for (const v of order) { g[best] = v; if (go()) return true; }
        g[best] = 0;
        return false;
    };
    return go() ? g : null;
}

// 解的個數（數到 limit 就停）：出題要確認唯一解
export function countSolutions(grid, size, limit = 2) {
    const g = grid.slice();
    let count = 0;
    const go = () => {
        let best = -1, bestC = null;
        for (let i = 0; i < g.length; i++) {
            if (g[i]) continue;
            const c = candidates(g, size, i);
            if (!c.length) return;
            if (!bestC || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
        }
        if (best < 0) { count++; return; }
        for (const v of bestC) { g[best] = v; go(); if (count >= limit) return; }
        g[best] = 0;
    };
    go();
    return count;
}

// 只用兩種基本推理解題：某格只剩一個候選數（naked single），或某個數字在一行／列／宮裡只有一個位置可放（hidden single）。
// 回傳 { solved, grid, steps, hidden }：hidden 是用到「唯一位置」的次數（比唯一候選數更需要觀察，可當難度指標）
export function solveBySingles(grid, size) {
    const { n, units } = geometry(size);
    const g = grid.slice();
    let steps = 0, hidden = 0;
    for (;;) {
        let progress = false;
        for (let i = 0; i < g.length; i++) {
            if (g[i]) continue;
            const c = candidates(g, size, i);
            if (c.length === 1) { g[i] = c[0]; steps++; progress = true; }
        }
        if (!progress) {
            for (const unit of units) for (let v = 1; v <= n; v++) {
                if (unit.some(i => g[i] === v)) continue;
                const spots = unit.filter(i => !g[i] && candidates(g, size, i).includes(v));
                if (spots.length === 1) { g[spots[0]] = v; steps++; hidden++; progress = true; }
            }
        }
        if (!progress) break;
    }
    return { solved: g.every(Boolean), grid: g, steps, hidden };
}

const shuffled = (arr, rng) => arr.map(v => ({ v, r: rng() })).sort((a, b) => a.r - b.r).map(o => o.v);

export function generateFull(size, rng = Math.random) {
    return solve(Array(size * size).fill(0), size, rng);
}

// 出題：從完整盤面逐格拿掉，每拿一格都確認「還是唯一解」而且「還是只靠基本推理就能解開」。
// 回傳 { puzzle, solution, clues }；clues 可能比目標多（拿不掉更多了）
export function generate(level, rng = Math.random) {
    const { size, clues: target } = typeof level === 'number' ? LEVELS[level - 1] : level;
    const total = size * size;
    const solution = generateFull(size, rng);
    const puzzle = solution.slice();
    let clues = total;
    for (const i of shuffled([...Array(total).keys()], rng)) {
        if (clues <= target) break;
        const keep = puzzle[i];
        puzzle[i] = 0;
        if (countSolutions(puzzle, size, 2) === 1 && solveBySingles(puzzle, size).solved) clues--;
        else puzzle[i] = keep;
    }
    return { puzzle, solution, clues };
}

// 星數：提示用得少、錯得少
export const starsFor = (hints, mistakes) => (hints === 0 && mistakes <= 1 ? 3 : hints <= 1 && mistakes <= 3 ? 2 : 1);

export const conflicts = (grid, size) => {
    const { peers } = geometry(size);
    const bad = new Set();
    grid.forEach((v, i) => { if (v && peers[i].some(j => grid[j] === v)) bad.add(i); });
    return bad;
};
