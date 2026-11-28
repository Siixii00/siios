import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildScriptMessages, parseScript, frameDoc } from '../../js/apps/theater/script.js';
import { escapeHtml } from '../../js/utils/html.js';

test('parseScript：取出標題、簡介，與 <ice> 裡的 HTML（不含外層標籤）', () => {
    const out = parseScript('標題：雨夜咖啡\n簡介：只有兩個人的店\n<ice>\n<style>.a{color:red}</style>\n<div class="a" onclick="x()">嗨</div>\n</ice>\n以上是劇場');
    assert.equal(out.title, '雨夜咖啡');
    assert.equal(out.desc, '只有兩個人的店');
    assert.ok(out.html.startsWith('<style>'));
    assert.ok(out.html.includes('onclick="x()"'));
    assert.ok(!out.html.includes('ice>'));
    assert.ok(!out.html.includes('以上是劇場'));
});

test('parseScript：沒有 <ice> 時從第一個 HTML 標籤開始取；程式碼框與粗體標記都會處理', () => {
    const out = parseScript('**標題：** 小遊戲\n簡介：點一點\n```html\n<div id="g"><script>document.title=1</script></div>\n```');
    assert.equal(out.title, '小遊戲');
    assert.equal(out.desc, '點一點');
    assert.ok(out.html.startsWith('<div id="g">'));
    assert.ok(!out.html.includes('```'));
});

test('parseScript：輸出被截斷（沒有 </ice>）仍保留已寫出的 HTML', () => {
    const out = parseScript('標題：長篇\n<ice><div class="x">寫到一半');
    assert.equal(out.html, '<div class="x">寫到一半');
});

test('parseScript：純文字回覆會跳脫後顯示，不會留白也不會執行', () => {
    const out = parseScript('標題：選項\n簡介：三選一\n1. 說 <b>你好</b>\n2. 離開');
    assert.equal(out.title, '選項');
    assert.ok(out.html.includes('1. 說 &lt;b&gt;你好&lt;/b&gt;'));
    assert.ok(!out.html.includes('標題'));
});

test('parseScript：標題只在 HTML 之前找；沒有標題用預設；空回覆 html 為空字串', () => {
    assert.equal(parseScript('<div>標題：藏在畫面裡</div>').title, '未命名劇目');
    assert.equal(parseScript('').html, '');
    assert.equal(parseScript(null).html, '');
});

test('buildScriptMessages：掛載的劇場設定內容會帶進提示詞；沒掛載時有預設要求；沒有 system 就不送空訊息', () => {
    const withSettings = buildScriptMessages('人設', { name: '小夜', description: '夜貓子' }, [{ name: '極光小劇場', content: '嵌入 HTML+JS 互動界面' }]);
    assert.equal(withSettings[0].role, 'system');
    const task = withSettings[1].content;
    assert.ok(task.includes('小夜') && task.includes('夜貓子'));
    assert.ok(task.includes('《極光小劇場》') && task.includes('嵌入 HTML+JS 互動界面'));
    assert.ok(task.includes('<ice>'));
    const bare = buildScriptMessages('', { name: '小夜' }, []);
    assert.equal(bare.length, 1);
    assert.equal(bare[0].role, 'user');
    assert.ok(bare[0].content.includes('兩個選項'));
});

test('frameDoc：內容包在完整頁面裡，背景透明', () => {
    const doc = frameDoc('<p>hi</p>');
    assert.ok(doc.startsWith('<!doctype html>'));
    assert.ok(doc.includes('<body><p>hi</p></body>'));
    assert.ok(doc.includes('background:transparent'));
});

test('escapeHtml：雙引號與單引號都要跳脫，才不會跳出屬性', () => {
    assert.equal(escapeHtml(`a"b'c<d>&`), 'a&quot;b&#39;c&lt;d&gt;&amp;');
    assert.equal(escapeHtml(''), '');
    assert.equal(escapeHtml(null), '');
});
