import Router from '../../router.js';
import { createElement, createIcon, createToast } from '../../components.js';
import { SettingsDB, TheaterSettingsDB } from '../../db.js';
import { MEMORY_SOURCES, MEMORY_SOURCE_IDS } from '../../core/memory-sources.js';
import { loadDislikes, addDislikes, removeDislike, STRONG_COUNT } from '../../core/dislikes.js';


let memorySettings = {
    selected_sources: [...MEMORY_SOURCE_IDS],
    memory_level: 'meta',
    include_fiction: false,
    bound_theater_id: null
};

// 這些是「known_sources」功能加入之前就存在的來源；用來判斷哪些來源是之後才新增的
const LEGACY_SOURCE_IDS = ['chat', 'youtube', 'instagram', 'chrome', 'dating', 'bubbles', 'weverse', 'bilibili', 'twitch', 'twitter'];

async function loadMemorySettings() {
    const saved = await SettingsDB.get('chat_memory_settings');
    const allIds = MEMORY_SOURCES.map(s => s.id);
    if (saved) {
        memorySettings = { ...memorySettings, ...saved };
        // 之後新增的來源，對已經存過設定的使用者預設啟用一次；之後他關掉就尊重他的選擇
        const known = new Set(saved.known_sources || LEGACY_SOURCE_IDS);
        const fresh = allIds.filter(id => !known.has(id));
        memorySettings.selected_sources = [...new Set([...(memorySettings.selected_sources || []), ...fresh])];
        memorySettings.known_sources = allIds;
        if (fresh.length) await saveMemorySettings();
    } else {
        memorySettings.known_sources = allIds;
    }
}

async function saveMemorySettings() {
    await SettingsDB.set('chat_memory_settings', memorySettings);
}

async function renderMemorySettings() {
    await loadMemorySettings();
    
    const theaters = await TheaterSettingsDB.getAll();
    
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-header');
    header.innerHTML = `
        <button class="ios-back-btn">
            <i class="fas fa-chevron-left"></i> 返回
        </button>
        <h1 class="menu-title">記憶設定</h1>
        <div class="header-actions"></div>
    `;
    header.querySelector('.ios-back-btn').onclick = () => Router.navigate('/chats/settings');
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    
    // Theater Selection
    const theaterSection = createElement('div', 'px-4 mt-4');
    theaterSection.appendChild(createElement('p', 'ios-section-header', { textContent: '劇場/世界觀' }));
    
    const theaterDesc = createElement('p', 'text-sm text-ios-muted mb-2');
    theaterDesc.textContent = '選擇此對話使用的世界觀，記憶將根據所選劇場篩選';
    theaterSection.appendChild(theaterDesc);
    
    const theaterSelect = createElement('select', 'w-full p-3 rounded-lg border border-ios-border bg-ios-surface text-ios-text');
    theaterSelect.innerHTML = `<option value="">主線（無特定劇場）</option>`;
    theaters.forEach(t => {
        const option = createElement('option', '');
        option.value = t.id;
        option.textContent = t.name;
        if (memorySettings.bound_theater_id === t.id) option.selected = true;
        theaterSelect.appendChild(option);
    });
    theaterSelect.onchange = () => {
        memorySettings.bound_theater_id = theaterSelect.value || null;
        saveMemorySettings();
        createToast('已儲存劇場設定');
    };
    theaterSection.appendChild(theaterSelect);
    main.appendChild(theaterSection);
    
    // Memory Sources
    const sourceSection = createElement('div', 'px-4 mt-6');
    sourceSection.appendChild(createElement('p', 'ios-section-header', { textContent: '記憶來源' }));
    
    const sourceDesc = createElement('p', 'text-sm text-ios-muted mb-2');
    sourceDesc.textContent = '選擇要包含在對話中的跨應用程式記憶';
    sourceSection.appendChild(sourceDesc);
    
    const sourceGrid = createElement('div', 'grid grid-cols-2 gap-2');
    MEMORY_SOURCES.forEach(source => {
        const isSelected = memorySettings.selected_sources.includes(source.id);
        const chip = createElement('button', `flex items-center gap-2 p-3 rounded-lg border transition-all ${isSelected ? 'bg-ios-accent/10 border-ios-accent text-ios-accent' : 'bg-ios-surface border-ios-border text-ios-text'}`);
        
        chip.appendChild(createIcon(source.icon, 'text-lg'));
        chip.appendChild(createElement('span', '', { textContent: source.name }));
        
        chip.onclick = async () => {
            if (source.id === 'chat') {
                createToast('對話記憶為必選項目');
                return;
            }
            
            const idx = memorySettings.selected_sources.indexOf(source.id);
            if (idx > -1) {
                memorySettings.selected_sources.splice(idx, 1);
            } else {
                memorySettings.selected_sources.push(source.id);
            }
            await saveMemorySettings();
            Router.navigate('/memory-settings');
        };
        
        sourceGrid.appendChild(chip);
    });
    sourceSection.appendChild(sourceGrid);
    main.appendChild(sourceSection);
    
    // Memory Level
    const levelSection = createElement('div', 'px-4 mt-6');
    levelSection.appendChild(createElement('p', 'ios-section-header', { textContent: '記憶層級' }));
    
    const levelDesc = createElement('p', 'text-sm text-ios-muted mb-2');
    levelDesc.textContent = '選擇記憶的詳細程度';
    levelSection.appendChild(levelDesc);
    
    const levelControl = createElement('div', 'flex gap-2');
    
    const metaBtn = createElement('button', `flex-1 py-3 rounded-lg font-medium transition-colors ${memorySettings.memory_level === 'meta' ? 'bg-ios-accent text-white' : 'bg-ios-surface border border-ios-border text-ios-text'}`);
    metaBtn.textContent = '簡要（僅事實）';
    metaBtn.onclick = async () => {
        memorySettings.memory_level = 'meta';
        await saveMemorySettings();
        createToast('已設定為簡要模式');
        Router.navigate('/memory-settings');
    };
    levelControl.appendChild(metaBtn);
    
    const fullBtn = createElement('button', `flex-1 py-3 rounded-lg font-medium transition-colors ${memorySettings.memory_level === 'full' ? 'bg-ios-accent text-white' : 'bg-ios-surface border border-ios-border text-ios-text'}`);
    fullBtn.textContent = '完整（含內容）';
    fullBtn.onclick = async () => {
        memorySettings.memory_level = 'full';
        await saveMemorySettings();
        createToast('已設定為完整模式');
        Router.navigate('/memory-settings');
    };
    levelControl.appendChild(fullBtn);
    
    levelSection.appendChild(levelControl);
    main.appendChild(levelSection);
    
    // Fiction Toggle
    const fictionSection = createElement('div', 'px-4 mt-6');
    fictionSection.appendChild(createElement('p', 'ios-section-header', { textContent: '虛擬內容' }));
    
    const fictionDesc = createElement('p', 'text-sm text-ios-muted mb-2');
    fictionDesc.textContent = '是否包含同人創作（AO3、Lofter）等虛擬內容記憶';
    fictionSection.appendChild(fictionDesc);
    
    const fictionToggle = createElement('div', 'flex items-center justify-between p-3 bg-ios-surface rounded-lg border border-ios-border');
    fictionToggle.innerHTML = `
        <div class="flex items-center gap-2">
            <span class="material-symbols-outlined text-ios-text">menu_book</span>
            <span class="text-ios-text">包含虛擬內容記憶</span>
        </div>
        <div class="w-12 h-7 rounded-full ${memorySettings.include_fiction ? 'bg-ios-accent' : 'bg-gray-300'} relative transition-colors">
            <div class="w-5 h-5 rounded-full bg-white absolute top-1 ${memorySettings.include_fiction ? 'right-1' : 'left-1'} transition-all"></div>
        </div>
    `;
    
    fictionToggle.onclick = async () => {
        memorySettings.include_fiction = !memorySettings.include_fiction;
        await saveMemorySettings();
        createToast(memorySettings.include_fiction ? '已啟用虛擬內容' : '已停用虛擬內容');
        Router.navigate('/memory-settings');
    };
    fictionSection.appendChild(fictionToggle);
    main.appendChild(fictionSection);
    
    // 用戶討厭的事：固定放進每一次的提示詞，不靠檢索
    const dislikeSection = createElement('div', 'px-4 mt-6');
    dislikeSection.appendChild(createElement('p', 'ios-section-header', { textContent: '我討厭的事（一定會記住）' }));
    dislikeSection.appendChild(createElement('p', 'text-sm text-ios-muted mb-2', { textContent: '你說「我討厭…」「受不了…」「不吃…」「別再…」時會自動記下來；被反覆提到（或用「說過很多次」「千萬」強調）的會標成「反覆強調」。這份清單每次回覆都會固定帶給所有角色，不會因為時間久了淡忘。你也可以自己新增或刪除。' }));
    const dislikeList = createElement('div', 'flex flex-col gap-2 mb-2');
    const renderDislikes = async () => {
        const list = (await loadDislikes()).sort((a, b) => (b.count || 1) - (a.count || 1) || (b.lastAt || 0) - (a.lastAt || 0));
        dislikeList.innerHTML = '';
        if (!list.length) dislikeList.appendChild(createElement('p', 'text-sm text-ios-muted', { textContent: '目前沒有。' }));
        for (const item of list) {
            const row = createElement('div', 'flex items-center justify-between p-3 bg-ios-surface rounded-lg border border-ios-border');
            const left = createElement('div', 'flex-1 min-w-0');
            left.appendChild(createElement('div', 'text-ios-text', { textContent: item.text }));
            const strong = (item.count || 1) >= STRONG_COUNT;
            left.appendChild(createElement('div', 'text-xs text-ios-muted', { textContent: (strong ? '反覆強調 ' + item.count + ' 次' : '提過 1 次') + (item.manual ? ' · 手動新增' : '') }));
            const del = createElement('button', 'text-sm', { textContent: '刪除', onClick: async () => { await removeDislike(item.id); renderDislikes(); } });
            del.style.cssText = 'background:transparent;border:none;color:#ef4444;cursor:pointer;padding:4px 8px;';
            row.append(left, del);
            dislikeList.appendChild(row);
        }
    };
    renderDislikes();
    const addRow = createElement('div', 'flex gap-2');
    const addInput = createElement('input', 'ios-input flex-1', { type: 'text', placeholder: '例如：香菜、被打斷、一直道歉', maxLength: 40 });
    const addBtn = createElement('button', 'ios-btn', { textContent: '新增' });
    const doAdd = async () => {
        const t = addInput.value.trim();
        if (!t) return;
        await addDislikes([t], { weight: STRONG_COUNT, source: 'manual' }); // 自己新增的視為已經強調過
        addInput.value = '';
        renderDislikes();
    };
    addBtn.onclick = doAdd;
    addInput.onkeydown = e => { if (e.key === 'Enter' && !e.isComposing) doAdd(); };
    addRow.append(addInput, addBtn);
    dislikeSection.append(dislikeList, addRow);
    main.appendChild(dislikeSection);

    // Info Section
    const infoSection = createElement('div', 'px-4 mt-6 mb-4');
    infoSection.appendChild(createElement('p', 'ios-section-header', { textContent: '說明' }));
    
    const infoBox = createElement('div', 'p-4 bg-ios-surface rounded-lg border border-ios-border text-sm text-ios-muted');
    infoBox.innerHTML = `
        <p class="mb-2"><strong>記憶層級說明：</strong></p>
        <p class="mb-2">• <strong>簡要</strong>：僅記錄「和用戶在 YouTube 看了影片」等事實，不含具體內容</p>
        <p class="mb-2">• <strong>完整</strong>：包含完整的互動內容，如影片標題、評論等</p>
        <p class="mt-3"><strong>劇場/世界觀：</strong></p>
        <p class="mb-2">不同劇場的記憶會分開儲存，避免不同世界觀的 IF 線混淆</p>
    `;
    infoSection.appendChild(infoBox);
    main.appendChild(infoSection);
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

export { memorySettings, loadMemorySettings };

export default {
    id: 'memory-settings',
    routes: [
        { path: '/memory-settings', render: renderMemorySettings }
    ]
};