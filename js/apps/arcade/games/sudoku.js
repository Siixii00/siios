import { loadProgress, completeLevel, levelGridHtml, starText, totalStars, loadDaily, completeDaily, dailyButtonHtml, dailyOverlayNote } from './levels.js';
import { dailySeed, dailyLevel, seededRng } from './daily.js';
import { LEVELS, SIZES, generate, starsFor, geometry } from './sudoku-core.js';

const GAME = 'sudoku';
const HINTS = 3;

export async function mount(root) {
    let progress = await loadProgress(GAME);
    let todayInfo = await loadDaily(GAME), daily = false, dailyResult = null;
    let level = 0, size = 9, puzzle, solution, grid, notes, selected = -1, noteMode = false, mistakes = 0, hints = 0;
    let startedAt = 0, elapsed = 0, timerId = null, finished = false, stars = 0, wrong = new Set();

    const fmt = s => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

    function showMenu() {
        clearInterval(timerId);
        level = 0;
        root.innerHTML = `<div class="ag-wrap">
            <p class="lv-summary">累計 ★ ${totalStars(progress)} / ${LEVELS.length * 3}</p>
            ${dailyButtonHtml(todayInfo, dailyLevel(GAME, LEVELS.length))}
            ${levelGridHtml(progress, LEVELS.length, n => { const l = LEVELS[n - 1]; return l.size + '×' + l.size + '·' + l.clues + '格'; })}
            <p class="ag-hint">每一盤都只有一個答案，不必猜；提示越少、錯得越少星星越多</p>
        </div>`;
    }

    function startLevel(n, isDaily = false) {
        clearInterval(timerId);
        daily = isDaily; dailyResult = null;
        level = n; size = LEVELS[n - 1].size;
        // 後面的關卡要多出幾題挑難的，可能要一兩秒：先顯示「出題中」再開始算，畫面才不會像當掉
        root.innerHTML = '<div class="ag-wrap"><p class="ag-hint">出題中…</p></div>';
        setTimeout(() => begin(n, isDaily), 30);
    }

    function begin(n, isDaily) {
        if (level !== n) return; // 出題期間已經離開
        const g = generate(n, isDaily ? seededRng(dailySeed(GAME)) : Math.random);
        puzzle = g.puzzle; solution = g.solution; grid = puzzle.slice();
        notes = new Map(); selected = -1; noteMode = false; mistakes = 0; hints = 0; finished = false; stars = 0; wrong = new Set();
        startedAt = Date.now(); elapsed = 0;
        timerId = setInterval(() => { elapsed = Math.floor((Date.now() - startedAt) / 1000); const t = root.querySelector('#sd-time'); if (t) t.textContent = fmt(elapsed); }, 1000);
        draw();
    }

    function cellHtml(i) {
        const { br, bc } = SIZES[size], r = Math.floor(i / size), c = i % size;
        const cls = ['sd-cell'];
        if (puzzle[i]) cls.push('given');
        if (i === selected) cls.push('sel');
        else if (selected >= 0 && geometry(size).peers[selected].includes(i)) cls.push('peer');
        if (wrong.has(i)) cls.push('bad');
        if (selected >= 0 && grid[selected] && grid[i] === grid[selected] && i !== selected) cls.push('same');
        if (c > 0 && c % bc === 0) cls.push('bl');
        if (r > 0 && r % br === 0) cls.push('bt');
        let inner = grid[i] || '';
        if (!grid[i] && notes.get(i)?.size) {
            inner = `<span class="sd-notes" style="grid-template-columns:repeat(${size === 4 ? 2 : 3},1fr)">${Array.from({ length: size }, (_, k) => `<i>${notes.get(i).has(k + 1) ? k + 1 : ''}</i>`).join('')}</span>`;
        }
        return `<button class="${cls.join(' ')}" data-i="${i}">${inner}</button>`;
    }

    function draw() {
        const overlay = finished ? `<div class="m3-overlay"><div class="m3-card"><h2>🎉 解開了！</h2><p class="m3-stars">${starText(stars)}</p><p>用時 ${fmt(elapsed)} · 錯誤 ${mistakes} · 提示 ${hints}</p>
            ${dailyOverlayNote(dailyResult)}<div class="m3-btns">${!daily && level < LEVELS.length ? '<button data-act="next">下一關</button>' : ''}<button data-act="again">再玩一盤</button><button data-act="menu">選關</button></div></div></div>` : '';
        root.innerHTML = `
        <div class="ag-wrap" style="position:relative">
            <div class="lv-bar"><button class="ag-btn" data-act="menu">‹ 選關</button><span>第 ${level} 關 · ${size}×${size}</span></div>
            <div class="ag-bar"><div><span>時間</span><strong id="sd-time">${fmt(elapsed)}</strong></div><div><span>錯誤</span><strong>${mistakes}</strong></div><div><span>提示</span><strong>${HINTS - hints}/${HINTS}</strong></div></div>
            <div class="ag-board sudoku" style="grid-template-columns:repeat(${size},1fr)">${grid.map((_, i) => cellHtml(i)).join('')}</div>
            <div class="sd-pad">${Array.from({ length: size }, (_, k) => `<button data-n="${k + 1}">${k + 1}</button>`).join('')}</div>
            <div class="ag-levels">
                <button class="ag-chip" data-act="erase">⌫ 清除</button>
                <button class="ag-chip ${noteMode ? 'on' : ''}" data-act="notes">✎ 筆記${noteMode ? '（開）' : ''}</button>
                <button class="ag-chip" data-act="hint" ${hints >= HINTS ? 'disabled' : ''}>💡 提示</button>
            </div>
            <p class="ag-hint">點格子再點數字；筆記模式可以記下可能的數字</p>
            ${overlay}
        </div>`;
    }

    async function place(n) {
        if (finished || selected < 0 || puzzle[selected]) return;
        if (noteMode) {
            const s = notes.get(selected) || new Set();
            if (grid[selected]) return;
            s.has(n) ? s.delete(n) : s.add(n);
            notes.set(selected, s);
            return draw();
        }
        grid[selected] = n; notes.delete(selected);
        wrong.delete(selected);
        if (n !== solution[selected]) { mistakes++; wrong.add(selected); }
        else geometry(size).peers[selected].forEach(j => notes.get(j)?.delete(n)); // 填對了，同行同列同宮的筆記裡就不用再留這個數字
        draw();
        if (await checkWin()) draw();
    }

    async function checkWin() {
        if (finished || !grid.every((v, i) => v === solution[i])) return false;
        finished = true; clearInterval(timerId); elapsed = Math.floor((Date.now() - startedAt) / 1000);
        stars = starsFor(hints, mistakes);
        if (daily) { dailyResult = await completeDaily(GAME, stars); todayInfo = await loadDaily(GAME); } else progress = await completeLevel(GAME, level, stars, LEVELS.length);
        return true;
    }

    function erase() {
        if (finished || selected < 0 || puzzle[selected]) return;
        grid[selected] = 0; notes.delete(selected); wrong.delete(selected);
        draw();
    }

    async function hint() {
        if (finished || hints >= HINTS) return;
        let i = selected;
        if (i < 0 || puzzle[i] || grid[i] === solution[i]) i = grid.findIndex((v, k) => v !== solution[k]);
        if (i < 0) return;
        hints++; selected = i;
        grid[i] = solution[i]; wrong.delete(i); notes.delete(i);
        geometry(size).peers[i].forEach(j => notes.get(j)?.delete(solution[i]));
        draw();
        if (await checkWin()) draw();
    }

    root.addEventListener('click', e => {
        const cell = e.target.closest('.sd-cell'), num = e.target.closest('[data-n]'), lv = e.target.closest('.lv-btn'), act = e.target.closest('[data-act]')?.dataset.act;
        if (cell) { selected = +cell.dataset.i; draw(); }
        else if (num) place(+num.dataset.n);
        else if (lv && !lv.disabled) startLevel(+lv.dataset.lv);
        else if (act === 'menu') showMenu();
        else if (act === 'again') startLevel(level, daily);
        else if (act === 'daily') startLevel(dailyLevel(GAME, LEVELS.length), true);
        else if (act === 'next') startLevel(level + 1);
        else if (act === 'erase') erase();
        else if (act === 'notes') { noteMode = !noteMode; draw(); }
        else if (act === 'hint') hint();
    });
    const onKey = e => {
        if (!level || finished) return;
        if (/^[1-9]$/.test(e.key) && +e.key <= size) place(+e.key);
        else if (e.key === 'Backspace' || e.key === 'Delete') erase();
    };
    window.addEventListener('keydown', onKey);
    showMenu();
    return () => { clearInterval(timerId); window.removeEventListener('keydown', onKey); };
}
