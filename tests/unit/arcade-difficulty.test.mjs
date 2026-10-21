// 街機廳的難度實測：用機器人玩每個遊戲的關卡，確認「做得到」而且「越後面越難」。
// 機器人有不同的程度（高手／一般／隨便玩），用固定的亂數種子，結果每次都一樣。
// 調整關卡參數後如果這裡失敗，代表難度曲線被破壞了（太簡單、或高手也過不了）。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from './_arcade-bots.mjs';
import * as G from '../../js/apps/arcade/games/g2048-core.js';
import * as S from '../../js/apps/arcade/games/snake-core.js';
import * as MM from '../../js/apps/arcade/games/memory-core.js';
import * as MN from '../../js/apps/arcade/games/mines-core.js';
import * as BU from '../../js/apps/arcade/games/bulls-core.js';
import * as LI from '../../js/apps/arcade/games/lights-core.js';
import * as SL from '../../js/apps/arcade/games/slide-core.js';

const rate = (n, fn) => { let w = 0; for (let k = 0; k < n; k++) if (fn(k)) w++; return w / n; };

// ───── 2048 ─────
test('2048：只會貪心的玩法，前面的關卡過得了、到 512 以上就很吃力；隨便滑的人只過得了最前面', () => {
    const decent = lv => B.withSeed(1000 + lv, () => rate(60, () => B.play2048(lv, 'decent').won));
    const casual = lv => B.withSeed(2000 + lv, () => rate(60, () => B.play2048(lv, 'casual').won));
    assert.ok(decent(1) >= 0.9, '第 1 關貪心玩法要幾乎都過：' + decent(1));
    assert.ok(decent(4) >= 0.45 && decent(4) <= 0.85, '256 的關卡貪心玩法約一半以上：' + decent(4));
    assert.ok(decent(8) <= 0.4, '512 的關卡貪心玩法就很吃力：' + decent(8));
    assert.ok(decent(1) > decent(4) && decent(4) > decent(8));
    assert.ok(casual(1) >= 0.6 && casual(1) <= 0.97, '隨便滑也有機會過第 1 關：' + casual(1));
    assert.ok(casual(4) <= 0.3 && casual(8) <= 0.05, '隨便滑過不了後面：' + casual(4) + ' ' + casual(8));
});

test('2048：高手（往後看兩步的搜尋）在最簡單與最難的關卡都做得到', { timeout: 180000 }, () => {
    const strong = lv => B.withSeed(3000 + lv, () => rate(4, () => B.play2048(lv, 'strong').won));
    assert.ok(strong(1) >= 0.99, '第 1 關：' + strong(1));
    assert.ok(strong(4) >= 0.75, '第 4 關：' + strong(4));
    assert.ok(strong(G.LEVELS.length) >= 0.5, '最後一關（1024）高手也要過得了，否則沒人過得了：' + strong(G.LEVELS.length));
});

test('2048：關卡逐步變難（目標不降、至少 12 關）', () => {
    for (let i = 1; i < G.LEVELS.length; i++) assert.ok(G.LEVELS[i].target >= G.LEVELS[i - 1].target);
    assert.ok(G.LEVELS.length >= 12);
});

// ───── 貪吃蛇 ─────
test('貪吃蛇：完美路徑機器人每一關都過得了（沒有死局、沒有死胡同），而且越後面需要的反應越快', () => {
    const rows = [];
    for (let n = 1; n <= S.LEVEL_COUNT; n++) {
        let wins = 0, steps = 0, turns = 0;
        B.withSeed(4000 + n, () => { for (let k = 0; k < 16; k++) { const r = B.playSnake(n); if (r.won) wins++; steps += r.steps; turns += r.turns; } });
        rows.push({ n, wins: wins / 16, gap: (steps / Math.max(1, turns)) * S.levelConfig(n).speed }); // 每次轉彎的間隔（毫秒）
    }
    for (const r of rows) assert.ok(r.wins >= 0.75, `第 ${r.n} 關機器人只過了 ${(r.wins * 100).toFixed(0)}%`);
    const avg = (a, b) => rows.slice(a, b).reduce((s, r) => s + r.gap, 0) / (b - a);
    assert.ok(avg(0, 4) > avg(5, 10) && avg(5, 10) > avg(10, 15), `轉彎間隔應該越來越短：${avg(0, 4).toFixed(0)} → ${avg(5, 10).toFixed(0)} → ${avg(10, 15).toFixed(0)} 毫秒`);
    assert.ok(avg(10, 15) < 350, '最後幾關要逼近人的反應極限');
});

// ───── 翻牌 ─────
test('翻牌：完美記憶的機器人每一關都過；只記得最近 6 張的玩家，前面全過、後面越來越難；只記 4 張的後期很難', () => {
    const pass = (lv, cap, i) => rate(250, k => B.playMemory(lv.pairs, cap, B.mulberry(88 + 31 * k + i)) <= lv.limit);
    const early = [0, 1, 2, 3, 4], late = [11, 12, 13, 14];
    for (let i = 0; i < MM.LEVELS.length; i++) assert.ok(pass(MM.LEVELS[i], Infinity, i) >= 0.98, `第 ${i + 1} 關完美記憶也過不了`);
    const mean = (idx, cap) => idx.reduce((s, i) => s + pass(MM.LEVELS[i], cap, i), 0) / idx.length;
    assert.ok(mean(early, 6) >= 0.97, '前 5 關記 6 張就能穩過：' + mean(early, 6));
    assert.ok(mean(late, 6) <= 0.8 && mean(late, 6) >= 0.35, '後 4 關記 6 張要看運氣：' + mean(late, 6));
    assert.ok(mean(late, 4) <= 0.25, '後 4 關只記 4 張幾乎過不了：' + mean(late, 4));
    assert.ok(mean(late, 8) >= 0.9, '記 8 張的玩家後期也過得了：' + mean(late, 8));
    const m = [0, 4, 9, 14].map(i => pass(MM.LEVELS[i], 6, i));
    for (let i = 1; i < m.length; i++) assert.ok(m[i] <= m[i - 1] + 0.03, '通過率隨關卡遞減：' + m.join(','));
});

// ───── 踩地雷 ─────
test('踩地雷：每一關都能不用猜就解開（所以難度來自大小與密度，不是運氣）；隨機佈雷則越後面越常需要猜', () => {
    for (const lv of [1, 5, 10, 15]) {
        const { w, h, mines } = MN.LEVELS[lv - 1];
        for (let k = 0; k < 5; k++) {
            const rng = B.mulberry(600 + lv * 9 + k), cells = MN.newCells(w, h), first = Math.floor(rng() * w * h);
            assert.equal(MN.plantFair(cells, w, h, mines, first, rng).fair, true);
            assert.equal(MN.canSolveWithoutGuess(cells, w, h, first), true);
        }
    }
    // 對照：同樣的關卡如果是隨機佈雷，需要猜的比例明顯上升（這就是「不用猜」要保證的原因）
    const noGuess = lv => B.minesNoGuessRate(lv, 80, 9000);
    assert.ok(noGuess(1) >= 0.8 && noGuess(15) <= 0.35, `隨機佈雷：第 1 關不用猜 ${noGuess(1)}，第 15 關不用猜 ${noGuess(15)}`);
    const cellsOf = lv => MN.LEVELS[lv - 1].w * MN.LEVELS[lv - 1].h;
    assert.ok(cellsOf(15) > cellsOf(1) * 4 && MN.LEVELS[14].mines / cellsOf(15) > (MN.LEVELS[0].mines / cellsOf(1)) * 1.7);
});

// ───── 猜數字 ─────
test('猜數字：每次猜一個和先前回饋不矛盾的答案，前面的關卡穩過，最後一關只有部分機會；所有關卡「做得到」', () => {
    const codes = {}; for (const len of [3, 4, 5]) codes[len] = BU.allCodes(len);
    const pass = (lv, i) => rate(120, k => {
        const rng = B.mulberry(7 + k + i * 1000), secret = BU.randomSecret(lv.len, rng);
        let cands = codes[lv.len], used = 0;
        while (used < 40) { const guess = cands[Math.floor(rng() * cands.length)]; used++; const fb = BU.score(secret, guess); if (fb.a === lv.len) break; cands = BU.consistent(cands, guess, fb); }
        return used <= lv.tries;
    });
    const rates = BU.LEVELS.map((lv, i) => pass(lv, i));
    assert.ok(rates.slice(0, 5).every(r => r >= 0.95), '前 5 關穩過：' + rates.slice(0, 5));
    assert.ok(rates.at(-1) <= 0.5 && rates.at(-1) >= 0.1, '最後一關很難但做得到：' + rates.at(-1));
    assert.ok(rates.at(-1) < rates[7] && rates[7] <= rates[0] + 0.001);
    for (const r of rates) assert.ok(r >= 0.1);
});

// ───── 關燈 ─────
test('關燈：最少步數（解的難度）隨關卡增加；棋盤越大越多', () => {
    const par = i => { const lv = LI.LEVELS[i]; let t = 0; for (let k = 0; k < 40; k++) t += LI.minPresses(LI.puzzle(lv.n, lv.presses, B.mulberry(31 + k + i * 400)).board, lv.n); return t / 40; };
    const pars = LI.LEVELS.map((_, i) => par(i));
    for (const [a, b] of [[0, 1], [2, 3], [4, 5], [5, 6], [6, 7], [8, 9]]) assert.ok(pars[a] < pars[b], `第 ${a + 1} 關 ${pars[a]} 應該比第 ${b + 1} 關 ${pars[b]} 簡單`);
    assert.ok(pars[0] <= 2.1 && pars.at(-1) >= 12);
});

// ───── 華容道 ─────
test('華容道：用加權 A* 估計的「大約最佳步數」隨關卡增加（同一種大小內）', () => {
    const med = i => {
        const lv = SL.LEVELS[i], vals = [];
        for (let k = 0; k < 15; k++) { const s = B.slideSolveWeighted(SL.scramble(lv.n, lv.depth, B.mulberry(11 + k + i * 100)), lv.n, lv.n === 3 ? 1 : 2.5, 200000); assert.ok(s !== null, `第 ${i + 1} 關解不出來`); vals.push(s); }
        return vals.sort((a, b) => a - b)[vals.length >> 1];
    };
    const m = [0, 1, 2, 3, 4, 5, 6].map(med);
    assert.ok(m[0] < m[1] && m[1] <= m[2] + 2 && m[2] <= m[3] + 2, '3×3：' + m.slice(0, 4));
    assert.ok(m[4] < m[5] && m[5] < m[6], '4×4：' + m.slice(4));
});
