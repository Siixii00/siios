// 你送給角色的禮物：留紀錄、存成角色的記憶、可能排一份之後的回禮。不增加好感度（送禮只是一種互相往來）。
import { SettingsDB } from '../db.js';
import { saveInteractionMemory } from './memory-saver.js';
import { giftImportance, giftMemoryText } from './gift-ideas.js';

const KEY = 'gift_log';

export async function loadGiftLog() { const v = await SettingsDB.get(KEY); return Array.isArray(v) ? v : []; }

// gift：{ id, name, price }。失敗一律靜默（不能影響送禮本身）
export async function recordGiftGiven({ characterId, charName = '角色', gift }) {
    try {
        if (!characterId || !gift) return;
        const list = await loadGiftLog();
        await SettingsDB.set(KEY, [...list, { id: 'g' + Date.now().toString(36), characterId, giftId: gift.id, name: gift.name, price: gift.price || 0, at: Date.now() }].slice(-200));
        const text = giftMemoryText(charName, gift.name, gift.price);
        await saveInteractionMemory({
            characterId, sourceApp: 'gift-shop', sourceType: 'interaction', sourceSubtype: 'gift',
            content: text, metaContent: text.slice(0, 40), importance: giftImportance(gift.price)
        });
        const store = await import('./shopping-store.js');
        await store.scheduleReturnGift({ characterId, giftName: gift.name, price: gift.price || 0 });
    } catch (e) { console.warn('[GiftLog] 記錄送禮失敗：', e?.message || e); }
}
