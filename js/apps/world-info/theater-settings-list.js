import Router from '../../router.js';
import { createElement, createIcon, createIOSNavBar, createToast } from '../../components.js';
import { TheaterSettingsDB, SettingsDB } from '../../db.js';

async function renderTheaterSettings() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createIOSNavBar({
        title: '粿初砞﹚',
        backPath: '/world-info',
        rightActions: [
            {
                icon: 'add',
                onClick: () => Router.navigate('/theater-settings/edit')
            }
        ]
    });
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.paddingTop = '16px';
    
    const entries = await TheaterSettingsDB.getAll();
    const mountedIds = await SettingsDB.get('theater_mounted_settings') || [];
    
    const listContainer = createElement('div', 'px-4');
    
    if (entries.length === 0) {
        const emptyState = createElement('div', 'text-center py-12 text-ios-muted');
        emptyState.textContent = '﹟ゼミヴ粿初砞﹚';
        listContainer.appendChild(emptyState);
    } else {
        const group = createElement('div', 'ios-grouped-list');
        
        entries.forEach(entry => {
            const cell = createElement('div', 'ios-list-cell ios-list-cell-full');
            
            const content = createElement('div', 'flex-1 min-h-[44px] flex flex-col justify-center');
            content.appendChild(createElement('span', 'text-base font-semibold', { textContent: entry.name }));
            
            const toggle = createElement('div', 'ios-toggle');
            if (mountedIds.includes(entry.id)) {
                toggle.classList.add('active');
            }
            toggle.onclick = async (e) => {
                e.stopPropagation();
                const newMountedIds = mountedIds.includes(entry.id)
                    ? mountedIds.filter(id => id !== entry.id)
                    : [...mountedIds, entry.id];
                await SettingsDB.set('theater_mounted_settings', newMountedIds);
                toggle.classList.toggle('active');
                createToast(mountedIds.includes(entry.id) ? '本更' : '本更', 'success');
            };
            
            cell.appendChild(content);
            cell.appendChild(toggle);
            
            cell.onclick = () => Router.navigate('/theater-settings/edit/' + entry.id);
            
            group.appendChild(cell);
        });
        
        listContainer.appendChild(group);
    }
    
    main.appendChild(listContainer);
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

export default {
    id: 'theater-settings',
    name: 'Theater Settings',
    icon: 'theater_comedy',
    routes: [
        { path: '/theater-settings', render: renderTheaterSettings }
    ]
};
