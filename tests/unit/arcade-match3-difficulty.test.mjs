// 消消樂 30 關的難度實測（和 arcade-difficulty.test.mjs 同一套做法：機器人＋固定亂數種子）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as B from './_arcade-bots.mjs';
import * as M3 from '../../js/apps/match-3/engine.js';

const rate = (n, fn) => { let w = 0; for (let k = 0; k < n; k++) if (fn(k)) w++; return w / n; };

test('消消樂：高手（每步挑最高分）每一關都過得了、後期約 6～7 成；隨便走的人越來越難過', () => {
    const win = (lv, skill) => B.withSeed(5000 + lv + (skill === 'expert' ? 0 : 777), () => rate(30, () => B.playMatch3(lv, skill).won));
    for (const lv of [1, 5, 10, 15, 20, 25, 30]) assert.ok(win(lv, 'expert') >= 0.5, `第 ${lv} 關高手只過了 ${win(lv, 'expert')}`);
    assert.ok(win(3, 'expert') >= 0.95 && win(30, 'expert') <= 0.9, '後期不能是穩過');
    const casualEarly = [1, 2, 3, 4].reduce((s, lv) => s + win(lv, 'casual'), 0) / 4;
    const casualLate = [27, 28, 29, 30].reduce((s, lv) => s + win(lv, 'casual'), 0) / 4;
    assert.ok(casualEarly >= 0.6, '前幾關隨便走也有機會：' + casualEarly);
    assert.ok(casualLate <= 0.4, '最後幾關隨便走很難過：' + casualLate);
    assert.ok(casualEarly - casualLate >= 0.3);
});

test('消消樂：高手過關時用掉的步數比例隨關卡增加（前期很寬鬆、後期要用到大部分步數）', () => {
    const used = lv => B.withSeed(6000 + lv, () => { let t = 0, n = 0; for (let k = 0; k < 30; k++) { const r = B.playMatch3(lv, 'expert'); if (r.won) { t += r.used / r.moves; n++; } } return t / Math.max(1, n); });
    assert.ok(used(2) <= 0.5 && used(30) >= 0.6, `${used(2)} → ${used(30)}`);
    assert.equal(M3.LEVEL_COUNT, 30);
});
