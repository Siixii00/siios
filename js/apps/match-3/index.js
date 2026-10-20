import Router from '../../router.js';
import { createElement, createToast } from '../../components.js';
import { SIZE, FRUITS, LEVEL_COUNT, levelConfig, makeBoard, findMatches, adjacent, validMoves, clearMatches, applyGravity, reshuffle, starsFor } from './engine.js';
import { loadProgress, completeLevel, levelGridHtml, starText, totalStars } from '../arcade/games/levels.js';

const GAME = 'match3';
const STEP_MS = 260;
const wait = ms => new Promise(r => setTimeout(r, ms));

async function renderMatch3() {
  const container = createElement('div', 'app-container match3-app');
  let alive = true;
  let progress = await loadProgress(GAME);
  let cfg = null, board = [], score = 0, collected = 0, moves = 0;
  let selected = null, busy = false, hintPair = null, clearing = new Set(), result = null;

  const progressValue = () => (cfg.collect ? collected : score);

  function frame(inner, title) {
    container.innerHTML = `
      <header class="ios-header">
        <button class="ios-back-btn"><i class="fas fa-chevron-left"></i> 返回</button>
        <h1 class="menu-title">${title}</h1>
      </header>
      <div class="page">${inner}</div>`;
    container.querySelector('.ios-back-btn').onclick = () => (cfg ? showLevels() : Router.back());
  }

  // 每次換關／回選單就加一；進行中的連鎖動畫醒來後發現局號變了就直接放棄，不去碰新的棋盤
  let gen = 0;

  function showLevels() {
    gen++;
    cfg = null; result = null;
    frame(`
      <p class="lv-summary">累計 ★ ${totalStars(progress)} / ${LEVEL_COUNT * 3}　·　已解鎖 ${progress.unlocked} / ${LEVEL_COUNT} 關</p>
      ${levelGridHtml(progress, LEVEL_COUNT, n => { const c = levelConfig(n); return c.collect ? '蒐集' + FRUITS[c.fruit] : '得分'; })}`, '消消樂');
    container.querySelectorAll('.lv-btn').forEach(b => { b.onclick = () => startLevel(+b.dataset.lv); });
  }

  function startLevel(n) {
    gen++;
    cfg = levelConfig(n);
    board = makeBoard(cfg.types);
    score = 0; collected = 0; moves = cfg.moves;
    selected = null; busy = false; hintPair = null; clearing = new Set(); result = null;
    draw();
  }

  function goalHtml() {
    const done = Math.min(progressValue(), cfg.goal);
    const label = cfg.collect ? `蒐集 ${FRUITS[cfg.fruit]} × ${cfg.goal}` : `得分 ${cfg.goal}`;
    return `<div class="goal"><span>${label}</span><div class="goal-bar"><i style="width:${done / cfg.goal * 100}%"></i></div><span>${done}/${cfg.goal}</span></div>`;
  }

  function draw() {
    frame(`
      <div class="game-info">
        <div class="info-item"><span class="info-label">關卡</span><span class="info-value">${cfg.level}</span></div>
        <div class="info-item"><span class="info-label">分數</span><span class="info-value">${score}</span></div>
        <div class="info-item"><span class="info-label">步數</span><span class="info-value moves-value">${moves}</span></div>
      </div>
      ${goalHtml()}
      <div class="match-board" style="grid-template-columns: repeat(${SIZE}, 1fr);">${board.map((f, i) => `
        <button class="tile ${selected === i ? 'selected' : ''} ${hintPair && hintPair.includes(i) ? 'hint' : ''} ${clearing.has(i) ? 'clearing' : ''}" data-idx="${i}">${f >= 0 ? FRUITS[f] : ''}</button>`).join('')}</div>
      <div class="m3-actions"><button class="restart-btn" data-act="hint">💡 提示</button><button class="restart-btn" data-act="restart">重新開始</button></div>
      ${result ? overlayHtml() : ''}`, '第 ' + cfg.level + ' 關');
    container.querySelectorAll('.tile').forEach(t => { t.onclick = () => onTile(+t.dataset.idx); });
    container.querySelector('[data-act=hint]').onclick = showHint;
    container.querySelector('[data-act=restart]').onclick = () => startLevel(cfg.level);
    container.querySelectorAll('[data-ov]').forEach(b => { b.onclick = () => overlayAction(b.dataset.ov); });
  }

  function overlayHtml() {
    if (result.won) {
      return `<div class="m3-overlay"><div class="m3-card"><h2>🎉 過關！</h2><p class="m3-stars">${starText(result.stars)}</p><p>得分 ${score}${cfg.collect ? '，蒐集 ' + collected : ''}，剩 ${moves} 步</p>
        <div class="m3-btns">${cfg.level < LEVEL_COUNT ? '<button data-ov="next">下一關</button>' : ''}<button data-ov="again">再玩一次</button><button data-ov="levels">選關</button></div></div></div>`;
    }
    return `<div class="m3-overlay"><div class="m3-card"><h2>😢 步數用完了</h2><p>還差 ${cfg.goal - progressValue()} ${cfg.collect ? '個' + FRUITS[cfg.fruit] : '分'}</p>
      <div class="m3-btns"><button data-ov="again">再試一次</button><button data-ov="levels">選關</button></div></div></div>`;
  }

  function overlayAction(a) {
    if (a === 'next') startLevel(cfg.level + 1);
    else if (a === 'again') startLevel(cfg.level);
    else showLevels();
  }

  function showHint() {
    if (busy || result) return;
    const list = validMoves(board).sort((x, y) => y.size - x.size);
    if (!list.length) return;
    hintPair = [list[0].a, list[0].b];
    draw();
    setTimeout(() => { hintPair = null; if (alive && cfg && !result) draw(); }, 1500);
  }

  async function onTile(i) {
    if (busy || result) return;
    hintPair = null;
    if (selected === null) { selected = i; return draw(); }
    if (selected === i) { selected = null; return draw(); }
    if (!adjacent(selected, i)) { selected = i; return draw(); }
    const a = selected;
    selected = null;
    busy = true;
    const mine = gen;
    [board[a], board[i]] = [board[i], board[a]];
    if (!findMatches(board).size) { // 沒有形成消除：換過去、再換回來
      draw(); await wait(180);
      if (!alive || mine !== gen) return;
      [board[a], board[i]] = [board[i], board[a]];
      busy = false;
      if (alive) draw();
      return;
    }
    moves--;
    let chain = 0;
    for (;;) {
      const m = findMatches(board);
      if (!m.size) break;
      chain++;
      score += m.size * 10 * chain;
      clearing = new Set(m);
      draw(); await wait(STEP_MS);
      if (!alive || mine !== gen) return;
      const counts = clearMatches(board, m);
      collected += counts[cfg.fruit] || 0;
      clearing = new Set();
      applyGravity(board, cfg.types);
      draw(); await wait(STEP_MS);
      if (!alive || mine !== gen) return;
    }
    if (progressValue() >= cfg.goal) {
      const stars = starsFor(cfg, progressValue());
      const level = cfg.level;
      const updated = await completeLevel(GAME, level, Math.max(1, stars), LEVEL_COUNT); // 過關進度照樣記下來，即使畫面已切走
      if (!alive || mine !== gen) { progress = updated; return; }
      progress = updated;
      result = { won: true, stars: Math.max(1, stars) };
    } else if (moves <= 0) {
      result = { won: false };
    } else if (!validMoves(board).length) {
      reshuffle(board, cfg.types);
      createToast('沒有可以移動的方塊了，已重新洗牌');
    }
    busy = false;
    if (alive) draw();
  }

  showLevels();
  return { element: container, cleanup: () => { alive = false; } };
}

export default {
  id: 'match-3',
  name: '消消樂',
  icon: 'extension',
  routes: [{ path: '/match-3', render: renderMatch3 }],
  navItem: { label: '消消樂', icon: 'extension', path: '/match-3', showInNav: true, order: 101 },
  stylesPath: 'js/apps/match-3/style.css'
};
