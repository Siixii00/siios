// 支付 App 裡的「共同基金」區塊：每個角色各一個小金庫（存取、目標、角色每週出錢）
import { createElement, createToast } from '../../components.js';
import { CharactersDB, SettingsDB } from '../../db.js';
import { formatMoney, getBalance, WalletError } from '../../core/wallet.js';
import { askForm, askConfirm } from '../../core/dialogs.js';
import { loadFunds, weeklyOf, depositFromWallet, withdrawToWallet, addFundGoal, removeFundGoal, redeemGoal } from '../../core/fund-store.js';
import { emptyFund, activeGoal, progressOf } from '../../core/fund.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SEL_KEY = 'fund_selected_char';

export async function renderFundSection(onWalletChange) {
    const box = createElement('div', 'fund-box');
    const chars = (await CharactersDB.getAll()).filter(c => c.id);
    if (!chars.length) { box.innerHTML = '<h3>共同基金</h3><div class="empty-tx">還沒有角色。建立角色後，就能和他有一個共同基金。</div>'; return box; }
    let sel = await SettingsDB.get(SEL_KEY);
    if (!chars.find(c => c.id === sel)) sel = chars[0].id;

    async function draw() {
        const char = chars.find(c => c.id === sel);
        const fund = (await loadFunds())[sel] || emptyFund();
        const weekly = weeklyOf(char);
        const goal = activeGoal(fund);
        const goalsHtml = fund.goals.filter(g => !g.redeemedAt).map(g => {
            const p = progressOf(fund, g.id), done = !!g.doneAt;
            return `<div class="fund-goal"><div class="fund-goal-head"><strong>${esc(g.name)}</strong><span>${formatMoney(p.have)} / ${formatMoney(g.target)}</span></div>
                <div class="fund-bar"><i style="width:${Math.round(Math.min(1, p.ratio) * 100)}%"></i></div>
                <div class="fund-goal-actions">${done ? `<span class="fund-done">🎉 達成了</span><button data-act="spend" data-id="${g.id}">一起花掉</button><button data-act="back" data-id="${g.id}">領回錢包</button>` : `<button data-act="del" data-id="${g.id}">刪除</button>`}</div></div>`;
        }).join('');
        const ledger = fund.ledger.slice(-6).reverse().map(l => `<div class="tx-item ${l.type === 'deposit' ? 'receive' : 'send'}"><span class="tx-desc">${l.by === 'char' ? esc(char.name) + ' ' : ''}${l.type === 'deposit' ? '存入' : l.type === 'withdraw' ? '領出' : '花費'}${l.note ? '（' + esc(l.note) + '）' : ''}<small> ${new Date(l.at).toLocaleDateString('zh-TW')}</small></span><span class="tx-amount">${l.type === 'deposit' ? '+' : '-'}${formatMoney(l.amount)}</span></div>`).join('');
        box.innerHTML = `<h3>共同基金</h3>
            <select class="fund-char ios-input">${chars.map(c => `<option value="${c.id}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
            <div class="balance-card fund-balance"><span class="balance-label">和 ${esc(char.name)} 的小金庫</span><span class="balance-amount">${formatMoney(fund.balance)}</span>
                <small class="fund-note">${weekly > 0 ? `${esc(char.name)} 每週會存 ${formatMoney(weekly)}（可到角色設定調整）` : `${esc(char.name)} 不會自己存錢（角色設定可開啟）`}</small></div>
            <div class="action-buttons"><button class="action-btn fund-dep">存入</button><button class="action-btn fund-wd">領出</button><button class="action-btn fund-goal-add">新目標</button></div>
            ${goal || fund.goals.some(g => !g.redeemedAt) ? `<div class="fund-goals">${goalsHtml}</div>` : '<div class="empty-tx">還沒有目標。例如「一起去旅行」。</div>'}
            ${ledger ? `<div class="fund-ledger">${ledger}</div>` : ''}`;
        box.querySelector('.fund-char').onchange = async e => { sel = e.target.value; await SettingsDB.set(SEL_KEY, sel).catch(() => {}); draw(); };
        const guard = async fn => {
            try { await fn(); await draw(); await onWalletChange?.(); }
            catch (e) { createToast(e instanceof WalletError || e instanceof Error ? e.message : '操作失敗', 'error'); }
        };
        box.querySelector('.fund-dep').onclick = async () => {
            const f = await askForm({ title: '存入共同基金', hint: `錢包餘額 ${formatMoney(await getBalance())}`, fields: [{ key: 'amount', label: '金額', type: 'number', required: true }], submitLabel: '存入' });
            if (f) guard(async () => { const r = await depositFromWallet(sel, f.amount); createToast(r.reached.length ? `🎉 達成目標「${r.reached[0].name}」` : `已存入 ${formatMoney(f.amount)}`); });
        };
        box.querySelector('.fund-wd').onclick = async () => {
            const f = await askForm({ title: '領出到錢包', hint: `基金餘額 ${formatMoney(fund.balance)}`, fields: [{ key: 'amount', label: '金額', type: 'number', required: true }], submitLabel: '領出' });
            if (f) guard(async () => { await withdrawToWallet(sel, f.amount); createToast(`已領出 ${formatMoney(f.amount)}`); });
        };
        box.querySelector('.fund-goal-add').onclick = async () => {
            const f = await askForm({ title: '新的共同目標', fields: [{ key: 'name', label: '目標名稱', required: true, placeholder: '例如 一起去旅行' }, { key: 'target', label: '目標金額', type: 'number', required: true }], submitLabel: '建立' });
            if (f) guard(async () => { const r = await addFundGoal(sel, f.name, f.target); if (r.reached.length) createToast(`🎉 已經夠了！目標「${r.reached[0].name}」達成`); });
        };
        box.querySelectorAll('.fund-goal-actions button').forEach(b => {
            b.onclick = () => {
                const { act, id } = b.dataset;
                if (act === 'del') return guard(() => removeFundGoal(sel, id));
                guard(async () => {
                    if (act === 'back' || await askConfirm('這筆錢會從基金扣掉，當作你們一起花掉了。', { title: '一起花掉？' })) await redeemGoal(sel, id, { toWallet: act === 'back' });
                });
            };
        });
    }
    await draw();
    return box;
}
