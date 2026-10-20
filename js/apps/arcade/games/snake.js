import { SettingsDB } from '../../../db.js';

const KEY = 'arcade_snake_best';
const N = 16;
const CELL = 20;

export async function mount(root) {
    let best = (await SettingsDB.get(KEY)) || 0;
    let snake, dir, nextDir, food, score, timer, status = 'ready', speed;

    root.innerHTML = `
    <div class="ag-wrap">
        <div class="ag-bar"><div><span>分數</span><strong id="sn-score">0</strong></div><div><span>最高</span><strong id="sn-best">${best}</strong></div><button class="ag-btn" id="sn-start">開始</button></div>
        <canvas id="sn-canvas" width="${N * CELL}" height="${N * CELL}" class="ag-canvas" style="touch-action:none"></canvas>
        <p class="ag-msg" id="sn-msg"></p>
        <div class="ag-dpad"><button data-d="up">▲</button><div><button data-d="left">◀</button><button data-d="down">▼</button><button data-d="right">▶</button></div></div>
        <p class="ag-hint">滑動畫面、方向鍵或按鈕控制方向；吃得越多跑得越快</p>
    </div>`;
    const canvas = root.querySelector('#sn-canvas'), ctx = canvas.getContext('2d');
    const msg = root.querySelector('#sn-msg'), startBtn = root.querySelector('#sn-start');
    const V = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

    function placeFood() {
        const free = [];
        for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!snake.some(s => s.x === x && s.y === y)) free.push({ x, y });
        food = free[Math.floor(Math.random() * free.length)];
    }
    function reset() {
        snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
        dir = nextDir = 'right'; score = 0; speed = 150;
        placeFood(); paint();
        root.querySelector('#sn-score').textContent = 0;
    }
    function paint() {
        ctx.fillStyle = '#101820'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#ff5c5c'; ctx.beginPath(); ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2); ctx.fill();
        snake.forEach((s, i) => { ctx.fillStyle = i === 0 ? '#9be37a' : '#4caf50'; ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2); });
    }
    function setDir(d) {
        const [dx, dy] = V[d], [cx, cy] = V[dir];
        if (dx + cx === 0 && dy + cy === 0) return; // 不能直接回頭
        nextDir = d;
    }
    function schedule() { clearInterval(timer); timer = setInterval(tick, speed); }
    function tick() {
        dir = nextDir;
        const head = { x: snake[0].x + V[dir][0], y: snake[0].y + V[dir][1] };
        const eating = head.x === food.x && head.y === food.y;
        const body = eating ? snake : snake.slice(0, -1);
        if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || body.some(s => s.x === head.x && s.y === head.y)) return gameOver();
        snake.unshift(head);
        if (eating) {
            score++; root.querySelector('#sn-score').textContent = score;
            speed = Math.max(70, speed - 4); schedule();
            if (snake.length === N * N) return gameOver(true);
            placeFood();
        } else snake.pop();
        paint();
    }
    async function gameOver(win) {
        clearInterval(timer); status = 'over';
        if (score > best) { best = score; root.querySelector('#sn-best').textContent = best; await SettingsDB.set(KEY, best); }
        msg.className = 'ag-msg ' + (win ? 'win' : 'lose');
        msg.textContent = win ? '🎉 整個棋盤都被你填滿了！' : '撞到了！得分 ' + score;
        startBtn.textContent = '再玩一次';
    }
    function begin() {
        if (status === 'running') { clearInterval(timer); status = 'paused'; startBtn.textContent = '繼續'; msg.textContent = '已暫停'; return; }
        if (status === 'over' || status === 'ready') reset();
        status = 'running'; msg.textContent = ''; msg.className = 'ag-msg'; startBtn.textContent = '暫停'; schedule();
    }

    startBtn.onclick = begin;
    root.querySelectorAll('.ag-dpad button').forEach(b => { b.onclick = () => setDir(b.dataset.d); });
    const onKey = e => {
        const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
        if (map[e.key]) { e.preventDefault(); setDir(map[e.key]); }
    };
    let start = null;
    canvas.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
    canvas.addEventListener('pointerup', e => {
        if (!start) return;
        const dx = e.clientX - start.x, dy = e.clientY - start.y; start = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
        setDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
    });
    window.addEventListener('keydown', onKey);
    reset();
    return () => { clearInterval(timer); window.removeEventListener('keydown', onKey); };
}
