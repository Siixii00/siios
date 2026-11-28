import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MASTERY_AT, LUCK_HARVESTS, starsOf, perkOf, masteryReward, goldenChance, rollGolden, visitorOffer } from '../../js/apps/farm/game.js';

test('作物精通：收成 8／25／60 次依序拿到 1／2／3 星，星星縮短生長時間', () => {
    assert.deepEqual(MASTERY_AT, [8, 25, 60]);
    assert.deepEqual([0, 7, 8, 24, 25, 59, 60, 999].map(starsOf), [0, 0, 1, 1, 2, 2, 3, 3]);
    assert.equal(perkOf(0), 0);
    assert.ok(Math.abs(perkOf(3) - 0.15) < 1e-9);
});

test('作物精通獎金：星星越高越多，賣價越高的作物越多', () => {
    const cheap = { sell: 45 }, dear = { sell: 1500 };
    assert.equal(masteryReward(cheap, 1), 90);
    assert.ok(masteryReward(cheap, 3) > masteryReward(cheap, 1));
    assert.ok(masteryReward(dear, 1) > masteryReward(cheap, 3));
});

test('金色收成：基本機率 8%，有幸運符時變 33%；機率邊界由亂數決定', () => {
    assert.equal(goldenChance(0), 0.08);
    assert.ok(Math.abs(goldenChance(3) - 0.33) < 1e-9);
    assert.equal(rollGolden(() => 0.079, 0), true);
    assert.equal(rollGolden(() => 0.08, 0), false);
    assert.equal(rollGolden(() => 0.2, 0), false);
    assert.equal(rollGolden(() => 0.2, 3), true);
    assert.equal(LUCK_HARVESTS, 5);
});

test('旅行商人：倉庫空的送幸運符；有東西就挑總價值最高的，最多收購 5 個、換幸運符最多收 3 個', () => {
    const price = id => ({ c1: 50, c2: 100, p1: 40 }[id]);
    assert.deepEqual(visitorOffer({}, price), { kind: 'gift' });
    assert.deepEqual(visitorOffer({ c1: 1 }, price), { kind: 'gift' }); // 只有 1 件不夠談生意
    const o = visitorOffer({ c1: 9, c2: 2, p1: 1 }, price);
    assert.equal(o.kind, 'trade');
    assert.equal(o.item, 'c1'); // 9×50 > 2×100
    assert.equal(o.qty, 5);
    assert.equal(o.pay, Math.round(5 * 50 * 1.5));
    assert.equal(o.swap, 3);
    assert.equal(visitorOffer({ c2: 2 }, price).qty, 2);
    assert.equal(visitorOffer({ c2: 2 }, price).swap, 2);
});
