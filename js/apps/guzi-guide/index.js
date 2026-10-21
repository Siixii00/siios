import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import {askForm, askConfirm } from '../../core/dialogs.js';

const CATEGORIES = ['徽章', '立牌', '海報', '吊卡', '其他'];
const ITEMS_KEY = 'guzi_items';

let filter = 'all';

async function loadItems() {
  const list = await SettingsDB.get(ITEMS_KEY);
  return Array.isArray(list) ? list : [];
}

const saveItems = items => SettingsDB.set(ITEMS_KEY, items);

async function renderGuziGuide() {
  const items = await loadItems();
  const container = createElement('div', 'app-container guzi-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">谷子圖鑑</h1>
    </header>
    <div class="page">
      <div class="stats-grid"></div>
      <div class="total-count"><span>總計</span><span class="total">${items.length} 件</span></div>
      <div class="item-list"></div>
      <button class="add-btn"><i class="fas fa-plus"></i> 新增收藏</button>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();

  // 分類統計同時是篩選器：點一下只看該分類，再點一次取消
  const stats = container.querySelector('.stats-grid');
  CATEGORIES.forEach(c => {
    const card = createElement('button', 'stat-card' + (filter === c ? ' active' : ''));
    card.append(createElement('span', 'stat-label', { textContent: c }), createElement('span', 'stat-value', { textContent: String(items.filter(i => i.category === c).length) }));
    card.onclick = () => { filter = filter === c ? 'all' : c; Router.handleRoute(); };
    stats.appendChild(card);
  });

  const list = container.querySelector('.item-list');
  const shown = items.filter(i => filter === 'all' || i.category === filter).slice().reverse();
  if (shown.length === 0) {
    list.appendChild(createElement('div', 'empty-items', { textContent: items.length ? '這個分類還沒有收藏' : '尚無收藏' }));
  }
  shown.forEach(item => {
    const row = createElement('div', 'item-row');
    row.append(createElement('span', 'item-name', { textContent: item.name }), createElement('span', 'item-cat', { textContent: item.category }));
    const del = createElement('button', 'item-del', { textContent: '刪除', 'aria-label': '刪除：' + item.name });
    del.onclick = async () => {
      if (!await askConfirm('刪除「' + item.name + '」？')) return;
      await saveItems((await loadItems()).filter(x => x.id !== item.id));
      createToast('已刪除');
      Router.handleRoute();
    };
    row.appendChild(del);
    list.appendChild(row);
  });

  container.querySelector('.add-btn').onclick = async () => {
    const form = await askForm({
      title: '新增收藏',
      fields: [
        { key: 'name', label: '名稱', required: true, placeholder: '例如：限定徽章' },
        { key: 'category', label: '分類', type: 'select', options: CATEGORIES.map(c => ({ value: c, label: c })), value: filter !== 'all' ? filter : '其他' }
      ],
      submitLabel: '新增'
    });
    if (!form) return;
    const all = await loadItems();
    all.push({ name: form.name, category: form.category, id: Date.now(), addedAt: new Date().toISOString() });
    await saveItems(all);
    import('../../core/activity-memory.js').then(m => m.rememberActivity({ sourceApp: 'guzi-guide', content: `用戶在谷子圖鑑新增了收藏「${form.name}」（${form.category}）`, importance: 0.4 })).catch(() => {});
    createToast('已新增「' + form.name + '」');
    Router.handleRoute();
  };
  return { element: container, cleanup: null };
}

export default {
  id: 'guzi-guide',
  name: '谷子圖鑑',
  icon: 'bookmark',
  routes: [{ path: '/guzi-guide', render: renderGuziGuide }],
  navItem: { label: '谷子圖鑑', icon: 'bookmark', path: '/guzi-guide', showInNav: true, order: 132 },
  stylesPath: 'js/apps/guzi-guide/style.css'
};
