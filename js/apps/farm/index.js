import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB, CharactersDB, UsersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { getBalance, charge, credit, formatMoney, WalletError } from '../../core/wallet.js';
import { askConfirm } from '../../core/dialogs.js';
import { MASTERY_AT, LUCK_HARVESTS, starsOf, perkOf, masteryReward, rollGolden, visitorOffer, migrateSaved } from './game.js';

// 農場：場景式畫面（俯視的像素農場，白天夜晚與雨天會變色、作物分階段生長、牧場動物會走動）。
// 規則：種植、澆水施肥、倉庫、每日行情與訂單、動物、等級與經驗；收益與開銷都走「支付」錢包。
const FARM_KEY = 'farm_state';
const MIN = 60;

// 像素圖塊來自 Kenney Tiny Farm（CC0，assets/farm/tiny-farm.png）。圖塊用素材表上的 [欄, 列] 表示，一格 16px、間隔 1px。
// 素材表前 6 列各是一種作物：幼苗、長大、成熟（4、5、6 欄）、收成品（8 欄）、種子袋（9 欄）
const fam = r => ({ s0: [4, r], s1: [5, r], ready: [6, r], item: [8, r], bag: [9, r] });
// size 省略時用外層的 --t（場景裡一格的大小），面板裡要給像素大小
const tl = ([c, r], size = 0) => `<i class="fpx" style="--c:${c};--r:${r}${size ? ';--t:' + size + 'px' : ''}"></i>`;

// lvl：農場等級需求；time：成熟秒數；seed：種子價；sell：基礎賣價；xp：收成經驗
const CROPS = [
  { id: 'c1', name: '番茄', icon: '🍅', lvl: 1, time: 2 * MIN, seed: 20, sell: 45, xp: 4, art: fam(3) },
  { id: 'c2', name: '玉米', icon: '🌽', lvl: 1, time: 3 * MIN, seed: 25, sell: 62, xp: 5, art: fam(2) },
  { id: 'c3', name: '草莓', icon: '🍓', lvl: 2, time: 5 * MIN, seed: 40, sell: 110, xp: 8, art: { s0: [4, 3], s1: [5, 3], ready: [6, 6], item: [6, 6], bag: [10, 3] } },
  { id: 'c4', name: '紅蘿蔔', icon: '🥕', lvl: 2, time: 4 * MIN, seed: 30, sell: 80, xp: 6, art: fam(0) },
  { id: 'c5', name: '蕪菁', icon: '🧅', lvl: 3, time: 8 * MIN, seed: 50, sell: 150, xp: 10, art: fam(1) },
  { id: 'c6', name: '高麗菜', icon: '🥬', lvl: 4, time: 12 * MIN, seed: 80, sell: 250, xp: 14, art: fam(4) },
  { id: 'c7', name: '向日葵', icon: '🌻', lvl: 5, time: 15 * MIN, seed: 90, sell: 300, xp: 16, art: { s0: [9, 6], s1: [8, 6], ready: [11, 6], item: [11, 6], bag: [10, 5] } },
  { id: 'c8', name: '小麥', icon: '🌾', lvl: 6, time: 20 * MIN, seed: 130, sell: 440, xp: 22, art: fam(5) }
];

// buy：購入價；interval：餵食後多久產出（秒）；feed：每次餵食費用；tile：動物的圖塊，item：產品的圖塊
const ANIMALS = [
  { id: 'a1', tile: [2, 10], name: '母雞', icon: '🐔', lvl: 2, buy: 150, feed: 5, interval: 4 * MIN, product: { id: 'p1', name: '雞蛋', icon: '🥚', sell: 40, xp: 4, item: [5, 10] } },
  { id: 'a2', tile: [1, 10], name: '乳牛', icon: '🐄', lvl: 4, buy: 450, feed: 14, interval: 8 * MIN, product: { id: 'p2', name: '牛奶', icon: '🥛', sell: 130, xp: 8, item: [4, 10] } },
  { id: 'a3', tile: [0, 10], name: '綿羊', icon: '🐑', lvl: 6, buy: 900, feed: 28, interval: 12 * MIN, product: { id: 'p3', name: '羊毛', icon: '🧶', sell: 260, xp: 14, item: [2, 6] } }
];
const ANIMAL_CAP = 4;

const START_PLOTS = 6, MAX_PLOTS = 12;
const plotPrice = n => 200 * (n - START_PLOTS); // 第 7 塊 200、第 8 塊 400 …
const WATER_CUT = 0.25, FERT_CUT = 0.5, FERT_PRICE = 30;
const xpNeed = lvl => 40 + 30 * (lvl - 1);

const ITEMS = [...CROPS.map(c => ({ id: c.id, name: c.name, icon: c.icon, sell: c.sell, crop: true, item: c.art.item })), ...ANIMALS.map(a => ({ ...a.product, crop: false }))];
const itemOf = id => ITEMS.find(i => i.id === id);
const iconOf = id => tl(itemOf(id).item, 26); // 面板裡的物品圖示

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

// 依真實時間決定夜色遮罩的透明度
function nightFor(h) {
  if (h >= 21 || h < 5) return 0.5;
  if (h < 8) return 0.18;
  if (h < 17) return 0;
  if (h < 20) return 0.15;
  return 0.35;
}

function defaultState() {
  return { plots: Array(START_PLOTS).fill(null), level: 1, xp: 0, inv: {}, animals: [], orders: { date: '', list: [] }, harvested: 0, mastery: {}, luck: 0, visitor: { date: '', choice: null }, lastSeen: 0 };
}

async function loadState() {
  const { saved, refund } = migrateSaved((await SettingsDB.get(FARM_KEY)) || {}); // 下架的作物先處理掉（退款在 renderFarm 入帳）
  const s = { ...defaultState(), ...saved, refund };
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
// 場景是 7 格寬、10 格高的俯視地圖：piece 把 w×h 塊圖塊擺在第 (x, y) 格
const piece = ([c, r], w, h, x, y, cls = '') => `<div class="fm-obj ${cls}" style="--w:${w};--x:${x};--y:${y}">${Array.from({ length: w * h }, (_, i) => tl([c + i % w, r + Math.floor(i / w)])).join('')}</div>`;
const SCENE = `
  <div class="fm-grass"></div>
  ${piece([3, 1], 1, 1, 0, 0)}${piece([3, 0], 1, 1, 1, 1)}${piece([3, 2], 1, 1, 0, 2)}${piece([3, 3], 1, 1, 3, 0)}
  ${piece([6, 7], 3, 4, 4, 0)}
  ${piece([0, 8], 1, 1, 2, 3)}${piece([1, 9], 1, 1, 3, 3, 'fm-farmer')}
  ${piece([2, 9], 2, 1, 5, 4)}${piece([11, 0], 1, 1, 5, 5)}${piece([3, 10], 1, 1, 6, 5)}${piece([0, 6], 1, 1, 5, 6)}
  <div class="fm-field"></div>
  <button class="fm-visitor" data-act="open" data-sheet="visitor" type="button">${tl([0, 9], 40)}<b>!</b></button>
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
  let rainy = isRainy();
  const st = await loadState();
  if (st.orders.date !== today()) st.orders = { date: today(), list: makeOrders(st.level) };
  if (st.visitor.date !== today()) st.visitor = { date: today(), choice: null };
  let balance = await getBalance();
  const save = () => SettingsDB.set(FARM_KEY, st);
  if (st.refund) { // 像素版改版：下架作物的退款
    await earn(st.refund, '農場改版：下架作物退款');
    createToast('農場改成像素版，葡萄、茄子、鳳梨、茶葉已下架，退還 ' + formatMoney(st.refund), 'success');
    delete st.refund;
    await save();
  }
  delete st.refund;

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
        <button data-act="open" data-sheet="book">📖 圖鑑</button>
      </div>
      <p class="fm-credit">像素素材：Kenney.nl（CC0）</p>
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

  // 作物依生長進度換圖塊：幼苗、長大、成熟（成熟時頭上多一個可點的收成氣泡）
  function cropHtml(p) {
    const c = CROPS.find(x => x.id === p.cropId), prog = Math.min(1, elapsed(p) / growSec(p));
    const [col, row] = c.art[prog >= 1 ? 'ready' : prog < 0.35 ? 's0' : 's1'];
    return `<i class="fpx cr ${prog >= 1 ? 'ready' : ''}" style="--c:${col};--r:${row}"></i>${prog >= 1 ? `<span class="rb">${tl(c.art.item, 20)}</span>` : ''}`;
  }

  function syncField() {
    const soil = tl([0, 0]);
    const tiles = st.plots.map((p, i) => {
      const ready = p && growSec(p) - elapsed(p) <= 0;
      const flags = p ? `${p.watered ? '<em class="w">💧</em>' : ''}${p.fert ? '<em class="f">🌿</em>' : ''}` : '';
      const timer = p && !ready ? `<small class="tm" data-i="${i}">${fmtDur(growSec(p) - elapsed(p))}</small>` : '';
      return `<div class="tile ${p ? (ready ? 'ready' : 'growing') : 'empty'} ${p?.watered ? 'wet' : ''} ${p?.fert ? 'rich' : ''}" data-act="tile" data-i="${i}">${soil}${p ? cropHtml(p) : '<span class="plus">＋</span>'}${flags}${timer}</div>`;
    });
    if (st.plots.length < MAX_PLOTS) tiles.push(`<div class="tile lock" data-act="buyplot">${soil}<span class="lk">🔒</span><small>${formatMoney(plotPrice(st.plots.length + 1))}</small></div>`);
    // 倒數文字每秒都在變，不納入結構簽章，另外更新
    const structure = tiles.join('').replace(/<small class="tm"[^>]*>[^<]*<\/small>/g, '');
    if (sig.field !== structure) { sig.field = structure; field.innerHTML = tiles.join(''); }
    else st.plots.forEach((p, i) => { if (p) { const t = field.querySelector(`.tm[data-i="${i}"]`); if (t) t.textContent = fmtDur(growSec(p) - elapsed(p)); } });
  }

  function syncAnimals() {
    const list = st.animals.map((a, i) => {
      const t = ANIMALS.find(x => x.id === a.type);
      const left = a.fedAt ? t.interval - (Date.now() - a.fedAt) / 1000 : null;
      const state = !a.fedAt ? 'hungry' : left <= 0 ? 'ready' : 'busy';
      // 平均分散在圍欄裡，前後兩排交錯，避免互相重疊
      const n = st.animals.length, x = n > 1 ? 4 + i * (74 / (n - 1)) : 40, y = i % 2 ? 34 : 6;
      return `<div class="animal ${state}" data-act="animal" data-i="${i}" style="left:${x}%;top:${y}%;--d:${(4 + i % 4)}s;--dl:${-(i * 1.3)}s"><span class="bubble">${state === 'hungry' ? '🥣' : state === 'ready' ? t.product.icon : '💤'}</span>${tl(t.tile)}</div>`;
    }).join('');
    setHtml(animalsEl, 'animals', list || '<span class="pen-empty">還沒有動物，點下方「牧場商店」買一隻吧</span>');
  }

  function syncHud() {
    $('.farm-balance').textContent = formatMoney(balance);
    $('.hud-lv').textContent = 'Lv.' + st.level;
    $('.fm-xp i').style.width = (st.xp / xpNeed(st.level) * 100) + '%';
    $('.hud-xp').textContent = st.xp + '/' + xpNeed(st.level);
    $('.hud-weather').textContent = (rainy ? '🌧 雨天' : '☀️ 晴天') + (st.luck > 0 ? ' 🍀' + st.luck : '');
    $('.fm-visitor').style.display = st.visitor.choice ? 'none' : '';
    $('.fm-night').style.opacity = nightFor(new Date().getHours());
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
    setHtml(bar, 'seeds', CROPS.map(c => `<button class="seed ${c.id === selectedCrop ? 'on' : ''} ${st.level < c.lvl ? 'locked' : ''}" data-act="seed" data-id="${c.id}"><span>${st.level < c.lvl ? '🔒' : tl(c.art.bag, 30)}</span><small>${st.level < c.lvl ? 'Lv.' + c.lvl : formatMoney(c.seed)}</small></button>`).join(''));
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
      return `<div class="stock-row"><span class="st-name">${iconOf(id)} ${it.name} × ${st.inv[id]}</span><span class="st-price ${m >= 1 ? 'up' : 'down'}">${formatMoney(p)} ${m >= 1 ? '▲' : '▼'}</span>
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
      return `<div class="order ${o.done ? 'done' : ''}"><div><strong>${iconOf(o.item)} ${it.name} × ${o.qty}</strong><small>報酬 ${formatMoney(o.reward)} ＋ ${o.xp} XP（比行情高約 35%）</small></div>
        ${o.done ? '<span class="fm-muted">已完成</span>' : `<button class="fm-btn" data-act="order" data-id="${o.id}" ${have >= o.qty ? '' : 'disabled'}>${have >= o.qty ? '交貨' : have + '/' + o.qty}</button>`}</div>`;
    }).join('') + '<p class="farm-hint">每天會換一批訂單；只會要求你目前等級已解鎖的作物。</p>';
  }
  function animalsShopHtml() {
    return '<h3>🐾 牧場商店</h3><p class="farm-hint">動物會在牧場裡走動：頭上 🥣 表示餓了（點一下餵食），出現產品圖示表示可以收取，💤 是生產中。</p>' + ANIMALS.map(t => {
      const owned = st.animals.filter(a => a.type === t.id).length;
      const ok = st.level >= t.lvl && owned < ANIMAL_CAP;
      return `<button class="shop-row" data-act="buyanimal" data-id="${t.id}" ${ok ? '' : 'disabled'}><span>${tl(t.tile, 30)} ${t.name}（${owned}/${ANIMAL_CAP}）<small>${iconOf(t.product.id)}${t.product.name} ${formatMoney(t.product.sell)}／每 ${Math.round(t.interval / MIN)} 分　飼料 ${formatMoney(t.feed)}</small></span><b>${st.level < t.lvl ? '需 Lv.' + t.lvl : owned >= ANIMAL_CAP ? '已滿' : formatMoney(t.buy)}</b></button>`;
    }).join('');
  }
  function plotSheetHtml() {
    const p = st.plots[sheet.idx];
    if (!p) return '';
    const c = CROPS.find(x => x.id === p.cropId);
    return `<h3>${iconOf(c.id)} ${c.name}</h3><p class="fm-muted">還要 ${fmtDur(growSec(p) - elapsed(p))}</p>
      <button class="shop-row" data-act="water" ${p.watered ? 'disabled' : ''}><span>💧 澆水<small>縮短 25% 生長時間（每株一次，免費）</small></span><b>${p.watered ? '已澆' : '免費'}</b></button>
      <button class="shop-row" data-act="fert" ${p.fert ? 'disabled' : ''}><span>🌿 施肥<small>縮短 50% 生長時間（每株一次）</small></span><b>${p.fert ? '已施' : formatMoney(FERT_PRICE)}</b></button>
      <button class="shop-row danger" data-act="remove"><span>🗑 鏟除<small>放棄這株作物（不退種子錢）</small></span><b></b></button>`;
  }
  function giftHtml() {
    return `<h3>送 ${iconOf(sheet.id)} ${itemOf(sheet.id).name} 給誰？</h3>` + (sheet.chars.length ? sheet.chars.map(c => `<button class="shop-row" data-act="giftto" data-cid="${c.id}"><span>${esc(c.name)}</span><b>送出</b></button>`).join('') : '<p class="fm-muted">還沒有角色。</p>');
  }
  function bookHtml() {
    return `<h3>📖 作物圖鑑</h3><p class="farm-hint">同一種作物收成 ${MASTERY_AT.join('／')} 次各得 1 顆 ★：送一筆獎金，之後種下這種作物，生長時間每顆星縮短 5%。</p>` + CROPS.map(c => {
      const n = st.mastery[c.id] || 0, stars = starsOf(n), next = MASTERY_AT[stars];
      const locked = !n && st.level < c.lvl;
      return `<div class="stock-row ${locked ? 'fm-dim' : ''}"><span class="bk-icon">${locked ? '🔒' : iconOf(c.id)}</span><span class="st-name">${locked ? '農場 Lv.' + c.lvl + ' 解鎖' : c.name}${locked ? '' : `<small class="fm-muted"> ${n} 次收成${next ? '，再 ' + (next - n) + ' 次得 ★' + (stars + 1) : '，已精通'}</small>`}</span><b class="bk-stars">${'★'.repeat(stars)}${'☆'.repeat(MASTERY_AT.length - stars)}</b></div>`;
    }).join('');
  }
  function visitorHtml() {
    const o = visitorOffer(st.inv, priceOf);
    if (o.kind === 'gift') return `<h3>🧑‍🌾 旅行商人</h3><p>商人看你的倉庫幾乎是空的，送你一個幸運符：接下來 ${LUCK_HARVESTS} 次收成，出現「金色作物」（產量 ×3）的機會大增。</p><button class="fm-primary" data-act="visit" data-choice="gift">收下</button>`;
    const it = itemOf(o.item);
    return `<h3>🧑‍🌾 旅行商人</h3><p>商人看上了你倉庫裡的 ${iconOf(o.item)}${it.name}，你打算怎麼做？</p>
      <button class="shop-row" data-act="visit" data-choice="sell"><span>賣給他 ${o.qty} 個<small>比今天的行情高 50%</small></span><b>${formatMoney(o.pay)}</b></button>
      <button class="shop-row" data-act="visit" data-choice="luck"><span>換幸運符（給他 ${o.swap} 個）<small>接下來 ${LUCK_HARVESTS} 次收成，金色作物（×3）機率大增</small></span><b>🍀</b></button>
      <button class="shop-row" data-act="visit" data-choice="decline"><span>婉拒<small>他明天會再來</small></span><b></b></button>`;
  }
  function welcomeHtml() {
    const w = sheet, rows = [[w.ready, '🧺', '株作物成熟了，可以收成'], [w.products, '🥚', '份動物產品可以收取'], [w.hungry, '🥣', '隻動物餓了'], [w.growing, '🌱', '株作物還在生長']];
    return `<h3>🌾 歡迎回來</h3><p class="fm-muted">你離開了 ${fmtDur(w.away / 1000)}，農場裡：</p>` + rows.filter(r => r[0]).map(r => `<div class="stock-row">${r[1]} <span class="st-name">${r[0]} ${r[2]}</span></div>`).join('');
  }
  function renderSheet() {
    if (!sheet) { sheetHost.innerHTML = ''; return; }
    const body = sheet.type === 'stock' ? stockHtml() : sheet.type === 'orders' ? ordersHtml() : sheet.type === 'animals' ? animalsShopHtml() : sheet.type === 'plot' ? plotSheetHtml() : sheet.type === 'book' ? bookHtml() : sheet.type === 'visitor' ? visitorHtml() : sheet.type === 'welcome' ? welcomeHtml() : giftHtml();
    sheetHost.innerHTML = `<div class="fm-sheet-bg" data-act="closesheet"><div class="fm-sheet">${body}<button class="fm-primary alt" data-act="closesheet">關閉</button></div></div>`;
  }

  async function spend(amount, desc) { await charge(amount, desc, { category: 'farm' }); balance = await getBalance(); }
  async function earn(amount, desc) { await credit(amount, desc, { category: 'farm' }); balance = await getBalance(); }

  // 作物精通的星星獎金：收成是同步的，錢包是非同步的，所以先記下來，等這次操作結束再入帳
  const starRewards = [];
  async function payStars() {
    while (starRewards.length) {
      const r = starRewards.shift();
      await earn(r.reward, '作物精通：' + r.crop.name + ' ★' + r.star);
      createToast('🏅 ' + r.crop.name + '達人 ★' + r.star + '　+' + formatMoney(r.reward), 'success');
    }
  }

  async function run(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); await payStars(); await save(); }
    catch (e) { createToast(e instanceof WalletError ? e.message : (e.message || '操作失敗'), 'error'); }
    finally { busy = false; if (alive) { sync(); renderSheet(); } } // sheet 被設成 null 時也要把面板關掉
  }

  const harvestPlot = (idx, el) => {
    const p = st.plots[idx];
    if (!p || growSec(p) - elapsed(p) > 0) return false;
    const c = CROPS.find(x => x.id === p.cropId);
    const golden = rollGolden(Math.random, st.luck);
    if (st.luck > 0) st.luck--;
    const bonus = (p.watered && p.fert ? 2 : 1) * (golden ? 3 : 1);
    addInv(c.id, bonus);
    st.plots[idx] = null; st.harvested++;
    addXp(c.xp);
    const before = starsOf(st.mastery[c.id] || 0);
    st.mastery[c.id] = (st.mastery[c.id] || 0) + 1;
    for (let star = before + 1; star <= starsOf(st.mastery[c.id]); star++) starRewards.push({ crop: c, star, reward: masteryReward(c, star) });
    fx((golden ? '✨金色 +' : '+') + bonus + ' ' + c.icon, el, 'gain'); setTimeout(() => fx('+' + c.xp + ' XP', el, 'xp'), 250);
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
        st.plots[idx] = { cropId: c.id, plantedAt: Date.now(), cut: Math.round(c.time * perkOf(starsOf(st.mastery[c.id] || 0))) }; // 精通的星星縮短生長時間
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
    if (act === 'remove') return run(async () => { if (await askConfirm('確定鏟除？')) { st.plots[sheet.idx] = null; sheet = null; } });
    if (act === 'harvestall') return run(async () => {
      let n = 0;
      st.plots.forEach((p, k) => { if (harvestPlot(k, field.querySelector(`[data-i="${k}"]`))) n++; });
      if (!n) createToast('目前沒有成熟的作物');
    });
    if (act === 'visit') return run(async () => {
      const o = visitorOffer(st.inv, priceOf), choice = el.dataset.choice;
      if (st.visitor.choice) return;
      if (choice === 'sell' && o.kind === 'trade') { await earn(o.pay, '賣給旅行商人：' + itemOf(o.item).name + ' ×' + o.qty); addInv(o.item, -o.qty); }
      else if (choice === 'luck' && o.kind === 'trade') { addInv(o.item, -o.swap); st.luck = LUCK_HARVESTS; }
      else if (choice === 'gift' && o.kind === 'gift') st.luck = LUCK_HARVESTS;
      else if (choice !== 'decline') return;
      st.visitor.choice = choice;
      if (st.luck > 0 && choice !== 'sell' && choice !== 'decline') createToast('🍀 拿到幸運符：接下來 ' + LUCK_HARVESTS + ' 次收成運氣大增', 'success');
      sheet = null;
    });
    if (act === 'buyplot') return run(async () => {
      const price = plotPrice(st.plots.length + 1);
      if (!await askConfirm('花 ' + formatMoney(price) + ' 擴建一塊農地？')) return;
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
  // 離開一陣子再回來：先告訴玩家農場裡發生了什麼事
  const away = st.lastSeen ? Date.now() - st.lastSeen : 0;
  if (away > 5 * MIN * 1000) {
    const left = p => growSec(p) - elapsed(p);
    const w = {
      type: 'welcome', away,
      ready: st.plots.filter(p => p && left(p) <= 0).length,
      growing: st.plots.filter(p => p && left(p) > 0).length,
      products: st.animals.filter(a => a.fedAt && ANIMALS.find(t => t.id === a.type).interval - (Date.now() - a.fedAt) / 1000 <= 0).length,
      hungry: st.animals.filter(a => !a.fedAt).length
    };
    if (w.ready || w.products || w.hungry) { sheet = w; renderSheet(); }
  }
  st.lastSeen = Date.now();
  const timer = setInterval(() => {
    if (busy) return;
    st.lastSeen = Date.now();
    if (st.orders.date !== today()) { // 跨過午夜：換新的一天的訂單、天氣與訪客
      st.visitor = { date: today(), choice: null };
      st.orders = { date: today(), list: makeOrders(st.level) };
      rainy = isRainy();
      world.classList.toggle('rainy', rainy);
      save();
    }
    sync();
  }, 1000);
  return { element: container, cleanup: () => { alive = false; clearInterval(timer); st.lastSeen = Date.now(); save(); } };
}

export default {
  id: 'farm',
  name: '農場',
  icon: 'agriculture',
  routes: [{ path: '/farm', render: renderFarm }],
  navItem: { label: '農場', icon: 'agriculture', path: '/farm', showInNav: true, order: 127 },
  stylesPath: 'js/apps/farm/style.css'
};
