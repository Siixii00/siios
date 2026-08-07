import Router from '../../router.js';
import { createElement, createIcon } from '../../components.js';
import builtinWorldbooks from './builtin-worldbooks.js';


async function renderWorldInfo() {
    const container = createElement('div', 'app-container bg-ios-bg');
    
    const header = createElement('header', 'ios-nav-bar');
    header.style.position = 'relative';
    header.style.zIndex = '5';
    header.style.paddingTop = '46px';
    header.style.borderBottom = '1px solid rgba(20, 20, 19, 0.12)';
    header.style.background = 'rgba(250, 249, 246, 0.92)';
    
    const inner = createElement('div', 'ios-nav-bar-inner');
    inner.style.position = 'relative';
    inner.style.display = 'flex';
    inner.style.height = '44px';
    inner.style.padding = '0 16px 0 9px';
    inner.style.alignItems = 'center';
    
    const backBtn = createElement('button', 'ios-btn', {
        onClick: () => Router.navigate('/home')
    });
    backBtn.style.background = 'transparent';
    backBtn.style.border = 'none';
    backBtn.style.color = '#000';
    backBtn.style.fontSize = '16px';
    backBtn.style.fontFamily = 'Inter, sans-serif';
    backBtn.style.fontWeight = '400';
    backBtn.style.lineHeight = '24px';
    backBtn.style.display = 'flex';
    backBtn.style.alignItems = 'center';
    backBtn.style.gap = '4px';
    backBtn.style.cursor = 'pointer';
    backBtn.style.position = 'relative';
    backBtn.style.zIndex = '2';
    
    const backIcon = createIcon('chevron_left');
    backBtn.appendChild(backIcon);
    backBtn.appendChild(createElement('span', '', { textContent: '返回' }));
    inner.appendChild(backBtn);
    
    const titleContainer = createElement('div', '');
    titleContainer.style.position = 'absolute';
    titleContainer.style.left = '50%';
    titleContainer.style.transform = 'translateX(-50%)';
    titleContainer.style.color = '#111827';
    titleContainer.style.fontFamily = 'Inter, sans-serif';
    titleContainer.style.fontSize = '32px';
    titleContainer.style.fontStyle = 'normal';
    titleContainer.style.fontWeight = '400';
    titleContainer.style.lineHeight = '38.4px';
    titleContainer.style.letterSpacing = '-0.5px';
    titleContainer.style.whiteSpace = 'nowrap';
    titleContainer.textContent = 'World Info';
    inner.appendChild(titleContainer);
    
    header.appendChild(inner);
    container.appendChild(header);
    
    const main = createElement('main', 'flex-1');
    main.style.position = 'relative';
    main.style.zIndex = '1';
    main.style.display = 'flex';
    main.style.height = '540px';
    main.style.padding = '20px 0 306px 0';
    main.style.flexDirection = 'column';
    main.style.alignItems = 'center';
    main.style.gap = '8px';
    main.style.overflowY = 'auto';
    
    const searchBar = createElement('div', 'ios-search-bar');
    searchBar.style.display = 'flex';
    searchBar.style.width = '319px';
    searchBar.style.height = '36px';
    searchBar.style.padding = '0 8px';
    searchBar.style.alignItems = 'center';
    searchBar.style.flexShrink = '0';
    searchBar.style.background = 'rgba(20, 20, 19, 0.06)';
    searchBar.style.borderRadius = '0px';
    searchBar.style.marginBottom = '8px';
    
    const searchIcon = createElement('div', '');
    searchIcon.style.width = '24.02px';
    searchIcon.style.height = '28px';
    searchIcon.style.flexShrink = '0';
    searchIcon.style.display = 'flex';
    searchIcon.style.alignItems = 'center';
    searchIcon.style.justifyContent = 'center';
    searchIcon.innerHTML = '<svg xmlns='http://www.w3.org/2000/svg' width='25' height='28' viewBox='0 0 25 28' fill='none'><path d='M19.3989 22.75L13.2739 16.625C12.7878 17.0139 12.2287 17.3218 11.5968 17.5486C10.9649 17.7755 10.2924 17.8889 9.57944 17.8889C7.81324 17.8889 6.31844 17.2772 5.09506 16.0538C3.87168 14.8304 3.25999 13.3356 3.25999 11.5694C3.25999 9.80324 3.87168 8.30845 5.09506 7.08507C6.31844 5.86169 7.81324 5.25 9.57944 5.25C11.3456 5.25 12.8404 5.86169 14.0638 7.08507C15.2872 8.30845 15.8989 9.80324 15.8989 11.5694C15.8989 12.2824 15.7855 12.9549 15.5586 13.5868C15.3318 14.2187 15.0239 14.7778 14.635 15.2639L20.76 21.3889L19.3989 22.75ZM9.57944 15.9444C10.7947 15.9444 11.8277 15.5191 12.6784 14.6684C13.5291 13.8177 13.9544 12.7847 13.9544 11.5694C13.9544 10.3542 13.5291 9.32118 12.6784 8.47049C11.8277 7.61979 10.7947 7.19444 9.57944 7.19444C8.36416 7.19444 7.33118 7.61979 6.48048 8.47049C5.62979 9.32118 5.20444 10.3542 5.20444 11.5694C5.20444 12.7847 5.62979 13.8177 6.48048 14.6684C7.33118 15.5191 8.36416 15.9444 9.57944 15.9444Z' fill='#6B6B6B'/></svg>';
    searchBar.appendChild(searchIcon);
    
    const placeholder = createElement('div', '');
    placeholder.style.display = 'flex';
    placeholder.style.width = '278.98px';
    placeholder.style.padding = '2px 0';
    placeholder.style.flexDirection = 'column';
    placeholder.style.alignItems = 'flex-start';
    
    const placeholderText = createElement('span', '');
    placeholderText.style.color = '#757575';
    placeholderText.style.fontFamily = 'Arial, sans-serif';
    placeholderText.style.fontSize = '17px';
    placeholderText.style.fontStyle = 'normal';
    placeholderText.style.fontWeight = '400';
    placeholderText.style.lineHeight = 'normal';
    placeholderText.textContent = '搜尋';
    placeholder.appendChild(placeholderText);
    
    searchBar.appendChild(placeholder);
    main.appendChild(searchBar);
    
    const listContainer = createElement('div', '');
    listContainer.style.display = 'flex';
    listContainer.style.flexDirection = 'column';
    listContainer.style.alignItems = 'center';
    listContainer.style.width = '100%';
    listContainer.style.padding = '0 16px';
    listContainer.style.gap = '0';
    
    const settingsCells = [
        {
            title: '內建世界書',
            description: '安裝並管理內建的世界書',
            onClick: () => Router.navigate('/builtin-worldbooks')
        },
        {
            title: '全局設定',
            description: '管理全局設定項目',
            onClick: () => Router.navigate('/global-settings')
        },
        {
            title: '全局禁詞',
            description: '管理全局禁詞列表',
            onClick: () => Router.navigate('/global-forbidden')
        },
        {
            title: '劇場設定',
            description: '管理不同劇場的設定',
            onClick: () => Router.navigate('/theater-settings')
        },
        {
            title: '關鍵字設定',
            description: '管理關鍵字觸發設定',
            onClick: () => Router.navigate('/keyword-settings')
        }
    ];
    
    settingsCells.forEach((cellData, index) => {
        const cell = createElement('div', 'ios-list-cell', {
            onClick: cellData.onClick
        });
        cell.style.display = 'flex';
        cell.style.minHeight = '44px';
        cell.style.padding = '12px 16px';
        cell.style.justifyContent = 'space-between';
        cell.style.alignItems = 'center';
        cell.style.background = '#FFF';
        cell.style.width = '100%';
        cell.style.maxWidth = '319px';
        cell.style.boxSizing = 'border-box';
        
        if (index < settingsCells.length - 1) {
            cell.style.borderBottom = '1px solid rgba(20, 20, 19, 0.12)';
        }
        
        const content = createElement('div', 'flex-1');
        content.style.display = 'flex';
        content.style.minHeight = '64px';
        content.style.width = '255px';
        content.style.padding = '9.5px 0';
        content.style.flexDirection = 'column';
        content.style.justifyContent = 'center';
        content.style.alignItems = 'flex-start';
        content.style.boxSizing = 'border-box';
        
        const title = createElement('span', '');
        title.style.color = '#111827';
        title.style.fontFamily = 'Inter, sans-serif';
        title.style.fontSize = '16px';
        title.style.fontStyle = 'normal';
        title.style.fontWeight = '600';
        title.style.lineHeight = '24px';
        title.textContent = cellData.title;
        
        const description = createElement('span', '');
        description.style.color = '#6B6B6B';
        description.style.fontFamily = 'Inter, sans-serif';
        description.style.fontSize = '14px';
        description.style.fontStyle = 'normal';
        description.style.fontWeight = '400';
        description.style.lineHeight = '21px';
        description.textContent = cellData.description;
        
        content.appendChild(title);
        content.appendChild(description);
        cell.appendChild(content);
        cell.appendChild(createIcon('chevron_right', 'text-ios-muted'));
        
        listContainer.appendChild(cell);
    });
    
    main.appendChild(listContainer);
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

export default {
    id: 'world-info',
    name: 'World Info',
    icon: 'menu_book',
    routes: [
        { path: '/world-info', render: renderWorldInfo },
        ...builtinWorldbooks.routes
    ],
    navItem: {
        label: 'World Info',
        icon: 'menu_book',
        path: '/world-info',
        showInNav: true,
        order: 2
    },
    stylesPath: 'js/apps/world-info/style.css'
};