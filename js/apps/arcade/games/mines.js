import { SettingsDB } from '../../../db.js';

const KEY = 'arcade_mines_best';
const LEVELS = { easy: { name: '初級', w: 9, h: 9, mines: 10 }, normal: { name: '中級', w: 9, h: 12, mines: 20 } };

export async function mount(root) {
    const best = (await SettingsDB.get(KEY)) || {};
    let level = 'easy';
    let cells, state, flagMode, timerId, startedAt, elapsed;

    const lv = () => LEVELS[level];
    const neighbors = i => {
        const { w, h } = lv(), x = i % w, y = Math.floor(i / w), out = [];
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if ((dx || dy) && nx >= 0 && ny >= 0 && nx < w && ny < h) out.push(ny * w + nx);
        }
        return out;
    };

    function newGame() {
        clearInterval(timerId);
        cells = Array.from({ length: lv().w * lv().h }, () => ({ mine: false, open: false, flag: false, n: 0 }));
        state = 'ready'; flagMode = false; startedAt = 0; elapsed = 0;
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
            if (!best[level] || elapsed < best[level]) { best[level] = elapsed; await SettingsDB.set(KEY, best); }
        }
        draw();
    }

    function draw() {
        const { w } = lv();
        const flags = cells.filter(c => c.flag).length;
        root.innerHTML = `
        <div class="ag-wrap">
            <div class="ag-levels">${Object.entries(LEVELS).map(([k, v]) => `<button class="ag-chip ${k === level ? 'on' : ''}" data-level="${k}">${v.name}</button>`).join('')}</div>
            <div class="ag-bar"><div><span>剩餘地雷</span><strong>${lv().mines - flags}</strong></div><div><span>時間</span><strong id="mn-time">${elapsed}</strong></div><div><span>最佳</span><strong>${best[level] ? best[level] + 's' : '—'}</strong></div><button class="ag-btn" data-act="new">重來</button></div>
            <div class="ag-board mines" style="grid-template-columns:repeat(${w},1fr)">${cells.map((c, i) => {
                const cls = c.open ? (c.mine ? 'open boom' : 'open n' + c.n) : c.flag ? 'flag' : '';
                return `<button class="mn-cell ${cls}" data-i="${i}">${c.open ? (c.mine ? '💣' : c.n || '') : c.flag ? '🚩' : ''}</button>`;
            }).join('')}</div>
            <div class="ag-levels"><button class="ag-chip ${flagMode ? 'on' : ''}" data-act="mode">${flagMode ? '🚩 插旗模式（點一下插旗）' : '⛏ 挖掘模式（長按插旗）'}</button></div>
            ${state === 'won' ? `<p class="ag-msg win">🎉 掃雷成功！${elapsed} 秒${best[level] === elapsed ? '（新紀錄）' : ''}</p>` : state === 'lost' ? '<p class="ag-msg lose">💥 踩到地雷了</p>' : '<p class="ag-hint">第一下一定安全；點已開的數字且旗數吻合可一次打開周圍</p>'}
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
        const cell = e.target.closest('.mn-cell'), lvl = e.target.closest('[data-level]');
        if (cell) { const wasLong = press?.long; press = null; if (!wasLong) act(+cell.dataset.i, false); }
        else if (lvl) { level = lvl.dataset.level; newGame(); }
        else if (e.target.closest('[data-act=new]')) newGame();
        else if (e.target.closest('[data-act=mode]')) { flagMode = !flagMode; draw(); }
    });
    root.addEventListener('contextmenu', e => { const cell = e.target.closest('.mn-cell'); if (cell) { e.preventDefault(); act(+cell.dataset.i, true); } });
    newGame();
    return () => clearInterval(timerId);
}
