import Router from '../../router.js';
import { createElement, createIOSToggle, createToast } from '../../components.js';
import { GlobalSettingsDB, GlobalForbiddenDB, TheaterSettingsDB, KeywordSettingsDB } from '../../db.js';

let formState = { name: '', content: '', keywords: [], priority: 'front', enabled: true };
let entryId = null;
let currentType = 'global';

function getDB(type) {
    const dbs = { global: GlobalSettingsDB, forbidden: GlobalForbiddenDB, theater: TheaterSettingsDB, keyword: KeywordSettingsDB };
    return dbs[type] || GlobalSettingsDB;
}

function getDefaultPriority(type) {
    return (type === 'global' || type === 'forbidden') ? 'front' : 'middle';
}

async function renderEntryEditor(params) {
    entryId = params.id || null;
    const path = window.location.hash.slice(1);
    
    if (path.includes('/global-forbidden/edit')) currentType = 'forbidden';
    else if (path.includes('/theater-settings/edit')) currentType = 'theater';
    else if (path.includes('/keyword-settings/edit')) currentType = 'keyword';
    else currentType = 'global';
    
    formState = { name: '', content: '', keywords: [], priority: getDefaultPriority(currentType), enabled: true };
    
    if (entryId) {
        const existing = await getDB(currentType).getById(entryId);
        if (existing) formState = { ...existing };
    }
    
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-nav-bar');
    header.style.paddingTop = 'env(safe-area-inset-top)';
    const inner = createElement('div', 'ios-nav-bar-inner');
    
    const cancelBtn = createElement('button', 'ios-btn', { textContent: '取消' });
    cancelBtn.onclick = () => Router.back();
    inner.appendChild(cancelBtn);
    
    inner.appendChild(createElement('h1', 'ios-inline-title', { textContent: entryId ? '編輯條目' : '新增條目' }));
    
    const doneBtn = createElement('button', 'ios-btn font-bold', { textContent: '完成' });
    inner.appendChild(doneBtn);
    
    header.appendChild(inner);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';
    
    const basicGroup = createElement('div', 'ios-grouped-list mx-4');
    const nameCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    nameCell.appendChild(createElement('span', 'flex-1', { textContent: '名稱' }));
    const nameInput = createElement('input', 'text-right bg-transparent outline-none text-ios-muted', { type: 'text', value: formState.name, placeholder: '輸入名稱' });
    nameInput.oninput = (e) => formState.name = e.target.value;
    nameCell.appendChild(nameInput);
    basicGroup.appendChild(nameCell);
    main.appendChild(basicGroup);
    
    const contentGroup = createElement('div', 'ios-grouped-list mx-4 mt-4');
    const contentCell = createElement('div', 'ios-list-cell ios-list-cell-full', { style: 'flex-direction: column; align-items: flex-start;' });
    const contentTextarea = createElement('textarea', 'w-full min-h-[120px] bg-transparent outline-none resize-none', { placeholder: '輸入內容', value: formState.content });
    contentTextarea.oninput = (e) => formState.content = e.target.value;
    contentCell.appendChild(contentTextarea);
    contentGroup.appendChild(contentCell);
    main.appendChild(contentGroup);
    
    if (currentType === 'keyword') {
        const keywordsGroup = createElement('div', 'ios-grouped-list mx-4 mt-4');
        const keywordsCell = createElement('div', 'ios-list-cell ios-list-cell-full');
        keywordsCell.appendChild(createElement('span', 'flex-1', { textContent: '關鍵字（逗號分隔）' }));
        const keywordsInput = createElement('input', 'text-right bg-transparent outline-none text-ios-muted', { type: 'text', value: (formState.keywords || []).join(', '), placeholder: '關鍵字1, 關鍵字2' });
        keywordsInput.oninput = (e) => { formState.keywords = e.target.value.split(',').map(k => k.trim()).filter(k => k); };
        keywordsCell.appendChild(keywordsInput);
        keywordsGroup.appendChild(keywordsCell);
        main.appendChild(keywordsGroup);
    }
    
    const settingsGroup = createElement('div', 'ios-grouped-list mx-4 mt-4');
    
    const priorityCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    priorityCell.appendChild(createElement('span', 'flex-1', { textContent: '插入位置' }));
    const prioritySelect = createElement('select', 'bg-transparent outline-none');
    ['front', 'middle', 'back'].forEach(p => {
        const option = createElement('option', '', { value: p, textContent: p === 'front' ? '前' : p === 'middle' ? '中' : '後' });
        if (formState.priority === p) option.selected = true;
        prioritySelect.appendChild(option);
    });
    prioritySelect.onchange = (e) => formState.priority = e.target.value;
    priorityCell.appendChild(prioritySelect);
    settingsGroup.appendChild(priorityCell);
    
    const enabledCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    enabledCell.appendChild(createElement('span', 'flex-1', { textContent: '啟用' }));
    const enabledToggle = createIOSToggle(formState.enabled);
    enabledToggle.onclick = () => { formState.enabled = !formState.enabled; enabledToggle.classList.toggle('active'); };
    enabledCell.appendChild(enabledToggle);
    settingsGroup.appendChild(enabledCell);
    main.appendChild(settingsGroup);
    
    container.appendChild(main);
    
    doneBtn.onclick = async () => {
        if (!formState.name.trim()) { createToast('請輸入名稱', 'error'); return; }
        if (!formState.content.trim()) { createToast('請輸入內容', 'error'); return; }
        try {
            const db = getDB(currentType);
            if (entryId) { await db.update(entryId, formState); createToast('已更新條目', 'success'); }
            else { await db.create(formState); createToast('已建立條目', 'success'); }
            Router.back();
        } catch (error) { createToast('儲存失敗: ' + error.message, 'error'); }
    };
    
    return { element: container, cleanup: null };
}

export default {
    id: 'entry-editor',
    name: 'Entry Editor',
    icon: 'edit',
    routes: [
        { path: '/global-settings/edit', render: renderEntryEditor },
        { path: '/global-settings/edit/:id', render: renderEntryEditor },
        { path: '/global-forbidden/edit', render: renderEntryEditor },
        { path: '/global-forbidden/edit/:id', render: renderEntryEditor },
        { path: '/theater-settings/edit', render: renderEntryEditor },
        { path: '/theater-settings/edit/:id', render: renderEntryEditor },
        { path: '/keyword-settings/edit', render: renderEntryEditor },
        { path: '/keyword-settings/edit/:id', render: renderEntryEditor }
    ],
    navItem: null
};
