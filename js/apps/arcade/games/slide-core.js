// 數字華容道（滑塊拼圖）的純邏輯（不碰畫面）
// 關卡：棋盤大小與打亂的步數。打亂是從完成的盤面隨機走 depth 步（不立刻走回頭路），所以一定解得開，而且最佳解不會超過 depth
export const LEVELS = [
    { n: 3, depth: 10 }, { n: 3, depth: 16 }, { n: 3, depth: 24 }, { n: 3, depth: 40 },
    { n: 4, depth: 14 }, { n: 4, depth: 24 }, { n: 4, depth: 40 }, { n: 4, depth: 70 },
    { n: 5, depth: 30 }, { n: 5, depth: 60 }
];

export const solvedBoard = n => Array.from({ length: n * n }, (_, i) => (i === n * n - 1 ? 0 : i + 1));
export const isSolved = board => board.every((v, i) => v === (i === board.length - 1 ? 0 : i + 1));

// 空格相鄰的格子
export function neighborsOf(n, i) {
    const r = Math.floor(i / n), c = i % n, out = [];
    if (r > 0) out.push(i - n);
    if (r < n - 1) out.push(i + n);
    if (c > 0) out.push(i - 1);
    if (c < n - 1) out.push(i + 1);
    return out;
}

// 點一塊：和空格相鄰才會動，回傳新盤面；不能動回 null
export function slide(board, n, i) {
    const blank = board.indexOf(0);
    if (i === blank || !neighborsOf(n, blank).includes(i)) return null;
    const next = board.slice();
    [next[blank], next[i]] = [next[i], next[blank]];
    return next;
}

export function scramble(n, depth, rng = Math.random) {
    let board = solvedBoard(n), prevBlank = -1;
    for (let k = 0; k < depth; k++) {
        const blank = board.indexOf(0);
        const options = neighborsOf(n, blank).filter(i => i !== prevBlank);
        const pick = options[Math.floor(rng() * options.length)];
        prevBlank = blank;
        board = slide(board, n, pick);
    }
    // 運氣不好剛好走回原樣就再走一次（至少要有點動靜）
    return isSolved(board) && depth > 0 ? scramble(n, depth, rng) : board;
}

// 排列的可解性（教科書上的逆序數規則）：測試用來確認任何打亂結果都解得開
export function isSolvable(board, n) {
    const flat = board.filter(Boolean);
    let inv = 0;
    for (let i = 0; i < flat.length; i++) for (let j = i + 1; j < flat.length; j++) if (flat[i] > flat[j]) inv++;
    if (n % 2 === 1) return inv % 2 === 0;
    const rowFromBottom = n - Math.floor(board.indexOf(0) / n);
    return (inv + rowFromBottom) % 2 === 1;
}

// 曼哈頓距離總和（每一塊離目標位置的格數）；測試的機器人與提示用
export function manhattan(board, n) {
    let d = 0;
    board.forEach((v, i) => { if (v) { const t = v - 1; d += Math.abs(Math.floor(t / n) - Math.floor(i / n)) + Math.abs((t % n) - (i % n)); } });
    return d;
}

// 最佳解的步數（IDA*，只適合 3×3；4×4 以上太慢，測試只對 3×3 用）
export function optimalMoves(board, n, limit = 40) {
    const key = b => b.join(',');
    const h0 = manhattan(board, n);
    let bound = h0;
    while (bound <= limit) {
        let minOver = Infinity, found = false;
        const path = new Set([key(board)]);
        const dfs = (b, g, prev) => {
            const h = manhattan(b, n), f = g + h;
            if (f > bound) { minOver = Math.min(minOver, f); return; }
            if (h === 0) { found = true; return; }
            const blank = b.indexOf(0);
            for (const i of neighborsOf(n, blank)) {
                if (i === prev) continue;
                const nb = slide(b, n, i), k = key(nb);
                if (path.has(k)) continue;
                path.add(k);
                dfs(nb, g + 1, blank);
                path.delete(k);
                if (found) return;
            }
        };
        let result = -1;
        const startG = 0;
        // 迭代加深：找到時 bound 就是最佳步數
        dfs(board, startG, -1);
        if (found) result = bound;
        if (result >= 0) return result;
        if (minOver === Infinity) return -1;
        bound = minOver;
    }
    return -1;
}

// 星數：步數相對於打亂步數（par）。一般玩家通常是 par 的 2～3 倍
export function starsFor(moves, depth) {
    return moves <= depth * 2 ? 3 : moves <= depth * 3.5 ? 2 : 1;
}
