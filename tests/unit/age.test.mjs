import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ageOf, isAdultOn, unlockDateOf, toBirthString, fmtDate } from '../../js/core/age-core.js';

const d = (y, m, day) => new Date(y, m - 1, day);

test('ageOf：生日當天才加一歲', () => {
    assert.equal(ageOf('2008-10-20', d(2026, 10, 19)), 17);
    assert.equal(ageOf('2008-10-20', d(2026, 10, 20)), 18);
    assert.equal(ageOf('2008-10-20', d(2027, 1, 1)), 18);
    assert.equal(ageOf(null), 0);
});

test('isAdultOn：滿 18 歲當天就解鎖，沒有生日資料一律視為未成年', () => {
    assert.equal(isAdultOn('2008-10-21', d(2026, 10, 20)), false);
    assert.equal(isAdultOn('2008-10-20', d(2026, 10, 20)), true);
    assert.equal(isAdultOn(null, d(2026, 10, 20)), false);
});

test('unlockDateOf：18 歲生日；2/29 出生者在平年落在 3/1', () => {
    assert.equal(fmtDate(unlockDateOf('2011-06-15')), '2029/6/15');
    assert.equal(fmtDate(unlockDateOf('2008-02-29')), '2026/3/1');
    assert.equal(unlockDateOf(null), null);
});

test('toBirthString：拒絕不存在的日期、未來與太早的年份', () => {
    assert.equal(toBirthString(2000, 1, 5), '2000-01-05');
    assert.throws(() => toBirthString(2001, 2, 29), /不存在/);
    assert.throws(() => toBirthString(2001, 2, 31), /不存在/);
    assert.throws(() => toBirthString(2030, 1, 1, d(2026, 10, 20)), /未來/);
    assert.throws(() => toBirthString(1899, 1, 1), /年份/);
});
