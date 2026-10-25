import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contentOf, reasoningOf, sseData, parseWholeResponse, describeEmpty } from '../../js/core/api-response.js';

test('sseData：「data: x」與「data:x」（沒有空格）都讀得到，其他行回傳 null', () => {
    assert.equal(sseData('data: {"a":1}'), '{"a":1}');
    assert.equal(sseData('data:{"a":1}'), '{"a":1}');
    assert.equal(sseData('data: [DONE]'), '[DONE]');
    assert.equal(sseData(': keep-alive'), null);
    assert.equal(sseData('event: message'), null);
    assert.equal(sseData(''), null);
});

test('contentOf：字串、陣列、舊式 text、串流 delta 都取得到；沒有就是空字串', () => {
    assert.equal(contentOf({ message: { content: '你好' } }), '你好');
    assert.equal(contentOf({ delta: { content: '嗨' } }), '嗨');
    assert.equal(contentOf({ message: { content: [{ type: 'text', text: '甲' }, { type: 'text', text: '乙' }] } }), '甲乙');
    assert.equal(contentOf({ text: '舊式' }), '舊式');
    assert.equal(contentOf({ message: { content: '' } }), '');
    assert.equal(contentOf({ delta: {} }), '');
    assert.equal(contentOf(null), '');
    assert.equal(contentOf(undefined), '');
});

test('reasoningOf：reasoning_content／reasoning', () => {
    assert.equal(reasoningOf({ delta: { reasoning_content: '想' } }), '想');
    assert.equal(reasoningOf({ message: { reasoning: '思' } }), '思');
    assert.equal(reasoningOf({ message: { content: 'x' } }), '');
});

test('parseWholeResponse：服務不支援串流、回整包 JSON 時也能取出內容', () => {
    const r = parseWholeResponse(JSON.stringify({ choices: [{ message: { content: '整包' }, finish_reason: 'stop' }] }));
    assert.deepEqual({ c: r.content, f: r.finishReason }, { c: '整包', f: 'stop' });
    assert.equal(parseWholeResponse('data: {"x":1}\n\n'), null); // 不是 JSON（是串流文字）
    assert.equal(parseWholeResponse('{"error":"x"}'), null);
    const t = parseWholeResponse(JSON.stringify({ choices: [{ message: { content: '', reasoning_content: '想', tool_calls: [{ id: 1 }] }, finish_reason: 'length' }] }));
    assert.equal(t.reasoning, '想');
    assert.equal(t.toolCalls.length, 1);
});

test('describeEmpty：依原因給出看得懂的說明', () => {
    assert.match(describeEmpty({ reasoning: '想', finishReason: 'length' }), /只回傳了「思考內容」.*回覆長度/);
    assert.match(describeEmpty({ finishReason: 'content_filter' }), /內容過濾/);
    assert.match(describeEmpty({ finishReason: 'length' }), /長度上限太小/);
    const m = describeEmpty({ raw: '{"error":{"message":"model not found"}}', finishReason: 'stop' });
    assert.ok(m.includes('model not found') && m.includes('finish_reason：stop') && m.includes('模型名稱'));
    assert.match(describeEmpty({}), /沒有回傳任何資料/);
});

test('parseSseText：把 SSE 文字接成完整內容（服務忽略了「不要串流」）', async () => {
    const { parseSseText } = await import('../../js/core/api-response.js');
    const text = 'data:{"choices":[{"delta":{"content":"你"}}]}\n\ndata: {"choices":[{"delta":{"content":"好"}}]}\r\n\ndata: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n';
    assert.deepEqual(parseSseText(text), { content: '你好', reasoning: '', finishReason: 'stop' });
    assert.deepEqual(parseSseText('not sse'), { content: '', reasoning: '', finishReason: '' });
});
