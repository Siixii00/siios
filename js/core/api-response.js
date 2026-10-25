// OpenAI 相容 API 的回應解析：各家服務、中轉站的格式不完全一樣，這裡把常見的變化都接住。
// 純函式、不碰網路，方便測試。
//
// 常見的變化：
//   - 串流的行是 "data: {...}" 或 "data:{...}"（沒有空格）
//   - 要了串流卻回一整包 JSON（服務不支援 stream）
//   - content 是字串，或是 [{type:'text', text:'…'}] 的陣列，或舊式的 choices[0].text
//   - 思考型模型把內容放在 reasoning_content、content 是空的（回覆長度上限太小時常見）

const partsToText = c => {
    if (typeof c === 'string') return c;
    if (Array.isArray(c)) return c.map(p => (typeof p === 'string' ? p : (p && (p.text ?? p.content)) || '')).join('');
    return '';
};

// 一個 choice 裡的正文（串流用 delta、非串流用 message）
export function contentOf(choice) {
    if (!choice || typeof choice !== 'object') return '';
    return partsToText(choice.delta?.content) || partsToText(choice.message?.content) || (typeof choice.text === 'string' ? choice.text : '');
}

// 思考內容（有些模型只給這個）
export function reasoningOf(choice) {
    if (!choice || typeof choice !== 'object') return '';
    const m = choice.delta || choice.message || {};
    return partsToText(m.reasoning_content) || partsToText(m.reasoning) || '';
}

// 串流的一行 → 資料字串；不是資料行回傳 null（容許 "data:" 後面沒有空格）
export function sseData(line) {
    const m = /^data:\s?(.*)$/.exec(line);
    return m ? m[1] : null;
}

// 整包 JSON（沒有串流）的回應：取出正文、思考、結束原因
export function parseWholeResponse(text) {
    let json;
    try { json = JSON.parse(text); } catch (_) { return null; }
    const choice = json?.choices?.[0];
    if (!choice) return null;
    return { content: contentOf(choice), reasoning: reasoningOf(choice), finishReason: choice.finish_reason || '', toolCalls: choice.message?.tool_calls || null };
}

// 真的沒有內容時，給使用者看得懂的原因（含實際收到的內容開頭，方便回報）
export function describeEmpty({ raw = '', reasoning = '', finishReason = '' } = {}) {
    if (reasoning) return '模型只回傳了「思考內容」，沒有正式回覆。通常是回覆長度上限太小、被思考用光了：請到「聊天設定」調高回覆長度，或換成不是思考型的模型。';
    if (finishReason === 'content_filter') return '回覆被服務端的內容過濾擋下了（content_filter），請換個說法或換模型。';
    if (finishReason === 'length') return '回覆長度上限太小，模型還沒開始回答就被截斷了。請調高回覆長度上限。';
    const head = String(raw || '').replace(/\s+/g, ' ').trim().slice(0, 160);
    return `模型沒有回傳內容${finishReason ? `（finish_reason：${finishReason}）` : ''}。${head ? `服務端回應開頭：${head}` : '服務端沒有回傳任何資料'}。請確認模型名稱正確、這個模型支援對話（chat completions）。`;
}

// 服務忽略了「不要串流」、回的是 SSE 文字時：把每一行 data 的內容接起來
export function parseSseText(text) {
    let content = '', reasoning = '', finishReason = '';
    for (const line of String(text || '').split('\n')) {
        const data = sseData(line.replace(/\r$/, ''));
        if (data === null || data === '[DONE]') continue;
        try {
            const choice = JSON.parse(data)?.choices?.[0];
            content += contentOf(choice);
            reasoning += reasoningOf(choice);
            if (choice?.finish_reason) finishReason = choice.finish_reason;
        } catch (_) { /* 略過壞掉的行 */ }
    }
    return { content, reasoning, finishReason };
}
