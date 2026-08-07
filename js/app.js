import Router from './router.js';
import { SettingsDB, initDB } from './db.js';
import { createElement, createIcon, createToast, createErrorModal } from './components.js';
import LockScreen from './lockscreen.js';
import HomeScreen from './homescreen.js';
import { registerRoutes } from './apps/registry.js';
import { MemorySystem } from './core/memory-system/index.js';
import { initActivityAPI } from './activity-interceptor.js';
import { ziweiLazyLoader } from './core/ziwei-lazy-loader.js';

window.showError = function(errorInfo) {
    const info = typeof errorInfo === 'string' 
        ? { message: errorInfo } 
        : errorInfo;
    console.error('[App Error]', info);
    createErrorModal({
        title: info.title || '發生錯誤',
        message: info.message || '未知錯誤',
        details: info.details || '',
        timestamp: info.timestamp || new Date().toISOString()
    });
};

// 全局錯誤處理
window.addEventListener('error', (event) => {
    console.error('[全局錯誤]', event.error);
    window.showError({
        message: event.error?.message || '未知錯誤',
        title: '應用程式錯誤',
        details: event.error?.stack || JSON.stringify(event.error)
    });
});

window.addEventListener('unhandledrejection', (event) => {
    console.error('[未處理的 Promise 拒絕]', event.reason);
    window.showError({
        message: event.reason?.message || String(event.reason),
        title: '異步操作錯誤',
        details: event.reason?.stack || ''
    });
});

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
        try {
            // 檢測 Safari PWA
            const isSafariPWA = window.navigator.standalone === true;
            const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
            
            console.log('[App] 環境檢測:', {
                isSafariPWA,
                isSafari,
                userAgent: navigator.userAgent,
                timestamp: new Date().toISOString()
            });
            
            // 如果是 Safari PWA，添加特殊處理
            if (isSafariPWA) {
                console.log('[App] Safari PWA 模式，啟用兼容性處理');
            }
            
            this.isMobile = isMobileDevice();
            console.log('[App] 設備類型:', this.isMobile ? '移動設備' : '桌面設備');
            
            if (!this.isMobile) {
                this.createPhoneFrame();
            }
            
            console.log('[App] 開始初始化數據庫...');
            await initDB();
            console.log('[App] 數據庫初始化成功');
            
            console.log('[App] 載入設定...');
            const allSettings = await SettingsDB.getAll();
            const defaults = SettingsDB.getDefaults();
            const mergedSettings = { ...defaults, ...allSettings };
            console.log('[App] 設定載入完成');
            
            console.log('[App] 初始化記憶系統...');
            const memorySystem = new MemorySystem({
                decayRate: mergedSettings.memory_decay_rate,
                embedding: {
                    embedding_url: mergedSettings.embedding_url,
                    api_url: mergedSettings.api_url,
                    embedding_model: mergedSettings.embedding_model,
                    embedding_dimensions: mergedSettings.embedding_dimensions,
                    embedding_api_key: mergedSettings.embedding_api_key,
                    api_key: mergedSettings.api_key
                },
                classifier: {
                    api_url: mergedSettings.api_url,
                    api_key: mergedSettings.api_key,
                    model: mergedSettings.model
                }
            });
            this.memorySystem = memorySystem;
            if (mergedSettings.memory_enabled) {
                console.log('[App] 啟動記憶系統...');
                memorySystem.start();
            }
            console.log('[App] 記憶系統初始化完成');
            
            console.log('[App] 註冊路由...');
            await registerRoutes();
            console.log('[App] 路由註冊完成');
            
            this.showLockScreen();
            
            Router.on('/', async () => {
                Router.navigate('/home');
            });
            
            Router.on('/home', async () => {
                if (!this.isLocked) {
                    const app = this.getAppContainer();
                    app.innerHTML = '';
                    try {
                        this.homeScreenEl = await HomeScreen.create();
                        if (this.homeScreenEl) {
                            app.appendChild(this.homeScreenEl);
                        }
                    } catch (err) {
                        console.error('Failed to create home screen:', err);
                        window.showError({
                            message: '無法創建主畫面: ' + err.message,
                            title: '主畫面錯誤',
                            details: err.stack
                        });
                    }
                }
            });
            
            Router.start(true);
            
            console.log('[App] 初始化活動 API...');
            initActivityAPI();
            
            console.log('[App] 啟動紫微斗數懶加載器...');
            ziweiLazyLoader.startDayChangeDetection();
            
            this.registerServiceWorker();
            this.setupInstallPrompt();
            
            console.log('[App] 應用初始化完成');
        } catch (error) {
            console.error('[App] 初始化失敗:', error);
            window.showError({
                message: '應用初始化失敗: ' + error.message,
                title: '初始化錯誤',
                details: error.stack
            });
        }
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
    
    async unlock() {
        if (this.lockScreenEl) {
            LockScreen.destroy();
        }
        
        this.isLocked = false;
        
        const app = this.getAppContainer();
        app.innerHTML = '';
        
        try {
            this.homeScreenEl = await HomeScreen.create();
            if (this.homeScreenEl) {
                app.appendChild(this.homeScreenEl);
            }
        } catch (err) {
            console.error('Failed to create home screen:', err);
        }
        
        window.location.hash = '/home';
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
    
    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('/siios/sw.js');
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
            installBtn.innerHTML = "<span class='material-symbols-outlined mr-1'>install_mobile</span> 安裝 App";
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
    
    async handleRoute() {
        await Router.handleRoute();
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