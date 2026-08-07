import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';

let enabled = false;

async function loadState() {
  const saved = await SettingsDB.get('touch_enabled');
  enabled = saved === true;
}

async function saveState() {
  await SettingsDB.set('touch_enabled', enabled);
}

async function renderTouch(params) {
  await loadState();
  const container = createElement('div', 'app-container touch-app');
  container.innerHTML = `
    <header class='ios-header'>
      <button class='ios-back-btn'><i class='fas fa-chevron-left'></i> 返回</button>
      <h1 class='menu-title'>輔助觸控</h1>
    </header>
    <div class='page'>
      <div class='toggle-card'>
        <span class='toggle-label'>啟用輔助觸控</span>
        <label class='switch'>
          <input type='checkbox' ${enabled ? 'checked' : ''}>
          <span class='slider'></span>
        </label>
      </div>
      <div class='preview-area'>
        <div class='touch-ball ${enabled ? '' : 'hidden'}'>
          <i class='fas fa-touch_app'></i>
        </div>
        <p class='hint'>浮動按鈕將顯示在畫面上，方便快速操作。</p>
      </div>
      <div class='actions'>
        <button class='action-btn'><i class='fas fa-home'></i> 主畫面</button>
        <button class='action-btn'><i class='fas fa-volume-up'></i> 音量</button>
        <button class='action-btn'><i class='fas fa-lock'></i> 鎖定</button>
        <button class='action-btn'><i class='fas fa-camera'></i> 截圖</button>
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const checkbox = container.querySelector('input[type='checkbox']');
  checkbox.onchange = async () => {
    enabled = checkbox.checked;
    await saveState();
    container.querySelector('.touch-ball').classList.toggle('hidden', !enabled);
  };
  const actionBtns = container.querySelectorAll('.action-btn');
  actionBtns[0].onclick = () => Router.navigate('/home');
  actionBtns[1].onclick = () => { const v = window._touchVolume || 50; window._touchVolume = v >= 100 ? 0 : v + 25; createToast(`音量: ${window._touchVolume}%`); };
  actionBtns[2].onclick = () => { window.App?.lock(); };
  actionBtns[3].onclick = () => createToast('截圖功能尚未實作');
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