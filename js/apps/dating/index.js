import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

async function renderDating(params) {
  const container = createElement('div', 'app-container dating-app');
  
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn">
        <i class="fas fa-chevron-left"></i> 返回
      </button>
      <h1 class="menu-title">約會</h1>
    </header>
    
    <div class="page">
      <div class="dating-placeholder">
        <i class="fas fa-heart"></i>
        <h2>約會模式</h2>
        <p>與角色共度浪漫時光</p>
        <p class="coming-soon">功能開發中...</p>
      </div>
    </div>
  `;
  
  const backBtn = container.querySelector('.ios-back-btn');
  backBtn.onclick = () => Router.navigate('/');
  
  return { element: container, cleanup: null };
}

export default {
  id: 'dating',
  name: '約會',
  icon: 'heart',
  routes: [{ path: '/dating', render: renderDating }],
  navItem: { label: '約會', icon: 'heart', path: '/dating', showInNav: true, order: 110 },
  styles: () => import('./style.css')
};