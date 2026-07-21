import Router from './router.js';
import { SettingsDB, initDB } from './db.js';
import { createElement, createIcon, createToast } from './components.js';
import LockScreen from './lockscreen.js';
import HomeScreen from './homescreen.js';

function isMobileDevice() {
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isSmallScreen = window.innerWidth < 768;
    return isMobileUA && isSmallScreen;
}

const App = {
    currentPage: null,
    currentPageCleanup: null,
    isMobile: false,
    phoneFrame: null,
    appContainer: null,
    isLocked: true,
    lockScreenEl: null,
    homeScreenEl: null,
    
    async init() {
        this.isMobile = isMobileDevice();
        
        if (!this.isMobile) {
            this.createPhoneFrame();
        }
        
        await initDB();
        
        this.showLockScreen();
        
        this.registerRoutes();
        Router.start();
        
        this.registerServiceWorker();
        this.setupInstallPrompt();
    },
    
    getAppContainer() {
        return this.appContainer || document.getElementById('app');
    },
    
    showLockScreen() {
        const app = this.getAppContainer();
        app.innerHTML = '';
        
        this.lockScreenEl = LockScreen.create({
            onUnlock: () => this.unlock()
        });
        app.appendChild(this.lockScreenEl);
        this.isLocked = true;
    },
    
    unlock() {
        if (this.lockScreenEl) {
            LockScreen.destroy();
        }
        
        const app = this.getAppContainer();
        app.innerHTML = '';
        
        this.homeScreenEl = HomeScreen.create();
        app.appendChild(this.homeScreenEl);
        this.isLocked = false;
    },
    
    lock() {
        if (this.currentPageCleanup) {
            this.currentPageCleanup();
            this.currentPageCleanup = null;
        }
        
        Router.navigate('/home');
        this.showLockScreen();
    },
    
    createPhoneFrame() {
        document.body.classList.add('desktop-mode');
        
        const frame = createElement('div', 'phone-frame');
        
        const notch = createElement('div', 'phone-notch');
        notch.appendChild(createElement('div', 'phone-notch-speaker'));
        notch.appendChild(createElement('div', 'phone-notch-camera'));
        frame.appendChild(notch);
        
        const screen = createElement('div', 'phone-screen');
        
        const appContainer = createElement('div', '');
        appContainer.id = 'app';
        screen.appendChild(appContainer);
        
        frame.appendChild(screen);
        
        const homeIndicator = createElement('div', 'phone-home-indicator');
        frame.appendChild(homeIndicator);
        
        document.body.appendChild(frame);
        
        const existingApp = document.getElementById('app');
        if (existingApp && existingApp !== appContainer) {
            existingApp.removeAttribute('id');
            existingApp.remove();
        }
        
        this.appContainer = appContainer;
        this.phoneFrame = frame;
    },
    
    registerRoutes() {
        Router.on('/home', async () => {
            if (!this.isLocked) {
                const app = this.getAppContainer();
                app.innerHTML = '';
                this.homeScreenEl = HomeScreen.create();
                app.appendChild(this.homeScreenEl);
            }
        });
        
        Router.on('/chats', async () => {
            if (this.isLocked) return;
            await this.loadPage('chats');
        });
        
        Router.on('/chat/:id', async (params) => {
            if (this.isLocked) return;
            await this.loadPage('chat', params);
        });
        
        Router.on('/world-info', async () => {
            if (this.isLocked) return;
            await this.loadPage('world-info');
        });
        
        Router.on('/entry-editor', async () => {
            if (this.isLocked) return;
            await this.loadPage('entry-editor');
        });
        
        Router.on('/entry-editor/:id', async (params) => {
            if (this.isLocked) return;
            await this.loadPage('entry-editor', params);
        });
        
        Router.on('/settings', async () => {
            if (this.isLocked) return;
            await this.loadPage('settings');
        });
        
        Router.on('/api-config', async () => {
            if (this.isLocked) return;
            await this.loadPage('api-config');
        });
    },
    
    async loadPage(pageName, params = {}) {
        const app = this.getAppContainer();
        
        if (this.currentPageCleanup) {
            this.currentPageCleanup();
            this.currentPageCleanup = null;
        }
        
        try {
            const module = await import(`./pages/${pageName}.js`);
            
            app.innerHTML = '';
            
            const { element, cleanup } = await module.render(params);
            app.appendChild(element);
            
            this.currentPage = pageName;
            this.currentPageCleanup = cleanup;
            
        } catch (error) {
            console.error(`Failed to load page: ${pageName}`, error);
            app.innerHTML = `
                <div class="empty-state">
                    <span class="material-symbols-outlined empty-state-icon">error</span>
                    <h3 class="empty-state-title">頁面載入失敗</h3>
                    <p class="empty-state-text">${error.message}</p>
                </div>
            `;
        }
    },
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('ServiceWorker registered:', registration.scope);
            } catch (error) {
                console.warn('ServiceWorker registration failed:', error);
            }
        }
    },
    
    setupInstallPrompt() {
        let deferredPrompt;
        
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredPrompt = e;
            
            const installBtn = document.createElement('button');
            installBtn.className = 'ios-btn ios-btn-primary fixed bottom-24 left-1/2 -translate-x-1/2 z-50 shadow-lg';
            installBtn.innerHTML = '<span class="material-symbols-outlined mr-1">install_mobile</span> 安裝 App';
            installBtn.onclick = async () => {
                installBtn.remove();
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log('Install prompt:', outcome);
                deferredPrompt = null;
            };
            document.body.appendChild(installBtn);
        });
    },
    
    navigate(path) {
        Router.navigate(path);
    },
    
    back() {
        Router.back();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    App.init();
});

window.App = App;