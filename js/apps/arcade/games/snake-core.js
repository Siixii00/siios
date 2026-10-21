// 貪吃蛇的純邏輯（不碰畫面），方便機器人驗證關卡
export const N = 16;
export const LEVEL_COUNT = 40;
export const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

// 第 n 關：要吃的食物數、速度（每格幾毫秒）、障礙物數量（第 3 關起有障礙）。第 11 關起是高手挑戰：速度逼近每秒 12 格
export function levelConfig(n) {
    if (n <= 15) return { level: n, foods: Math.min(24, 4 + n * 2), speed: Math.max(80, 170 - n * 6), walls: n < 3 ? 0 : (n - 2) * 2 };
    // 第 16 關起是「大師挑戰」：每 5 關一輪，一輪裡速度越來越快（92→76 毫秒），下一輪整體再快一點、障礙物更多、食物更多
    const step = (n - 16) % 5, tier = Math.floor((n - 16) / 5);
    return { level: n, foods: Math.min(30, 24 + Math.floor((n - 15) / 4)), speed: Math.max(66, 92 - step * 4 - tier * 3), walls: Math.min(40, 26 + (n - 15)) };
}

// 無盡模式：沒有過關，吃越多越快（每 3 顆加快一點，最快每格 70 毫秒），分數就是吃到的顆數
export const ENDLESS = { level: 'endless', foods: Infinity, speed: 150, walls: 0 };
export const endlessSpeed = eaten => Math.max(70, ENDLESS.speed - Math.floor(eaten / 3) * 4);

const key = (x, y) => y * N + x;

// 障礙物不能擋住起點周圍，不能把場地切成互相到不了的區塊，也不能圍出死胡同
function connected(blocked) {
    const free = []; for (let i = 0; i < N * N; i++) if (!blocked.has(i)) free.push(i);
    const seen = new Set([free[0]]), stack = [free[0]];
    while (stack.length) {
        const c = stack.pop(), x = c % N, y = Math.floor(c / N);
        for (const [dx, dy] of Object.values(DIRS)) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
            const k = key(nx, ny);
            if (!blocked.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
        }
    }
    return seen.size === free.length;
}

// 不能有「死胡同」：每個空格至少要有兩個可以走的鄰格，否則蛇一鑽進去就只能撞死（蛇越長越容易被困）
export function hasNoDeadEnds(blocked) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (blocked.has(key(x, y))) continue;
        let open = 0;
        for (const [dx, dy] of Object.values(DIRS)) {
            const nx = x + dx, ny = y + dy;
            if (nx >= 0 && ny >= 0 && nx < N && ny < N && !blocked.has(key(nx, ny))) open++;
        }
        if (open < 2) return false;
    }
    return true;
}

export function createState(cfg) {
    const snake = [{ x: 8, y: 8 }, { x: 7, y: 8 }, { x: 6, y: 8 }];
    const walls = new Set();
    let tries = 0;
    while (walls.size < cfg.walls && tries++ < 500) {
        const x = Math.floor(Math.random() * N), y = Math.floor(Math.random() * N);
        if (Math.abs(x - 8) <= 4 && Math.abs(y - 8) <= 1) continue; // 起點附近與前進方向留空
        const k = key(x, y);
        if (walls.has(k)) continue;
        walls.add(k);
        if (!connected(walls) || !hasNoDeadEnds(walls)) walls.delete(k);
    }
    const s = { cfg, snake, walls, dir: 'right', eaten: 0, steps: 0, food: null, dead: false, won: false };
    placeFood(s);
    return s;
}

export function placeFood(s) {
    const free = [];
    for (let x = 0; x < N; x++) for (let y = 0; y < N; y++) if (!s.walls.has(key(x, y)) && !s.snake.some(p => p.x === x && p.y === y)) free.push({ x, y });
    s.food = free[Math.floor(Math.random() * free.length)] || null;
}

export function setDir(s, d) {
    const [dx, dy] = DIRS[d], [cx, cy] = DIRS[s.dir];
    if (dx + cx === 0 && dy + cy === 0) return;
    s.dir = d;
}

export function step(s) {
    const [dx, dy] = DIRS[s.dir];
    const head = { x: s.snake[0].x + dx, y: s.snake[0].y + dy };
    const eating = s.food && head.x === s.food.x && head.y === s.food.y;
    const body = eating ? s.snake : s.snake.slice(0, -1);
    if (head.x < 0 || head.y < 0 || head.x >= N || head.y >= N || s.walls.has(key(head.x, head.y)) || body.some(p => p.x === head.x && p.y === head.y)) { s.dead = true; return s; }
    s.snake.unshift(head);
    s.steps++;
    if (eating) {
        s.eaten++;
        if (s.eaten >= s.cfg.foods) { s.won = true; return s; }
        placeFood(s);
    } else s.snake.pop();
    return s;
}
