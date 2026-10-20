import { SettingsDB } from '../../../db.js';

const KEY = 'arcade_memory_best';
const EMOJI = ['🍎', '🍋', '🍇', '🍓', '🍒', '🥝', '🍑', '🍍', '🥥', '🍉', '🌶️', '🥕'];
const LEVELS = { easy: { name: '簡單', pairs: 6, cols: 4 }, normal: { name: '普通', pairs: 8, cols: 4 }, hard: { name: '困難', pairs: 12, cols: 6 } };

export async function mount(root) {
    const best = (await SettingsDB.get(KEY)) || {};
    let level = 'normal';
    let cards, flipped, moves, matched, locked, startedAt, timerId, elapsed, finished;

    function newGame() {
        clearInterval(timerId);
        const pairs = LEVELS[level].pairs;
        const faces = EMOJI.slice(0, pairs);
        cards = [...faces, ...faces].map((face, i) => ({ id: i, face })).sort(() => Math.random() - 0.5);
        flipped = []; moves = 0; matched = new Set(); locked = false; startedAt = 0; elapsed = 0; finished = false;
        draw();
    }

    function draw() {
        const lv = LEVELS[level];
        root.innerHTML = `
        <div class="ag-wrap">
            <div class="ag-levels">${Object.entries(LEVELS).map(([k, v]) => `<button class="ag-chip ${k === level ? 'on' : ''}" data-level="${k}">${v.name}</button>`).join('')}</div>
            <div class="ag-bar"><div><span>步數</span><strong>${moves}</strong></div><div><span>時間</span><strong id="mm-time">${elapsed}s</strong></div><div><span>最佳</span><strong>${best[level] ? best[level] + ' 步' : '—'}</strong></div><button class="ag-btn" data-act="new">重來</button></div>
            <div class="ag-board memory" style="grid-template-columns:repeat(${lv.cols},1fr)">${cards.map((c, i) => {
                const open = flipped.includes(i) || matched.has(i);
                return `<button class="mm-card ${open ? 'open' : ''} ${matched.has(i) ? 'done' : ''}" data-i="${i}">${open ? c.face : '❓'}</button>`;
            }).join('')}</div>
            ${finished ? `<p class="ag-msg win">🎉 完成！${moves} 步、${elapsed} 秒${best[level] === moves ? '（新紀錄）' : ''}</p>` : '<p class="ag-hint">翻開兩張相同的牌就能消除</p>'}
        </div>`;
    }

    async function flip(i) {
        if (locked || finished || flipped.includes(i) || matched.has(i)) return;
        if (!startedAt) {
            startedAt = Date.now();
            timerId = setInterval(() => { elapsed = Math.floor((Date.now() - startedAt) / 1000); const t = root.querySelector('#mm-time'); if (t) t.textContent = elapsed + 's'; }, 500);
        }
        flipped.push(i);
        if (flipped.length < 2) return draw();
        moves++;
        const [a, b] = flipped;
        if (cards[a].face === cards[b].face) {
            matched.add(a); matched.add(b); flipped = [];
            if (matched.size === cards.length) {
                finished = true; clearInterval(timerId); elapsed = Math.floor((Date.now() - startedAt) / 1000);
                if (!best[level] || moves < best[level]) { best[level] = moves; await SettingsDB.set(KEY, best); }
            }
            return draw();
        }
        locked = true; draw();
        setTimeout(() => { flipped = []; locked = false; draw(); }, 700);
    }

    root.addEventListener('click', e => {
        const card = e.target.closest('.mm-card'), lvl = e.target.closest('[data-level]');
        if (card) flip(+card.dataset.i);
        else if (lvl) { level = lvl.dataset.level; newGame(); }
        else if (e.target.closest('[data-act=new]')) newGame();
    });
    newGame();
    return () => clearInterval(timerId);
}
