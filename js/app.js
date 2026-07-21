import Router from './router.js';
import { SettingsDB, initDB } from './db.js';
import { createElement, createIcon, createToast } from './components.js';

function isMobileDevice() {
    const ua = navigator.userAgent.toLowerCase();
    const isMobileUA = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth < 768;
    return isMobileUA && isSmallScreen;
}

const App = {
    currentPage: null,
    currentPageCleanup: null,
    isMobile: false,
    phoneFrame: null,
    
    async init() {
        this.isMobile = isMobileDevice();
        
        if (!this.isMobile) {
            this.createPhoneFrame();
        }
        
        await initDB();
        
        this.registerRoutes();
        Router.start();
        
        this.registerServiceWorker();
        this.setupInstallPrompt();
    },
    
    createPhoneFrame() {
        document.body.classList.add('desktop-mode');
        
        const frame = createElement('div', 'phone-frame');
        
        const notch = createElement('div', 'phone-notch');
        notch.appendChild(createElement('div', 'phone-notch-speaker'));
        notch.appendChild(createElement('div', 'phone-notch-camera'));
        frame.appendChild(notch);
        
        const screen = createElement('div', 'phone-screen');
        frame.appendChild(screen);
        
        const homeIndicator = createElement('div', 'phone-home-indicator');
        frame.appendChild(homeIndicator);
        
        document.body.appendChild(frame);
        
        const app = document.getElementById('app');
        screen.appendChild(app);
        
        this.phoneFrame = frame;
    },
    
    registerRoutes() {
        Router.on('/home', async () => {
            await this.loadPage('home');
        });
        
        Router.on('/chats', async () => {
            await this.loadPage('chats');
        });
        
        Router.on('/chat/:id', async (params) => {
            await this.loadPage('chat', params);
        });
        
        Router.on('/world-info', async () => {
            await this.loadPage('world-info');
        });
        
        Router.on('/entry-editor', async () => {
            await this.loadPage('entry-editor');
        });
        
        Router.on('/entry-editor/:id', async (params) => {
            await this.loadPage('entry-editor', params);
        });
        
        Router.on('/settings', async () => {
            await this.loadPage('settings');
        });
        
        Router.on('/api-config', async () => {
            await this.loadPage('api-config');
        });
    },
    
    async loadPage(pageName, params = {}) {
        const app = document.getElementById('app');
        
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