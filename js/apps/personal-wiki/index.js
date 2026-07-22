import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

let pages = [];

async function loadPages() {
  const saved = await SettingsDB.get('wiki_pages');
  if (saved) pages = saved;
}

async function savePages() {
  await SettingsDB.set('wiki_pages', pages);
}

function renderWikiList(container) {
  const list = container.querySelector('.wiki-list');
  if (!list) return;
  list.innerHTML = pages.length > 0
    ? pages.map(p => `
        <div class="wiki-item" data-id="${p.id}">
          <h3 class="wiki-title">${p.title}</h3>
          <p class="wiki-excerpt">${p.content.substring(0, 50)}...</p>
        </div>
      `).join('')
    : '<div class="empty-wiki">尚無頁面，點擊 + 新增</div>';
  list.querySelectorAll('.wiki-item').forEach(item => {
    item.onclick = () => openEditor(container, item.dataset.id);
  });
}

function openEditor(container, pageId) {
  const page = pages.find(p => p.id === pageId);
  const isNew = !pageId;
  const editor = container.querySelector('.wiki-editor');
  if (!editor) return;
  editor.innerHTML = `
    <div class="editor-header">
      <button class="back-btn"><i class="fas fa-arrow-left"></i></button>
      <button class="save-btn"><i class="fas fa-save"></i> 儲存</button>
    </div>
    <input type="text" class="title-input" placeholder="標題" value="${page?.title || ''}">
    <textarea class="content-input" placeholder="內容...">${page?.content || ''}</textarea>
  `;
  editor.classList.add('active');
  editor.querySelector('.back-btn').onclick = () => {
    editor.classList.remove('active');
    editor.innerHTML = '';
    renderWikiList(container);
  };
  editor.querySelector('.save-btn').onclick = async () => {
    const title = editor.querySelector('.title-input').value.trim();
    const content = editor.querySelector('.content-input').value;
    if (!title) return;
    if (isNew) {
      pages.push({ id: 'wiki_' + Date.now(), title, content, updatedAt: Date.now() });
    } else {
      const p = pages.find(x => x.id === pageId);
      if (p) { p.title = title; p.content = content; p.updatedAt = Date.now(); }
    }
    await savePages();
    editor.classList.remove('active');
    editor.innerHTML = '';
    renderWikiList(container);
  };
}

async function renderPersonalWiki(params) {
  await loadPages();
  const container = createElement('div', 'app-container wiki-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">個人 Wiki</h1>
      <button class="add-wiki-btn"><i class="fas fa-plus"></i></button>
    </header>
    <div class="page">
      <div class="wiki-list"></div>
      <div class="wiki-editor"></div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  container.querySelector('.add-wiki-btn').onclick = () => openEditor(container, null);
  renderWikiList(container);
  return { element: container, cleanup: null };
}

export default {
  id: 'personal-wiki',
  name: '個人 Wiki',
  icon: 'book-open',
  routes: [{ path: '/personal-wiki', render: renderPersonalWiki }],
  navItem: { label: 'Wiki', icon: 'book-open', path: '/personal-wiki', showInNav: true, order: 130 },
  styles: () => import('./style.css')
};