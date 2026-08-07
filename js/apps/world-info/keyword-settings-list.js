import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar } from '../../components.js';
import { KeywordSettingsDB } from '../../db.js';

async function renderKeywordSettings() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createIOSNavBar({
        title: '關鍵字設定',
        backPath: '/world-info',
        rightActions: [
            {
                icon: 'add',
                onClick: () => Router.navigate('/keyword-settings/edit')
            }
        ]
    });
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';
    
    const entries = await KeywordSettingsDB.getAll();
    
    const listContainer = createElement('div', 'px-4');
    
    if (entries.length === 0) {
        const emptyState = createElement('div', 'text-center py-12 text-ios-muted');
        emptyState.textContent = '尚未建立任何關鍵字設定';
        listContainer.appendChild(emptyState);
    } else {
        const group = createElement('div', 'ios-grouped-list');
        
        entries.forEach(entry => {
            const cell = createElement('div', 'ios-list-cell ios-list-cell-full', {
                onClick: () => Router.navigate('/keyword-settings/edit/' + entry.id)
            });
            
            const content = createElement('div', 'flex-1 min-h-[44px] flex flex-col justify-center');
            content.appendChild(createElement('span', 'text-base font-semibold', { textContent: entry.name }));
            
            if (entry.keywords && entry.keywords.length > 0) {
                const keywordsEl = createElement('span', 'text-sm text-ios-muted');
                keywordsEl.textContent = entry.keywords.slice(0, 3).join(', ') + (entry.keywords.length > 3 ? '...' : '');
                content.appendChild(keywordsEl);
            }
            
            cell.appendChild(content);
            cell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
            
            group.appendChild(cell);
        });
        
        listContainer.appendChild(group);
    }
    
    main.appendChild(listContainer);
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

export default {
    id: 'keyword-settings',
    name: 'Keyword Settings',
    icon: 'key',
    routes: [
        { path: '/keyword-settings', render: renderKeywordSettings }
    ]
};
