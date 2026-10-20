// 模型有時會把思考過程（COT）連同回覆一起輸出：世界書的 ECoT 預設會要求用 <thinking>…</thinking>，
// 並用 <!-- Start the ECoT --> 之類的 HTML 註解包住思考與自我檢查。這些不該出現在聊天裡，也不該留在歷史中。
// scripts/discord-bot-worker.js 的 stripReasoning 是同一套規則（Worker 是單一檔案，無法 import），改動時兩邊要一起改。

const REASONING_TAGS = 'think|thinking|thought|thoughts|reasoning|analysis|scratchpad|reflection|思考|思考過程|推理';
const BLOCK_RE = new RegExp('<(' + REASONING_TAGS + ')>[\\s\\S]*?</\\1>', 'gi');
const CLOSING_RE = new RegExp('</(' + REASONING_TAGS + ')>', 'i');
const OPENING_RE = new RegExp('<(' + REASONING_TAGS + ')>', 'i');
const MARKERS = ['<!--', ...REASONING_TAGS.split('|').flatMap(t => [`<${t}>`, `</${t}>`])];

// 去掉思考過程：
//   - 完整的 <thinking>…</thinking> 與 <!-- … --> 區塊
//   - 只有結尾標籤（開頭被省略）：結尾標籤之前全是思考
//   - 只有開頭標籤（思考到一半、或還在串流中）：從標籤起全丟掉
// streaming：串流中的文字還沒收完，結尾若是標籤才寫到一半（例如「<thi」），先不顯示，避免閃一下
export function stripReasoning(text, { streaming = false } = {}) {
    let t = String(text ?? '');
    t = t.replace(/<!--[\s\S]*?-->/g, '').replace(BLOCK_RE, '');
    const closing = CLOSING_RE.exec(t);
    if (closing) t = t.slice(closing.index + closing[0].length);
    const opening = OPENING_RE.exec(t);
    if (opening) t = t.slice(0, opening.index);
    const comment = t.indexOf('<!--');
    if (comment >= 0) t = t.slice(0, comment);
    if (streaming) {
        const lt = t.lastIndexOf('<');
        if (lt >= 0) {
            const tail = t.slice(lt).toLowerCase();
            if (!tail.includes('>') && MARKERS.some(m => m.startsWith(tail))) t = t.slice(0, lt);
        }
    }
    return t.trim();
}
