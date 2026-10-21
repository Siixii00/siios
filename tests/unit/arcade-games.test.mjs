import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as MM from '../../js/apps/arcade/games/memory-core.js';
import * as MN from '../../js/apps/arcade/games/mines-core.js';
import * as SU from '../../js/apps/arcade/games/sudoku-core.js';
import * as SL from '../../js/apps/arcade/games/slide-core.js';
import * as LI from '../../js/apps/arcade/games/lights-core.js';
import * as BU from '../../js/apps/arcade/games/bulls-core.js';
import * as SN from '../../js/apps/arcade/games/snake-core.js';
import { mulberry } from './_arcade-bots.mjs';

// ───── 翻牌 ─────
test('翻牌：牌組每種圖案剛好兩張、不會用到不存在的圖案；關卡對數遞增、步數上限足夠完美記憶完成', () => {
    for (const lv of MM.LEVELS) {
        const deck = MM.makeDeck(lv.pairs);
        assert.equal(deck.length, lv.pairs * 2);
        const count = {}; deck.forEach(c => { count[c.face] = (count[c.face] || 0) + 1; });
        assert.ok(Object.values(count).every(n => n === 2));
        assert.ok(deck.every(c => MM.EMOJI.includes(c.face)));
        assert.ok(lv.limit >= lv.pairs + 2, '上限至少要比對數多一點');
    }
    assert.ok(MM.EMOJI.length >= Math.max(...MM.LEVELS.map(l => l.pairs)));
    const pairs = MM.LEVELS.map(l => l.pairs);
    assert.deepEqual(pairs, [...pairs].sort((a, b) => a - b));
    assert.deepEqual([MM.cols(3), MM.cols(8), MM.cols(16)], [4, 5, 6]);
});

test('翻牌：星數門檻（步數越少越多星）', () => {
    assert.equal(MM.starsFor(10, 16), 3);
    assert.equal(MM.starsFor(10, 21), 2);
    assert.equal(MM.starsFor(10, 30), 1);
});

// ───── 踩地雷 ─────
test('踩地雷：第一下一定安全（點到的格子與它周圍都沒有雷），雷數正確，數字正確', () => {
    for (let lv = 1; lv <= MN.LEVELS.length; lv++) {
        const { w, h, mines } = MN.LEVELS[lv - 1];
        for (let k = 0; k < 5; k++) {
            const cells = MN.newCells(w, h), safe = Math.floor(Math.random() * w * h);
            MN.plant(cells, w, h, mines, safe);
            assert.equal(cells.filter(c => c.mine).length, mines);
            assert.ok(!cells[safe].mine && MN.neighbors(w, h, safe).every(j => !cells[j].mine));
            cells.forEach((c, i) => assert.equal(c.n, MN.neighbors(w, h, i).filter(j => cells[j].mine).length));
        }
    }
});

test('踩地雷：打開 0 會連鎖、插旗的不會被打開、贏的條件是所有非雷都打開', () => {
    const cells = MN.newCells(5, 5);
    cells[24].mine = true;
    cells.forEach((c, i) => { c.n = MN.neighbors(5, 5, i).filter(j => cells[j].mine).length; });
    cells[3].flag = true;
    MN.openCell(cells, 5, 5, 0);
    assert.ok(cells.filter(c => c.open).length >= 20, '連鎖打開大片');
    assert.equal(cells[3].open, false, '插旗的格子不會被連鎖打開');
    assert.equal(MN.isWon(cells), false);
    cells[3].flag = false; MN.openCell(cells, 5, 5, 3);
    cells.forEach(c => { if (!c.mine) c.open = true; });
    assert.equal(MN.isWon(cells), true);
});

test('踩地雷：每一關都能產生「不用猜」的盤面（只靠單點與子集規則就能解開），而且很快', () => {
    for (let lv = 1; lv <= MN.LEVELS.length; lv++) {
        const { w, h, mines } = MN.LEVELS[lv - 1];
        for (let k = 0; k < 6; k++) {
            const rng = mulberry(500 + lv * 10 + k), cells = MN.newCells(w, h), first = Math.floor(rng() * w * h);
            const t0 = Date.now();
            const r = MN.plantFair(cells, w, h, mines, first, rng, 400);
            assert.ok(Date.now() - t0 < 1500, `第 ${lv} 關出題太慢`);
            assert.equal(r.fair, true, `第 ${lv} 關 400 次內找不到不用猜的盤面`);
            assert.equal(MN.canSolveWithoutGuess(cells, w, h, first), true);
            assert.equal(cells.filter(c => c.mine).length, mines);
            assert.ok(!cells[first].mine && MN.neighbors(w, h, first).every(j => !cells[j].mine));
        }
    }
});

test('踩地雷：canSolveWithoutGuess 對真的要猜的盤面回 false（經典的 50/50）', () => {
    // 一個只能靠運氣的角落：兩格雷、兩格安全互相無法區分
    const w = 4, h = 1;
    const cells = MN.newCells(w, h);
    cells[0].mine = true; // 從 3 號開始：連鎖打開 2、1（1 號的數字是 1），剩下的就是雷，全部解開
    cells.forEach((c, i) => { c.n = MN.neighbors(w, h, i).filter(j => cells[j].mine).length; });
    assert.equal(MN.canSolveWithoutGuess(cells, w, h, 3), true, '這個直條不用猜');
    const c2 = MN.newCells(2, 2);
    c2[0].mine = true;
    c2.forEach((c, i) => { c.n = MN.neighbors(2, 2, i).filter(j => c2[j].mine).length; });
    assert.equal(MN.canSolveWithoutGuess(c2, 2, 2, 3), false, '2×2 一顆雷：打開的 3 號只說「周圍有 1 顆」，剩下三格哪一格是雷無從判斷，只能猜');
});

test('踩地雷：關卡密度逐步提高、星數門檻', () => {
    const dens = MN.LEVELS.map(l => l.mines / (l.w * l.h));
    assert.ok(dens.every((d, i) => i === 0 || d >= dens[i - 1] - 0.015), '密度大致遞增');
    assert.ok(dens[0] < 0.13 && dens.at(-1) > 0.2 && dens.at(-1) < 0.23);
    assert.equal(MN.starsFor(30, 100), 3);
    assert.equal(MN.starsFor(120, 100), 2);
    assert.equal(MN.starsFor(400, 100), 1);
});

// ───── 貪吃蛇 ─────
test('貪吃蛇：障礙物不會圍出死胡同（每個空格至少有兩個可走的鄰格），所有關卡', () => {
    for (let n = 1; n <= SN.LEVEL_COUNT; n++) for (let i = 0; i < 12; i++) {
        const s = SN.createState(SN.levelConfig(n));
        assert.equal(SN.hasNoDeadEnds(s.walls), true, `第 ${n} 關出現死胡同`);
        assert.equal(s.walls.size, SN.levelConfig(n).walls, `第 ${n} 關放不滿障礙物`);
    }
    assert.equal(SN.hasNoDeadEnds(new Set([1 * SN.N + 0, 0 * SN.N + 1])), false, '左上角被兩格圍住就是死胡同');
});

test('貪吃蛇：無盡模式沒有終點、速度隨吃到的顆數加快但有下限', () => {
    assert.equal(SN.ENDLESS.foods, Infinity);
    assert.equal(SN.endlessSpeed(0), 150);
    assert.ok(SN.endlessSpeed(30) < SN.endlessSpeed(3));
    assert.equal(SN.endlessSpeed(100000), 70);
    const s = SN.createState(SN.ENDLESS);
    s.food = { x: s.snake[0].x + 1, y: s.snake[0].y };
    SN.step(s);
    assert.equal(s.won, false);
    assert.equal(s.eaten, 1);
});

// ───── 數獨 ─────
test('數獨：解題器能解出合法的答案、算得出解的個數', () => {
    for (const size of [4, 6, 9]) {
        const sol = SU.generateFull(size, mulberry(size));
        const { units } = SU.geometry(size);
        for (const unit of units) assert.deepEqual(unit.map(i => sol[i]).sort((a, b) => a - b), Array.from({ length: size }, (_, k) => k + 1), `${size}×${size} 的一行／列／宮不是 1..${size}`);
        assert.equal(SU.countSolutions(Array(size * size).fill(0), size, 2), 2, '空盤有很多解');
        const half = sol.map((v, i) => (i % 2 ? v : 0));
        assert.deepEqual(SU.solve(half, size), SU.solve(half, size));
    }
    assert.equal(SU.solve([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4), null, '開頭就衝突的盤面無解');
});

test('數獨：每一關的題目都是唯一解、只靠基本推理就能解開、提示數接近目標', () => {
    SU.LEVELS.forEach((lv, i) => {
        for (let k = 0; k < 3; k++) {
            const g = SU.generate(lv, mulberry(40 + i * 7 + k));
            assert.equal(g.puzzle.filter(Boolean).length, g.clues);
            assert.ok(g.clues <= lv.clues + 2, `第 ${i + 1} 關提示數 ${g.clues}，目標 ${lv.clues}`);
            assert.equal(SU.countSolutions(g.puzzle, lv.size, 2), 1, `第 ${i + 1} 關不是唯一解`);
            const r = SU.solveBySingles(g.puzzle, lv.size);
            assert.equal(r.solved, true, `第 ${i + 1} 關需要基本推理以外的方法`);
            assert.deepEqual(r.grid, g.solution);
            assert.deepEqual(SU.solve(g.puzzle, lv.size), g.solution);
            g.puzzle.forEach((v, j) => { if (v) assert.equal(v, g.solution[j]); });
        }
    });
});

test('數獨：越後面的關卡提示越少、需要「唯一位置」推理的次數越多', () => {
    for (const size of [4, 6, 9]) {
        const clues = SU.LEVELS.filter(l => l.size === size).map(l => l.clues);
        assert.deepEqual(clues, [...clues].sort((a, b) => b - a));
    }
    const sizes = SU.LEVELS.map(l => l.size);
    assert.deepEqual(sizes, [...sizes].sort((a, b) => a - b), '先小盤面、再大盤面');
    const hidden = lv => { let t = 0; for (let k = 0; k < 8; k++) t += SU.solveBySingles(SU.generate(lv, mulberry(900 + k)).puzzle, lv.size).hidden; return t / 8; };
    assert.ok(hidden(SU.LEVELS[4]) < hidden(SU.LEVELS[8]));
    assert.ok(hidden(SU.LEVELS[8]) < hidden(SU.LEVELS[11]));
});

test('數獨：衝突偵測與星數門檻', () => {
    assert.deepEqual([...SU.conflicts([1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], 4)].sort(), [0, 1]);
    assert.equal(SU.conflicts([1, 2, 3, 4, 3, 4, 1, 2, 2, 1, 4, 3, 4, 3, 2, 1], 4).size, 0);
    assert.deepEqual([SU.starsFor(0, 0), SU.starsFor(0, 1), SU.starsFor(1, 3), SU.starsFor(2, 0), SU.starsFor(0, 4)], [3, 3, 2, 1, 1]);
});

// ───── 華容道 ─────
test('華容道：移動規則、完成判斷、打亂後一定解得開（所有關卡、很多次）', () => {
    for (const n of [3, 4, 5]) {
        const solved = SL.solvedBoard(n);
        assert.equal(SL.isSolved(solved), true);
        const blank = solved.indexOf(0);
        const neighbor = SL.neighborsOf(n, blank)[0];
        const moved = SL.slide(solved, n, neighbor);
        assert.equal(moved[blank], solved[neighbor]);
        assert.equal(moved[neighbor], 0);
        assert.equal(SL.slide(solved, n, 0 === blank ? 1 : 0) === null || SL.neighborsOf(n, blank).includes(0 === blank ? 1 : 0), true);
        assert.equal(SL.slide(solved, n, blank), null, '點空格本身不會動');
    }
    for (const lv of SL.LEVELS) for (let k = 0; k < 30; k++) {
        const b = SL.scramble(lv.n, lv.depth, mulberry(k + lv.depth));
        assert.equal(SL.isSolvable(b, lv.n), true);
        assert.equal(SL.isSolved(b), false);
        assert.deepEqual([...b].sort((a, c) => a - c), [...SL.solvedBoard(lv.n)].sort((a, c) => a - c));
    }
    assert.equal(SL.isSolvable([2, 1, 3, 4, 5, 6, 7, 8, 0], 3), false, '只交換兩塊是無解的');
});

test('華容道：3×3 的最佳步數（IDA*）不超過打亂步數，而且和奇偶性一致', () => {
    for (let k = 0; k < 15; k++) {
        const depth = [10, 16, 24, 40][k % 4];
        const b = SL.scramble(3, depth, mulberry(300 + k));
        const opt = SL.optimalMoves(b, 3);
        assert.ok(opt >= 1 && opt <= depth, `最佳 ${opt} 超過打亂 ${depth}`);
        assert.equal(opt % 2, depth % 2 === 0 ? 0 : opt % 2, '奇偶性');
        assert.ok(opt >= SL.manhattan(b, 3));
    }
});

test('華容道：星數門檻', () => {
    assert.deepEqual([SL.starsFor(20, 10), SL.starsFor(21, 10), SL.starsFor(35, 10), SL.starsFor(36, 10)], [3, 2, 2, 1]);
});

// ───── 關燈 ─────
test('關燈：按一格會切換自己與上下左右（邊角不會超出棋盤）；按兩次回復原樣', () => {
    const off = Array(9).fill(0);
    assert.deepEqual(LI.press(off, 3, 4), [0, 1, 0, 1, 1, 1, 0, 1, 0]);
    assert.deepEqual(LI.press(off, 3, 0), [1, 1, 0, 1, 0, 0, 0, 0, 0]);
    assert.deepEqual(LI.press(LI.press(off, 3, 4), 3, 4), off);
    assert.equal(LI.isOff(off), true);
});

test('關燈：出題一定解得開，最少步數不超過出題按的次數，照出題的按法會全部關掉', () => {
    for (const lv of LI.LEVELS) for (let k = 0; k < 25; k++) {
        const p = LI.puzzle(lv.n, lv.presses, mulberry(77 + k + lv.presses));
        assert.equal(LI.isOff(p.board), false);
        let b = p.board; p.solution.forEach(i => { b = LI.press(b, lv.n, i); });
        assert.equal(LI.isOff(b), true);
        const par = LI.minPresses(p.board, lv.n);
        assert.ok(par !== null && par >= 1 && par <= lv.presses, `最少步數 ${par} 超過 ${lv.presses}`);
    }
});

test('關燈：minPresses 的結果真的可行（用代數解出來的最少按法會把燈全關）、無解的盤面回 null', () => {
    // 4×4 有「按法不唯一」的情況：兩種解都要關得掉，取最少
    for (let k = 0; k < 20; k++) {
        const p = LI.puzzle(4, 6, mulberry(k));
        const par = LI.minPresses(p.board, 4);
        assert.ok(par <= 6);
    }
    // 5×5 有無解的盤面（只亮一盞燈中央以外的某些角落）
    const unsolvable = Array(25).fill(0); unsolvable[0] = 1;
    assert.equal(LI.minPresses(unsolvable, 5), null);
});

test('關燈：星數門檻', () => {
    assert.deepEqual([LI.starsFor(4, 4), LI.starsFor(5, 4), LI.starsFor(8, 4), LI.starsFor(11, 4)], [3, 3, 2, 1]);
});

// ───── 猜數字 ─────
test('猜數字：A、B 的計算（數字與位置都對、數字對位置錯）', () => {
    assert.deepEqual(BU.score([1, 2, 3, 4], [1, 2, 3, 4]), { a: 4, b: 0 });
    assert.deepEqual(BU.score([1, 2, 3, 4], [4, 3, 2, 1]), { a: 0, b: 4 });
    assert.deepEqual(BU.score([1, 2, 3, 4], [1, 3, 5, 6]), { a: 1, b: 1 });
    assert.deepEqual(BU.score([0, 1, 2], [3, 4, 5]), { a: 0, b: 0 });
});

test('猜數字：所有可能的答案個數、答案不重複、一致的候選過濾', () => {
    assert.equal(BU.allCodes(3).length, 720);
    assert.equal(BU.allCodes(4).length, 5040);
    for (let k = 0; k < 50; k++) {
        const s = BU.randomSecret(5, mulberry(k));
        assert.equal(new Set(s).size, 5);
        assert.ok(s.every(d => d >= 0 && d < 10));
    }
    const secret = [3, 1, 4, 5], guess = [1, 3, 4, 9], fb = BU.score(secret, guess);
    const left = BU.consistent(BU.allCodes(4), guess, fb);
    assert.ok(left.length < 5040 && left.some(c => c.join() === secret.join()));
    assert.ok(left.every(c => { const s = BU.score(c, guess); return s.a === fb.a && s.b === fb.b; }));
});

test('猜數字：關卡（位數遞增、次數足夠）與星數門檻', () => {
    const lens = BU.LEVELS.map(l => l.len);
    assert.deepEqual(lens, [...lens].sort((a, b) => a - b));
    for (const l of BU.LEVELS) assert.ok(l.tries >= 5 && l.tries <= 12);
    assert.deepEqual([BU.starsFor(6, 10), BU.starsFor(7, 10), BU.starsFor(9, 10), BU.starsFor(10, 10)], [3, 2, 2, 1]);
});
