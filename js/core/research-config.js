// 研究參與（選填）的設定。
// RESEARCH_ENDPOINT 是開發者自己部署的 research-worker 網址（見 research-worker/README.md）。
// 留空 = 整個功能隱藏、不會有任何網路請求。
export const RESEARCH_ENDPOINT = '';

// 同意書版本：說明文字或收集內容有變動時要加一，已同意的人會需要重新同意
export const CONSENT_VERSION = 1;

// 開啟過這麼多次 App 之後，只問一次要不要參加（純本機計數，不會送出）
export const INVITE_AFTER_OPENS = 8;
