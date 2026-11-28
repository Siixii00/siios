import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickTransition } from '../../js/core/motion.js';

const base = { prevKind: 'home', prevHash: '#/home', hash: '#/chats', lastNonHome: 'app', fromIcon: false };

test('動態效果：鎖定畫面不做轉場', () => {
    assert.equal(pickTransition({ ...base, kind: 'lock' }), 'none');
});

test('動態效果：從圖示開啟 App 是放大；不是從圖示就依層級滑動', () => {
    assert.equal(pickTransition({ ...base, kind: 'app', fromIcon: true }), 'zoom');
    assert.equal(pickTransition({ ...base, kind: 'app', prevKind: 'app', prevHash: '#/chats', hash: '#/chat/abc' }), 'slide-forward');
    assert.equal(pickTransition({ ...base, kind: 'app', prevKind: 'app', prevHash: '#/chat/abc', hash: '#/chats' }), 'slide-back');
});

test('動態效果：同一頁重新渲染（搜尋後重畫）不再動一次', () => {
    assert.equal(pickTransition({ ...base, kind: 'app', prevKind: 'app', prevHash: '#/memory', hash: '#/memory' }), 'none');
});

test('動態效果：主畫面——解鎖後是圖示依序進場，從 App 返回是縮回', () => {
    assert.equal(pickTransition({ ...base, kind: 'home', lastNonHome: 'lock' }), 'home-unlock');
    assert.equal(pickTransition({ ...base, kind: 'home', lastNonHome: 'app' }), 'home-return');
});
