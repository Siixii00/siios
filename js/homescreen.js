import Router from './router.js';
import { createElement, createIcon } from './components.js';

const HomeScreen = {
    apps: [
        { id: 'chats', name: '聊天', icon: 'chat_bubble', color: '#34C759', path: '/chats' },
        { id: 'worldinfo', name: 'World Info', icon: 'menu_book', color: '#5856D6', path: '/world-info' },
        { id: 'settings', name: '設定', icon: 'settings', color: '#8E8E93', path: '/settings' },
    ],
    
    create() {
        const container = createElement('div', 'home-screen');
        
        const wallpaper = createElement('div', 'home-wallpaper');
        container.appendChild(wallpaper);
        
        const content = createElement('div', 'home-content');
        
        const grid = createElement('div', 'home-app-grid');
        
        this.apps.forEach(app => {
            const appIcon = this.createAppIcon(app);
            grid.appendChild(appIcon);
        });
        
        content.appendChild(grid);
        
        const dock = createElement('div', 'home-dock');
        const dockApps = this.apps.slice(0, 3);
        dockApps.forEach(app => {
            const appIcon = this.createDockIcon(app);
            dock.appendChild(appIcon);
        });
        content.appendChild(dock);
        
        const pageDots = createElement('div', 'home-page-dots');
        pageDots.appendChild(createElement('span', 'home-page-dot active'));
        content.appendChild(pageDots);
        
        container.appendChild(content);
        
        return container;
    },
    
    createAppIcon(app) {
        const iconContainer = createElement('div', 'home-app-icon');
        
        const iconBg = createElement('div', 'home-app-icon-bg');
        iconBg.style.background = app.color;
        iconBg.appendChild(createIcon(app.icon, 'text-white text-3xl', true));
        iconContainer.appendChild(iconBg);
        
        const label = createElement('span', 'home-app-label', { textContent: app.name });
        iconContainer.appendChild(label);
        
        iconContainer.addEventListener('click', () => {
            Router.navigate(app.path);
        });
        
        return iconContainer;
    },
    
    createDockIcon(app) {
        const iconContainer = createElement('div', 'home-dock-icon');
        
        const iconBg = createElement('div', 'home-dock-icon-bg');
        iconBg.style.background = app.color;
        iconBg.appendChild(createIcon(app.icon, 'text-white text-2xl', true));
        iconContainer.appendChild(iconBg);
        
        iconContainer.addEventListener('click', () => {
            Router.navigate(app.path);
        });
        
        return iconContainer;
    }
};

export default HomeScreen;