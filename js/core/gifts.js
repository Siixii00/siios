import { SettingsDB } from '../db.js';

export const GIFTS = [
    { id: 'g1', name: '玫瑰花', icon: '🌹', price: 50 },
    { id: 'g2', name: '巧克力', icon: '🍫', price: 30 },
    { id: 'g3', name: '蛋糕', icon: '🎂', price: 80 },
    { id: 'g4', name: '戒指', icon: '💍', price: 200 },
    { id: 'g5', name: '玩偶', icon: '🧸', price: 100 },
    { id: 'g6', name: '信件', icon: '💌', price: 10 }
];

const INVENTORY_KEY = 'gift_inventory';

// 庫存格式沿用舊版：每件禮物一筆 { id, boughtAt }
let queue = Promise.resolve();
function serial(fn) {
    const run = queue.then(fn);
    queue = run.catch(() => {});
    return run;
}

async function loadRaw() {
    const list = await SettingsDB.get(INVENTORY_KEY);
    return Array.isArray(list) ? list.filter(g => GIFTS.some(x => x.id === g.id)) : [];
}

export async function getInventoryCounts() {
    const counts = {};
    (await loadRaw()).forEach(g => { counts[g.id] = (counts[g.id] || 0) + 1; });
    return counts;
}

export function addGift(id) {
    return serial(async () => {
        const list = await loadRaw();
        list.push({ id, boughtAt: Date.now() });
        await SettingsDB.set(INVENTORY_KEY, list);
    });
}

// 送出一件；沒有庫存時回傳 false
export function consumeGift(id) {
    return serial(async () => {
        const list = await loadRaw();
        const idx = list.findIndex(g => g.id === id);
        if (idx < 0) return false;
        list.splice(idx, 1);
        await SettingsDB.set(INVENTORY_KEY, list);
        return true;
    });
}
