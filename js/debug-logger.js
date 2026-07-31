// 可視化調試日誌器 - 在手機上顯示 console 日誌
class DebugLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 50;
        this.isExpanded = false;
        this.container = null;
        this.enabled = true;
        
        // 檢測是否為移動設備或 Safari PWA
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
        const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        
        if (isMobile || isPWA) {
            this.enabled = true;
            this.createUI();
            this.interceptConsole();
        }
    }
    
    createUI() {
        // 創建調試按鈕
        const btn = document.createElement('button');
        btn.id = 'debug-logger-btn';
        btn.textContent = '🐛';
        btn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            width: 50px;
            height: 50px;
            border-radius: 50%;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            border: none;
            font-size: 24px;
            cursor: pointer;
            z-index: 9999;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
        `;
        btn.onclick = () => this.toggle();
        document.body.appendChild(btn);
        
        // 創建日誌容器
        this.container = document.createElement('div');
        this.container.id = 'debug-logger-container';
        this.container.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: calc(100vw - 40px);
            max-width: 400px;
            max-height: 60vh;
            background: rgba(0, 0, 0, 0.9);
            color: white;
            border-radius: 12px;
            padding: 12px;
            z-index: 9998;
            display: none;
            flex-direction: column;
            gap: 8px;
            overflow: hidden;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
        `;
        
        // 標題欄
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        `;
        header.innerHTML = `
            <span style="font-weight: bold;">Debug Logs</span>
            <button id="debug-logger-clear" style="background: transparent; border: none; color: white; cursor: pointer; padding: 4px 8px;">清除</button>
        `;
        this.container.appendChild(header);
        
        // 日誌列表
        this.logsContainer = document.createElement('div');
        this.logsContainer.style.cssText = `
            overflow-y: auto;
            flex: 1;
            font-family: monospace;
            font-size: 11px;
            line-height: 1.4;
        `;
        this.container.appendChild(this.logsContainer);
        
        document.body.appendChild(this.container);
        
        // 清除按鈕事件
        document.getElementById('debug-logger-clear').onclick = () => this.clearLogs();
    }
    
    interceptConsole() {
        const methods = ['log', 'error', 'warn', 'info'];
        
        methods.forEach(method => {
            const original = console[method].bind(console);
            console[method] = (...args) => {
                original(...args);
                this.addLog(method, args);
            };
        });
    }
    
    addLog(type, args) {
        const timestamp = new Date().toLocaleTimeString('zh-TW', { hour12: false });
        const message = args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    return JSON.stringify(arg, null, 2);
                } catch (e) {
                    return String(arg);
                }
            }
            return String(arg);
        }).join(' ');
        
        this.logs.push({ type, timestamp, message });
        
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }
        
        this.updateUI();
    }
    
    updateUI() {
        if (!this.logsContainer || !this.isExpanded) return;
        
        this.logsContainer.innerHTML = '';
        
        this.logs.forEach(log => {
            const logEl = document.createElement('div');
            logEl.style.cssText = `
                padding: 4px 8px;
                border-radius: 4px;
                margin-bottom: 4px;
                background: ${this.getLogColor(log.type)};
                word-wrap: break-word;
                white-space: pre-wrap;
            `;
            logEl.innerHTML = `<span style="opacity: 0.7;">[${log.timestamp}]</span> ${this.escapeHtml(log.message)}`;
            this.logsContainer.appendChild(logEl);
        });
        
        // 滾動到底部
        this.logsContainer.scrollTop = this.logsContainer.scrollHeight;
    }
    
    getLogColor(type) {
        switch (type) {
            case 'error': return 'rgba(220, 38, 38, 0.3)';
            case 'warn': return 'rgba(217, 119, 6, 0.3)';
            case 'info': return 'rgba(59, 130, 246, 0.3)';
            default: return 'rgba(75, 85, 99, 0.3)';
        }
    }
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    toggle() {
        this.isExpanded = !this.isExpanded;
        this.container.style.display = this.isExpanded ? 'flex' : 'none';
        
        if (this.isExpanded) {
            this.updateUI();
        }
    }
    
    clearLogs() {
        this.logs = [];
        this.updateUI();
    }
}

// 自動初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new DebugLogger());
} else {
    new DebugLogger();
}
