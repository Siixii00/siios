// 共同基金的資料與錢包連動（需要瀏覽器）。純邏輯在 fund.js。
import { SettingsDB, CharactersDB } from '../db.js';
import { charge, credit } from './wallet.js';
import { saveInteractionMemory } from './memory-saver.js';
import { emptyFund, deposit, withdraw, spend, addGoal, removeGoal, redeem, applyCharContribution, weeklyOf } from './fund.js';
export { weeklyOf };

const KEY = 'shared_funds';
let queue = Promise.resolve();
const serial = fn => { const run = queue.then(fn); queue = run.catch(() => {}); return run; };

export async function loadFunds() { const v = await SettingsDB.get(KEY); return v && typeof v === 'object' ? v : {}; }
export async function getFund(characterId) { return (await loadFunds())[characterId] || null; }

// 達成目標：存成角色的記憶（之後聊天、約會、Discord 都會用到）
async function rememberGoals(characterId, reached) {
    if (!reached?.length) return;
    const c = await CharactersDB.getById(characterId).catch(() => null);
    for (const r of reached) {
        const text = `${c?.name || '角色'}和用戶的共同基金達成了目標「${r.name}」（$${r.target.toLocaleString()}）。`;
        await saveInteractionMemory({ characterId, sourceApp: 'fund', sourceType: 'interaction', sourceSubtype: 'goal', content: text, metaContent: text.slice(0, 40), importance: 0.75 }).catch(() => {});
    }
}

// fn(fund) → { fund, reached, ... }；沒有基金就先建一個
function mutate(characterId, fn) {
    return serial(async () => {
        const all = await loadFunds();
        const before = all[characterId] || emptyFund();
        const r = fn(before);
        all[characterId] = r.fund;
        await SettingsDB.set(KEY, all);
        await rememberGoals(characterId, r.reached);
        return r;
    });
}

// 從個人錢包存進去：先扣錢包，失敗（餘額不足）就整個不做
export async function depositFromWallet(characterId, amount, note = '') {
    await charge(amount, '共同基金存入', { category: 'fund', ref: characterId });
    try { return await mutate(characterId, f => deposit(f, amount, { by: 'user', note })); }
    catch (e) { await credit(amount, '共同基金存入失敗退款', { category: 'fund' }).catch(() => {}); throw e; }
}

export async function withdrawToWallet(characterId, amount) {
    const r = await mutate(characterId, f => withdraw(f, amount));
    await credit(amount, '共同基金領出', { category: 'fund', ref: characterId });
    return r;
}

export const spendFromFund = (characterId, amount, note) => mutate(characterId, f => spend(f, amount, { note }));
export const addFundGoal = (characterId, name, target) => mutate(characterId, f => addGoal(f, { name, target }));
export const removeFundGoal = (characterId, goalId) => mutate(characterId, f => removeGoal(f, goalId));

// 兌現達成的目標：toWallet 為 true 領回個人錢包，否則視為用掉（一起花掉了）
export async function redeemGoal(characterId, goalId, { toWallet = false } = {}) {
    const r = await mutate(characterId, f => redeem(f, goalId));
    if (toWallet) await credit(r.amount, `領回共同基金：${r.name}`, { category: 'fund', ref: characterId });
    return r;
}

// 角色每週出錢（App 開啟時補上）。只有已經建立過基金的角色才會存。回傳新增的筆數
export async function tickCharContributions(now = Date.now()) {
    const funds = await loadFunds();
    const ids = Object.keys(funds);
    if (!ids.length) return 0;
    const chars = await CharactersDB.getAll();
    let count = 0;
    for (const id of ids) {
        const c = chars.find(x => x.id === id);
        if (!c) continue;
        const r = await mutate(id, f => applyCharContribution(f, weeklyOf(c), now));
        if (r.amount > 0) count++;
    }
    return count;
}
