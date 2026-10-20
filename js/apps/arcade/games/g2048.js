import { SettingsDB } from '../../../db.js';

const KEY = 'arcade_2048';
const N = 4;

// 把一行往前推並合併相同數字，回傳新的一行與得分
function slide(line) {
    const nums = line.filter(Boolean);
    const out = [];
    let gained = 0;
    for (let i = 0; i < nums.length; i++) {
        if (nums[i] === nums[i + 1]) { out.push(nums[i] * 2); gained += nums[i] * 2; i++; } else out.push(nums[i]);
    }
    while (out.length < N) out.push(0);
    return { line: out, gained };
}

export async function mount(root) {
    const saved = (await SettingsDB.get(KEY)) || {};
    let board = Array.isArray(saved.board) && saved.board.length === N * N ? saved.board.slice() : null;
    let score = saved.score || 0;
    let best = saved.best || 0;
    let won = !!saved.won;
    let over = false;

    const empty = () => board.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    function spawn() {
        const e = empty();
        if (!e.length) return;
        board[e[Math.floor(Math.random() * e.length)]] = Math.random() < 0.9 ? 2 : 4;
    }
    function newGame() { board = Array(N * N).fill(0); score = 0; won = false; over = false; spawn(); spawn(); persist(); draw(); }
    const persist = () => SettingsDB.set(KEY, { board, score, best, won });
    function canMove() {
        if (empty().length) return true;
        for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
            const v = board[r * N + c];
            if ((c < N - 1 && v === board[r * N + c + 1]) || (r < N - 1 && v === board[(r + 1) * N + c])) return true;
        }
        return false;
    }

    function move(dir) {
        if (over) return;
        const before = board.join();
        let gained = 0;
        for (let k = 0; k < N; k++) {
            // 取出一條線（依方向決定順序），推完再放回去
            const idx = [];
            for (let j = 0; j < N; j++) idx.push(dir === 'left' ? k * N + j : dir === 'right' ? k * N + (N - 1 - j) : dir === 'up' ? j * N + k : (N - 1 - j) * N + k);
            const res = slide(idx.map(i => board[i]));
            gained += res.gained;
            idx.forEach((i, j) => { board[i] = res.line[j]; });
        }
        if (board.join() === before) return;
        score += gained;
        if (score > best) best = score;
        spawn();
        if (!won && board.includes(2048)) won = true;
        if (!canMove()) over = true;
        persist();
        draw();
    }

    function draw() {
        root.innerHTML = `
        <div class="ag-wrap">
            <div class="ag-bar"><div><span>分數</span><strong>${score}</strong></div><div><span>最高</span><strong>${best}</strong></div><button class="ag-btn" data-act="new">新遊戲</button></div>
            <div class="ag-board g2048" style="touch-action:none">${board.map(v => `<div class="t2048 v${v > 2048 ? 'big' : v}">${v || ''}</div>`).join('')}</div>
            ${over ? '<p class="ag-msg lose">沒有可以移動的格子了！</p>' : won ? '<p class="ag-msg win">🎉 合成 2048！可以繼續挑戰更高分</p>' : '<p class="ag-hint">滑動畫面或用方向鍵移動方塊</p>'}
        </div>`;
    }

    let start = null;
    const onDown = e => { start = { x: e.clientX, y: e.clientY }; };
    const onUp = e => {
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        start = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return;
        move(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    };
    const onKey = e => {
        const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        if (map[e.key]) { e.preventDefault(); move(map[e.key]); }
    };
    root.addEventListener('pointerdown', onDown);
    root.addEventListener('pointerup', onUp);
    root.addEventListener('click', e => { if (e.target.closest('[data-act=new]')) newGame(); });
    window.addEventListener('keydown', onKey);

    if (!board) newGame(); else { over = !canMove(); draw(); }
    return () => window.removeEventListener('keydown', onKey);
}
