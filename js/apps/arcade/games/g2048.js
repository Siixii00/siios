import { SettingsDB } from '../../../db.js';
import { N, LEVELS, move, spawn, canMove, newBoard, maxTile } from './g2048-core.js';
import { loadProgress, completeLevel, levelGridHtml, starText, totalStars } from './levels.js';

const GAME = '2048';
const CLASSIC_KEY = 'arcade_2048';
const UNDOS = 3;

export async function mount(root) {
    let progress = await loadProgress(GAME);
    const saved = (await SettingsDB.get(CLASSIC_KEY)) || {};
    let classicBest = saved.best || 0;
    let mode = 'menu'; // menu | level | classic
    let level = 0, board, score, moves, undos, history, over, won, stars;

    const tilesHtml = b => b.map(v => `<div class="t2048 v${v > 2048 ? 'big' : v}">${v || ''}</div>`).join('');

    function showMenu() {
        mode = 'menu';
        root.innerHTML = `<div class="ag-wrap">
            <p class="lv-summary">累計 ★ ${totalStars(progress)} / ${LEVELS.length * 3}</p>
            ${levelGridHtml(progress, LEVELS.length, n => '合成 ' + LEVELS[n - 1].target)}
            <button class="ag-btn" data-act="classic">無盡模式（最高 ${classicBest}）</button>
        </div>`;
    }

    function startLevel(n) {
        mode = 'level'; level = n;
        board = newBoard(); score = 0; moves = LEVELS[n - 1].moves; undos = UNDOS; history = []; over = false; won = false; stars = 0;
        draw();
    }

    function startClassic() {
        mode = 'classic';
        board = Array.isArray(saved.board) && saved.board.length === N * N ? saved.board.slice() : newBoard();
        score = saved.score || 0; history = []; undos = UNDOS; over = !canMove(board); won = false;
        draw();
    }

    function draw() {
        const lv = mode === 'level' ? LEVELS[level - 1] : null;
        const overlay = lv && (won || over) ? `<div class="m3-overlay"><div class="m3-card"><h2>${won ? '🎉 過關！' : '😢 沒能完成'}</h2>${won ? `<p class="m3-stars">${starText(stars)}</p>` : `<p>${moves <= 0 ? '步數用完了' : '沒有可以移動的方塊了'}</p>`}
            <div class="m3-btns">${won && level < LEVELS.length ? '<button data-act="next">下一關</button>' : ''}<button data-act="again">${won ? '再玩一次' : '再試一次'}</button><button data-act="menu">選關</button></div></div></div>` : '';
        root.innerHTML = `
        <div class="ag-wrap" style="position:relative">
            <div class="lv-bar"><button class="ag-btn" data-act="menu">‹ 選關</button>${lv ? `<span>第 ${level} 關 · 合成 ${lv.target}</span>` : '<span>無盡模式</span>'}</div>
            <div class="ag-bar"><div><span>分數</span><strong>${score}</strong></div>${lv ? `<div><span>剩餘步數</span><strong>${moves}</strong></div><div><span>最大方塊</span><strong>${maxTile(board)}</strong></div>` : `<div><span>最高</span><strong>${classicBest}</strong></div>`}<button class="ag-btn" data-act="undo" ${undos && history.length && !over ? '' : 'disabled'}>悔棋 ${undos}</button></div>
            <div class="ag-board g2048" style="touch-action:none">${tilesHtml(board)}</div>
            <p class="ag-hint">滑動畫面或用方向鍵移動方塊；悔棋每局 ${UNDOS} 次</p>
            ${!lv ? '<button class="ag-btn" data-act="restart">重新開始</button>' : ''}
            ${overlay}
        </div>`;
    }

    async function doMove(dir) {
        if (mode === 'menu' || over || won) return;
        const r = move(board, dir);
        if (!r.moved) return;
        history.push({ board, score, moves });
        if (history.length > UNDOS + 1) history.shift();
        board = spawn(r.board); score += r.gained;
        if (mode === 'level') {
            moves--;
            const lv = LEVELS[level - 1];
            if (maxTile(board) >= lv.target) {
                won = true;
                const left = moves / lv.moves;
                stars = left >= 0.35 ? 3 : left >= 0.15 ? 2 : 1;
                progress = await completeLevel(GAME, level, stars, LEVELS.length);
            } else if (moves <= 0 || !canMove(board)) over = true;
        } else {
            if (score > classicBest) classicBest = score;
            if (!canMove(board)) over = true;
            await SettingsDB.set(CLASSIC_KEY, { board, score, best: classicBest });
        }
        draw();
    }

    function undo() {
        if (!undos || !history.length || over) return;
        const h = history.pop();
        board = h.board; score = h.score; moves = h.moves; undos--;
        if (mode === 'classic') SettingsDB.set(CLASSIC_KEY, { board, score, best: classicBest });
        draw();
    }

    let start = null;
    const onDown = e => { start = { x: e.clientX, y: e.clientY }; };
    const onUp = e => {
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        start = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        doMove(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    };
    const onKey = e => {
        const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        if (map[e.key] && mode !== 'menu') { e.preventDefault(); doMove(map[e.key]); }
    };
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('click', e => {
        const lv = e.target.closest('.lv-btn'), act = e.target.closest('[data-act]')?.dataset.act;
        if (lv && !lv.disabled) return startLevel(+lv.dataset.lv);
        if (act === 'menu') showMenu();
        else if (act === 'classic') startClassic();
        else if (act === 'again') startLevel(level);
        else if (act === 'next') startLevel(level + 1);
        else if (act === 'undo') undo();
        else if (act === 'restart') { saved.board = null; saved.score = 0; startClassic(); }
    });
    window.addEventListener('keydown', onKey);
    showMenu();
    return () => window.removeEventListener('keydown', onKey);
}
