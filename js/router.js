const Router = {
    routes: [],
    beforeLeaveHooks: [],
    
    on(pattern, handler) {
        this.routes.push({ pattern, handler });
    },
    
    navigate(path) {
        window.location.hash = path;
    },
    
    back() {
        window.history.back();
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
    
    async handleRoute() {
        const hash = window.location.hash.slice(1) || '/home';
        const matched = this.match(hash);
        
        if (matched) {
            await matched.handler(matched.params);
        } else {
            console.warn('Route not found:', hash);
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
    
    start() {
        window.addEventListener('hashchange', async () => {
            if (await this.runBeforeLeave()) {
                this.beforeLeaveHooks = [];
                await this.handleRoute();
            } else {
                window.history.forward();
            }
        });
        
        this.handleRoute();
    }
};

export default Router;