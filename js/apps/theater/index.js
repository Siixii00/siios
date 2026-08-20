import Router from '../../router.js';
import { createElement } from '../../components.js';
import APIClient from '../../api.js';
import { CharactersDB, SettingsDB } from '../../db.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { TheaterSettingsDB } from '../../db.js';

let contentData = [];
let currentContent = null;
let selectedCharacterId = null;

async function buildTheaterContext(characterId) {
    const baseContext = await buildAppContext({ characterId });
    
    const mountedIds = await SettingsDB.get('theater_mounted_settings') || [];
    const theaterSettings = [];
    
    for (const id of mountedIds) {
        const theater = await TheaterSettingsDB.getById(id);
        if (theater && theater.enabled) {
            theaterSettings.push(theater);
        }
    }
    
    let htmlGuide = '';
    if (theaterSettings.length > 0 && theaterSettings[0].htmlGuide) {
        htmlGuide = theaterSettings[0].htmlGuide;
    }
    
    return {
        ...baseContext,
        theaterSettings,
        htmlGuide
    };
}

async function loadContent() {
  const saved = await SettingsDB.get('theater_content');
  contentData = saved || [];
}

async function saveContent() {
  await SettingsDB.set('theater_content', contentData);
}

async function generateScript(character) {
  const settings = await APIClient.getSettings();
  
  if (!settings.api_url || !settings.api_key) {
    throw new Error('請先設定 API URL 和 API Key');
  }
  
  const context = await buildTheaterContext(character.id);
  
  let theaterSettingsPrompt = '';
  if (context.theaterSettings && context.theaterSettings.length > 0) {
    theaterSettingsPrompt = '\n\n劇場設定：\n' + context.theaterSettings.map(t => 
      `- ${t.name || '未命名'}: ${t.description || ''}`
    ).join('\n');
  }
  
  let htmlGuidePrompt = '';
  if (context.htmlGuide) {
    htmlGuidePrompt = `\n\nHTML 指南：\n${context.htmlGuide}`;
  }
  
  const prompt = `你是一位專業編劇。請根據以下角色設定，創作一個短劇本：

角色名稱：${character.name || '未命名'}
角色描述：${character.description || ''}
角色性格：${character.personality || ''}
場景設定：${character.scenario || ''}${theaterSettingsPrompt}${htmlGuidePrompt}

請生成：
1. 一個吸引人的標題（5字以內）
2. 簡短描述（20字以內）
3. 一段劇本內容（HTML格式，包含標題和正文，約100-200字）

請嚴格按照以下JSON格式回覆，不要包含其他文字：
{"title":"標題","desc":"描述","category":"movie或series","html":"<div style=\"padding: 20px; border-radius: 12px;\"><h2>章節標題</h2><p>劇本內容...</p></div>"}`;

  try {
    const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.api_key}`
      },
      body: JSON.stringify({
        model: settings.model || 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.9,
        max_tokens: 500
      })
    });
    
    if (!response.ok) {
      throw new Error(`API 錯誤: ${response.status}`);
    }
    
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('API 未返回內容');
    }
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('無法解析生成內容');
    }
    
    const result = JSON.parse(jsonMatch[0]);
    return {
      title: result.title || '未命名劇目',
      desc: result.desc || '暫無描述',
      category: result.category || 'movie',
      cover: result.cover || '',
      html: result.html || '<div style="padding: 20px;">生成內容解析失敗</div>'
    };
  } catch (error) {
    if (error.message.includes('JSON')) {
      throw error;
    }
    throw new Error('生成失敗: ' + error.message);
  }
}

function renderContent(container) {
  const grid = container.querySelector('.theater-grid');
  if (!grid) return;
  
  grid.innerHTML = contentData.map(item => `
    <div class="theater-card" data-id="${item.id}">
      ${item.cover 
        ? `<img src="${item.cover}" alt="${item.title}" class="theater-poster">`
        : `<div class="theater-placeholder"><i class="fas fa-film"></i></div>`
      }
      <div class="theater-title">${item.title}</div>
    </div>
  `).join('') || '<div class="empty-state">尚無劇目</div>';
  
  grid.querySelectorAll('.theater-card').forEach(card => {
    card.onclick = () => openDetail(container, card.dataset.id);
  });
}

function openDetail(container, id) {
  currentContent = contentData.find(c => c.id === id);
  if (!currentContent) return;
  
  const modal = container.querySelector('.detail-modal');
  const title = container.querySelector('.detail-title');
  const desc = container.querySelector('.detail-desc');
  const preview = container.querySelector('.detail-preview');
  
  if (title) title.textContent = currentContent.title;
  if (desc) desc.textContent = currentContent.desc;
  if (preview) preview.innerHTML = currentContent.html || '<p style="color: #888;">無預覽內容</p>';
  if (modal) modal.classList.add('active');
}

function closeDetail(container) {
  const modal = container.querySelector('.detail-modal');
  if (modal) modal.classList.remove('active');
  currentContent = null;
}

async function renderTheater(params) {
  await loadContent();
  
  const container = createElement('div', 'app-container theater-app');
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">劇場</h1>
    </header>
    
    <div class="page">
      <div class="theater-grid"></div>
      
      <div class="character-selector-container">
        <select class="character-selector">
          <option value="">選擇角色...</option>
        </select>
      </div>
      
      <button class="add-btn">
        <i class="fas fa-plus"></i> 新增劇目
      </button>
      
      <div class="detail-modal">
        <div class="detail-content">
          <button class="close-detail-btn">
            <i class="fas fa-times"></i>
          </button>
          <h2 class="detail-title"></h2>
          <p class="detail-desc"></p>
          <div class="detail-preview"></div>
        </div>
      </div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.back();
  
  const closeDetailBtn = container.querySelector('.close-detail-btn');
  if (closeDetailBtn) {
    closeDetailBtn.onclick = () => closeDetail(container);
  }
  
  const characterSelector = container.querySelector('.character-selector');
  const loadCharacters = async () => {
    const characters = await CharactersDB.getAll();
    if (characterSelector && characters && characters.length > 0) {
      characterSelector.innerHTML = '<option value="">選擇角色...</option>' +
        characters.map(c => `<option value="${c.id}">${c.name || '未命名'}</option>`).join('');
    }
  };
  loadCharacters();
  
  if (characterSelector) {
    characterSelector.onchange = (e) => {
      selectedCharacterId = e.target.value || null;
    };
  }
  
  const addBtn = container.querySelector('.add-btn');
  if (addBtn) {
    addBtn.onclick = async () => {
      const characters = await CharactersDB.getAll();
      if (!characters || characters.length === 0) {
        alert('請先在聊天室創建角色');
        return;
      }
      
      let selectedChar;
      if (selectedCharacterId) {
        selectedChar = characters.find(c => c.id === selectedCharacterId);
      }
      if (!selectedChar) {
        selectedChar = characters[Math.floor(Math.random() * characters.length)];
      }
      
      addBtn.disabled = true;
      addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 生成中...';
      
      try {
        const scriptContent = await generateScript(selectedChar);
        
        const id = 'content_' + Date.now();
        const newContent = {
          id,
          title: scriptContent.title,
          desc: scriptContent.desc,
          category: scriptContent.category || 'movie',
          cover: scriptContent.cover || '',
          html: scriptContent.html,
          character_id: selectedChar.id,
          created_at: Date.now()
        };
        
        contentData.unshift(newContent);
        await saveContent();
        renderContent(container);
        
        if (selectedChar?.id) {
            await saveInteractionMemory({
                characterId: selectedChar.id,
                sourceApp: 'theater',
                sourceType: 'interaction',
                sourceSubtype: 'theater',
                content: `標題：${scriptContent.title}\n描述：${scriptContent.desc}`,
                importance: 0.5
            });
        }
      } catch (error) {
        if (window.showError) {
          window.showError({
            title: '劇場生成失敗',
            message: error.message,
            details: error.stack || ''
          });
        } else {
          alert('生成失敗: ' + error.message);
        }
      } finally {
        addBtn.disabled = false;
        addBtn.innerHTML = '<i class="fas fa-plus"></i> 新增劇目';
      }
    };
  }
  
  renderContent(container);
  
  return { element: container, cleanup: null };
}

export default {
  id: 'theater',
  name: '劇場',
  icon: 'theater_comedy',
  routes: [{ path: '/theater', render: renderTheater }],
  navItem: { label: '劇場', icon: 'theater_comedy', path: '/theater', showInNav: true, order: 103 },
  stylesPath: 'js/apps/theater/style.css'
};