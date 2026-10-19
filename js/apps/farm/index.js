import Router from '../../router.js';
import { createElement, createToast, createKakaoBottomSheet } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { getBalance, charge, credit, formatMoney, WalletError } from '../../core/wallet.js';

const CROPS = [
  { id: 'c1', name: '番茄', growTime: 30, sellPrice: 50, icon: '🍅' },
  { id: 'c2', name: '玉米', growTime: 45, sellPrice: 80, icon: '🌽' },
  { id: 'c3', name: '草莓', growTime: 60, sellPrice: 120, icon: '🍓' }
];
const SEED_PRICE = 20;
const PLOT_COUNT = 6;
const FARM_KEY = 'farm_state';

// 作物現在直接進出支付錢包，舊版獨立的 coins 不再使用
async function loadPlots() {
  const saved = await SettingsDB.get(FARM_KEY);
  const plots = Array.isArray(saved?.plots) ? saved.plots.slice(0, PLOT_COUNT) : [];
  while (plots.length < PLOT_COUNT) plots.push(null);
  return plots.map(p => (p && CROPS.some(c => c.id === p.cropId) ? p : null));
}

const savePlots = plots => SettingsDB.set(FARM_KEY, { plots });

async function renderFarm() {
  const container = createElement('div', 'app-container farm-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">農場</h1>
      <div class="coins"><i class="fas fa-coins"></i> <span class="farm-balance"></span></div>
    </header>
    <div class="page">
      <div class="farm-grid"></div>
      <div class="shop-section">
        <h3>種子</h3>
        <p class="farm-hint">點空地選擇作物，每顆種子 ${formatMoney(SEED_PRICE)}，收成賣出的錢會進入「支付」餘額。</p>
        <div class="crop-list">
          ${CROPS.map(c => `<span class="crop-btn">${c.icon} ${c.name}　${c.growTime} 秒　賣 ${formatMoney(c.sellPrice)}</span>`).join('')}
        </div>
      </div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const grid = container.querySelector('.farm-grid');
  const balanceEl = container.querySelector('.farm-balance');
  let plots = await loadPlots();
  let busy = false;

  async function refreshBalance() {
    balanceEl.textContent = formatMoney(await getBalance());
  }

  function draw() {
    const now = Date.now();
    grid.replaceChildren();
    plots.forEach((plot, i) => {
      const cell = createElement('div', 'plot');
      cell.dataset.idx = i;
      if (!plot) {
        cell.classList.add('empty');
        cell.appendChild(createElement('span', 'plus', { textContent: '+' }));
        cell.onclick = () => plant(i);
      } else {
        const crop = CROPS.find(c => c.id === plot.cropId);
        const elapsed = Math.floor((now - plot.plantedAt) / 1000);
        const ready = elapsed >= crop.growTime;
        cell.appendChild(createElement('span', 'crop-icon', { textContent: crop.icon }));
        if (ready) {
          cell.classList.add('ready');
          cell.appendChild(createElement('span', 'ready-badge', { textContent: '可收穫' }));
          cell.onclick = () => harvest(i);
        } else {
          cell.appendChild(createElement('span', 'progress', { textContent: elapsed + '/' + crop.growTime + 's' }));
        }
      }
      grid.appendChild(cell);
    });
  }

  function plant(idx) {
    const content = createElement('div', 'p-4 flex flex-col gap-2');
    let sheet;
    CROPS.forEach(c => {
      const btn = createElement('button', 'text-left px-3 py-3 rounded-lg');
      btn.style.cssText = 'border:1px solid #eee;background:transparent;cursor:pointer;text-align:left;';
      btn.textContent = c.icon + ' ' + c.name + '　' + c.growTime + ' 秒成熟，賣 ' + formatMoney(c.sellPrice) + '（種子 ' + formatMoney(SEED_PRICE) + '）';
      btn.onclick = async () => {
        sheet.close();
        if (busy) return;
        busy = true;
        try {
          if (plots[idx]) return;
          await charge(SEED_PRICE, '購買' + c.name + '種子', { category: 'farm' });
          plots[idx] = { cropId: c.id, plantedAt: Date.now() };
          await savePlots(plots);
          await refreshBalance();
          draw();
        } catch (e) {
          createToast(e instanceof WalletError ? e.message : '種植失敗', 'error');
        } finally {
          busy = false;
        }
      };
      content.appendChild(btn);
    });
    sheet = createKakaoBottomSheet([], { title: '選擇作物', customContent: content });
    sheet.open();
  }

  async function harvest(idx) {
    if (busy) return;
    busy = true;
    try {
      const plot = plots[idx];
      if (!plot) return;
      const crop = CROPS.find(c => c.id === plot.cropId);
      if ((Date.now() - plot.plantedAt) / 1000 < crop.growTime) return;
      await credit(crop.sellPrice, '賣出' + crop.name, { category: 'farm' });
      plots[idx] = null;
      await savePlots(plots);
      createToast('收成' + crop.name + '，賣得 ' + formatMoney(crop.sellPrice));
      await refreshBalance();
      draw();
    } catch (e) {
      createToast('收成失敗：' + (e.message || e), 'error');
    } finally {
      busy = false;
    }
  }

  await refreshBalance();
  draw();
  const timer = setInterval(draw, 1000);
  return { element: container, cleanup: () => clearInterval(timer) };
}

export default {
  id: 'farm',
  name: '農場',
  icon: 'seedling',
  routes: [{ path: '/farm', render: renderFarm }],
  navItem: { label: '農場', icon: 'seedling', path: '/farm', showInNav: true, order: 127 },
  stylesPath: 'js/apps/farm/style.css'
};
