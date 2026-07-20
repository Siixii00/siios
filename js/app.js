import Router from './router.js';
import { SettingsDB, initDB } from './db.js';
import { createElement, createIcon, createToast } from './components.js';

const App = {
    currentPage: null,
    currentPageCleanup: null,
    
    async init() {
        await initDB();
        
        this.registerRoutes();
        Router.start();
        
        this.registerServiceWorker();
        this.setupInstallPrompt();
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