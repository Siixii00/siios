import test from 'node:test';
import assert from 'node:assert/strict';
import {
    emptyFund, deposit, withdraw, spend, addGoal, removeGoal, redeem, progressOf, activeGoal,
    planCharContribution, applyCharContribution, describeFund, weeklyOf, fundPromptFor, WEEK, MAX_GOALS
} from '../../js/core/fund.js';
import { incomeFor, applyCap, DAILY_CAP } from '../../js/core/arcade-income.js';

const T0 = 1_700_000_000_000;
const base = () => emptyFund(T0);

test('deposit / withdraw / spend：不改動原物件，超過餘額會丟錯', () => {
    const f = base();
    const a = deposit(f, 500, { now: T0 }).fund;
    assert.equal(f.balance, 0);
    assert.equal(a.balance, 500);
    assert.equal(withdraw(a, 200).fund.balance, 300);
    assert.equal(spend(a, 500).fund.balance, 0);
    assert.throws(() => withdraw(a, 501), /不夠/);
    assert.throws(() => spend(a, 501), /不夠/);
    assert.throws(() => deposit(f, 0), /大於 0/);
    assert.throws(() => deposit(f, -5), /大於 0/);
    assert.throws(() => deposit(f, 'abc'), /大於 0/);
});

test('目標：存夠就達成，一次可以達成多個；順序為先建立先達成', () => {
    let f = addGoal(base(), { name: '旅行', target: 300, now: T0 }).fund;
    f = addGoal(f, { name: '鞋子', target: 200, now: T0 + 1 }).fund;
    let r = deposit(f, 250, { now: T0 + 2 });
    assert.equal(r.reached.length, 0);
    r = deposit(r.fund, 300, { now: T0 + 3 }); // 550：旅行 300 達成，剩 250 ≥ 200 → 鞋子也達成
    assert.deepEqual(r.reached.map(x => x.name), ['旅行', '鞋子']);
    assert.equal(activeGoal(r.fund), null);
});

test('目標進度：已達成但還沒兌現的目標先佔住金額', () => {
    let f = addGoal(base(), { name: 'A', target: 100, now: T0 }).fund;
    f = addGoal(f, { name: 'B', target: 100, now: T0 + 1 }).fund;
    f = deposit(f, 150, { now: T0 + 2 }).fund;
    const [a, b] = f.goals;
    assert.ok(a.doneAt && !b.doneAt);
    assert.equal(progressOf(f, a.id).have, 100);
    assert.equal(progressOf(f, b.id).have, 50);
});

test('目標：數量上限、名稱必填、達成後的目標不能直接刪', () => {
    let f = base();
    for (let i = 0; i < MAX_GOALS; i++) f = addGoal(f, { name: 'g' + i, target: 100, now: T0 + i }).fund;
    assert.throws(() => addGoal(f, { name: 'x', target: 100 }), /最多/);
    assert.throws(() => addGoal(base(), { name: '  ', target: 100 }), /名稱/);
    let g = deposit(addGoal(base(), { name: '旅行', target: 100, now: T0 }).fund, 100, { now: T0 + 1 }).fund;
    assert.equal(removeGoal(g, g.goals[0].id).fund.goals.length, 1);
});

test('兌現目標：扣掉目標金額，只能兌現一次；沒達成不能兌現', () => {
    let f = addGoal(base(), { name: '旅行', target: 100, now: T0 }).fund;
    assert.throws(() => redeem(f, f.goals[0].id), /還沒達成/);
    f = deposit(f, 130, { now: T0 + 1 }).fund;
    const r = redeem(f, f.goals[0].id, { now: T0 + 2 });
    assert.equal(r.fund.balance, 30);
    assert.equal(r.amount, 100);
    assert.throws(() => redeem(r.fund, f.goals[0].id), /已經兌現/);
});

test('角色每週出錢：沒滿一週不動、滿幾週補幾週、最多補 4 週並重設計時', () => {
    const f = base();
    assert.equal(planCharContribution(f, 100, T0 + WEEK - 1).amount, 0);
    assert.equal(planCharContribution(f, 100, T0 + WEEK).amount, 100);
    assert.equal(planCharContribution(f, 100, T0 + 3 * WEEK + 5).amount, 300);
    assert.equal(planCharContribution(f, 100, T0 + 10 * WEEK).amount, 400);
    assert.equal(planCharContribution(f, 0, T0 + 10 * WEEK).amount, 0);
    assert.equal(planCharContribution(f, -5, T0 + 10 * WEEK).amount, 0);

    const r = applyCharContribution(f, 100, T0 + 2 * WEEK + 1000);
    assert.equal(r.fund.balance, 200);
    assert.equal(r.fund.lastChar, T0 + 2 * WEEK); // 往前推用掉的週數，剩下的零頭下次還算
    assert.equal(r.fund.ledger[0].by, 'char');
    const none = applyCharContribution(r.fund, 100, T0 + 2 * WEEK + 2000);
    assert.equal(none.amount, 0);
    assert.equal(none.fund, r.fund);
    const big = applyCharContribution(f, 100, T0 + 20 * WEEK);
    assert.equal(big.fund.balance, 400);
    assert.equal(big.fund.lastChar, T0 + 20 * WEEK);
});

test('角色出錢也會讓目標達成', () => {
    const f = addGoal(base(), { name: '小目標', target: 100, now: T0 }).fund;
    const r = applyCharContribution(f, 100, T0 + WEEK);
    assert.deepEqual(r.reached.map(x => x.name), ['小目標']);
});

test('weeklyOf：沒設定用預設 100，設 0 就是不出', () => {
    assert.equal(weeklyOf({}), 100);
    assert.equal(weeklyOf({ fund_weekly: null }), 100);
    assert.equal(weeklyOf({ fund_weekly: 0 }), 0);
    assert.equal(weeklyOf({ fund_weekly: 250 }), 250);
});

test('describeFund：空基金沒有文字；有餘額、目標、最近存款時帶出背景', () => {
    assert.equal(describeFund(base(), '小明'), '');
    assert.equal(describeFund(null, '小明'), '');
    let f = addGoal(base(), { name: '旅行', target: 1000, now: T0 }).fund;
    f = deposit(f, 300, { now: T0 + 1 }).fund;
    const t = describeFund(f, '小明', 100, T0 + 2);
    assert.match(t, /小明/);
    assert.match(t, /餘額 \$300/);
    assert.match(t, /旅行/);
    assert.match(t, /30%/);
    assert.match(t, /用戶最近存了 \$300/);
    assert.match(t, /每週會固定存 \$100/);
    assert.doesNotMatch(describeFund(f, '小明', 0, T0 + 2), /每週會固定存/);
});

test('fundPromptFor：依角色挑出自己的基金', () => {
    const funds = { a: deposit(base(), 50, { now: T0 }).fund };
    assert.match(fundPromptFor(funds, { id: 'a', name: '甲' }), /甲/);
    assert.equal(fundPromptFor(funds, { id: 'b', name: '乙' }), '');
    assert.equal(fundPromptFor(funds, null), '');
});

test('街機收入：星星每顆 $10、每日挑戰 $100 + 連續加成（最多算 7 天）', () => {
    assert.equal(incomeFor({ newStars: 3 }), 30);
    assert.equal(incomeFor({ newStars: 0 }), 0);
    assert.equal(incomeFor({ newStars: -2 }), 0);
    assert.equal(incomeFor({ daily: { first: true, streak: 1 } }), 100);
    assert.equal(incomeFor({ daily: { first: true, streak: 4 } }), 130);
    assert.equal(incomeFor({ daily: { first: true, streak: 30 } }), 160);
    assert.equal(incomeFor({ daily: { first: false, streak: 3 } }), 0);
});

test('街機收入每日上限：同一天累計、換日重算', () => {
    let r = applyCap(null, 200, '2026-01-01');
    assert.equal(r.granted, 200);
    r = applyCap(r.state, 200, '2026-01-01');
    assert.equal(r.granted, DAILY_CAP - 200);
    r = applyCap(r.state, 50, '2026-01-01');
    assert.equal(r.granted, 0);
    r = applyCap(r.state, 50, '2026-01-02');
    assert.equal(r.granted, 50);
});
