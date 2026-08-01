import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { TOOLS_CATALOG, CATEGORIES } from './tools-catalog.js';
import { generateZipContent } from './code-templates.js';

let selectedTools = new Set();

async function renderMCPMarket() {
    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: '神秘門',
        subtitle: 'MCP 工具市集',
        backPath: '/home'
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar');
    main.style.paddingTop = 'calc(env(safe-area-inset-top, 44px) + 44px + 8px)';
    main.style.paddingBottom = '24px';

    const introSection = createElement('div', 'mx-4 mb-4 p-4 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl text-white');
    introSection.innerHTML = `
        <h2 class="text-lg font-bold mb-1">歡迎來到神秘門</h2>
        <p class="text-sm opacity-90">選擇你需要的 MCP 工具，一鍵生成 Worker 程式碼，自己部署到 Cloudflare。</p>
    `;
    main.appendChild(introSection);

    const filterSection = createElement('div', 'px-4 mb-4');
    const filterScroll = createElement('div', 'flex gap-2 overflow-x-auto hide-scrollbar py-1');
    filterScroll.id = 'category-filters';

    const allBtn = createElement('button', 'mcp-filter-btn active');
    allBtn.textContent = '全部';
    allBtn.dataset.category = 'all';
    allBtn.onclick = () => filterByCategory('all', container);
    filterScroll.appendChild(allBtn);

    for (const cat of CATEGORIES) {
        const btn = createElement('button', 'mcp-filter-btn');
        btn.innerHTML = `<i class="material-icons-outlined text-sm mr-1">${cat.icon}</i>${cat.id}`;
        btn.dataset.category = cat.id;
        btn.onclick = () => filterByCategory(cat.id, container);
        filterScroll.appendChild(btn);
    }

    filterSection.appendChild(filterScroll);
    main.appendChild(filterSection);

    const searchSection = createElement('div', 'mx-4 mb-4');
    const searchInput = createElement('input', 'w-full p-3 bg-white rounded-xl border-none focus:ring-2 focus:ring-purple-500');
    searchInput.type = 'search';
    searchInput.placeholder = '搜尋工具...';
    searchInput.id = 'mcp-search';
    searchInput.oninput = () => searchTools(searchInput.value, container);
    searchSection.appendChild(searchInput);
    main.appendChild(searchSection);

    const toolsSection = createElement('div', 'mx-4 space-y-3');
    toolsSection.id = 'tools-list';
    renderToolsList(toolsSection, 'all');
    main.appendChild(toolsSection);

    container.appendChild(main);

    const bottomBar = createElement('div', 'sticky bottom-0 bg-white/95 backdrop-blur border-t p-4 -mx-4');
    bottomBar.id = 'mcp-bottom-bar';

    const selectedInfo = createElement('div', 'flex items-center justify-between');
    const countEl = createElement('span', 'text-sm text-gray-600');
    countEl.id = 'selected-count';
    countEl.textContent = '已選擇 0 個工具';
    selectedInfo.appendChild(countEl);

    const generateBtn = createElement('button', 'ios-btn ios-btn-primary');
    generateBtn.textContent = '生成程式碼';
    generateBtn.id = 'generate-btn';
    generateBtn.onclick = () => showGenerateDialog(container);
    selectedInfo.appendChild(generateBtn);

    bottomBar.appendChild(selectedInfo);
    container.appendChild(bottomBar);

    return { element: container, cleanup: null };
}

function renderToolsList(container, category, searchTerm = '') {
    container.innerHTML = '';

    let tools = TOOLS_CATALOG;

    if (category !== 'all') {
        tools = tools.filter(t => t.category === category);
    }

    if (searchTerm) {
        const term = searchTerm.toLowerCase();
        tools = tools.filter(t =>
            t.displayName.toLowerCase().includes(term) ||
            t.description.toLowerCase().includes(term) ||
            t.name.toLowerCase().includes(term)
        );
    }

    if (tools.length === 0) {
        const empty = createElement('div', 'text-center py-8 text-gray-500');
        empty.textContent = '沒有找到符合的工具';
        container.appendChild(empty);
        return;
    }

    const grouped = {};
    for (const tool of tools) {
        if (!grouped[tool.category]) grouped[tool.category] = [];
        grouped[tool.category].push(tool);
    }

    for (const [catName, catTools] of Object.entries(grouped)) {
        const cat = CATEGORIES.find(c => c.id === catName);

        const catHeader = createElement('div', 'flex items-center gap-2 mb-2 mt-4 first:mt-0');
        const catIcon = createElement('div', `w-6 h-6 rounded-full flex items-center justify-center`);
        catIcon.style.backgroundColor = cat?.color || '#888';
        catIcon.appendChild(createIcon(cat?.icon || 'help_outline', 'text-white text-sm'));
        catHeader.appendChild(catIcon);
        catHeader.appendChild(createElement('span', 'font-semibold', { textContent: catName }));
        container.appendChild(catHeader);

        for (const tool of catTools) {
            const card = createToolCard(tool);
            container.appendChild(card);
        }
    }
}

function createToolCard(tool) {
    const card = createElement('div', `mcp-tool-card ${selectedTools.has(tool.id) ? 'selected' : ''}`);
    card.id = `tool-${tool.id}`;

    const checkbox = createElement('div', `mcp-checkbox ${selectedTools.has(tool.id) ? 'checked' : ''}`);
    checkbox.onclick = (e) => {
        e.stopPropagation();
        toggleTool(tool.id);
    };
    card.appendChild(checkbox);

    const content = createElement('div', 'flex-1 min-w-0');
    content.onclick = () => showToolDetail(tool);

    const header = createElement('div', 'flex items-center gap-2');
    header.appendChild(createElement('span', 'font-medium', { textContent: tool.displayName }));
    const diffBadge = createElement('span', `mcp-badge ${tool.difficulty}`);
    diffBadge.textContent = tool.difficulty === 'easy' ? '簡單' : tool.difficulty === 'medium' ? '中等' : '進階';
    header.appendChild(diffBadge);
    content.appendChild(header);

    content.appendChild(createElement('p', 'text-sm text-gray-600 mt-1 line-clamp-2', { textContent: tool.description }));

    const useCase = createElement('p', 'text-xs text-purple-600 mt-1 italic');
    useCase.textContent = tool.useCase;
    content.appendChild(useCase);

    card.appendChild(content);

    return card;
}

function toggleTool(toolId) {
    if (selectedTools.has(toolId)) {
        selectedTools.delete(toolId);
    } else {
        selectedTools.add(toolId);
    }

    updateSelectedCount();

    const card = document.getElementById(`tool-${toolId}`);
    if (card) {
        card.classList.toggle('selected', selectedTools.has(toolId));
        const checkbox = card.querySelector('.mcp-checkbox');
        if (checkbox) {
            checkbox.classList.toggle('checked', selectedTools.has(toolId));
        }
    }
}

function updateSelectedCount() {
    const countEl = document.getElementById('selected-count');
    if (countEl) {
        countEl.textContent = `已選擇 ${selectedTools.size} 個工具`;
    }
}

function filterByCategory(category, container) {
    const buttons = container.querySelectorAll('.mcp-filter-btn');
    buttons.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.category === category);
    });

    const listEl = container.querySelector('#tools-list');
    if (listEl) {
        renderToolsList(listEl, category);
    }
}

function searchTools(term, container) {
    const activeFilter = container.querySelector('.mcp-filter-btn.active');
    const category = activeFilter?.dataset.category || 'all';

    const listEl = container.querySelector('#tools-list');
    if (listEl) {
        renderToolsList(listEl, category, term);
    }
}

function showToolDetail(tool) {
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
    const sheet = createElement('div', 'bg-ios-bg w-full rounded-t-2xl max-h-[80vh] overflow-y-auto');

    const header = createElement('div', 'sticky top-0 bg-ios-bg p-4 border-b flex items-center justify-between');
    header.appendChild(createElement('h2', 'text-lg font-bold', { textContent: tool.displayName }));
    const closeBtn = createElement('button', 'text-gray-500');
    closeBtn.appendChild(createIcon('close'));
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    const content = createElement('div', 'p-4 space-y-4');

    const info = createElement('div', 'grid grid-cols-2 gap-2 text-sm');
    info.innerHTML = `
        <div class="bg-gray-100 p-2 rounded">
            <span class="text-gray-500">工具名稱</span>
            <div class="font-mono text-purple-600">${tool.name}</div>
        </div>
        <div class="bg-gray-100 p-2 rounded">
            <span class="text-gray-500">難度</span>
            <div>${tool.difficulty === 'easy' ? '簡單' : tool.difficulty === 'medium' ? '中等' : '進階'}</div>
        </div>
    `;
    content.appendChild(info);

    const desc = createElement('div');
    desc.appendChild(createElement('h3', 'font-semibold mb-1', { textContent: '說明' }));
    desc.appendChild(createElement('p', 'text-sm text-gray-600', { textContent: tool.description }));
    content.appendChild(desc);

    const useCase = createElement('div');
    useCase.appendChild(createElement('h3', 'font-semibold mb-1', { textContent: '使用範例' }));
    useCase.appendChild(createElement('p', 'text-sm text-purple-600 italic', { textContent: tool.useCase }));
    content.appendChild(useCase);

    if (tool.requires && tool.requires.length > 0) {
        const req = createElement('div');
        req.appendChild(createElement('h3', 'font-semibold mb-1', { textContent: '需求' }));
        const reqList = createElement('ul', 'text-sm text-gray-600 list-disc list-inside');
        for (const r of tool.requires) {
            reqList.appendChild(createElement('li', '', { textContent: r }));
        }
        req.appendChild(reqList);
        content.appendChild(req);
    }

    const params = createElement('div');
    params.appendChild(createElement('h3', 'font-semibold mb-1', { textContent: '參數' }));
    const paramsCode = createElement('pre', 'text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto');
    paramsCode.textContent = JSON.stringify(tool.parameters, null, 2);
    params.appendChild(paramsCode);
    content.appendChild(params);

    const addBtn = createElement('button', 'ios-btn ios-btn-primary w-full mt-4');
    addBtn.textContent = selectedTools.has(tool.id) ? '已選擇' : '加入選擇';
    addBtn.onclick = () => {
        toggleTool(tool.id);
        addBtn.textContent = selectedTools.has(tool.id) ? '已選擇' : '加入選擇';
    };
    content.appendChild(addBtn);

    sheet.appendChild(content);
    overlay.appendChild(sheet);
    document.querySelector('.app-container').appendChild(overlay);
}

function showGenerateDialog(container) {
    if (selectedTools.size === 0) {
        createToast('請先選擇至少一個工具', 'error');
        return;
    }

    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
    const sheet = createElement('div', 'bg-ios-bg w-full rounded-t-2xl max-h-[90vh] overflow-y-auto');

    const header = createElement('div', 'sticky top-0 bg-ios-bg p-4 border-b flex items-center justify-between z-10');
    header.appendChild(createElement('h2', 'text-lg font-bold', { textContent: '生成 Worker 程式碼' }));
    const closeBtn = createElement('button', 'text-gray-500');
    closeBtn.appendChild(createIcon('close'));
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    sheet.appendChild(header);

    const content = createElement('div', 'p-4 space-y-4');

    const summary = createElement('div', 'bg-purple-50 p-3 rounded-lg');
    summary.innerHTML = `
        <p class="text-sm text-purple-800 font-medium">已選擇 ${selectedTools.size} 個工具</p>
        <p class="text-xs text-purple-600 mt-1">${Array.from(selectedTools).map(id => {
            const tool = TOOLS_CATALOG.find(t => t.id === id);
            return tool?.displayName;
        }).join('、')}</p>
    `;
    content.appendChild(summary);

    const files = generateZipContent(Array.from(selectedTools));

    for (const [filename, code] of Object.entries(files)) {
        const fileSection = createElement('div');
        fileSection.appendChild(createElement('h3', 'font-semibold mb-2', { textContent: filename }));

        const codeBlock = createElement('pre', 'text-xs bg-gray-900 text-green-400 p-3 rounded overflow-x-auto max-h-48');
        codeBlock.textContent = code;
        fileSection.appendChild(codeBlock);

        const copyBtn = createElement('button', 'text-xs text-purple-600 mt-1');
        copyBtn.textContent = '複製程式碼';
        copyBtn.onclick = () => {
            navigator.clipboard.writeText(code);
            createToast('已複製到剪貼簿', 'success');
        };
        fileSection.appendChild(copyBtn);

        content.appendChild(fileSection);
    }

    const downloadBtn = createElement('button', 'ios-btn ios-btn-primary w-full mt-4');
    downloadBtn.textContent = '下載所有檔案';
    downloadBtn.onclick = () => downloadAllFiles(files);
    content.appendChild(downloadBtn);

    const guideSection = createElement('div', 'bg-blue-50 p-3 rounded-lg mt-4');
    guideSection.innerHTML = `
        <h3 class="font-semibold text-blue-800 mb-2">部署步驟</h3>
        <ol class="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>解壓縮下載的 ZIP 檔</li>
            <li>在終端機切換到該目錄：<code class="bg-blue-100 px-1">cd siios-mcp-worker</code></li>
            <li>安裝依賴：<code class="bg-blue-100 px-1">npm install</code></li>
            <li>登入 Cloudflare：<code class="bg-blue-100 px-1">wrangler login</code></li>
            <li>部署：<code class="bg-blue-100 px-1">wrangler deploy</code></li>
        </ol>
    `;
    content.appendChild(guideSection);

    sheet.appendChild(content);
    overlay.appendChild(sheet);
    document.querySelector('.app-container').appendChild(overlay);
}

function downloadAllFiles(files) {
    import('https://cdn.jsdelivr.net/npm/jszip@3/+esm').then(async (JSZip) => {
        const zip = new JSZip.default();

        for (const [filename, content] of Object.entries(files)) {
            zip.file(filename, content);
        }

        const blob = await zip.generateAsync({ type: 'blob' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'siios-mcp-worker.zip';
        a.click();

        URL.revokeObjectURL(url);
        createToast('已下載 ZIP 檔案', 'success');
    });
}

export default {
    id: 'mcp-market',
    name: '神秘門',
    icon: 'door_front',
    routes: [
        { path: '/mcp-market', render: renderMCPMarket }
    ],
    navItem: {
        label: '神秘門',
        icon: 'door_front',
        path: '/mcp-market',
        showInNav: true,
        order: 2
    },
    stylesPath: 'js/apps/mcp-market/style.css'
};