import Router from '../../router.js';
import { createElement } from '../../components.js';
import { CharactersDB, SettingsDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';

let lastCard = null;
let selectedCharacterId = null;

async function loadLastCard() {
  const saved = await SettingsDB.get('drift_last_card');
  if (saved) {
    lastCard = saved;
  }
}

async function saveLastCard() {
  await SettingsDB.set('drift_last_card', lastCard);
}

async function generateDivinationReading(cardName, isUpright, characterId) {
  const settings = await APIClient.getSettings();
  
  if (!settings.api_url || !settings.api_key) {
    return {
      meaning: isUpright ? '能量順暢，建議順勢而為' : '能量受阻，建議反思內在障礙',
      advice: isUpright 
        ? '此牌正位，能量順暢，建議順勢而為。'
        : '此牌逆位，能量受阻，建議反思內在障礙。'
    };
  }
  
  const position = isUpright ? '正位' : '逆位';
  
  const context = await buildAppContext({
    characterId: characterId,
    userMessage: ''
  });
  
  const tarotSystemPrompt = `
你是一位專業的塔羅牌占卜師。請根據抽到的牌、牌位，以及角色的性格特質，提供個人化的占卜解讀。
請用溫和、神秘且富有啟發性的語氣回應。
回覆格式必須是JSON：
{"meaning": "牌義解讀（一句話）", "advice": "具體建議（1-2句話）"}`;
  
  const fullSystemPrompt = context.systemPrompt + tarotSystemPrompt;
  
  const characterName = context.character?.name || '神秘人物';
  
  const userPrompt = `抽到了「${cardName}」牌，${position}。
角色名稱：${characterName}
請為此角色提供個人化的占卜解讀。`;
  
  try {
    const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: fullSystemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.8,
        max_tokens: 200
      })
    });
    
    if (!response.ok) {
      throw new Error('API請求失敗');
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (content) {
      const parsed = JSON.parse(content);
      return {
        meaning: parsed.meaning || (isUpright ? '能量順暢' : '能量受阻'),
        advice: parsed.advice || (isUpright ? '順勢而為。' : '反思內在障礙。')
      };
    }
  } catch (error) {
    console.error('生成占卜解讀失敗:', error);
    if (window.showError) {
      window.showError({
        title: '占卜解讀失敗',
        message: error.message,
        details: '生成塔羅牌解讀時發生錯誤'
      });
    }
  }
  
  return {
    meaning: isUpright ? '能量順暢，建議順勢而為' : '能量受阻，建議反思內在障礙',
    advice: isUpright 
      ? '此牌正位，能量順暢，建議順勢而為。'
      : '此牌逆位，能量受阻，建議反思內在障礙。'
  };
}

const TAROT_CARD_NAMES = [
  '愚者', '魔術師', '女祭司', '皇后', '皇帝', '教皇', '戀人', '戰車',
  '力量', '隱者', '命運之輪', '正義', '倒吊人', '死神', '節制', '惡魔',
  '高塔', '星星', '月亮', '太陽', '審判', '世界'
];

async function drawCard(characterId) {
  const idx = Math.floor(Math.random() * TAROT_CARD_NAMES.length);
  const cardName = TAROT_CARD_NAMES[idx];
  const upright = Math.random() > 0.5;
  
  const reading = await generateDivinationReading(cardName, upright, characterId);
  
  lastCard = {
    name: cardName,
    upright,
    meaning: reading.meaning,
    advice: reading.advice,
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
      <div class="card-advice">${card.advice}</div>
    </div>
  ` : `
    <div class="card-placeholder">
      <i class="fas fa-water"></i>
      <p>點擊下方按鈕撿起漂流瓶</p>
    </div>
  `;
}

function renderCharacterSelector(characters) {
  return `
    <div class="character-selector">
      <label class="selector-label">選擇角色</label>
      <select id="character-select" class="character-select">
        <option value="">-- 不指定角色 --</option>
        ${characters.map(char => `
          <option value="${char.id}" ${selectedCharacterId === char.id ? 'selected' : ''}>${char.name}</option>
        `).join('')}
      </select>
    </div>
  `;
}

async function renderDriftBottle(params) {
  await loadLastCard();
  
  const characters = await CharactersDB.getAll();
  
  const savedCharId = await SettingsDB.get('drift_selected_character');
  if (savedCharId) {
    selectedCharacterId = savedCharId;
  }
  
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
      
      ${renderCharacterSelector(characters)}
      
      <div class="card-display"></div>
      
      <button class="draw-btn">
        <i class="fas fa-water_bottle"></i>
        撿起漂流瓶
      </button>
      
      <div class="history-section">
        <h3>占卜說明</h3>
        <p>漂流瓶是一種命運占卜方式。撿起漂流瓶，獲得當下的指引。</p>
      </div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.back();
  
  const charSelect = container.querySelector('#character-select');
  if (charSelect) {
    charSelect.onchange = async (e) => {
      selectedCharacterId = e.target.value || null;
      await SettingsDB.set('drift_selected_character', selectedCharacterId);
    };
  }
  
  const drawBtn = container.querySelector('.draw-btn');
  
  if (drawBtn) {
    drawBtn.onclick = async () => {
      drawBtn.disabled = true;
      drawBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 占卜中...';
      
      const card = await drawCard(selectedCharacterId);
      renderCard(container, card);
      await saveLastCard();
      
      drawBtn.disabled = false;
      drawBtn.innerHTML = '<i class="fas fa-water_bottle"></i> 撿起漂流瓶';
    };
  }
  
  renderCard(container, lastCard);
  
  return { element: container, cleanup: null };
}

export default {
  id: 'drift-bottle',
  name: '漂流瓶',
  icon: 'water_bottle',
  routes: [{ path: '/drift-bottle', render: renderDriftBottle }],
  navItem: { label: '漂流瓶', icon: 'water_bottle', path: '/drift-bottle', showInNav: true, order: 112 },
  stylesPath: 'js/apps/drift-bottle/style.css'
};