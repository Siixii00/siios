import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB } from '../../db.js';
import APIClient from '../../api.js';
import { askForm } from '../../core/dialogs.js';

const RECIPES = [
  { name: '番茄炒蛋', time: '15 分鐘', difficulty: '簡單', ingredients: ['番茄', '雞蛋', '蔥'], steps: ['番茄切塊', '雞蛋打散', '熱油炒蛋', '加入番茄翻炒'] },
  { name: '義大利麵', time: '20 分鐘', difficulty: '中等', ingredients: ['義大利麵', '番茄醬', '洋蔥', '絞肉'], steps: ['煮麵', '炒洋蔥和絞肉', '加入番茄醬', '拌入麵條'] },
  { name: '味噌湯', time: '10 分鐘', difficulty: '簡單', ingredients: ['味噌', '豆腐', '海帶'], steps: ['水煮開', '加入海帶', '加入豆腐', '溶入味噌'] },
  { name: '蛋炒飯', time: '10 分鐘', difficulty: '簡單', ingredients: ['隔夜飯', '雞蛋', '蔥花', '醬油'], steps: ['蛋打散先炒至半熟', '下飯炒鬆', '淋醬油拌勻', '撒蔥花起鍋'] },
  { name: '蔥油拌麵', time: '15 分鐘', difficulty: '簡單', ingredients: ['細麵', '蔥', '醬油', '糖', '油'], steps: ['蔥切段用油慢炸至金黃', '加醬油與少許糖煮滾成蔥油', '煮麵瀝乾', '淋上蔥油拌勻'] },
  { name: '馬鈴薯燉肉', time: '40 分鐘', difficulty: '中等', ingredients: ['馬鈴薯', '豬肉片', '洋蔥', '紅蘿蔔', '醬油', '糖'], steps: ['材料切塊', '洋蔥與肉片炒香', '加入馬鈴薯與紅蘿蔔拌炒', '加水與調味料小火燉煮至軟'] },
  { name: '涼拌小黃瓜', time: '10 分鐘', difficulty: '簡單', ingredients: ['小黃瓜', '蒜末', '醋', '糖', '香油'], steps: ['小黃瓜拍裂切段', '加鹽殺出水分後瀝乾', '拌入蒜末、醋、糖、香油', '冰鎮後更爽口'] },
  { name: '薑燒豬肉', time: '20 分鐘', difficulty: '簡單', ingredients: ['豬肉片', '薑泥', '醬油', '味醂', '洋蔥'], steps: ['醬油、味醂、薑泥調成醬汁', '洋蔥炒軟', '下豬肉片炒至變色', '倒入醬汁收汁'] },
  { name: '日式厚蛋燒', time: '15 分鐘', difficulty: '中等', ingredients: ['雞蛋', '糖', '醬油', '水'], steps: ['蛋液加調味拌勻', '小火倒入一層蛋液', '半熟時捲起推到一側', '重複倒蛋液與捲起直到用完'] },
  { name: '南瓜濃湯', time: '30 分鐘', difficulty: '中等', ingredients: ['南瓜', '洋蔥', '牛奶', '奶油', '鹽'], steps: ['南瓜與洋蔥切塊', '奶油炒香洋蔥', '加南瓜與水煮軟', '打成泥後加牛奶與鹽煮滾'] }
];

const FAVORITES_KEY = 'recipe_favorites';

const dayOfYear = d => Math.floor((d - new Date(d.getFullYear(), 0, 0)) / 86400000);

let offset = 0;          // 「換一道」的偏移，離開頁面後重置
let current = null;      // 目前顯示的食譜（可能是 AI 生成的）

async function loadFavorites() {
  const list = await SettingsDB.get(FAVORITES_KEY);
  return Array.isArray(list) ? list : [];
}

function normalizeRecipe(raw) {
  const arr = v => (Array.isArray(v) ? v.map(x => String(x).trim()).filter(Boolean) : []);
  const r = {
    name: String(raw?.name || '').trim(),
    time: String(raw?.time || '').trim() || '—',
    difficulty: String(raw?.difficulty || '').trim() || '—',
    ingredients: arr(raw?.ingredients),
    steps: arr(raw?.steps)
  };
  return r.name && r.ingredients.length && r.steps.length ? r : null;
}

// 模型有時會在 JSON 前後加說明文字或程式碼框，取出第一個 JSON 物件再解析
function parseRecipeJson(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return normalizeRecipe(JSON.parse(text.slice(start, end + 1))); } catch { return null; }
}

async function generateRecipe(wish) {
  const text = await APIClient.complete([
    {
      role: 'system',
      content: '你是家常料理食譜助手。請產生一道適合在家做的食譜，使用繁體中文。只輸出一個 JSON 物件，不要任何其他文字，格式：{"name":"料理名","time":"30 分鐘","difficulty":"簡單|中等|困難","ingredients":["食材 份量"],"steps":["步驟一","步驟二"]}。食材 3 到 10 項、步驟 3 到 8 步，內容必須實際可行。'
    },
    { role: 'user', content: wish ? '我想吃：' + wish : '請隨機推薦一道今天適合吃的家常菜' }
  ], { maxTokens: 900, temperature: 0.9 });
  const recipe = parseRecipeJson(text);
  if (!recipe) throw new Error('模型回傳的內容不是有效的食譜，請再試一次');
  return recipe;
}

async function renderDailyRecipe() {
  const container = createElement('div', 'app-container recipe-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">每日食譜</h1>
    </header>
    <div class="page">
      <div class="recipe-card"></div>
      <div class="recipe-actions">
        <button class="r-btn r-next">換一道</button>
        <button class="r-btn r-fav"></button>
        <button class="r-btn r-ai">AI 生成</button>
      </div>
      <div class="recipe-favs"><h3>我的收藏</h3><div class="fav-list"></div></div>
    </div>`;
  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  const card = container.querySelector('.recipe-card');
  const favBtn = container.querySelector('.r-fav');
  const favList = container.querySelector('.fav-list');
  let favorites = await loadFavorites();

  const isFav = r => favorites.some(f => f.name === r.name);

  function drawCard(badge) {
    const r = current;
    card.innerHTML = '';
    card.appendChild(createElement('div', 'recipe-badge', { textContent: badge }));
    card.appendChild(createElement('h2', 'recipe-name', { textContent: r.name }));
    const meta = createElement('div', 'recipe-meta');
    meta.append(createElement('span', '', { textContent: '⏱ ' + r.time }), createElement('span', '', { textContent: '📶 ' + r.difficulty }));
    card.appendChild(meta);
    const ing = createElement('div', 'recipe-section');
    ing.appendChild(createElement('h3', '', { textContent: '食材' }));
    const ul = createElement('ul', 'ingredient-list');
    r.ingredients.forEach(i => ul.appendChild(createElement('li', '', { textContent: i })));
    ing.appendChild(ul);
    const steps = createElement('div', 'recipe-section');
    steps.appendChild(createElement('h3', '', { textContent: '步驟' }));
    const ol = createElement('ol', 'step-list');
    r.steps.forEach(s => ol.appendChild(createElement('li', '', { textContent: s })));
    steps.appendChild(ol);
    card.append(ing, steps);
    favBtn.textContent = isFav(r) ? '★ 已收藏' : '☆ 收藏';
  }

  function drawFavs() {
    favList.replaceChildren();
    if (favorites.length === 0) {
      favList.appendChild(createElement('div', 'empty-fav', { textContent: '還沒有收藏，喜歡的食譜按「收藏」就會出現在這裡' }));
      return;
    }
    favorites.forEach(f => {
      const row = createElement('div', 'fav-row');
      const open = createElement('button', 'fav-open', { textContent: f.name });
      open.onclick = () => { current = f; drawCard('我的收藏'); card.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      const del = createElement('button', 'fav-del', { textContent: '移除', 'aria-label': '移除收藏：' + f.name });
      del.onclick = async () => {
        favorites = favorites.filter(x => x.name !== f.name);
        await SettingsDB.set(FAVORITES_KEY, favorites);
        drawFavs();
        if (current?.name === f.name) favBtn.textContent = '☆ 收藏';
      };
      row.append(open, del);
      favList.appendChild(row);
    });
  }

  function showTodayRotation() {
    current = RECIPES[(dayOfYear(new Date()) + offset) % RECIPES.length];
    drawCard(offset === 0 ? '今日推薦' : '換一道');
  }

  container.querySelector('.r-next').onclick = () => { offset++; showTodayRotation(); };
  favBtn.onclick = async () => {
    if (!current) return;
    const adding = !isFav(current);
    favorites = isFav(current) ? favorites.filter(f => f.name !== current.name) : [...favorites, current];
    await SettingsDB.set(FAVORITES_KEY, favorites);
    if (adding) import('../../core/activity-memory.js').then(m => m.rememberActivity({ sourceApp: 'daily-recipe', content: `用戶收藏了食譜「${current.name}」`, importance: 0.3 })).catch(() => {});
    favBtn.textContent = isFav(current) ? '★ 已收藏' : '☆ 收藏';
    drawFavs();
  };
  const aiBtn = container.querySelector('.r-ai');
  aiBtn.onclick = async () => {
    const form = await askForm({
      title: 'AI 生成食譜',
      hint: '可以留白，讓 AI 隨機推薦',
      fields: [{ key: 'wish', label: '想吃什麼（選填）', placeholder: '例如：清爽的雞肉料理、冰箱剩的高麗菜' }],
      submitLabel: '生成'
    });
    if (!form) return;
    aiBtn.disabled = true;
    aiBtn.textContent = '生成中…';
    try {
      current = await generateRecipe(form.wish);
      drawCard('AI 生成');
    } catch (e) {
      createToast(e.message || '生成失敗', 'error');
    } finally {
      aiBtn.disabled = false;
      aiBtn.textContent = 'AI 生成';
    }
  };

  showTodayRotation();
  drawFavs();
  return { element: container, cleanup: () => { offset = 0; current = null; } };
}

export default {
  id: 'daily-recipe',
  name: '每日食譜',
  icon: 'soup_kitchen',
  routes: [{ path: '/daily-recipe', render: renderDailyRecipe }],
  navItem: { label: '每日食譜', icon: 'soup_kitchen', path: '/daily-recipe', showInNav: true, order: 121 },
  stylesPath: 'js/apps/daily-recipe/style.css'
};
