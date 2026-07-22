import Router from '../../router.js';
import { createElement, createIcon, createIOSToggle, createToast } from '../../components.js';
import { WorldInfoDB } from '../../db.js';

let formState = {
    name: '',
    keywords: [],
    content: '',
    insertion: 'after',
    priority: 10,
    enabled: true
};

let entryId = null;

async function renderEntryEditor(params) {
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
    
    main.appendChild(basicSection);
    main.appendChild(basicGroup);
    
    container.appendChild(main);
    
    async function saveEntry() {
        if (!formState.name.trim()) {
            createToast('請輸入名稱', 'error');
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
    
    doneBtn.onclick = saveEntry;
    
    return { element: container, cleanup: null };
}

export default {
    id: 'entry-editor',
    name: 'Entry Editor',
    icon: 'edit',
    routes: [
        { path: '/entry-editor', render: renderEntryEditor },
        { path: '/entry-editor/:id', render: renderEntryEditor }
    ],
    navItem: null
};