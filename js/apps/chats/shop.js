import Router from '../../router.js';
import { createElement, createIcon, createKakaoBottomNav, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { CHATS_TABS } from './chats-nav.js';

const THEMES = [
    { id: 't1', name: '星空', icon: '??', price: 0 },
    { id: 't2', name: '森林', icon: '??', price: 50 },
    { id: 't3', name: '海洋', icon: '??', price: 50 },
    { id: 't4', name: '日落', icon: '??', price: 80 },
    { id: 't5', name: '極光', icon: '??', price: 100 },
    { id: 't6', name: '櫻花', icon: '??', price: 80 }
];

const EMOJIS = [
    { id: 'e1', name: '笑臉', icon: '??', price: 0 },
    { id: 'e2', name: '愛心', icon: '??', price: 20 },
    { id: 'e3', name: '星星', icon: '?', price: 20 },
    { id: 'e4', name: '彩虹', icon: '??', price: 50 },
    { id: 'e5', name: '閃電', icon: '?', price: 50 },
    { id: 'e6', name: '皇冠', icon: '??', price: 100 }
];

let ownedThemes = new Set();
let ownedEmojis = new Set();
let activeTab = 0;
let purchasing = false;

async function loadOwned() {
    const savedThemes = await SettingsDB.get('theme_owned');
    if (savedThemes) ownedThemes = new Set(savedThemes);
    const savedEmojis = await SettingsDB.get('emoji_owned');
    if (savedEmojis) ownedEmojis = new Set(savedEmojis);
}

async function saveOwnedThemes() {
    await SettingsDB.set('theme_owned', [...ownedThemes]);
}

async function saveOwnedEmojis() {
    await SettingsDB.set('emoji_owned', [...ownedEmojis]);
}

async function renderShop() {
    activeTab = 0;
    await loadOwned();
    const container = createElement('div', 'app-container');

    const header = createElement('header', 'sticky top-0 z-50 bg-white');
    header.style.paddingTop = 'env(safe-area-inset-top, 0px)';

    const headerInner = createElement('div', 'flex justify-between items-center h-[86px] px-4');

    const title = createElement('h1', 'text-[32px] font-bold text-black leading-[31px]');
    title.textContent = '外觀商店';
    headerInner.appendChild(title);

    header.appendChild(headerInner);
    container.appendChild(header);

    const tabContainer = createElement('div', 'flex px-4 gap-2 mb-4');
    const tabs = ['主題', '貼圖'];
    tabs.forEach((tabLabel, i) => {
        const tab = createElement('button', `flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === i ? 'bg-[var(--kakao-yellow)] text-[var(--kakao-brown)]' : 'bg-gray-100 text-gray-600'}`, {
            textContent: tabLabel,
            onClick: () => {
                activeTab = i;
                Router.navigate('/chats/shop');
            }
        });
        tabContainer.appendChild(tab);
    });
    container.appendChild(tabContainer);

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-[83px] px-4');

    if (activeTab === 0) {
        const grid = createElement('div', 'grid grid-cols-3 gap-3');
        THEMES.forEach(t => {
            const isOwned = ownedThemes.has(t.id);
            const item = createElement('div', `rounded-xl p-3 text-center cursor-pointer transition-all ${isOwned ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200 shadow-sm'}`);

            const iconEl = createElement('div', 'text-3xl mb-2', { textContent: t.icon });
            item.appendChild(iconEl);

            item.appendChild(createElement('div', 'text-sm font-medium', { textContent: t.name }));

            if (isOwned) {
                item.appendChild(createElement('div', 'text-xs text-green-600 mt-1', { textContent: '已擁有' }));
            } else {
                item.appendChild(createElement('div', 'text-xs text-gray-500 mt-1', { textContent: t.price === 0 ? '免費' : t.price + ' 幣' }));
            }

            item.onclick = async () => {
                if (purchasing) return;
                if (ownedThemes.has(t.id)) {
                    createToast('已擁有此主題');
                    return;
                }
                purchasing = true;
                try {
                    if (t.price === 0 || confirm('購買「' + t.name + '」主題？')) {
                        ownedThemes.add(t.id);
                        await saveOwnedThemes();
                        createToast('已購買主題：' + t.name);
                        Router.navigate('/chats/shop');
                    }
                } finally {
                    purchasing = false;
                }
            };

            grid.appendChild(item);
        });
        main.appendChild(grid);
    } else {
        const grid = createElement('div', 'grid grid-cols-3 gap-3');
        EMOJIS.forEach(e => {
            const isOwned = ownedEmojis.has(e.id);
            const item = createElement('div', `rounded-xl p-3 text-center cursor-pointer transition-all ${isOwned ? 'bg-green-50 border border-green-200' : 'bg-white border border-gray-200 shadow-sm'}`);

            const iconEl = createElement('div', 'text-3xl mb-2', { textContent: e.icon });
            item.appendChild(iconEl);

            item.appendChild(createElement('div', 'text-sm font-medium', { textContent: e.name }));

            if (isOwned) {
                item.appendChild(createElement('div', 'text-xs text-green-600 mt-1', { textContent: '已擁有' }));
            } else {
                item.appendChild(createElement('div', 'text-xs text-gray-500 mt-1', { textContent: e.price === 0 ? '免費' : e.price + ' 幣' }));
            }

            item.onclick = async () => {
                if (purchasing) return;
                if (ownedEmojis.has(e.id)) {
                    createToast('已擁有此貼圖');
                    return;
                }
                purchasing = true;
                try {
                    if (e.price === 0 || confirm('購買「' + e.name + '」貼圖？')) {
                        ownedEmojis.add(e.id);
                        await saveOwnedEmojis();
                        createToast('已購買貼圖：' + e.name);
                        Router.navigate('/chats/shop');
                    }
                } finally {
                    purchasing = false;
                }
            };

            grid.appendChild(item);
        });
        main.appendChild(grid);
    }

    container.appendChild(main);

    const nav = createKakaoBottomNav(CHATS_TABS, 3, (index, tab) => Router.navigate(tab.path));
    container.appendChild(nav);

    return { element: container, cleanup: null };
}

export default {
    id: 'chats-shop',
    routes: [
        { path: '/chats/shop', render: renderShop }
    ]
};
