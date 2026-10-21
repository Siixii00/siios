// 常見的免費（或有免費額度）嵌入模型服務。都是 OpenAI 相容的 /embeddings，而且都允許瀏覽器直接呼叫（已確認 CORS）。
// 免費額度與限制以各服務官方目前的方案為準；這裡只提供「填好網址與模型」的捷徑。
export const EMBEDDING_PRESETS = [
    {
        id: 'siios-worker',
        name: 'Cloudflare Workers AI（用你自己的 Worker，最推薦）',
        url: '', // 套用時填入「合成服務」設定的 Worker 網址
        model: '@cf/baai/bge-m3',
        dimensions: 1024,
        keyHint: 'API Key 填合成服務 Worker 的 SYNTH_TOKEN（留空會自動帶入合成服務設定的 Token）',
        note: '多語言（含中文）效果好、免費額度每天 10,000 neurons，不需要信用卡。需要先部署 synth-worker，教學見 README。',
        link: 'https://developers.cloudflare.com/workers-ai/models/bge-m3/'
    },
    {
        id: 'gemini',
        name: 'Google Gemini（AI Studio 免費金鑰）',
        url: 'https://generativelanguage.googleapis.com/v1beta/openai/embeddings',
        model: 'gemini-embedding-001',
        dimensions: null,
        keyHint: '到 Google AI Studio 建立免費的 API Key',
        note: '有免費額度（有每分鐘與每日限制）。多語言效果好。',
        link: 'https://aistudio.google.com/apikey'
    },
    {
        id: 'jina',
        name: 'Jina AI（免費額度）',
        url: 'https://api.jina.ai',
        model: 'jina-embeddings-v3',
        dimensions: 1024,
        keyHint: '到 jina.ai 的 Embeddings 頁面取得免費 API Key',
        note: '註冊就有免費額度，多語言、中文效果好。',
        link: 'https://jina.ai/embeddings/'
    },
    {
        id: 'siliconflow',
        name: 'SiliconFlow（BGE-M3 免費模型）',
        url: 'https://api.siliconflow.com',
        model: 'BAAI/bge-m3',
        dimensions: 1024,
        keyHint: '到 siliconflow.com 註冊並建立 API Key',
        note: 'BAAI/bge-m3 是平台上免費可用的嵌入模型；中國站請改用 https://api.siliconflow.cn。',
        link: 'https://siliconflow.com/'
    },
    {
        id: 'mistral',
        name: 'Mistral（免費 Experiment 方案）',
        url: 'https://api.mistral.ai',
        model: 'mistral-embed',
        dimensions: null,
        keyHint: '到 Mistral La Plateforme 建立 API Key（選 Experiment 免費方案）',
        note: '免費方案有速率限制，英文效果比中文好。',
        link: 'https://console.mistral.ai/api-keys'
    },
    {
        id: 'voyage',
        name: 'Voyage AI（免費額度）',
        url: 'https://api.voyageai.com',
        model: 'voyage-3.5-lite',
        dimensions: null,
        keyHint: '到 voyageai.com 取得 API Key',
        note: '新帳號有大量免費 token。',
        link: 'https://dashboard.voyageai.com/'
    },
    {
        id: 'ollama',
        name: 'Ollama（本機執行，完全免費）',
        url: 'http://localhost:11434',
        model: 'bge-m3',
        dimensions: null,
        keyHint: 'API Key 留空',
        note: '要在自己的電腦跑 Ollama，先執行 ollama pull bge-m3；並設定環境變數 OLLAMA_ORIGINS=* 讓網頁可以連線。手機無法使用。',
        link: 'https://ollama.com/library/bge-m3'
    }
];

export function findPreset(id) {
    return EMBEDDING_PRESETS.find(p => p.id === id) || null;
}
