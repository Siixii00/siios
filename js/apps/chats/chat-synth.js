import { createElement, createToast, createKakaoBottomSheet } from '../../components.js';
import { MessagesDB, SettingsDB } from '../../db.js';
import Router from '../../router.js';
import { synthesize } from '../../core/synth-client.js';
import { compressImage, pickFile, prepareVideo, LIMITS, formatBytes } from './chat-media.js';

const ALBUM_KEY = 'sx_album_images';

async function saveToAlbum(dataUrl) {
    const list = (await SettingsDB.get(ALBUM_KEY)) || [];
    list.unshift({ id: 'img_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6), url: dataUrl, source: 'chat', createdAt: new Date().toISOString() });
    await SettingsDB.set(ALBUM_KEY, list.slice(0, 200));
}

// 朗讀 AI 回應：把語音存回同一則訊息（meta.tts_src），不新增訊息，避免對話內容重複
export async function synthesizeSpeechForMessage(messageId, text) {
    const res = await synthesize('tts', { text: text.slice(0, 2000), lang: 'zh' });
    const message = await MessagesDB.getById(messageId);
    await MessagesDB.update(messageId, { meta: { ...(message?.meta || {}), tts_src: res.dataUrl } });
    return res.dataUrl;
}

// 通用的「輸入描述 → 生成 → 預覽 → 傳送／重新生成」面板
function openGenerateSheet({ title, kind, placeholder, hint, makePreview, makePayload }) {
    const content = createElement('div', 'p-4 flex flex-col gap-3');
    if (hint) content.appendChild(createElement('div', 'text-xs text-gray-500', { textContent: hint }));
    const prompt = createElement('textarea', 'ios-input', { placeholder, rows: '3' });
    prompt.style.cssText = 'width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:14px;';
    const status = createElement('div', 'text-sm');
    const preview = createElement('div');
    const bar = createElement('div', 'flex gap-2 justify-end');
    const genBtn = createElement('button', 'px-3 py-2 rounded-lg bg-kakao-yellow text-kakao-brown text-sm font-medium', { textContent: '生成' });
    const sendBtn = createElement('button', 'px-3 py-2 rounded-lg text-sm font-medium', { textContent: '傳送' });
    sendBtn.style.cssText = 'border:1px solid #ddd;background:transparent;display:none;';
    const settingsBtn = createElement('button', 'px-3 py-2 rounded-lg text-sm', { textContent: '前往合成設定' });
    settingsBtn.style.cssText = 'border:1px solid #ddd;background:transparent;display:none;';
    bar.append(settingsBtn, sendBtn, genBtn);
    content.append(prompt, status, preview, bar);

    let sheet;
    let ctrl = null;
    let result = null;
    let usedPrompt = '';

    const run = async () => {
        const text = prompt.value.trim();
        if (!text) {
            status.textContent = '請先輸入描述';
            return;
        }
        ctrl?.abort();
        ctrl = new AbortController();
        usedPrompt = text;
        result = null;
        preview.replaceChildren();
        sendBtn.style.display = 'none';
        settingsBtn.style.display = 'none';
        genBtn.disabled = true;
        status.style.color = '';
        status.textContent = '生成中…（影片、音樂可能需要一到兩分鐘）';
        try {
            result = await synthesize(kind, { prompt: text }, { signal: ctrl.signal });
            preview.replaceChildren(makePreview(result));
            status.textContent = '生成完成' + (result.model ? '（' + result.model + '）' : '') + '，確認後按「傳送」';
            sendBtn.style.display = '';
            genBtn.textContent = '重新生成';
        } catch (e) {
            if (e.code === 'cancelled') return;
            status.style.color = '#d33';
            status.textContent = e.message || '生成失敗';
            if (e.code === 'not_configured') settingsBtn.style.display = '';
        } finally {
            genBtn.disabled = false;
        }
    };
    genBtn.onclick = run;
    settingsBtn.onclick = () => { sheet.close(); Router.navigate('/settings/synth'); };
    sendBtn.onclick = async () => {
        if (!result) return;
        sendBtn.disabled = true;
        try {
            const payload = await makePayload(result, usedPrompt);
            sheet.close();
            sheet.onSend(payload);
        } catch (e) {
            status.style.color = '#d33';
            status.textContent = e.message || '無法傳送';
        } finally {
            sendBtn.disabled = false;
        }
    };

    sheet = createKakaoBottomSheet([], { title, customContent: content });
    const origClose = sheet.close;
    sheet.close = () => { ctrl?.abort(); origClose(); };
    sheet.overlay.addEventListener('click', () => ctrl?.abort());
    sheet.open();
    return sheet;
}

export function openImageGenerator(onSend) {
    const sheet = openGenerateSheet({
        title: 'AI 生成圖片',
        kind: 'image',
        placeholder: '描述想生成的圖片，例如：夕陽下的海邊，水彩風格',
        hint: '免費額度每天有上限，品質普通。想要更好品質請到「設定 → 合成服務」改用付費服務。',
        makePreview: res => {
            const img = createElement('img', '', { src: res.dataUrl, alt: '生成的圖片' });
            img.style.cssText = 'max-width:100%;max-height:260px;border-radius:12px;display:block;margin:auto;';
            return img;
        },
        makePayload: async (res, prompt) => {
            const src = await compressImage(res.dataUrl);
            await saveToAlbum(src);
            return { type: 'image', content: prompt.slice(0, 40), meta: { src, generated: true, prompt } };
        }
    });
    sheet.onSend = onSend;
}

export function openVideoGenerator(onSend) {
    const sheet = openGenerateSheet({
        title: 'AI 生成影片',
        kind: 'video',
        placeholder: '描述想生成的影片，例如：一隻貓在雨中的街道上走路',
        hint: '影片沒有免費服務，需在「設定 → 合成服務」填入付費服務（例如 Replicate）與模型 ID。',
        makePreview: res => {
            const video = createElement('video', '', { src: res.dataUrl });
            video.controls = true;
            video.playsInline = true;
            video.style.cssText = 'max-width:100%;max-height:260px;border-radius:12px;display:block;margin:auto;';
            return video;
        },
        makePayload: async (res, prompt) => {
            const bytes = Math.round(res.dataUrl.length * 0.75);
            if (bytes > LIMITS.videoBytes) throw new Error('生成的影片太大（' + formatBytes(bytes) + '），上限 ' + formatBytes(LIMITS.videoBytes));
            return { type: 'video', content: 'AI 影片：' + prompt.slice(0, 30), meta: { src: res.dataUrl, name: 'AI 生成影片', size: bytes, mime: res.mime, generated: true, prompt } };
        }
    });
    sheet.onSend = onSend;
}

export function openMusicGenerator(onSend) {
    const sheet = openGenerateSheet({
        title: 'AI 合成音樂',
        kind: 'music',
        placeholder: '描述想要的音樂，例如：輕柔的鋼琴曲，適合下雨天',
        hint: '音樂沒有穩定的免費服務。可在「設定 → 合成服務」嘗試 Hugging Face（額度極少）或改用付費服務。',
        makePreview: res => {
            const audio = createElement('audio', '', { src: res.dataUrl });
            audio.controls = true;
            audio.style.cssText = 'width:100%;';
            return audio;
        },
        makePayload: async (res, prompt) => ({
            type: 'audio',
            content: '音樂：' + prompt.slice(0, 30),
            meta: { src: res.dataUrl, kind: 'music', caption: prompt, mime: res.mime, generated: true }
        })
    });
    sheet.onSend = onSend;
}

// ---- 影片、音樂入口：先選「來源」 ----
function openChoiceSheet(title, choices) {
    const content = createElement('div', 'p-4 flex flex-col gap-2');
    let sheet;
    choices.forEach(({ label, desc, run }) => {
        const btn = createElement('button', 'text-left px-3 py-3 rounded-lg');
        btn.style.cssText = 'border:1px solid #eee;background:transparent;cursor:pointer;text-align:left;';
        btn.appendChild(createElement('div', 'text-sm font-medium', { textContent: label }));
        if (desc) btn.appendChild(createElement('div', 'text-xs text-gray-500', { textContent: desc }));
        btn.onclick = () => { sheet.close(); run(); };
        content.appendChild(btn);
    });
    sheet = createKakaoBottomSheet([], { title, customContent: content });
    sheet.open();
}

export function openVideoChoice(onSend, sendPrepared) {
    openChoiceSheet('影片', [
        {
            label: '從裝置選擇／拍攝影片',
            desc: '上限 ' + formatBytes(LIMITS.videoBytes),
            run: async () => {
                const file = await pickFile({ accept: 'video/*' });
                if (file) await sendPrepared(() => prepareVideo(file));
            }
        },
        { label: 'AI 生成影片', desc: '需要設定付費合成服務', run: () => openVideoGenerator(onSend) }
    ]);
}

export function openMusicChoice(onSend) {
    openChoiceSheet('音樂', [
        { label: '開啟音樂 App', desc: '播放、匯入歌單', run: () => Router.navigate('/music') },
        { label: 'AI 合成音樂', desc: '依描述生成一段音樂傳送給角色', run: () => openMusicGenerator(onSend) }
    ]);
}
