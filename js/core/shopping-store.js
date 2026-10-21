// 購物 App 的資料與流程（需要瀏覽器）：偏好、願望清單、紀錄、主動提議，以及呼叫 AI 挑禮物。
// 純函式（提示詞、解析、日期判斷）在 gift-ideas.js 與 real-shops.js。
import { SettingsDB, CharactersDB, ChatsDB } from '../db.js';
import APIClient from '../api.js';
import { buildAppContext } from './app-context-builder.js';
import { saveInteractionMemory } from './memory-saver.js';
import { loadBirthdate, getBirthdate } from './age-gate.js';
import { loadEvents } from './calendar.js';
import { loadDislikes } from './dislikes.js';
import { resolvePrefs, shopLinks } from './real-shops.js';
import { buildIdeaMessages, parseIdeas, filterIdeas, planProposals, pruneProposals, OCCASIONS, formatPriceRange } from './gift-ideas.js';

const K = { prefs: 'shop_prefs', wishlist: 'shop_wishlist', records: 'shop_records', proposals: 'gift_proposals', char: 'shop_selected_char' };
export const DEFAULT_BUDGET = { min: 100, max: 1500 };

let queue = Promise.resolve();
const serial = fn => { const run = queue.then(fn); queue = run.catch(() => {}); return run; };
const newId = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

// ───── 偏好 ─────
export async function loadPrefs() {
    const v = (await SettingsDB.get(K.prefs)) || {};
    const shops = resolvePrefs(v.shops ? v.shops : null);
    const b = v.budget || {};
    const min = Math.max(0, Math.round(Number(b.min)) || DEFAULT_BUDGET.min), max = Math.max(min, Math.round(Number(b.max)) || DEFAULT_BUDGET.max);
    return { shops, budget: { min, max }, proactive: v.proactive && typeof v.proactive === 'object' ? v.proactive : {} };
}
export const savePrefs = prefs => SettingsDB.set(K.prefs, prefs);
export const loadSelectedChar = () => SettingsDB.get(K.char);
export const saveSelectedChar = id => SettingsDB.set(K.char, id);

// ───── 願望清單 ─────
export async function loadWishlist() { const v = await SettingsDB.get(K.wishlist); return Array.isArray(v) ? v : []; }
export function addWish({ name, note = '', url = '', price = null }) {
    return serial(async () => {
        const n = String(name || '').trim().slice(0, 40);
        if (!n) throw new Error('請輸入想要的東西');
        let link = String(url || '').trim();
        if (link && !/^https:\/\//i.test(link)) link = ''; // 只收 https 連結
        const list = await loadWishlist();
        const item = { id: newId('w'), name: n, note: String(note || '').trim().slice(0, 100), url: link.slice(0, 500), price: Number(price) > 0 ? Math.round(Number(price)) : null, addedAt: Date.now() };
        await SettingsDB.set(K.wishlist, [item, ...list].slice(0, 100));
        return item;
    });
}
export function removeWish(id) { return serial(async () => { await SettingsDB.set(K.wishlist, (await loadWishlist()).filter(w => w.id !== id)); }); }

// ───── 紀錄 ─────
export async function loadRecords() { const v = await SettingsDB.get(K.records); return Array.isArray(v) ? v : []; }

// status：accepted（收下）／bought（真的買了）／declined（不用了）
export function addRecord({ characterId, name, status, reason = '', occasion = 'request', priceMin = null, priceMax = null, kind = 'daily', source = 'idea' }) {
    return serial(async () => {
        const list = await loadRecords();
        const r = { id: newId('r'), characterId, name, status, reason: String(reason || '').slice(0, 60), occasion, priceMin, priceMax, kind, source, at: Date.now() };
        await SettingsDB.set(K.records, [...list, r].slice(-300));
        return r;
    });
}

// 把使用者的決定存成角色的記憶（之後聊天、約會、Discord 都會用到）
export async function saveDecisionMemory(record, charName) {
    const price = record.priceMin !== null && record.priceMax !== null ? `（${formatPriceRange(record)}）` : '';
    const text = {
        bought: `${charName}挑了「${record.name}」${price}當禮物，用戶收下了，而且真的去買了。`,
        accepted: `${charName}挑了「${record.name}」${price}當禮物，用戶收下了。`,
        declined: `${charName}挑了「${record.name}」${price}，用戶這次不需要${record.reason ? '：' + record.reason : ''}。`
    }[record.status];
    if (!text) return null;
    return saveInteractionMemory({
        characterId: record.characterId, sourceApp: 'taobao', sourceType: 'interaction', sourceSubtype: 'gift',
        content: text, metaContent: text.slice(0, 40), importance: record.status === 'bought' ? 0.7 : record.status === 'accepted' ? 0.55 : 0.35
    });
}

// ───── 主動提議 ─────
export async function loadProposals() { const v = await SettingsDB.get(K.proposals); return Array.isArray(v) ? v : []; }
export const saveProposals = list => SettingsDB.set(K.proposals, list);
export function updateProposal(id, patch) {
    return serial(async () => { const list = (await loadProposals()).map(p => (p.id === id ? { ...p, ...patch } : p)); await saveProposals(list); return list.find(p => p.id === id); });
}

// 檢查有沒有新的重要日子，建立待處理的提議卡片（只建立卡片，不呼叫 AI；使用者點開才生成）。回傳目前未處理的數量
export function refreshProposals(now = new Date()) {
    return serial(async () => {
        const prefs = await loadPrefs();
        await loadBirthdate();
        const chars = await CharactersDB.getAll();
        const chats = await ChatsDB.getAll();
        const since = id => chats.filter(c => !c.is_group && (c.character_id === id || (c.member_ids || []).includes(id))).reduce((m, c) => (c.created_at && (!m || c.created_at < m) ? c.created_at : m), 0) || null;
        const existing = pruneProposals(await loadProposals(), now.getTime());
        const fresh = planProposals({
            now, userBirthday: getBirthdate(), events: await loadEvents(), existing,
            characters: chars.map(c => ({ id: c.id, frequency: prefs.proactive[c.id] || c.gift_proactive || 'normal', anniversaryDate: c.anniversary_date || null, chatSince: since(c.id) }))
        });
        const all = [...existing, ...fresh];
        if (fresh.length || all.length !== existing.length) await saveProposals(all);
        return all.filter(p => ['pending', 'ready'].includes(p.status)).length;
    });
}

// ───── 讓角色挑禮物 ─────
export class NoApiError extends Error { constructor() { super('還沒設定 AI：到「設定 → API 設定」填好之後，角色才能幫你挑'); this.code = 'no_api'; } }

export async function generateIdeas({ characterId, occasion = 'request', label = '', budget = DEFAULT_BUDGET, kinds = [], extra = '' }) {
    const settings = await APIClient.getSettings();
    if (!settings.api_url || !settings.api_key) throw new NoApiError();
    const [char, wishlist, records, dislikes] = [await CharactersDB.getById(characterId), await loadWishlist(), await loadRecords(), await loadDislikes()];
    if (!char) throw new Error('找不到角色');
    const ctx = await buildAppContext({ characterId, userMessage: label || OCCASIONS[occasion]?.label || '禮物' });
    const past = records.filter(r => r.characterId === characterId).slice(-30).map(r => r.name);
    const messages = buildIdeaMessages({ systemPrompt: ctx.systemPrompt, charName: char.name, userName: ctx.user?.name || '你', occasion, label, budget, kinds, wishlist, past, extra });
    for (let attempt = 0; attempt < 2; attempt++) {
        const text = await APIClient.complete(messages, { temperature: 0.9, maxTokens: 1100 });
        const ideas = filterIdeas(parseIdeas(text, { limit: 3 }), { budget, dislikes, past });
        if (ideas.length) return ideas;
    }
    throw new Error('這次沒有挑到合適的，再試一次看看');
}

export { shopLinks };
