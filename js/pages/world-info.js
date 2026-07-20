import Router from '../router.js';
import { createElement, createIcon, createIOSNavBar, createIOSSearchBar, createEmptyState, createToast } from '../components.js';
import { WorldInfoDB } from '../db.js';

let entries = [];

async function render() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createIOSNavBar({
        title: 'World Info',
        largeTitle: true,
        rightActions: [
            {
                icon: 'add',
                onClick: () => Router.navigate('/entry-editor')
            }
        ]
    });
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pt-2 pb-24');
    
    const searchBar = createIOSSearchBar((term) => {
        filterEntries(term);
    });
    searchBar.classList.add('mb-4');
    main.appendChild(searchBar);
    
    entries = await WorldInfoDB.getAll();
    
    const listContainer = createElement('div', 'px-4');
    
    if (entries.length === 0) {
        const emptyState = createEmptyState(
            'menu_book',
            '沒有 World Info',
            '點擊右上角 + 按鈕新增條目',
            {
                label: '新增條目',
                onClick: () => Router.navigate('/entry-editor')
            }
        );
        listContainer.appendChild(emptyState);
    } else {
        const group = createElement('div', 'ios-grouped-list');
        
        entries.forEach(entry => {
            const cell = createElement('div', 'ios-list-cell ios-list-cell-full', {
                onClick: () => Router.navigate(`/entry-editor/${entry.id}`)
            });
            
            const content = createElement('div', 'flex-1 min-h-[64px] flex flex-col justify-center');
            content.appendChild(createElement('span', 'text-base font-semibold', { textContent: entry.name }));
            content.appendChild(createElement('span', 'text-sm text-ios-muted line-clamp-2', { textContent: entry.content }));
            
            cell.appendChild(content);
            cell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
            
            group.appendChild(cell);
        });
        
        listContainer.appendChild(group);
    }
    
    main.appendChild(listContainer);
    container.appendChild(main);
    
    const nav = createElement('div', 'ios-bottom-nav safe-area-bottom');
    
    const chatsTab = createElement('a', 'ios-bottom-nav-item', {
        href: '/#/chats',
        onClick: (e) => {
            e.preventDefault();
            Router.navigate('/chats');
        }
    });
    chatsTab.appendChild(createIcon('chat_bubble'));
    chatsTab.appendChild(createElement('span', 'label', { textContent: 'Chats' }));
    nav.appendChild(chatsTab);
    
    const worldInfoTab = createElement('a', 'ios-bottom-nav-item active');
    worldInfoTab.appendChild(createIcon('menu_book', '', true));
    worldInfoTab.appendChild(createElement('span', 'label', { textContent: 'World Info' }));
    nav.appendChild(worldInfoTab);
    
    const settingsTab = createElement('a', 'ios-bottom-nav-item', {
        href: '/#/settings',
        onClick: (e) => {
            e.preventDefault();
            Router.navigate('/settings');
        }
    });
    settingsTab.appendChild(createIcon('settings'));
    settingsTab.appendChild(createElement('span', 'label', { textContent: 'Settings' }));
    nav.appendChild(settingsTab);
    
    container.appendChild(nav);
    
    function filterEntries(term) {
        const lowerTerm = term.toLowerCase();
        const cells = listContainer.querySelectorAll('.ios-list-cell');
        
        cells.forEach((cell, index) => {
            const entry = entries[index];
            if (!entry) return;
            
            const nameMatch = entry.name.toLowerCase().includes(lowerTerm);
            const keywordsMatch = entry.keywords.some(k => k.toLowerCase().includes(lowerTerm));
            
            if (nameMatch || keywordsMatch || term === '') {
                cell.style.display = '';
            } else {
                cell.style.display = 'none';
            }
        });
    }
    
    return { element: container, cleanup: null };
}

export { render };