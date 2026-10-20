import { loadProgress, completeLevel, levelGridHtml, starText, totalStars } from './levels.js';

const GAME = 'mines';
// 每關的棋盤大小與地雷數，地雷密度都控制在 20% 以下
const LEVELS = [
    { w: 6, h: 6, mines: 4 }, { w: 7, h: 7, mines: 6 }, { w: 8, h: 8, mines: 8 }, { w: 9, h: 9, mines: 10 }, { w: 9, h: 9, mines: 12 },
    { w: 9, h: 11, mines: 16 }, { w: 10, h: 12, mines: 20 }, { w: 10, h: 14, mines: 26 }, { w: 12, h: 12, mines: 28 }, { w: 12, h: 14, mines: 33 }
];

export async function mount(root) {
    let progress = await loadProgress(GAME);
    let level = 0, cells, state, flagMode, timerId, startedAt, elapsed, stars;

    const lv = () => LEVELS[level - 1];
    const neighbors = i => {
        const { w, h } = lv(), x = i % w, y = Math.floor(i / w), out = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
        }
        return out;
    };

    function showMenu() {
        clearInterval(timerId);
        level = 0;
        root.innerHTML = `<div class="ag-wrap">
            <p class="lv-summary">累計 ★ ${totalStars(progress)} / ${LEVELS.length * 3}</p>
            ${levelGridHtml(progress, LEVELS.length, n => LEVELS[n - 1].w + '×' + LEVELS[n - 1].h + '·' + LEVELS[n - 1].mines + '雷')}
            <p class="ag-hint">第一下一定安全；越快完成星星越多</p>
        </div>`;
    }

    function startLevel(n) {
        clearInterval(timerId);
        level = n;
        cells = Array.from({ length: lv().w * lv().h }, () => ({ mine: false, open: false, flag: false, n: 0 }));
        state = 'ready'; flagMode = false; startedAt = 0; elapsed = 0; stars = 0;
        draw();
    }

    // 第一下一定安全：在第一次點擊後才佈雷，避開點到的格子與它周圍
    function plant(safe) {
        const banned = new Set([safe, ...neighbors(safe)]);
        const pool = cells.map((_, i) => i).filter(i => !banned.has(i)).sort(() => Math.random() - 0.5);
        pool.slice(0, lv().mines).forEach(i => { cells[i].mine = true; });
        cells.forEach((c, i) => { c.n = neighbors(i).filter(j => cells[j].mine).length; });
        state = 'playing'; startedAt = Date.now();
        timerId = setInterval(() => { elapsed = Math.floor((Date.now() - startedAt) / 1000); const t = root.querySelector('#mn-time'); if (t) t.textContent = elapsed; }, 500);
    }

    function openCell(i) {
        const stack = [i];
        while (stack.length) {
            const j = stack.pop(), c = cells[j];
            if (c.open || c.flag) continue;
            c.open = true;
            if (c.n === 0 && !c.mine) stack.push(...neighbors(j));
        }
    }

    async function act(i, asFlag) {
        if (state === 'won' || state === 'lost') return;
        const c = cells[i];
        if (asFlag || flagMode) {
            if (state === 'ready' || c.open) return;
            c.flag = !c.flag;
            return draw();
        }
        if (c.flag) return;
        if (c.open) { // 點已開的數字：周圍旗數吻合就一次打開其餘格子
            const around = neighbors(i);
            if (c.n && around.filter(j => cells[j].flag).length === c.n) around.forEach(j => { if (!cells[j].flag && !cells[j].open) { if (cells[j].mine) { cells[j].open = true; state = 'lost'; } else openCell(j); } });
        } else {
            if (state === 'ready') plant(i);
            if (c.mine) { c.open = true; state = 'lost'; } else openCell(i);
        }
        if (state === 'lost') { clearInterval(timerId); cells.forEach(x => { if (x.mine) x.open = true; }); }
        else if (cells.every(x => x.mine || x.open)) {
            state = 'won'; clearInterval(timerId); elapsed = Math.floor((Date.now() - startedAt) / 1000);
            const par = cells.length * 1.6; // 參考時間
            stars = elapsed <= par * 0.6 ? 3 : elapsed <= par ? 2 : 1;
            progress = await completeLevel(GAME, level, stars, LEVELS.length);
        }
        draw();
    }

    function draw() {
        const { w } = lv();
        const flags = cells.filter(c => c.flag).length;
        const over = state === 'won' || state === 'lost';
        const overlay = over ? `<div class="m3-overlay"><div class="m3-card"><h2>${state === 'won' ? '🎉 掃雷成功！' : '💥 踩到地雷了'}</h2>${state === 'won' ? `<p class="m3-stars">${starText(stars)}</p><p>${elapsed} 秒</p>` : '<p>再試一次吧</p>'}
            <div class="m3-btns">${state === 'won' && level < LEVELS.length ? '<button data-act="next">下一關</button>' : ''}<button data-act="again">${state === 'won' ? '再玩一次' : '再試一次'}</button><button data-act="menu">選關</button></div></div></div>` : '';
        root.innerHTML = `
        <div class="ag-wrap" style="position:relative">
            <div class="lv-bar"><button class="ag-btn" data-act="menu">‹ 選關</button><span>第 ${level} 關</span></div>
            <div class="ag-bar"><div><span>剩餘地雷</span><strong>${lv().mines - flags}</strong></div><div><span>時間</span><strong id="mn-time">${elapsed}</strong></div></div>
            <div class="ag-board mines" style="grid-template-columns:repeat(${w},1fr)">${cells.map((c, i) => {
                const cls = c.open ? (c.mine ? 'open boom' : 'open n' + c.n) : c.flag ? 'flag' : '';
                return `<button class="mn-cell ${cls}" data-i="${i}">${c.open ? (c.mine ? '💣' : c.n || '') : c.flag ? '🚩' : ''}</button>`;
            }).join('')}</div>
            <div class="ag-levels"><button class="ag-chip ${flagMode ? 'on' : ''}" data-act="mode">${flagMode ? '🚩 插旗模式（點一下插旗）' : '⛏ 挖掘模式（長按插旗）'}</button></div>
            <p class="ag-hint">點已開的數字且旗數吻合，可一次打開周圍</p>
            ${overlay}
        </div>`;
    }

    // 長按插旗（手機沒有右鍵）
    let press = null;
    root.addEventListener('pointerdown', e => {
        const cell = e.target.closest('.mn-cell');
        if (!cell) return;
        press = { i: +cell.dataset.i, long: false, t: setTimeout(() => { if (press) { press.long = true; act(press.i, true); } }, 450) };
    });
    root.addEventListener('pointerup', () => { if (press) clearTimeout(press.t); });
    root.addEventListener('click', e => {
        const cell = e.target.closest('.mn-cell'), lvBtn = e.target.closest('.lv-btn'), a = e.target.closest('[data-act]')?.dataset.act;
        if (cell) { const wasLong = press?.long; press = null; if (!wasLong) act(+cell.dataset.i, false); }
        else if (lvBtn && !lvBtn.disabled) startLevel(+lvBtn.dataset.lv);
        else if (a === 'menu') showMenu();
        else if (a === 'again') startLevel(level);
        else if (a === 'next') startLevel(level + 1);
        else if (a === 'mode') { flagMode = !flagMode; draw(); }
    });
    root.addEventListener('contextmenu', e => { const cell = e.target.closest('.mn-cell'); if (cell) { e.preventDefault(); act(+cell.dataset.i, true); } });
    showMenu();
    return () => clearInterval(timerId);
}
