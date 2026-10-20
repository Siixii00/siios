import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as M from '../../js/apps/match-3/engine.js';
import * as G from '../../js/apps/arcade/games/g2048-core.js';
import * as S from '../../js/apps/arcade/games/snake-core.js';

// ───── 消消樂 ─────
test('match3：findMatches 找出橫向與直向的三連', () => {
    const b = Array(49).fill(-1);
    [0, 1, 2].forEach(i => { b[i] = 1; });          // 橫向
    [10, 17, 24].forEach(i => { b[i] = 2; });       // 直向
    b[30] = 3; b[31] = 3;                           // 只有兩個不算
    assert.deepEqual([...M.findMatches(b)].sort((a, c) => a - c), [0, 1, 2, 10, 17, 24]);
});

test('match3：makeBoard 開局沒有現成消除且至少有一步可走', () => {
    for (let types = 4; types <= 6; types++) for (let i = 0; i < 30; i++) {
        const b = M.makeBoard(types);
        assert.equal(M.findMatches(b).size, 0);
        assert.ok(M.hasMove(b));
        assert.ok(b.every(v => v >= 0 && v < types));
    }
});

test('match3：validMoves 的每一步交換後真的會消除', () => {
    const b = M.makeBoard(5);
    for (const m of M.validMoves(b)) {
        const c = b.slice(); [c[m.a], c[m.b]] = [c[m.b], c[m.a]];
        assert.ok(M.findMatches(c).size >= 3);
        assert.ok(M.adjacent(m.a, m.b));
    }
});

test('match3：resolveAll 結束時棋盤穩定、沒有空格，且分數與蒐集量一致', () => {
    for (let i = 0; i < 30; i++) {
        const b = M.makeBoard(4);
        const mv = M.validMoves(b)[0];
        [b[mv.a], b[mv.b]] = [b[mv.b], b[mv.a]];
        const r = M.resolveAll(b, 4);
        assert.equal(M.findMatches(b).size, 0);
        assert.ok(b.every(v => v >= 0 && v < 4));
        assert.ok(r.score >= 30 && r.chain >= 1);
        assert.ok(Object.values(r.counts).reduce((a, c) => a + c, 0) >= 3);
    }
});

test('match3：reshuffle 之後一定有可走的步', () => {
    const b = Array(49).fill(0).map((_, i) => i % 4);
    M.reshuffle(b, 4);
    assert.ok(M.hasMove(b));
    assert.equal(M.findMatches(b).size, 0);
});

test('match3：關卡設定逐步變難，蒐集關的水果在範圍內', () => {
    let prevTypes = 0;
    for (let n = 1; n <= M.LEVEL_COUNT; n++) {
        const c = M.levelConfig(n);
        assert.ok(c.types >= prevTypes && c.types <= 6);
        assert.ok(c.moves >= 15 && c.moves <= 25 && c.goal > 0);
        if (c.collect) assert.ok(c.fruit >= 0 && c.fruit < c.types);
        prevTypes = c.types;
    }
    assert.ok(M.levelConfig(30).moves < M.levelConfig(1).moves);
});

test('match3：starsFor 的門檻', () => {
    const cfg = { goal: 100 };
    assert.equal(M.starsFor(cfg, 99), 0);
    assert.equal(M.starsFor(cfg, 100), 1);
    assert.equal(M.starsFor(cfg, 140), 2);
    assert.equal(M.starsFor(cfg, 180), 3);
});

// 可玩性：會評估每一步實際得分的機器人，在抽樣的關卡要有不低的通過率（避免日後調參把關卡調成打不過）
test('match3：抽樣關卡對「高手機器人」可通關', () => {
    function play(cfg) {
        const b = M.makeBoard(cfg.types);
        let score = 0, got = 0;
        for (let mv = 0; mv < cfg.moves; mv++) {
            let list = M.validMoves(b);
            if (!list.length) { M.reshuffle(b, cfg.types); list = M.validMoves(b); }
            let best = list[0], bv = -1;
            for (const m of list) {
                const c = b.slice(); [c[m.a], c[m.b]] = [c[m.b], c[m.a]];
                const r = M.resolveAll(c, cfg.types);
                const v = cfg.collect ? (r.counts[cfg.fruit] || 0) * 100 + r.score / 100 : r.score;
                if (v > bv) { bv = v; best = m; }
            }
            [b[best.a], b[best.b]] = [b[best.b], b[best.a]];
            const r = M.resolveAll(b, cfg.types);
            score += r.score; got += r.counts[cfg.fruit] || 0;
            if ((cfg.collect ? got : score) >= cfg.goal) return true;
        }
        return false;
    }
    for (const n of [1, 6, 15, 24, 30]) {
        let wins = 0;
        for (let i = 0; i < 20; i++) if (play(M.levelConfig(n))) wins++;
        assert.ok(wins / 20 >= 0.35, `第 ${n} 關通過率太低：${wins}/20`);
    }
});

// ───── 2048 ─────
test('2048：slideLine 合併規則', () => {
    assert.deepEqual(G.slideLine([2, 2, 4, 0]), { line: [4, 4, 0, 0], gained: 4 });
    assert.deepEqual(G.slideLine([2, 2, 2, 2]), { line: [4, 4, 0, 0], gained: 8 });
    assert.deepEqual(G.slideLine([4, 0, 4, 8]), { line: [8, 8, 0, 0], gained: 8 });
    assert.deepEqual(G.slideLine([2, 4, 8, 16]), { line: [2, 4, 8, 16], gained: 0 });
});

test('2048：四個方向的移動與 moved 旗標', () => {
    const b = [2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4];
    assert.deepEqual(G.move(b, 'left').board.slice(0, 4), [4, 0, 0, 0]);
    assert.deepEqual(G.move(b, 'right').board.slice(0, 4), [0, 0, 0, 4]);
    assert.equal(G.move(b, 'down').board[12], 2);
    assert.equal(G.move([2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2], 'left').moved, false);
});

test('2048：spawn 只放在空格、canMove 判斷死局', () => {
    const b = G.spawn(Array(16).fill(0));
    assert.equal(b.filter(Boolean).length, 1);
    assert.ok([2, 4].includes(b.find(Boolean)));
    const full = [2, 4, 2, 4, 4, 2, 4, 2, 2, 4, 2, 4, 4, 2, 4, 2];
    assert.equal(G.canMove(full), false);
    assert.equal(G.spawn(full).join(), full.join());
    assert.equal(G.canMove([2, 2, ...full.slice(2)]), true);
});

test('2048：關卡目標遞增且步數足夠合出目標', () => {
    let prev = 0;
    for (const lv of G.LEVELS) {
        assert.ok(lv.target >= prev); prev = lv.target;
        // 合出 target 至少需要 target/4 次出現的新方塊（平均每次約 2.2）
        assert.ok(lv.moves > lv.target / 2.2, `目標 ${lv.target} 的步數 ${lv.moves} 不夠`);
    }
});

// ───── 貪吃蛇 ─────
test('snake：每一關的障礙物不會把場地切成互相到不了的區塊，也不擋起點', () => {
    for (let n = 1; n <= S.LEVEL_COUNT; n++) for (let i = 0; i < 20; i++) {
        const s = S.createState(S.levelConfig(n));
        assert.equal(s.walls.size, S.levelConfig(n).walls);
        assert.ok(!s.snake.some(p => s.walls.has(p.y * S.N + p.x)));
        assert.ok(s.food && !s.walls.has(s.food.y * S.N + s.food.x));
        // 連通性：從食物出發能走遍所有非障礙格
        const seen = new Set([s.food.y * S.N + s.food.x]), st = [s.food.y * S.N + s.food.x];
        while (st.length) {
            const c = st.pop(), x = c % S.N, y = Math.floor(c / S.N);
            for (const [dx, dy] of Object.values(S.DIRS)) {
                const nx = x + dx, ny = y + dy, k = ny * S.N + nx;
                if (nx >= 0 && ny >= 0 && nx < S.N && ny < S.N && !s.walls.has(k) && !seen.has(k)) { seen.add(k); st.push(k); }
            }
        }
        assert.equal(seen.size, S.N * S.N - s.walls.size);
    }
});

test('snake：不能直接回頭、吃到食物會變長並計數、撞牆或撞自己會死', () => {
    const s = S.createState({ level: 1, foods: 3, speed: 150, walls: 0 });
    S.setDir(s, 'left');
    assert.equal(s.dir, 'right');           // 原本向右，不能直接向左
    S.setDir(s, 'up'); assert.equal(s.dir, 'up');
    s.food = { x: s.snake[0].x, y: s.snake[0].y - 1 };
    const len = s.snake.length;
    S.step(s);
    assert.equal(s.snake.length, len + 1);
    assert.equal(s.eaten, 1);
    // 撞牆
    const w = S.createState({ level: 1, foods: 3, speed: 150, walls: 0 });
    w.snake = [{ x: 0, y: 5 }, { x: 1, y: 5 }, { x: 2, y: 5 }]; w.dir = 'left'; w.food = { x: 10, y: 10 };
    S.step(w); assert.equal(w.dead, true);
    // 吃滿食物數就過關
    const g = S.createState({ level: 1, foods: 1, speed: 150, walls: 0 });
    g.food = { x: g.snake[0].x + 1, y: g.snake[0].y };
    S.step(g); assert.equal(g.won, true);
});

test('snake：關卡設定逐步變難且在合理範圍', () => {
    let prev = null;
    for (let n = 1; n <= S.LEVEL_COUNT; n++) {
        const c = S.levelConfig(n);
        assert.ok(c.speed >= 110 && c.foods <= 20 && c.walls >= 0);
        if (prev) { assert.ok(c.speed <= prev.speed && c.walls >= prev.walls && c.foods >= prev.foods); }
        prev = c;
    }
});
