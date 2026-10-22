// 三步驟上線精靈用的純函式（不碰瀏覽器，可以在 node 測試）
export const SINGLE_FILE_KEYS = new Set(['src/index.js', 'wrangler.toml', 'package.json', 'README.md']);

export const needsBundle = files => Object.keys(files).some(k => !SINGLE_FILE_KEYS.has(k));

// 32 個字的隨機金鑰（英數字，貼到 Cloudflare 與 App 都不會有特殊字元問題）
export function generateKey(len = 32, rand = globalThis.crypto) {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
    const bytes = rand.getRandomValues(new Uint8Array(len));
    return Array.from(bytes, b => chars[b % chars.length]).join('');
}

// 使用者貼的網址常常不完整：補上 https://、拿掉結尾的斜線與路徑。不是網址就回傳 null
export function normalizeWorkerUrl(input) {
    let s = String(input || '').trim();
    if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    try {
        const u = new URL(s);
        if (!u.hostname.includes('.')) return null;
        return u.origin;
    } catch (_) { return null; }
}

// 把連線失敗的原因翻成使用者看得懂、知道要改哪裡的話
export function explainConnectError(msg = '') {
    const m = String(msg);
    if (/401|unauthor/i.test(m)) return '金鑰不對：步驟 2 的金鑰要和 Cloudflare 上設定的一模一樣（注意不要多複製到空格）。';
    if (/503|MCP_API_KEY/i.test(m)) return 'Worker 還沒有設定金鑰：回到步驟 2，在 Cloudflare 的 Worker → 設定 → 變數和密碼 新增 MCP_API_KEY。';
    if (/404|not found/i.test(m)) return '網址對得到 Cloudflare，但找不到程式：確認這個 Worker 已經按「部署」，而且貼上的是步驟 1 的程式碼。';
    if (/failed to fetch|network|load failed|cors|timeout/i.test(m)) return '連不到這個網址：確認網址沒有打錯；剛部署完請等 10 秒再試。';
    return m || '連線失敗';
}
