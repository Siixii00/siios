// 猜數字（幾 A 幾 B）的純邏輯（不碰畫面）
// 電腦想一組不重複的數字，你猜；回饋 A＝數字和位置都對、B＝數字對但位置不對。
export const DIGITS = 10;

// 關卡：位數與可猜的次數。次數是用「每次都猜一個和先前回饋都不矛盾的答案」的機器人實測訂的（tests/unit/arcade-difficulty.test.mjs）
export const LEVELS = [
    { len: 3, tries: 10 }, { len: 3, tries: 8 }, { len: 3, tries: 7 },
    { len: 4, tries: 12 }, { len: 4, tries: 10 }, { len: 4, tries: 8 }, { len: 4, tries: 7 }, { len: 4, tries: 6 },
    { len: 5, tries: 9 }, { len: 5, tries: 7 }, { len: 5, tries: 6 }, { len: 5, tries: 5 }
];

export function score(secret, guess) {
    let a = 0, b = 0;
    for (let i = 0; i < guess.length; i++) {
        if (guess[i] === secret[i]) a++;
        else if (secret.includes(guess[i])) b++;
    }
    return { a, b };
}

export function allCodes(len) {
    const out = [];
    const used = Array(DIGITS).fill(false), cur = [];
    const go = () => {
        if (cur.length === len) { out.push(cur.slice()); return; }
        for (let d = 0; d < DIGITS; d++) { if (used[d]) continue; used[d] = true; cur.push(d); go(); cur.pop(); used[d] = false; }
    };
    go();
    return out;
}

export function randomSecret(len, rng = Math.random) {
    const pool = [...Array(DIGITS).keys()];
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    return pool.slice(0, len);
}

export const consistent = (candidates, guess, fb) => candidates.filter(c => { const s = score(c, guess); return s.a === fb.a && s.b === fb.b; });

// 星數：用掉的次數佔上限的比例
export const starsFor = (used, tries) => (used <= Math.ceil(tries * 0.6) ? 3 : used <= Math.ceil(tries * 0.85) ? 2 : 1);
