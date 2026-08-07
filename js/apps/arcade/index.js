import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const GACHA_CONFIGS = {
  genshin: {
    name: '­ì¯«',
    currency: '­ì¥Û',
    pullCost: 160,
    pity: 90,
    rates: { rarity5: 0.006, rarity4: 0.051, rarity3: 0.943 },
    pool: {
      rarity5: ['¨è´¸', '²ö®R', '¤C¤C', '­}¿c§J', 'µ^', '·Å­}', 'ïi', '¥Ì«B', '­J®ç', '¯«¨½ºðµØ', '¹p¹q±N­x', '¯Ç¦èÌH', 'ªÜ¹ç®R'],
      rarity4: ['ªÝªÝ©Ô', 'µáÁÂº¸', '­»µÙ', '¦æ¬î', '¿Õ¦ãº¸', '¾®¥ú', '¯Z¥§¯S', '¬â¿}'],
      rarity3: ['§N¤b', '¾¤©ú¯«¼C', '¾~¦Ð¤}']
    }
  },
  starrail: {
    name: '±YÃa¡G¬PªÆÅK¹D',
    currency: '¬PÃ£',
    pullCost: 160,
    pity: 90,
    rates: { rarity5: 0.006, rarity4: 0.051, rarity3: 0.943 },
    pool: {
      rarity5: ['®V¤l', '¥Ëº¸¯S', '¥¬¬¥©gÔÕ', '³Ç©¬¼w', '²Å¥È', '»È¯T', '´º¤¸', '¤b', 'Ãè¬y', '¶À¬u'],
      rarity4: ['¦ãµ·ÌH', '¶Â¶ð', '¤¦«í', '§Æ¨à', '®R¶ð²ï', '¨Ø©Ô', '¯À»n', 'ªê§J'],
      rarity3: ['µ[¬Ä', '¾WÃé', '¤Ñ¶É']
    }
  },
  zzz: {
    name: 'µ´°Ï¹s',
    currency: 'µáªL',
    pullCost: 160,
    pity: 90,
    rates: { rarity5: 0.006, rarity4: 0.051, rarity3: 0.943 },
    pool: {
      rarity5: ['¦ã½¬', 'µÜ¥d®¦', '®æ²úµ·', '¿ß¤S', 'ÏÈÁ¢ÌH', 'ÄR®R', '11¸¹', '¦¶»ð'],
      rarity4: ['©g¥i', '¦w¤ñ', '¤ñ§Q', '»a¨¤', '¥»', '¦wªF'],
      rarity3: ['³£¥«µóÀY²y', '·s¤â¤M', '°òÂ¦­µÀº']
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
  history: []
};

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
    <div class='gacha-container'>
      <div class='gacha-header'>
        <div class='game-tabs'>
          ${Object.entries(GACHA_CONFIGS).map(([key, cfg]) => `
            <button class='game-tab ${key === gachaState.currentGame ? 'active' : ''}' data-game='${key}'>${cfg.name}</button>
          `).join('')}
        </div>
      </div>
      
      <div class='gacha-info'>
        <div class='currency-display'>
          <i class='fas fa-gem'></i>
          <span class='currency-amount'>${gachaState.currency}</span>
          <span class='currency-name'>${config.currency}</span>
        </div>
        <div class='pity-info'>
          <span>«O©³¶i«×: ${gachaState.pity5}/${config.pity}</span>
        </div>
      </div>
      
      <div class='gacha-buttons'>
        <button class='gacha-btn single' data-count='1'>
          <span class='btn-label'>©â 1 ¦¸</span>
          <span class='btn-cost'>${config.pullCost} ${config.currency}</span>
        </button>
        <button class='gacha-btn ten' data-count='10'>
          <span class='btn-label'>©â 10 ¦¸</span>
          <span class='btn-cost'>${config.pullCost * 10} ${config.currency}</span>
        </button>
      </div>
      
      <div class='gacha-stats'>
        <div class='stat-item'>
          <span class='stat-label'>Á`©â¼Æ</span>
          <span class='stat-value'>${gachaState.stats.total}</span>
        </div>
        <div class='stat-item rarity-5'>
          <span class='stat-label'>5¡¹</span>
          <span class='stat-value'>${gachaState.stats.rarity5}</span>
        </div>
        <div class='stat-item rarity-4'>
          <span class='stat-label'>4¡¹</span>
          <span class='stat-value'>${gachaState.stats.rarity4}</span>
        </div>
      </div>
      
      <div class='gacha-history'>
        <h3>³Ìªñ©â¥d¬ö¿ý</h3>
        <div class='history-list'>
          ${gachaState.history.slice(-10).reverse().map(h => `
            <div class='history-item rarity-${h.rarity}'>
              <span class='history-rarity'>${h.rarity}¡¹</span>
              <span class='history-name'>${h.name}</span>
            </div>
          `).join('') || '<div class='empty-history'>©|µL¬ö¿ý</div>'}
        </div>
      </div>
    </div>
  `;
  
  container.querySelectorAll('.game-tab').forEach(tab => {
    tab.onclick = async () => {
      gachaState.currentGame = tab.dataset.game;
      gachaState.pity5 = 0;
      gachaState.pity4 = 0;
      await saveGachaState();
      renderGachaGame(container);
    };
  });
  
  container.querySelectorAll('.gacha-btn').forEach(btn => {
    btn.onclick = async () => {
      const count = parseInt(btn.dataset.count);
      const config = GACHA_CONFIGS[gachaState.currentGame];
      const cost = config.pullCost * count;
      
      if (gachaState.currency < cost) {
        alert('³f¹ô¤£¨¬¡I');
        return;
      }
      
      gachaState.currency -= cost;
      gachaState.totalSpent += cost;
      
      for (let i = 0; i < count; i++) {
        const result = pull(config);
        gachaState.history.push(result);
      }
      
      await saveGachaState();
      renderGachaGame(container);
    };
  });
}

async function renderArcade(params) {
  await loadGachaState();
  
  const container = createElement('div', 'app-container arcade-app');
  
  container.innerHTML = `
    <header class='ios-header'>
      <button class='ios-back-btn'>
        <i class='fas fa-chevron-left'></i> ªð¦^
      </button>
      <h1 class='menu-title'>µó¾÷ÆU</h1>
    </header>
    
    <div class='page'>
      <div id='arcade-content'></div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.back();
  
  const content = container.querySelector('#arcade-content');
  renderGachaGame(content);
  
  return { element: container, cleanup: null };
}

export default {
  id: 'arcade',
  name: 'µó¾÷ÆU',
  icon: 'gamepad',
  routes: [{ path: '/arcade', render: renderArcade }],
  navItem: { label: 'µó¾÷ÆU', icon: 'gamepad', path: '/arcade', showInNav: true, order: 100 },
  stylesPath: 'js/apps/arcade/style.css'
};