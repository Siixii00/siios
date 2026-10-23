// 匯入其他來源（SillyTavern、ChatGPT、Claude、純文字對話…）：本機解析器，全部是純函式、不碰網路與資料庫。
// 認得的格式直接轉；認不得才由使用者決定要不要交給 AI（見 ai-assist.js，而且只會送出一小段樣本）。
//
// 解析結果的統一格式：
//   { format, formatLabel, characters: [{ name, description, personality, scenario, first_message, avatar, tags, book }],
//     chats: [{ title, characterName, userName, messages: [{ role: 'user'|'assistant', content, time }] }], warnings: [] }

const MAX_AVATAR_CHARS = 700000; // 內嵌在 PNG 的頭像太大就不帶（避免撐爆資料庫）

export const FORMAT_LABELS = {
    'tavern-card': 'Tavern／SillyTavern 角色卡（JSON）',
    'tavern-card-png': 'Tavern／SillyTavern 角色卡（PNG）',
    'st-chat': 'SillyTavern 聊天紀錄（.jsonl）',
    chatgpt: 'ChatGPT 匯出的對話',
    claude: 'Claude 匯出的對話',
    transcript: '純文字對話（「名字：內容」）',
    'st-settings': 'SillyTavern 設定檔（使用者人設）',
    ours: 'SXIOS 備份檔',
    unknown: '無法辨識的格式'
};

const empty = (format, warnings = []) => ({ format, formatLabel: FORMAT_LABELS[format], characters: [], chats: [], personas: [], warnings });
const str = v => (typeof v === 'string' ? v : v == null ? '' : String(v));
const stripBom = s => str(s).replace(/^﻿/, '');

// {{char}}、{{user}} 這類巨集換成實際名字（SillyTavern 的角色卡很常用）
export function fillMacros(text, { char = '', user = '' } = {}) {
    return str(text)
        .replace(/\{\{\s*char\s*\}\}|<BOT>/gi, char || '角色')
        .replace(/\{\{\s*user\s*\}\}|<USER>/gi, user || '使用者');
}

// ───── base64 / PNG ─────
function base64ToBytes(b64) {
    const bin = atob(String(b64).replace(/\s+/g, ''));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
}
export function bytesToBase64(bytes) {
    let bin = '';
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(bin);
}
const PNG_SIG = [137, 80, 78, 71, 13, 10, 26, 10];
export const isPng = bytes => bytes && bytes.length > 8 && PNG_SIG.every((b, i) => bytes[i] === b);

// 讀出 PNG 裡的 tEXt／iTXt 文字區塊（角色卡把 JSON 的 base64 放在關鍵字 chara 或 ccv3）
export function readPngText(bytes) {
    const out = {};
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const latin1 = (a, b) => { let s = ''; for (let i = a; i < b; i++) s += String.fromCharCode(bytes[i]); return s; };
    let p = 8;
    while (p + 12 <= bytes.length) {
        const len = dv.getUint32(p);
        const type = latin1(p + 4, p + 8);
        const start = p + 8, end = start + len;
        if (end > bytes.length) break;
        if (type === 'tEXt') {
            const nul = bytes.indexOf(0, start);
            if (nul > start && nul < end) out[latin1(start, nul)] = latin1(nul + 1, end);
        } else if (type === 'iTXt') {
            const nul = bytes.indexOf(0, start);
            if (nul > start && nul < end) {
                const compressed = bytes[nul + 1];
                // 略過語言標籤與翻譯關鍵字：兩個 \0 之後才是文字
                let q = nul + 3;
                for (let k = 0; k < 2 && q < end; k++) { while (q < end && bytes[q] !== 0) q++; q++; }
                if (!compressed) out[latin1(start, nul)] = new TextDecoder().decode(bytes.subarray(q, end));
            }
        }
        if (type === 'IEND') break;
        p = end + 4; // 略過 CRC
    }
    return out;
}

// ───── Tavern 角色卡 ─────
function cardFields(raw) {
    const d = raw && raw.data && typeof raw.data === 'object' ? raw.data : raw;
    return d && typeof d === 'object' ? d : null;
}
export function isTavernCard(json) {
    const d = cardFields(json);
    if (!d) return false;
    if (/^chara_card_v[123]$/.test(str(json.spec))) return true;
    return typeof d.name === 'string' && ['description', 'personality', 'scenario', 'first_mes'].some(k => typeof d[k] === 'string');
}

// ───── 角色卡風險偵測 ─────
// SillyTavern 角色卡可能來自任何人：除了角色設定，還可能夾帶「系統提示／後置指令」，
// 有些是要求 AI 無視規則、解除限制的破限提示詞。這裡只做偵測與標示，讓使用者看過再決定。
const RISK_PATTERNS = [
    { id: 'ignore-rules', label: '要求 AI 忽略先前的指令或規則', re: /ignore (all |any )?(the )?(previous|prior|above|earlier|system) (instructions|rules|prompts?)|disregard (all |any |the )?(previous |prior )?(rules|guidelines|instructions)|forget (all |your )?(previous |prior )?(instructions|rules)|忽略(之前|以上|先前|所有|任何)的?(指令|規則|設定|提示)|無視(所有|任何)?(規則|限制|設定|指令)/i },
    { id: 'jailbreak', label: '疑似破限／解除限制的提示詞', re: /jailbreak|\bDAN\b|developer mode|(no|without|bypass|override|remove)\s+(any\s+)?(restrictions?|limitations?|filters?|censorship|safety|guardrails?)|you have no (restrictions|limits|rules)|越獄|破限|解除(限制|審查|過濾)|不受(任何)?(限制|規範|規則)/i },
    { id: 'no-refuse', label: '要求 AI 不得拒絕', re: /(never|do not|don't|must not)\s+(refuse|decline|reject)|不得?拒絕|不要拒絕|絕對不能拒絕/i },
    { id: 'not-ai', label: '要求 AI 否認自己是 AI', re: /you are not an? (ai|language model|assistant)|never (say|mention|reveal) (that )?you are an? (ai|bot)|你不是\s*(ai|人工智慧|語言模型)/i },
    { id: 'script', label: '含 SillyTavern 專用的腳本巨集（這個 App 不支援，會原樣留在文字裡）', re: /\{\{\s*(setvar|getvar|addvar|incvar|random|roll|pick|reverse|idle_duration|lastmessage)\b|<\|im_(start|end)\|>|\[\s*system\s*(note|prompt)?\s*:/i },
    { id: 'adult', label: '含成人內容的標記', re: /\bnsfw\b|\bexplicit\b|\br-?18\b|18\+|成人向|色情|情色/i },
];

// 涉及未成年角色的性內容：不提供匯入（不只是警告）。為了不誤擋正常的卡，要「同一句或相鄰的下一句」裡同時有
// 未成年的字眼和性相關的字眼，而且那句話沒有否定（例如「禁止未成年內容」「no underage content」）。
// 這是自動判斷，可能誤判；被擋下時會顯示觸發的那一句，內容沒問題的話改掉那句再匯入即可。
const MINOR_TERMS = /\b(loli|lolicon|shota|shotacon|underage|under-age|minor child)\b|未成年|蘿莉|正太|幼女|幼童|\b(?:[1-9]|1[0-7])[ -]?(?:years?|yrs?)[ -]?old\b|\b(?:[1-9]|1[0-7])\s*歲/i;
const SEXUAL_TERMS = /\b(sex|sexual|nsfw|erotic|porn|fuck|rape|molest|nude)\w*|性愛|性行為|做愛|色情|情色|強暴|猥褻|裸體/i;
const ANY_NEGATION = /\b(no|not|never|without|forbid\w*|prohibit\w*|avoid\w*|banned?)\b|禁止|不含|沒有|不可以|不得|避免|不會|不允許|不涉及|皆已成年|已成年/i;
const NEGATION_BEFORE = /(\bno\b|\bnot\b|\bnever\b|\bwithout\b|\bforbid\w*|\bprohibit\w*|\bavoid\w*|\bban\w*|\bnon-?|禁止|不含|沒有|不可以|不得|避免|不會|不允許|不涉及)[^.。!！?？\n]{0,25}$/i;

export function detectMinorSexual(text) {
    const sentences = str(text).split(/(?<=[.。!！?？\n])/);
    for (let i = 0; i < sentences.length; i++) {
        const m = MINOR_TERMS.exec(sentences[i]);
        if (!m) continue;
        if (ANY_NEGATION.test(sentences[i]) || NEGATION_BEFORE.test(sentences[i].slice(0, m.index))) continue; // 「禁止未成年內容」這類
        const next = sentences[i + 1] || '';
        const sexual = SEXUAL_TERMS.test(sentences[i]) ? sentences[i] : (SEXUAL_TERMS.test(next) && !ANY_NEGATION.test(next) ? next : '');
        if (sexual) return (sentences[i].trim() + (sexual === next ? ' ' + next.trim() : '')).slice(0, 200);
    }
    return null;
}

export function assessCardRisk(texts) {
    const hay = (Array.isArray(texts) ? texts : [texts]).map(str).join('\n');
    const flags = RISK_PATTERNS.filter(r => r.re.test(hay)).map(r => ({ id: r.id, label: r.label, severe: false }));
    const excerpt = detectMinorSexual(hay);
    if (excerpt) flags.push({ id: 'minor-sexual', label: '疑似涉及未成年角色的性內容', severe: true, excerpt });
    return { flags, blocked: flags.some(f => f.severe) };
}

export function parseTavernCard(json, { userName = '', avatar = '' } = {}) {
    const d = cardFields(json);
    const name = str(d.name).trim() || '未命名角色';
    const f = t => fillMacros(t, { char: name, user: userName }).trim();
    let description = f(d.description);
    const example = f(d.mes_example).replace(/<START>/gi, '').trim();
    if (example) description += `${description ? '\n\n' : ''}【對話範例】\n${example}`;
    const book = d.character_book && Array.isArray(d.character_book.entries) && d.character_book.entries.length ? d.character_book : null;
    // 會影響整個對話行為的額外指令：預設不匯入，使用者看過、自己勾選才會加進去
    const extra = {
        system_prompt: f(d.system_prompt),
        post_history: f(d.post_history_instructions),
        depth_prompt: f(d.extensions && d.extensions.depth_prompt && d.extensions.depth_prompt.prompt)
    };
    const card = {
        name, description,
        personality: f(d.personality),
        scenario: f(d.scenario),
        first_message: f(d.first_mes),
        avatar, tags: Array.isArray(d.tags) ? d.tags.map(str).filter(Boolean).slice(0, 12) : [], book,
        origin: 'sillytavern',
        extra,
        creator_notes: str(d.creator_notes).trim().slice(0, 1000)
    };
    const bookText = book ? book.entries.map(e => str(e.content)).join('\n') : '';
    card.risk = assessCardRisk([card.description, card.personality, card.scenario, card.first_message, extra.system_prompt, extra.post_history, extra.depth_prompt, bookText, str(d.alternate_greetings), card.creator_notes]);
    return card;
}

// 把使用者勾選的額外指令附在說明後面
export function withExtraPrompts(card, { system = false, postHistory = false, depth = false } = {}) {
    const parts = [];
    if (system && card.extra?.system_prompt) parts.push(card.extra.system_prompt);
    if (postHistory && card.extra?.post_history) parts.push(card.extra.post_history);
    if (depth && card.extra?.depth_prompt) parts.push(card.extra.depth_prompt);
    if (!parts.length) return card.description;
    return `${card.description}${card.description ? '\n\n' : ''}【角色補充設定】\n${parts.join('\n\n')}`;
}

// ───── 使用者人設（persona）─────
// SillyTavern 的 settings.json：personas 是「頭像檔名 → 名字」，persona_descriptions 是「頭像檔名 → { description… }」
export function parseSTSettings(json) {
    const pu = json && json.power_user;
    if (!pu || typeof pu !== 'object' || !pu.personas || typeof pu.personas !== 'object') return null;
    const res = empty('st-settings');
    for (const [file, name] of Object.entries(pu.personas)) {
        const n = str(name).trim();
        if (!n) continue;
        res.personas.push({ name: n, description: fillMacros(str(pu.persona_descriptions?.[file]?.description).trim(), { user: n }) });
    }
    if (!res.personas.length) res.warnings.push('沒有找到使用者人設');
    return res;
}

// ───── SillyTavern 聊天紀錄（.jsonl）─────
export function parseSendDate(v) {
    if (typeof v === 'number' && isFinite(v)) return v > 1e12 ? v : v * 1000;
    const s = str(v).trim();
    if (!s) return null;
    let m = /^(\d{4})-(\d{2})-(\d{2}) @(\d+)h (\d+)m(?: (\d+)s)?/.exec(s); // 2024-06-05 @22h 14m 03s
    if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)).getTime();
    m = /^([A-Za-z]+) (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2})\s*(am|pm)$/i.exec(s); // June 5, 2024 10:14pm
    if (m) {
        const mon = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(m[1].slice(0, 3).toLowerCase());
        if (mon >= 0) { let h = +m[4] % 12; if (/pm/i.test(m[6])) h += 12; return new Date(+m[3], mon, +m[2], h, +m[5]).getTime(); }
    }
    const t = Date.parse(s);
    return Number.isNaN(t) ? null : t;
}

export function parseSTChat(text) {
    const res = empty('st-chat');
    let meta = null;
    const messages = [];
    let bad = 0;
    for (const line of stripBom(text).split(/\r?\n/)) {
        const t = line.trim();
        if (!t) continue;
        let o;
        try { o = JSON.parse(t); } catch (_) { bad++; continue; }
        if (!o || typeof o !== 'object') continue;
        if (typeof o.mes !== 'string') { if (!meta && (o.user_name || o.character_name)) meta = o; continue; }
        if (o.is_system === true) continue;
        const content = o.mes.trim();
        if (!content) continue;
        messages.push({ role: o.is_user ? 'user' : 'assistant', content, time: parseSendDate(o.send_date), _name: str(o.name) });
    }
    if (bad) res.warnings.push(`有 ${bad} 行不是有效的 JSON，已略過`);
    const userName = str(meta?.user_name) || messages.find(m => m.role === 'user')?._name || '使用者';
    const characterName = str(meta?.character_name) || messages.find(m => m.role === 'assistant')?._name || '角色';
    messages.forEach(m => { m.content = fillMacros(m.content, { char: characterName, user: userName }); delete m._name; });
    if (messages.length) res.chats.push({ title: `${characterName} 的聊天紀錄`, characterName, userName, messages });
    else res.warnings.push('沒有找到任何訊息');
    return res;
}

// ───── ChatGPT 匯出（conversations.json）─────
const partsText = c => {
    if (!c) return '';
    if (typeof c === 'string') return c;
    const parts = Array.isArray(c.parts) ? c.parts : [];
    return parts.map(p => typeof p === 'string' ? p : (p && typeof p.text === 'string' ? p.text : '')).filter(Boolean).join('\n');
};
function linearize(conv) {
    const map = conv.mapping || {};
    let ids = [];
    if (conv.current_node && map[conv.current_node]) {
        const seen = new Set();
        for (let id = conv.current_node; id && map[id] && !seen.has(id); id = map[id].parent) { seen.add(id); ids.push(id); }
        ids.reverse();
    } else {
        ids = Object.keys(map).sort((a, b) => (map[a].message?.create_time || 0) - (map[b].message?.create_time || 0));
    }
    return ids.map(id => map[id].message).filter(Boolean);
}
export function isChatGpt(json) {
    const first = Array.isArray(json) ? json[0] : json;
    return !!first && typeof first === 'object' && first.mapping && typeof first.mapping === 'object';
}
export function parseChatGpt(json) {
    const res = empty('chatgpt');
    const list = Array.isArray(json) ? json : [json];
    for (const conv of list) {
        if (!conv || !conv.mapping) continue;
        const messages = [];
        for (const m of linearize(conv)) {
            const role = m.author?.role;
            if (role !== 'user' && role !== 'assistant') continue;
            const content = partsText(m.content).trim();
            if (!content) continue;
            messages.push({ role, content, time: m.create_time ? Math.round(m.create_time * 1000) : null });
        }
        if (messages.length) res.chats.push({ title: str(conv.title) || 'ChatGPT 對話', characterName: 'ChatGPT', userName: '我', messages });
    }
    if (!res.chats.length) res.warnings.push('沒有找到任何對話');
    return res;
}

// ───── Claude 匯出（conversations.json）─────
export function isClaudeExport(json) {
    const first = Array.isArray(json) ? json[0] : json;
    return !!first && typeof first === 'object' && Array.isArray(first.chat_messages);
}
export function parseClaudeExport(json) {
    const res = empty('claude');
    const list = Array.isArray(json) ? json : [json];
    for (const conv of list) {
        if (!conv || !Array.isArray(conv.chat_messages)) continue;
        const messages = [];
        for (const m of conv.chat_messages) {
            const role = m.sender === 'human' ? 'user' : m.sender === 'assistant' ? 'assistant' : null;
            if (!role) continue;
            let content = str(m.text).trim();
            if (!content && Array.isArray(m.content)) content = m.content.map(c => str(c?.text)).filter(Boolean).join('\n').trim();
            if (!content) continue;
            const t = Date.parse(m.created_at);
            messages.push({ role, content, time: Number.isNaN(t) ? null : t });
        }
        if (messages.length) res.chats.push({ title: str(conv.name) || 'Claude 對話', characterName: 'Claude', userName: '我', messages });
    }
    if (!res.chats.length) res.warnings.push('沒有找到任何對話');
    return res;
}

// ───── 純文字對話：「名字：內容」─────
const USER_NAME_RE = /^(user|you|me|human|i|我|使用者|用戶|玩家|你)$/i;
const SPEAKER_LINE = /^\s*([^\s:：「」\[\]()（）]{1,24}(?: [^\s:：]{1,16})?)\s*[:：]\s?(.*)$/;

export function parseTranscript(text, { userName = '', recipe = null } = {}) {
    const res = empty('transcript');
    const lines = stripBom(text).split(/\r?\n/);
    const matcher = recipe ? recipe.match : l => { const m = SPEAKER_LINE.exec(l); return m ? { speaker: m[1].trim(), text: m[2] } : null; };
    const counts = new Map();
    let speakerLines = 0, nonEmpty = 0;
    for (const l of lines) {
        if (!l.trim()) continue;
        nonEmpty++;
        const m = matcher(l);
        if (m) { speakerLines++; counts.set(m.speaker, (counts.get(m.speaker) || 0) + 1); }
    }
    const speakers = [...counts.entries()].filter(([, n]) => n >= 2).sort((a, b) => b[1] - a[1]).map(([s]) => s);
    res.speakers = speakers;
    if (speakers.length < 2 || speakerLines < nonEmpty * 0.6) return res; // 不像對話：交回呼叫端判斷（format 仍是 transcript，但沒有 chats）
    const user = userName && speakers.includes(userName) ? userName
        : recipe?.userSpeakers?.find(s => speakers.includes(s)) || speakers.find(s => USER_NAME_RE.test(s)) || speakers[0];
    const character = recipe?.characterName && speakers.includes(recipe.characterName) ? recipe.characterName : speakers.find(s => s !== user);
    const messages = [];
    let cur = null;
    for (const l of lines) {
        const m = l.trim() ? matcher(l) : null;
        if (m && speakers.includes(m.speaker)) {
            if (cur) messages.push(cur);
            cur = { role: m.speaker === user ? 'user' : 'assistant', content: str(m.text), time: null, _speaker: m.speaker };
        } else if (cur && (l.trim() || cur.content)) {
            cur.content += '\n' + l;
        }
    }
    if (cur) messages.push(cur);
    const out = messages.map(m => ({ role: m._speaker === user ? 'user' : 'assistant', content: m.content.trim(), time: null })).filter(m => m.content);
    res.userCandidates = speakers;
    if (out.length) res.chats.push({ title: `${character} 的對話`, characterName: character, userName: user, messages: out });
    return res;
}

// ───── 主入口 ─────
// input: { name, text?, bytes? }。回傳統一格式；format === 'unknown' 時由 UI 決定要不要交給 AI。
export function parseImport({ name = '', text = '', bytes = null } = {}) {
    if (bytes && isPng(bytes)) {
        const t = readPngText(bytes);
        const payload = t.ccv3 || t.chara;
        if (!payload) return { ...empty('unknown'), warnings: ['這張 PNG 裡沒有找到角色卡資料'] };
        let json;
        try { json = JSON.parse(new TextDecoder().decode(base64ToBytes(payload))); } catch (_) { return { ...empty('unknown'), warnings: ['PNG 裡的角色卡資料讀不出來'] }; }
        if (!isTavernCard(json)) return { ...empty('unknown'), warnings: ['PNG 裡的資料不是角色卡'] };
        const dataUri = 'data:image/png;base64,' + bytesToBase64(bytes);
        const res = empty('tavern-card-png');
        const warnings = dataUri.length > MAX_AVATAR_CHARS ? ['圖片太大，沒有一併匯入頭像（角色資料照常匯入）'] : [];
        res.characters.push(parseTavernCard(json, { avatar: dataUri.length > MAX_AVATAR_CHARS ? '' : dataUri }));
        res.warnings = warnings;
        return res;
    }

    const body = stripBom(text).trim();
    if (!body) return { ...empty('unknown'), warnings: ['內容是空的'] };

    if (/^[\[{]/.test(body)) {
        let json = null;
        try { json = JSON.parse(body); } catch (_) { /* 可能是 jsonl，往下 */ }
        if (json !== null) {
            if (json && json.data && json.version && (json.data.chats || json.data.characters)) return empty('ours');
            const stSettings = parseSTSettings(json);
            if (stSettings) return stSettings;
            if (isChatGpt(json)) return parseChatGpt(json);
            if (isClaudeExport(json)) return parseClaudeExport(json);
            if (isTavernCard(json)) { const r = empty('tavern-card'); r.characters.push(parseTavernCard(json)); return r; }
        }
    }
    // jsonl：每行一個 JSON，其中有 mes 欄位（SillyTavern）
    const firstLines = body.split(/\r?\n/).slice(0, 5);
    if (firstLines.some(l => { try { const o = JSON.parse(l); return o && typeof o === 'object' && ('mes' in o || 'user_name' in o); } catch (_) { return false; } })) return parseSTChat(body);

    const t = parseTranscript(body);
    if (t.chats.length) return t;
    return { ...empty('unknown'), speakers: t.speakers || [] };
}

// 沒有時間的訊息：接在前一則後面 1 秒；整段都沒時間：以現在往回排，順序才不會亂
export function fillTimes(messages, now = Date.now()) {
    const out = messages.map(m => ({ ...m }));
    let known = out.findIndex(m => m.time != null);
    if (known === -1) { out.forEach((m, i) => { m.time = now - (out.length - i) * 1000; }); return out; }
    for (let i = known - 1; i >= 0; i--) out[i].time = out[i + 1].time - 1000;
    for (let i = known + 1; i < out.length; i++) if (out[i].time == null || out[i].time <= out[i - 1].time) out[i].time = out[i - 1].time + (out[i].time == null ? 1000 : 1);
    return out;
}

// 把訊息依長度切成一段一段（之後每段存成一筆記憶，交給「記憶消化」整理）
export function chunkConversation(messages, { charName = '角色', userName = '使用者', maxChars = 800, maxMsgs = 14 } = {}) {
    const chunks = [];
    let lines = [], len = 0, first = null;
    const flush = () => { if (lines.length) chunks.push({ text: lines.join('\n'), time: first, count: lines.length }); lines = []; len = 0; first = null; };
    for (const m of messages) {
        let content = str(m.content).trim();
        if (!content) continue;
        const who = m.role === 'user' ? userName : charName;
        while (content.length > maxChars) { // 超長的單則訊息自己切開
            if (lines.length) flush();
            chunks.push({ text: `${who}：${content.slice(0, maxChars)}`, time: m.time ?? null, count: 1 });
            content = content.slice(maxChars);
        }
        const line = `${who}：${content}`;
        if (lines.length && (len + line.length > maxChars || lines.length >= maxMsgs)) flush();
        if (first == null) first = m.time ?? null;
        lines.push(line); len += line.length;
    }
    flush();
    return chunks;
}
