import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import APIClient from '../../api.js';
import { CharactersDB, SettingsDB, TheaterSettingsDB } from '../../db.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { askConfirm } from '../../core/dialogs.js';
import { escapeHtml } from '../../utils/html.js';
import { buildScriptMessages, parseScript, frameDoc } from './script.js';

let contentData = [];
let currentContent = null;
let selectedCharacterId = null;

async function loadContent() {
  const saved = await SettingsDB.get('theater_content');
  contentData = saved || [];
}

async function saveContent() {
  await SettingsDB.set('theater_content', contentData);
}

// 在「世界書 › 劇場設定」掛載並啟用的設定，會整段帶進提示詞（例如互動 HTML 的規範）
async function mountedTheaters() {
  const mountedIds = await SettingsDB.get('theater_mounted_settings') || [];
  const all = await Promise.all(mountedIds.map(id => TheaterSettingsDB.getById(id)));
  return all.filter(t => t && t.enabled);
}

async function generateScript(character) {
  const [context, theaters] = await Promise.all([buildAppContext({ characterId: character.id }), mountedTheaters()]);
  // 互動 HTML 動輒上千字，輸出上限要夠大，不然會在中途被截斷
  const text = await APIClient.complete(buildScriptMessages(context.systemPrompt, character, theaters), { temperature: 0.9, maxTokens: 4000 });
  const script = parseScript(text);
  if (!script.html) throw new Error('模型沒有回傳劇場內容');
  return script;
}

function renderContent(container) {
  const grid = container.querySelector('.theater-grid');
  if (!grid) return;
  
  grid.innerHTML = contentData.map(item => `
    <div class="theater-card" data-id="${item.id}">
      ${item.cover 
        ? `<img src="${escapeHtml(item.cover)}" alt="${escapeHtml(item.title)}" class="theater-poster">`
        : `<div class="theater-placeholder"><i class="fas fa-film"></i></div>`
      }
      <div class="theater-title">${escapeHtml(item.title)}</div>
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
  if (preview) {
    const frame = createElement('iframe');
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.srcdoc = frameDoc(currentContent.html || '<p>無預覽內容</p>');
    preview.replaceChildren(frame);
  }
  if (modal) modal.classList.add('active');
}

function closeDetail(container) {
  const modal = container.querySelector('.detail-modal');
  if (modal) modal.classList.remove('active');
  container.querySelector('.detail-preview')?.replaceChildren(); // 關掉畫面，裡面的腳本與計時器也跟著停
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
      
      <p class="theater-hint"></p>

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
          <button class="delete-detail-btn">刪除這則劇目</button>
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
  
  const deleteBtn = container.querySelector('.delete-detail-btn');
  deleteBtn.onclick = async () => {
    if (!currentContent || !await askConfirm('刪除「' + currentContent.title + '」？刪掉就找不回來了。', { title: '刪除劇目', confirmLabel: '刪除' })) return;
    contentData = contentData.filter(c => c.id !== currentContent.id);
    await saveContent();
    closeDetail(container);
    renderContent(container);
  };

  mountedTheaters().then(list => {
    container.querySelector('.theater-hint').textContent = list.length
      ? '已掛載的劇場設定：' + list.map(t => t.name).join('、')
      : '還沒掛載劇場設定，會做一張預設的互動卡片。想要別的玩法，到「世界書 › 劇場設定」掛載並啟用。';
  });

  const characterSelector = container.querySelector('.character-selector');
  const loadCharacters = async () => {
    const characters = await CharactersDB.getAll();
    if (characterSelector && characters && characters.length > 0) {
      characterSelector.innerHTML = '<option value="">選擇角色...</option>' +
        characters.map(c => `<option value="${c.id}">${escapeHtml(c.name || '未命名')}</option>`).join('');
      characterSelector.value = characters.some(c => c.id === selectedCharacterId) ? selectedCharacterId : '';
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
        createToast('請先在聊天室創建角色');
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
          cover: '',
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
          createToast('生成失敗: ' + error.message);
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