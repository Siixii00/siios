import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { WIDGETS, getActiveWidgetIds, setActiveWidgetIds, createWidgetElement } from '../../core/widgets.js';

const SIZE_LABELS = { small: '小', medium: '中', large: '大' };

async function renderWidget() {
  const active = await getActiveWidgetIds();
  const container = createElement('div', 'app-container widget-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">小工具</h1>
    </header>
    <div class="page">
      <h3 class="section-title">主畫面預覽</h3>
      <div class="widget-preview home-widgets"></div>
      <h3 class="section-title">可用小工具（點擊加入或移除）</h3>
      <div class="widget-list"></div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();

  const preview = container.querySelector('.widget-preview');
  if (active.length === 0) {
    preview.appendChild(createElement('div', 'empty-preview', { textContent: '還沒有小工具，點擊下方加入，回到主畫面就會看到' }));
  } else {
    for (const id of active) {
      const el = await createWidgetElement(id);
      if (el) { el.style.pointerEvents = 'none'; preview.appendChild(el); }
    }
  }

  const list = container.querySelector('.widget-list');
  WIDGETS.forEach(w => {
    const item = createElement('div', 'widget-item' + (active.includes(w.id) ? ' active' : ''));
    item.dataset.id = w.id;
    item.innerHTML = `<span class="w-icon">${w.icon}</span><span class="w-name">${w.name}</span><span class="w-size">${SIZE_LABELS[w.size]}</span>`;
    item.onclick = async () => {
      const current = await getActiveWidgetIds();
      const next = current.includes(w.id) ? current.filter(x => x !== w.id) : [...current, w.id];
      await setActiveWidgetIds(next);
      createToast(next.includes(w.id) ? '已加入「' + w.name + '」' : '已移除「' + w.name + '」');
      Router.handleRoute();
    };
    list.appendChild(item);
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'widget',
  name: '小工具',
  icon: 'grid_view',
  routes: [{ path: '/widget', render: renderWidget }],
  navItem: { label: '小工具', icon: 'grid_view', path: '/widget', showInNav: true, order: 146 },
  stylesPath: 'js/apps/widget/style.css'
};
