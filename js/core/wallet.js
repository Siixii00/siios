import { SettingsDB } from '../db.js';

// 沿用支付 app 既有的鍵，舊資料不需遷移
const BALANCE_KEY = 'kakaopay_balance';
const TX_KEY = 'kakaopay_transactions';
export const DEFAULT_BALANCE = 10000;
const MAX_TRANSACTIONS = 500;

export class WalletError extends Error {
    constructor(message, code, balance) {
        super(message);
        this.code = code;
        this.balance = balance;
    }
}

// 所有變動排成單一佇列，避免快速連點時讀到舊餘額而重複扣款
let queue = Promise.resolve();
function serial(fn) {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
}

export const formatMoney = n => '$' + Number(n).toLocaleString();

export async function getBalance() {
    const v = await SettingsDB.get(BALANCE_KEY);
    return typeof v === 'number' && Number.isFinite(v) ? v : DEFAULT_BALANCE;
}

export async function getTransactions(limit = MAX_TRANSACTIONS) {
    const list = await SettingsDB.get(TX_KEY);
    return Array.isArray(list) ? list.slice(-limit).reverse() : [];
}

function validateAmount(amount) {
    const n = Math.round(Number(amount));
    if (!Number.isFinite(n) || n <= 0) throw new WalletError('金額必須是大於 0 的數字', 'invalid_amount');
    return n;
}

function apply(delta, desc, meta) {
    return serial(async () => {
        const balance = await getBalance();
        if (balance + delta < 0) {
            throw new WalletError('餘額不足（需要 ' + formatMoney(-delta) + '，目前 ' + formatMoney(balance) + '）', 'insufficient', balance);
        }
        const next = balance + delta;
        const list = (await SettingsDB.get(TX_KEY)) || [];
        list.push({ type: delta < 0 ? 'send' : 'receive', amount: Math.abs(delta), desc, date: Date.now(), ...meta });
        await SettingsDB.set(BALANCE_KEY, next);
        await SettingsDB.set(TX_KEY, list.slice(-MAX_TRANSACTIONS));
        return { balance: next };
    });
}

// meta：{ category, ref } 之類的附註，會一併記在交易紀錄
export function charge(amount, desc, meta = {}) {
    return apply(-validateAmount(amount), desc, meta);
}

export function credit(amount, desc, meta = {}) {
    return apply(validateAmount(amount), desc, meta);
}
