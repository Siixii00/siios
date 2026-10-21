import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { MODES, UIS, PRESETS, FONTS, SIZES, DEFAULTS, normalize } from '../../core/appearance.js';
import { loadAppearance, saveAppearance, customCssErrors } from '../../core/appearance-dom.js';
import { SNIPPETS } from '../../core/appearance-css.js';
import { getAllApps } from '../registry.js';
import { askConfirm } from '../../core/dialogs.js';
import { startEditing } from '../../core/appearance-editor.js';
import { getImages, addImageFile, removeImage } from '../../core/appearance-media.js';
import { MAX_IMAGES } from '../../core/appearance-rules.js';

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
      <h2 class="section-title">桌面風格</h2>
      <div class="ap-seg" data-group="ui">
        ${UIS.map(u => `<button data-v="${u.id}">${u.name}</button>`).join('')}
      </div>
      <p class="ap-hint">iOS：玻璃質感圖示、置中標題。Android：圓形圖示、日期與搜尋列、往上滑打開 App 抽屜（所有 App 依名稱排序，主畫面隱藏的也找得到）、靠左的標題列。切換後回到主畫面就會看到。</p>

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
      <label class="ap-check"><input type="checkbox" class="ap-danger"> 保留警示用的紅色（刪除、錯誤）</label>
      <p class="ap-hint">會把各個 App 裡飽和的顏色（主色、按鈕、選取狀態）換成你選的顏色，並保留原本的深淺。選預設的綠色就是不換色。灰色、黑白和圖片不受影響；程式動態寫在畫面上的顏色可能不會被換到。</p>

      <h2 class="section-title">字體</h2>
      <div class="ap-fonts" data-group="font">
        ${FONTS.map(f => `<button data-v="${f.id}" style="font-family:${esc(f.css)}">${f.name}<small>範例文字 Aa</small></button>`).join('')}
      </div>

      <h2 class="section-title">介面大小</h2>
      <div class="ap-seg" data-group="size">
        ${SIZES.map(z => `<button data-v="${z.id}">${z.name}</button>`).join('')}
      </div>

      <h2 class="section-title">視覺編輯（不用寫程式）</h2>
      <div class="ap-visual">
        <p class="ap-hint">選一個 App，直接在畫面上點選要改的地方（文字、按鈕、卡片、背景），用面板改顏色、大小、圓角、背景圖片；也可以放上圖片貼紙、用手指拖到喜歡的位置。</p>
        <select class="ap-vscope"></select>
        <button class="ap-vstart">開始編輯這個 App</button>
        <div class="ap-lib-head">圖片庫 <small class="ap-lib-count"></small></div>
        <div class="ap-lib"></div>
        <div class="ap-changed"></div>
      </div>

      <h2 class="section-title">自訂 CSS（進階）</h2>
      <div class="ap-css">
        <select class="ap-scope"></select>
        <textarea class="ap-editor" spellcheck="false" placeholder="/* 在這裡寫 CSS，會即時套用 */"></textarea>
        <div class="ap-css-err" hidden></div>
        <div class="ap-snips">${SNIPPETS.map((n, i) => `<button data-snip="${i}">＋${esc(n.name)}</button>`).join('')}</div>
        <div class="ap-css-actions"><button class="ap-go">前往這個 App</button><button class="ap-clear">清除這個範圍</button></div>
        <p class="ap-hint">選「全域」會套用到所有頁面；選某個 App 只會套用在那個 App（會自動加上 <code>body[data-app="…"]</code>）。想知道某個元素叫什麼 class，可以用瀏覽器的開發者工具檢查。不允許 @import 和外部腳本。</p>
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
    container.querySelector('.ap-danger').checked = s.keepDanger;
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
  container.querySelector('.ap-danger').onchange = e => change({ keepDanger: e.target.checked });
  const range = container.querySelector('.ap-range');
  range.oninput = () => change({ saturation: Number(range.value) });
  container.querySelector('.ap-reset').onclick = () => { change({ ...DEFAULTS, customCss: s.customCss, appCss: s.appCss }); createToast('已恢復預設外觀（自訂 CSS 保留）'); };

  // ── 自訂 CSS 編輯器 ──
  const apps = getAllApps().filter(a => a.id && a.routes?.length);
  const scope = container.querySelector('.ap-scope');
  scope.innerHTML = '<option value="global">全域（所有頁面）</option>' + apps.map(a => `<option value="${esc(a.id)}">${esc(a.name || a.id)}</option>`).join('');
  const editor = container.querySelector('.ap-editor');
  const errBox = container.querySelector('.ap-css-err');
  const cssOf = key => (key === 'global' ? s.customCss : s.appCss[key]) || '';
  const showErr = () => {
    const msg = customCssErrors()[scope.value];
    errBox.hidden = !msg;
    errBox.textContent = msg ? '⚠ ' + msg + (/移除/.test(msg) ? '' : '（這段 CSS 暫時不會套用）') : '';
  };
  const setCss = (key, css) => change(key === 'global' ? { customCss: css } : { appCss: { ...s.appCss, [key]: css } });
  const loadEditor = () => {
    editor.value = cssOf(scope.value);
    showErr();
    container.querySelector('.ap-go').style.display = scope.value === 'global' ? 'none' : '';
  };
  let typing = null;
  editor.oninput = () => {
    clearTimeout(typing);
    typing = setTimeout(async () => { setCss(scope.value, editor.value); await saving; showErr(); }, 400);
  };
  scope.onchange = loadEditor;
  container.querySelectorAll('[data-snip]').forEach(b => {
    b.onclick = () => {
      editor.value = (editor.value.trim() ? editor.value.replace(/\s*$/, '\n\n') : '') + SNIPPETS[b.dataset.snip].css + '\n';
      editor.oninput();
    };
  });
  container.querySelector('.ap-clear').onclick = () => { editor.value = ''; setCss(scope.value, ''); showErr(); };
  container.querySelector('.ap-go').onclick = () => {
    const a = apps.find(x => x.id === scope.value);
    const p = a?.navItem?.path || a?.routes?.[0]?.path;
    if (p) Router.navigate(p);
  };
  loadEditor();

  // ── 視覺編輯：選 App、圖片庫、已修改的項目 ──
  const vscope = container.querySelector('.ap-vscope');
  vscope.innerHTML = apps.map(a => `<option value="${esc(a.id)}">${esc(a.name || a.id)}</option>`).join('');
  container.querySelector('.ap-vstart').onclick = () => {
    const a = apps.find(x => x.id === vscope.value);
    const p = a?.navItem?.path || a?.routes?.[0]?.path;
    if (!p) return;
    Router.navigate(p);
    setTimeout(() => startEditing({ onDone: () => Router.navigate('/appearance') }), 700);
  };
  const lib = container.querySelector('.ap-lib');
  const changed = container.querySelector('.ap-changed');
  const drawVisual = () => {
    const imgs = getImages();
    container.querySelector('.ap-lib-count').textContent = `${Object.keys(imgs).length} / ${MAX_IMAGES}`;
    lib.innerHTML = '';
    for (const [id, url] of Object.entries(imgs)) {
      const b = createElement('button', 'ap-lib-item');
      b.style.backgroundImage = `url("${url}")`;
      b.title = '點一下刪除這張圖片';
      b.onclick = async () => {
        if (!await askConfirm('刪除這張圖片？用到它的貼紙也會一起移除，背景圖片會失效。', { title: '刪除圖片' })) return;
        await removeImage(id);
        change({ stickers: s.stickers.filter(x => x.img !== id) });
        drawVisual();
      };
      lib.appendChild(b);
    }
    const file = createElement('input'); file.type = 'file'; file.accept = 'image/png,image/jpeg,image/webp,image/gif'; file.multiple = true; file.style.display = 'none';
    const add = createElement('button', 'ap-lib-item ap-lib-add', { textContent: '＋上傳' });
    add.onclick = () => file.click();
    file.onchange = async () => {
      for (const f of file.files) {
        try { await addImageFile(f); } catch (e) { createToast(e.message || '上傳失敗', 'error'); break; }
      }
      drawVisual();
    };
    lib.append(add, file);
    // 各 App 已經改過的東西：可以整個重設
    const names = Object.fromEntries(apps.map(a => [a.id, a.name || a.id]));
    const ids = [...new Set([...Object.keys(s.appRules), ...Object.keys(s.appOrders), ...s.stickers.map(x => x.app).filter(x => x !== '*')])];
    changed.innerHTML = ids.length || s.stickers.some(x => x.app === '*') ? '<div class="ap-lib-head">已經修改的地方</div>' : '';
    for (const id of ids) {
      const n = (s.appRules[id] || []).length, st = s.stickers.filter(x => x.app === id).length;
      const row = createElement('div', 'ap-changed-row');
      row.append(createElement('span', '', { textContent: `${names[id] || id}：${n} 處修改、${(s.appOrders[id] || []).length} 處順序、${st} 個貼紙` }));
      const btn = createElement('button', 'ap-mini', { textContent: '重設' });
      btn.onclick = async () => {
        if (!await askConfirm(`把「${names[id] || id}」改過的地方全部還原？`, { title: '重設' })) return;
        const { [id]: _drop, ...rest } = s.appRules;
        const { [id]: _dropOrder, ...restOrders } = s.appOrders;
        change({ appRules: rest, appOrders: restOrders, stickers: s.stickers.filter(x => x.app !== id) });
        drawVisual();
      };
      row.append(btn); changed.appendChild(row);
    }
    if (s.stickers.some(x => x.app === '*')) {
      const row = createElement('div', 'ap-changed-row');
      row.append(createElement('span', '', { textContent: `所有頁面的貼紙：${s.stickers.filter(x => x.app === '*').length} 個` }));
      const btn = createElement('button', 'ap-mini', { textContent: '移除' });
      btn.onclick = () => { change({ stickers: s.stickers.filter(x => x.app !== '*') }); drawVisual(); };
      row.append(btn); changed.appendChild(row);
    }
  };
  drawVisual();

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
