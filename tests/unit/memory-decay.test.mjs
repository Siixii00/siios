import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DecayEngine } from '../../js/core/memory-system/decay-engine.js';

const DAY = 24 * 3600 * 1000;
const mem = (daysOld, extra = {}) => ({ id: 'm', timestamp: Date.now() - daysOld * DAY, created_at: Date.now() - daysOld * DAY, decayFactor: 1, importance: 0.5, memory_type: 'dynamic', ...extra });

test('每晚睡眠週期不會把整段時間重複算一次：60 晚後的衰減等於一次算 60 天', () => {
    const e = new DecayEngine(0.01);
    const start = Date.now() - 60 * DAY;
    let m = { ...mem(60), timestamp: start, created_at: start };
    for (let day = 1; day <= 60; day++) m = e.batchDecay([m], start + day * DAY)[0];
    const oneShot = e.decay(1, 60, 0.5);
    assert.ok(Math.abs(m.decayFactor - oneShot) < 1e-9, `${m.decayFactor} vs ${oneShot}`);
});

test('預設衰減率下，一般記憶 30 天後不會被遺忘（修正前約 25 天就低於遺忘門檻）', () => {
    const e = new DecayEngine(0.01);
    const start = Date.now() - 30 * DAY;
    let m = { ...mem(30), timestamp: start, created_at: start };
    for (let day = 1; day <= 30; day++) m = e.batchDecay([m], start + day * DAY)[0];
    assert.ok(m.decayFactor > 0.5, String(m.decayFactor));
    assert.equal(e.shouldForget(m.decayFactor), false);
});

test('effectiveFactor：從上一次衰減的時間點算起，沒有衰減過就從建立時間算起', () => {
    const e = new DecayEngine(0.01);
    const now = Date.now();
    const fresh = mem(10);
    assert.ok(Math.abs(e.effectiveFactor(fresh, now) - e.decay(1, 10, 0.5)) < 1e-6);
    const decayedYesterday = { ...mem(100), decayFactor: 0.6, lastDecayed: now - DAY };
    assert.ok(Math.abs(e.effectiveFactor(decayedYesterday, now) - e.decay(0.6, 1, 0.5)) < 1e-6);
});

test('永久記憶、重要的記憶、剛建立的記憶受保護，不會被遺忘', () => {
    const e = new DecayEngine(0.01);
    assert.equal(e.isProtected(mem(100, { memory_type: 'permanent' })), true);
    assert.equal(e.isProtected(mem(100, { importance: 0.85 })), true);
    assert.equal(e.isProtected(mem(2)), true);
    assert.equal(e.isProtected(mem(100)), false);
});

test('重要性越高衰減越慢', () => {
    const e = new DecayEngine(0.05);
    assert.ok(e.decay(1, 30, 0.9) > e.decay(1, 30, 0.2));
});
