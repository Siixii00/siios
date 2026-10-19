import { SettingsDB } from '../db.js';

const MAX_ORDERS = 100;

export async function loadOrders(key) {
    const list = await SettingsDB.get(key);
    return Array.isArray(list) ? list : [];
}

export async function addOrder(key, order) {
    const list = await loadOrders(key);
    list.unshift(order);
    await SettingsDB.set(key, list.slice(0, MAX_ORDERS));
}

// stages: [{ afterMs, label }]（由小到大），依下單後經過的時間推算目前狀態，不需要背景計時器
export function statusAt(order, stages, now = Date.now()) {
    const elapsed = now - order.date;
    let current = stages[0].label;
    for (const s of stages) if (elapsed >= s.afterMs) current = s.label;
    return current;
}

export function newOrderId() {
    return 'od_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
}
