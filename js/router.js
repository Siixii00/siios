const Router = {
    routes: [],
    beforeLeaveHooks: [],
    history: [],
    
    on(pattern, handler) {
        this.routes.push({ pattern, handler });
    },
    
    navigate(path) {
        this.history.push(window.location.hash.slice(1) || '/home');
        window.location.hash = path;
    },
    
    back() {
        if (this.history.length > 0) {
            const prev = this.history.pop();
            window.location.hash = prev;
        } else {
            this.navigate('/home');
        }
    },
    
    match(hash) {
        for (const route of this.routes) {
            const paramNames = [];
            const regexPattern = route.pattern.replace(/:(\w+)/g, (_, name) => {
                paramNames.push(name);
                return '([^/]+)';
            });
            
            const regex = new RegExp(`^${regexPattern}$`);
            const match = hash.match(regex);
            
            if (match) {
                const params = {};
                paramNames.forEach((name, i) => {
                    params[name] = decodeURIComponent(match[i + 1]);
                });
                return { handler: route.handler, params };
            }
        }
        return null;
    },
    
    // 換頁時移除上一頁留在 <body> 上的彈窗（直接 appendChild 到 body 的 modal／overlay 不會隨頁面一起消失，會蓋在下一個頁面上）
    sweepOverlays() {
        for (const el of [...document.body.children]) {
            if (el.id === 'app' || el.id === 'toast-container' || /^(SCRIPT|STYLE|LINK)$/.test(el.tagName)) continue;
            if (el.hasAttribute('data-keep') || (el.id || '').startsWith('debug-logger')) continue;
            const cls = typeof el.className === 'string' ? el.className : '';
            if (/(^|s)sx/.test(cls) || /(^|s)sx/.test(el.id || '')) continue; // 系統介面（狀態列、導覽列、外觀編輯器…）
            if (/modal|overlay|backdrop|dialog|sheet|inset-0/i.test(cls) || (el.tagName === 'INPUT' && el.type === 'file')) el.remove();
        }
    },

    async handleRoute() {
        if (window.App && window.App.isLocked) return;
        this.sweepOverlays();
        
        const hash = window.location.hash.slice(1) || '/home';
        const matched = this.match(hash);
        
        if (matched) {
            await matched.handler(matched.params);
        } else {
            this.navigate('/home');
        }
    },
    
    beforeLeave(callback) {
        this.beforeLeaveHooks.push(callback);
    },
    
    async runBeforeLeave() {
        for (const hook of this.beforeLeaveHooks) {
            const result = await hook();
            if (result === false) {
                return false;
            }
        }
        return true;
    },
    
    start(silent) {
        window.addEventListener('hashchange', async () => {
            if (await this.runBeforeLeave()) {
                this.beforeLeaveHooks = [];
                await this.handleRoute();
            } else {
                window.history.forward();
            }
        });
        
        if (!silent) {
            this.handleRoute();
        }
    }
};

export default Router;