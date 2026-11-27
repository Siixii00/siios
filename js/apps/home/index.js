import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SettingsDB, CharactersDB, UsersDB } from '../../db.js';
import APIClient from '../../api.js';
import { buildAppContext } from '../../core/app-context-builder.js';
import { saveInteractionMemory } from '../../core/memory-saver.js';
import { getBalance, charge, credit, formatMoney, WalletError } from '../../core/wallet.js';
import { COLS, ROWS, ART, TEA_AT, canPlace, autoPlace, normalize, itemAt, snap, waOf } from './room.js';

// 宅家：佈置房間（家具從錢包購買）、做活動恢復精力、邀請角色來家裡、每日任務。
// 精力值也會被聊天讀取，精力太低時角色會適度關心你。
const STATE_KEY = 'home_state';
const MAX_HISTORY = 50;
const REGEN_BASE_MS = 6 * 60000; // 每 6 分鐘自然恢復 1 點（舒適度越高越快）
const COOLDOWN_MS = 60000;
const VISIT_COOLDOWN_MS = 30 * 60000;

// 每個格子可以放一件家具；comfort 會加總成「舒適度」
const SLOTS = [
  { id: 'bed', name: '床', items: [{ id: 'bed1', name: '單人床', icon: '🛏️', price: 0, comfort: 1 }, { id: 'bed2', name: '雙人床', icon: '🛌', price: 800, comfort: 4 }, { id: 'bed3', name: '軟墊大床', icon: '👑', price: 2500, comfort: 8 }] },
  { id: 'desk', name: '書桌', items: [{ id: 'desk1', name: '木書桌', icon: '🪑', price: 0, comfort: 1 }, { id: 'desk2', name: '電競桌', icon: '🖥️', price: 1200, comfort: 3 }] },
  { id: 'sofa', name: '沙發', items: [{ id: 'sofa1', name: '懶骨頭', icon: '🫘', price: 400, comfort: 2 }, { id: 'sofa2', name: '小沙發', icon: '🛋️', price: 600, comfort: 3 }, { id: 'sofa3', name: '皮沙發', icon: '🛋️', price: 2000, comfort: 6 }] },
  { id: 'tv', name: '電視', items: [{ id: 'tv1', name: '小電視', icon: '📺', price: 900, comfort: 2 }, { id: 'tv2', name: '大電視', icon: '🎞️', price: 2800, comfort: 5 }] },
  { id: 'plant', name: '植物', items: [{ id: 'pl1', name: '仙人掌', icon: '🌵', price: 100, comfort: 1 }, { id: 'pl2', name: '盆栽', icon: '🪴', price: 300, comfort: 2 }, { id: 'pl3', name: '琴葉榕', icon: '🌿', price: 800, comfort: 3 }] },
  { id: 'rug', name: '地毯', items: [{ id: 'rug1', name: '小地毯', icon: '🟫', price: 350, comfort: 2 }, { id: 'rug2', name: '瑜珈墊', icon: '🧘', price: 450, comfort: 2 }] },
  { id: 'lamp', name: '燈', items: [{ id: 'lamp1', name: '檯燈', icon: '💡', price: 150, comfort: 1 }, { id: 'lamp2', name: '氛圍燈', icon: '🏮', price: 500, comfort: 2 }] },
  { id: 'shelf', name: '書櫃', items: [{ id: 'shelf1', name: '書櫃', icon: '📚', price: 700, comfort: 3 }] }
];
const ALL_ITEMS = SLOTS.flatMap(s => s.items.map(i => ({ ...i, slot: s.id })));
const DEFAULT_PLACED = { bed: 'bed1', desk: 'desk1' };

// need：需要房間裡有這個格子的家具才能做；energy：做完後精力變化
const ACTIVITIES = [
  { id: 'a3', name: '聽音樂', icon: '🎵', energy: 1 },
  { id: 'a6', name: '吃零食', icon: '🍿', energy: 1 },
  { id: 'a5', name: '小睡', icon: '😴', energy: 3, need: 'bed' },
  { id: 'a2', name: '打遊戲', icon: '🎮', energy: -2, need: 'desk' },
  { id: 'a1', name: '看電影', icon: '🎬', energy: -1, need: 'tv' },
  { id: 'a4', name: '閱讀', icon: '📖', energy: 2, need: 'shelf' },
  { id: 'a7', name: '窩沙發放空', icon: '🛋️', energy: 2, need: 'sofa' },
  { id: 'a8', name: '照顧植物', icon: '🪴', energy: 1, need: 'plant' },
  { id: 'a9', name: '做瑜珈', icon: '🧘', energy: 2, need: 'rug' },
  { id: 'a10', name: '泡茶', icon: '🍵', energy: 1, need: 'lamp' },
  { id: 'a11', name: '茶室品茶', icon: '🍵', energy: 3, wa: TEA_AT } // 和風度到 TEA_AT 才解鎖
];

const TASKS = [
  { id: 't1', name: '做 3 次活動', goal: 3, reward: 100 },
  { id: 't2', name: '邀請朋友來家裡 1 次', goal: 1, reward: 200 },
  { id: 't3', name: '把精力恢復到 60 以上', goal: 1, reward: 100 }
];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const fmtTime = ts => { const d = new Date(ts); return (d.getMonth() + 1) + '/' + d.getDate() + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
const fmtLeft = ms => { const s = Math.ceil(ms / 1000); return s >= 60 ? Math.ceil(s / 60) + ' 分' : s + ' 秒'; };
const clamp = n => Math.max(0, Math.min(100, n));

async function loadState() {
  const saved = (await SettingsDB.get(STATE_KEY)) || {};
  const s = {
    energy: typeof saved.energy === 'number' ? clamp(saved.energy) : 50,
    energyTs: saved.energyTs || Date.now(),
    activities: Array.isArray(saved.activities) ? saved.activities : [],
    owned: Array.isArray(saved.owned) ? saved.owned : [],
    placed: { ...DEFAULT_PLACED, ...(saved.placed || {}) },
    cooldowns: saved.cooldowns || {},
    visits: saved.visits || {},
    tasks: saved.tasks && saved.tasks.date === today() ? saved.tasks : { date: today(), progress: {}, claimed: {} }
  };
  s.pos = normalize(s.placed, saved.pos); // 家具在房間格子上的位置（舊存檔沒有就自動排好）
  return s;
}

const itemById = id => ALL_ITEMS.find(i => i.id === id);
const comfortOf = s => Object.values(s.placed).reduce((sum, id) => sum + (itemById(id)?.comfort || 0), 0);
const regenMs = s => REGEN_BASE_MS / (1 + comfortOf(s) / 20);

// 離開期間自然恢復精力
function applyRegen(s) {
  const ms = regenMs(s), gain = Math.floor((Date.now() - s.energyTs) / ms);
  if (gain > 0) { s.energy = clamp(s.energy + gain); s.energyTs += gain * ms; }
  if (s.energy >= 100) s.energyTs = Date.now();
}

async function renderHome() {
  const container = createElement('div', 'app-container home-app');
  let alive = true;
  let tab = 'room';
  let sheet = null;
  let busy = false;
  let sel = null; // 房間裡目前選取的家具（格子 id）
  let drag = null;
  let lastDrag = 0;
  let balance = await getBalance();
  const s = await loadState();
  applyRegen(s);
  if (s.energy < 60) s.tasks.lowSeen = true; // 「恢復到 60 以上」要先低於 60 才算
  const save = () => SettingsDB.set(STATE_KEY, s);
  await save();
  const available = a => (!a.need || !!s.placed[a.need]) && (!a.wa || waOf(s.placed) >= a.wa);
  const bump = (taskId, n = 1) => { s.tasks.progress[taskId] = (s.tasks.progress[taskId] || 0) + n; };

  function status() {
    const c = comfortOf(s), wa = waOf(s.placed);
    return `<div class="energy-bar"><span class="energy-label">精力值</span><div class="energy-track"><div class="energy-fill" style="width:${s.energy}%"></div></div><span class="energy-value">${s.energy}%</span></div>
      <div class="h-chips"><span class="h-chip">舒適度 ${c}</span><span class="h-chip">和風度 ${wa}</span><small>${wa >= TEA_AT ? '茶室已解鎖' : '再 +' + (TEA_AT - wa) + ' 解鎖茶室'}</small></div>
      <div class="status-msg">${s.energy > 70 ? '精神飽滿！' : s.energy > 30 ? '還行，繼續宅吧～' : '該休息了...'}　·　每 ${Math.round(regenMs(s) / 60000 * 10) / 10} 分鐘恢復 1 點</div>`;
  }

  // 素材表上 (c, r) 開始、w×h 塊的圖塊；每塊分開畫，避免素材的 1px 間隙出現在家具中間
  const tiles = (c, r, w, h) => Array.from({ length: w * h }, (_, i) => `<i class="tl" style="--c:${c + i % w};--r:${r + Math.floor(i / w)}"></i>`).join('');
  const piece = (c, r, w, h, style, cls = '', attrs = '') => `<div class="furn ${cls}" ${attrs} style="--w:${w};${style}">${tiles(c, r, w, h)}</div>`;
  const cellOf = (fl, e) => { const r = fl.getBoundingClientRect(), t = r.width / COLS; return [Math.floor((e.clientX - r.left) / t), Math.floor((e.clientY - r.top) / t)]; };

  function moveTo(slot, x, y) {
    const p = snap(s.placed[slot], x, y);
    if (!canPlace(s.placed, s.pos, slot, p.x, p.y)) return false;
    s.pos[slot] = p;
    return true;
  }

  function roomHtml() {
    const floor = Array.from({ length: ROWS * COLS }, (_, i) => tiles(24, 4 + (i % COLS + Math.floor(i / COLS)) % 2, 1, 1)).join('');
    const furniture = Object.keys(s.placed).map(slot => {
      const a = ART[s.placed[slot]], p = s.pos[slot];
      return piece(a.tile[0], a.tile[1], a.w, a.h, `--x:${p.x};--y:${p.y};z-index:${a.flat ? 1 : 2 + p.y}`, `${a.flat ? 'flat' : ''} ${sel === slot ? 'on' : ''}`, `data-slot="${slot}"`);
    }).join('');
    const bar = sel
      ? `<div class="r-bar"><b>${itemById(s.placed[sel]).name}</b><button class="h-btn" data-act="slot" data-id="${sel}">更換</button>${['bed', 'desk'].includes(sel) ? '' : '<button class="h-btn ghost" data-act="remove">收起</button>'}<button class="h-btn ghost" data-act="unsel">完成</button></div>`
      : '<div class="r-bar"><span class="r-pill">佈置中 · 點家具</span></div>';
    const shop = ALL_ITEMS.filter(i => s.placed[i.slot] !== i.id).sort((a, b) => a.price - b.price).map(it => {
      const a = ART[it.id], owned = it.price === 0 || s.owned.includes(it.id);
      return `<button class="shop-card" data-act="place" data-id="${it.id}"><span class="shop-spr" style="--w:${a.w}">${tiles(a.tile[0], a.tile[1], a.w, a.h)}</span><span class="shop-name">${it.name}</span><small>舒適 ${it.comfort}</small><b>${owned ? '放置' : formatMoney(it.price)}</b></button>`;
    }).join('');
    return `<div class="r-board"><div class="r-wall">${piece(20, 12, 2, 1, '--x:1.5;--y:.4', 'deco')}${piece(19, 12, 1, 1, '--x:5;--y:.4', 'deco')}</div><div class="r-floor ${sel ? 'sel' : ''}" data-act="floor">${floor}${furniture}</div></div>${bar}
      <h3 class="shop-title">家具商店</h3><div class="shop-strip">${shop}</div>
      <p class="hint">點家具選取，再拖曳或點空格移動；家具越好，舒適度越高、精力恢復越快，也能解鎖更多活動。</p>`;
  }

  function activitiesHtml() {
    return `<div class="activity-grid">${ACTIVITIES.map(a => {
      const ok = available(a), left = (s.cooldowns[a.id] || 0) + COOLDOWN_MS - Date.now();
      const need = a.need && !s.placed[a.need] ? '需要' + SLOTS.find(x => x.id === a.need).name : '需要和風度 ' + a.wa;
      return `<button class="activity-btn ${ok ? '' : 'locked'}" data-act="do" data-id="${a.id}" ${ok && left <= 0 ? '' : 'disabled'}><span class="activity-icon">${a.icon}</span><span class="activity-name">${a.name}（${a.energy > 0 ? '+' : ''}${a.energy}）</span>${!ok ? `<small>${need}</small>` : left > 0 ? `<small>${fmtLeft(left)}後可再做</small>` : ''}</button>`;
    }).join('')}</div>
    <div class="home-history"><h3>最近活動</h3>${s.activities.slice(-6).reverse().map(h => `<div class="history-row">${esc(h.icon || '')} ${esc(h.text || (ACTIVITIES.find(x => x.id === h.id)?.name || ''))}　${fmtTime(h.time)}</div>`).join('') || '<div class="empty-history">還沒有活動紀錄</div>'}</div>`;
  }

  function visitsHtml(chars) {
    if (!chars.length) return '<div class="empty-history">還沒有角色可以邀請。</div>';
    return chars.map(c => {
      const left = (s.visits[c.id] || 0) + VISIT_COOLDOWN_MS - Date.now();
      return `<div class="visit-row"><span class="v-name">${esc(c.name)}</span>${left > 0 ? `<small>${fmtLeft(left)}後可再邀請</small>` : `<button class="h-btn" data-act="invite" data-id="${c.id}">邀請來家裡</button>`}</div>`;
    }).join('') + '<p class="hint">朋友會依你的房間佈置與精力和你一起度過時光，並記住這次相處。</p>';
  }

  function tasksHtml() {
    return TASKS.map(t => {
      const p = Math.min(t.goal, s.tasks.progress[t.id] || 0), done = p >= t.goal, claimed = s.tasks.claimed[t.id];
      return `<div class="visit-row"><span class="v-name">${t.name}<small>${p}/${t.goal} · 獎勵 ${formatMoney(t.reward)}</small></span>${claimed ? '<small>已領取</small>' : `<button class="h-btn" data-act="claim" data-id="${t.id}" ${done ? '' : 'disabled'}>領取</button>`}</div>`;
    }).join('') + '<p class="hint">任務每天重置，獎勵直接進「支付」錢包。</p>';
  }

  function sheetHtml() {
    if (!sheet) return '';
    if (sheet.type === 'story') return storyHtml();
    const sl = SLOTS.find(x => x.id === sheet.slot);
    const rows = sl.items.map(it => {
      const owned = it.price === 0 || s.owned.includes(it.id), on = s.placed[sl.id] === it.id;
      return `<button class="shop-row" data-act="place" data-id="${it.id}" ${on ? 'disabled' : ''}><span>${it.icon} ${it.name}<small>舒適度 +${it.comfort}</small></span><b>${on ? '使用中' : owned ? '放置' : formatMoney(it.price)}</b></button>`;
    }).join('');
    const clear = !['bed', 'desk'].includes(sl.id) && s.placed[sl.id] ? '<button class="shop-row" data-act="remove"><span>移除這件家具</span><b></b></button>' : '';
    return `<div class="h-sheet-bg" data-act="closesheet"><div class="h-sheet"><h3>${sl.name}</h3>${rows}${clear}<button class="h-wide" data-act="closesheet">關閉</button></div></div>`;
  }

  let chars = [];
  function draw() {
    container.innerHTML = `
      <header class="ios-header"><button class="ios-back-btn" data-act="back"><i class="fas fa-chevron-left"></i> 返回</button><h1 class="menu-title">Stay</h1><span class="h-wallet">${formatMoney(balance)}</span></header>
      <div class="page">${status()}
        <nav class="h-tabs">${[['room', '房間'], ['act', '活動'], ['visit', '朋友'], ['task', '任務']].map(([k, l]) => `<button data-act="tab" data-tab="${k}" class="${tab === k ? 'on' : ''}">${l}${k === 'task' && TASKS.some(t => (s.tasks.progress[t.id] || 0) >= t.goal && !s.tasks.claimed[t.id]) ? ' •' : ''}</button>`).join('')}</nav>
        ${tab === 'room' ? roomHtml() : tab === 'act' ? activitiesHtml() : tab === 'visit' ? visitsHtml(chars) : tasksHtml()}
      </div>${sheetHtml()}`;
  }

  async function run(fn) {
    if (busy) return;
    busy = true;
    try { await fn(); applyRegen(s); if (s.energy < 60) s.tasks.lowSeen = true; else if (s.tasks.lowSeen) s.tasks.progress.t3 = 1; await save(); }
    catch (e) { createToast(e instanceof WalletError ? e.message : (e.message || '操作失敗'), 'error'); }
    finally { busy = false; balance = await getBalance(); if (alive) draw(); }
  }

  async function invite(charId) {
    const settings = await APIClient.getSettings();
    if (!settings.api_url || !settings.api_key) throw new Error('請先到設定填寫 API');
    const c = chars.find(x => x.id === charId);
    const user = (await UsersDB.getAll())[0];
    const userName = user?.name || '你';
    createToast('邀請 ' + c.name + ' 中…');
    const decor = SLOTS.map(sl => itemById(s.placed[sl.id])).filter(Boolean).map(i => i.name).join('、');
    const ctx = await buildAppContext({ characterId: charId });
    const system = (ctx.systemPrompt || '') + `\n\n【場景】${userName} 邀請你來他的家裡玩。房間裡有：${decor}。${userName} 目前的精力是 ${s.energy}%${s.energy <= 30 ? '（看起來很累）' : ''}。你就是這個角色本人，用第一人稱描寫你這次拜訪的經過與兩人的互動（3~5 句，可以用（）描寫動作），使用繁體中文，不要提到自己是 AI。`;
    const text = await APIClient.complete([{ role: 'system', content: system }, { role: 'user', content: '請開始這次拜訪。' }], { temperature: 0.9, maxTokens: 400 });
    s.visits[charId] = Date.now();
    s.energy = clamp(s.energy + 2);
    bump('t2');
    s.activities.push({ id: 'visit', icon: '🏠', text: c.name + ' 來家裡：' + text.replace(/\s+/g, ' ').slice(0, 60), time: Date.now() });
    s.activities = s.activities.slice(-MAX_HISTORY);
    saveInteractionMemory({ characterId: charId, userId: user?.id || '', sourceApp: 'home', sourceType: 'interaction', sourceSubtype: 'social', content: `我去了${userName}的家（房間裡有${decor}）。${text.replace(/\s+/g, ' ').slice(0, 200)}`, importance: 0.5 });
    sheet = { type: 'story', name: c.name, text };
  }

  async function onClick(e) {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    if (el.dataset.act === 'closesheet' && el.classList.contains('h-sheet-bg') && e.target !== el) return;
    const { act, id } = el.dataset;
    if (act === 'back') return Router.back();
    if (act === 'tab') { tab = el.dataset.tab; return draw(); }
    if (act === 'closesheet') { sheet = null; return draw(); }
    if (act === 'slot') { sheet = { slot: id }; return draw(); }
    if (act === 'unsel') { sel = null; return draw(); }
    if (act === 'floor') {
      if (Date.now() - lastDrag < 300) return; // 剛拖曳完，後面接著來的 click 不算
      const [cx, cy] = cellOf(el, e), hit = itemAt(s.placed, s.pos, cx, cy);
      if (hit && !ART[s.placed[hit]].flat) sel = hit === sel ? null : hit;
      else if (sel && moveTo(sel, cx, cy)) return run(async () => {});
      else sel = hit === sel ? null : hit;
      return draw();
    }
    if (act === 'place') return run(async () => {
      const it = itemById(id);
      if (it.price > 0 && !s.owned.includes(id)) { await charge(it.price, '宅家家具：' + it.name, { category: 'home' }); s.owned.push(id); }
      const old = s.pos[it.slot];
      s.placed[it.slot] = id;
      s.pos[it.slot] = old && canPlace(s.placed, s.pos, it.slot, old.x, old.y) ? old : autoPlace(s.placed, s.pos, it.slot);
      sel = it.slot;
      createToast('已放置 ' + it.icon + it.name, 'success');
      sheet = null;
    });
    if (act === 'remove') return run(async () => { const slot = sheet?.slot || sel; delete s.placed[slot]; delete s.pos[slot]; sel = null; sheet = null; });
    if (act === 'do') return run(async () => {
      const a = ACTIVITIES.find(x => x.id === id);
      if (!available(a) || (s.cooldowns[id] || 0) + COOLDOWN_MS > Date.now()) return;
      applyRegen(s);
      s.energy = clamp(s.energy + a.energy);
      s.energyTs = Date.now();
      s.cooldowns[id] = Date.now();
      s.activities.push({ id, icon: a.icon, text: a.name, time: Date.now() });
      s.activities = s.activities.slice(-MAX_HISTORY);
      bump('t1');
    });
    if (act === 'invite') return run(() => invite(id));
    if (act === 'claim') return run(async () => {
      const t = TASKS.find(x => x.id === id);
      if (s.tasks.claimed[id] || (s.tasks.progress[id] || 0) < t.goal) return;
      await credit(t.reward, '宅家任務：' + t.name, { category: 'home' });
      s.tasks.claimed[id] = true;
      createToast('領取 ' + formatMoney(t.reward), 'success');
    });
  }

  function storyHtml() {
    return `<div class="h-sheet-bg" data-act="closesheet"><div class="h-sheet"><h3>🏠 ${esc(sheet.name)} 來拜訪</h3><p class="story">${esc(sheet.text)}</p><button class="h-wide" data-act="closesheet">關閉</button></div></div>`;
  }

  chars = await CharactersDB.getAll();
  container.addEventListener('click', onClick);
  // 拖曳：先點選家具，再按住它移動（沒選取時不攔截，頁面照常能捲動）
  container.addEventListener('pointerdown', e => {
    const fl = e.target.closest('.r-floor');
    if (!fl || !sel || busy || itemAt(s.placed, s.pos, ...cellOf(fl, e)) !== sel) return;
    drag = { fl, id: e.pointerId, x0: e.clientX, y0: e.clientY, moved: false };
    fl.setPointerCapture(e.pointerId);
  });
  container.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x0, dy = e.clientY - drag.y0;
    if (!drag.moved && Math.hypot(dx, dy) < 6) return;
    drag.moved = true;
    drag.fl.querySelector('.furn.on').style.transform = `translate(${dx}px,${dy}px)`;
  });
  container.addEventListener('pointerup', e => {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag;
    drag = null;
    if (!d.moved) return;
    lastDrag = Date.now();
    const t = d.fl.getBoundingClientRect().width / COLS, p = s.pos[sel];
    run(async () => { moveTo(sel, p.x + Math.round((e.clientX - d.x0) / t), p.y + Math.round((e.clientY - d.y0) / t)); });
  });
  container.addEventListener('pointercancel', () => { if (drag) { drag = null; draw(); } });
  draw();
  const timer = setInterval(() => {
    if (sheet || busy || drag) return;
    applyRegen(s);
    if (s.tasks.date !== today()) { // 跨過午夜：換新的一天的任務
      s.tasks = { date: today(), progress: {}, claimed: {}, lowSeen: s.energy < 60 };
      save();
    }
    draw();
  }, 5000);
  return { element: container, cleanup: () => { alive = false; clearInterval(timer); } };
}

export default {
  id: 'stay',
  name: '宅家',
  icon: 'weekend',
  routes: [{ path: '/stay', render: renderHome }],
  navItem: { label: '宅家', icon: 'weekend', path: '/stay', showInNav: true, order: 126 },
  stylesPath: 'js/apps/home/style.css'
};
