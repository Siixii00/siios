import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB } from '../../db.js';

const RECIPES = [
  { name: '番茄炒蛋', time: '15 分鐘', difficulty: '簡單', ingredients: ['番茄', '雞蛋', '蔥'], steps: ['番茄切塊', '雞蛋打散', '熱油炒蛋', '加入番茄翻炒'] },
  { name: '義大利麵', time: '20 分鐘', difficulty: '中等', ingredients: ['義大利麵', '番茄醬', '洋蔥', '絞肉'], steps: ['煮麵', '炒洋蔥和絞肉', '加入番茄醬', '拌入麵條'] },
  { name: '味噌湯', time: '10 分鐘', difficulty: '簡單', ingredients: ['味噌', '豆腐', '海帶'], steps: ['水煮開', '加入海帶', '加入豆腐', '溶入味噌'] }
];

async function renderDailyRecipe(params) {
  const today = RECIPES[new Date().getDay() % RECIPES.length];
  const container = createElement('div', 'app-container recipe-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">每日食譜</h1>
    </header>
    <div class="page">
      <div class="recipe-card">
        <div class="recipe-badge">今日推薦</div>
        <h2 class="recipe-name">${today.name}</h2>
        <div class="recipe-meta">
          <span><i class="fas fa-clock"></i> ${today.time}</span>
          <span><i class="fas fa-signal"></i> ${today.difficulty}</span>
        </div>
        <div class="recipe-section">
          <h3>食材</h3>
          <ul class="ingredient-list">${today.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
        </div>
        <div class="recipe-section">
          <h3>步驟</h3>
          <ol class="step-list">${today.steps.map(s => `<li>${s}</li>`).join('')}</ol>
        </div>
      </div>
    </div>
  `;
  container.querySelector('.ios-back-btn').onclick = () => Router.navigate('/');
  return { element: container, cleanup: null };
}

export default {
  id: 'daily-recipe',
  name: '每日食譜',
  icon: 'utensil-spoon',
  routes: [{ path: '/daily-recipe', render: renderDailyRecipe }],
  navItem: { label: '每日食譜', icon: 'utensil-spoon', path: '/daily-recipe', showInNav: true, order: 121 },
  styles: () => import('./style.css')
};