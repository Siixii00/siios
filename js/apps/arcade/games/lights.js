import { loadProgress, completeLevel, levelGridHtml, starText, totalStars } from './levels.js';
import { LEVELS, press, isOff, puzzle, minPresses, starsFor } from './lights-core.js';

const GAME = 'lights';

export async function mount(root) {
    let progress = await loadProgress(GAME);
    let level = 0, n = 3, board, initial, par = 0, moves = 0, finished = false, stars = 0;

    function showMenu() {
        level = 0;
        root.innerHTML = `<div class="ag-wrap">
            <p class="lv-summary">累計 ★ ${totalStars(progress)} / ${LEVELS.length * 3}</p>
            ${levelGridHtml(progress, LEVELS.length, i => LEVELS[i - 1].n + '×' + LEVELS[i - 1].n)}
            <p class="ag-hint">按一格，它和上下左右的燈會一起切換；把所有燈關掉。步數越接近最少步數星星越多</p>
        </div>`;
    }

    function startLevel(lv, same = false) {
        level = lv; n = LEVELS[lv - 1].n;
        if (!same || !initial) { initial = puzzle(n, LEVELS[lv - 1].presses).board; par = minPresses(initial, n); }
        board = initial.slice(); moves = 0; finished = false; stars = 0;
        draw();
    }

    function draw() {
        const overlay = finished ? `<div class="m3-overlay"><div class="m3-card"><h2>💡 全部關掉了！</h2><p class="m3-stars">${starText(stars)}</p><p>${moves} 步（最少 ${par} 步）</p>
            <div class="m3-btns">${level < LEVELS.length ? '<button data-act="next">下一關</button>' : ''}<button data-act="again">換一題</button><button data-act="menu">選關</button></div></div></div>` : '';
        root.innerHTML = `
        <div class="ag-wrap" style="position:relative">
            <div class="lv-bar"><button class="ag-btn" data-act="menu">‹ 選關</button><span>第 ${level} 關 · ${n}×${n}</span></div>
            <div class="ag-bar"><div><span>步數</span><strong>${moves}</strong></div><div><span>最少步數</span><strong>${par}</strong></div><div><span>亮著</span><strong>${board.filter(Boolean).length}</strong></div></div>
            <div class="ag-board lights" style="grid-template-columns:repeat(${n},1fr)">${board.map((v, i) => `<button class="lt-lamp ${v ? 'on' : ''}" data-i="${i}" aria-label="${v ? '亮' : '暗'}"></button>`).join('')}</div>
            <div class="ag-levels"><button class="ag-chip" data-act="reset">↺ 重來這題</button><button class="ag-chip" data-act="again">🔀 換一題</button></div>
            <p class="ag-hint">小訣竅：由上往下，用下一排的按鈕把這一排關掉</p>
            ${overlay}
        </div>`;
    }

    async function tap(i) {
        if (finished) return;
        board = press(board, n, i); moves++;
        if (isOff(board)) {
            finished = true; stars = starsFor(moves, par);
            draw();
            progress = await completeLevel(GAME, level, stars, LEVELS.length);
            return;
        }
        draw();
    }

    root.addEventListener('click', e => {
        const lamp = e.target.closest('.lt-lamp'), lv = e.target.closest('.lv-btn'), act = e.target.closest('[data-act]')?.dataset.act;
        if (lamp) tap(+lamp.dataset.i);
        else if (lv && !lv.disabled) startLevel(+lv.dataset.lv);
        else if (act === 'menu') showMenu();
        else if (act === 'again') startLevel(level);
        else if (act === 'reset') startLevel(level, true);
        else if (act === 'next') startLevel(level + 1);
    });
    showMenu();
    return () => {};
}
