import { loadProgress, completeLevel, levelGridHtml, starText, totalStars } from './levels.js';
import { LEVELS, scramble, slide, isSolved, starsFor } from './slide-core.js';

const GAME = 'slide';

export async function mount(root) {
    let progress = await loadProgress(GAME);
    let level = 0, n = 3, board, start, moves = 0, startedAt = 0, elapsed = 0, timerId = null, finished = false, stars = 0;

    const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

    function showMenu() {
        clearInterval(timerId);
        level = 0;
        root.innerHTML = `<div class="ag-wrap">
            <p class="lv-summary">累計 ★ ${totalStars(progress)} / ${LEVELS.length * 3}</p>
            ${levelGridHtml(progress, LEVELS.length, i => LEVELS[i - 1].n + '×' + LEVELS[i - 1].n)}
            <p class="ag-hint">把數字依序排好（右下角留空）；步數越少星星越多</p>
        </div>`;
    }

    function startLevel(lv, sameBoard = false) {
        clearInterval(timerId);
        level = lv; n = LEVELS[lv - 1].n;
        if (!sameBoard || !start) start = scramble(n, LEVELS[lv - 1].depth);
        board = start.slice(); moves = 0; finished = false; stars = 0; startedAt = 0; elapsed = 0;
        draw();
    }

    function draw() {
        const depth = LEVELS[level - 1].depth;
        const overlay = finished ? `<div class="m3-overlay"><div class="m3-card"><h2>🎉 排好了！</h2><p class="m3-stars">${starText(stars)}</p><p>${moves} 步 · ${fmt(elapsed)}</p>
            <div class="m3-btns">${level < LEVELS.length ? '<button data-act="next">下一關</button>' : ''}<button data-act="again">換一題</button><button data-act="menu">選關</button></div></div></div>` : '';
        root.innerHTML = `
        <div class="ag-wrap" style="position:relative">
            <div class="lv-bar"><button class="ag-btn" data-act="menu">‹ 選關</button><span>第 ${level} 關 · ${n}×${n}</span></div>
            <div class="ag-bar"><div><span>步數</span><strong>${moves}</strong></div><div><span>三星步數</span><strong>≤ ${depth * 2}</strong></div><div><span>時間</span><strong id="sl-time">${fmt(elapsed)}</strong></div></div>
            <div class="ag-board slide" style="grid-template-columns:repeat(${n},1fr);font-size:${n === 3 ? 30 : n === 4 ? 24 : 18}px">${board.map((v, i) => `<button class="sl-tile ${v ? '' : 'blank'}" data-i="${i}" ${v ? '' : 'tabindex="-1"'}>${v || ''}</button>`).join('')}</div>
            <div class="ag-levels"><button class="ag-chip" data-act="reset">↺ 重來這題</button><button class="ag-chip" data-act="again">🔀 換一題</button></div>
            <p class="ag-hint">點和空格相鄰的數字，它就會滑過去</p>
            ${overlay}
        </div>`;
    }

    async function tap(i) {
        if (finished) return;
        const next = slide(board, n, i);
        if (!next) return;
        if (!startedAt) {
            startedAt = Date.now();
            timerId = setInterval(() => { elapsed = Math.floor((Date.now() - startedAt) / 1000); const t = root.querySelector('#sl-time'); if (t) t.textContent = fmt(elapsed); }, 1000);
        }
        board = next; moves++;
        if (isSolved(board)) {
            finished = true; clearInterval(timerId); elapsed = Math.floor((Date.now() - startedAt) / 1000);
            stars = starsFor(moves, LEVELS[level - 1].depth);
            draw();
            progress = await completeLevel(GAME, level, stars, LEVELS.length);
            return;
        }
        draw();
    }

    root.addEventListener('click', e => {
        const tile = e.target.closest('.sl-tile'), lv = e.target.closest('.lv-btn'), act = e.target.closest('[data-act]')?.dataset.act;
        if (tile) tap(+tile.dataset.i);
        else if (lv && !lv.disabled) startLevel(+lv.dataset.lv);
        else if (act === 'menu') showMenu();
        else if (act === 'again') startLevel(level);
        else if (act === 'reset') startLevel(level, true);
        else if (act === 'next') startLevel(level + 1);
    });
    const onKey = e => {
        if (!level || finished) return;
        const blank = board.indexOf(0), r = Math.floor(blank / n), c = blank % n;
        // 方向鍵：按「方塊要移動的方向」（空格的反方向）
        const map = { ArrowUp: [r + 1, c], ArrowDown: [r - 1, c], ArrowLeft: [r, c + 1], ArrowRight: [r, c - 1] }[e.key];
        if (!map || map[0] < 0 || map[0] >= n || map[1] < 0 || map[1] >= n) return;
        e.preventDefault();
        tap(map[0] * n + map[1]);
    };
    window.addEventListener('keydown', onKey);
    showMenu();
    return () => { clearInterval(timerId); window.removeEventListener('keydown', onKey); };
}
