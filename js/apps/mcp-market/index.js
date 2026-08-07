import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { TOOLS_CATALOG, CATEGORIES } from './tools-catalog.js';
import { generateZipContent } from './code-templates.js';
import { initDB } from '../../db.js';

let selectedTools = new Set();
const CUSTOM_TOOLS_STORE = 'customMCPTools';

async function getCustomTools() {
    try {
        const database = await initDB();
        if (!database.objectStoreNames.contains(CUSTOM_TOOLS_STORE)) {
            return [];
        }
        return await database.getAll(CUSTOM_TOOLS_STORE);
    } catch (e) {
        console.warn('[MCP] 無法讀取自定義工具:', e);
        return [];
    }
}

async function saveCustomTool(tool) {
    try {
        const database = await initDB();
        await database.put(CUSTOM_TOOLS_STORE, tool);
        return true;
    } catch (e) {
        console.error('[MCP] 儲存自定義工具失敗:', e);
        return false;
    }
}

async function deleteCustomToolFromDB(toolId) {
    try {
        const database = await initDB();
        await database.delete(CUSTOM_TOOLS_STORE, toolId);
        return true;
    } catch (e) {
        console.error('[MCP] 刪除自定義工具失敗:', e);
        return false;
    }
}

async function ensureCustomToolsStore() {
    try {
        const database = await initDB();
        if (!database.objectStoreNames.contains(CUSTOM_TOOLS_STORE)) {
            console.log('[MCP] 創建自定義工具存儲');
        }
    } catch (e) {
        console.error('[MCP] 檢查存儲失敗:', e);
    }
}

function isMobileDevice() {
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isSmallScreen = window.innerWidth < 768;
    return isMobileUA || isSmallScreen;
}

async function renderMCPMarket() {
    const container = createElement('div', 'app-container bg-ios-bg');

    const header = createIOSNavBar({
        title: '神秘門',
        subtitle: 'MCP 工具市集',
        backPath: '/home'
    });
    container.appendChild(header);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar');
    main.style.paddingTop = 'calc(env(safe-area-inset-top, 44px) + 44px + 16px)';
    main.style.paddingBottom = '24px';

    const introSection = createElement('div', 'mx-4 mb-6 bg-white rounded-lg shadow-sm overflow-hidden');
    
    const introHeader = createElement('div', 'px-4 py-3 border-b border-gray-100');
    introHeader.innerHTML = `
        <h2 class='text-lg font-semibold text-gray-900'>MCP 工具簡介說明</h2>
    `;
    introSection.appendChild(introHeader);
    
    const introContent = createElement('div', 'px-4 py-4 space-y-4');
    
    // MCP 簡介
    const mcpIntro = createElement('div', '');
    mcpIntro.innerHTML = `
        <h3 class='text-sm font-medium text-gray-900 mb-2'>什麼是 MCP？</h3>
        <p class='text-xs text-gray-600 leading-relaxed'>
            MCP (Model Context Protocol) 是一個開放協議，讓 AI 模型能夠安全地調用外部工具和服務。
            通過 MCP，你的 AI 角色可以執行實際動作，如查詢天氣、設置提醒、控制智慧家居等。
        </p>
    `;
    introContent.appendChild(mcpIntro);
    
    // 架設說明
    const setupGuide = createElement('div', '');
    setupGuide.innerHTML = `
        <h3 class='text-sm font-medium text-gray-900 mb-2'>如何架設 MCP 伺服器？</h3>
        <div class='space-y-2'>
            <div class='flex items-start gap-2'>
                <div class='flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center'>
                    <span class='text-xs font-medium text-gray-600'>1</span>
                </div>
                <p class='text-xs text-gray-600 flex-1'>選擇需要的工具，點擊「生成程式碼」</p>
            </div>
            <div class='flex items-start gap-2'>
                <div class='flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center'>
                    <span class='text-xs font-medium text-gray-600'>2</span>
                </div>
                <p class='text-xs text-gray-600 flex-1'>下載生成的 Worker 程式碼</p>
            </div>
            <div class='flex items-start gap-2'>
                <div class='flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center'>
                    <span class='text-xs font-medium text-gray-600'>3</span>
                </div>
                <p class='text-xs text-gray-600 flex-1'>部署到 Cloudflare Workers（免費方案）</p>
            </div>
            <div class='flex items-start gap-2'>
                <div class='flex-shrink-0 w-5 h-5 rounded-full bg-gray-100 flex items-center justify-center'>
                    <span class='text-xs font-medium text-gray-600'>4</span>
                </div>
                <p class='text-xs text-gray-600 flex-1'>在設定中配置 Worker URL</p>
            </div>
        </div>
    `;
    introContent.appendChild(setupGuide);
    
    // 提示
    const tip = createElement('div', 'flex items-start gap-2 p-3 bg-blue-50 rounded-lg');
    tip.innerHTML = `
        <span class='material-symbols-outlined text-blue-600 text-sm'>info</span>
        <p class='text-xs text-blue-800 flex-1'>
            所有工具都在 Cloudflare Workers 上運行，你的 API Key 安全地存儲在 Cloudflare Secrets 中。
        </p>
    `;
    introContent.appendChild(tip);
    
    introSection.appendChild(introContent);
    main.appendChild(introSection);

    const filterSection = createElement('div', 'mx-4 mb-4');
    
    const filterCard = createElement('div', 'bg-white rounded-lg border border-gray-200 overflow-hidden');
    filterCard.id = 'category-filter-card';
    
    const filterHeader = createElement('div', 'flex items-center justify-between px-4 py-3 cursor-pointer');
    filterHeader.id = 'category-filter-header';
    filterHeader.onclick = () => toggleFilterDropdown();
    
    const filterLabel = createElement('div', 'flex items-center gap-2');
    const filterIcon = createElement('span', 'material-symbols-outlined text-gray-600');
    filterIcon.textContent = 'filter_list';
    filterLabel.appendChild(filterIcon);
    
    const filterText = createElement('span', 'text-sm font-medium text-gray-900');
    filterText.id = 'selected-category-text';
    filterText.textContent = '全部類別';
    filterLabel.appendChild(filterText);
    filterHeader.appendChild(filterLabel);
    
    const dropdownIcon = createElement('span', 'material-symbols-outlined text-gray-400 transition-transform');
    dropdownIcon.id = 'filter-dropdown-icon';
    dropdownIcon.textContent = 'expand_more';
    filterHeader.appendChild(dropdownIcon);
    
    filterCard.appendChild(filterHeader);
    
    const dropdownContent = createElement('div', 'hidden border-t border-gray-200');
    dropdownContent.id = 'category-dropdown-content';
    
    const dropdownGrid = createElement('div', 'grid grid-cols-2 gap-2 p-3');
    
    const allOption = createElement('button', 'mcp-category-option active');
    allOption.innerHTML = "`<span class=`"`material-symbols-outlined text-sm mr-1`"`>apps</span>全部`";
    allOption.dataset.category = 'all';
    allOption.onclick = (e) => {
        e.stopPropagation();
        filterByCategory('all', container);
    };
    dropdownGrid.appendChild(allOption);
    
    for (const cat of CATEGORIES) {
        const option = createElement('button', 'mcp-category-option');
        option.innerHTML = `<span class='material-symbols-outlined text-sm mr-1'>${cat.icon}</span>${cat.id}`;
        option.dataset.category = cat.id;
        option.onclick = (e) => {
            e.stopPropagation();
            filterByCategory(cat.id, container);
        };
        dropdownGrid.appendChild(option);
    }
    
    dropdownContent.appendChild(dropdownGrid);
    filterCard.appendChild(dropdownContent);
    filterSection.appendChild(filterCard);
    main.appendChild(filterSection);

    const searchSection = createElement('div', 'mx-4 mb-4');
    const searchInput = createElement('input', 'w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-gray-900 focus:border-transparent');
    searchInput.type = 'search';
    searchInput.placeholder = '搜尋工具...';
    searchInput.id = 'mcp-search';
    searchInput.oninput = () => searchTools(searchInput.value, container);
    searchSection.appendChild(searchInput);
    main.appendChild(searchSection);

    const customSection = createElement('div', 'mx-4 mb-4 bg-purple-50 border-2 border-purple-200 rounded-lg p-4');
    customSection.id = 'custom-tools-section';
    
    const customHeader = createElement('div', 'flex items-center justify-between mb-3');
    const customTitle = createElement('div', 'flex items-center gap-2');
    const customIcon = createElement('span', 'material-symbols-outlined text-purple-600');
    customIcon.textContent = 'code';
    customTitle.appendChild(customIcon);
    customTitle.appendChild(createElement('span', 'text-sm font-semibold text-purple-800', { textContent: '自定義 MCP 工具' }));
    customHeader.appendChild(customTitle);
    
    const addCustomBtn = createElement('button', 'text-xs text-purple-600 font-medium hover:text-purple-800 transition-colors');
    addCustomBtn.innerHTML = "`<span class=`"`material-symbols-outlined text-sm align-middle`"`>add_circle</span> 新增工具`";
    addCustomBtn.onclick = () => showCustomToolDialog(container);
    customHeader.appendChild(addCustomBtn);
    customSection.appendChild(customHeader);
    
    const customDesc = createElement('p', 'text-xs text-purple-600 mb-3');
    customDesc.textContent = '新增您自己的 MCP 工具，輸入工具名稱、描述和執行代碼';
    customSection.appendChild(customDesc);
    
    const customList = createElement('div', 'space-y-2');
    customList.id = 'custom-tools-list';
    
    await ensureCustomToolsStore();
    const savedTools = await getCustomTools();
    
    if (savedTools.length > 0) {
        savedTools.forEach((tool, index) => {
            const toolItem = createCustomToolItem(tool, index, container);
            customList.appendChild(toolItem);
        });
    } else {
        const emptyMsg = createElement('p', 'text-xs text-purple-400 text-center');
        emptyMsg.textContent = '尚未新增自定義工具';
        customList.appendChild(emptyMsg);
    }
    
    customSection.appendChild(customList);
    main.appendChild(customSection);

    const toolsSection = createElement('div', 'mx-4 space-y-3');
    toolsSection.id = 'tools-list';
    renderToolsList(toolsSection, 'all');
    main.appendChild(toolsSection);

    container.appendChild(main);

    const bottomBar = createElement('div', 'sticky bottom-0 bg-white/95 backdrop-blur border-t border-gray-200 p-4 -mx-4');
    bottomBar.id = 'mcp-bottom-bar';

    const selectedInfo = createElement('div', 'flex items-center justify-between');
    const countEl = createElement('span', 'text-sm text-gray-700');
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

function toggleFilterDropdown() {
    const dropdown = document.getElementById('category-dropdown-content');
    const icon = document.getElementById('filter-dropdown-icon');
    
    if (dropdown && icon) {
        dropdown.classList.toggle('hidden');
        icon.style.transform = dropdown.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
    }
}

function filterByCategory(category, container) {
    const options = container.querySelectorAll('.mcp-category-option');
    options.forEach(option => {
        option.classList.toggle('active', option.dataset.category === category);
    });
    
    const textEl = document.getElementById('selected-category-text');
    if (textEl) {
        if (category === 'all') {
            textEl.textContent = '全部類別';
        } else {
            const cat = CATEGORIES.find(c => c.id === category);
            textEl.textContent = cat ? cat.id : category;
        }
    }
    
    const dropdown = document.getElementById('category-dropdown-content');
    const icon = document.getElementById('filter-dropdown-icon');
    if (dropdown && icon) {
        dropdown.classList.add('hidden');
        icon.style.transform = 'rotate(0deg)';
    }

    const listEl = container.querySelector('#tools-list');
    if (listEl) {
        renderToolsList(listEl, category);
    }
}

function searchTools(term, container) {
    const activeOption = container.querySelector('.mcp-category-option.active');
    const category = activeOption?.dataset.category || 'all';

    const listEl = container.querySelector('#tools-list');
    if (listEl) {
        renderToolsList(listEl, category, term);
    }
}

function showToolDetail(tool) {
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
    const sheet = createElement('div', 'bg-ios-bg w-full rounded-t-lg max-h-[80vh] overflow-y-auto');

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
        <div class='bg-gray-100 p-2 rounded'>
            <span class='text-gray-500'>工具名稱</span>
            <div class='font-mono text-gray-900'>${tool.name}</div>
        </div>
        <div class='bg-gray-100 p-2 rounded'>
            <span class='text-gray-500'>難度</span>
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
    const paramsCode = createElement('pre', 'text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto');
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

async function showGenerateDialog(container) {
    if (selectedTools.size === 0) {
        createToast('請先選擇至少一個工具', 'error');
        return;
    }

    const files = await generateZipContent(Array.from(selectedTools));
    
    if (isMobileDevice()) {
        const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
        const sheet = createElement('div', 'bg-ios-bg w-full rounded-t-lg');
        
        const header = createElement('div', 'flex items-center justify-between p-4 border-b border-gray-200');
        header.appendChild(createElement('h2', 'text-lg font-bold', { textContent: '生成 Worker 程式碼' }));
        const closeBtn = createElement('button', 'text-gray-500');
        closeBtn.appendChild(createIcon('close'));
        closeBtn.onclick = () => overlay.remove();
        header.appendChild(closeBtn);
        sheet.appendChild(header);
        
        const content = createElement('div', 'p-4 space-y-4');
        
        const summary = createElement('div', 'bg-purple-50 p-3 rounded-lg');
        summary.innerHTML = `
            <p class='text-sm text-purple-800 font-medium'>已選擇 ${selectedTools.size} 個工具</p>
            <p class='text-xs text-purple-600 mt-1'>${Array.from(selectedTools).map(id => {
                const tool = TOOLS_CATALOG.find(t => t.id === id);
                return tool?.displayName;
            }).join('、')}</p>
        `;
        content.appendChild(summary);
        
        const downloadBtn = createElement('button', 'ios-btn ios-btn-primary w-full');
        downloadBtn.textContent = '下載 ZIP 檔案';
        downloadBtn.onclick = () => {
            downloadAllFiles(files);
            overlay.remove();
        };
        content.appendChild(downloadBtn);
        
        const info = createElement('div', 'text-xs text-gray-500 text-center');
        info.textContent = '下載後請在電腦上解壓縮並部署到 Cloudflare Workers';
        content.appendChild(info);
        
        sheet.appendChild(content);
        overlay.appendChild(sheet);
        document.querySelector('.app-container').appendChild(overlay);
    } else {
        const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
        const sheet = createElement('div', 'bg-ios-bg w-full rounded-t-lg max-h-[90vh] overflow-y-auto');
        
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
            <p class='text-sm text-purple-800 font-medium'>已選擇 ${selectedTools.size} 個工具</p>
            <p class='text-xs text-purple-600 mt-1'>${Array.from(selectedTools).map(id => {
                const tool = TOOLS_CATALOG.find(t => t.id === id);
                return tool?.displayName;
            }).join('、')}</p>
        `;
        content.appendChild(summary);
        
        for (const [filename, code] of Object.entries(files)) {
            const fileSection = createElement('div');
            fileSection.appendChild(createElement('h3', 'font-semibold mb-2', { textContent: filename }));
            
            const codeBlock = createElement('pre', 'text-xs bg-gray-900 text-green-400 p-3 rounded-lg overflow-x-auto max-h-48');
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
            <h3 class='font-semibold text-blue-800 mb-2'>部署步驟</h3>
            <ol class='text-sm text-blue-700 space-y-1 list-decimal list-inside'>
                <li>解壓縮下載的 ZIP 檔</li>
                <li>在終端機切換到該目錄：<code class='bg-blue-100 px-1'>cd siios-mcp-worker</code></li>
                <li>安裝依賴：<code class='bg-blue-100 px-1'>npm install</code></li>
                <li>登入 Cloudflare：<code class='bg-blue-100 px-1'>wrangler login</code></li>
                <li>部署：<code class='bg-blue-100 px-1'>wrangler deploy</code></li>
            </ol>
        `;
        content.appendChild(guideSection);
        
        sheet.appendChild(content);
        overlay.appendChild(sheet);
        document.querySelector('.app-container').appendChild(overlay);
    }
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

async function downloadAllFilesAsync(filesPromise) {
    const files = await filesPromise;
    await downloadAllFiles(files);
}

function createCustomToolItem(tool, index, container) {
    const item = createElement('div', 'flex items-center justify-between bg-white p-3 rounded border border-purple-100');
    
    const info = createElement('div', 'flex-1 min-w-0');
    info.appendChild(createElement('div', 'text-sm font-medium text-gray-900 truncate', { textContent: tool.displayName }));
    info.appendChild(createElement('div', 'text-xs text-gray-500 truncate', { textContent: tool.name }));
    item.appendChild(info);
    
    const actions = createElement('div', 'flex items-center gap-2');
    
    const selectCheckbox = createElement('input', 'w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-500');
    selectCheckbox.type = 'checkbox';
    selectCheckbox.checked = selectedTools.has(tool.id);
    selectCheckbox.onchange = () => {
        if (selectCheckbox.checked) {
            selectedTools.add(tool.id);
        } else {
            selectedTools.delete(tool.id);
        }
        updateSelectedCount();
    };
    actions.appendChild(selectCheckbox);
    
    const deleteBtn = createElement('button', 'text-red-500 hover:text-red-700 transition-colors');
    deleteBtn.innerHTML = "`<span class=`"`material-symbols-outlined text-sm`"`>delete</span>`";
    deleteBtn.onclick = () => deleteCustomTool(tool.id);
    actions.appendChild(deleteBtn);
    
    item.appendChild(actions);
    return item;
}

function showCustomToolDialog(container) {
    const overlay = createElement('div', 'fixed inset-0 bg-black/50 z-50 flex items-end');
    const sheet = createElement('div', 'bg-ios-bg w-full rounded-t-lg max-h-[90vh] overflow-y-auto');
    
    const header = createElement('div', 'sticky top-0 bg-ios-bg p-4 border-b flex items-center justify-between z-10');
    header.appendChild(createElement('h2', 'text-lg font-bold', { textContent: '新增自定義工具' }));
    const closeBtn = createElement('button', 'text-gray-500');
    closeBtn.appendChild(createIcon('close'));
    closeBtn.onclick = () => overlay.remove();
    header.appendChild(closeBtn);
    sheet.appendChild(header);
    
    const content = createElement('div', 'p-4 space-y-4');
    
    content.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-1', { textContent: '工具名稱（英文，用於調用）' }));
    const nameInput = createElement('input', 'w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent');
    nameInput.type = 'text';
    nameInput.placeholder = '例如：my_custom_tool';
    nameInput.id = 'custom-tool-name';
    content.appendChild(nameInput);
    
    content.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-1 mt-4', { textContent: '顯示名稱（中文）' }));
    const displayNameInput = createElement('input', 'w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent');
    displayNameInput.type = 'text';
    displayNameInput.placeholder = '例如：我的自定義工具';
    displayNameInput.id = 'custom-tool-display-name';
    content.appendChild(displayNameInput);
    
    content.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-1 mt-4', { textContent: '描述' }));
    const descInput = createElement('textarea', 'w-full p-3 bg-white rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-500 focus:border-transparent h-20');
    descInput.placeholder = '描述這個工具的功能';
    descInput.id = 'custom-tool-desc';
    content.appendChild(descInput);
    
    content.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-1 mt-4', { textContent: '參數（JSON 格式）' }));
    const paramsInput = createElement('textarea', 'w-full p-3 bg-gray-900 text-green-400 rounded-lg font-mono text-xs h-32');
    paramsInput.placeholder = '{'type': 'object', 'properties': {'param1': {'type': 'string', 'description': '參數1'}}, 'required': ['param1']}';
    paramsInput.id = 'custom-tool-params';
    content.appendChild(paramsInput);
    
    content.appendChild(createElement('label', 'block text-sm font-medium text-gray-700 mb-1 mt-4', { textContent: '執行代碼（JavaScript）' }));
    const codeInput = createElement('textarea', 'w-full p-3 bg-gray-900 text-green-400 rounded-lg font-mono text-xs h-48');
    codeInput.placeholder = '// args 包含傳入的參數, env 包含環境變數\nconst res = await fetch(\'https://api.example.com/endpoint\', {\n    method: \'POST\',\n    body: JSON.stringify(args)\n});\nconst data = await res.json();\nreturn data;';
    codeInput.id = 'custom-tool-code';
    content.appendChild(codeInput);
    
    const helpText = createElement('div', 'text-xs text-gray-500 mt-2 p-3 bg-blue-50 rounded-lg');
    helpText.innerHTML = `
        <p class='font-semibold mb-1'>?? 提示：</p>
        <ul class='space-y-1 list-disc list-inside'>
            <li><code class='bg-blue-100 px-1'>args</code> - 調用時傳入的參數</li>
            <li><code class='bg-blue-100 px-1'>env</code> - 環境變數（如 API Keys）</li>
            <li><code class='bg-blue-100 px-1'>fetch()</code> - 發送 HTTP 請求</li>
            <li>最後必須 <code class='bg-blue-100 px-1'>return</code> 結果</li>
        </ul>
    `;
    content.appendChild(helpText);
    
    const saveBtn = createElement('button', 'ios-btn ios-btn-primary w-full mt-4');
    saveBtn.textContent = '儲存工具';
    saveBtn.onclick = async () => {
        const name = nameInput.value.trim();
        const displayName = displayNameInput.value.trim();
        const desc = descInput.value.trim();
        const params = paramsInput.value.trim();
        const code = codeInput.value.trim();
        
        if (!name || !displayName || !desc || !params || !code) {
            createToast('請填寫所有欄位', 'error');
            return;
        }
        
        try {
            JSON.parse(params);
        } catch (e) {
            createToast('參數格式錯誤，請輸入有效的 JSON', 'error');
            return;
        }
        
        try {
            new Function('args', 'env', 'fetch', code);
        } catch (e) {
            createToast('代碼語法錯誤：' + e.message, 'error');
            return;
        }
        
        const customTool = {
            id: `custom-${Date.now()}`,
            name: name,
            displayName: displayName,
            description: desc,
            parameters: JSON.parse(params),
            code: code,
            category: '自定義',
            difficulty: 'custom',
            useCase: '自定義工具',
            createdAt: new Date().toISOString()
        };
        
        const success = await saveCustomTool(customTool);
        
        if (success) {
            createToast('工具已儲存', 'success');
            overlay.remove();
            Router.navigate('/mcp-market');
        } else {
            createToast('儲存失敗，請重試', 'error');
        }
    };
    content.appendChild(saveBtn);
    
    sheet.appendChild(content);
    overlay.appendChild(sheet);
    document.querySelector('.app-container').appendChild(overlay);
}

async function deleteCustomTool(toolId) {
    const success = await deleteCustomToolFromDB(toolId);
    
    if (success) {
        createToast('工具已刪除', 'success');
        Router.navigate('/mcp-market');
    } else {
        createToast('刪除失敗，請重試', 'error');
    }
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