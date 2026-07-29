import Router from '../../router.js';
import { createElement } from '../../components.js';
import { CharactersDB, SettingsDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';

const DATING_SCENES = [
  { id: 'cafe', name: '咖啡廳', icon: 'fa-coffee', desc: '在溫馨的咖啡廳約會' },
  { id: 'park', name: '公園', icon: 'fa-tree', desc: '在公園散步聊天' },
  { id: 'beach', name: '海灘', icon: 'fa-umbrella-beach', desc: '在海灘享受夕陽' },
  { id: 'restaurant', name: '餐廳', icon: 'fa-utensils', desc: '在餐廳共進晚餐' },
  { id: 'cinema', name: '電影院', icon: 'fa-film', desc: '一起看電影' },
  { id: 'home', name: '家中', icon: 'fa-home', desc: '在家中放鬆約會' }
];

const DATING_ACTIONS = [
  { id: 'talk', name: '聊天', icon: 'fa-comments', prompt: '開始愉快的對話' },
  { id: 'gift', name: '送禮', icon: 'fa-gift', prompt: '送一份小禮物' },
  { id: 'touch', name: '互動', icon: 'fa-hand-holding-heart', prompt: '進行親密互動' },
  { id: 'activity', name: '活動', icon: 'fa-gamepad', prompt: '一起進行有趣的活動' }
];

let datingState = {
  character: null,
  scene: null,
  messages: [],
  affection: 50,
  isTyping: false
};

async function renderDating(params) {
  const container = createElement('div', 'app-container dating-app');
  
  const characters = await CharactersDB.getAll();
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">約會</h1>
    </header>
    
    <div class="page" id="dating-page">
      ${characters.length === 0 ? renderNoCharacters() : renderCharacterSelect(characters)}
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => {
    if (datingState.scene) {
      datingState.scene = null;
      datingState.messages = [];
      container.querySelector('#dating-page').innerHTML = renderSceneSelect();
      bindSceneEvents(container);
    } else if (datingState.character) {
      datingState.character = null;
      container.querySelector('#dating-page').innerHTML = renderCharacterSelect(characters);
      bindCharacterSelectEvents(container, characters);
    } else {
      Router.back();
    }
  };
  
  if (characters.length > 0) {
    bindCharacterSelectEvents(container, characters);
  }
  
  return { element: container, cleanup: null };
}

function renderNoCharacters() {
  return `
    <div class="dating-placeholder">
      <i class="fas fa-user-slash"></i>
      <h2>尚無角色</h2>
      <p>請先建立角色以開始約會</p>
    </div>
  `;
}

function renderCharacterSelect(characters) {
  return `
    <div class="dating-select">
      <h2 class="dating-title">選擇約會對象</h2>
      <div class="character-grid">
        ${characters.map(char => `
          <div class="character-card" data-id="${char.id}">
            <div class="character-avatar">
              ${char.avatar ? `<img src="${char.avatar}" alt="${char.name}">` : `<i class="fas fa-user"></i>`}
            </div>
            <div class="character-info">
              <h3>${char.name}</h3>
              <p class="character-personality">${char.personality?.substring(0, 50) || '神秘的角色'}${char.personality?.length > 50 ? '...' : ''}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderSceneSelect() {
  return `
    <div class="dating-select">
      <h2 class="dating-title">選擇約會場景</h2>
      <div class="scene-grid">
        ${DATING_SCENES.map(scene => `
          <div class="scene-card" data-id="${scene.id}">
            <div class="scene-icon"><i class="fas ${scene.icon}"></i></div>
            <div class="scene-info">
              <h3>${scene.name}</h3>
              <p>${scene.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderDatingScene(scene) {
  return `
    <div class="dating-scene-container">
      <div class="dating-header">
        <div class="dating-partner">
          <div class="partner-avatar">
            ${datingState.character.avatar ? `<img src="${datingState.character.avatar}" alt="${datingState.character.name}">` : `<i class="fas fa-user"></i>`}
          </div>
          <div class="partner-info">
            <h3>${datingState.character.name}</h3>
            <div class="affection-bar">
              <div class="affection-fill" style="width: ${datingState.affection}%"></div>
            </div>
            <span class="affection-label">好感度: ${datingState.affection}%</span>
          </div>
        </div>
        <div class="scene-badge">
          <i class="fas ${scene.icon}"></i> ${scene.name}
        </div>
      </div>
      
      <div class="dating-messages" id="dating-messages">
        ${datingState.messages.map(msg => `
          <div class="dating-message ${msg.role}">
            ${msg.role === 'assistant' ? `
              <div class="message-avatar">
                ${datingState.character.avatar ? `<img src="${datingState.character.avatar}">` : `<i class="fas fa-user"></i>`}
              </div>
            ` : ''}
            <div class="message-content">${msg.content}</div>
          </div>
        `).join('')}
      </div>
      
      <div class="dating-actions">
        <div class="action-buttons">
          ${DATING_ACTIONS.map(action => `
            <button class="action-btn" data-id="${action.id}" title="${action.name}">
              <i class="fas ${action.icon}"></i>
            </button>
          `).join('')}
        </div>
        <div class="dating-input-area">
          <input type="text" id="dating-input" placeholder="輸入訊息..." />
          <button id="send-btn"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    </div>
  `;
}

function bindCharacterSelectEvents(container, characters) {
  const cards = container.querySelectorAll('.character-card');
  cards.forEach(card => {
    card.onclick = async () => {
      const charId = card.dataset.id;
      const character = await CharactersDB.getById(charId);
      if (character) {
        datingState.character = character;
        container.querySelector('#dating-page').innerHTML = renderSceneSelect();
        bindSceneEvents(container);
      }
    };
  });
}

function bindSceneEvents(container) {
  const cards = container.querySelectorAll('.scene-card');
  cards.forEach(card => {
    card.onclick = () => {
      const sceneId = card.dataset.id;
      const scene = DATING_SCENES.find(s => s.id === sceneId);
      if (scene) {
        datingState.scene = scene;
        startDating(container, scene);
      }
    };
  });
}

async function startDating(container, scene) {
  container.querySelector('#dating-page').innerHTML = renderDatingScene(scene);
  
  const input = container.querySelector('#dating-input');
  const sendBtn = container.querySelector('#send-btn');
  const messagesDiv = container.querySelector('#dating-messages');
  const actionBtns = container.querySelectorAll('.action-btn');
  
  const systemMessage = await generateSystemMessage(scene);
  datingState.messages = [{ role: 'system', content: systemMessage }];
  
  const greeting = generateGreeting(scene);
  addMessage(container, 'assistant', greeting);
  
  sendBtn.onclick = () => sendMessage(container);
  input.onkeypress = (e) => {
    if (e.key === 'Enter') sendMessage(container);
  };
  
  actionBtns.forEach(btn => {
    btn.onclick = () => handleAction(container, btn.dataset.id);
  });
  
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function generateSystemMessage(scene) {
  const char = datingState.character;
  const context = await buildAppContext(char, { scene });
  
  let systemMessage = `你是${char.name}，正在與使用者進行約會。
場景：${scene.name} - ${scene.desc}
${char.personality ? `性格：${char.personality}` : ''}
${char.scenario ? `背景：${char.scenario}` : ''}

請以自然、生動的方式回應使用者的約會互動。保持角色性格，展現適當的情感反應。
可以根據互動調整好感度（影響回應的親密程度）。
當前好感度：${datingState.affection}%`;

  if (context.systemPrompt) {
    systemMessage = `${systemMessage}\n\n${context.systemPrompt}`;
  }
  
  return systemMessage;
}

function generateGreeting(scene) {
  const char = datingState.character;
  const greetings = [
    `${char.name}微笑著看著你，「這裡真是個不錯的${scene.name}呢，我很高興你能帶我來這裡。」`,
    `${char.name}環顧四周，「哇，這${scene.name}的氛圍真好...謝謝你約我出來。」`,
    `${char.name}輕輕點頭，「嗯...我很喜歡這個${scene.name}。今天會是美好的一天吧？」`,
    `${char.name}看著你，眼神中帶著期待，「那...我們要做些什麼呢？」`
  ];
  return greetings[Math.floor(Math.random() * greetings.length)];
}

function addMessage(container, role, content) {
  datingState.messages.push({ role, content });
  const messagesDiv = container.querySelector('#dating-messages');
  
  const messageEl = document.createElement('div');
  messageEl.className = `dating-message ${role}`;
  messageEl.innerHTML = `
    ${role === 'assistant' ? `
      <div class="message-avatar">
        ${datingState.character.avatar ? `<img src="${datingState.character.avatar}">` : `<i class="fas fa-user"></i>`}
      </div>
    ` : ''}
    <div class="message-content">${content}</div>
  `;
  messagesDiv.appendChild(messageEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

async function sendMessage(container) {
  const input = container.querySelector('#dating-input');
  const message = input.value.trim();
  if (!message || datingState.isTyping) return;
  
  input.value = '';
  addMessage(container, 'user', message);
  
  await generateResponse(container, message);
}

async function handleAction(container, actionId) {
  if (datingState.isTyping) return;
  
  const action = DATING_ACTIONS.find(a => a.id === actionId);
  if (!action) return;
  
  const actionPrompt = generateActionPrompt(actionId);
  addMessage(container, 'user', `[${action.name}] ${actionPrompt}`);
  
  await generateResponse(container, actionPrompt, true);
  
  const affectionChange = calculateAffectionChange(actionId);
  updateAffection(container, affectionChange);
}

function generateActionPrompt(actionId) {
  const prompts = {
    talk: '我想和你聊聊天',
    gift: '我準備了一份小禮物送給你',
    touch: '輕輕握住對方的手',
    activity: '我們一起做點什麼吧'
  };
  return prompts[actionId] || '進行互動';
}

function calculateAffectionChange(actionId) {
  const changes = {
    talk: Math.floor(Math.random() * 5) + 1,
    gift: Math.floor(Math.random() * 10) + 5,
    touch: Math.floor(Math.random() * 8) - 2,
    activity: Math.floor(Math.random() * 6) + 2
  };
  return changes[actionId] || 0;
}

function updateAffection(container, change) {
  datingState.affection = Math.min(100, Math.max(0, datingState.affection + change));
  
  const fill = container.querySelector('.affection-fill');
  const label = container.querySelector('.affection-label');
  
  if (fill) fill.style.width = `${datingState.affection}%`;
  if (label) label.textContent = `好感度: ${datingState.affection}%`;
}

async function generateResponse(container, userMessage, isAction = false) {
  datingState.isTyping = true;
  showTypingIndicator(container);
  
  try {
    const settings = await SettingsDB.getAll();
    
    if (!settings.api_url || !settings.api_key) {
      hideTypingIndicator(container);
      const fallbackResponse = generateFallbackResponse(userMessage, isAction);
      addMessage(container, 'assistant', fallbackResponse);
      datingState.isTyping = false;
      return;
    }
    
    const messages = datingState.messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));
    
    const context = await buildAppContext(datingState.character, { scene: datingState.scene });
    const systemPrompt = context.systemPrompt 
      ? `${await generateSystemMessage(datingState.scene)}\n\n${context.systemPrompt}`
      : await generateSystemMessage(datingState.scene);
    const apiMessages = [
      { role: 'system', content: systemPrompt },
      ...messages.slice(-10),
      { role: 'user', content: userMessage }
    ];
    
    let fullContent = '';
    
    await APIClient.stream(
      'dating-' + datingState.character.id,
      userMessage,
      (chunk, content) => {
        fullContent = content;
        updateTypingMessage(container, content);
      },
      (content) => {
        hideTypingIndicator(container);
        addMessage(container, 'assistant', content);
        datingState.isTyping = false;
      },
      (error) => {
        hideTypingIndicator(container);
        const fallbackResponse = generateFallbackResponse(userMessage, isAction);
        addMessage(container, 'assistant', fallbackResponse);
        datingState.isTyping = false;
      }
    );
  } catch (error) {
    hideTypingIndicator(container);
    const fallbackResponse = generateFallbackResponse(userMessage, isAction);
    addMessage(container, 'assistant', fallbackResponse);
    datingState.isTyping = false;
  }
}

function generateFallbackResponse(userMessage, isAction) {
  const char = datingState.character;
  const affection = datingState.affection;
  
  if (isAction) {
    if (affection > 70) {
      return `${char.name}臉上泛起紅暈，「...嗯，我很開心你能這樣做。」`;
    } else if (affection > 40) {
      return `${char.name}有些驚訝，「啊...謝謝你。」`;
    } else {
      return `${char.name}稍微退後了一點，「嗯...我們還是先多聊聊吧。」`;
    }
  }
  
  const responses = [
    `${char.name}點點頭，「嗯，我也這麼覺得呢。」`,
    `${char.name}微笑著，「跟你在一起感覺很放鬆...」`,
    `${char.name}看著你，「這樣的時光真不錯呢。」`,
    `${char.name}輕聲回應，「嗯...我明白你的意思。」`
  ];
  
  return responses[Math.floor(Math.random() * responses.length)];
}

function showTypingIndicator(container) {
  const messagesDiv = container.querySelector('#dating-messages');
  const typingEl = document.createElement('div');
  typingEl.className = 'dating-message assistant typing-indicator';
  typingEl.innerHTML = `
    <div class="message-avatar">
      ${datingState.character.avatar ? `<img src="${datingState.character.avatar}">` : `<i class="fas fa-user"></i>`}
    </div>
    <div class="message-content">
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
      <span class="typing-dot"></span>
    </div>
  `;
  messagesDiv.appendChild(typingEl);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

function updateTypingMessage(container, content) {
  const typingEl = container.querySelector('.typing-indicator .message-content');
  if (typingEl) {
    typingEl.innerHTML = content;
  }
}

function hideTypingIndicator(container) {
  const typingEl = container.querySelector('.typing-indicator');
  if (typingEl) typingEl.remove();
}

export default {
  id: 'dating',
  name: '約會',
  icon: 'heart',
  routes: [{ path: '/dating', render: renderDating }],
  navItem: { label: '約會', icon: 'heart', path: '/dating', showInNav: true, order: 110 },
  stylesPath: 'js/apps/dating/style.css'
};
