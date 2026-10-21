import { SettingsDB } from '../../../db.js';
import { LEVEL_COUNT, levelConfig, createState, setDir, step, N, ENDLESS, endlessSpeed } from './snake-core.js';
import { loadProgress, completeLevel, levelGridHtml, starText, totalStars } from './levels.js';

const GAME = 'snake';
const CELL = 20;
const BEST_KEY = 'arcade_snake_best';

export async function mount(root) {
    let progress = await loadProgress(GAME);
    let best = Number(await SettingsDB.get(BEST_KEY)) || 0;
    let state = null, timer = null, level = 0, attempt = 0, status = 'menu', ctx = null, canvas = null;

    function showMenu() {
        clearInterval(timer);
        status = 'menu'; state = null;
        root.innerHTML = `<div class="ag-wrap">
            <p class="lv-summary">累計 ★ ${totalStars(progress)} / ${LEVEL_COUNT * 3}</p>
            ${levelGridHtml(progress, LEVEL_COUNT, n => { const c = levelConfig(n); return c.foods + ' 顆' + (c.walls ? '·障礙' : ''); })}
            <button class="ag-btn" data-act="endless">無盡模式（最高 ${best} 顆）</button>
            <p class="ag-hint">一次過關 3 星，第二次 2 星，之後 1 星；無盡模式沒有終點，吃越多越快</p>
        </div>`;
    }

    function startLevel(n, keepAttempts) {
        clearInterval(timer);
        if (!keepAttempts) attempt = 0;
        attempt++;
        level = n;
        const endless = n === 'endless';
        state = createState(endless ? ENDLESS : levelConfig(n));
        status = 'ready';
        root.innerHTML = `
        <div class="ag-wrap" style="position:relative">
            <div class="lv-bar"><button class="ag-btn" data-act="menu">‹ 選關</button><span>${endless ? '無盡模式' : '第 ' + n + ' 關'}</span></div>
            <div class="ag-bar"><div><span>食物</span><strong id="sn-eaten">${endless ? '0' : '0/' + state.cfg.foods}</strong></div><div><span>${endless ? '最高' : '嘗試'}</span><strong>${endless ? best : attempt}</strong></div><button class="ag-btn" id="sn-start">開始</button></div>
            <canvas id="sn-canvas" width="${N * CELL}" height="${N * CELL}" class="ag-canvas" style="touch-action:none"></canvas>
            <p class="ag-msg" id="sn-msg"></p>
            <div class="ag-dpad"><button data-d="up">▲</button><div><button data-d="left">◀</button><button data-d="down">▼</button><button data-d="right">▶</button></div></div>
            <p class="ag-hint">滑動畫面、方向鍵或按鈕控制方向</p>
        </div>`;
        canvas = root.querySelector('#sn-canvas');
        ctx = canvas.getContext('2d');
        let start = null;
        canvas.addEventListener('pointerdown', e => { start = { x: e.clientX, y: e.clientY }; });
        canvas.addEventListener('pointerup', e => {
            if (!start) return;
            const dx = e.clientX - start.x, dy = e.clientY - start.y; start = null;
            if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return;
            setDir(state, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'));
        });
        paint();
    }

    function paint() {
        ctx.fillStyle = '#101820'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#5a6a7a';
        state.walls.forEach(k => ctx.fillRect((k % N) * CELL + 1, Math.floor(k / N) * CELL + 1, CELL - 2, CELL - 2));
        if (state.food) { ctx.fillStyle = '#ff5c5c'; ctx.beginPath(); ctx.arc(state.food.x * CELL + CELL / 2, state.food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2); ctx.fill(); }
        state.snake.forEach((s, i) => { ctx.fillStyle = i === 0 ? '#9be37a' : '#4caf50'; ctx.fillRect(s.x * CELL + 1, s.y * CELL + 1, CELL - 2, CELL - 2); });
    }

    async function tick() {
        const before = state.eaten;
        step(state);
        if (state.eaten !== before) { const el = root.querySelector('#sn-eaten'); if (el) el.textContent = state.cfg.foods === Infinity ? String(state.eaten) : state.eaten + '/' + state.cfg.foods; }
        // 無盡模式：吃越多越快（速度變了才重設計時器）
        if (state.cfg.foods === Infinity && state.eaten !== before && endlessSpeed(state.eaten) !== endlessSpeed(before) && !state.dead) { clearInterval(timer); timer = setInterval(tick, endlessSpeed(state.eaten)); }
        paint();
        if (state.dead) return finish(false);
        if (state.won) return finish(true);
    }

    async function finish(win) {
        clearInterval(timer);
        status = 'over';
        const startBtn = root.querySelector('#sn-start');
        if (win) {
            const stars = attempt === 1 ? 3 : attempt === 2 ? 2 : 1;
            progress = await completeLevel(GAME, level, stars, LEVEL_COUNT);
            root.querySelector('.ag-wrap').insertAdjacentHTML('beforeend', `<div class="m3-overlay"><div class="m3-card"><h2>🎉 過關！</h2><p class="m3-stars">${starText(stars)}</p>
                <div class="m3-btns">${level < LEVEL_COUNT ? '<button data-act="next">下一關</button>' : ''}<button data-act="again">再玩一次</button><button data-act="menu">選關</button></div></div></div>`);
        } else {
            root.querySelector('#sn-msg').className = 'ag-msg lose';
            let note = '';
            if (state.cfg.foods === Infinity && state.eaten > best) { best = state.eaten; note = ' 🏆 新紀錄'; await SettingsDB.set(BEST_KEY, best); }
            root.querySelector('#sn-msg').textContent = '撞到了！吃了 ' + state.eaten + ' 顆' + note;
            startBtn.textContent = '重試';
        }
    }

    function begin() {
        if (status === 'running') { clearInterval(timer); status = 'paused'; root.querySelector('#sn-start').textContent = '繼續'; root.querySelector('#sn-msg').textContent = '已暫停'; return; }
        if (status === 'over') return startLevel(level, true), begin();
        status = 'running';
        root.querySelector('#sn-msg').textContent = '';
        root.querySelector('#sn-msg').className = 'ag-msg';
        root.querySelector('#sn-start').textContent = '暫停';
        clearInterval(timer);
        timer = setInterval(tick, state.cfg.speed);
    }

    root.addEventListener('click', e => {
        const lv = e.target.closest('.lv-btn'), act = e.target.closest('[data-act]')?.dataset.act, d = e.target.closest('[data-d]')?.dataset.d;
        if (lv && !lv.disabled) return startLevel(+lv.dataset.lv);
        if (d && state) return setDir(state, d);
        if (e.target.closest('#sn-start')) return begin();
        if (act === 'menu') showMenu();
        else if (act === 'endless') startLevel('endless');
        else if (act === 'again') startLevel(level);
        else if (act === 'next') startLevel(level + 1);
    });
    const onKey = e => {
        const map = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
        if (map[e.key] && state) { e.preventDefault(); setDir(state, map[e.key]); }
    };
    window.addEventListener('keydown', onKey);
    showMenu();
    return () => { clearInterval(timer); window.removeEventListener('keydown', onKey); };
}
