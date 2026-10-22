// 從模型的回覆裡取出 JSON：模型常常在 JSON 前後加說明、用 ``` 包起來、或先輸出 <think> 思考。
// 找不到合法的 JSON 就回傳 null（呼叫端要自己處理「沒有內容」，不要讓它變成空白畫面）。
import { stripReasoning } from './reasoning-filter.js';

// 從 start 開始找出一個括號平衡的 JSON 片段（會跳過字串裡的括號）
function balanced(s, start) {
    const open = s[start], close = open === '[' ? ']' : '}';
    let depth = 0, inStr = false;
    for (let i = start; i < s.length; i++) {
        const c = s[i];
        if (inStr) { if (c === '\\') i++; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true;
        else if (c === open) depth++;
        else if (c === close && --depth === 0) return s.slice(start, i + 1);
    }
    return null;
}

export function extractJson(text) {
    let s = stripReasoning(String(text ?? '')).trim();
    if (!s) return null;
    const fence = /```(?:json|JSON)?\s*([\s\S]*?)```/.exec(s);
    if (fence) s = fence[1].trim();
    try { return JSON.parse(s); } catch (_) { /* 往下找 */ }
    for (let i = 0; i < s.length; i++) {
        if (s[i] !== '[' && s[i] !== '{') continue;
        const piece = balanced(s, i);
        if (!piece) continue;
        try { return JSON.parse(piece); } catch (_) { /* 這一段不是 JSON（例如 [說明]），繼續往後找 */ }
    }
    return null;
}

// 取出陣列：回覆是陣列、或 { key: [...] }（key 不限名稱時取第一個陣列欄位）。沒有就回傳 []
export function extractArray(text, key = null) {
    const j = extractJson(text);
    if (Array.isArray(j)) return j;
    if (j && typeof j === 'object') {
        if (key && Array.isArray(j[key])) return j[key];
        const first = Object.values(j).find(Array.isArray);
        if (first) return first;
    }
    return [];
}
