import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseVideoUrl, formatClock, buildCoWatchMessages, COWATCH_INTERVALS } from '../../js/core/co-watch-prompt.js';

test('parseVideoUrl：YouTube 各種網址都轉成可嵌入的連結（含 enablejsapi 才讀得到播放時間）', () => {
    const id = 'dQw4w9WgXcQ';
    for (const u of [`https://www.youtube.com/watch?v=${id}&t=10`, `https://youtu.be/${id}`, `https://m.youtube.com/watch?v=${id}`, `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/embed/${id}`, `youtube.com/watch?v=${id}`]) {
        const p = parseVideoUrl(u);
        assert.equal(p?.platform, 'youtube', u);
        assert.equal(p.id, id);
        assert.match(p.embedUrl, /youtube-nocookie\.com\/embed\/dQw4w9WgXcQ\?.*enablejsapi=1/);
    }
});

test('parseVideoUrl：Bilibili 只用 BV 號做嵌入播放器，不需要登入或 Worker', () => {
    const p = parseVideoUrl('https://www.bilibili.com/video/BV1xx411c7mD?p=1');
    assert.equal(p.platform, 'bilibili');
    assert.equal(p.id, 'BV1xx411c7mD');
    assert.match(p.embedUrl, /^https:\/\/player\.bilibili\.com\/player\.html\?bvid=BV1xx411c7mD/);
    assert.equal(parseVideoUrl('https://b23.tv/BV1xx411c7mD').id, 'BV1xx411c7mD');
});

test('parseVideoUrl：不認得的網址回 null（不會把任意網址塞進 iframe）', () => {
    for (const u of ['', null, 'hello', 'https://example.com/watch?v=dQw4w9WgXcQ', 'https://www.youtube.com/watch?v=short', 'https://evil.test/https://youtube.com/watch?v=dQw4w9WgXcQ']) {
        assert.equal(parseVideoUrl(u), null, String(u));
    }
});

test('formatClock', () => {
    assert.equal(formatClock(0), '0:00');
    assert.equal(formatClock(65), '1:05');
    assert.equal(formatClock(3725), '1:02:05');
    assert.equal(formatClock(-3), '0:00');
    assert.equal(formatClock(undefined), '0:00');
});

test('頻率選項：有「只在我說話時」與固定秒數，數值遞增', () => {
    assert.equal(COWATCH_INTERVALS[0].sec, 0);
    const secs = COWATCH_INTERVALS.map(i => i.sec);
    assert.deepEqual(secs, [...secs].sort((a, b) => a - b));
    assert.ok(secs.includes(60));
});

test('提示詞：有角色設定、標題、使用者貼的內容、播放時間、剛說過的話，並要求不編造', () => {
    const msgs = buildCoWatchMessages({
        systemPrompt: '你是小雪，個性傲嬌。', platform: 'youtube', title: '貓咪的一天', author: '貓頻道',
        notes: '0:30 貓跳上桌子', clockSec: 95, clockIsPlayer: true, recent: ['哼，才不是在意', '這貓好蠢']
    });
    assert.equal(msgs[0].role, 'system');
    assert.match(msgs[0].content, /你是小雪/);
    assert.match(msgs[0].content, /不要編造/);
    assert.match(msgs[0].content, /YouTube/);
    const u = msgs[1].content;
    for (const need of ['貓咪的一天', '貓頻道', '0:30 貓跳上桌子', '1:35', '這貓好蠢']) assert.ok(u.includes(need), need);
    assert.match(u, /目前播放到/);
});

test('提示詞：沒貼內容時明講只知道標題；Bilibili 沒有播放時間，用「一起看了多久」；使用者說話時要回應他', () => {
    const msgs = buildCoWatchMessages({ platform: 'bilibili', title: '某影片', notes: '', clockSec: 125, clockIsPlayer: false, userSaid: '你覺得好看嗎？' });
    assert.match(msgs[0].content, /Bilibili/);
    assert.match(msgs[1].content, /沒有提供影片的字幕或內容/);
    assert.match(msgs[1].content, /一起看了約 2:05/);
    assert.match(msgs[1].content, /用戶剛剛對你說】你覺得好看嗎？/);
    assert.ok(!/目前播放到/.test(msgs[1].content));
});

test('提示詞：過長的內容會截斷，不會把整份字幕塞滿上下文', () => {
    const msgs = buildCoWatchMessages({ platform: 'youtube', title: 't', notes: 'x'.repeat(50000), clockSec: 0 });
    assert.ok(msgs[1].content.length < 4000);
});
