import Router from '../../router.js';
import { createElement } from '../../components.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { CharactersDB, SettingsDB } from '../../db.js';

let state = {
  characterId: null,
  artistName: '',
  artistAvatar: '',
  messages: [],
  fanName: '팬',
  mode: 'artist',
  isGenerating: false
};

async function loadState() {
  const saved = await SettingsDB.get('bubbles_state');
  if (saved) {
    state = { ...state, ...saved };
  }
}

async function saveState() {
  await SettingsDB.set('bubbles_state', state);
}

function renderFeed(container) {
  const feed = container.querySelector('.bubbles-feed');
  if (!feed) return;
  
  feed.innerHTML = state.messages.map(msg => `
    <div class="bubble-msg ${msg.role}">
      ${msg.fanName ? `<span class="fan-name">${msg.fanName}</span>` : ''}
      ${msg.text}
      ${msg.isStreaming ? '<span class="streaming-indicator">...</span>' : ''}
    </div>
  `).join('') || '<div class="empty-msg">尚無訊息</div>';
  
  feed.scrollTop = feed.scrollHeight;
}

async function generateArtistReply(container, fanMessage) {
  if (!state.characterId) return;
  
  state.isGenerating = true;
  const msgIndex = state.messages.length;
  state.messages.push({
    role: 'artist',
    text: '',
    isStreaming: true
  });
  renderFeed(container);
  
  try {
    const context = await buildAppContext({
      characterId: state.characterId,
      userMessage: fanMessage
    });
    
    const settings = await APIClient.getSettings();
    
    if (!settings.api_url || !settings.api_key) {
      state.messages[msgIndex].text = '[API 未設定]';
      state.messages[msgIndex].isStreaming = false;
      renderFeed(container);
      return;
    }
    
    const conversationHistory = state.messages
      .filter(m => !m.isStreaming)
      .slice(-10)
      .map(m => ({
        role: m.role === 'artist' ? 'assistant' : 'user',
        content: m.text
      }));
    
    const apiMessages = [
      { role: 'system', content: context.systemPrompt },
      ...conversationHistory.slice(0, -1),
      { role: 'user', content: fanMessage }
    ];
    
    const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-3.5-turbo',
        messages: apiMessages,
        temperature: settings.temperature || 0.7,
        stream: true
      })
    });
    
    if (!response.ok) {
      throw new Error(`API 錯誤: ${response.status}`);
    }
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullContent = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullContent += content;
              state.messages[msgIndex].text = fullContent;
              renderFeed(container);
            }
          } catch {}
        }
      }
    }
    
    state.messages[msgIndex].text = fullContent;
    state.messages[msgIndex].isStreaming = false;
    await saveState();
    
  } catch (error) {
    state.messages[msgIndex].text = `[錯誤: ${error.message}]`;
    state.messages[msgIndex].isStreaming = false;
  } finally {
    state.isGenerating = false;
    renderFeed(container);
  }
}

async function sendMessage(container) {
  const input = container.querySelector('.bubble-input');
  if (!input || state.isGenerating) return;
  
  const text = input.value.trim();
  if (!text) return;
  
  state.messages.push({
    role: state.mode,
    text,
    fanName: state.mode === 'fan' ? state.fanName : null
  });
  
  input.value = '';
  renderFeed(container);
  await saveState();
  
  if (state.mode === 'fan' && state.characterId) {
    await generateArtistReply(container, text);
  }
}

async function renderBubbles(params) {
  await loadState();
  
  const characters = await CharactersDB.getAll();
  
  const container = createElement('div', 'app-container bubbles-app');
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">Bubble</h1>
    </header>
    
    <div class="page">
      <div class="bubbles-settings">
        <div class="settings-row">
          <label>選擇角色</label>
          <select class="character-select">
            <option value="">-- 請選擇 --</option>
            ${characters.map(c => `
              <option value="${c.id}" ${state.characterId === c.id ? 'selected' : ''}>
                ${c.name}
              </option>
            `).join('')}
          </select>
        </div>
        
        <div class="mode-switch">
          <button class="mode-btn ${state.mode === 'artist' ? 'active' : ''}" data-mode="artist">
            <i class="fas fa-star"></i> 藝人模式
          </button>
          <button class="mode-btn ${state.mode === 'fan' ? 'active' : ''}" data-mode="fan">
            <i class="fas fa-heart"></i> 粉絲模式
          </button>
        </div>
        
        ${state.mode === 'fan' ? `
          <div class="settings-row">
            <label>粉絲名稱</label>
            <input type="text" class="fan-name-input" value="${state.fanName}" placeholder="輸入粉絲名稱">
          </div>
        ` : ''}
      </div>
      
      <div class="bubbles-feed"></div>
      
      <div class="bubbles-input-area">
        <input type="text" class="bubble-input" placeholder="輸入訊息..." ${state.isGenerating ? 'disabled' : ''}>
        <button class="send-btn" ${state.isGenerating ? 'disabled' : ''}>
          <i class="fas fa-paper-plane"></i>
        </button>
      </div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.back();
  
  const characterSelect = container.querySelector('.character-select');
  if (characterSelect) {
    characterSelect.onchange = async () => {
      state.characterId = characterSelect.value || null;
      const selectedChar = characters.find(c => c.id === state.characterId);
      if (selectedChar) {
        state.artistName = selectedChar.name;
        state.artistAvatar = selectedChar.avatar || '';
      }
      await saveState();
      renderBubbles(params);
    };
  }
  
  container.querySelectorAll('.mode-btn').forEach(btn => {
    btn.onclick = async () => {
      state.mode = btn.dataset.mode;
      await saveState();
      renderBubbles(params);
    };
  });
  
  const fanNameInput = container.querySelector('.fan-name-input');
  if (fanNameInput) {
    fanNameInput.onchange = async () => {
      state.fanName = fanNameInput.value;
      await saveState();
    };
  }
  
  const sendBtn = container.querySelector('.send-btn');
  const input = container.querySelector('.bubble-input');
  
  if (sendBtn) {
    sendBtn.onclick = () => sendMessage(container);
  }
  
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === 'Enter' && !state.isGenerating) {
        sendMessage(container);
      }
    };
  }
  
  renderFeed(container);
  
  return { element: container, cleanup: null };
}

export default {
  id: 'bubbles',
  name: 'Bubble',
  icon: 'chat_bubble',
  routes: [{ path: '/bubbles', render: renderBubbles }],
  navItem: { label: 'Bubble', icon: 'chat_bubble', path: '/bubbles', showInNav: true, order: 102 },
  stylesPath: 'js/apps/bubbles/style.css'
};
