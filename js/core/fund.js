// 共同基金（每個角色各一個「我們的小金庫」）的純邏輯：存取、目標、角色每週出錢、給 AI 的描述。
// 不碰瀏覽器與資料庫，方便測試；資料與錢包的連動在 fund-store.js。
export const WEEK = 86400000 * 7;
export const MAX_GOALS = 5;
export const MAX_CHAR_CATCHUP_WEEKS = 4; // 很久沒開 App 也最多補 4 週，不會一次掉下一大筆
export const DEFAULT_CHAR_WEEKLY = 100;

// 角色每週出多少：沒設定 = 預設，0 = 不出
export const weeklyOf = c => (c?.fund_weekly === 0 || c?.fund_weekly > 0 ? Number(c.fund_weekly) : DEFAULT_CHAR_WEEKLY);

export const emptyFund = (now = Date.now()) => ({ balance: 0, goals: [], ledger: [], createdAt: now, lastChar: now });

const newId = (p, now) => p + now.toString(36) + Math.random().toString(36).slice(2, 5);
const amountOf = v => { const n = Math.round(Number(v)); if (!Number.isFinite(n) || n <= 0) throw new Error('金額必須是大於 0 的數字'); return n; };
const clone = f => ({ ...f, goals: f.goals.map(g => ({ ...g })), ledger: [...f.ledger] });
const addLedger = (f, type, amount, by, note, now) => { f.ledger.push({ id: newId('l', now), type, amount, by, note: String(note || '').slice(0, 40), at: now }); if (f.ledger.length > 300) f.ledger = f.ledger.slice(-300); };

// 目前的目標：還沒達成的第一個
export const activeGoal = f => f.goals.find(g => !g.doneAt) || null;

// 目標的進度：前面已經達成、還沒兌現的目標先佔掉它們的金額，剩下的才算給後面的目標
export function progressOf(f, goalId) {
    let allocated = 0;
    for (const g of f.goals) {
        const have = Math.max(0, Math.min(g.target, f.balance - allocated));
        if (g.id === goalId) return { have, target: g.target, ratio: g.target ? have / g.target : 0 };
        if (g.doneAt && !g.redeemedAt) allocated += g.target;
    }
    return { have: 0, target: 0, ratio: 0 };
}

// 檢查有沒有達成目標，回傳新達成的目標（依序）
function checkGoals(f, now) {
    const reached = [];
    for (;;) {
        const g = activeGoal(f);
        if (!g) break;
        let allocated = 0;
        for (const x of f.goals) { if (x === g) break; if (x.doneAt && !x.redeemedAt) allocated += x.target; }
        if (f.balance - allocated < g.target) break;
        g.doneAt = now;
        reached.push({ goalId: g.id, name: g.name, target: g.target });
    }
    return reached;
}

// 每個操作都回傳 { fund, reached }：不改動傳進來的物件
export function deposit(f, amount, { by = 'user', note = '', now = Date.now() } = {}) {
    const n = amountOf(amount), out = clone(f);
    out.balance += n; addLedger(out, 'deposit', n, by, note, now);
    return { fund: out, reached: checkGoals(out, now) };
}

export function withdraw(f, amount, { note = '', now = Date.now() } = {}) {
    const n = amountOf(amount);
    if (n > f.balance) throw new Error(`共同基金只有 $${f.balance.toLocaleString()}，不夠領 $${n.toLocaleString()}`);
    const out = clone(f);
    out.balance -= n; addLedger(out, 'withdraw', n, 'user', note, now);
    return { fund: out, reached: [] };
}

// 花在共同的事情上（例如約會的場地費）
export function spend(f, amount, { note = '', now = Date.now() } = {}) {
    const n = amountOf(amount);
    if (n > f.balance) throw new Error(`共同基金只有 $${f.balance.toLocaleString()}，不夠付 $${n.toLocaleString()}`);
    const out = clone(f);
    out.balance -= n; addLedger(out, 'spend', n, 'user', note, now);
    return { fund: out, reached: [] };
}

export function addGoal(f, { name, target, now = Date.now() }) {
    const n = String(name || '').trim().slice(0, 20), t = amountOf(target);
    if (!n) throw new Error('請輸入目標的名稱');
    if (f.goals.filter(g => !g.redeemedAt).length >= MAX_GOALS) throw new Error(`最多同時有 ${MAX_GOALS} 個目標`);
    const out = clone(f);
    out.goals.push({ id: newId('g', now), name: n, target: t, createdAt: now });
    return { fund: out, reached: checkGoals(out, now) };
}

export function removeGoal(f, goalId) {
    const out = clone(f);
    out.goals = out.goals.filter(g => g.id !== goalId || (g.doneAt && !g.redeemedAt)); // 達成了還沒兌現的不能直接刪（錢還在裡面）
    return { fund: out, reached: [] };
}

// 兌現已達成的目標：從基金扣掉目標金額（用掉或領回錢包由呼叫端決定）。回傳 { fund, amount, name }
export function redeem(f, goalId, { now = Date.now() } = {}) {
    const g = f.goals.find(x => x.id === goalId);
    if (!g || !g.doneAt || g.redeemedAt) throw new Error('這個目標還沒達成，或已經兌現過了');
    const out = clone(f);
    const og = out.goals.find(x => x.id === goalId);
    og.redeemedAt = now;
    out.balance -= og.target;
    addLedger(out, 'spend', og.target, 'user', `兌現目標「${og.name}」`, now);
    return { fund: out, amount: og.target, name: og.name, reached: checkGoals(out, now) };
}

// 角色每週出錢：每滿一週存一次 weekly 元（最多補 4 週）。沒滿一週不動
export function planCharContribution(f, weekly, now = Date.now()) {
    const w = Math.round(Number(weekly));
    if (!Number.isFinite(w) || w <= 0) return { weeks: 0, amount: 0 };
    const weeks = Math.min(MAX_CHAR_CATCHUP_WEEKS, Math.floor((now - (f.lastChar || f.createdAt || now)) / WEEK));
    return { weeks: Math.max(0, weeks), amount: Math.max(0, weeks) * w };
}

export function applyCharContribution(f, weekly, now = Date.now()) {
    const plan = planCharContribution(f, weekly, now);
    if (!plan.weeks) return { fund: f, reached: [], amount: 0 };
    const r = deposit(f, plan.amount, { by: 'char', note: plan.weeks > 1 ? `每週存入（${plan.weeks} 週）` : '每週存入', now });
    // 補滿 4 週以上就把計時重設到現在（不留下舊帳）；否則只往前推用掉的週數
    r.fund.lastChar = plan.weeks >= MAX_CHAR_CATCHUP_WEEKS ? now : (f.lastChar || f.createdAt) + plan.weeks * WEEK;
    return { ...r, amount: plan.amount };
}

// 給 AI 的背景資訊：餘額、目前的目標、最近的動靜。沒有就是空字串。語氣是背景，不要求特地提起
export function describeFund(f, charName = '角色', weekly = DEFAULT_CHAR_WEEKLY, now = Date.now()) {
    if (!f || (!f.balance && !f.goals.length && !f.ledger.length)) return '';
    const lines = [`餘額 $${f.balance.toLocaleString()}`];
    const g = activeGoal(f);
    if (g) { const p = progressOf(f, g.id); lines.push(`目前的目標「${g.name}」：$${p.have.toLocaleString()} / $${g.target.toLocaleString()}（${Math.round(p.ratio * 100)}%）`); }
    const done = f.goals.filter(x => x.doneAt && !x.redeemedAt && now - x.doneAt <= 14 * 86400000);
    done.forEach(x => lines.push(`你們剛達成了目標「${x.name}」（$${x.target.toLocaleString()}）`));
    const recent = f.ledger.filter(l => now - l.at <= 7 * 86400000 && l.type === 'deposit' && l.by === 'user' && l.amount >= 100).slice(-2);
    recent.forEach(l => lines.push(`用戶最近存了 $${l.amount.toLocaleString()}`));
    if (weekly > 0) lines.push(`你每週會固定存 $${Math.round(weekly).toLocaleString()} 進去`);
    return [`# 你們和${charName}的共同基金（背景資訊，自然帶到就好，不用特地提起）`, ...lines.map(l => '- ' + l)].join('\n');
}

// funds：shared_funds 整包資料；char：角色。給聊天、各個 App 的提示用
export const fundPromptFor = (funds, char) => (char?.id ? describeFund(funds?.[char.id], char.name || '角色', weeklyOf(char)) : '');
