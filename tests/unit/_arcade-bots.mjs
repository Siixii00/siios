// 街機廳難度測試用的機器人（不是測試檔：檔名開頭是底線，不會被 npm test 當成測試執行）
import * as G from '../../js/apps/arcade/games/g2048-core.js';
import * as S from '../../js/apps/arcade/games/snake-core.js';
import * as MM from '../../js/apps/arcade/games/memory-core.js';
import * as MN from '../../js/apps/arcade/games/mines-core.js';
import * as M3 from '../../js/apps/match-3/engine.js';

// 可重現的亂數
export function mulberry(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export function withSeed(seed, fn) {
    const real = Math.random; Math.random = mulberry(seed);
    try { return fn(); } finally { Math.random = real; }
}

// ───── 2048 ─────
// casual：隨便挑一個能動的方向；decent：貪心＋角落策略（常見的「左下角」玩法），大致是認真玩的人；
// strong：期望值搜尋（往後看兩步，考慮新方塊出現的位置），接近高手，用來確認每一關「做得到」
const evalBoard = b => {
    let score = b.filter(v => !v).length * 270, mono = 0, smooth = 0;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) {
        const x = b[r * 4 + c], y = b[r * 4 + c + 1], u = b[c * 4 + r], v = b[(c + 1) * 4 + r];
        if (x && y) smooth -= Math.abs(Math.log2(x) - Math.log2(y)); if (u && v) smooth -= Math.abs(Math.log2(u) - Math.log2(v));
        mono -= Math.max(0, Math.log2(x || 1) - Math.log2(y || 1)) + Math.max(0, Math.log2(u || 1) - Math.log2(v || 1)); // 偏好由左到右、由上到下遞減
    }
    const maxV = Math.max(...b);
    return score + mono * 40 + smooth * 12 + (b[0] === maxV ? 300 : 0) + Math.log2(maxV) * 20;
};
const search = (b, depth) => {
    let best = -Infinity;
    for (const d of ['left', 'down', 'right', 'up']) {
        const r = G.move(b, d);
        if (!r.moved) continue;
        let v = depth <= 1 ? evalBoard(r.board) : 0;
        if (depth > 1) {
            const empty = r.board.map((x, i) => (x ? -1 : i)).filter(i => i >= 0);
            const sample = empty.length > 4 ? empty.filter((_, k) => k % Math.ceil(empty.length / 4) === 0) : empty;
            for (const i of sample) for (const [val, p] of [[2, 0.9], [4, 0.1]]) { const nb = r.board.slice(); nb[i] = val; v += p * search(nb, depth - 1) / sample.length; }
            if (!sample.length) v = evalBoard(r.board);
        }
        if (v > best) best = v;
    }
    return best === -Infinity ? -1e9 : best;
};
const strongMove = b => {
    let best = -Infinity, pick = null;
    for (const d of ['left', 'down', 'right', 'up']) {
        const r = G.move(b, d);
        if (!r.moved) continue;
        const empty = r.board.map((x, i) => (x ? -1 : i)).filter(i => i >= 0);
        const sample = empty.length > 5 ? empty.filter((_, k) => k % Math.ceil(empty.length / 5) === 0) : empty;
        let v = 0;
        for (const i of sample) for (const [val, p] of [[2, 0.9], [4, 0.1]]) { const nb = r.board.slice(); nb[i] = val; v += p * search(nb, 1) / sample.length; }
        if (!sample.length) v = evalBoard(r.board);
        if (v > best) { best = v; pick = d; }
    }
    return pick;
};
export function play2048(level, skill) {
    const lv = G.LEVELS[level - 1];
    let board = G.newBoard(), moves = lv.moves;
    const dirs = ['left', 'down', 'right', 'up'];
    while (moves > 0) {
        if (G.maxTile(board) >= lv.target) return { won: true, left: moves / lv.moves };
        let pick = null;
        if (skill === 'strong') {
            pick = strongMove(board);
            if (!pick) return { won: false, left: 0 };
        } else if (skill === 'casual') {
            const ok = dirs.filter(d => G.move(board, d).moved);
            if (!ok.length) return { won: false, left: 0 };
            pick = ok[Math.floor(Math.random() * ok.length)];
        } else {
            let best = -Infinity;
            for (const d of dirs) {
                const r = G.move(board, d);
                if (!r.moved) continue;
                const empty = r.board.filter(v => !v).length;
                // 角落權重：大的方塊靠左下
                let corner = 0;
                for (let i = 0; i < 16; i++) { const x = i % 4, y = Math.floor(i / 4); corner += r.board[i] * (3 - x) * 0.3 + r.board[i] * y * 0.3; }
                const bonus = d === 'left' ? 4 : d === 'down' ? 3 : d === 'right' ? 0 : -6;
                const v = r.gained * 1.2 + empty * 12 + corner * 0.05 + bonus;
                if (v > best) { best = v; pick = d; }
            }
            if (!pick) return { won: false, left: 0 };
        }
        board = G.spawn(G.move(board, pick).board);
        moves--;
    }
    return { won: G.maxTile(board) >= lv.target, left: 0 };
}

// ───── 貪吃蛇 ─────
// 安全路徑機器人：先找走向食物的最短路，並模擬「吃到之後蛇還能走到自己的尾巴」才走；否則先繞著尾巴走。
// 用來確認每一關「做得到」（障礙物與長度不會讓場地變成死局）。回傳 { won, steps, turns, foods }
export function playSnake(level, maxSteps = 6000) {
    const s = S.createState(level === 'endless' ? S.ENDLESS : S.levelConfig(level));
    const N = S.N, K = (x, y) => y * N + x;
    let turns = 0, lastDir = s.dir;
    const bfs = (start, target, blocked) => {
        const prev = new Map([[K(start.x, start.y), null]]);
        const q = [[start.x, start.y]];
        while (q.length) {
            const [x, y] = q.shift();
            if (x === target.x && y === target.y) { const path = []; let k = K(x, y); while (prev.get(k) !== null) { path.push({ x: k % N, y: Math.floor(k / N) }); k = prev.get(k); } return path.reverse(); }
            for (const [dx, dy] of Object.values(S.DIRS)) {
                const nx = x + dx, ny = y + dy, nk = K(nx, ny);
                if (nx < 0 || ny < 0 || nx >= N || ny >= N || s.walls.has(nk) || prev.has(nk)) continue;
                if (blocked.has(nk) && !(nx === target.x && ny === target.y)) continue;
                prev.set(nk, K(x, y)); q.push([nx, ny]);
            }
        }
        return null;
    };
    const dirTo = (from, to) => Object.entries(S.DIRS).find(([, [dx, dy]]) => from.x + dx === to.x && from.y + dy === to.y)[0];
    while (!s.dead && !s.won && s.steps < maxSteps) {
        const head = s.snake[0], tail = s.snake[s.snake.length - 1];
        let move = null;
        if (s.food) {
            const body = new Set(s.snake.slice(0, -1).map(p => K(p.x, p.y)));
            const path = bfs(head, s.food, body);
            if (path) {
                // 模擬走完這條路：蛇身會跟著前進，吃到後要還能走回尾巴
                let sim = s.snake.map(p => ({ ...p }));
                for (const p of path) { sim.unshift({ x: p.x, y: p.y }); if (!(p.x === s.food.x && p.y === s.food.y)) sim.pop(); }
                const simBody = new Set(sim.slice(0, -1).map(p => K(p.x, p.y)));
                const back = bfs(sim[0], sim[sim.length - 1], simBody);
                if (back !== null || sim.length <= 3) move = path[0];
            }
        }
        if (!move) {
            // 沒有安全的路到食物：往「之後可以走到的空間最大」而且離食物近的方向走（不會立刻死）
            const body = new Set(s.snake.slice(0, -1).map(p => K(p.x, p.y)));
            const area = start => { const seen = new Set([K(start.x, start.y)]), st = [start]; while (st.length) { const c = st.pop(); for (const [dx, dy] of Object.values(S.DIRS)) { const nx = c.x + dx, ny = c.y + dy, nk = K(nx, ny); if (nx < 0 || ny < 0 || nx >= N || ny >= N || s.walls.has(nk) || body.has(nk) || seen.has(nk)) continue; seen.add(nk); st.push({ x: nx, y: ny }); } } return seen.size; };
            let bestScore = -Infinity;
            for (const [dx, dy] of Object.values(S.DIRS)) {
                const p = { x: head.x + dx, y: head.y + dy };
                if (p.x < 0 || p.y < 0 || p.x >= N || p.y >= N || s.walls.has(K(p.x, p.y)) || body.has(K(p.x, p.y))) continue;
                const dist = s.food ? Math.abs(p.x - s.food.x) + Math.abs(p.y - s.food.y) : 0;
                const sc = area(p) * 2 - dist;
                if (sc > bestScore) { bestScore = sc; move = p; }
            }
            if (!move) break;
        }
        const dir = dirTo(head, move);
        if (dir !== lastDir) { turns++; lastDir = dir; }
        S.setDir(s, dir);
        S.step(s);
    }
    return { won: s.won, steps: s.steps, turns, foods: s.cfg.foods, eaten: s.eaten };
}

// ───── 翻牌 ─────
// 記憶容量 capacity：最多記得最近看過的幾張牌的位置與圖案（Infinity＝完美記憶）。回傳用掉的步數（兩張一步）
export function playMemory(pairs, capacity, rng = Math.random) {
    const deck = MM.makeDeck(pairs, rng);
    const matched = new Set();
    let known = []; // [{ i, face }] 依看到的先後
    let moves = 0;
    const remember = (i, face) => { known = known.filter(k => k.i !== i); known.push({ i, face }); while (known.length > capacity) known.shift(); };
    while (matched.size < deck.length && moves < 500) {
        // 已知的一對
        let pair = null;
        for (const a of known) { const b = known.find(k => k.i !== a.i && k.face === a.face && !matched.has(k.i)); if (b && !matched.has(a.i)) { pair = [a.i, b.i]; break; } }
        moves++;
        if (pair) { matched.add(pair[0]); matched.add(pair[1]); known = known.filter(k => !matched.has(k.i)); continue; }
        const unseen = deck.map((_, i) => i).filter(i => !matched.has(i) && !known.some(k => k.i === i));
        const first = unseen.length ? unseen[Math.floor(rng() * unseen.length)] : known[0].i;
        remember(first, deck[first].face);
        const match = known.find(k => k.i !== first && k.face === deck[first].face && !matched.has(k.i));
        if (match) { matched.add(first); matched.add(match.i); known = known.filter(k => !matched.has(k.i)); continue; }
        const rest = deck.map((_, i) => i).filter(i => i !== first && !matched.has(i) && !known.some(k => k.i === i));
        if (!rest.length) { // 只剩已知的牌可翻
            const other = known.find(k => k.i !== first && !matched.has(k.i));
            if (!other) break;
            continue;
        }
        const second = rest[Math.floor(rng() * rest.length)];
        remember(second, deck[second].face);
        if (deck[second].face === deck[first].face) { matched.add(first); matched.add(second); known = known.filter(k => !matched.has(k.i)); }
    }
    return moves;
}

// ───── 踩地雷 ─────
// 解題機器人：單點規則＋子集規則；沒有把握就猜機率最低的格子。回傳 { won, guesses }
export function playMines(level, rng = Math.random) {
    const { w, h, mines } = MN.LEVELS[level - 1];
    const cells = MN.newCells(w, h);
    const nb = i => MN.neighbors(w, h, i);
    const first = Math.floor(rng() * w * h);
    MN.plant(cells, w, h, mines, first, rng);
    MN.openCell(cells, w, h, first);
    let guesses = 0;
    const flagged = new Set();
    for (let guard = 0; guard < 5000; guard++) {
        if (MN.isWon(cells)) return { won: true, guesses };
        let progress = false;
        // 單點規則
        for (let i = 0; i < cells.length; i++) {
            if (!cells[i].open || cells[i].n === 0) continue;
            const around = nb(i), hidden = around.filter(j => !cells[j].open && !flagged.has(j)), fl = around.filter(j => flagged.has(j)).length;
            if (!hidden.length) continue;
            if (cells[i].n - fl === hidden.length) { hidden.forEach(j => flagged.add(j)); progress = true; }
            else if (cells[i].n === fl) { hidden.forEach(j => { if (cells[j].mine) throw new Error('機器人誤判'); MN.openCell(cells, w, h, j); }); progress = true; }
        }
        if (progress) continue;
        // 子集規則：A 的未知集合是 B 的子集 → 差集的地雷數 = B剩餘 − A剩餘
        const cons = [];
        for (let i = 0; i < cells.length; i++) {
            if (!cells[i].open || cells[i].n === 0) continue;
            const hidden = nb(i).filter(j => !cells[j].open && !flagged.has(j));
            if (hidden.length) cons.push({ set: hidden, left: cells[i].n - nb(i).filter(j => flagged.has(j)).length });
        }
        for (const a of cons) for (const b of cons) {
            if (a === b || a.set.length >= b.set.length || !a.set.every(j => b.set.includes(j))) continue;
            const diff = b.set.filter(j => !a.set.includes(j)), dl = b.left - a.left;
            if (dl === 0) { diff.forEach(j => { if (cells[j].mine) throw new Error('機器人誤判'); MN.openCell(cells, w, h, j); }); progress = true; }
            else if (dl === diff.length) { diff.forEach(j => flagged.add(j)); progress = true; }
        }
        if (progress) continue;
        // 猜：邊界格取（周圍數字剩餘地雷 / 未知格）的最大值當風險，和「不在邊界的格子」的整體密度比
        const hiddenAll = cells.map((c, i) => i).filter(i => !cells[i].open && !flagged.has(i));
        const remaining = mines - flagged.size;
        const density = remaining / hiddenAll.length;
        let best = null, bestRisk = 2;
        const risk = new Map();
        for (const c of cons) for (const j of c.set) risk.set(j, Math.max(risk.get(j) || 0, c.left / c.set.length));
        for (const j of hiddenAll) {
            const r = risk.has(j) ? risk.get(j) : density;
            if (r < bestRisk) { bestRisk = r; best = j; }
        }
        if (best === null) return { won: false, guesses };
        guesses++;
        if (cells[best].mine) return { won: false, guesses };
        MN.openCell(cells, w, h, best);
    }
    return { won: false, guesses };
}

// 不用猜就能解開的比例（解題機器人從頭到尾沒猜過）
export function minesNoGuessRate(level, n, seed) {
    let ok = 0;
    for (let i = 0; i < n; i++) { const r = playMines(level, mulberry(seed + i)); if (r.won && r.guesses === 0) ok++; }
    return ok / n;
}

// ───── 消消樂 ─────
// 高手：每一步挑得分最高（蒐集關挑蒐集最多）；casual：隨機挑一個合法步
export function playMatch3(level, skill) {
    const cfg = M3.levelConfig(level);
    const b = M3.makeBoard(cfg.types);
    let score = 0, got = 0;
    for (let mv = 0; mv < cfg.moves; mv++) {
        let list = M3.validMoves(b);
        if (!list.length) { M3.reshuffle(b, cfg.types); list = M3.validMoves(b); }
        let best = list[Math.floor(Math.random() * list.length)];
        if (skill === 'expert') {
            let bv = -1;
            for (const m of list) {
                const c = b.slice(); [c[m.a], c[m.b]] = [c[m.b], c[m.a]];
                const r = M3.resolveAll(c, cfg.types);
                const v = cfg.collect ? (r.counts[cfg.fruit] || 0) * 100 + r.score / 100 : r.score;
                if (v > bv) { bv = v; best = m; }
            }
        }
        [b[best.a], b[best.b]] = [b[best.b], b[best.a]];
        const r = M3.resolveAll(b, cfg.types);
        score += r.score; got += r.counts[cfg.fruit] || 0;
        if ((cfg.collect ? got : score) >= cfg.goal) return { won: true, used: mv + 1, moves: cfg.moves };
    }
    return { won: false, used: cfg.moves, moves: cfg.moves };
}

// ───── 華容道 ─────
import * as SL from '../../js/apps/arcade/games/slide-core.js';
// 加權 A*（w 越大越快但解越長）：用來估計大盤面的「大約最佳步數」，不保證最佳。找不到（超過節點上限）回傳 null
export function slideSolveWeighted(board, n, w = 2, maxNodes = 300000) {
    const key = b => b.join(',');
    const heap = [];
    const push = e => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].f <= heap[i].f) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { let m = i; const l = 2 * i + 1, r = l + 1; if (l < heap.length && heap[l].f < heap[m].f) m = l; if (r < heap.length && heap[r].f < heap[m].f) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    const best = new Map([[key(board), 0]]);
    push({ b: board, g: 0, f: w * SL.manhattan(board, n), prev: -1 });
    let nodes = 0;
    while (heap.length && nodes++ < maxNodes) {
        const { b, g, prev } = pop();
        if (SL.isSolved(b)) return g;
        if (g > best.get(key(b))) continue;
        const blank = b.indexOf(0);
        for (const i of SL.neighborsOf(n, blank)) {
            if (i === prev) continue;
            const nb = SL.slide(b, n, i), k = key(nb), ng = g + 1;
            if (best.has(k) && best.get(k) <= ng) continue;
            best.set(k, ng);
            push({ b: nb, g: ng, f: ng + w * SL.manhattan(nb, n), prev: blank });
        }
    }
    return null;
}
