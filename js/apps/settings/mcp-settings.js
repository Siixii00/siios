import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast, createKakaoBottomSheet } from '../../components.js';
import { MCPConfigDB, CharactersDB } from '../../db.js';
import { MCPClient } from '../../core/mcp-client.js';

async function renderMCPSettings() {
    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: 'MCP 工具整合',
        backPath: '/settings'
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-8');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';

    const infoSection = createElement('div', 'ios-grouped-list mx-4');
    const infoCard = createElement('div', 'p-4 bg-white rounded-xl');
    infoCard.innerHTML = `
        <h3 class='font-semibold mb-2'>什麼是 MCP 工具整合？</h3>
        <p class='text-sm text-ios-muted mb-3'>
            MCP 讓 AI 角色可以調用外部工具，例如購物、查天氣、控制智慧家居等。
            你需要自己架設 Cloudflare Worker 來提供這些工具。
        </p>
        <a class='text-blue-500 text-sm' href='#' id='mcp-guide-link'>
            查看架設教學 →
        </a>
    `;
    infoSection.appendChild(infoCard);
    main.appendChild(infoSection);

    const configs = await MCPConfigDB.getAll();

    const listSection = createElement('div', 'ios-grouped-list mx-4 mt-4');
    listSection.id = 'mcp-config-list';

    if (configs.length === 0) {
        const empty = createElement('div', 'p-4 text-center text-ios-muted');
        empty.textContent = '尚未設定任何 MCP 伺服器';
        listSection.appendChild(empty);
    } else {
        for (const config of configs) {
            const cell = createConfigCell(config);
            listSection.appendChild(cell);
        }
    }
    main.appendChild(listSection);

    const addBtn = createElement('button', 'ios-btn ios-btn-primary mx-4 mt-4');
    addBtn.textContent = '+ 新增 MCP 伺服器';
    addBtn.onclick = () => showAddDialog(container);
    main.appendChild(addBtn);

    const refreshBtn = createElement('button', 'ios-btn ios-btn-secondary mx-4 mt-2');
    refreshBtn.textContent = '重新整理工具清單';
    refreshBtn.onclick = async () => {
        createToast('正在檢查所有 MCP 伺服器...', 'info');
        const results = await refreshAllTools(container);
        const successCount = results.filter(r => r.success).length;
        createToast(`已完成：${successCount}/${results.length} 個伺服器連線成功`, 'success');
    };
    main.appendChild(refreshBtn);

    container.appendChild(main);

    setTimeout(() => {
        const guideLink = document.getElementById('mcp-guide-link');
        if (guideLink) {
            guideLink.onclick = (e) => {
                e.preventDefault();
                showGuideSheet();
            };
        }
    }, 100);

    return { element: container, cleanup: null };
}

function createConfigCell(config) {
    const cell = createElement('div', 'ios-list-cell cursor-pointer');

    const statusColor = config.status === 'connected' ? 'bg-green-500' :
                       config.status === 'error' ? 'bg-red-500' : 'bg-gray-400';

    const badge = createElement('div', `ios-icon-badge ${statusColor}`);
    badge.appendChild(createIcon('extension', 'text-white text-sm'));
    cell.appendChild(badge);

    const content = createElement('div', 'flex-1 min-w-0');
    content.appendChild(createElement('span', 'text-body-lg font-medium', { textContent: config.name || '未命名' }));

    const toolCount = config.tools?.length || 0;
    const statusText = config.status === 'connected' ? `${toolCount} 個工具` :
                       config.status === 'error' ? '連線失敗' : '尚未檢查';
    content.appendChild(createElement('span', 'block text-sm text-ios-muted truncate', { textContent: statusText }));
    cell.appendChild(content);

    const toggle = createElement('button', 'relative w-12 h-7 rounded-full transition-colors');
    toggle.className = config.enabled ? 'bg-green-500' : 'bg-gray-300';
    const toggleKnob = createElement('div', 'absolute top-1 w-5 h-5 bg-white rounded-full shadow transition-transform');
    toggleKnob.style.transform = config.enabled ? 'translateX(24px)' : 'translateX(4px)';
    toggle.appendChild(toggleKnob);

    toggle.onclick = async (e) => {
        e.stopPropagation();
        const updated = await MCPConfigDB.toggle(config.id);
        toggle.className = updated.enabled ? 'bg-green-500' : 'bg-gray-300';
        toggleKnob.style.transform = updated.enabled ? 'translateX(24px)' : 'translateX(4px)';
        createToast(updated.enabled ? '已啟用' : '已停用', 'success');
    };
    cell.appendChild(toggle);

    cell.onclick = () => showEditDialog(config);

    return cell;
}

function showAddDialog(container) {
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
    const sheet = createElement('div', 'bg-ios-bg w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto');

    const header = createElement('div', 'flex items-center justify-between mb-4');
    header.appendChild(createElement('h2', 'text-lg font-semibold', { textContent: '新增 MCP 伺服器' }));
    const closeBtn = createElement('button', 'text-ios-muted');
    closeBtn.appendChild(createIcon('close'));
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    const form = createElement('div', 'space-y-4');

    const nameGroup = createElement('div');
    nameGroup.appendChild(createElement('label', 'text-sm font-medium', { textContent: '名稱' }));
    const nameInput = createElement('input', 'w-full mt-1 p-3 border rounded-lg text-base');
    nameInput.type = 'text';
    nameInput.placeholder = '例如：購物工具';
    nameGroup.appendChild(nameInput);
    form.appendChild(nameGroup);

    const charGroup = createElement('div');
    charGroup.appendChild(createElement('label', 'text-sm font-medium', { textContent: '綁定角色（選填）' }));
    const charSelect = createElement('select', 'w-full mt-1 p-3 border rounded-lg text-base');
    const defaultOption = createElement('option', '', { value: '', textContent: '不綁定（所有角色可用）' });
    charSelect.appendChild(defaultOption);
    CharactersDB.getAll().then(characters => {
        characters.forEach(char => {
            const option = createElement('option', '', { value: char.id, textContent: char.name || '未命名' });
            charSelect.appendChild(option);
        });
    });
    charGroup.appendChild(charSelect);
    form.appendChild(charGroup);

    const urlGroup = createElement('div');
    urlGroup.appendChild(createElement('label', 'text-sm font-medium', { textContent: 'Worker URL' }));
    const urlInput = createElement('input', 'w-full mt-1 p-3 border rounded-lg text-base');
    urlInput.type = 'url';
    urlInput.placeholder = 'https://your-worker.workers.dev';
    form.appendChild(urlGroup);
    urlGroup.appendChild(urlInput);

    const keyGroup = createElement('div');
    keyGroup.appendChild(createElement('label', 'text-sm font-medium', { textContent: 'API Key（選填）' }));
    const keyInput = createElement('input', 'w-full mt-1 p-3 border rounded-lg text-base');
    keyInput.type = 'password';
    keyInput.placeholder = '如果 Worker 需要認證';
    form.appendChild(keyGroup);
    keyGroup.appendChild(keyInput);

    sheet.appendChild(form);

    const testBtn = createElement('button', 'ios-btn ios-btn-secondary w-full mt-4');
    testBtn.textContent = '測試連線';
    testBtn.onclick = async () => {
        const client = new MCPClient({
            endpoint: urlInput.value,
            apiKey: keyInput.value
        });
        const result = await client.testConnection();
        if (result.success) {
            createToast(`連線成功，找到 ${result.toolCount} 個工具`, 'success');
        } else {
            createToast(`連線失敗：${result.error}`, 'error');
        }
    };
    sheet.appendChild(testBtn);

    const saveBtn = createElement('button', 'ios-btn ios-btn-primary w-full mt-2');
    saveBtn.textContent = '儲存';
    saveBtn.onclick = async () => {
        if (!urlInput.value) {
            createToast('請輸入 Worker URL', 'error');
            return;
        }

        const config = await MCPConfigDB.create({
            name: nameInput.value || 'MCP Server',
            endpoint: urlInput.value,
            apiKey: keyInput.value,
            bound_character_id: charSelect.value || null
        });

        const client = new MCPClient(config);
        const result = await client.testConnection();

        if (result.success) {
            await MCPConfigDB.update(config.id, {
                tools: result.tools,
                status: 'connected',
                lastChecked: Date.now()
            });
            createToast('已儲存並連線成功', 'success');
        } else {
            await MCPConfigDB.update(config.id, {
                status: 'error',
                lastChecked: Date.now()
            });
            createToast('已儲存，但連線失敗', 'warning');
        }

        overlay.remove();
        refreshList(container);
    };
    sheet.appendChild(saveBtn);

    overlay.appendChild(sheet);
    container.appendChild(overlay);
}

async function showEditDialog(config) {
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
    const sheet = createElement('div', 'bg-ios-bg w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto');

    const header = createElement('div', 'flex items-center justify-between mb-4');
    header.appendChild(createElement('h2', 'text-lg font-semibold', { textContent: '編輯 MCP 伺服器' }));
    const closeBtn = createElement('button', 'text-ios-muted');
    closeBtn.appendChild(createIcon('close'));
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    const form = createElement('div', 'space-y-4');

    const nameGroup = createElement('div');
    nameGroup.appendChild(createElement('label', 'text-sm font-medium', { textContent: '名稱' }));
    const nameInput = createElement('input', 'w-full mt-1 p-3 border rounded-lg text-base');
    nameInput.type = 'text';
    nameInput.value = config.name || '';
    nameGroup.appendChild(nameInput);
    form.appendChild(nameGroup);

    const charGroup = createElement('div');
    charGroup.appendChild(createElement('label', 'text-sm font-medium', { textContent: '綁定角色（選填）' }));
    const charSelect = createElement('select', 'w-full mt-1 p-3 border rounded-lg text-base');
    const defaultOption = createElement('option', '', { value: '', textContent: '不綁定（所有角色可用）' });
    if (!config.bound_character_id) defaultOption.selected = true;
    charSelect.appendChild(defaultOption);
    
    const characters = await CharactersDB.getAll();
    characters.forEach(char => {
        const option = createElement('option', '', { value: char.id, textContent: char.name || '未命名' });
        if (config.bound_character_id === char.id) option.selected = true;
        charSelect.appendChild(option);
    });
    charGroup.appendChild(charSelect);
    form.appendChild(charGroup);

    const urlGroup = createElement('div');
    urlGroup.appendChild(createElement('label', 'text-sm font-medium', { textContent: 'Worker URL' }));
    const urlInput = createElement('input', 'w-full mt-1 p-3 border rounded-lg text-base');
    urlInput.type = 'url';
    urlInput.value = config.endpoint || '';
    form.appendChild(urlGroup);
    urlGroup.appendChild(urlInput);

    const keyGroup = createElement('div');
    keyGroup.appendChild(createElement('label', 'text-sm font-medium', { textContent: 'API Key（選填）' }));
    const keyInput = createElement('input', 'w-full mt-1 p-3 border rounded-lg text-base');
    keyInput.type = 'password';
    keyInput.value = config.apiKey || '';
    form.appendChild(keyGroup);
    keyGroup.appendChild(keyInput);

    if (config.tools && config.tools.length > 0) {
        const toolsGroup = createElement('div', 'mt-4');
        toolsGroup.appendChild(createElement('label', 'text-sm font-medium', { textContent: `可用工具（${config.tools.length}）` }));
        const toolsList = createElement('div', 'mt-2 space-y-1');
        for (const tool of config.tools) {
            const toolItem = createElement('div', 'text-sm p-2 bg-gray-100 rounded');
            toolItem.textContent = `${tool.name}: ${tool.description || '無描述'}`;
            toolsList.appendChild(toolItem);
        }
        toolsGroup.appendChild(toolsList);
        form.appendChild(toolsGroup);
    }

    sheet.appendChild(form);

    const actions = createElement('div', 'flex gap-2 mt-4');
    const deleteBtn = createElement('button', 'ios-btn bg-red-500 text-white flex-1');
    deleteBtn.textContent = '刪除';
    deleteBtn.onclick = async () => {
        await MCPConfigDB.delete(config.id);
        createToast('已刪除', 'success');
        overlay.remove();
        refreshList(document.querySelector('.app-container'));
    };
    actions.appendChild(deleteBtn);

    const saveBtn = createElement('button', 'ios-btn ios-btn-primary flex-1');
    saveBtn.textContent = '儲存';
    saveBtn.onclick = async () => {
        await MCPConfigDB.update(config.id, {
            name: nameInput.value,
            endpoint: urlInput.value,
            apiKey: keyInput.value,
            bound_character_id: charSelect.value || null
        });
        createToast('已儲存', 'success');
        overlay.remove();
        refreshList(document.querySelector('.app-container'));
    };
    actions.appendChild(saveBtn);
    sheet.appendChild(actions);

    overlay.appendChild(sheet);
    document.querySelector('.app-container').appendChild(overlay);
}

async function refreshList(container) {
    const listSection = container.querySelector('#mcp-config-list');
    if (!listSection) return;

    listSection.innerHTML = '';
    const configs = await MCPConfigDB.getAll();

    if (configs.length === 0) {
        const empty = createElement('div', 'p-4 text-center text-ios-muted');
        empty.textContent = '尚未設定任何 MCP 伺服器';
        listSection.appendChild(empty);
    } else {
        for (const config of configs) {
            const cell = createConfigCell(config);
            listSection.appendChild(cell);
        }
    }
}

async function refreshAllTools(container) {
    const configs = await MCPConfigDB.getAll();
    const results = [];

    for (const config of configs) {
        const client = new MCPClient(config);
        const testResult = await client.testConnection();

        if (testResult.success) {
            await MCPConfigDB.update(config.id, {
                tools: testResult.tools,
                status: 'connected',
                lastChecked: Date.now()
            });
            results.push({ id: config.id, success: true, toolCount: testResult.tools.length });
        } else {
            await MCPConfigDB.update(config.id, {
                status: 'error',
                lastChecked: Date.now()
            });
            results.push({ id: config.id, success: false, error: testResult.error });
        }
    }

    refreshList(container);
    return results;
}

function showGuideSheet() {
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
    const sheet = createElement('div', 'bg-ios-bg w-full rounded-t-2xl p-4 max-h-[80vh] overflow-y-auto');

    const header = createElement('div', 'flex items-center justify-between mb-4');
    header.appendChild(createElement('h2', 'text-lg font-semibold', { textContent: 'MCP Worker 架設教學' }));
    const closeBtn = createElement('button', 'text-ios-muted');
    closeBtn.appendChild(createIcon('close'));
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    const content = createElement('div', 'text-sm space-y-4');
    content.innerHTML = `
        <div class='p-3 bg-blue-50 rounded-lg'>
            <p class='font-medium text-blue-800'>快速開始</p>
            <p class='text-ios-muted mt-1'>複製 Worker 範本到你的 Cloudflare 帳戶</p>
        </div>

        <div class='space-y-2'>
            <p class='font-medium'>第一步：準備環境</p>
            <code class='block p-2 bg-gray-100 rounded text-xs'>npm install -g wrangler</code>
        </div>

        <div class='space-y-2'>
            <p class='font-medium'>第二步：建立 Worker</p>
            <p class='text-ios-muted'>在專案根目錄建立 <code>mcp-worker/</code> 資料夾</p>
        </div>

        <div class='space-y-2'>
            <p class='font-medium'>第三步：部署</p>
            <code class='block p-2 bg-gray-100 rounded text-xs'>wrangler deploy</code>
        </div>

        <div class='space-y-2'>
            <p class='font-medium'>第四步：設定</p>
            <p class='text-ios-muted'>將 Worker URL 填入上方的新增表單</p>
        </div>

        <div class='mt-4 p-3 bg-yellow-50 rounded-lg'>
            <p class='text-yellow-800'>詳細範本程式碼請參考：</p>
            <code class='text-xs'>docs/MCP_WORKER_TEMPLATE.md</code>
        </div>
    `;
    sheet.appendChild(content);

    const closeBottomBtn = createElement('button', 'ios-btn ios-btn-primary w-full mt-4');
    closeBottomBtn.textContent = '關閉';
    closeBottomBtn.onclick = () => overlay.remove();
    sheet.appendChild(closeBottomBtn);

    overlay.appendChild(sheet);
    document.querySelector('.app-container').appendChild(overlay);
}

export default {
    id: 'mcp-settings',
    name: 'MCP 設定',
    icon: 'extension',
    routes: [
        { path: '/settings/mcp', render: renderMCPSettings }
    ],
    stylesPath: 'js/apps/settings/style.css'
};