import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { getResponseMode, withResponseReminder, buildResponseModePrompt, DEFAULT_RESPONSE_MODE, RESPONSE_MODES } from '../../js/constants/rp-system-prompt.js';

// Discord Worker 是單一檔案（要手動貼到 Cloudflare），不能 import；這裡把「純函式區塊」單獨取出來測
const workerSource = readFileSync(new URL('../../scripts/discord-bot-worker.js', import.meta.url), 'utf8');
const start = workerSource.indexOf('// <<format-helpers');
const end = workerSource.indexOf('// format-helpers>>');
assert.ok(start > 0 && end > start, '找不到 format-helpers 區塊');
const D = vm.runInNewContext(workerSource.slice(start, end) + '\n({ splitForDiscord, normalizeResponseMode, getResponseModeConfig, appendResponseReminder, RESPONSE_MODES, DEFAULT_RESPONSE_MODE })');
// vm 裡建立的陣列屬於另一個 realm，deepEqual 會因原型不同而失敗；轉成本地陣列再比較
const split = (...args) => Array.from(D.splitForDiscord(...args));

// ───── PWA 聊天室 ─────
test('PWA：沒選過回應模式時，和介面顯示的預設（多句對話）一致', () => {
    assert.equal(DEFAULT_RESPONSE_MODE, 'dialogue_multi');
    assert.equal(getResponseMode(undefined).id, 'dialogue_multi');
    assert.equal(getResponseMode('不存在的模式').id, 'dialogue_multi');
    assert.match(buildResponseModePrompt(undefined), /多句回應/);
});

test('PWA：每個模式都有提示詞、結尾提醒與（單句／多句的）輸出上限', () => {
    for (const id of Object.keys(RESPONSE_MODES)) {
        const m = getResponseMode(id);
        assert.ok(m.prompt.includes('本次回覆使用'), id);
        assert.ok(m.reminder.startsWith('【回應格式：'), id);
    }
    assert.equal(getResponseMode('dialogue_single').maxTokens, 400);
    assert.equal(getResponseMode('dialogue_multi').maxTokens, 1200);
    assert.equal(getResponseMode('full').maxTokens, null); // 完整模式不另外限制長度
    assert.match(getResponseMode('full').prompt, /不少於 400 字/);
});

test('PWA：格式提醒接在使用者訊息「最後面」，並說明以這一輪的格式為準', () => {
    const out = withResponseReminder('你好嗎', 'dialogue_single');
    assert.ok(out.startsWith('你好嗎\n\n【回應格式：單句回應】'));
    assert.ok(out.endsWith('即使前面的回覆用了不同的格式或長度。）'));
    // 切換模式後，提醒的內容跟著換
    assert.match(withResponseReminder('你好嗎', 'full'), /完整模式.*不少於 400 字/);
    assert.notEqual(withResponseReminder('x', 'full'), withResponseReminder('x', 'dialogue_single'));
});

test('PWA：自訂模式帶入使用者的文字；內容是空的就不附提醒', () => {
    assert.match(withResponseReminder('嗨', 'custom', '用詩意的語氣，每段結尾加一句感想'), /【回應格式：自訂】用詩意的語氣/);
    assert.equal(withResponseReminder('嗨', 'custom', '   '), '嗨');
    assert.match(getResponseMode('custom', 'abc').prompt, /自訂方式回應：\nabc/);
});

// ───── Discord 機器人 ─────
test('Discord：回應模式的提示詞與提醒和 PWA 完全一致（兩邊要同步維護）', () => {
    for (const id of ['full', 'dialogue_single', 'dialogue_multi']) {
        const pwa = getResponseMode(id), dc = D.getResponseModeConfig(id);
        assert.equal(dc.prompt, pwa.prompt, id + ' prompt');
        assert.equal(dc.reminder, pwa.reminder, id + ' reminder');
        if (pwa.maxTokens) assert.equal(dc.maxTokens, pwa.maxTokens, id + ' maxTokens');
    }
    assert.equal(D.DEFAULT_RESPONSE_MODE, DEFAULT_RESPONSE_MODE);
    assert.equal(D.getResponseModeConfig(null).id, 'dialogue_multi');
});

test('Discord：模式名稱接受英文代碼與中文別名，無效回傳 null', () => {
    assert.equal(D.normalizeResponseMode('FULL'), 'full');
    assert.equal(D.normalizeResponseMode('單句'), 'dialogue_single');
    assert.equal(D.normalizeResponseMode('多句回應'), 'dialogue_multi');
    assert.equal(D.normalizeResponseMode('自訂'), 'custom');
    assert.equal(D.normalizeResponseMode('asdf'), null);
    assert.equal(D.normalizeResponseMode(''), null);
});

test('Discord：提醒附在最後一則訊息結尾，切換模式就換內容', () => {
    const single = D.appendResponseReminder('你好', D.getResponseModeConfig('dialogue_single'));
    const full = D.appendResponseReminder('你好', D.getResponseModeConfig('full'));
    assert.match(single, /單句回應/);
    assert.match(full, /不少於 400 字/);
    assert.equal(D.appendResponseReminder('嗨', D.getResponseModeConfig('custom', '')), '嗨');
});

test('Discord：不超過 2000 字的訊息原樣送出；空訊息改送占位字', () => {
    assert.deepEqual(split('短短的訊息'), ['短短的訊息']);
    assert.deepEqual(split('   \n  '), ['……']);
    assert.deepEqual(split(null), ['……']);
    assert.equal(split('a'.repeat(2000)).length, 1);
});

test('Discord：超過 2000 字會切段，每段都 ≤ 2000，且不遺失內容', () => {
    const text = Array.from({ length: 400 }, (_, i) => `這是第 ${i} 句話，內容有點長。`).join('');
    const parts = split(text);
    assert.ok(parts.length >= 2);
    parts.forEach(p => assert.ok(p.length <= 2000 && p.length > 0));
    assert.equal(parts.join('').replace(/\s+/g, ''), text.replace(/\s+/g, '')); // 只會在邊界去掉空白
});

test('Discord：優先在段落、換行、句尾切開，不會把句子攔腰切斷', () => {
    const para = '甲'.repeat(1200);
    const byPara = split(para + '\n\n' + para);
    assert.deepEqual(byPara, [para, para]);
    const sentence = '這是一個完整的句子。'.repeat(150); // 1500 字
    const bySentence = split(sentence + sentence);
    assert.ok(bySentence.length >= 2);
    bySentence.forEach(p => assert.ok(p.endsWith('。')));
    // 完全沒有標點與空白也能切（硬切），並且不會無限迴圈
    const noBreak = split('字'.repeat(5000));
    assert.deepEqual(noBreak.map(p => p.length), [2000, 2000, 1000]);
});
