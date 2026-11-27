import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { WIDGETS, getActiveWidgetIds, setActiveWidgetIds, getWidgetPrefs, setWidgetPrefs, createWidgetElement } from '../../core/widgets.js';
import { WIDGET_STYLES, allowedSizes, sizeOf, withSize, withStyle, moveItem } from '../../core/widget-layout.js';

// 小工具編輯頁。三層：① 風格一鍵切換 ② 每個小工具的尺寸與順序 ③ 進階（自訂 CSS）收在最後。
const SIZE_LABELS = { small: '小', medium: '中', large: '大' };
const byId = id => WIDGETS.find(w => w.id === id);

async function renderWidget() {
  let active = await getActiveWidgetIds();
  let prefs = await getWidgetPrefs();
  const container = createElement('div', 'app-container widget-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">小工具</h1>
    </header>
    <div class="page"></div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const page = container.querySelector('.page');

  const activeRow = id => {
    const w = byId(id);
    const sizes = allowedSizes(w);
    const chips = sizes.length > 1 ? `<span class="wg-sizes">${sizes.map(s => `<button class="wg-size${s === sizeOf(prefs, w) ? ' on' : ''}" data-act="size" data-id="${w.id}" data-size="${s}">${SIZE_LABELS[s]}</button>`).join('')}</span>` : '';
    return `<div class="wg-row" data-id="${w.id}"><span class="wg-handle" role="button" aria-label="拖曳排序">☰</span><span class="wg-name">${w.name}</span>${chips}<button class="wg-x" data-act="remove" data-id="${w.id}" aria-label="移除">✕</button></div>`;
  };
  const availRow = w => `<button class="wg-row wg-add" data-act="add" data-id="${w.id}"><span class="wg-plus">＋</span><span class="wg-name">${w.name}</span><span class="wg-meta">${SIZE_LABELS[w.size]}</span></button>`;

  async function draw() {
    const rest = WIDGETS.filter(w => !active.includes(w.id));
    page.innerHTML = `
      <section class="wg-sec"><h3>風格</h3><div class="wg-styles">${WIDGET_STYLES.map(s => `<button class="wg-style${s.id === prefs.style ? ' on' : ''}" data-act="style" data-id="${s.id}"><b>${s.name}</b><small>${s.hint}</small></button>`).join('')}</div></section>
      <section class="wg-sec"><h3>預覽</h3><div class="wg-stage"><div class="home-widgets" data-wstyle="${prefs.style}"></div></div></section>
      <section class="wg-sec"><h3>已加入<small>按住 ☰ 上下拖曳排序</small></h3><div class="wg-list">${active.length ? active.map(activeRow).join('') : '<div class="wg-none">還沒有，從下面加入</div>'}</div></section>
      ${rest.length ? `<section class="wg-sec"><h3>可加入</h3><div class="wg-list">${rest.map(availRow).join('')}</div></section>` : ''}
      <details class="wg-adv"><summary>進階</summary><p>想要完全自己的樣子，可以直接寫 CSS。</p><button class="wg-link" data-act="css">自訂 CSS（外觀）</button></details>`;
    const stage = page.querySelector('.wg-stage .home-widgets');
    if (!active.length) stage.appendChild(createElement('div', 'wg-empty', { textContent: '主畫面還沒有小工具' }));
    for (const id of active) {
      const el = await createWidgetElement(id, prefs);
      if (el) { el.style.pointerEvents = 'none'; stage.appendChild(el); }
    }
  }

  page.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const { act, id, size } = el.dataset;
    if (act === 'css') return Router.navigate('/appearance');
    if (act === 'style') { prefs = withStyle(prefs, id); await setWidgetPrefs(prefs); }
    else if (act === 'size') { prefs = withSize(prefs, byId(id), size); await setWidgetPrefs(prefs); }
    else if (act === 'add') { active = [...active, id]; await setActiveWidgetIds(active); createToast('已加入「' + byId(id).name + '」'); }
    else if (act === 'remove') { active = active.filter(x => x !== id); await setActiveWidgetIds(active); createToast('已移除「' + byId(id).name + '」'); }
    await draw();
  });

  // 拖曳排序：只有 ☰ 把手會接管觸控（touch-action: none），其餘地方照常捲動
  page.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.wg-handle');
    if (!handle) return;
    const row = handle.closest('.wg-row');
    const rows = [...row.parentElement.children].filter(r => r.classList.contains('wg-row'));
    const from = rows.indexOf(row);
    const mids = rows.map(r => { const b = r.getBoundingClientRect(); return b.top + b.height / 2; });
    const startY = e.clientY;
    let to = from;
    handle.setPointerCapture(e.pointerId);
    row.classList.add('dragging');
    const move = ev => {
      const dy = ev.clientY - startY;
      row.style.transform = `translateY(${dy}px)`;
      const y = mids[from] + dy;
      to = mids.reduce((best, m, i) => (Math.abs(m - y) < Math.abs(mids[best] - y) ? i : best), 0);
    };
    const end = async () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      if (to !== from) { active = moveItem(active, from, to); await setActiveWidgetIds(active); }
      await draw();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
    e.preventDefault();
  });

  await draw();
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
