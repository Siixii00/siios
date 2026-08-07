// 手機端滑動邏輯優化
class ScrollHandler {
    constructor() {
        this.init();
    }
    
    init() {
        // 檢測是否為移動設備
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
        const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        
        if (isMobile || isPWA) {
            console.log('[Scroll] 啟用移動端滑動優化');
            this.setupScrollHandlers();
            this.fixSafariScrolling();
        }
    }
    
    setupScrollHandlers() {
        // 監聽路由變化，為每個新頁面添加滑動支持
        window.addEventListener('hashchange', () => {
            setTimeout(() => this.fixCurrentPage(), 100);
        });
        
        // 初始頁面載入後修復
        setTimeout(() => this.fixCurrentPage(), 500);
    }
    
    fixCurrentPage() {
        const appContainer = document.querySelector('.app-container');
        if (!appContainer) return;
        
        // 確保 app-container 有正確的高度和 overflow 設置
        appContainer.style.height = '100vh';
        appContainer.style.height = '100dvh';
        appContainer.style.overflow = 'hidden';
        appContainer.style.display = 'flex';
        appContainer.style.flexDirection = 'column';
        
        // 找到主要的內容區域
        const mainContent = appContainer.querySelector('main') || 
                           appContainer.querySelector('.flex-1') ||
                           appContainer.querySelector('.page-content');
        
        if (mainContent) {
            // 設置滑動屬性
            mainContent.style.flex = '1';
            mainContent.style.overflowY = 'auto';
            mainContent.style.overflowX = 'hidden';
            mainContent.style.webkitOverflowScrolling = 'touch';
            mainContent.style.overscrollBehaviorY = 'contain';
            
            console.log('[Scroll] 已修復頁面滑動:', mainContent);
        }
        
        // 修復特定的應用容器
        this.fixSpecificApps();
    }
    
    fixSpecificApps() {
        // 修復聊天頁面
        const chatContainer = document.querySelector('.kakao-chat-bg');
        if (chatContainer) {
            const main = chatContainer.querySelector('main');
            if (main) {
                main.style.overflowY = 'auto';
                main.style.overflowX = 'hidden';
                main.style.webkitOverflowScrolling = 'touch';
            }
        }
        
        // 修復列表頁面
        const listContainers = document.querySelectorAll('.overflow-y-auto');
        listContainers.forEach(container => {
            container.style.webkitOverflowScrolling = 'touch';
            container.style.overscrollBehaviorY = 'contain';
        });
    }
    
    fixSafariScrolling() {
        // 修復 Safari 的滑動問題
        document.body.addEventListener('touchmove', function(e) {
            // 允許滑動的元素
            const scrollable = e.target.closest('.overflow-y-auto, .overflow-auto, main, .page-content');
            
            if (!scrollable) {
                // 如果點擊的不是可滑動區域，阻止默認行為（防止整頁滾動）
                if (e.target.closest('.app-container')) {
                    e.preventDefault();
                }
            }
        }, { passive: false });
        
        // 處理輸入框獲得焦點時的滑動問題
        document.addEventListener('focus', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                // 延遲執行，等待鍵盤彈出
                setTimeout(() => {
                    e.target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 300);
            }
        }, true);
    }
}

// 自動初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new ScrollHandler());
} else {
    new ScrollHandler();
}
