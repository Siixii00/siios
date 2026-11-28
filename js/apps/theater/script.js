// 劇場：組提示詞、從模型的回覆取出標題／簡介／HTML、包成隔離的頁面。只放純函式，方便測試。
import { escapeHtml } from '../../utils/html.js';

const HTML_TAG = /<(style|div|p|section|article|main|table|svg|button|script|span|ul|ol|details)\b/i;

export function buildScriptMessages(systemPrompt, character, theaters) {
    const settings = theaters.map(t => `《${t.name || '未命名'}》\n${t.content || ''}`).join('\n\n');
    const task = [
        `請為角色「${character.name || '角色'}」創作一則短篇互動劇場，要能直接在手機瀏覽器顯示，並且可以點擊互動。`,
        character.description ? `角色描述：${character.description}` : '',
        settings ? `【劇場設定】\n${settings}` : '沒有指定劇場設定時，做一張有場景、對話與兩個選項的互動卡片。',
        '輸出格式：先寫兩行「標題：（6 字以內）」「簡介：（20 字以內）」，接著輸出完整 HTML（含 <style>；需要互動時可以用 <script>，不要引用外部 JS／CSS 檔案），用 <ice> 與 </ice> 包起來。不要輸出其他說明。'
    ].filter(Boolean).join('\n\n');
    return [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), { role: 'user', content: task }];
}

// 模型有時只回純文字（例如掛了文字劇場、劇情選項這類設定）：沒有 HTML 標籤就當文字顯示，不要留白。
export function parseScript(text) {
    const s = String(text ?? '').replace(/```[a-z]*/gi, '');
    const ice = /<ice>([\s\S]*?)(?:<\/ice>|$)/i.exec(s); // 輸出被截斷、沒有結尾標籤也照樣取
    const from = ice ? ice[1] : s;
    const tag = HTML_TAG.exec(from);
    const head = s.slice(0, ice ? ice.index : tag ? tag.index : s.length); // 標題與簡介寫在 HTML 前面
    const pick = label => (new RegExp(label + '\\s*[:：]\\s*\\**(.+)').exec(head)?.[1] || '').replace(/[*\s]+$/, '').trim();
    const plain = from.replace(/^.*(標題|簡介)\s*[:：].*$/gm, '').trim();
    const html = tag ? from.slice(tag.index).trim()
        : plain ? `<p style="white-space:pre-wrap;line-height:1.8;padding:16px;margin:0">${escapeHtml(plain)}</p>` : '';
    return { title: pick('標題') || '未命名劇目', desc: pick('簡介'), html };
}

// 放進沙盒 iframe 的完整頁面：外框沒有背景，讓內容自己決定樣式
export function frameDoc(html) {
    return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;background:transparent;color:#222;font-family:system-ui,-apple-system,"Noto Sans TC",sans-serif;overflow-x:hidden}</style></head><body>${html}</body></html>`;
}
