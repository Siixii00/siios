// 踩地雷的純邏輯（不碰畫面），方便用機器人驗證每一關的難度
// 每關的棋盤大小與地雷數（密度由 11% 一路到 22%）。每一盤都保證「不用猜」就能靠推理解開（見 plantFair），所以難度來自盤面大小與地雷密度，不靠運氣
export const LEVELS = [
    { w: 6, h: 6, mines: 4 }, { w: 7, h: 7, mines: 6 }, { w: 8, h: 8, mines: 8 }, { w: 9, h: 9, mines: 10 }, { w: 9, h: 9, mines: 12 },
    { w: 9, h: 11, mines: 16 }, { w: 10, h: 12, mines: 20 }, { w: 10, h: 14, mines: 26 }, { w: 12, h: 12, mines: 28 }, { w: 12, h: 14, mines: 33 },
    { w: 12, h: 15, mines: 36 }, { w: 12, h: 16, mines: 39 }, { w: 12, h: 16, mines: 41 }, { w: 13, h: 16, mines: 44 }, { w: 14, h: 16, mines: 50 }
];

export function neighbors(w, h, i) {
    const x = i % w, y = Math.floor(i / w), out = [];
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
    }
    return out;
}

export const newCells = (w, h) => Array.from({ length: w * h }, () => ({ mine: false, open: false, flag: false, n: 0 }));

// 第一下一定安全：在第一次點擊後才佈雷，避開點到的格子與它周圍
export function plant(cells, w, h, mines, safe, rng = Math.random) {
    const banned = new Set([safe, ...neighbors(w, h, safe)]);
    const pool = cells.map((_, i) => i).filter(i => !banned.has(i)).map(i => ({ i, r: rng() })).sort((a, b) => a.r - b.r).map(o => o.i);
    pool.slice(0, mines).forEach(i => { cells[i].mine = true; });
    cells.forEach((c, i) => { c.n = neighbors(w, h, i).filter(j => cells[j].mine).length; });
}

// 打開一格；數字是 0 的會連鎖打開周圍
export function openCell(cells, w, h, i) {
    const stack = [i];
    while (stack.length) {
        const j = stack.pop(), c = cells[j];
        if (c.open || c.flag) continue;
        c.open = true;
        if (c.n === 0 && !c.mine) stack.push(...neighbors(w, h, j));
    }
}

export const isWon = cells => cells.every(c => c.mine || c.open);

// 星數：花的時間（秒）相對於參考時間
export function starsFor(elapsed, cellCount) {
    const par = cellCount * 1.6;
    return elapsed <= par * 0.6 ? 3 : elapsed <= par ? 2 : 1;
}

// ───── 不用猜的盤面 ─────
// 用「單點規則」與「子集規則」推理（和人在玩的推理一樣）能不能從第一下開始一路解到底，完全不必猜
export function canSolveWithoutGuess(cells, w, h, first) {
    const c = cells.map(x => ({ mine: x.mine, open: false, flag: false, n: x.n }));
    const nb = Array.from({ length: w * h }, (_, i) => neighbors(w, h, i));
    openCell(c, w, h, first);
    const flagged = new Set();
    for (let guard = 0; guard < 2000; guard++) {
        if (isWon(c)) return true;
        let progress = false;
        const cons = [];
        for (let i = 0; i < c.length; i++) {
            if (!c[i].open || c[i].n === 0) continue;
            const hidden = nb[i].filter(j => !c[j].open && !flagged.has(j));
            if (!hidden.length) continue;
            const left = c[i].n - nb[i].filter(j => flagged.has(j)).length;
            if (left === hidden.length) { hidden.forEach(j => flagged.add(j)); progress = true; }
            else if (left === 0) { hidden.forEach(j => openCell(c, w, h, j)); progress = true; }
            else cons.push({ set: hidden, left });
        }
        if (progress) continue;
        for (const a of cons) for (const b of cons) {
            if (a === b || a.set.length >= b.set.length || !a.set.every(j => b.set.includes(j))) continue;
            const diff = b.set.filter(j => !a.set.includes(j)), dl = b.left - a.left;
            if (dl === 0) { diff.forEach(j => openCell(c, w, h, j)); progress = true; }
            else if (dl === diff.length) { diff.forEach(j => flagged.add(j)); progress = true; }
        }
        if (!progress) return false;
    }
    return false;
}

// 第一下之後佈雷：重複佈到「不用猜就能解開」為止（最多 maxTries 次，都不行就用最後一次的盤面）。回傳 { fair, tries }
export function plantFair(cells, w, h, mines, safe, rng = Math.random, maxTries = 200) {
    let tries = 0;
    while (tries < maxTries) {
        tries++;
        cells.forEach(c => { c.mine = false; c.n = 0; });
        plant(cells, w, h, mines, safe, rng);
        if (canSolveWithoutGuess(cells, w, h, safe)) return { fair: true, tries };
    }
    return { fair: false, tries };
}
