import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { generateAccessKey } from '../../core/discord-worker-client.js';
import { EXPECTED_WORKER_VERSION, WORKER_CODE_PATH, buildInviteUrl, GUIDE_STEPS, TROUBLESHOOTING, SECURITY_NOTES } from './discord-guide-data.js';

function applyWorker(text, worker) {
    return String(text).replaceAll('{{WORKER}}', worker || 'https://你的worker.workers.dev');
}

async function copyText(text, okMessage) {
    try {
        await navigator.clipboard.writeText(text);
        createToast(okMessage || '已複製');
    } catch (_) {
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); createToast(okMessage || '已複製'); } catch (e) { createToast('無法自動複製，請手動選取', 'error'); }
        ta.remove();
    }
}

async function loadWorkerCode() {
    const res = await fetch(WORKER_CODE_PATH, { cache: 'no-cache' });
    if (!res.ok) throw new Error('讀取 Worker 程式碼失敗（' + res.status + '）');
    return res.text();
}

async function renderDiscordGuide() {
    const worker = String((await SettingsDB.get('discord_worker_url')) || '').replace(/\/+$/, '');
    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createElement('header', 'ios-header');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';
    const backBtn = createElement('button', 'ios-back-btn', { onClick: () => Router.navigate('/settings/discord') });
    backBtn.innerHTML = '<i class="fas fa-chevron-left"></i> 返回';
    header.appendChild(backBtn);
    header.appendChild(createElement('h1', 'menu-title', { textContent: 'Discord Worker 部署教學' }));
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.paddingTop = 'calc(env(safe-area-inset-top, 44px) + 44px + 16px)';

    const intro = createElement('div', 'mx-4 mb-4 p-4 rounded-xl text-white');
    intro.style.background = 'linear-gradient(135deg,#5865F2,#7983F5)';
    intro.innerHTML = '<div class="text-lg font-bold mb-1">把 AI 角色帶到 Discord</div><div class="text-sm opacity-90">照著下面 10 個步驟，部署一個屬於你自己的機器人。全部用網頁操作，不需要安裝任何東西。</div>';
    main.appendChild(intro);

    const btnStyle = 'padding:8px 12px;border-radius:8px;background:#5865F2;color:#fff;font-size:13px;border:none;cursor:pointer;margin:4px 6px 0 0;';
    const lightBtn = 'padding:6px 10px;border-radius:8px;background:#EEF0FF;color:#3b46c4;font-size:12px;border:none;cursor:pointer;margin:4px 6px 0 0;';

    for (const step of GUIDE_STEPS) {
        const card = createElement('div', 'mx-4 mb-3 bg-white rounded-xl p-4');
        card.appendChild(createElement('div', 'font-semibold text-sm mb-2', { textContent: step.title }));
        const body = createElement('div', 'text-xs text-gray-700 space-y-2');
        body.innerHTML = step.html.map(p => `<p style="margin:6px 0;line-height:1.6">${applyWorker(p, worker)}</p>`).join('');
        card.appendChild(body);

        if (step.invite) {
            const input = createElement('input', 'w-full p-2 border rounded text-xs', { type: 'text', placeholder: '貼上 Application ID（數字）' });
            input.style.marginTop = '8px';
            const link = createElement('div', 'text-xs break-all');
            link.style.marginTop = '6px';
            const copyBtn = createElement('button', '', { textContent: '複製邀請連結' });
            copyBtn.style.cssText = lightBtn;
            copyBtn.hidden = true;
            input.addEventListener('input', () => {
                const url = buildInviteUrl(input.value);
                link.innerHTML = url ? `<a href="${url}" target="_blank" class="text-blue-500 underline">打開邀請連結</a>` : (input.value ? '<span style="color:#d33">Application ID 應該是 15～25 位的數字</span>' : '');
                copyBtn.hidden = !url;
                copyBtn.onclick = () => copyText(url, '已複製邀請連結');
            });
            card.append(input, link, copyBtn);
        }
        if (step.code) {
            const row = createElement('div', '');
            const copyBtn = createElement('button', '', { textContent: '📋 複製 Worker 程式碼' });
            copyBtn.style.cssText = btnStyle;
            copyBtn.onclick = async () => {
                try { copyBtn.disabled = true; await copyText(await loadWorkerCode(), '已複製 Worker 程式碼，到 Cloudflare 編輯器貼上'); }
                catch (e) { createToast(e.message, 'error'); } finally { copyBtn.disabled = false; }
            };
            const dlBtn = createElement('button', '', { textContent: '⬇️ 下載 .js 檔' });
            dlBtn.style.cssText = btnStyle.replace('#5865F2', '#6B7280');
            dlBtn.onclick = async () => {
                try {
                    const url = URL.createObjectURL(new Blob([await loadWorkerCode()], { type: 'text/javascript' }));
                    const a = document.createElement('a'); a.href = url; a.download = 'discord-bot-worker.js'; a.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                } catch (e) { createToast(e.message, 'error'); }
            };
            row.append(copyBtn, dlBtn);
            card.appendChild(row);
            card.appendChild(createElement('div', 'text-xs text-gray-400 mt-1', { textContent: `程式碼版本 ${EXPECTED_WORKER_VERSION}` }));
        }
        if (step.accessKey) {
            const keyRow = createElement('div', '');
            const keyBox = createElement('input', 'w-full p-2 border rounded text-xs', { type: 'text', readOnly: true, placeholder: '按下方按鈕產生密鑰' });
            keyBox.style.marginTop = '8px';
            keyBox.value = (await SettingsDB.get('discord_worker_key')) || '';
            const genBtn = createElement('button', '', { textContent: '🔑 產生密鑰（並存進這支 PWA）' });
            genBtn.style.cssText = btnStyle;
            genBtn.onclick = async () => {
                if (keyBox.value && !confirm('已經有一組密鑰了，重新產生會讓舊的失效（Worker 要一起換）。確定嗎？')) return;
                keyBox.value = generateAccessKey();
                await SettingsDB.set('discord_worker_key', keyBox.value);
                createToast('已產生並存進 PWA，請貼到 Cloudflare 的 ACCESS_KEY');
            };
            const cpBtn = createElement('button', '', { textContent: '複製密鑰' });
            cpBtn.style.cssText = lightBtn;
            cpBtn.onclick = () => keyBox.value ? copyText(keyBox.value, '已複製密鑰') : createToast('請先產生密鑰', 'error');
            keyRow.append(genBtn, cpBtn);
            card.append(keyBox, keyRow);
        }
        if (step.copy) {
            const row = createElement('div', '');
            step.copy.forEach(c => {
                const text = applyWorker(c.text, worker);
                const b = createElement('button', '', { textContent: `複製 ${c.label}` });
                b.style.cssText = lightBtn;
                b.onclick = () => copyText(text);
                row.appendChild(b);
            });
            card.appendChild(row);
        }
        main.appendChild(card);
    }

    const trouble = createElement('div', 'mx-4 mb-3 bg-white rounded-xl p-4');
    trouble.appendChild(createElement('div', 'font-semibold text-sm mb-2', { textContent: '🛠 常見問題' }));
    TROUBLESHOOTING.forEach(([q, a]) => {
        const item = createElement('div', 'text-xs text-gray-700');
        item.innerHTML = `<p style="margin:8px 0 2px;font-weight:600">${q}</p><p style="margin:0;line-height:1.6">${applyWorker(a, worker)}</p>`;
        trouble.appendChild(item);
    });
    main.appendChild(trouble);

    const security = createElement('div', 'mx-4 mb-3 rounded-xl p-4');
    security.style.background = '#FFF7ED';
    security.appendChild(createElement('div', 'font-semibold text-sm mb-2', { textContent: '🔒 安全提醒' }));
    security.innerHTML += SECURITY_NOTES.map(n => `<p style="margin:6px 0;font-size:12px;line-height:1.6;color:#7c4a03">${n}</p>`).join('');
    main.appendChild(security);

    container.appendChild(main);
    return { element: container, cleanup: null };
}

export default {
    id: 'discord-guide',
    name: 'Discord 部署教學',
    icon: 'help',
    routes: [{ path: '/settings/discord/guide', render: renderDiscordGuide }],
    navItem: null
};
