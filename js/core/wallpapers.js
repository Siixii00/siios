import { SettingsDB } from '../db.js';

// 主題商店的主題同時就是可套用的桌布
export const SHOP_THEMES = [
    { id: 't1', name: '星空', icon: '🌌', price: 0, tone: 'dark', css: 'linear-gradient(160deg, #0b1026 0%, #1b2a5c 60%, #3a2c6b 100%)' },
    { id: 't2', name: '森林', icon: '🌲', price: 50, tone: 'dark', css: 'linear-gradient(160deg, #0f3d2e 0%, #1f6f4a 60%, #2e8b57 100%)' },
    { id: 't3', name: '海洋', icon: '🌊', price: 50, tone: 'dark', css: 'linear-gradient(160deg, #023e8a 0%, #0077b6 55%, #48cae4 100%)' },
    { id: 't4', name: '日落', icon: '🌅', price: 80, tone: 'dark', css: 'linear-gradient(160deg, #6a3093 0%, #ff7e5f 60%, #feb47b 100%)' },
    { id: 't5', name: '極光', icon: '🌌', price: 100, tone: 'dark', css: 'linear-gradient(160deg, #001f3f 0%, #00a884 65%, #6c5ce7 100%)' },
    { id: 't6', name: '櫻花', icon: '🌸', price: 80, tone: 'light', css: 'linear-gradient(160deg, #ffd6e0 0%, #ffb7c5 100%)' }
];

const isSafeImage = u => typeof u === 'string' && (/^data:image\//i.test(u) || /^https?:\/\//i.test(u));

// kind: 'home' | 'lock'。優先使用相簿設定的圖片，其次是商店主題，都沒有就維持預設漸層
export async function wallpaperBackground(kind) {
    const url = await SettingsDB.get(kind === 'lock' ? 'lockscreen_url' : 'wallpaper_url');
    if (isSafeImage(url)) return 'center / cover no-repeat url("' + url.replace(/"/g, '%22') + '")';
    const themeId = await SettingsDB.get('wallpaper_theme');
    return SHOP_THEMES.find(t => t.id === themeId)?.css || null;
}

export async function applyWallpaper(el, kind) {
    try {
        const bg = await wallpaperBackground(kind);
        if (bg) el.style.background = bg;
    } catch { /* 讀取失敗就保留預設桌布 */ }
}

// 套用商店主題：同時清掉相簿設定的圖片，讓主題在主畫面與鎖定畫面都生效
export async function setWallpaperTheme(id) {
    await SettingsDB.set('wallpaper_theme', id);
    await SettingsDB.set('wallpaper_url', null);
    await SettingsDB.set('lockscreen_url', null);
}

export async function resetWallpaper() {
    await SettingsDB.set('wallpaper_theme', null);
    await SettingsDB.set('wallpaper_url', null);
    await SettingsDB.set('lockscreen_url', null);
}

export async function currentWallpaperTheme() {
    return (await SettingsDB.get('wallpaper_theme')) || null;
}

// ───── 聊天室的商店主題 ─────
// 在聊天的商店套用主題時，聊天室的背景也會換成同一個主題（不只是桌布）；
// 在「聊天設定」選了一般的聊天主題（淺色、深色…）或自訂主題，就會改回那個。
export async function setChatShopTheme(id) {
    await SettingsDB.set('chat_shop_theme', id || null);
}

export async function getChatShopTheme() {
    const id = await SettingsDB.get('chat_shop_theme');
    return SHOP_THEMES.find(t => t.id === id) || null;
}
