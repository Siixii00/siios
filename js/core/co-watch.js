// 共同觀看：YouTube／Bilibili 嵌入播放器 + 角色依個性即時留言。
// 純函式（網址解析、提示詞）可單獨測試；createCoWatch 負責計時與呼叫 API；mountCoWatchPanel 是兩個 App 共用的操作面板。
//
// 角色「看得到什麼」：播放器是跨網域的 iframe，網頁讀不到畫面或聲音，所以角色的資訊來源是
//   ① 標題／頻道（YouTube 會用 oEmbed 自動抓） ② 使用者貼的字幕、簡介或重點（面板的「影片內容」欄）
//   ③ 播放時間（YouTube 可讀到；Bilibili 只能算一起看了多久） ④ 使用者在面板裡說的話
// 提示詞會明講這些限制，要求角色不要編造沒看到的劇情。
import { SettingsDB, CharactersDB } from '../db.js';
import APIClient from '../api.js';
import { buildAppContext } from './app-context-builder.js';
import { saveInteractionMemory } from './memory-saver.js';
import { learnDislikesFromText } from './dislikes.js';
import { COWATCH_INTERVALS, parseVideoUrl, formatClock, buildCoWatchMessages, trimTo } from './co-watch-prompt.js';

export { COWATCH_INTERVALS, parseVideoUrl, formatClock, buildCoWatchMessages };

// 計時、呼叫 API 與存記憶。callbacks.onComment({ text, byUser }) 每次角色說話時呼叫
export function createCoWatch({ characterId, platform, getVideo, getPlayerTime, intervalSec = 0, onComment, onError, onBusy }) {
    const startedAt = Date.now();
    const recent = [];
    const log = [];
    let timer = null, busy = false, stopped = false, interval = intervalSec;

    async function speak(userSaid = '') {
        if (busy || stopped) return null;
        busy = true; onBusy?.(true);
        try {
            const video = getVideo() || {};
            const ctx = await buildAppContext({ characterId, userMessage: [video.title, userSaid].filter(Boolean).join(' ') });
            const playerSec = getPlayerTime?.();
            const hasPlayer = typeof playerSec === 'number' && playerSec >= 0;
            const messages = buildCoWatchMessages({
                systemPrompt: ctx.systemPrompt, platform, title: video.title, author: video.author, notes: video.notes,
                clockSec: hasPlayer ? playerSec : (Date.now() - startedAt) / 1000, clockIsPlayer: hasPlayer, recent, userSaid
            });
            const text = (await APIClient.complete(messages, { temperature: 0.9, maxTokens: 300 })).trim();
            if (stopped || !text) return null;
            recent.push(text);
            log.push({ text, byUser: !!userSaid, user: userSaid || '', at: hasPlayer ? playerSec : null });
            onComment?.({ text, byUser: !!userSaid });
            return text;
        } catch (e) {
            onError?.(e);
            return null;
        } finally { busy = false; onBusy?.(false); }
    }

    function schedule() {
        if (timer) { clearInterval(timer); timer = null; }
        if (interval > 0 && !stopped) timer = setInterval(() => { if (!document.hidden) speak(); }, interval * 1000);
    }
    schedule();

    return {
        say: userText => { const t = String(userText || '').trim(); learnDislikesFromText(t, platform); return speak(t); },
        comment: () => speak(''),
        setIntervalSec(sec) { interval = Number(sec) || 0; schedule(); },
        async stop() {
            if (stopped) return;
            stopped = true;
            if (timer) clearInterval(timer);
            const video = getVideo() || {};
            if (!log.length) return;
            const said = log.filter(l => !l.byUser).slice(0, 3).map(l => l.text).join(' / ');
            try {
                await saveInteractionMemory({
                    characterId, sourceApp: platform, sourceType: 'interaction', sourceSubtype: 'viewing',
                    content: `和用戶一起看了「${trimTo(video.title, 80) || '影片'}」，期間說了 ${log.length} 次話：${trimTo(said, 200)}`,
                    metaContent: `在 ${platform === 'bilibili' ? 'Bilibili' : 'YouTube'} 與用戶共同觀看`,
                    importance: 0.6
                });
            } catch (_) {}
        }
    };
}

// YouTube iframe（網址要有 enablejsapi=1）會用 postMessage 回報播放時間
export function trackYouTubePlayer(iframe) {
    let t = null;
    const onMsg = e => {
        if (!iframe.contentWindow || e.source !== iframe.contentWindow) return;
        let d = e.data;
        if (typeof d === 'string') { try { d = JSON.parse(d); } catch (_) { return; } }
        if (d?.event === 'infoDelivery' && typeof d.info?.currentTime === 'number') t = d.info.currentTime;
    };
    const hello = () => { try { iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }), '*'); } catch (_) {} };
    window.addEventListener('message', onMsg);
    iframe.addEventListener('load', hello);
    return { getTime: () => t, destroy() { window.removeEventListener('message', onMsg); iframe.removeEventListener('load', hello); } };
}

// YouTube 的標題與頻道（oEmbed，允許跨網域）；失敗就回空物件，不影響播放
export async function fetchYouTubeMeta(watchUrl) {
    try {
        const res = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(watchUrl)}`);
        if (!res.ok) return {};
        const d = await res.json();
        return { title: d.title || '', author: d.author_name || '' };
    } catch (_) { return {}; }
}

const STYLE_ID = 'cw-style';
const CSS = `
.cw-panel{margin:12px 16px;padding:12px;border-radius:12px;background:rgba(128,128,128,.14);border:1px solid rgba(128,128,128,.25);font-size:13px;color:inherit}
.cw-panel h4{margin:0 0 8px;font-size:14px;font-weight:600}
.cw-row{display:flex;gap:8px;margin-bottom:8px;align-items:center}
.cw-row>*{flex:1;min-width:0}
.cw-panel select,.cw-panel textarea,.cw-panel input[type=text]{width:100%;box-sizing:border-box;padding:8px;border-radius:8px;border:1px solid rgba(128,128,128,.35);background:transparent;color:inherit;font-size:13px}
.cw-panel textarea{min-height:60px;resize:vertical}
.cw-btn{flex:none!important;padding:8px 12px;border-radius:8px;border:none;background:#007aff;color:#fff;font-size:13px;cursor:pointer}
.cw-btn.alt{background:rgba(128,128,128,.2);color:inherit}
.cw-btn:disabled{opacity:.5}
.cw-feed{max-height:220px;overflow-y:auto;margin:8px 0;display:flex;flex-direction:column;gap:6px}
.cw-msg{padding:8px 10px;border-radius:10px;background:rgba(128,128,128,.14);line-height:1.5;white-space:pre-wrap}
.cw-msg.me{background:rgba(0,122,255,.16);align-self:flex-end}
.cw-msg small{display:block;opacity:.6;margin-bottom:2px}
.cw-hint{opacity:.65;font-size:12px;line-height:1.5;margin-top:6px}
`;

// 共用面板。getVideo() → { title, author, url }；getPlayerTime() → 秒或 null。
// initialCharacterId 有值就預選；onCharacterChange(id) 讓 App 同步自己的角色選單。
export async function mountCoWatchPanel(host, { platform, getVideo, getPlayerTime, initialCharacterId = '', onCharacterChange, onComment }) {
    if (!document.getElementById(STYLE_ID)) {
        const st = document.createElement('style'); st.id = STYLE_ID; st.textContent = CSS; document.head.appendChild(st);
    }
    const chars = await CharactersDB.getAll();
    const savedInterval = Number(await SettingsDB.get('cowatch_interval')) || 0;
    const el = document.createElement('div');
    el.className = 'cw-panel';
    const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    el.innerHTML = `
        <h4>👀 一起看</h4>
        <div class="cw-row">
            <select class="cw-char"><option value="">選擇一起看的角色</option>${chars.map(c => `<option value="${esc(c.id)}">${esc(c.name || '角色')}</option>`).join('')}</select>
            <select class="cw-interval">${COWATCH_INTERVALS.map(i => `<option value="${i.sec}"${i.sec === savedInterval ? ' selected' : ''}>${i.label}</option>`).join('')}</select>
        </div>
        <textarea class="cw-notes" placeholder="影片內容（選填）：貼上字幕、簡介或你看到的重點，角色才能針對內容說話。沒有的話角色只知道標題。"></textarea>
        <div class="cw-row"><button class="cw-btn cw-toggle">開始一起看</button><button class="cw-btn alt cw-now" disabled>現在說點什麼</button></div>
        <div class="cw-feed"></div>
        <div class="cw-row"><input type="text" class="cw-say" placeholder="對角色說句話…" disabled><button class="cw-btn cw-send" disabled>送出</button></div>
        <div class="cw-hint">角色看不到畫面與聲音，只根據標題、你貼的內容、播放時間和你說的話來回應；留言頻率可以隨時調整。</div>`;
    host.appendChild(el);

    const $ = s => el.querySelector(s);
    const charSel = $('.cw-char'), intSel = $('.cw-interval'), feed = $('.cw-feed'), toggle = $('.cw-toggle'), nowBtn = $('.cw-now'), say = $('.cw-say'), send = $('.cw-send'), notes = $('.cw-notes');
    if (initialCharacterId) charSel.value = initialCharacterId;
    let session = null;

    const add = (text, me, who) => {
        const d = document.createElement('div');
        d.className = 'cw-msg' + (me ? ' me' : '');
        if (!me && who) { const s = document.createElement('small'); s.textContent = who; d.appendChild(s); }
        d.appendChild(document.createTextNode(text));
        feed.appendChild(d); feed.scrollTop = feed.scrollHeight;
    };
    const setRunning = on => {
        toggle.textContent = on ? '結束一起看' : '開始一起看';
        nowBtn.disabled = say.disabled = send.disabled = !on;
        charSel.disabled = on;
    };
    const charName = () => chars.find(c => c.id === charSel.value)?.name || '角色';

    function begin() {
        if (!charSel.value) { alert('請先選擇要一起看的角色'); return; }
        session = createCoWatch({
            characterId: charSel.value, platform,
            getVideo: () => ({ ...(getVideo?.() || {}), notes: notes.value }),
            getPlayerTime,
            intervalSec: Number(intSel.value) || 0,
            onComment: ({ text, byUser }) => { add(text, false, charName()); onComment?.({ text, byUser, characterId: charSel.value }); },
            onError: e => add('（無法取得回應：' + (e?.message || e) + '）', false, '系統'),
            onBusy: b => { nowBtn.disabled = b || !session; send.disabled = b || !session; }
        });
        setRunning(true);
        session.comment();
    }
    async function end() { const s = session; session = null; setRunning(false); await s?.stop(); }

    toggle.onclick = () => (session ? end() : begin());
    nowBtn.onclick = () => session?.comment();
    const submit = () => {
        const t = say.value.trim();
        if (!t || !session) return;
        add(t, true); say.value = '';
        session.say(t);
    };
    send.onclick = submit;
    say.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) submit(); });
    intSel.onchange = async () => { await SettingsDB.set('cowatch_interval', Number(intSel.value) || 0); session?.setIntervalSec(Number(intSel.value) || 0); };
    charSel.onchange = () => onCharacterChange?.(charSel.value);

    return {
        element: el,
        setCharacter(id) { if (!session) charSel.value = id || ''; },
        reset() { if (session) end(); feed.textContent = ''; notes.value = ''; },
        destroy() { end(); el.remove(); }
    };
}
