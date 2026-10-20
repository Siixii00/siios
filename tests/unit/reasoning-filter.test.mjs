import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { stripReasoning } from '../../js/core/reasoning-filter.js';

const ECOT = '<!-- Start the ECoT -->\n<thinking>\n[輸入解構]\n- 使用者要求抱抱\n</thinking>\n<!-- End of The ECoT -->\n\n<!-- 禁詞風險15: 無 -->\n\n*手掌輕輕放在她的頭頂*\n\n好。';

test('完整的 <thinking> 與 HTML 註解區塊都去掉，保留實際回覆', () => {
    assert.equal(stripReasoning(ECOT), '*手掌輕輕放在她的頭頂*\n\n好。');
    assert.equal(stripReasoning('前<think>a</think>中<THINKING>b</THINKING>後'), '前中後');
    assert.equal(stripReasoning('<think>\n多行\n</think>\n你好'), '你好');
    assert.equal(stripReasoning('<思考>分析</思考>你好'), '你好');
});

test('只有結尾標籤：之前全是思考；只有開頭標籤：之後全是思考', () => {
    assert.equal(stripReasoning('先想一下\n</think>\n好喔'), '好喔');
    assert.equal(stripReasoning('你好呀<think>讓我想想'), '你好呀');
    assert.equal(stripReasoning('<think>還在想'), '');
    assert.equal(stripReasoning('正文<!-- 沒收尾的註解'), '正文');
});

test('沒有思考標籤的正常文字原樣保留（小於符號、動作斜體、<3）', () => {
    const t = '*笑* 3 < 5 對不對？ <3 <b>粗體</b>';
    assert.equal(stripReasoning(t), t);
    assert.equal(stripReasoning(null), '');
    assert.equal(stripReasoning(undefined), '');
});

test('串流中：標籤寫到一半先不顯示，收到完整標籤後整段思考不顯示', () => {
    assert.equal(stripReasoning('你好<thi', { streaming: true }), '你好');
    assert.equal(stripReasoning('你好<!-', { streaming: true }), '你好');
    assert.equal(stripReasoning('你好</thin', { streaming: true }), '你好');
    assert.equal(stripReasoning('你好 <', { streaming: true }), '你好');
    assert.equal(stripReasoning('你好<think>想', { streaming: true }), '你好');
    assert.equal(stripReasoning('你好 3 <5', { streaming: true }), '你好 3 <5'); // 不是任何標籤的開頭
    // 非串流時結尾的「<thi」原樣保留（那是模型真的輸出的字）
    assert.equal(stripReasoning('你好<thi'), '你好<thi');
});

test('串流逐字餵入：畫面上的文字不會出現思考內容，最後等於完整處理的結果', () => {
    const shown = [];
    let acc = '';
    for (const ch of ECOT) { acc += ch; shown.push(stripReasoning(acc, { streaming: true })); }
    for (const s of shown) {
        assert.ok(!/thinking|ECoT|輸入解構|禁詞風險/.test(s), '畫面出現思考內容：' + JSON.stringify(s));
        assert.ok(!/<[!/a-z]/i.test(s), '畫面出現標籤殘影：' + JSON.stringify(s));
    }
    assert.equal(shown.at(-1), stripReasoning(ECOT));
});

test('與 Discord Worker 的 stripReasoning 規則一致（兩邊要一起維護）', () => {
    const src = readFileSync(new URL('../../scripts/discord-bot-worker.js', import.meta.url), 'utf8');
    const W = vm.runInNewContext(src.slice(src.indexOf('// <<format-helpers'), src.indexOf('// format-helpers>>')) + '\n({ stripReasoning })');
    const samples = [ECOT, '前<think>a</think>後', '先想\n</think>\n好', '你好<think>想', '正文<!-- 沒收尾', '*笑* 3 < 5 <3', '', '<思考>x</思考>y', '<thinking>全是思考</thinking>'];
    for (const s of samples) assert.equal(W.stripReasoning(s), stripReasoning(s), JSON.stringify(s));
});
