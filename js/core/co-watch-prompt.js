// 共同觀看的純函式（網址解析、提示詞）：不依賴瀏覽器，方便測試；計時與面板在 co-watch.js
export const COWATCH_INTERVALS = [
    { sec: 0, label: '只在我說話／按鈕時' },
    { sec: 30, label: '每 30 秒' },
    { sec: 60, label: '每 1 分鐘' },
    { sec: 120, label: '每 2 分鐘' },
    { sec: 300, label: '每 5 分鐘' }
];

// 回傳 { platform, id, embedUrl, watchUrl }，認不得就回 null
export function parseVideoUrl(input) {
    const raw = String(input || '').trim();
    if (!raw) return null;
    const bv = raw.match(/\b(BV[0-9A-Za-z]{10})\b/);
    if (bv && (/bilibili\.com|b23\.tv/.test(raw) || raw === bv[1])) {
        return { platform: 'bilibili', id: bv[1], embedUrl: `https://player.bilibili.com/player.html?bvid=${bv[1]}&autoplay=0&high_quality=1`, watchUrl: `https://www.bilibili.com/video/${bv[1]}` };
    }
    let u;
    try { u = new URL(/^https?:\/\//i.test(raw) ? raw : 'https://' + raw); } catch (_) { return null; }
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'youtube-nocookie.com' || host === 'music.youtube.com') {
        if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
        else { const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/); if (m) id = m[1]; }
    }
    if (!/^[\w-]{11}$/.test(id)) return null;
    return { platform: 'youtube', id, embedUrl: `https://www.youtube-nocookie.com/embed/${id}?enablejsapi=1&playsinline=1&rel=0`, watchUrl: `https://www.youtube.com/watch?v=${id}` };
}

export function formatClock(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    const mm = String(m).padStart(h ? 2 : 1, '0'), rr = String(r).padStart(2, '0');
    return h ? `${h}:${mm}:${rr}` : `${mm}:${rr}`;
}

export const trimTo = (s, n) => { s = String(s || '').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

// 組出給模型的訊息。character 的個性／設定由 buildAppContext 的 systemPrompt 提供，這裡只補「現在的情況」與規則。
export function buildCoWatchMessages({ systemPrompt = '', platform, title, author, notes, clockSec, clockIsPlayer, recent = [], userSaid = '' }) {
    const site = platform === 'bilibili' ? 'Bilibili' : 'YouTube';
    const known = [];
    if (title) known.push(`標題：${trimTo(title, 120)}`);
    if (author) known.push(`頻道／作者：${trimTo(author, 60)}`);
    const noteText = trimTo(notes, 3000);
    known.push(noteText ? `使用者提供的影片內容（字幕／簡介／重點）：\n${noteText}` : '（沒有提供影片的字幕或內容，你只知道上面的標題與作者）');

    const rules = [
        `你正在和用戶在 ${site} 上一起看影片，現在是你們同時看的過程中。你看不到畫面也聽不到聲音，只能根據下面「已知資訊」。`,
        '用你自己的個性、說話方式與你和用戶的關係，自然地說一兩句話（不超過 60 字）；像坐在旁邊隨口講的，不要寫成評論文章或條列。',
        '不要編造沒有出現在已知資訊裡的劇情、台詞或畫面細節；不確定的時候，就針對標題、氣氛、用戶說的話，或用提問的方式回應。',
        '不要重複你剛才說過的內容。不要提到「提示詞」「已知資訊」「我是 AI」之類的字。只輸出你要說的話。'
    ].join('\n');

    const parts = [`【已知資訊】\n${known.join('\n')}`, clockIsPlayer ? `目前播放到 ${formatClock(clockSec)}` : `你們已經一起看了約 ${formatClock(clockSec)}`];
    if (recent.length) parts.push(`【你剛才說過】\n${recent.slice(-5).map(t => '- ' + trimTo(t, 80)).join('\n')}`);
    parts.push(userSaid ? `【用戶剛剛對你說】${trimTo(userSaid, 300)}\n請回應用戶。` : '請針對現在說點什麼。');

    return [
        { role: 'system', content: [systemPrompt, rules].filter(Boolean).join('\n\n') },
        { role: 'user', content: parts.join('\n\n') }
    ];
}
