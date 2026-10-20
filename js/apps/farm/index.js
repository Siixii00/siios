import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB, CharactersDB, UsersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { getBalance, charge, credit, formatMoney, WalletError } from '../../core/wallet.js';

// 農場：場景式畫面（天空隨真實時間變化、斜角農田、作物分階段生長、牧場動物會走動）。
// 規則：種植、澆水施肥、倉庫、每日行情與訂單、動物、等級與經驗；收益與開銷都走「支付」錢包。
const FARM_KEY = 'farm_state';
const MIN = 60;

// lvl：農場等級需求；time：成熟秒數；seed：種子價；sell：基礎賣價；xp：收成經驗
const CROPS = [
  { id: 'c1', name: '番茄', icon: '🍅', lvl: 1, time: 2 * MIN, seed: 20, sell: 45, xp: 4 },
  { id: 'c2', name: '玉米', icon: '🌽', lvl: 1, time: 3 * MIN, seed: 25, sell: 62, xp: 5 },
  { id: 'c3', name: '草莓', icon: '🍓', lvl: 2, time: 5 * MIN, seed: 40, sell: 110, xp: 8 },
  { id: 'c4', name: '紅蘿蔔', icon: '🥕', lvl: 2, time: 4 * MIN, seed: 30, sell: 80, xp: 6 },
  { id: 'c5', name: '馬鈴薯', icon: '🥔', lvl: 3, time: 8 * MIN, seed: 50, sell: 150, xp: 10 },
  { id: 'c6', name: '南瓜', icon: '🎃', lvl: 4, time: 12 * MIN, seed: 80, sell: 250, xp: 14 },
  { id: 'c7', name: '向日葵', icon: '🌻', lvl: 5, time: 15 * MIN, seed: 90, sell: 300, xp: 16 },
  { id: 'c8', name: '西瓜', icon: '🍉', lvl: 6, time: 20 * MIN, seed: 130, sell: 440, xp: 22 },
  { id: 'c9', name: '葡萄', icon: '🍇', lvl: 7, time: 30 * MIN, seed: 200, sell: 700, xp: 30 },
  { id: 'c10', name: '茄子', icon: '🍆', lvl: 8, time: 25 * MIN, seed: 160, sell: 540, xp: 26 },
  { id: 'c11', name: '鳳梨', icon: '🍍', lvl: 9, time: 40 * MIN, seed: 280, sell: 1000, xp: 38 },
  { id: 'c12', name: '茶葉', icon: '🍵', lvl: 10, time: 60 * MIN, seed: 400, sell: 1500, xp: 55 }
];

// buy：購入價；interval：餵食後多久產出（秒）；feed：每次餵食費用
const ANIMALS = [
  { id: 'a1', name: '母雞', icon: '🐔', lvl: 2, buy: 150, feed: 5, interval: 4 * MIN, product: { id: 'p1', name: '雞蛋', icon: '🥚', sell: 40, xp: 4 } },
  { id: 'a2', name: '乳牛', icon: '🐄', lvl: 4, buy: 450, feed: 14, interval: 8 * MIN, product: { id: 'p2', name: '牛奶', icon: '🥛', sell: 130, xp: 8 } },
  { id: 'a3', name: '綿羊', icon: '🐑', lvl: 6, buy: 900, feed: 28, interval: 12 * MIN, product: { id: 'p3', name: '羊毛', icon: '🧶', sell: 260, xp: 14 } }
];
const ANIMAL_CAP = 4;

const START_PLOTS = 6, MAX_PLOTS = 12;
const plotPrice = n => 200 * (n - START_PLOTS); // 第 7 塊 200、第 8 塊 400 …
const WATER_CUT = 0.25, FERT_CUT = 0.5, FERT_PRICE = 30;
const xpNeed = lvl => 40 + 30 * (lvl - 1);

const ITEMS = [...CROPS.map(c => ({ id: c.id, name: c.name, icon: c.icon, sell: c.sell, crop: true })), ...ANIMALS.map(a => ({ ...a.product, crop: false }))];
const itemOf = id => ITEMS.find(i => i.id === id);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
// FNV-1a 加上最後的雪崩混合：只差最後一個字元的字串（c1、c2…）也要得到差很多的結果
const hash = str => {
  let h = 2166136261;
  for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  h ^= h >>> 16; h = Math.imul(h, 0x85ebca6b); h ^= h >>> 13; h = Math.imul(h, 0xc2b2ae35); h ^= h >>> 16;
  return (h >>> 0) / 4294967295;
};
const marketMult = id => 0.85 + 0.45 * hash(today() + ':' + id);
const priceOf = id => Math.max(1, Math.round(itemOf(id).sell * marketMult(id)));
const fmtDur = s => s >= 3600 ? Math.floor(s / 3600) + 'h' + Math.floor(s % 3600 / 60) + 'm' : s >= 60 ? Math.floor(s / 60) + 'm' + String(Math.floor(s % 60)).padStart(2, '0') + 's' : Math.max(0, Math.floor(s)) + 's';
const isRainy = () => hash(today() + 'rain') < 0.22;

// 依真實時間決定天空：[上色, 下色, 夜色遮罩透明度]
function skyFor(h) {
  if (h >= 21 || h < 5) return ['#0b1d3a', '#24407a', 0.5];
  if (h < 8) return ['#ff9a6b', '#ffe3a8', 0.18];
  if (h < 17) return ['#5fb8ff', '#d9f2ff', 0];
  if (h < 20) return ['#ff8a5b', '#ffd59a', 0.15];
  return ['#27406e', '#6a5a8a', 0.35];
}

function defaultState() {
  return { plots: Array(START_PLOTS).fill(null), level: 1, xp: 0, inv: {}, animals: [], orders: { date: '', list: [] }, harvested: 0 };
}

async function loadState() {
  const saved = (await SettingsDB.get(FARM_KEY)) || {};
  const s = { ...defaultState(), ...saved };
  s.plots = (Array.isArray(saved.plots) ? saved.plots : []).slice(0, MAX_PLOTS).map(p => (p && CROPS.some(c => c.id === p.cropId) ? p : null));
  while (s.plots.length < START_PLOTS) s.plots.push(null);
  s.inv = saved.inv || {};
  s.animals = Array.isArray(saved.animals) ? saved.animals.filter(a => ANIMALS.some(t => t.id === a.type)) : [];
  s.orders = saved.orders || { date: '', list: [] };
  return s;
}

function makeOrders(level) {
  const pool = CROPS.filter(c => c.lvl <= level);
  const d = today();
  return Array.from({ length: 3 }, (_, i) => {
    // 不重複挑作物（可挑的不到 3 種時才會重複）
    const crop = pool.length > 3 ? pool.splice(Math.floor(hash(d + 'o' + i) * pool.length), 1)[0] : pool[Math.floor(hash(d + 'o' + i) * pool.length)];
    const qty = 2 + Math.floor(hash(d + 'q' + i) * 5);
    return { id: d + '-' + i, item: crop.id, qty, reward: Math.round(qty * crop.sell * 1.35), xp: qty * 3, done: false };
  });
}

// ───── 靜態場景（只建一次，之後不重畫，動畫才不會被打斷）─────
const SCENE = `
  <div class="fm-sky"></div>
  <div class="fm-celestial"></div>
  <span class="fm-cloud c1">☁️</span><span class="fm-cloud c2">☁️</span><span class="fm-cloud c3">☁️</span>
  <svg class="fm-hills" viewBox="0 0 400 120" preserveAspectRatio="none"><path d="M0 120 L0 70 Q60 20 130 62 T260 58 T400 48 L400 120Z" fill="#7cc576"/><path d="M0 120 L0 92 Q80 50 170 88 T400 80 L400 120Z" fill="#5fae5a"/></svg>
  <svg class="fm-barn" viewBox="0 0 90 80"><rect x="8" y="30" width="74" height="46" fill="#c0392b"/><polygon points="2,32 45,4 88,32" fill="#8e2a20"/><rect x="34" y="46" width="22" height="30" fill="#f5e6c8"/><path d="M34 46 L56 76 M56 46 L34 76" stroke="#8e2a20" stroke-width="2"/><circle cx="45" cy="24" r="5" fill="#f5e6c8"/></svg>
  <svg class="fm-house" viewBox="0 0 70 70"><rect x="8" y="30" width="54" height="36" fill="#f3d9a4"/><polygon points="2,32 35,6 68,32" fill="#9c5b3b"/><rect x="28" y="44" width="14" height="22" fill="#7a4a24"/><rect x="12" y="38" width="12" height="10" fill="#9fd8ff"/><rect x="46" y="38" width="12" height="10" fill="#9fd8ff"/><rect x="46" y="10" width="8" height="16" fill="#8b4a30"/></svg>
  <svg class="fm-windmill" viewBox="0 0 60 90"><polygon points="20,88 40,88 35,34 25,34" fill="#e8d9b5"/><g class="blades"><path d="M30 34 L30 6 M30 34 L58 34 M30 34 L30 62 M30 34 L2 34" stroke="#8b5a2b" stroke-width="4" stroke-linecap="round"/><path d="M30 34 L38 6 L30 6Z M30 34 L58 42 L58 34Z M30 34 L22 62 L30 62Z M30 34 L2 26 L2 34Z" fill="#fff" opacity=".9"/></g><circle cx="30" cy="34" r="4" fill="#5a3417"/></svg>
  <span class="fm-tree t1">🌳</span><span class="fm-tree t2">🌲</span><span class="fm-tree t3">🌳</span><span class="fm-tree t4">🌲</span>
  <div class="fm-ground"></div>
  <div class="fm-fieldwrap"><div class="fm-field"></div></div>
  <span class="fm-farmer">🧑‍🌾</span>
  <div class="fm-pen"><span class="fm-pen-sign">牧場</span><div class="fm-animals"></div></div>
  <div class="fm-rain"></div>
  <div class="fm-night"></div>
  <div class="fm-fx"></div>`;

async function renderFarm() {
  const container = createElement('div', 'app-container farm-app');
  let alive = true;
  let sheet = null;
  let busy = false;
  let mode = 'plant'; // plant | water | fert
  let selectedCrop = 'c1';
  const rainy = isRainy();
  const st = await loadState();
  if (st.orders.date !== today()) st.orders = { date: today(), list: makeOrders(st.level) };
  let balance = await getBalance();
  const save = () => SettingsDB.set(FARM_KEY, st);

  const growSec = p => CROPS.find(x => x.id === p.cropId).time - (p.cut || 0);
  const elapsed = p => (Date.now() - p.plantedAt) / 1000;
  const addXp = n => {
    st.xp += n;
    while (st.xp >= xpNeed(st.level)) { st.xp -= xpNeed(st.level); st.level++; createToast('🎉 農場升到 ' + st.level + ' 級！', 'success'); }
  };
  const invCount = id => st.inv[id] || 0;
  const addInv = (id, n) => { st.inv[id] = invCount(id) + n; if (st.inv[id] <= 0) delete st.inv[id]; };

  container.innerHTML = `
    <header class="ios-header">
      <button class="ios-back-btn" data-act="back"><i class="fas fa-chevron-left"></i> 返回</button>
      <h1 class="menu-title">農場</h1>
      <div class="coins"><i class="fas fa-coins"></i> <span class="farm-balance"></span></div>
    </header>
    <div class="fm-wrap">
      <div class="fm-hud"><b class="hud-lv"></b><div class="fm-xp"><i></i></div><span class="hud-xp"></span><span class="hud-weather"></span></div>
      <div class="fm-world">${SCENE}</div>
      <div class="fm-hint"></div>
      <div class="fm-seedbar"></div>
      <div class="fm-tools">
        <button data-act="mode" data-mode="plant">🌱 種植</button>
        <button data-act="mode" data-mode="water">💧 澆水</button>
        <button data-act="mode" data-mode="fert">🌿 施肥 ${formatMoney(FERT_PRICE)}</button>
        <button data-act="harvestall" class="hv">🧺 全部收成<i></i></button>
      </div>
      <div class="fm-dock">
        <button data-act="open" data-sheet="stock">📦 倉庫<i data-badge="stock"></i></button>
        <button data-act="open" data-sheet="orders">📋 訂單<i data-badge="orders"></i></button>
        <button data-act="open" data-sheet="animals">🐾 牧場商店</button>
      </div>
    </div>
    <div class="fm-sheet-host"></div>`;

  const $ = s => container.querySelector(s);
  const world = $('.fm-world');
  const field = $('.fm-field');
  const animalsEl = $('.fm-animals');
  const sheetHost = $('.fm-sheet-host');
  if (rainy) world.classList.add('rainy');

  // ───── 畫面同步（每秒一次；只改有變的部分）─────
  const sig = {};
  const setHtml = (el, key, html) => { if (sig[key] !== html) { sig[key] = html; el.innerHTML = html; } };

  function cropHtml(p) {
    const c = CROPS.find(x => x.id === p.cropId), prog = Math.min(1, elapsed(p) / growSec(p));
    if (prog >= 1) return `<span class="cr ready">${c.icon}</span><i class="spark">✨</i>`;
    if (prog < 0.25) return '<span class="cr s0">🌱</span>';
    if (prog < 0.55) return '<span class="cr s1">🌿</span>';
    return `<span class="cr s2" style="--sc:${(0.55 + prog * 0.3).toFixed(2)}">${c.icon}</span>`;
  }

  function syncField() {
    const tiles = st.plots.map((p, i) => {
      const ready = p && growSec(p) - elapsed(p) <= 0;
      const inner = !p ? '<span class="plus">＋</span>' : cropHtml(p);
      const flags = p ? `${p.watered ? '<em class="w">💧</em>' : ''}${p.fert ? '<em class="f">🌿</em>' : ''}` : '';
      const timer = p && !ready ? `<small class="tm" data-i="${i}">${fmtDur(growSec(p) - elapsed(p))}</small>` : '';
      return `<div class="tile ${p ? (ready ? 'ready' : 'growing') : 'empty'} ${p?.watered ? 'wet' : ''} ${p?.fert ? 'rich' : ''}" data-act="tile" data-i="${i}"><div class="up"><div class="in">${inner}${flags}${timer}</div></div></div>`;
    });
    if (st.plots.length < MAX_PLOTS) tiles.push(`<div class="tile lock" data-act="buyplot"><div class="up"><div class="in"><span class="lk">🔒</span><small>${formatMoney(plotPrice(st.plots.length + 1))}</small></div></div></div>`);
    // 倒數文字每秒都在變，不納入結構簽章，另外更新
    const structure = tiles.join('').replace(/<small class="tm"[^>]*>[^<]*<\/small>/g, '');
    if (sig.field !== structure) { sig.field = structure; field.innerHTML = tiles.join(''); field.style.gridTemplateRows = `repeat(${Math.ceil(tiles.length / 3)}, 56px)`; }
    else st.plots.forEach((p, i) => { if (p) { const t = field.querySelector(`.tm[data-i="${i}"]`); if (t) t.textContent = fmtDur(growSec(p) - elapsed(p)); } });
  }

  function syncAnimals() {
    const list = st.animals.map((a, i) => {
      const t = ANIMALS.find(x => x.id === a.type);
      const left = a.fedAt ? t.interval - (Date.now() - a.fedAt) / 1000 : null;
      const state = !a.fedAt ? 'hungry' : left <= 0 ? 'ready' : 'busy';
      const x = 6 + ((i * 37) % 80), y = 20 + ((i * 53) % 50);
      return `<div class="animal ${state}" data-act="animal" data-i="${i}" style="left:${x}%;top:${y}%;--d:${(4 + i % 4)}s;--dl:${-(i * 1.3)}s"><span class="bubble">${state === 'hungry' ? '🥣' : state === 'ready' ? t.product.icon : '💤'}</span><span class="an">${t.icon}</span></div>`;
    }).join('');
    setHtml(animalsEl, 'animals', list || '<span class="pen-empty">還沒有動物，點下方「牧場商店」買一隻吧</span>');
  }

  function syncHud() {
    $('.farm-balance').textContent = formatMoney(balance);
    $('.hud-lv').textContent = 'Lv.' + st.level;
    $('.fm-xp i').style.width = (st.xp / xpNeed(st.level) * 100) + '%';
    $('.hud-xp').textContent = st.xp + '/' + xpNeed(st.level);
    $('.hud-weather').textContent = rainy ? '🌧 雨天' : '☀️ 晴天';
    const h = new Date().getHours() + new Date().getMinutes() / 60;
    const [a, b, night] = skyFor(Math.floor(h));
    $('.fm-sky').style.background = `linear-gradient(${a}, ${b})`;
    $('.fm-night').style.opacity = night;
    const cel = $('.fm-celestial');
    const day = h >= 6 && h < 18;
    const t = day ? (h - 6) / 12 : ((h + 6) % 24) / 12; // 0~1 沿弧線移動
    cel.textContent = day ? '☀️' : '🌙';
    cel.style.left = (8 + t * 78) + '%';
    cel.style.top = (14 + 52 * Math.pow(2 * t - 1, 2)) + 'px';
    const ready = st.plots.filter(p => p && growSec(p) - elapsed(p) <= 0).length;
    $('.fm-tools .hv i').textContent = ready ? ' ' + ready : '';
    $('.fm-tools .hv').classList.toggle('has', ready > 0);
    container.querySelectorAll('.fm-tools [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
    $('[data-badge=stock]').textContent = Object.keys(st.inv).length ? '●' : '';
    $('[data-badge=orders]').textContent = st.orders.list.some(o => !o.done) ? '●' : '';
    const hint = $('.fm-hint');
    const crop = CROPS.find(c => c.id === selectedCrop);
    hint.textContent = mode === 'plant' ? `點空地種下 ${crop.icon}${crop.name}（${formatMoney(crop.seed)}）；成熟後點一下收成${rainy ? '；雨天新種下的作物自動澆水' : ''}` : mode === 'water' ? '點生長中的作物澆水（縮短 25%，免費）' : `點生長中的作物施肥（縮短 50%，${formatMoney(FERT_PRICE)}）；澆水加施肥收成加倍`;
    const bar = $('.fm-seedbar');
    bar.style.display = mode === 'plant' ? '' : 'none';
    setHtml(bar, 'seeds', CROPS.map(c => `<button class="seed ${c.id === selectedCrop ? 'on' : ''} ${st.level < c.lvl ? 'locked' : ''}" data-act="seed" data-id="${c.id}"><span>${st.level < c.lvl ? '🔒' : c.icon}</span><small>${st.level < c.lvl ? 'Lv.' + c.lvl : formatMoney(c.seed)}</small></button>`).join(''));
  }

  function sync() { syncField(); syncAnimals(); syncHud(); }

  // 浮動文字回饋（+XP、金額、收成）
  function fx(text, target, cls = '') {
    const wr = world.getBoundingClientRect(), r = (target || world).getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'fx-pop ' + cls;
    span.textContent = text;
    span.style.left = (r.left + r.width / 2 - wr.left) + 'px';
    span.style.top = (r.top - wr.top) + 'px';
    $('.fm-fx').appendChild(span);
    setTimeout(() => span.remove(), 1200);
  }

  // ───── 面板 ─────
  function stockHtml() {
    const rows = Object.keys(st.inv).map(id => {
      const it = itemOf(id), m = marketMult(id), p = priceOf(id);
      return `<div class="stock-row"><span class="st-name">${it.icon} ${it.name} × ${st.inv[id]}</span><span class="st-price ${m >= 1 ? 'up' : 'down'}">${formatMoney(p)} ${m >= 1 ? '▲' : '▼'}</span>
        <button class="fm-btn" data-act="sell" data-id="${id}">賣出</button><button class="fm-btn alt" data-act="gift" data-id="${id}">送禮</button></div>`;
    }).join('');
    const total = Object.keys(st.inv).reduce((s, id) => s + priceOf(id) * st.inv[id], 0);
    return `<h3>📦 倉庫</h3>${rows || '<p class="fm-muted center">倉庫是空的，收成後的作物與動物產品會放在這裡。</p>'}
      ${rows ? `<button class="fm-primary" data-act="sellall">全部賣出（約 ${formatMoney(total)}）</button>` : ''}
      <p class="farm-hint">每天的行情不同（▲ 高於基本價、▼ 低於基本價），可以等行情好再賣，也可以拿去交訂單。</p>`;
  }
  function ordersHtml() {
    return '<h3>📋 今日訂單</h3>' + st.orders.list.map(o => {
      const it = itemOf(o.item), have = invCount(o.item);
      return `<div class="order ${o.done ? 'done' : ''}"><div><strong>${it.icon} ${it.name} × ${o.qty}</strong><small>報酬 ${formatMoney(o.reward)} ＋ ${o.xp} XP（比行情高約 35%）</small></div>
        ${o.done ? '<span class="fm-muted">已完成</span>' : `<button class="fm-btn" data-act="order" data-id="${o.id}" ${have >= o.qty ? '' : 'disabled'}>${have >= o.qty ? '交貨' : have + '/' + o.qty}</button>`}</div>`;
    }).join('') + '<p class="farm-hint">每天會換一批訂單；只會要求你目前等級已解鎖的作物。</p>';
  }
  function animalsShopHtml() {
    return '<h3>🐾 牧場商店</h3><p class="farm-hint">動物會在牧場裡走動：頭上 🥣 表示餓了（點一下餵食），出現產品圖示表示可以收取，💤 是生產中。</p>' + ANIMALS.map(t => {
      const owned = st.animals.filter(a => a.type === t.id).length;
      const ok = st.level >= t.lvl && owned < ANIMAL_CAP;
      return `<button class="shop-row" data-act="buyanimal" data-id="${t.id}" ${ok ? '' : 'disabled'}><span>${t.icon} ${t.name}（${owned}/${ANIMAL_CAP}）<small>${t.product.icon}${t.product.name} ${formatMoney(t.product.sell)}／每 ${Math.round(t.interval / MIN)} 分　飼料 ${formatMoney(t.feed)}</small></span><b>${st.level < t.lvl ? '需 Lv.' + t.lvl : owned >= ANIMAL_CAP ? '已滿' : formatMoney(t.buy)}</b></button>`;
    }).join('');
  }
  function plotSheetHtml() {
    const p = st.plots[sheet.idx];
    if (!p) return '';
    const c = CROPS.find(x => x.id === p.cropId);
    return `<h3>${c.icon} ${c.name}</h3><p class="fm-muted">還要 ${fmtDur(growSec(p) - elapsed(p))}</p>
      <button class="shop-row" data-act="water" ${p.watered ? 'disabled' : ''}><span>💧 澆水<small>縮短 25% 生長時間（每株一次，免費）</small></span><b>${p.watered ? '已澆' : '免費'}</b></button>
      <button class="shop-row" data-act="fert" ${p.fert ? 'disabled' : ''}><span>🌿 施肥<small>縮短 50% 生長時間（每株一次）</small></span><b>${p.fert ? '已施' : formatMoney(FERT_PRICE)}</b></button>
      <button class="shop-row danger" data-act="remove"><span>🗑 鏟除<small>放棄這株作物（不退種子錢）</small></span><b></b></button>`;
  }
  function giftHtml() {
    return `<h3>送 ${itemOf(sheet.id).icon} ${itemOf(sheet.id).name} 給誰？</h3>` + (sheet.chars.length ? sheet.chars.map(c => `<button class="shop-row" data-act="giftto" data-cid="${c.id}"><span>${esc(c.name)}</span><b>送出</b></button>`).join('') : '<p class="fm-muted">還沒有角色。</p>');
  }
  function renderSheet() {
    if (!sheet) { sheetHost.innerHTML = ''; return; }
    const body = sheet.type === 'stock' ? stockHtml() : sheet.type === 'orders' ? ordersHtml() : sheet.type === 'animals' ? animalsShopHtml() : sheet.type === 'plot' ? plotSheetHtml() : giftHtml();
    sheetHost.innerHTML = `<div class="fm-sheet-bg" data-act="closesheet"><div class="fm-sheet">${body}<button class="fm-primary alt" data-act="closesheet">關閉</button></div></div>`;
  }

  async function spend(amount, desc) { await charge(amount, desc, { category: 'farm' }); balance = await getBalance(); }
  async function earn(amount, desc) { await credit(amount, desc, { category: 'farm' }); balance = await getBalance(); }

  async function run(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); await save(); }
    catch (e) { createToast(e instanceof WalletError ? e.message : (e.message || '操作失敗'), 'error'); }
    finally { busy = false; if (alive) { sync(); if (sheet) renderSheet(); } }
  }

  const harvestPlot = (idx, el) => {
    const p = st.plots[idx];
    if (!p || growSec(p) - elapsed(p) > 0) return false;
    const c = CROPS.find(x => x.id === p.cropId);
    const bonus = p.watered && p.fert ? 2 : 1;
    addInv(c.id, bonus);
    st.plots[idx] = null; st.harvested++;
    addXp(c.xp);
    fx('+' + bonus + ' ' + c.icon, el, 'gain'); setTimeout(() => fx('+' + c.xp + ' XP', el, 'xp'), 250);
    return true;
  };
  const waterPlot = p => { if (p.watered) return false; p.watered = true; p.cut = (p.cut || 0) + CROPS.find(c => c.id === p.cropId).time * WATER_CUT; return true; };

  async function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'closesheet' && el.classList.contains('fm-sheet-bg') && e.target !== el) return;
    const { act, i, id } = el.dataset;
    const idx = i === undefined ? null : +i;

    if (act === 'back') return Router.back();
    if (act === 'closesheet') { sheet = null; return renderSheet(); }
    if (act === 'open') { sheet = { type: el.dataset.sheet }; return renderSheet(); }
    if (act === 'mode') { mode = el.dataset.mode; return sync(); }
    if (act === 'seed') {
      const c = CROPS.find(x => x.id === id);
      if (st.level < c.lvl) return createToast('農場達到 Lv.' + c.lvl + ' 才能種植', 'error');
      selectedCrop = id; return sync();
    }

    if (act === 'tile') return run(async () => {
      const p = st.plots[idx];
      if (p && growSec(p) - elapsed(p) <= 0) { harvestPlot(idx, el); return; }
      if (!p) {
        if (mode !== 'plant') return createToast('先切換到「種植」再點空地', 'info');
        const c = CROPS.find(x => x.id === selectedCrop);
        if (st.level < c.lvl) throw new Error('這個作物需要農場 Lv.' + c.lvl);
        await spend(c.seed, '購買' + c.name + '種子');
        st.plots[idx] = { cropId: c.id, plantedAt: Date.now(), cut: 0 };
        if (rainy) waterPlot(st.plots[idx]); // 雨天：雨水自動澆灌
        addXp(1);
        fx('-' + formatMoney(c.seed), el, 'cost');
        return;
      }
      if (mode === 'water') { if (waterPlot(p)) fx('💧', el, 'gain'); else createToast('這株已經澆過水了'); return; }
      if (mode === 'fert') {
        if (p.fert) return createToast('這株已經施過肥了');
        await spend(FERT_PRICE, '購買肥料');
        p.fert = true; p.cut = (p.cut || 0) + CROPS.find(c => c.id === p.cropId).time * FERT_CUT;
        fx('🌿', el, 'gain');
        return;
      }
      sheet = { type: 'plot', idx }; // 種植模式下點生長中的作物：開詳細面板
    });
    if (act === 'water') return run(async () => { const p = st.plots[sheet.idx]; if (p) waterPlot(p); sheet = null; });
    if (act === 'fert') return run(async () => {
      const p = st.plots[sheet.idx];
      if (p && !p.fert) { await spend(FERT_PRICE, '購買肥料'); p.fert = true; p.cut = (p.cut || 0) + CROPS.find(c => c.id === p.cropId).time * FERT_CUT; }
      sheet = null;
    });
    if (act === 'remove') return run(async () => { if (confirm('確定鏟除？')) { st.plots[sheet.idx] = null; sheet = null; } });
    if (act === 'harvestall') return run(async () => {
      let n = 0;
      st.plots.forEach((p, k) => { if (harvestPlot(k, field.querySelector(`[data-i="${k}"]`))) n++; });
      if (!n) createToast('目前沒有成熟的作物');
    });
    if (act === 'buyplot') return run(async () => {
      const price = plotPrice(st.plots.length + 1);
      if (!confirm('花 ' + formatMoney(price) + ' 擴建一塊農地？')) return;
      await spend(price, '擴建農地');
      st.plots.push(null);
    });

    if (act === 'buyanimal') return run(async () => {
      const t = ANIMALS.find(x => x.id === id);
      if (st.level < t.lvl || st.animals.filter(a => a.type === id).length >= ANIMAL_CAP) return;
      await spend(t.buy, '購買' + t.name);
      st.animals.push({ type: id, fedAt: null });
      createToast('牧場來了一隻' + t.icon + t.name, 'success');
    });
    if (act === 'animal') return run(async () => {
      const a = st.animals[idx], t = ANIMALS.find(x => x.id === a.type);
      const left = a.fedAt ? t.interval - (Date.now() - a.fedAt) / 1000 : null;
      if (!a.fedAt) { await spend(t.feed, '飼料（' + t.name + '）'); a.fedAt = Date.now(); fx('-' + formatMoney(t.feed), el, 'cost'); }
      else if (left <= 0) { addInv(t.product.id, 1); a.fedAt = null; addXp(t.product.xp); fx('+1 ' + t.product.icon, el, 'gain'); }
      else createToast(t.name + ' 還要 ' + fmtDur(left) + ' 才會產出');
    });

    if (act === 'sell') return run(async () => {
      const n = invCount(id); if (!n) return;
      const amount = priceOf(id) * n;
      await earn(amount, '賣出' + itemOf(id).name + ' ×' + n);
      addInv(id, -n);
      fx('+' + formatMoney(amount), $('.coins'), 'gain');
    });
    if (act === 'sellall') return run(async () => {
      const ids = Object.keys(st.inv); let amount = 0;
      ids.forEach(k => { amount += priceOf(k) * st.inv[k]; });
      if (!amount) return;
      await earn(amount, '賣出倉庫全部商品');
      ids.forEach(k => delete st.inv[k]);
      fx('+' + formatMoney(amount), $('.coins'), 'gain');
    });
    if (act === 'order') return run(async () => {
      const o = st.orders.list.find(x => x.id === id);
      if (!o || o.done || invCount(o.item) < o.qty) return;
      await earn(o.reward, '完成訂單：' + itemOf(o.item).name + ' ×' + o.qty);
      addInv(o.item, -o.qty); o.done = true; addXp(o.xp);
      createToast('訂單完成！+' + formatMoney(o.reward), 'success');
    });

    if (act === 'gift') { sheet = { type: 'gift', id, chars: await CharactersDB.getAll() }; return renderSheet(); }
    if (act === 'giftto') return run(async () => {
      const it = itemOf(sheet.id), cid = el.dataset.cid;
      if (!invCount(it.id)) return;
      addInv(it.id, -1);
      const chars = sheet.chars; sheet = null;
      const c = chars.find(x => x.id === cid);
      const user = (await UsersDB.getAll())[0];
      createToast('已把 ' + it.icon + it.name + ' 送給 ' + c.name, 'success');
      const s = await APIClient.getSettings();
      let reply = '';
      if (s.api_url && s.api_key) {
        try {
          const ctx = await buildAppContext({ characterId: cid });
          reply = await APIClient.complete([{ role: 'system', content: (ctx.systemPrompt || '') + '\n\n你是這個角色本人，用第一人稱、符合性格，使用繁體中文，1~2 句，不要提到自己是 AI。' }, { role: 'user', content: (user?.name || '我') + ' 把自己農場種的 ' + it.name + ' 送給你了，你怎麼回應？' }], { temperature: 0.9, maxTokens: 200 });
        } catch (err) { console.warn('[Farm] 角色回應失敗', err); }
      }
      if (reply) createToast(c.name + '：' + reply.slice(0, 80));
      saveInteractionMemory({ characterId: cid, userId: user?.id || '', sourceApp: 'farm', sourceType: 'interaction', sourceSubtype: 'social', content: (user?.name || '使用者') + '把農場種的' + it.name + '送給了我' + (reply ? '，我說：「' + reply.slice(0, 60) + '」' : ''), importance: 0.4 });
    });
  }

  container.addEventListener('click', onClick);
  sync();
  const timer = setInterval(() => { if (!busy) sync(); }, 1000);
  return { element: container, cleanup: () => { alive = false; clearInterval(timer); } };
}

export default {
  id: 'farm',
  name: '農場',
  icon: 'agriculture',
  routes: [{ path: '/farm', render: renderFarm }],
  navItem: { label: '農場', icon: 'agriculture', path: '/farm', showInNav: true, order: 127 },
  stylesPath: 'js/apps/farm/style.css'
};
