// 猜數字（幾 A 幾 B）的純邏輯（不碰畫面）
// 電腦想一組數字（預設每個數字不重複，部分關卡可以重複），你猜；回饋 A＝數字和位置都對、B＝數字對但位置不對。
export const DIGITS = 10;

// 關卡：位數與可猜的次數。次數是用「每次都猜一個和先前回饋都不矛盾的答案」的機器人實測訂的（tests/unit/arcade-difficulty.test.mjs）
export const LEVELS = [
    { len: 3, tries: 10 }, { len: 3, tries: 8 }, { len: 3, tries: 7 },
    { len: 4, tries: 12 }, { len: 4, tries: 10 }, { len: 4, tries: 8 }, { len: 4, tries: 7 }, { len: 4, tries: 6 },
    { len: 5, tries: 9 }, { len: 5, tries: 7 }, { len: 5, tries: 6 }, { len: 5, tries: 5 },
    // 第 13 關起：數字可以重複（難度不同，要多想一層），以及 6 位數
    { len: 4, tries: 10, repeat: true }, { len: 4, tries: 9, repeat: true }, { len: 4, tries: 8, repeat: true }, { len: 4, tries: 7, repeat: true },
    { len: 5, tries: 10, repeat: true }, { len: 5, tries: 9, repeat: true }, { len: 5, tries: 8, repeat: true },
    { len: 6, tries: 9 }, { len: 6, tries: 8 }, { len: 6, tries: 7 }, { len: 5, tries: 7, repeat: true }, { len: 6, tries: 6 }
];

// 數字可以重複時，B 的算法要照「每個數字最多算它在答案裡出現的次數」（標準的 Mastermind 算法）
export function score(secret, guess) {
    let a = 0;
    const cs = Array(DIGITS).fill(0), cg = Array(DIGITS).fill(0);
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === secret[i]) a++;
        else { cs[secret[i]]++; cg[guess[i]]++; }
    }
    let b = 0;
    for (let d = 0; d < DIGITS; d++) b += Math.min(cs[d], cg[d]);
    return { a, b };
}

// repeat：數字可以重複（10^len 種）；否則每個數字最多出現一次
export function allCodes(len, repeat = false) {
    const out = [];
    const used = Array(DIGITS).fill(false), cur = [];
    const go = () => {
        if (cur.length === len) { out.push(cur.slice()); return; }
        for (let d = 0; d < DIGITS; d++) { if (!repeat && used[d]) continue; used[d] = true; cur.push(d); go(); cur.pop(); used[d] = false; }
    };
    go();
    return out;
}

export function randomSecret(len, rng = Math.random, repeat = false) {
    if (repeat) return Array.from({ length: len }, () => Math.floor(rng() * DIGITS));
    const pool = [...Array(DIGITS).keys()];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, len);
}

export const consistent = (candidates, guess, fb) => candidates.filter(c => { const s = score(c, guess); return s.a === fb.a && s.b === fb.b; });

// 星數：用掉的次數佔上限的比例
export const starsFor = (used, tries) => (used <= Math.ceil(tries * 0.6) ? 3 : used <= Math.ceil(tries * 0.85) ? 2 : 1);
