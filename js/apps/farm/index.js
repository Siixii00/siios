import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB, CharactersDB, UsersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { getBalance, charge, credit, formatMoney, WalletError } from '../../core/wallet.js';
import { askForm } from '../../core/dialogs.js';

// 農場：種植、澆水施肥、倉庫、每日行情與訂單、動物、等級與經驗。收益與開銷都走「支付」錢包。
const FARM_KEY = 'farm_state';
const MIN = 60; // growTime 以「秒」計，這裡用分鐘換算較好讀

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
const xpNeed = lvl => 40 + 30 * (lvl - 1); // 從 lvl 升到 lvl+1 需要的經驗

const ITEMS = [...CROPS.map(c => ({ id: c.id, name: c.name, icon: c.icon, sell: c.sell, crop: true })), ...ANIMALS.map(a => ({ ...a.product, crop: false }))];
const itemOf = id => ITEMS.find(i => i.id === id);

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const hash = str => { let h = 2166136261; for (const ch of str) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; };
// 每天每種商品的行情倍率 0.85 ~ 1.30，同一天固定
const marketMult = id => 0.85 + 0.45 * hash(today() + ':' + id);
const priceOf = id => Math.max(1, Math.round(itemOf(id).sell * marketMult(id)));
const fmtDur = s => s >= 3600 ? Math.floor(s / 3600) + ' 小時 ' + Math.floor(s % 3600 / 60) + ' 分' : s >= 60 ? Math.floor(s / 60) + ' 分 ' + Math.floor(s % 60) + ' 秒' : Math.max(0, Math.floor(s)) + ' 秒';

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

// 每天產生 3 張訂單（同一天固定）：只會要求目前等級已解鎖的作物
function makeOrders(level) {
  const pool = CROPS.filter(c => c.lvl <= level);
  const d = today();
  return Array.from({ length: 3 }, (_, i) => {
    const crop = pool[Math.floor(hash(d + 'o' + i) * pool.length)];
    const qty = 2 + Math.floor(hash(d + 'q' + i) * 5);
    return { id: d + '-' + i, item: crop.id, qty, reward: Math.round(qty * crop.sell * 1.35), xp: qty * 3, done: false };
  });
}

async function renderFarm() {
  const container = createElement('div', 'app-container farm-app');
  let alive = true;
  let tab = 'field';
  let sheet = null; // { type: 'seed'|'plot'|'gift', idx }
  let busy = false;
  const st = await loadState();
  if (st.orders.date !== today()) { st.orders = { date: today(), list: makeOrders(st.level) }; }
  let balance = await getBalance();
  const save = () => SettingsDB.set(FARM_KEY, st);

  const growSec = p => { const c = CROPS.find(x => x.id === p.cropId); return c.time - (p.cut || 0); };
  const elapsed = p => (Date.now() - p.plantedAt) / 1000;
  const addXp = n => {
    st.xp += n;
    while (st.xp >= xpNeed(st.level)) { st.xp -= xpNeed(st.level); st.level++; createToast('🎉 農場升到 ' + st.level + ' 級！', 'success'); }
  };
  const invCount = id => st.inv[id] || 0;
  const addInv = (id, n) => { st.inv[id] = invCount(id) + n; if (st.inv[id] <= 0) delete st.inv[id]; };

  function levelBar() {
    return `<div class="fm-level"><strong>Lv.${st.level}</strong><div class="fm-xp"><i style="width:${st.xp / xpNeed(st.level) * 100}%"></i></div><span>${st.xp}/${xpNeed(st.level)} XP</span></div>`;
  }

  function fieldHtml() {
    const cells = st.plots.map((p, i) => {
      if (!p) return `<button class="plot empty" data-act="plot" data-i="${i}"><span class="plus">+</span></button>`;
      const c = CROPS.find(x => x.id === p.cropId), left = growSec(p) - elapsed(p);
      return left <= 0
        ? `<button class="plot ready" data-act="harvest" data-i="${i}"><span class="crop-icon">${c.icon}</span><span class="ready-badge">可收穫</span></button>`
        : `<button class="plot growing" data-act="plot" data-i="${i}"><span class="crop-icon dim">${c.icon}</span><span class="progress">${fmtDur(left)}</span><i class="grow-bar" style="width:${Math.min(100, elapsed(p) / growSec(p) * 100)}%"></i>${p.watered ? '<em>💧</em>' : ''}${p.fert ? '<em class="f">🌿</em>' : ''}</button>`;
    });
    const locked = st.plots.length < MAX_PLOTS ? `<button class="plot lock" data-act="buyplot"><span>🔒</span><small>擴地 ${formatMoney(plotPrice(st.plots.length + 1))}</small></button>` : '';
    return `<div class="farm-grid">${cells.join('')}${locked}</div>
      <p class="farm-hint">點空地種植；點生長中的作物可澆水（省 25% 時間）或施肥（省 50%）；成熟後點一下收成進倉庫。</p>`;
  }

  function animalsHtml() {
    const cards = st.animals.map((a, i) => {
      const t = ANIMALS.find(x => x.id === a.type);
      const left = a.fedAt ? t.interval - (Date.now() - a.fedAt) / 1000 : null;
      const ready = a.fedAt && left <= 0;
      return `<div class="animal"><span class="an-icon">${t.icon}</span><div class="an-info"><strong>${t.name}</strong><small>${!a.fedAt ? '肚子餓了' : ready ? '產出了 ' + t.product.icon + t.product.name : '生產中 ' + fmtDur(left)}</small></div>
        ${ready ? `<button class="fm-btn" data-act="collect" data-i="${i}">收取</button>` : !a.fedAt ? `<button class="fm-btn" data-act="feed" data-i="${i}">餵食 ${formatMoney(t.feed)}</button>` : '<span class="fm-muted">…</span>'}</div>`;
    }).join('');
    const shop = ANIMALS.map(t => {
      const owned = st.animals.filter(a => a.type === t.id).length;
      const ok = st.level >= t.lvl && owned < ANIMAL_CAP;
      return `<button class="shop-row" data-act="buyanimal" data-id="${t.id}" ${ok ? '' : 'disabled'}><span>${t.icon} ${t.name}<small>${t.product.icon}${t.product.name} ${formatMoney(t.product.sell)}／每 ${Math.round(t.interval / MIN)} 分</small></span><b>${st.level < t.lvl ? '需 Lv.' + t.lvl : owned >= ANIMAL_CAP ? '已滿' : formatMoney(t.buy)}</b></button>`;
    }).join('');
    return `${cards || '<p class="fm-muted center">還沒有動物，到下面的牧場商店買一隻吧。</p>'}<h3 class="fm-h">牧場商店</h3>${shop}`;
  }

  function stockHtml() {
    const rows = Object.keys(st.inv).map(id => {
      const it = itemOf(id), m = marketMult(id), p = priceOf(id);
      return `<div class="stock-row"><span class="st-name">${it.icon} ${it.name} × ${st.inv[id]}</span><span class="st-price ${m >= 1 ? 'up' : 'down'}">${formatMoney(p)} ${m >= 1 ? '▲' : '▼'}</span>
        <button class="fm-btn" data-act="sell" data-id="${id}">賣出</button><button class="fm-btn alt" data-act="gift" data-id="${id}">送禮</button></div>`;
    }).join('');
    const total = Object.keys(st.inv).reduce((s, id) => s + priceOf(id) * st.inv[id], 0);
    return `${rows || '<p class="fm-muted center">倉庫是空的，收成後的作物與動物產品會放在這裡。</p>'}
      ${rows ? `<button class="fm-primary" data-act="sellall">全部賣出（約 ${formatMoney(total)}）</button>` : ''}
      <p class="farm-hint">每天的行情不同（▲ 高於基本價、▼ 低於基本價），可以等行情好再賣，也可以拿去交訂單。</p>`;
  }

  function ordersHtml() {
    return st.orders.list.map(o => {
      const it = itemOf(o.item), have = invCount(o.item);
      return `<div class="order ${o.done ? 'done' : ''}"><div><strong>${it.icon} ${it.name} × ${o.qty}</strong><small>報酬 ${formatMoney(o.reward)} ＋ ${o.xp} XP（比行情高約 35%）</small></div>
        ${o.done ? '<span class="fm-muted">已完成</span>' : `<button class="fm-btn" data-act="order" data-id="${o.id}" ${have >= o.qty ? '' : 'disabled'}>${have >= o.qty ? '交貨' : have + '/' + o.qty}</button>`}</div>`;
    }).join('') + '<p class="farm-hint">每天會換一批訂單；只會要求你目前等級已解鎖的作物。</p>';
  }

  function sheetHtml() {
    if (!sheet) return '';
    let body = '';
    if (sheet.type === 'seed') {
      body = '<h3>選擇作物</h3>' + CROPS.map(c => `<button class="shop-row" data-act="plant" data-id="${c.id}" ${st.level >= c.lvl ? '' : 'disabled'}><span>${c.icon} ${c.name}<small>${fmtDur(c.time)}成熟 · 賣約 ${formatMoney(c.sell)} · +${c.xp}XP</small></span><b>${st.level >= c.lvl ? formatMoney(c.seed) : '需 Lv.' + c.lvl}</b></button>`).join('');
    } else if (sheet.type === 'plot') {
      const p = st.plots[sheet.idx], c = CROPS.find(x => x.id === p.cropId);
      body = `<h3>${c.icon} ${c.name}</h3><p class="fm-muted">還要 ${fmtDur(growSec(p) - elapsed(p))}</p>
        <button class="shop-row" data-act="water" ${p.watered ? 'disabled' : ''}><span>💧 澆水<small>縮短 25% 生長時間（每株一次，免費）</small></span><b>${p.watered ? '已澆' : '免費'}</b></button>
        <button class="shop-row" data-act="fert" ${p.fert ? 'disabled' : ''}><span>🌿 施肥<small>縮短 50% 生長時間（每株一次）</small></span><b>${p.fert ? '已施' : formatMoney(FERT_PRICE)}</b></button>
        <button class="shop-row danger" data-act="remove"><span>🗑 鏟除<small>放棄這株作物（不退種子錢）</small></span><b></b></button>`;
    } else if (sheet.type === 'gift') {
      body = `<h3>送 ${itemOf(sheet.id).icon} ${itemOf(sheet.id).name} 給誰？</h3>` + (sheet.chars.length ? sheet.chars.map(c => `<button class="shop-row" data-act="giftto" data-cid="${c.id}"><span>${esc(c.name)}</span><b>送出</b></button>`).join('') : '<p class="fm-muted">還沒有角色。</p>');
    }
    return `<div class="fm-sheet-bg" data-act="closesheet"><div class="fm-sheet">${body}<button class="fm-primary alt" data-act="closesheet">關閉</button></div></div>`;
  }

  function draw() {
    const scroll = container.querySelector('.fm-body')?.scrollTop || 0;
    container.innerHTML = `
      <header class="ios-header">
        <button class="ios-back-btn" data-act="back"><i class="fas fa-chevron-left"></i> 返回</button>
        <h1 class="menu-title">農場</h1>
        <div class="coins"><i class="fas fa-coins"></i> <span class="farm-balance">${formatMoney(balance)}</span></div>
      </header>
      <div class="page fm-page">
        ${levelBar()}
        <nav class="fm-tabs">${[['field', '農田'], ['animals', '動物'], ['stock', '倉庫'], ['orders', '訂單']].map(([k, l]) => `<button data-act="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'stock' && Object.keys(st.inv).length ? ' •' : ''}${k === 'orders' && st.orders.list.some(o => !o.done) ? ' •' : ''}</button>`).join('')}</nav>
        <div class="fm-body">${tab === 'field' ? fieldHtml() : tab === 'animals' ? animalsHtml() : tab === 'stock' ? stockHtml() : ordersHtml()}</div>
      </div>${sheetHtml()}`;
    container.querySelector('.fm-body').scrollTop = scroll;
  }

  async function spend(amount, desc) {
    await charge(amount, desc, { category: 'farm' });
    balance = await getBalance();
  }
  async function earn(amount, desc) {
    await credit(amount, desc, { category: 'farm' });
    balance = await getBalance();
  }

  async function run(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); await save(); }
    catch (e) { createToast(e instanceof WalletError ? e.message : (e.message || '操作失敗'), 'error'); }
    finally { busy = false; if (alive) draw(); }
  }

  async function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    // 點到面板內空白處時，最近的 data-act 會是背景層，這種不算關閉
    if (el.dataset.act === 'closesheet' && el.classList.contains('fm-sheet-bg') && e.target !== el) return;
    const { act, i, id } = el.dataset;
    const idx = i === undefined ? null : +i;
    if (act === 'back') return Router.back();
    if (act === 'tab') { tab = el.dataset.tab; return draw(); }
    if (act === 'closesheet') { sheet = null; return draw(); }
    if (act === 'plot') { sheet = { type: st.plots[idx] ? 'plot' : 'seed', idx }; return draw(); }

    if (act === 'plant') return run(async () => {
      const c = CROPS.find(x => x.id === id);
      if (st.plots[sheet.idx] || st.level < c.lvl) return;
      await spend(c.seed, '購買' + c.name + '種子');
      st.plots[sheet.idx] = { cropId: c.id, plantedAt: Date.now(), cut: 0 };
      addXp(1);
      sheet = null;
    });
    if (act === 'water' || act === 'fert') return run(async () => {
      const p = st.plots[sheet.idx];
      if (!p) return;
      if (act === 'water' && !p.watered) { p.watered = true; p.cut = (p.cut || 0) + CROPS.find(c => c.id === p.cropId).time * WATER_CUT; }
      if (act === 'fert' && !p.fert) { await spend(FERT_PRICE, '購買肥料'); p.fert = true; p.cut = (p.cut || 0) + CROPS.find(c => c.id === p.cropId).time * FERT_CUT; }
      sheet = null;
    });
    if (act === 'remove') return run(async () => { if (confirm('確定鏟除？')) { st.plots[sheet.idx] = null; sheet = null; } });
    if (act === 'harvest') return run(async () => {
      const p = st.plots[idx];
      if (!p || growSec(p) - elapsed(p) > 0) return;
      const c = CROPS.find(x => x.id === p.cropId);
      const bonus = p.watered && p.fert ? 2 : 1; // 澆水加施肥的作物豐收（雙倍）
      addInv(c.id, bonus);
      st.plots[idx] = null; st.harvested++;
      addXp(c.xp);
      createToast('收成 ' + c.icon + c.name + (bonus > 1 ? ' ×2（豐收！）' : ''), 'success');
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
    });
    if (act === 'feed') return run(async () => {
      const a = st.animals[idx], t = ANIMALS.find(x => x.id === a.type);
      if (a.fedAt) return;
      await spend(t.feed, '飼料（' + t.name + '）');
      a.fedAt = Date.now();
    });
    if (act === 'collect') return run(async () => {
      const a = st.animals[idx], t = ANIMALS.find(x => x.id === a.type);
      if (!a.fedAt || (Date.now() - a.fedAt) / 1000 < t.interval) return;
      addInv(t.product.id, 1); a.fedAt = null; addXp(t.product.xp);
      createToast('收取 ' + t.product.icon + t.product.name, 'success');
    });

    if (act === 'sell') return run(async () => {
      const n = invCount(id); if (!n) return;
      const amount = priceOf(id) * n;
      await earn(amount, '賣出' + itemOf(id).name + ' ×' + n);
      addInv(id, -n);
      createToast('賣得 ' + formatMoney(amount), 'success');
    });
    if (act === 'sellall') return run(async () => {
      const ids = Object.keys(st.inv); let amount = 0;
      ids.forEach(k => { amount += priceOf(k) * st.inv[k]; });
      if (!amount) return;
      await earn(amount, '賣出倉庫全部商品');
      ids.forEach(k => delete st.inv[k]);
      createToast('賣得 ' + formatMoney(amount), 'success');
    });
    if (act === 'order') return run(async () => {
      const o = st.orders.list.find(x => x.id === id);
      if (!o || o.done || invCount(o.item) < o.qty) return;
      await earn(o.reward, '完成訂單：' + itemOf(o.item).name + ' ×' + o.qty);
      addInv(o.item, -o.qty); o.done = true; addXp(o.xp);
      createToast('訂單完成！+' + formatMoney(o.reward), 'success');
    });

    if (act === 'gift') { sheet = { type: 'gift', id, chars: await CharactersDB.getAll() }; return draw(); }
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
  draw();
  const timer = setInterval(() => { if (!sheet && !busy) draw(); }, 1000);
  return { element: container, cleanup: () => { alive = false; clearInterval(timer); } };
}

export default {
  id: 'farm',
  name: '農場',
  icon: 'seedling',
  routes: [{ path: '/farm', render: renderFarm }],
  navItem: { label: '農場', icon: 'seedling', path: '/farm', showInNav: true, order: 127 },
  stylesPath: 'js/apps/farm/style.css'
};
