// 可視化調試日誌器 - 在手機上顯示 console 日誌
class DebugLogger {
    constructor() {
        this.logs = [];
        this.maxLogs = 50;
        this.isExpanded = false;
        this.container = null;
        this.button = null;
        this.enabled = true;
        this.hasError = false;
        this.errorCount = 0;
        this.warningCount = 0;
        
        const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(navigator.userAgent);
        const isPWA = window.navigator.standalone === true || window.matchMedia('(display-mode: standalone)').matches;
        
        if (isMobile || isPWA) {
            this.enabled = true;
            this.createUI();
            this.interceptConsole();
            this.checkConnection();
        }
    }
    
    createUI() {
        const existingBtn = document.getElementById('debug-logger-btn');
        if (existingBtn) {
            existingBtn.remove();
        }
        
        const existingContainer = document.getElementById('debug-logger-container');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        const btn = document.createElement('button');
        btn.id = 'debug-logger-btn';
        btn.textContent = '●';
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
            display: none;
            transition: all 0.3s ease;
        `;
        btn.onclick = () => this.toggle();
        document.body.appendChild(btn);
        this.button = btn;
        
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.05); }
            }
        `;
        document.head.appendChild(style);
        
        this.container = document.createElement('div');
        this.container.id = 'debug-logger-container';
        this.container.style.cssText = `
            position: fixed;
            bottom: 80px;
            right: 20px;
            width: calc(100vw - 40px);
            max-width: 400px;
            max-height: 60vh;
            background: rgba(0, 0, 0, 0.95);
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
        
        const header = document.createElement('div');
        header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255, 255, 255, 0.2);
        `;
        header.innerHTML = `
            <span style="font-weight: bold;">Debug Logs <span id="error-badge" style="display: none; background: #DC2626; color: white; padding: 2px 6px; border-radius: 10px; font-size: 10px; margin-left: 8px;">0</span></span>
            <div style="display: flex; gap: 8px;">
                <button id="debug-logger-copy" style="background: transparent; border: 1px solid white; color: white; cursor: pointer; padding: 4px 8px; border-radius: 4px; font-size: 12px;">複製</button>
                <button id="debug-logger-clear" style="background: transparent; border: none; color: white; cursor: pointer; padding: 4px 8px;">清除</button>
            </div>
        `;
        this.container.appendChild(header);
        
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
        
        document.getElementById('debug-logger-clear').onclick = () => this.clearLogs();
        document.getElementById('debug-logger-copy').onclick = () => this.copyLogs();
    }
    
    checkConnection() {
        window.addEventListener('offline', () => {
            this.showError('網路連接已斷開');
        });
        
        window.addEventListener('online', () => {
            this.addLog('info', ['網路已恢復連接']);
        });
        
        if (!navigator.onLine) {
            this.showError('目前離線中');
        }
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
        
        window.addEventListener('error', (event) => {
            this.showError(`全局錯誤: ${event.message}`);
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            this.showError(`Promise 錯誤: ${event.reason}`);
        });
    }
    
    showError(message) {
        this.hasError = true;
        this.errorCount++;
        this.addLog('error', [message]);
        this.showButton();
        this.updateBadge();
    }
    
    showButton() {
        if (this.button) {
            this.button.style.display = 'block';
            
            if (this.hasError) {
                this.button.style.background = 'rgba(220, 38, 38, 0.9)';
                this.button.style.animation = 'pulse 2s infinite';
            }
        }
    }
    
    updateBadge() {
        const badge = document.getElementById('error-badge');
        if (badge) {
            if (this.errorCount > 0 || this.warningCount > 0) {
                badge.style.display = 'inline';
                badge.textContent = this.errorCount + this.warningCount;
            }
        }
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
        
        if (type === 'error') {
            this.errorCount++;
            this.hasError = true;
            this.showButton();
            this.updateBadge();
        } else if (type === 'warn') {
            this.warningCount++;
            this.updateBadge();
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
        this.errorCount = 0;
        this.warningCount = 0;
        this.hasError = false;
        this.updateUI();
        this.updateBadge();
        
        if (this.button) {
            this.button.style.background = 'rgba(0, 0, 0, 0.7)';
            this.button.style.animation = 'none';
        }
    }
    
    copyLogs() {
        if (this.logs.length === 0) {
            alert('沒有日誌可複製');
            return;
        }
        
        const logText = this.logs.map(log => {
            return `[${log.timestamp}] [${log.type.toUpperCase()}] ${log.message}`;
        }).join('\n');
        
        const header = `=== Siios Debug Logs ===\n時間: ${new Date().toLocaleString()}\n錯誤數: ${this.errorCount}\n警告數: ${this.warningCount}\n\n`;
        const fullText = header + logText;
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(fullText)
                .then(() => {
                    alert('已複製到剪貼簿！可以貼上傳送給開發者');
                })
                .catch(err => {
                    this.fallbackCopy(fullText);
                });
        } else {
            this.fallbackCopy(fullText);
        }
    }
    
    fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        
        try {
            document.execCommand('copy');
            alert('已複製到剪貼簿！可以貼上傳送給開發者');
        } catch (err) {
            alert('複製失敗，請手動選取複製');
            console.log('請手動複製以下內容：\n', text);
        }
        
        document.body.removeChild(textarea);
    }
}

// 自動初始化
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new DebugLogger());
} else {
    new DebugLogger();
}
