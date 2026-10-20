// 世界書匯入：把 JSON 檔、TXT 檔或貼上的純文字，統一轉成可寫入設定庫的條目。純函式，沒有任何外部相依。
//
// 輸出的條目：{ name, content, keywords: string[], target: 'global' | 'keyword' | 'theater', priority: 'front' | 'middle' | 'back', enabled }

export const CATEGORY_PRIORITY_MAP = {
    'sx_worldbook_cot': 'front',
    'sx_worldbook_style': 'front',
    'sx_worldbook_global': 'front',
    'sx_worldbook_keywords': 'middle',
    'sx_worldbook_backend': 'back',
    'sx_worldbook_core': 'front',
    'sx_worldbook_theater': 'middle'
};

export const CATEGORY_TARGET_DB = {
    'sx_worldbook_cot': 'global',
    'sx_worldbook_style': 'global',
    'sx_worldbook_global': 'global',
    'sx_worldbook_keywords': 'keyword',
    'sx_worldbook_backend': 'global',
    'sx_worldbook_core': 'global',
    'sx_worldbook_theater': 'theater'
};

// SXIOS 內建世界書的結構：sx_worldbook_* 陣列，或帶有 entries 陣列的物件（視為關鍵字類）
export function getCategoryEntries(worldbook) {
    const result = [];
    for (const [category, value] of Object.entries(worldbook || {})) {
        if (category.startsWith('sx_worldbook_') && Array.isArray(value)) {
            const targetDB = CATEGORY_TARGET_DB[category];
            if (targetDB) result.push({ category, entries: value, targetDB });
        } else if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.entries)) {
            result.push({ category, entries: value.entries, targetDB: 'keyword' });
        }
    }
    return result;
}

const MAX_NAME = 80;
const KEYWORD_LINE = /^\s*(?:關鍵字|關鍵詞|觸發詞|觸發|keywords?|triggers?|keys?)\s*[:：]\s*(.+?)\s*$/i;
const HEADING_PATTERNS = [
    /^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/,      // # 標題
    /^\s*={3,}\s*(.+?)\s*={3,}\s*$/,         // === 標題 ===
    /^\s*【(.+?)】\s*$/,                     // 【標題】
    /^\s*\[(.+?)\]\s*$/                      // [標題]
];

const toStr = v => (v === null || v === undefined ? '' : String(v));
const cleanName = (s, fallback) => (toStr(s).replace(/\s+/g, ' ').trim().slice(0, MAX_NAME)) || fallback;

function toKeywordList(v) {
    if (Array.isArray(v)) return v.map(k => toStr(k).trim()).filter(Boolean);
    if (typeof v === 'string') return v.split(/[,，、;；\n]/).map(k => k.trim()).filter(Boolean);
    return [];
}

function normalize(raw, fallbackName) {
    const content = toStr(raw.content).trim();
    if (!content) return null;
    const keywords = [...new Set(toKeywordList(raw.keywords))];
    let target = raw.target;
    if (!['global', 'keyword', 'theater'].includes(target)) target = keywords.length ? 'keyword' : 'global';
    let priority = raw.priority;
    if (!['front', 'middle', 'back'].includes(priority)) priority = target === 'global' ? 'front' : 'middle';
    return { name: cleanName(raw.name, fallbackName), content, keywords, target, priority, enabled: raw.enabled !== false };
}

// ───── JSON ─────
function fromSxios(data) {
    const out = [];
    for (const { category, entries, targetDB } of getCategoryEntries(data)) {
        const priority = CATEGORY_PRIORITY_MAP[category] || (targetDB === 'keyword' ? 'middle' : 'front');
        entries.forEach((e, i) => {
            const n = normalize({ name: e.title || e.name, content: e.content, keywords: e.triggers || e.keywords, target: targetDB, priority, enabled: e.enabled }, `條目 ${out.length + 1}`);
            if (n) out.push(n);
        });
    }
    return out;
}

// SillyTavern 的 Lorebook / World Info，以及角色卡裡的 character_book
function sillyTavernEntries(data) {
    const book = data?.entries ? data : (data?.character_book?.entries ? data.character_book : (data?.data?.character_book?.entries ? data.data.character_book : null));
    if (!book) return null;
    return Array.isArray(book.entries) ? book.entries : (book.entries && typeof book.entries === 'object' ? Object.values(book.entries) : null);
}

function fromEntryObjects(list) {
    const out = [];
    for (const e of list) {
        if (!e || typeof e !== 'object') continue;
        const keywords = toKeywordList(e.keywords ?? e.triggers ?? e.keys ?? e.key);
        const position = e.position;
        let priority;
        if (position === 0 || position === 'before_char' || position === 'before') priority = 'front';
        else if (position === 4 || position === 'after_char' || position === 'after' || position === 'at_depth') priority = 'back';
        const disabled = e.disable === true || e.disabled === true || e.enabled === false;
        const constant = e.constant === true;
        const n = normalize({
            name: e.title ?? e.name ?? e.comment ?? keywords[0],
            content: e.content ?? e.text ?? e.value,
            keywords: constant ? [] : keywords,
            priority,
            enabled: !disabled
        }, `條目 ${out.length + 1}`);
        if (n) out.push(n);
    }
    return out;
}

function fromJson(data) {
    if (data && typeof data === 'object' && !Array.isArray(data)) {
        const sx = fromSxios(data);
        if (getCategoryEntries(data).length) return { format: 'SXIOS 世界書', entries: sx };
        const st = sillyTavernEntries(data);
        if (st) return { format: 'Lorebook（SillyTavern 等）', entries: fromEntryObjects(st) };
        if (typeof data.content === 'string' || typeof data.text === 'string') return { format: 'JSON 單一條目', entries: fromEntryObjects([data]) };
        // { "條目名稱": "內容" } 或 { "條目名稱": { content, keywords } }
        const pairs = Object.entries(data).map(([name, v]) => (typeof v === 'string' ? { name, content: v } : (v && typeof v === 'object' && !Array.isArray(v) ? { name, ...v } : null))).filter(Boolean);
        if (pairs.length) return { format: 'JSON 名稱對內容', entries: fromEntryObjects(pairs) };
        return { format: 'JSON', entries: [] };
    }
    if (Array.isArray(data)) {
        if (data.every(x => typeof x === 'string')) return { format: 'JSON 文字陣列', entries: data.map((c, i) => normalize({ content: c }, `條目 ${i + 1}`)).filter(Boolean) };
        return { format: 'JSON 條目陣列', entries: fromEntryObjects(data) };
    }
    return { format: 'JSON', entries: [] };
}

// ───── 純文字 ─────
function headingOf(line) {
    for (const re of HEADING_PATTERNS) {
        const m = re.exec(line);
        if (m) return m[1].trim();
    }
    return null;
}

function fromText(text, fallbackName) {
    const lines = text.split('\n');
    const sections = [];
    let current = null;
    for (const line of lines) {
        const title = headingOf(line);
        if (title) {
            current = { name: title, lines: [] };
            sections.push(current);
        } else {
            if (!current) { current = { name: null, lines: [] }; sections.push(current); }
            current.lines.push(line);
        }
    }
    const entries = [];
    for (const s of sections) {
        let keywords = [];
        const body = [];
        for (const line of s.lines) {
            const m = body.length === 0 || !body.some(l => l.trim()) ? KEYWORD_LINE.exec(line) : null; // 只認標題下方第一行的「關鍵字：」
            if (m && !keywords.length) keywords = toKeywordList(m[1]);
            else body.push(line);
        }
        const n = normalize({ name: s.name || fallbackName, content: body.join('\n'), keywords }, `條目 ${entries.length + 1}`);
        if (n) entries.push(n);
    }
    return { format: sections.length > 1 || sections[0]?.name ? '純文字（依標題分段）' : '純文字（單一條目）', entries };
}

// 主入口。text：檔案內容或貼上的文字；fileName：用來當沒有標題時的條目名稱。
export function parseWorldbookText(input, { fileName = '' } = {}) {
    const text = toStr(input).replace(/^﻿/, '').replace(/\r\n?/g, '\n').trim();
    const warnings = [];
    if (!text) return { format: '空白', entries: [], warnings: ['內容是空的'] };
    const fallbackName = cleanName(toStr(fileName).replace(/\.[^.]+$/, ''), '匯入的世界書');

    if (/^[\[{]/.test(text)) {
        try {
            const r = fromJson(JSON.parse(text));
            if (!r.entries.length) warnings.push('這個 JSON 讀得懂，但裡面沒有可匯入的條目（需要有 content 內容）');
            return { ...r, warnings };
        } catch (e) {
            warnings.push('看起來像 JSON 但格式不正確，已改當作純文字處理（' + e.message + '）');
        }
    }
    const r = fromText(text, fallbackName);
    if (!r.entries.length) warnings.push('沒有找到可匯入的內容');
    return { ...r, warnings };
}
