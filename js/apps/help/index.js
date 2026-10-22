import Router from '../../router.js';
import { createElement } from '../../components.js';
import { QUICK_START, CATEGORIES, ENTRIES, FAQ, searchHelp } from './help-data.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function renderHelp() {
  const container = createElement('div', 'app-container help-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">使用說明</h1>
    </header>
    <div class="page">
      <input type="search" class="hp-search" placeholder="搜尋功能，例如「購物」「備份」「深色」">
      <div class="hp-body"></div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const body = container.querySelector('.hp-body');
  const input = container.querySelector('.hp-search');

  const entryHtml = e => `
    <details class="hp-entry" id="help-${esc(e.id)}">
      <summary><strong>${esc(e.name)}</strong><span>${esc(e.what)}</span></summary>
      ${e.how?.length ? `<ul>${e.how.map(h => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      ${e.tips?.length ? `<div class="hp-tips">${e.tips.map(t => `<p>💡 ${esc(t)}</p>`).join('')}</div>` : ''}
      ${e.path ? `<button class="hp-open" data-path="${esc(e.path)}">開啟 ${esc(e.name)}</button>` : ''}
    </details>`;

  const draw = () => {
    const q = input.value.trim();
    const r = searchHelp(q);
    const parts = [];
    if (r.quick.length) parts.push(`<h2 class="hp-h">快速開始</h2>` + r.quick.map(s => `<div class="hp-card"><strong>${esc(s.title)}</strong><p>${esc(s.body)}</p></div>`).join(''));
    for (const c of CATEGORIES) {
      const list = r.entries.filter(e => e.cat === c.id);
      if (list.length) parts.push(`<h2 class="hp-h">${esc(c.name)}</h2>` + list.map(entryHtml).join(''));
    }
    if (r.faq.length) parts.push(`<h2 class="hp-h">常見問題</h2>` + r.faq.map(f => `<details class="hp-entry"><summary><strong>${esc(f.q)}</strong></summary><p class="hp-a">${esc(f.a)}</p></details>`).join(''));
    body.innerHTML = parts.join('') || `<p class="hp-empty">找不到「${esc(q)}」。換個關鍵字，或到「常見問題」看看。</p>`;
    // 搜尋時直接展開，比較好找
    if (q) body.querySelectorAll('details').forEach(d => { d.open = true; });
    body.querySelectorAll('.hp-open').forEach(b => { b.onclick = () => Router.navigate(b.dataset.path); });
  };
  input.oninput = draw;
  draw();
  return { element: container, cleanup: null };
}

export default {
  id: 'help',
  name: '使用說明',
  icon: 'help',
  routes: [{ path: '/help', render: renderHelp }],
  navItem: { label: '說明', icon: 'help', path: '/help', showInNav: true, order: 150 },
  stylesPath: 'js/apps/help/style.css'
};
