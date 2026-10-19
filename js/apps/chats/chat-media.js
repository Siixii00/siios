import { createElement, createKakaoBottomSheet } from '../../components.js';
import { SettingsDB } from '../../db.js';
import Router from '../../router.js';

export const LIMITS = {
    imageMaxDim: 1280,
    imageQuality: 0.82,
    videoBytes: 20 * 1024 * 1024,
    fileBytes: 20 * 1024 * 1024,
    recordSeconds: 120
};

export function formatBytes(n) {
    if (n < 1024) return n + ' B';
    if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1024 / 1024).toFixed(1) + ' MB';
}

// 開啟系統選檔／相機；使用者取消時回傳 null
export function pickFile({ accept = '*/*', capture = null } = {}) {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = accept;
        if (capture) input.setAttribute('capture', capture);
        input.style.display = 'none';
        let settled = false;
        const done = (file) => {
            if (settled) return;
            settled = true;
            input.remove();
            resolve(file);
        };
        input.addEventListener('change', () => done(input.files?.[0] || null));
        input.addEventListener('cancel', () => done(null));
        document.body.appendChild(input);
        input.click();
    });
}

export function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('讀取檔案失敗'));
        reader.readAsDataURL(blob);
    });
}

// 壓縮圖片來源（File/Blob 或 data URL 字串）為 JPEG data URL
export async function compressImage(source, maxDim = LIMITS.imageMaxDim, quality = LIMITS.imageQuality, png = false) {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    try {
        const img = await new Promise((resolve, reject) => {
            const el = new Image();
            el.onload = () => resolve(el);
            el.onerror = () => reject(new Error('無法讀取這張圖片'));
            el.src = url;
        });
        const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (!png) {
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        return png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', quality);
    } finally {
        if (typeof source !== 'string') URL.revokeObjectURL(url);
    }
}

// 以下 prepare* 回傳可直接交給 sendRich 的 { type, content, meta }；失敗時丟出帶中文訊息的 Error
export async function prepareImage(source, label = '圖片') {
    const src = await compressImage(source);
    return { type: 'image', content: label, meta: { src } };
}

export async function prepareVideo(file) {
    if (!file.type.startsWith('video/')) throw new Error('這不是影片檔案');
    if (file.size > LIMITS.videoBytes) throw new Error('影片太大（' + formatBytes(file.size) + '），上限 ' + formatBytes(LIMITS.videoBytes));
    return { type: 'video', content: file.name || '影片', meta: { src: await blobToDataURL(file), name: file.name, size: file.size, mime: file.type } };
}

export async function prepareFile(file) {
    if (file.size > LIMITS.fileBytes) throw new Error('檔案太大（' + formatBytes(file.size) + '），上限 ' + formatBytes(LIMITS.fileBytes));
    return { type: 'file', content: file.name || '檔案', meta: { src: await blobToDataURL(file), name: file.name, size: file.size, mime: file.type } };
}

export function getLocationMessage() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('這個瀏覽器不支援定位'));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude: lat, longitude: lng, accuracy } = pos.coords;
                resolve({
                    type: 'location',
                    content: lat.toFixed(5) + ', ' + lng.toFixed(5),
                    meta: { lat, lng, accuracy, label: '我的位置' }
                });
            },
            err => {
                const reasons = { 1: '你拒絕了定位權限，請在瀏覽器設定中允許', 2: '無法取得目前位置', 3: '定位逾時，請再試一次' };
                reject(new Error(reasons[err.code] || '定位失敗'));
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });
}

// ---- 語音錄音 ----
function pickMime() {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'];
    return candidates.find(m => window.MediaRecorder?.isTypeSupported?.(m)) || '';
}

export function openRecorderSheet(onSend) {
    const content = createElement('div', 'p-4 flex flex-col gap-3 items-center');
    const status = createElement('div', 'text-sm text-gray-500', { textContent: '按下開始錄音' });
    const timer = createElement('div', '', { textContent: '0:00' });
    timer.style.cssText = 'font-size:32px;font-variant-numeric:tabular-nums;';
    const player = createElement('audio');
    player.controls = true;
    player.style.display = 'none';
    const bar = createElement('div', 'flex gap-2');
    const mainBtn = createElement('button', 'px-4 py-2 rounded-lg bg-kakao-yellow text-kakao-brown font-medium', { textContent: '開始錄音' });
    const sendBtn = createElement('button', 'px-4 py-2 rounded-lg bg-kakao-yellow text-kakao-brown font-medium', { textContent: '傳送' });
    sendBtn.style.display = 'none';
    bar.append(mainBtn, sendBtn);
    content.append(status, timer, player, bar);

    let sheet;
    let recorder = null;
    let stream = null;
    let chunks = [];
    let started = 0;
    let tick = null;
    let recognition = null;
    let transcript = '';
    let result = null;

    const cleanupMedia = () => {
        clearInterval(tick);
        try { recognition?.stop(); } catch { /* 已停止 */ }
        stream?.getTracks().forEach(t => t.stop());
        stream = null;
    };
    const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

    async function start() {
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch (e) {
            status.textContent = e.name === 'NotAllowedError' ? '你拒絕了麥克風權限，請在瀏覽器設定中允許' : '無法使用麥克風：' + (e.message || e.name);
            return;
        }
        const mime = pickMime();
        recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        chunks = [];
        transcript = '';
        result = null;
        recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
        recorder.onstop = async () => {
            const blob = new Blob(chunks, { type: recorder.mimeType || 'audio/webm' });
            const seconds = Math.max(1, Math.round((Date.now() - started) / 1000));
            const src = await blobToDataURL(blob);
            if (!transcript) {
                // 瀏覽器沒辨識到文字時，若已設定合成服務就改用 Worker 的語音辨識
                try {
                    const { getSynthConfig, transcribe } = await import('../../core/synth-client.js');
                    const cfg = await getSynthConfig();
                    if (cfg.url && cfg.token) {
                        status.textContent = '辨識中…';
                        transcript = (await transcribe(src)).trim();
                    }
                } catch { /* 辨識失敗不影響傳送，角色會收到「無法辨識內容」標記 */ }
            }
            result = { type: 'audio', content: transcript || '語音訊息', meta: { src, seconds, transcript: transcript || null, mime: blob.type } };
            player.src = src;
            player.style.display = '';
            sendBtn.style.display = '';
            mainBtn.textContent = '重錄';
            status.textContent = transcript ? '辨識到：' + transcript : '已錄製（沒有辨識到文字）';
        };
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SR) {
            try {
                recognition = new SR();
                recognition.lang = 'zh-TW';
                recognition.continuous = true;
                recognition.interimResults = false;
                recognition.onresult = ev => {
                    for (let i = ev.resultIndex; i < ev.results.length; i++) {
                        if (ev.results[i].isFinal) transcript += ev.results[i][0].transcript;
                    }
                };
                recognition.onerror = () => {};
                recognition.start();
            } catch { recognition = null; }
        }
        started = Date.now();
        recorder.start();
        player.style.display = 'none';
        sendBtn.style.display = 'none';
        mainBtn.textContent = '停止';
        status.textContent = '錄音中…';
        tick = setInterval(() => {
            const s = Math.round((Date.now() - started) / 1000);
            timer.textContent = fmt(s);
            if (s >= LIMITS.recordSeconds) stop();
        }, 250);
    }

    function stop() {
        if (recorder && recorder.state === 'recording') {
            recorder.stop();
        }
        cleanupMedia();
    }

    mainBtn.onclick = () => {
        if (recorder && recorder.state === 'recording') stop();
        else start();
    };
    sendBtn.onclick = () => {
        if (!result) return;
        sheet.close();
        onSend(result);
    };

    sheet = createKakaoBottomSheet([], { title: '語音', customContent: content });
    const origClose = sheet.close;
    sheet.close = () => { stop(); origClose(); };
    sheet.overlay.addEventListener('click', stop);
    sheet.open();
    return sheet;
}

// ---- 相簿挑圖 ----
const ALBUM_KEY = 'sx_album_images';

export async function openAlbumPicker(onPick, { onGenerate } = {}) {
    const stored = await SettingsDB.get(ALBUM_KEY);
    const images = Array.isArray(stored) ? stored : [];
    const content = createElement('div', 'p-4 flex flex-col gap-3');
    let sheet;

    const deviceBtn = createElement('button', 'px-3 py-2 rounded-lg bg-kakao-yellow text-kakao-brown text-sm font-medium', { textContent: '從裝置選擇圖片' });
    deviceBtn.onclick = async () => {
        sheet.close();
        const file = await pickFile({ accept: 'image/*' });
        if (file) onPick(file);
    };
    const appBtn = createElement('button', 'px-3 py-2 rounded-lg text-sm', { textContent: '開啟相簿 App' });
    appBtn.style.cssText = 'border:1px solid #ddd;background:transparent;';
    appBtn.onclick = () => { sheet.close(); Router.navigate('/album'); };
    const top = createElement('div', 'flex gap-2');
    top.append(deviceBtn, appBtn);
    content.appendChild(top);
    if (onGenerate) {
        const genBtn = createElement('button', 'px-3 py-2 rounded-lg text-sm', { textContent: 'AI 生成圖片' });
        genBtn.style.cssText = 'border:1px solid #ddd;background:transparent;';
        genBtn.onclick = () => { sheet.close(); onGenerate(); };
        top.appendChild(genBtn);
    }

    if (images.length === 0) {
        content.appendChild(createElement('div', 'text-sm text-gray-500', { textContent: '相簿目前沒有圖片' }));
    } else {
        content.appendChild(createElement('div', 'text-xs text-gray-500', { textContent: '或從相簿選一張' }));
        const grid = createElement('div', 'grid grid-cols-3 gap-2');
        images.slice(0, 60).forEach(img => {
            const cell = createElement('button');
            cell.style.cssText = 'border:none;padding:0;background:transparent;cursor:pointer;aspect-ratio:1;overflow:hidden;border-radius:8px;';
            const thumb = createElement('img', '', { src: img.url, alt: '相簿圖片' });
            thumb.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;';
            cell.appendChild(thumb);
            cell.onclick = () => { sheet.close(); onPick(img.url); };
            grid.appendChild(cell);
        });
        content.appendChild(grid);
    }
    sheet = createKakaoBottomSheet([], { title: '相簿', customContent: content });
    sheet.open();
}

