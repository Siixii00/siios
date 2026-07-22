import Router from '../router.js';

const apps = [];
let initialized = false;

async function loadApps() {
    const appModules = [
        import('./chats/index.js'),
        import('./chats/chat.js'),
        import('./world-info/index.js'),
        import('./world-info/entry-editor.js'),
        import('./settings/index.js'),
        import('./settings/api-config.js'),
        import('./memory/index.js'),
        import('./album/index.js'),
        import('./weather/index.js'),
        import('./music/index.js'),
        import('./pomodoro/index.js'),
        import('./phone/index.js'),
        import('./chrome/index.js'),
        import('./facebook/index.js'),
        import('./instagram/index.js'),
        import('./twitter/index.js'),
        import('./youtube/index.js'),
        import('./bilibili/index.js'),
        import('./twitch/index.js'),
        import('./weverse/index.js'),
        import('./lofter/index.js'),
        import('./ao3/index.js'),
        import('./arcade/index.js'),
        import('./match-3/index.js'),
        import('./bubbles/index.js'),
        import('./theater/index.js'),
        import('./dating/index.js'),
        import('./exchange-diary/index.js'),
        import('./drift-bottle/index.js'),
        import('./pub/index.js'),
        import('./delivery/index.js'),
        import('./daily-recipe/index.js'),
        import('./taobao/index.js'),
        import('./kakaopay/index.js'),
        import('./payment-code/index.js'),
        import('./timetree/index.js'),
        import('./home/index.js'),
        import('./farm/index.js'),
        import('./personal-wiki/index.js'),
        import('./smart-painter/index.js'),
        import('./guzi-guide/index.js'),
        import('./appearance/index.js'),
        import('./theme-shop/index.js'),
        import('./emoji-shop/index.js'),
        import('./gift-shop/index.js'),
        import('./passkey/index.js'),
        import('./touch/index.js'),
        import('./widget/index.js')
    ];

    const results = await Promise.all(appModules);

    results.forEach(module => {
        if (module.default) {
            apps.push(module.default);
        }
    });

    initialized = true;
    return apps;
}

async function registerRoutes() {
    if (!initialized) {
        await loadApps();
    }

    apps.forEach(app => {
        if (app.routes) {
            app.routes.forEach(route => {
                Router.on(route.path, async (params) => {
                    const appContainer = window.App.getAppContainer();

                    if (window.App.currentPageCleanup) {
                        window.App.currentPageCleanup();
                        window.App.currentPageCleanup = null;
                    }

                    try {
                        if (app.styles) {
                            await app.styles();
                        }

                        const result = await route.render(params);
                        appContainer.innerHTML = '';
                        appContainer.appendChild(result.element);

                        window.App.currentPage = app.id;
                        window.App.currentPageCleanup = result.cleanup;
                    } catch (error) {
                        console.error(`Failed to render app ${app.id}:`, error);
                        appContainer.innerHTML = `
                            <div class="empty-state">
                                <span class="material-symbols-outlined empty-state-icon">error</span>
                                <h3 class="empty-state-title">頁面載入失敗</h3>
                                <p class="empty-state-text">${error.message}</p>
                            </div>
                        `;
                    }
                });
            });
        }
    });
}

function getNavItems() {
    return apps
        .filter(app => app.navItem && app.navItem.showInNav !== false)
        .map(app => app.navItem)
        .sort((a, b) => (a.order || 0) - (b.order || 0));
}

function getAppById(id) {
    return apps.find(app => app.id === id);
}

function getAllApps() {
    return apps;
}

export {
    loadApps,
    registerRoutes,
    getNavItems,
    getAppById,
    getAllApps
};