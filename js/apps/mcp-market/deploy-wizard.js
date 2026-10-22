// 神秘門的「三步驟上線」：給不會寫程式的人。
//   1. 拿到程式碼（下載 worker.js 或一鍵複製）
//   2. 貼到 Cloudflare 網頁（全程在網頁上點，不用終端機），並設定自動產生的存取金鑰
//   3. 貼上 Worker 網址 → 測試並自動加入 MCP 設定
// 需要打包的工具組合（例如紫微斗數有額外的引擎檔）貼不進網頁編輯器，這時只提供 ZIP + 指令部署。
import { createElement, createToast } from '../../components.js';
import { MCPConfigDB } from '../../db.js';
import { MCPClient } from '../../core/mcp-client.js';

const CLOUDFLARE_URL = 'https://dash.cloudflare.com/?to=/:account/workers-and-pages/create';
import { needsBundle, generateKey, normalizeWorkerUrl, explainConnectError } from './deploy-helpers.js';

function download(name, text, type = 'text/javascript') {
    const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy(text) {
    try { await navigator.clipboard.writeText(text); createToast('已複製', 'success'); }
    catch (_) { createToast('這個瀏覽器不能自動複製，請改用下載', 'error'); }
}

function step(n, title) {
    const box = createElement('div', 'mcpw-step');
    const head = createElement('div', 'mcpw-step-head');
    head.append(createElement('span', 'mcpw-num', { textContent: String(n) }), createElement('strong', '', { textContent: title }));
    box.appendChild(head);
    return box;
}

const btn = (text, cls, fn) => { const b = createElement('button', 'mcpw-btn ' + cls, { textContent: text }); b.onclick = fn; return b; };
const list = items => { const ol = createElement('ol', 'mcpw-list'); items.forEach(t => { const li = createElement('li'); li.innerHTML = t; ol.appendChild(li); }); return ol; };

// files：generateZipContent 的結果；toolNames：顯示用；requires：需要額外金鑰的工具說明
export function openDeployWizard({ files, toolNames = [], requires = [], parent, downloadZip, onDone }) {
    const bundle = needsBundle(files);
    let key = generateKey();
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
    const sheet = createElement('div', 'mcpw-sheet');
    const header = createElement('div', 'mcpw-header');
    header.append(createElement('h2', '', { textContent: '三步驟上線' }));
    const close = createElement('button', 'mcpw-close', { textContent: '✕', title: '關閉' });
    close.onclick = () => overlay.remove();
    header.appendChild(close);
    sheet.appendChild(header);

    const body = createElement('div', 'mcpw-body');
    body.appendChild(createElement('p', 'mcpw-lead', { textContent: `已選 ${toolNames.length} 個工具：${toolNames.join('、')}。免費、全程在網頁上操作，不用安裝任何東西。` }));

    // ── 步驟 1 ──
    const s1 = step(1, '拿到程式碼');
    if (!bundle) {
        const row = createElement('div', 'mcpw-row');
        row.append(btn('下載 worker.js', 'primary', () => download('worker.js', files['src/index.js'])), btn('複製程式碼', '', () => copy(files['src/index.js'])));
        s1.appendChild(row);
        s1.appendChild(createElement('p', 'mcpw-hint', { textContent: '下載或複製都可以，下一步要貼到 Cloudflare。' }));
    } else {
        s1.appendChild(createElement('p', 'mcpw-warn', { textContent: '你選的工具包含額外的程式檔，沒辦法直接貼進網頁編輯器。請下載 ZIP，用下面「進階」的指令部署（只要在電腦上做一次）。' }));
        s1.appendChild(btn('下載 ZIP', 'primary', () => downloadZip?.()));
    }
    body.appendChild(s1);

    // ── 步驟 2 ──
    const s2 = step(2, bundle ? '用指令部署（進階）' : '貼到 Cloudflare');
    if (!bundle) {
        s2.appendChild(btn('開啟 Cloudflare（免費註冊／登入）', 'primary', () => window.open(CLOUDFLARE_URL, '_blank', 'noopener')));
        s2.appendChild(list([
            '登入後選 <b>建立應用程式（Create application）</b> → <b>Workers</b>，選 <b>Hello World</b>。',
            '名稱隨便取（例如 <code>siios-mcp</code>），按 <b>部署（Deploy）</b>。',
            '部署完按 <b>編輯程式碼（Edit code）</b>：左邊的檔案<b>全選、刪掉</b>，貼上步驟 1 的程式碼，再按右上角 <b>部署</b>。',
            '回到這個 Worker 的頁面：<b>設定（Settings）</b> → <b>變數和密碼（Variables and Secrets）</b> → <b>新增</b>，類型選 <b>密碼（Secret）</b>，名稱填 <code>MCP_API_KEY</code>，值貼上下面的金鑰，按部署。'
        ]));
        const keyBox = createElement('div', 'mcpw-key');
        const keyText = createElement('code', '', { textContent: key });
        keyBox.append(keyText, btn('複製金鑰', '', () => copy(key)), btn('重新產生', '', () => { key = generateKey(); keyText.textContent = key; }));
        s2.appendChild(keyBox);
        s2.appendChild(createElement('p', 'mcpw-hint', { textContent: '這組金鑰就是工具的「密碼」：只有知道它的人（你的 App）才能呼叫你的工具。' }));
        if (requires.length) s2.appendChild(createElement('p', 'mcpw-warn', { textContent: '另外這些工具需要自己的金鑰，用同樣方式新增（名稱照括號裡的）：' + requires.join('；') }));
    } else {
        s2.appendChild(list([
            '解壓縮 ZIP，在該資料夾開啟終端機，執行 <code>npm install</code>',
            '<code>npx wrangler login</code>（會開瀏覽器登入 Cloudflare）',
            '<code>npx wrangler secret put MCP_API_KEY</code>，貼上下面的金鑰',
            '<code>npx wrangler deploy</code>'
        ]));
        const keyBox = createElement('div', 'mcpw-key');
        const keyText = createElement('code', '', { textContent: key });
        keyBox.append(keyText, btn('複製金鑰', '', () => copy(key)));
        s2.appendChild(keyBox);
    }
    body.appendChild(s2);

    // ── 步驟 3 ──
    const s3 = step(3, '貼上網址，自動加入');
    s3.appendChild(createElement('p', 'mcpw-hint', { textContent: '部署完成後，Cloudflare 會顯示一個網址（結尾是 .workers.dev），貼在這裡：' }));
    const urlInput = createElement('input', 'mcpw-input', { type: 'url', placeholder: 'https://siios-mcp.你的帳號.workers.dev' });
    const nameInput = createElement('input', 'mcpw-input', { type: 'text', value: 'MCP 工具', placeholder: '名稱' });
    const result = createElement('div', 'mcpw-result');
    const add = btn('測試並加入', 'primary', async () => {
        const endpoint = normalizeWorkerUrl(urlInput.value);
        if (!endpoint) { result.className = 'mcpw-result err'; result.textContent = '請貼上 Worker 的網址（例如 https://xxx.workers.dev）'; return; }
        add.disabled = true; add.textContent = '連線中…'; result.className = 'mcpw-result'; result.textContent = '';
        try {
            const client = new MCPClient({ endpoint, apiKey: key });
            const r = await client.testConnection();
            if (!r.success) { result.className = 'mcpw-result err'; result.textContent = explainConnectError(r.error); return; }
            const cfg = await MCPConfigDB.create({ name: nameInput.value.trim() || 'MCP 工具', endpoint, apiKey: key, bound_character_id: null });
            await MCPConfigDB.update(cfg.id, { tools: r.tools, status: 'connected', lastChecked: Date.now() });
            result.className = 'mcpw-result ok';
            result.textContent = `完成！已連線，找到 ${r.toolCount} 個工具。角色現在可以使用它們了。`;
            createToast('已加入 MCP 設定', 'success');
            onDone?.(cfg);
            add.textContent = '已加入';
            return;
        } catch (e) {
            result.className = 'mcpw-result err'; result.textContent = explainConnectError(e?.message);
        } finally {
            if (add.textContent === '連線中…') { add.disabled = false; add.textContent = '測試並加入'; }
        }
    });
    s3.append(urlInput, nameInput, add, result);
    body.appendChild(s3);

    if (!bundle && downloadZip) {
        const adv = createElement('details', 'mcpw-adv');
        adv.appendChild(createElement('summary', '', { textContent: '進階：用指令部署（會用終端機的人）' }));
        adv.appendChild(createElement('p', 'mcpw-hint', { textContent: '下載 ZIP → 解壓縮 → npm install → npx wrangler login → npx wrangler secret put MCP_API_KEY → npx wrangler deploy。ZIP 裡的 README.md 有完整說明。' }));
        adv.appendChild(btn('下載 ZIP', '', () => downloadZip()));
        body.appendChild(adv);
    }

    sheet.appendChild(body);
    overlay.appendChild(sheet);
    (parent || document.body).appendChild(overlay);
    return overlay;
}
