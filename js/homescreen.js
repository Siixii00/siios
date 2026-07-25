import Router from './router.js';
import { createElement, createIcon } from './components.js';
import { getNavItems } from './apps/registry.js';

const APPS_PER_PAGE = 8;

const HomeScreen = {
    apps: [],
    currentPage: 0,
    totalPages: 1,
    touchStartX: 0,
    touchCurrentX: 0,
    isDragging: false,
    pagesContainer: null,
    dotsContainer: null,

    async create() {
        this.apps = await getNavItems();
        this.totalPages = Math.ceil(this.apps.length / APPS_PER_PAGE) || 1;
        this.currentPage = 0;

        const container = createElement('div', 'home-screen');

        const wallpaper = createElement('div', 'home-wallpaper');
        container.appendChild(wallpaper);

        const content = createElement('div', 'home-content');

        const pagesWrapper = createElement('div', 'home-pages-wrapper');
        this.pagesContainer = createElement('div', 'home-pages');

        for (let p = 0; p < this.totalPages; p++) {
            const page = createElement('div', 'home-page');
            const grid = createElement('div', 'home-app-grid');
            const start = p * APPS_PER_PAGE;
            const pageApps = this.apps.slice(start, start + APPS_PER_PAGE);

            pageApps.forEach(app => {
                const appIcon = this.createAppIcon({
                    id: app.label.toLowerCase().replace(/\s+/g, '-'),
                    name: app.label,
                    icon: app.icon,
                    color: this.getColorForApp(app.label),
                    path: app.path
                });
                grid.appendChild(appIcon);
            });

            page.appendChild(grid);
            this.pagesContainer.appendChild(page);
        }

        pagesWrapper.appendChild(this.pagesContainer);
        content.appendChild(pagesWrapper);

        this.dotsContainer = createElement('div', 'home-page-dots');
        this.renderDots();
        content.appendChild(this.dotsContainer);

        const dock = createElement('div', 'home-dock');
        const dockApps = this.apps.slice(0, 3);
        dockApps.forEach(app => {
            const appIcon = this.createDockIcon({
                id: app.label.toLowerCase().replace(/\s+/g, '-'),
                name: app.label,
                icon: app.icon,
                color: this.getColorForApp(app.label),
                path: app.path
            });
            dock.appendChild(appIcon);
        });
        content.appendChild(dock);

        container.appendChild(content);

        this.setupSwipe(pagesWrapper);

        return container;
    },

    renderDots() {
        this.dotsContainer.innerHTML = '';
        for (let i = 0; i < this.totalPages; i++) {
            const dot = createElement('span', `home-page-dot${i === this.currentPage ? ' active' : ''}`);
            this.dotsContainer.appendChild(dot);
        }
    },

    goToPage(index) {
        if (index < 0 || index >= this.totalPages) return;
        this.currentPage = index;
        this.pagesContainer.style.transform = `translateX(-${index * 100}%)`;
        this.renderDots();
    },

    setupSwipe(wrapper) {
        const handleStart = (x) => {
            this.isDragging = true;
            this.touchStartX = x;
            this.touchCurrentX = x;
            this.pagesContainer.style.transition = 'none';
        };

        const handleMove = (x) => {
            if (!this.isDragging) return;
            this.touchCurrentX = x;
            const diff = this.touchCurrentX - this.touchStartX;
            const offset = -this.currentPage * 100;
            const pxToPercent = (diff / wrapper.offsetWidth) * 100;
            this.pagesContainer.style.transform = `translateX(${offset + pxToPercent}%)`;
        };

        const handleEnd = () => {
            if (!this.isDragging) return;
            this.isDragging = false;
            this.pagesContainer.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';

            const diff = this.touchCurrentX - this.touchStartX;
            const threshold = wrapper.offsetWidth * 0.2;

            if (diff < -threshold && this.currentPage < this.totalPages - 1) {
                this.goToPage(this.currentPage + 1);
            } else if (diff > threshold && this.currentPage > 0) {
                this.goToPage(this.currentPage - 1);
            } else {
                this.goToPage(this.currentPage);
            }
        };

        wrapper.addEventListener('touchstart', (e) => {
            handleStart(e.touches[0].clientX);
        }, { passive: true });

        wrapper.addEventListener('touchmove', (e) => {
            handleMove(e.touches[0].clientX);
        }, { passive: true });

        wrapper.addEventListener('touchend', handleEnd);

        wrapper.addEventListener('mousedown', (e) => {
            handleStart(e.clientX);
        });

        wrapper.addEventListener('mousemove', (e) => {
            if (this.isDragging) handleMove(e.clientX);
        });

        wrapper.addEventListener('mouseup', handleEnd);
        wrapper.addEventListener('mouseleave', handleEnd);
    },

    getColorForApp(name) {
        const colors = {
            'Chats': '#34C759',
            'World Info': '#5856D6',
            'Settings': '#8E8E93'
        };
        return colors[name] || '#007AFF';
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
