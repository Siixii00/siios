import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { MODES, PRESETS, FONTS, SIZES, DEFAULTS, normalize } from '../../core/appearance.js';
import { loadAppearance, saveAppearance } from '../../core/appearance-dom.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function renderAppearance() {
  let s = await loadAppearance();
  const container = createElement('div', 'app-container appearance-app');
  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">外觀設定</h1>
    </header>
    <div class="page">
      <h2 class="section-title">模式</h2>
      <div class="ap-seg" data-group="mode">
        ${MODES.map(m => `<button data-v="${m.id}">${m.name}</button>`).join('')}
      </div>
      <p class="ap-hint">深色模式會套用到整個 App；本來就是深色的 App（例如街機廳）和主畫面桌布維持原樣。</p>

      <h2 class="section-title">主題色（色調）</h2>
      <div class="ap-swatches">
        ${PRESETS.map(p => `<button class="ap-swatch sx-keep" data-color="${p.color}" style="background:${p.color}" title="${p.name}" aria-label="${p.name}"></button>`).join('')}
        <label class="ap-swatch ap-custom sx-keep" title="自訂顏色"><input type="color" class="ap-color" value="${s.color}"><span>自訂</span></label>
      </div>
      <label class="ap-row">飽和度 <span class="ap-val" data-for="saturation"></span>
        <input type="range" class="ap-range" data-key="saturation" min="50" max="160" step="5" value="${s.saturation}">
      </label>
      <p class="ap-hint">把預設的綠色換成你選的顏色，整個 App 的色調會一起偏移（灰色、黑白不受影響）。各個 App 原本的主色不同，所以結果會略有差異；下面的預覽可以看效果。</p>

      <h2 class="section-title">字體</h2>
      <div class="ap-fonts" data-group="font">
        ${FONTS.map(f => `<button data-v="${f.id}" style="font-family:${esc(f.css)}">${f.name}<small>範例文字 Aa</small></button>`).join('')}
      </div>

      <h2 class="section-title">介面大小</h2>
      <div class="ap-seg" data-group="size">
        ${SIZES.map(z => `<button data-v="${z.id}">${z.name}</button>`).join('')}
      </div>

      <h2 class="section-title">預覽</h2>
      <div class="ap-preview">
        <div class="ap-prev-head">範例標題</div>
        <p>這是預覽文字，用來看目前的字體、大小與顏色。</p>
        <div class="ap-prev-row"><span class="ap-chip">標籤</span><span class="ap-chip ap-chip-on">已選取</span></div>
        <div class="ap-prev-img" style="background-image:linear-gradient(90deg,#f59e0b,#ef4444)">圖片、漸層不受深色影響</div>
      </div>

      <button class="ap-reset">恢復預設外觀</button>
    </div>`;

  const sync = () => {
    container.querySelectorAll('[data-group]').forEach(g => g.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.v === s[g.dataset.group])));
    container.querySelectorAll('.ap-swatch[data-color]').forEach(b => b.classList.toggle('active', b.dataset.color.toLowerCase() === s.color.toLowerCase()));
    const custom = container.querySelector('.ap-custom');
    custom.classList.toggle('active', !PRESETS.some(p => p.color.toLowerCase() === s.color.toLowerCase()));
    custom.style.background = custom.classList.contains('active') ? s.color : '';
    container.querySelector('.ap-color').value = s.color;
    container.querySelector('.ap-range').value = s.saturation;
    container.querySelector('[data-for="saturation"]').textContent = s.saturation + '%';
  };
  // 即時套用並儲存（儲存失敗只提示，畫面仍然已經改了）
  let saving = Promise.resolve();
  const change = patch => {
    s = normalize({ ...s, ...patch });
    sync();
    saving = saving.then(() => saveAppearance(s)).catch(() => createToast('儲存外觀失敗', 'error'));
  };

  container.querySelector('.ios-back-btn').onclick = () => Router.back();
  container.querySelectorAll('[data-group]').forEach(g => g.querySelectorAll('button').forEach(b => { b.onclick = () => change({ [g.dataset.group]: b.dataset.v }); }));
  container.querySelectorAll('.ap-swatch[data-color]').forEach(b => { b.onclick = () => change({ color: b.dataset.color }); });
  const color = container.querySelector('.ap-color');
  color.oninput = () => change({ color: color.value });
  const range = container.querySelector('.ap-range');
  range.oninput = () => change({ saturation: Number(range.value) });
  container.querySelector('.ap-reset').onclick = () => { change({ ...DEFAULTS }); createToast('已恢復預設外觀'); };

  sync();
  return { element: container, cleanup: null };
}

export default {
  id: 'appearance',
  name: '外觀設定',
  icon: 'palette',
  routes: [{ path: '/appearance', render: renderAppearance }],
  navItem: { label: '外觀', icon: 'palette', path: '/appearance', showInNav: true, order: 140 },
  stylesPath: 'js/apps/appearance/style.css'
};
