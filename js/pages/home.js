import Router from '../router.js';
import { createElement, createIcon, createKakaoBottomNav } from '../components.js';

function render() {
    const container = createElement('div', 'app-container min-h-screen');
    container.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
    
    const main = createElement('main', 'flex-1 flex flex-col items-center justify-center p-8');
    
    const logo = createElement('div', 'mb-8');
    logo.appendChild(createIcon('smart_toy', 'text-white text-7xl', true));
    main.appendChild(logo);
    
    const title = createElement('h1', 'text-4xl font-bold text-white mb-2', { textContent: 'iOS Classic AI' });
    main.appendChild(title);
    
    const subtitle = createElement('p', 'text-white/80 text-lg mb-12', { textContent: '你的 AI 互動平台' });
    main.appendChild(subtitle);
    
    const grid = createElement('div', 'grid grid-cols-3 gap-6 w-full max-w-sm');
    
    const chatIcon = createAppIcon('chat_bubble', '聊天', '/chats');
    grid.appendChild(chatIcon);
    
    const worldInfoIcon = createAppIcon('menu_book', 'World Info', '/world-info');
    grid.appendChild(worldInfoIcon);
    
    const settingsIcon = createAppIcon('settings', '設定', '/settings');
    grid.appendChild(settingsIcon);
    
    main.appendChild(grid);
    
    const hint = createElement('p', 'text-white/60 text-sm mt-12', { textContent: '點擊圖標開始' });
    main.appendChild(hint);
    
    container.appendChild(main);
    
    return { element: container, cleanup: null };
}

function createAppIcon(iconName, label, path) {
    const iconContainer = createElement('div', 'flex flex-col items-center gap-2 cursor-pointer active:scale-95 transition-transform');
    
    const iconBg = createElement('div', 'w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center shadow-lg');
    iconBg.appendChild(createIcon(iconName, 'text-white text-3xl', true));
    iconContainer.appendChild(iconBg);
    
    const labelEl = createElement('span', 'text-white text-sm font-medium', { textContent: label });
    iconContainer.appendChild(labelEl);
    
    iconContainer.onclick = () => Router.navigate(path);
    
    return iconContainer;
}

export { render };