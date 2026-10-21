import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { isRestricted } from '../../core/age-gate.js';
import { SettingsDB } from '../../db.js';
import { getBalance, charge, formatMoney, WalletError } from '../../core/wallet.js';
import { loadProgress, totalStars, GEMS_PER_STAR } from './games/levels.js';
import { LEVELS as L2048 } from './games/g2048-core.js';
import { LEVEL_COUNT as LSNAKE } from './games/snake-core.js';
import { LEVELS as LMEMORY } from './games/memory-core.js';
import { LEVELS as LMINES } from './games/mines-core.js';
import { LEVELS as LSUDOKU } from './games/sudoku-core.js';
import { LEVELS as LSLIDE } from './games/slide-core.js';
import { LEVELS as LLIGHTS } from './games/lights-core.js';
import { LEVELS as LBULLS } from './games/bulls-core.js';

const GACHA_CONFIGS = {
  genshin: {
    name: '原神',
    currency: '原石',
    pullCost: 160,
    pity: 90,
    rates: { rarity5: 0.006, rarity4: 0.051, rarity3: 0.943 },
    pool: {
      rarity5: ['刻晴', '莫娜', '七七', '迪盧克', '琴', '溫迪', '魈', '甘雨', '胡桃', '神里綾華', '雷電將軍', '納西妲', '芙寧娜'],
      rarity4: ['芭芭拉', '菲謝爾', '香菱', '行秋', '諾艾爾', '凝光', '班尼特', '砂糖'],
      rarity3: ['冷刃', '黎明神劍', '鴉羽弓']
    }
  },
  starrail: {
    name: '崩壞：星穹鐵道',
    currency: '星瓊',
    pullCost: 160,
    pity: 90,
    rates: { rarity5: 0.006, rarity4: 0.051, rarity3: 0.943 },
    pool: {
      rarity5: ['姬子', '瓦爾特', '布洛妮婭', '傑帕德', '符玄', '銀狼', '景元', '刃', '鏡流', '黃泉'],
      rarity4: ['艾絲妲', '黑塔', '丹恆', '希兒', '娜塔莎', '佩拉', '素裳', '虎克'],
      rarity3: ['琥珀', '鋒鏑', '天傾']
    }
  },
  zzz: {
    name: '絕區零',
    currency: '菲林',
    pullCost: 160,
    pity: 90,
    rates: { rarity5: 0.006, rarity4: 0.051, rarity3: 0.943 },
    pool: {
      rarity5: ['艾蓮', '萊卡恩', '格莉絲', '貓又', '珂蕾妲', '麗娜', '11號', '朱鳶'],
      rarity4: ['妮可', '安比', '比利', '蒼角', '本', '安東'],
      rarity3: ['都市街頭球', '新手刀', '基礎音擎']
    }
  }
};

let gachaState = {
  currentGame: 'genshin',
  pity5: 0,
  pity4: 0,
  guarantee: false,
  currency: 16000,
  totalSpent: 0,
  stats: { total: 0, rarity5: 0, rarity4: 0, rarity3: 0 },
  history: [],
  lastCheckin: ''
};

let lastPulls = [];
const EXCHANGE = { cost: 100, gems: 160 }; // $100 虛擬錢包 = 160 貨幣
const DAILY_GEMS = 1600;
const todayStr = () => new Date().toDateString();

async function loadGachaState() {
  const saved = await SettingsDB.get('arcade_gacha');
  if (saved) {
    gachaState = { ...gachaState, ...saved };
  }
}

async function saveGachaState() {
  await SettingsDB.set('arcade_gacha', {
    ...gachaState,
    history: gachaState.history.slice(0, 50)
  });
}

function getRandomRarity(config) {
  const rand = Math.random();
  if (rand < config.rates.rarity5) return 5;
  if (rand < config.rates.rarity5 + config.rates.rarity4) return 4;
  return 3;
}

function pull(config) {
  let rarity = getRandomRarity(config);
  
  if (gachaState.pity5 >= config.pity - 1) {
    rarity = 5;
  } else if (gachaState.pity4 >= 9) {
    rarity = Math.max(rarity, 4);
  }
  
  if (rarity === 5) {
    gachaState.pity5 = 0;
  } else {
    gachaState.pity5++;
  }
  
  if (rarity === 4) {
    gachaState.pity4 = 0;
  } else {
    gachaState.pity4++;
  }
  
  const pool = config.pool;
  let poolKey = `rarity${rarity}`;
  const items = pool[poolKey];
  const item = items[Math.floor(Math.random() * items.length)];
  
  gachaState.stats.total++;
  gachaState.stats[`rarity${rarity}`]++;
  
  return { name: item, rarity };
}

function renderGachaGame(container) {
  const config = GACHA_CONFIGS[gachaState.currentGame];
  
  container.innerHTML = `
    <div class="gacha-container">
      <div class="gacha-header">
        <div class="game-tabs">
          ${Object.entries(GACHA_CONFIGS).map(([key, cfg]) => `
            <button class="game-tab ${key === gachaState.currentGame ? 'active' : ''}" data-game="${key}">${cfg.name}</button>
          `).join('')}
        </div>
      </div>
      
      <div class="gacha-info">
        <div class="currency-display">
          <i class="fas fa-gem"></i>
          <span class="currency-amount">${gachaState.currency}</span>
          <span class="currency-name">${config.currency}</span>
        </div>
        <div class="pity-info">
          <span>保底進度: ${gachaState.pity5}/${config.pity}</span>
        </div>
      </div>
      
      <div class="gacha-buttons">
        <button class="gacha-btn single" data-count="1">
          <span class="btn-label">抽 1 次</span>
          <span class="btn-cost">${config.pullCost} ${config.currency}</span>
        </button>
        <button class="gacha-btn ten" data-count="10">
          <span class="btn-label">抽 10 次</span>
          <span class="btn-cost">${config.pullCost * 10} ${config.currency}</span>
        </button>
      </div>
      
      ${lastPulls.length ? `
      <div class="gacha-result">
        <h3>本次結果</h3>
        <div class="result-grid">${lastPulls.map(p => `<div class="result-item rarity-${p.rarity}"><span class="history-rarity">${p.rarity}★</span><span class="history-name">${p.name}</span></div>`).join('')}</div>
      </div>` : ''}

      <div class="gacha-refill">
        <button class="gacha-btn" data-refill="daily" ${gachaState.lastCheckin === todayStr() ? 'disabled' : ''}>
          <span class="btn-label">每日簽到</span>
          <span class="btn-cost">${gachaState.lastCheckin === todayStr() ? '今天已領取' : '+' + DAILY_GEMS + ' ' + config.currency}</span>
        </button>
        <button class="gacha-btn" data-refill="exchange">
          <span class="btn-label">錢包兌換</span>
          <span class="btn-cost">${formatMoney(EXCHANGE.cost)} → ${EXCHANGE.gems} ${config.currency}</span>
        </button>
      </div>

      <div class="gacha-stats">
        <div class="stat-item">
          <span class="stat-label">總抽數</span>
          <span class="stat-value">${gachaState.stats.total}</span>
        </div>
        <div class="stat-item rarity-5">
          <span class="stat-label">5★</span>
          <span class="stat-value">${gachaState.stats.rarity5}</span>
        </div>
        <div class="stat-item rarity-4">
          <span class="stat-label">4★</span>
          <span class="stat-value">${gachaState.stats.rarity4}</span>
        </div>
      </div>
      
      <div class="gacha-history">
        <h3>最近抽卡紀錄</h3>
        <div class="history-list">
          ${gachaState.history.slice(-10).reverse().map(h => `
            <div class="history-item rarity-${h.rarity}">
              <span class="history-rarity">${h.rarity}★</span>
              <span class="history-name">${h.name}</span>
            </div>
          `).join('') || '<div class="empty-history">尚無紀錄</div>'}
        </div>
      </div>
    </div>
  `;
  
  bindRefill(container);

  container.querySelectorAll('.game-tab').forEach(tab => {
    tab.onclick = async () => {
      gachaState.currentGame = tab.dataset.game;
      gachaState.pity5 = 0;
      gachaState.pity4 = 0;
      await saveGachaState();
      renderGachaGame(container);
    };
  });
  
  container.querySelectorAll('.gacha-btn[data-count]').forEach(btn => {
    btn.onclick = async () => {
      const count = parseInt(btn.dataset.count);
      const config = GACHA_CONFIGS[gachaState.currentGame];
      const cost = config.pullCost * count;
      
      if (gachaState.currency < cost) {
        createToast('貨幣不足！可以每日簽到，或用錢包兌換', 'error');
        return;
      }
      
      gachaState.currency -= cost;
      gachaState.totalSpent += cost;
      
      lastPulls = [];
      for (let i = 0; i < count; i++) {
        const result = pull(config);
        gachaState.history.push(result);
        lastPulls.push(result);
      }
      lastPulls.sort((a, b) => b.rarity - a.rarity);
      
      await saveGachaState();
      renderGachaGame(container);
    };
  });
}

function bindRefill(container) {
  container.querySelectorAll('[data-refill]').forEach(btn => {
    btn.onclick = async () => {
      if (btn.dataset.refill === 'daily') {
        if (gachaState.lastCheckin === todayStr()) return;
        gachaState.currency += DAILY_GEMS;
        gachaState.lastCheckin = todayStr();
        createToast('簽到成功，+' + DAILY_GEMS, 'success');
      } else {
        try {
          await charge(EXCHANGE.cost, '街機廳：兌換貨幣', { category: 'arcade' });
        } catch (e) {
          createToast(e instanceof WalletError ? e.message : '兌換失敗', 'error');
          return;
        }
        gachaState.currency += EXCHANGE.gems;
        createToast('已兌換 ' + EXCHANGE.gems, 'success');
      }
      await saveGachaState();
      renderGachaGame(container);
    };
  });
}

// total：關卡數（累計星數的分母）；store：關卡進度存在 SettingsDB 的哪個鍵（見 games/levels.js 的 key）
const GAMES = [
  { id: 'gacha', name: '抽卡模擬' },
  { id: 'g2048', name: '2048', store: '2048', total: L2048.length },
  { id: 'snake', name: '貪吃蛇', store: 'snake', total: LSNAKE },
  { id: 'memory', name: '翻牌配對', store: 'memory', total: LMEMORY.length },
  { id: 'mines', name: '踩地雷', store: 'mines', total: LMINES.length },
  { id: 'sudoku', name: '數獨', store: 'sudoku', total: LSUDOKU.length },
  { id: 'slide', name: '華容道', store: 'slide', total: LSLIDE.length },
  { id: 'lights', name: '關燈', store: 'lights', total: LLIGHTS.length },
  { id: 'bulls', name: '猜數字', store: 'bulls', total: LBULLS.length }
];

// 各遊戲累計的星星（不含消消樂，它有自己的 App）
async function starSummary() {
  let got = 0, all = 0;
  for (const g of GAMES) {
    if (!g.store) continue;
    got += totalStars(await loadProgress(g.store));
    all += g.total * 3;
  }
  return { got, all };
}

async function renderArcade(params) {
  await loadGachaState();
  
  const container = createElement('div', 'app-container arcade-app');
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">街機廳</h1>
    </header>
    
    <div class="page">
      <p class="arcade-summary" id="arcade-summary"></p>
      <nav class="arcade-nav">${GAMES.map(g => `<button class="arcade-nav-btn" data-game="${g.id}">${g.name}</button>`).join('')}</nav>
      <div id="arcade-content"></div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.back();
  
  let content = container.querySelector('#arcade-content');
  let stopGame = null;
  let token = 0;
  const lastGame = (await SettingsDB.get('arcade_last_game')) || 'gacha';

  async function refreshSummary() {
    const { got, all } = await starSummary();
    const el = container.querySelector('#arcade-summary');
    if (el) el.textContent = `累計 ★ ${got} / ${all} · 每拿到一顆新的星星，抽卡貨幣 +${GEMS_PER_STAR}`;
  }

  async function show(id) {
    const mine = ++token;
    refreshSummary();
    if (stopGame) { stopGame(); stopGame = null; }
    container.querySelectorAll('.arcade-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.game === id));
    // 每個遊戲用全新的容器：各遊戲會在容器上綁點擊事件，換遊戲時舊的事件如果還在，會和新遊戲互相干擾（例如貪吃蛇的方向按鈕會被別的遊戲的 data-d 觸發）
    const fresh = document.createElement('div');
    fresh.id = 'arcade-content';
    content.replaceWith(fresh);
    content = fresh;
    const target = fresh; // 之後有 await，使用者可能已經切到別的遊戲，所以不能再讀 content
    SettingsDB.set('arcade_last_game', id);
    if (id === 'gacha') {
      if (isRestricted('gacha')) {
        target.innerHTML = '<div class="ag-wrap"><div style="font-size:48px">🔒</div><p class="ag-msg">抽卡模擬僅限 18 歲以上，滿 18 歲後會自動開放。</p></div>';
        return;
      }
      await loadGachaState(); // 玩小遊戲拿到的獎勵貨幣寫在資料庫裡，回來抽卡前要重新讀
      if (mine !== token) return;
      return renderGachaGame(target);
    }
    const mod = await import('./games/' + (id === 'g2048' ? 'g2048' : id) + '.js');
    const stop = await mod.mount(target);
    if (mine !== token) stop?.(); else stopGame = stop;
  }

  container.querySelectorAll('.arcade-nav-btn').forEach(b => { b.onclick = () => show(b.dataset.game); });
  show(GAMES.some(g => g.id === lastGame) ? lastGame : 'gacha');

  return { element: container, cleanup: () => { token++; if (stopGame) stopGame(); } };
}

export default {
  id: 'arcade',
  name: '街機廳',
  icon: 'gamepad',
  routes: [{ path: '/arcade', render: renderArcade }],
  navItem: { label: '街機廳', icon: 'gamepad', path: '/arcade', showInNav: true, order: 100 },
  stylesPath: 'js/apps/arcade/style.css'
};