// 2048 的純邏輯（不碰畫面），方便機器人驗證關卡
export const N = 4;

// 關卡：在步數內合出目標方塊
export const LEVELS = [
    { target: 64, moves: 70 }, { target: 128, moves: 130 }, { target: 128, moves: 110 },
    { target: 256, moves: 230 }, { target: 256, moves: 200 }, { target: 512, moves: 450 },
    { target: 512, moves: 400 }, { target: 512, moves: 360 }, { target: 1024, moves: 900 }, { target: 1024, moves: 800 }
];

export function slideLine(line) {
    const nums = line.filter(Boolean), out = [];
    let gained = 0;
    for (let i = 0; i < nums.length; i++) {
        if (nums[i] === nums[i + 1]) { out.push(nums[i] * 2); gained += nums[i] * 2; i++; } else out.push(nums[i]);
    }
    while (out.length < N) out.push(0);
    return { line: out, gained };
}

const lineIdx = (dir, k) => Array.from({ length: N }, (_, j) => dir === 'left' ? k * N + j : dir === 'right' ? k * N + (N - 1 - j) : dir === 'up' ? j * N + k : (N - 1 - j) * N + k);

export function move(board, dir) {
    const next = board.slice();
    let gained = 0;
    for (let k = 0; k < N; k++) {
        const idx = lineIdx(dir, k);
        const res = slideLine(idx.map(i => board[i]));
        gained += res.gained;
        idx.forEach((i, j) => { next[i] = res.line[j]; });
    }
    return { board: next, gained, moved: next.some((v, i) => v !== board[i]) };
}

export function spawn(board) {
    const empty = board.map((v, i) => (v ? -1 : i)).filter(i => i >= 0);
    if (!empty.length) return board;
    const next = board.slice();
    next[empty[Math.floor(Math.random() * empty.length)]] = Math.random() < 0.9 ? 2 : 4;
    return next;
}

export function canMove(board) {
    return ['left', 'right', 'up', 'down'].some(d => move(board, d).moved);
}

export const newBoard = () => spawn(spawn(Array(N * N).fill(0)));
export const maxTile = board => Math.max(...board);
