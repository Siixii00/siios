// 可重現的亂數與簡單的字串雜湊（每日挑戰、主動提議的「偶爾」判斷都用）
// 字串 → 32 位元整數（FNV-1a）：同一個字串永遠一樣，不同字串通常不一樣
export function hashString(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
}

// 可重現的亂數（mulberry32）
export function seededRng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
