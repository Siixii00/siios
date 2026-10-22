import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractJson, extractArray } from '../../js/core/json-extract.js';

test('extractJson：純 JSON、```json 圍欄、前後有說明、有 <think>', () => {
    assert.deepEqual(extractJson('{"a":1}'), { a: 1 });
    assert.deepEqual(extractJson('```json\n[{"n":"x"}]\n```'), [{ n: 'x' }]);
    assert.deepEqual(extractJson('好的，這是結果：\n{"reply":"嗨 {你好}"}\n希望有幫助'), { reply: '嗨 {你好}' });
    assert.deepEqual(extractJson('<think>我想想 [1,2]</think>[{"a":1}]'), [{ a: 1 }]);
    assert.deepEqual(extractJson('[說明] 然後 {"ok":true}'), { ok: true });
});

test('extractJson：沒有 JSON 或壞掉回傳 null', () => {
    assert.equal(extractJson(''), null);
    assert.equal(extractJson(null), null);
    assert.equal(extractJson('沒有任何括號'), null);
    assert.equal(extractJson('{"a":'), null);
});

test('extractArray：陣列、{key:[...]}、任意欄位的第一個陣列、沒有就空陣列', () => {
    assert.deepEqual(extractArray('["a","b"]'), ['a', 'b']);
    assert.deepEqual(extractArray('{"posts":[1,2]}', 'posts'), [1, 2]);
    assert.deepEqual(extractArray('{"貼文":[1]}', 'posts'), [1]);
    assert.deepEqual(extractArray('{"x":1}', 'posts'), []);
    assert.deepEqual(extractArray('純文字'), []);
});
