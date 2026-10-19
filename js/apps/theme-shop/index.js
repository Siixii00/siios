import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { getBalance, charge, formatMoney, WalletError } from '../../core/wallet.js';
import { SHOP_THEMES, setWallpaperTheme, resetWallpaper, currentWallpaperTheme } from '../../core/wallpapers.js';

const OWNED_KEY = 'theme_owned';
let purchasing = false;

async function loadOwned() {
  const saved = await SettingsDB.get(OWNED_KEY);
  return Array.isArray(saved) ? saved : [];
}

async function renderThemeShop() {
  const [owned, active, balance] = await Promise.all([loadOwned(), currentWallpaperTheme(), getBalance()]);
  const container = createElement('div', 'app-container theme-shop-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">主題商店</h1>
    </header>
    <div class="page">
      <p class="shop-balance">餘額 ${formatMoney(balance)}　購買後點「套用」即可成為主畫面與鎖定畫面的桌布</p>
      <div class="theme-grid"></div>
      <button class="reset-wallpaper-btn">恢復預設桌布</button>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const grid = container.querySelector('.theme-grid');

  SHOP_THEMES.forEach(t => {
    const isOwned = owned.includes(t.id);
    const isActive = active === t.id;
    const item = createElement('div', 'theme-item' + (isOwned ? ' owned' : ''));
    item.dataset.id = t.id;
    item.innerHTML = `<div class="theme-icon" style="background:${t.css};border-radius:12px;padding:8px 0">${t.icon}</div><div class="theme-name">${t.name}</div>`;
    const tag = createElement('span', isOwned ? 'owned-badge' : 'price', {
      textContent: isActive ? '使用中' : isOwned ? '套用' : t.price === 0 ? '免費領取' : formatMoney(t.price)
    });
    item.appendChild(tag);
    item.style.cursor = isActive ? 'default' : 'pointer';
    item.style.opacity = '1';
    item.onclick = async () => {
      if (purchasing || isActive) return;
      purchasing = true;
      try {
        const list = await loadOwned();
        if (!list.includes(t.id)) {
          if (t.price > 0) {
            const bal = await getBalance();
            if (!confirm('購買「' + t.name + '」主題？價格 ' + formatMoney(t.price) + '，餘額 ' + formatMoney(bal))) return;
            await charge(t.price, '購買主題「' + t.name + '」', { category: 'theme' });
          }
          list.push(t.id);
          await SettingsDB.set(OWNED_KEY, list);
          createToast(t.price > 0 ? '已購買「' + t.name + '」' : '已領取「' + t.name + '」');
        } else {
          await setWallpaperTheme(t.id);
          createToast('已套用「' + t.name + '」桌布');
        }
        Router.handleRoute();
      } catch (e) {
        createToast(e instanceof WalletError ? e.message : '操作失敗', 'error');
      } finally {
        purchasing = false;
      }
    };
    grid.appendChild(item);
  });

  container.querySelector('.reset-wallpaper-btn').onclick = async () => {
    if (!confirm('恢復成預設桌布？（會一併清除相簿設定的桌布與鎖屏圖片）')) return;
    await resetWallpaper();
    createToast('已恢復預設桌布');
    Router.handleRoute();
  };
  return { element: container, cleanup: null };
}

export default {
  id: 'theme-shop',
  name: '主題商店',
  icon: 'store',
  routes: [{ path: '/theme-shop', render: renderThemeShop }],
  navItem: { label: '主題商店', icon: 'store', path: '/theme-shop', showInNav: true, order: 141 },
  stylesPath: 'js/apps/theme-shop/style.css'
};
