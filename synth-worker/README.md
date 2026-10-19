# siios-synth-worker

聊天室的合成功能後端：語音合成（TTS）、圖片生成、影片生成、音樂合成、語音辨識（STT）。
Worker 是無狀態的，付費服務的 URL／金鑰由 App 逐次請求帶入，不存放在 Worker。

## 免費額度的真實狀況（2026-10 查證）
| 功能 | 免費可用？ | 說明 |
|---|---|---|
| 語音合成 | ✅ | Cloudflare Workers AI `melotts`（支援中文） |
| 圖片生成 | ✅ | Cloudflare Workers AI `flux-1-schnell` |
| 語音辨識 | ✅ | Cloudflare Workers AI `whisper` |
| 影片生成 | ❌ | Cloudflare 沒有影片模型；Hugging Face 免費帳號每月僅約 $0.10 額度，hf-inference 以 CPU 為主，**無法保證可用** |
| 音樂合成 | ⚠️ | 同上；可嘗試 Hugging Face（預設 `facebook/musicgen-small`），不保證有免費推論 |

Cloudflare Workers AI 免費額度為每天 10,000 neurons（UTC 午夜重置），用完後請求會直接失敗、不會扣費。
想要更好品質或影片、音樂：在 App「合成服務設定」改用付費服務（OpenAI 相容端點做圖片／語音，Replicate 做影片／音樂）。

## 部署
```bash
cd synth-worker
npx wrangler login
npx wrangler secret put SYNTH_TOKEN     # 必填：自己產生一組長亂數，App 設定填同一組
npx wrangler secret put HF_TOKEN        # 選填：Hugging Face token
npx wrangler deploy
```
部署後把 Worker 網址與 `SYNTH_TOKEN` 填到 App：設定 → 合成服務。

## API
所有請求都需要 `Authorization: Bearer <SYNTH_TOKEN>`（沒設定 `SYNTH_TOKEN` 時 Worker 會拒絕一切請求）。

| 方法 | 路徑 | 說明 |
|---|---|---|
| GET | `/health` | 回報 Worker 是否綁定 Workers AI、各功能是否有免費路徑 |
| POST | `/synth/tts` | `{ text, lang?, provider?, model?, voice? }` → 音訊 |
| POST | `/synth/image` | `{ prompt, steps?, size?, provider?, model? }` → 圖片 |
| POST | `/synth/video` | `{ prompt, provider, model, input? }` → 影片 |
| POST | `/synth/music` | `{ prompt, provider?, model?, input? }` → 音訊 |
| POST | `/synth/stt` | `{ audio: dataURL, provider?, model? }` → `{ text }` |

`provider`：`cloudflare`（預設）、`huggingface`、`openai`（任何 OpenAI 相容端點）、`replicate`。
付費服務以標頭帶入：`X-Provider-Url`（僅 openai，必須 https，禁止內網與 IP）、`X-Provider-Key`。

錯誤一律回 JSON `{ error, code }`；`code` 有 `quota`、`model_not_found`、`upstream_busy`、`upstream_auth`、`timeout`、`unsupported` 等。

## 測試
```bash
npm test      # node --test，使用模擬的 Workers AI 與 fetch
```
測試涵蓋路由、驗證、CORS、各服務的請求格式與錯誤對應，**不會**呼叫真實模型。實際生成結果與品質需部署後在 App 內驗證。
