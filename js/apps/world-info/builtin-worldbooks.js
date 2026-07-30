import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar } from '../../components.js';
import worldbookInstaller from '../../core/worldbook-installer.js';

async function renderBuiltinWorldbooks() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createIOSNavBar({
        title: '內建世界書',
        backPath: '/world-info'
    });
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';
    
    const listContainer = createElement('div', 'px-4');
    
    const loadingState = createElement('div', 'text-center py-12 text-ios-muted');
    loadingState.textContent = '載入中...';
    listContainer.appendChild(loadingState);
    main.appendChild(listContainer);
    container.appendChild(main);
    
    try {
        const worldbooks = await worldbookInstaller.scanWorldbooks();
        listContainer.innerHTML = '';
        
        if (worldbooks.length === 0) {
            const emptyState = createElement('div', 'text-center py-12 text-ios-muted');
            emptyState.textContent = '沒有找到可用的世界書';
            listContainer.appendChild(emptyState);
        } else {
            const group = createElement('div', 'ios-grouped-list');
            
            for (const wb of worldbooks) {
                const cell = createElement('div', 'ios-list-cell ios-list-cell-full');
                
                const content = createElement('div', 'flex-1 min-h-[44px] flex flex-col justify-center');
                content.appendChild(createElement('span', 'text-base font-semibold', { textContent: wb.id }));
                content.appendChild(createElement('span', 'text-sm text-ios-muted', { textContent: '點擊匯入到設定庫' }));
                
                cell.appendChild(content);
                cell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
                
                cell.addEventListener('click', async () => {
                    cell.style.pointerEvents = 'none';
                    
                    try {
                        const result = await worldbookInstaller.importWorldbookWithPrompt(wb.id);
                        
                        if (result.needPrompt) {
                            const confirmed = confirm(`發現 ${result.duplicates.length} 個同名條目已存在。\n\n是否覆蓋這些條目？\n\n選擇「確定」覆蓋\n選擇「取消」跳過重複項目`);
                            
                            if (confirmed) {
                                const importResult = await worldbookInstaller.importWorldbook(wb.id, 'overwrite');
                                alert(`匯入完成\n覆蓋: ${importResult.imported} 個條目\n跳過: ${importResult.skipped} 個條目`);
                            } else {
                                const importResult = await worldbookInstaller.importWorldbook(wb.id, 'skip');
                                alert(`匯入完成\n新增: ${importResult.imported} 個條目\n跳過: ${importResult.skipped} 個重複條目`);
                            }
                        } else {
                            alert(`匯入完成\n新增: ${result.imported} 個條目`);
                        }
                    } catch (err) {
                        alert('匯入失敗: ' + err.message);
                    }
                    
                    cell.style.pointerEvents = '';
                });
                
                group.appendChild(cell);
            }
            
            listContainer.appendChild(group);
        }
    } catch (err) {
        listContainer.innerHTML = '';
        const errorState = createElement('div', 'text-center py-12 text-ios-danger');
        errorState.textContent = '載入失敗: ' + err.message;
        listContainer.appendChild(errorState);
    }
    
    return { element: container, cleanup: null };
}

export default {
    id: 'builtin-worldbooks',
    name: 'Builtin Worldbooks',
    icon: 'auto_stories',
    routes: [
        { path: '/builtin-worldbooks', render: renderBuiltinWorldbooks }
    ]
};