import Router from '../router.js';
import { createElement, createIcon, createIOSNavBar, createIOSSegmentedControl, createIOSToggle, createToast } from '../components.js';
import { WorldInfoDB } from '../db.js';

let formState = {
    name: '',
    keywords: [],
    content: '',
    insertion: 'after',
    priority: 10,
    enabled: true
};

let entryId = null;

async function render(params) {
    entryId = params.id || null;
    
    if (entryId) {
        const existing = await WorldInfoDB.getById(entryId);
        if (existing) {
            formState = { ...existing };
        }
    }
    
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-nav-bar');
    header.style.paddingTop = 'env(safe-area-inset-top)';
    
    const inner = createElement('div', 'ios-nav-bar-inner');
    
    const cancelBtn = createElement('button', 'ios-btn', { textContent: '取消' });
    cancelBtn.onclick = () => Router.back();
    inner.appendChild(cancelBtn);
    
    const title = createElement('h1', 'ios-inline-title', { textContent: entryId ? '編輯條目' : '新增條目' });
    inner.appendChild(title);
    
    const doneBtn = createElement('button', 'ios-btn font-bold', { textContent: '完成' });
    doneBtn.onclick = saveEntry;
    inner.appendChild(doneBtn);
    
    header.appendChild(inner);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-4 pb-24');
    
    const basicSection = createElement('div', 'mb-2 ml-8');
    basicSection.appendChild(createElement('p', 'ios-section-header', { textContent: '基礎資訊' }));
    
    const basicGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const nameCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    nameCell.appendChild(createElement('span', 'flex-1', { textContent: '名稱' }));
    const nameInput = createElement('input', 'text-right bg-transparent outline-none text-ios-muted', {
        type: 'text',
        value: formState.name,
        placeholder: '輸入名稱'
    });
    nameInput.oninput = (e) => formState.name = e.target.value;
    nameCell.appendChild(nameInput);
    basicGroup.appendChild(nameCell);
    
    const keywordsCell = createElement('div', 'ios-list-cell ios-list-cell-full flex-wrap');
    keywordsCell.appendChild(createElement('span', '', { textContent: '關鍵字' }));
    
    const keywordsContainer = createElement('div', 'flex flex-wrap gap-1');
    const keywordInput = createElement('input', 'bg-kakao-yellow/20 rounded-full px-2 py-1 text-sm outline-none', {
        type: 'text',
        placeholder: '新增'
    });
    keywordInput.style.minWidth = '60px';
    keywordInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && keywordInput.value.trim()) {
            addKeyword(keywordInput.value.trim());
            keywordInput.value = '';
            renderKeywords(keywordsContainer);
        }
    });
    keywordsContainer.appendChild(keywordInput);
    keywordsCell.appendChild(keywordsContainer);
    basicGroup.appendChild(keywordsCell);
    
    renderKeywords(keywordsContainer);
    
    main.appendChild(basicSection);
    main.appendChild(basicGroup);
    
    const contentSection = createElement('div', 'mb-2 ml-8');
    contentSection.appendChild(createElement('p', 'ios-section-header', { textContent: '描述內容' }));
    
    const contentGroup = createElement('div', 'ios-grouped-list mx-4 p-4');
    const contentTextarea = createElement('textarea', 'ios-textarea', {
        placeholder: '輸入條目內容...'
    });
    contentTextarea.value = formState.content;
    contentTextarea.oninput = (e) => formState.content = e.target.value;
    contentGroup.appendChild(contentTextarea);
    
    main.appendChild(contentSection);
    main.appendChild(contentGroup);
    
    const strategySection = createElement('div', 'mb-2 ml-8');
    strategySection.appendChild(createElement('p', 'ios-section-header', { textContent: '插入與權重策略' }));
    
    const strategyGroup = createElement('div', 'ios-grouped-list mx-4');
    
    const insertionCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    insertionCell.appendChild(createElement('span', 'flex-1', { textContent: '插入策略' }));
    
    const insertionOptions = ['before', 'after', 'system'];
    const insertionLabels = ['Before (前置)', 'After (後置)', 'System (系統)'];
    const currentIndex = insertionOptions.indexOf(formState.insertion);
    
    const insertionSelect = createElement('select', 'bg-transparent outline-none text-ios-muted');
    insertionOptions.forEach((opt, i) => {
        const option = createElement('option', '', { value: opt, textContent: insertionLabels[i] });
        if (opt === formState.insertion) option.selected = true;
        insertionSelect.appendChild(option);
    });
    insertionSelect.onchange = (e) => formState.insertion = e.target.value;
    insertionCell.appendChild(insertionSelect);
    strategyGroup.appendChild(insertionCell);
    
    const priorityCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    priorityCell.appendChild(createElement('span', 'flex-1', { textContent: '權重優先級' }));
    const priorityInput = createElement('input', 'w-16 text-right bg-transparent outline-none', {
        type: 'number',
        value: formState.priority.toString()
    });
    priorityInput.oninput = (e) => formState.priority = parseInt(e.target.value) || 10;
    priorityCell.appendChild(priorityInput);
    strategyGroup.appendChild(priorityCell);
    
    const enabledCell = createElement('div', 'ios-list-cell ios-list-cell-full');
    enabledCell.appendChild(createElement('span', 'flex-1', { textContent: '狀態' }));
    const statusIndicator = createElement('div', 'flex items-center gap-2');
    statusIndicator.appendChild(createElement('div', `w-2 h-2 rounded-full ${formState.enabled ? 'bg-green-500' : 'bg-gray-400'}`));
    statusIndicator.appendChild(createElement('span', 'text-ios-muted', { textContent: formState.enabled ? '已啟用' : '已停用' }));
    
    const toggle = createIOSToggle(formState.enabled, (checked) => {
        formState.enabled = checked;
        statusIndicator.querySelector('.w-2').className = `w-2 h-2 rounded-full ${checked ? 'bg-green-500' : 'bg-gray-400'}`;
        statusIndicator.querySelector('.text-ios-muted').textContent = checked ? '已啟用' : '已停用';
    });
    enabledCell.appendChild(toggle);
    strategyGroup.appendChild(enabledCell);
    
    main.appendChild(strategySection);
    main.appendChild(strategyGroup);
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

function addKeyword(keyword) {
    if (!formState.keywords.includes(keyword)) {
        formState.keywords.push(keyword);
    }
}

function removeKeyword(keyword) {
    formState.keywords = formState.keywords.filter(k => k !== keyword);
}

function renderKeywords(container) {
    const chips = container.querySelectorAll('.ios-chip');
    chips.forEach(chip => chip.remove());
    
    formState.keywords.forEach(keyword => {
        const chip = createElement('span', 'ios-chip');
        chip.textContent = keyword;
        
        const removeBtn = createElement('span', 'ios-chip-remove', {
            textContent: '×',
            onClick: () => {
                removeKeyword(keyword);
                renderKeywords(container);
            }
        });
        chip.appendChild(removeBtn);
        
        container.insertBefore(chip, container.lastChild);
    });
}

async function saveEntry() {
    if (!formState.name.trim()) {
        createToast('請輸入名稱', 'error');
        return;
    }
    
    if (formState.keywords.length === 0) {
        createToast('請至少新增一個關鍵字', 'error');
        return;
    }
    
    if (!formState.content.trim()) {
        createToast('請輸入內容', 'error');
        return;
    }
    
    try {
        if (entryId) {
            await WorldInfoDB.update(entryId, formState);
            createToast('已更新條目', 'success');
        } else {
            await WorldInfoDB.create(formState);
            createToast('已建立條目', 'success');
        }
        Router.back();
    } catch (error) {
        createToast('儲存失敗: ' + error.message, 'error');
    }
}

export { render };