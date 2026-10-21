// 關燈（Lights Out）的純邏輯（不碰畫面）
// 按一格會讓它和上下左右的燈切換亮／暗；目標是把全部的燈關掉。
// 關卡：棋盤大小與出題時按的次數。出題是從「全暗」隨機按 presses 個不同的格子，所以一定解得開，而且最少步數不會超過 presses。
export const LEVELS = [
    { n: 3, presses: 2 }, { n: 3, presses: 4 }, { n: 4, presses: 3 }, { n: 4, presses: 6 },
    { n: 5, presses: 4 }, { n: 5, presses: 7 }, { n: 5, presses: 10 }, { n: 5, presses: 14 },
    { n: 6, presses: 8 }, { n: 6, presses: 14 },
    // 第 11 關起：更大的棋盤（最大 8×8）
    { n: 6, presses: 18 }, { n: 6, presses: 22 }, { n: 7, presses: 12 }, { n: 7, presses: 18 }, { n: 7, presses: 24 }, { n: 7, presses: 30 },
    { n: 8, presses: 16 }, { n: 8, presses: 22 }, { n: 8, presses: 28 }, { n: 8, presses: 34 }, { n: 8, presses: 40 }
];

export function press(board, n, i) {
    const next = board.slice();
    const r = Math.floor(i / n), c = i % n;
    for (const [dr, dc] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && rr < n && cc >= 0 && cc < n) next[rr * n + cc] ^= 1;
    }
    return next;
}

export const isOff = board => board.every(v => !v);

export function puzzle(n, presses, rng = Math.random) {
    let board = Array(n * n).fill(0);
    const cells = [...Array(n * n).keys()].map(i => ({ i, r: rng() })).sort((a, b) => a.r - b.r).map(o => o.i).slice(0, presses);
    cells.forEach(i => { board = press(board, n, i); });
    // 剛好全暗（按的那幾格互相抵消）就重來
    return isOff(board) ? puzzle(n, presses, rng) : { board, solution: cells };
}

// 在 GF(2) 上解 A x = b（A 是「按某格會影響哪些燈」），回傳所有解中按最少格的那組；無解回 null。
// 棋盤的自由度（零空間維度）不大（5×5 是 2、4×4 是 4），列舉所有解沒有問題。
export function minPresses(board, n) {
    const m = n * n;
    // 增廣矩陣：第 i 列＝第 i 顆燈會被哪些按鈕影響，最後一欄是目前的狀態
    const rows = Array.from({ length: m }, (_, i) => {
        const row = Array(m + 1).fill(0);
        for (let j = 0; j < m; j++) { const p = press(Array(m).fill(0), n, j); row[j] = p[i]; }
        row[m] = board[i];
        return row;
    });
    const pivotCols = [];
    let r = 0;
    for (let c = 0; c < m && r < m; c++) {
        let p = r; while (p < m && !rows[p][c]) p++;
        if (p === m) continue;
        [rows[r], rows[p]] = [rows[p], rows[r]];
        for (let k = 0; k < m; k++) if (k !== r && rows[k][c]) for (let j = c; j <= m; j++) rows[k][j] ^= rows[r][j];
        pivotCols.push(c); r++;
    }
    for (let k = r; k < m; k++) if (rows[k][m]) return null; // 矛盾：無解
    const free = [...Array(m).keys()].filter(c => !pivotCols.includes(c));
    let best = Infinity;
    for (let mask = 0; mask < (1 << free.length); mask++) {
        const x = Array(m).fill(0);
        free.forEach((c, k) => { x[c] = (mask >> k) & 1; });
        pivotCols.forEach((c, k) => { let v = rows[k][m]; free.forEach(f => { v ^= rows[k][f] & x[f]; }); x[c] = v; });
        best = Math.min(best, x.reduce((a, b) => a + b, 0));
    }
    return best;
}

// 星數：步數相對於最少步數（par）。「由上往下追燈」的標準解法通常會比最少步數多一些，所以給一點寬容
export function starsFor(moves, par) {
    return moves <= par + Math.ceil(par * 0.3) ? 3 : moves <= par * 2 + 2 ? 2 : 1;
}
