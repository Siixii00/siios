import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';
import { setAssistiveTouch, ACTIONS } from '../../core/assistive-touch.js';

async function renderTouch() {
  const enabled = (await SettingsDB.get('touch_enabled')) === true;
  const container = createElement('div', 'app-container touch-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">輔助觸控</h1>
    </header>
    <div class="page">
      <div class="toggle-card">
        <span class="toggle-label">啟用輔助觸控</span>
        <label class="switch">
          <input type="checkbox" ${enabled ? 'checked' : ''}>
          <span class="slider"></span>
        </label>
      </div>
      <div class="preview-area">
        <p class="hint">開啟後，畫面上會出現可拖曳的浮動按鈕（鎖定畫面不顯示）。點它會展開快捷選單，拖到畫面左右邊會自動吸附。</p>
      </div>
      <h3 class="section-title" style="margin:16px 0 8px;color:#888;font-size:13px">快捷動作（也可以直接在這裡試）</h3>
      <div class="actions"></div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();

  const checkbox = container.querySelector('input[type="checkbox"]');
  checkbox.onchange = () => setAssistiveTouch(checkbox.checked);

  const actions = container.querySelector('.actions');
  ACTIONS.forEach(a => {
    const btn = createElement('button', 'action-btn');
    btn.innerHTML = '<span class="material-symbols-outlined">' + a.icon + '</span> ' + a.label;
    btn.onclick = () => a.run();
    actions.appendChild(btn);
  });
  return { element: container, cleanup: null };
}

export default {
  id: 'touch',
  name: '輔助觸控',
  icon: 'touch_app',
  routes: [{ path: '/touch', render: renderTouch }],
  navItem: { label: '輔助觸控', icon: 'touch_app', path: '/touch', showInNav: true, order: 145 },
  stylesPath: 'js/apps/touch/style.css'
};
