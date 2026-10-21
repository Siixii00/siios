import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MEMORY_SOURCE_IDS, SPEND_CATEGORY_TO_SOURCE } from '../../js/core/memory-sources.js';

test('消費分類對應的記憶來源都存在於來源清單', () => {
    for (const [cat, src] of Object.entries(SPEND_CATEGORY_TO_SOURCE)) assert.ok(MEMORY_SOURCE_IDS.includes(src), `${cat} → ${src}`);
});

test('錢包扣款的各個 category 要嘛有對應的記憶來源，要嘛該 App 自己會記憶', () => {
    // 這些 category 的 App 自己有 saveInteractionMemory（農場、宅家、酒館、投資）或是聊天室轉帳（走聊天記憶）
    const selfRemembering = new Set(['farm', 'home', 'pub', 'invest', 'transfer', 'adjust']);
    const used = new Set();
    const files = ['arcade/index.js', 'chats/chat.js', 'chats/shop.js', 'delivery/index.js', 'emoji-shop/index.js', 'farm/index.js', 'gift-shop/index.js', 'home/index.js', 'instagram/index.js', 'invest/index.js', 'pub/index.js', 'taobao/index.js', 'theme-shop/index.js'];
    for (const f of files) {
        const text = readFileSync(new URL('../../js/apps/' + f, import.meta.url), 'utf8');
        for (const m of text.matchAll(/charge\([^;]*category:\s*'([a-z]+)'/g)) used.add(m[1]);
    }
    const unhandled = [...used].filter(c => !(c in SPEND_CATEGORY_TO_SOURCE) && !selfRemembering.has(c));
    assert.deepEqual(unhandled, [], '有消費分類既沒有對應的記憶來源，也沒有自己記憶：' + unhandled.join(', '));
});
