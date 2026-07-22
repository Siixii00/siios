import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const TAROT_CARDS = [
  { name: '愚者', meaning: '新的開始、自由、冒險' },
  { name: '魔術師', meaning: '創造力、意志力、自信' },
  { name: '女祭司', meaning: '直覺、潛意識、神秘' },
  { name: '皇后', meaning: '豐盛、母性、創造' },
  { name: '皇帝', meaning: '權威、結構、控制' },
  { name: '教皇', meaning: '傳統、信仰、教導' },
  { name: '戀人', meaning: '愛情、和諧、選擇' },
  { name: '戰車', meaning: '意志、決心、勝利' },
  { name: '力量', meaning: '勇氣、耐心、內在力量' },
  { name: '隱者', meaning: '內省、孤獨、尋求' },
  { name: '命運之輪', meaning: '命運、轉折、機會' },
  { name: '正義', meaning: '公平、真相、因果' },
  { name: '倒吊人', meaning: '犧牲、等待、新視角' },
  { name: '死神', meaning: '結束、轉變、重生' },
  { name: '節制', meaning: '平衡、調和、耐心' },
  { name: '惡魔', meaning: '束縛、誘惑、執著' },
  { name: '高塔', meaning: '突變、崩塌、覺醒' },
  { name: '星星', meaning: '希望、靈感、平靜' },
  { name: '月亮', meaning: '幻覺、恐懼、潛意識' },
  { name: '太陽', meaning: '成功、喜悅、活力' },
  { name: '審判', meaning: '重生、覺醒、決定' },
  { name: '世界', meaning: '完成、整合、圓滿' }
];

let lastCard = null;

async function loadLastCard() {
  const saved = await SettingsDB.get('drift_last_card');
  if (saved) {
    lastCard = saved;
  }
}

async function saveLastCard() {
  await SettingsDB.set('drift_last_card', lastCard);
}

function drawCard() {
  const idx = Math.floor(Math.random() * TAROT_CARDS.length);
  const upright = Math.random() > 0.5;
  lastCard = {
    ...TAROT_CARDS[idx],
    upright,
    date: Date.now()
  };
  return lastCard;
}

function renderCard(container, card) {
  const display = container.querySelector('.card-display');
  if (!display) return;
  
  display.innerHTML = card ? `
    <div class="tarot-card ${card.upright ? 'upright' : 'reversed'}">
      <div class="card-name">${card.name}</div>
      <div class="card-position">${card.upright ? '正位' : '逆位'}</div>
      <div class="card-meaning">${card.meaning}</div>
      <div class="card-advice">
        ${card.upright 
          ? '此牌正位，能量順暢，建議順勢而為。'
          : '此牌逆位，能量受阻，建議反思內在障礙。'}
      </div>
    </div>
  ` : `
    <div class="card-placeholder">
      <i class="fas fa-water"></i>
      <p>點擊下方按鈕撿起漂流瓶</p>
    </div>
  `;
}

async function renderDriftBottle(params) {
  await loadLastCard();
  
  const container = createElement('div', 'app-container drift-app');
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">漂流瓶</h1>
    </header>
    
    <div class="page">
      <div class="ocean-bg"></div>
      
      <div class="card-display"></div>
      
      <button class="draw-btn">
        <i class="fas fa-bottle-water"></i>
        撿起漂流瓶
      </button>
      
      <div class="history-section">
        <h3>占卜說明</h3>
        <p>漂流瓶是一種命運占卜方式。撿起漂流瓶，獲得當下的指引。</p>
      </div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.navigate('/');
  
  const drawBtn = container.querySelector('.draw-btn');
  
  if (drawBtn) {
    drawBtn.onclick = async () => {
      const card = drawCard();
      renderCard(container, card);
      await saveLastCard();
    };
  }
  
  renderCard(container, lastCard);
  
  return { element: container, cleanup: null };
}

export default {
  id: 'drift-bottle',
  name: '漂流瓶',
  icon: 'bottle-water',
  routes: [{ path: '/drift-bottle', render: renderDriftBottle }],
  navItem: { label: '漂流瓶', icon: 'bottle-water', path: '/drift-bottle', showInNav: true, order: 112 },
  styles: () => import('./style.css')
};