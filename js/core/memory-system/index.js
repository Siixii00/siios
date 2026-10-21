import { SensoryExtractor } from './sensory-extractor.js';
import { EmotionTagger } from './emotion-tagger.js';
import { SpatiotemporalTagger } from './spatiotemporal-tagger.js';
import { DecayEngine } from './decay-engine.js';
import { SleepEngine } from './sleep-engine.js';
import { MemoryClassifier } from './memory-classifier.js';
import { MemoryDB, hashContent, cosineSimilarity, initDB } from '../../db.js';
import { createEmbeddingClient } from '../embedding/index.js';
import { pickPending, buildDigestMessages, parseDigestResponse, digestUpdate, DIGEST_BATCH_SIZE } from './digest.js';

// 由「設定」的原始值組出記憶系統需要的設定（App 啟動與設定頁儲存後都用這個）
export function memorySettingsFrom(s = {}) {
    return {
        decayRate: s.memory_decay_rate,
        forgetThreshold: s.memory_threshold,
        embedding: {
            embedding_url: s.embedding_url,
            api_url: s.api_url,
            embedding_model: s.embedding_model,
            embedding_dimensions: s.embedding_dimensions,
            embedding_api_key: s.embedding_api_key,
            api_key: s.api_key
        },
        // 記憶消化專用 API（選填，OpenAI 相容）：整理摘要、分類、學到了什麼都用它，可以選便宜的模型。留空就用主要的 API
        digest: {
            api_url: s.memory_api_url || s.api_url,
            api_key: s.memory_api_key || s.api_key,
            model: s.memory_model || s.model,
            dedicated: !!(s.memory_api_url && s.memory_api_key),
            prompt: s.memory_digest_prompt || ''
        },
        classifier: {
            api_url: s.memory_api_url || s.api_url,
            api_key: s.memory_api_key || s.api_key,
            model: s.memory_model || s.model
        }
    };
}

// 沒有專用的摘要時，用訊息開頭當「簡短版」：記憶層級選 meta 時才有資訊可看
export function summarizeForMeta(text, max = 40) {
    const t = String(text || '').replace(/\s+/g, ' ').trim();
    return t.length > max ? t.slice(0, max) + '…' : t;
}

export class MemorySystem {
    constructor(settings = {}) {
        this.settings = settings;
        this.sensoryExtractor = new SensoryExtractor(settings.sensoryWeights);
        this.emotionTagger = new EmotionTagger();
        this.spatiotemporalTagger = new SpatiotemporalTagger();
        this.decayEngine = new DecayEngine(settings.decayRate);
        this.sleepEngine = new SleepEngine(settings);
        this.embeddingClient = settings.embedding ? createEmbeddingClient(settings.embedding) : null;
        this.classifier = new MemoryClassifier(
            settings.classifier?.api_url || settings.api_url || '',
            settings.classifier?.api_key || settings.api_key || '',
            settings.classifier?.model || settings.model || ''
        );
        this._batchProcessing = false;

        this.sleepEngine.onSleep(() => this.runSleepCycle());
    }

    // 把還沒消化的記憶分批交給消化 API，寫回摘要、學到的事、重要度、類型、標籤，有嵌入服務就順便補向量。
    // API 本身出錯（額度、金鑰、連線）就停下來，不算在記憶頭上；回覆解析不出來的才累計失敗次數，超過上限就不再送。
    async digestPending({ limit = 24 } = {}) {
        const d = this.settings.digest || {};
        if (!d.api_url || !d.api_key) return { digested: 0, skipped: 'no_api' };
        const url = String(d.api_url).replace(/\/+$/, '') + '/v1/chat/completions';
        const pending = pickPending(await MemoryDB.getAll(), { limit });
        let digested = 0;
        const newDislikes = [];
        // 整理出來的「用戶討厭的事」記進討厭清單（固定放進提示詞，不靠檢索）；中途出錯回傳時也要記
        const flush = async () => { if (newDislikes.length) { try { await (await import('../dislikes.js')).addDislikes(newDislikes, { source: 'digest' }); } catch (_) {} newDislikes.length = 0; } };
        for (let i = 0; i < pending.length; i += DIGEST_BATCH_SIZE) {
            const batch = pending.slice(i, i + DIGEST_BATCH_SIZE);
            let text = '';
            try {
                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${d.api_key}` },
                    body: JSON.stringify({ model: d.model || 'gpt-3.5-turbo', messages: buildDigestMessages(batch, { extra: d.prompt }), temperature: 0.2, max_tokens: 1500 })
                });
                if (!res.ok) { await flush(); return { digested, error: `消化 API 回應 ${res.status}` }; }
                text = (await res.json()).choices?.[0]?.message?.content || '';
            } catch (e) {
                await flush();
                return { digested, error: '消化 API 連線失敗：' + (e?.message || e) };
            }
            const results = parseDigestResponse(text, batch.length);
            for (let j = 0; j < batch.length; j++) {
                const m = batch[j];
                const r = results.get(j);
                if (!r) { await MemoryDB.update(m.id, { digest_attempts: (m.digest_attempts || 0) + 1 }); continue; }
                const patch = digestUpdate(m, r);
                if (this.embeddingClient) {
                    try {
                        if (!m.embedding) patch.embedding = await this.embeddingClient.getEmbedding(m.full_content || m.content);
                        if (r.learned) patch.embeddingMeaning = await this.embeddingClient.getEmbedding(r.learned);
                    } catch (_) { /* 向量補不到不影響消化結果 */ }
                }
                await MemoryDB.update(m.id, patch);
                digested++;
                if (r.dislikes?.length) newDislikes.push(...r.dislikes);
            }
        }
        await flush();
        return { digested };
    }

    async getDigestStats() {
        const all = await MemoryDB.getAll();
        return {
            total: all.length,
            digested: all.filter(m => m.digested === true).length,
            pending: pickPending(all, { limit: Infinity }).length,
            dedicated: !!this.settings.digest?.dedicated
        };
    }

    // 設定頁儲存之後立刻生效（不用重開 App）：換新的嵌入客戶端、分類器與衰減率
    reconfigure(settings = {}) {
        this.settings = settings;
        this.decayEngine = new DecayEngine(settings.decayRate);
        this.embeddingClient = settings.embedding ? createEmbeddingClient(settings.embedding) : null;
        this.classifier = new MemoryClassifier(
            settings.classifier?.api_url || settings.api_url || '',
            settings.classifier?.api_key || settings.api_key || '',
            settings.classifier?.model || settings.model || ''
        );
    }

    async processMessage(message, chatId, characterId) {
        // 同一個聊天室裡已經有完全相同內容的記憶就不重複處理（也省下分類與向量的 API 呼叫）
        const duplicate = (await MemoryDB.getByChatId(chatId)).find(m => m.content === message && (m.character_id || m.characterId || characterId) === characterId);
        if (duplicate) return duplicate;

        const sensoryData = this.sensoryExtractor.extract(message);
        const emotionalData = this.emotionTagger.tag(message);
        const spatiotemporalData = this.spatiotemporalTagger.tag(message);

        const emotionalIntensity = Math.abs(emotionalData.valence) * emotionalData.arousal;
        const sensoryRichness = this.sensoryExtractor.getSensoryScore(sensoryData);

        let classification;
        let embedding = null;
        let embeddingHash = '';

        if (this.embeddingClient) {
            const [classResult, embedResult] = await Promise.all([
                this.classifier.classify(message),
                this.embeddingClient.getEmbedding(message).then(e => {
                    if (e) return { embedding: e, hash: hashContent(JSON.stringify(e)) };
                    return null;
                }).catch(() => null)
            ]);
            classification = classResult;
            if (embedResult) {
                embedding = embedResult.embedding;
                embeddingHash = embedResult.hash;
            }
        } else {
            classification = await this.classifier.classify(message);
        }

        const importance = Math.min(1.0, classification.importance * 0.6 + emotionalIntensity * 0.25 + sensoryRichness * 0.15);

        let embeddingMeaning = null;
        let embeddingMeaningHash = '';
        if (this.embeddingClient && classification.meaning) {
            try {
                embeddingMeaning = await this.embeddingClient.getEmbedding(classification.meaning);
                embeddingMeaningHash = hashContent(JSON.stringify(embeddingMeaning));
            } catch {
                embeddingMeaning = null;
            }
        }

        const memory = await MemoryDB.create({
            chat_id: chatId,
            character_id: characterId,
            content: message,
            // Source info
            source_app: 'chat',
            source_type: 'interaction',
            source_subtype: 'chat',
            // Memory levels
            memory_level: 'full',
            meta_content: summarizeForMeta(message),
            full_content: message,
            // Theater binding (will be updated by chat settings)
            theater_ids: [],
            is_fiction: false,
            // Original fields
            sensory: sensoryData,
            emotional: emotionalData,
            spatiotemporal: spatiotemporalData,
            importance,
            decayFactor: 1.0,
            memory_type: classification.memory_type,
            domain: classification.domain,
            meaning: classification.meaning,
            embedding,
            embeddingHash,
            embeddingMeaning,
            embeddingMeaningHash,
            characterId
        });

        return memory;
    }

    async processBatch(messages, chatId, characterId) {
        if (this._batchProcessing) return [];
        this._batchProcessing = true;
        try {
            const results = [];
            for (const msg of messages) {
                const content = msg.content || msg;
                if (typeof content !== 'string' || content.trim().length < 4) continue; // 「好」「嗯」這類太短的訊息不值得存成記憶（也省一次分類呼叫）
                try {
                    const memory = await this.processMessage(content, chatId, characterId);
                    results.push(memory);
                } catch (e) {
                    console.error('[MemorySystem] processBatch error:', e);
                }
            }
            return results;
        } finally {
            this._batchProcessing = false;
        }
    }

    async retrieveMemories(query, chatId, limit = 10, filters = {}) {
        let memories;

        // Get all memories first
        const allMemories = await MemoryDB.getAll();

        // Apply filters
        let filteredMemories = allMemories;

        // Filter by character_id if provided
        // 早期版本存下的記憶沒有 character_id：只在它原本所屬的聊天室裡保留，避免憑空消失
        if (filters.character_id) {
            filteredMemories = filteredMemories.filter(m =>
                (m.character_id || m.characterId) === filters.character_id || m.shared === true || (!m.character_id && !m.characterId && chatId && m.chat_id === chatId)
            );
        }

        // Filter by theater_ids
        if (filters.theater_id !== undefined) {
            const theaterId = filters.theater_id;
            filteredMemories = filteredMemories.filter(m => {
                // If theater_ids is empty (main storyline), include if include_main_memories is true
                if (!m.theater_ids || m.theater_ids.length === 0) {
                    return filters.include_main_memories !== false;
                }
                // If memory has theater_ids, check if it matches the requested theater
                return m.theater_ids.includes(theaterId);
            });
        }

        // Filter by source_app
        if (filters.selected_sources && filters.selected_sources.length > 0) {
            filteredMemories = filteredMemories.filter(m => 
                filters.selected_sources.includes(m.source_app) || (m.source_app || 'chat') === 'chat'
            );
        }

        // Filter by is_fiction
        if (filters.include_fiction === false) {
            filteredMemories = filteredMemories.filter(m => 
                m.is_fiction !== true
            );
        }

        // Now apply semantic or keyword search
        // 沒有查詢句（多數 App 呼叫時沒有使用者訊息）：不比對內容，交給下面的「相似度 0.5 × 遺忘係數 × 重要度」
        // 排序，也就是取這個角色近期、重要的記憶。否則這些 App 永遠讀不到任何記憶。
        if (!String(query || '').trim()) {
            memories = filteredMemories.map(m => ({ ...m, similarity: 0.5 }));
        } else if (this.embeddingClient) {
            try {
                const queryEmbedding = await this.embeddingClient.getEmbedding(query);
                // 查詢句的向量拿不到（連線失敗、暫停中）：全部退回關鍵字搜尋，不然已經有向量的記憶會整批找不到
                if (!queryEmbedding) throw new Error('no query embedding');

                const seen = new Map();
                for (const m of filteredMemories) {
                    let bestSim = 0;
                    if (m.embedding && queryEmbedding) {
                        const sim = cosineSimilarity(queryEmbedding, m.embedding);
                        if (sim >= 0.5) bestSim = sim;
                    }
                    if (m.embeddingMeaning && queryEmbedding) {
                        const sim = cosineSimilarity(queryEmbedding, m.embeddingMeaning);
                        if (sim >= 0.5 && sim > bestSim) bestSim = sim;
                    }
                    if (bestSim > 0) {
                        seen.set(m.id, { ...m, similarity: bestSim });
                    }
                }
                // 各 app 寫入的互動記憶沒有 embedding，用關鍵字比對補進來，否則啟用向量檢索後它們永遠找不到
                const withoutEmbedding = filteredMemories.filter(m => !m.embedding && !m.embeddingMeaning && !seen.has(m.id));
                for (const m of this._keywordSearchFiltered(query, withoutEmbedding)) seen.set(m.id, m);
                memories = Array.from(seen.values());
            } catch {
                memories = this._keywordSearchFiltered(query, filteredMemories);
            }
        } else {
            memories = this._keywordSearchFiltered(query, filteredMemories);
        }

        // Apply additional filters
        if (filters.memory_type) {
            memories = memories.filter(m => m.memory_type === filters.memory_type);
        }
        if (filters.domain) {
            memories = memories.filter(m => m.domain === filters.domain);
        }

        const scored = memories.map(memory => {
            const decayedFactor = this.decayEngine.effectiveFactor(memory);
            const similarity = memory.similarity || 0.5;
            const relevance = similarity * decayedFactor * (memory.importance || 0.5);
            
            // Determine which content to return based on memory_level filter
            let displayContent = memory.content;
            if (filters.memory_level === 'meta' && memory.meta_content) {
                displayContent = memory.meta_content;
            }
            
            return { ...memory, relevance, decayedFactor, displayContent };
        });

        scored.sort((a, b) => b.relevance - a.relevance);

        const results = scored.slice(0, limit);
        if (results.length > 0) {
            const database = await initDB();
            const tx = database.transaction('memories', 'readwrite');
            for (const memory of results) {
                const existing = await tx.store.get(memory.id);
                if (existing) {
                    await tx.store.put({
                        ...existing,
                        accessCount: (existing.accessCount || 0) + 1,
                        lastAccessed: Date.now()
                    });
                }
            }
        }

        return results;
    }

    // 以相鄰兩字（中英文皆適用）的重疊程度比對，而不是要求整句查詢完整出現在記憶裡
    _bigrams(text) {
        const t = String(text || '').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
        const grams = new Set();
        for (let i = 0; i < t.length - 1; i++) grams.add(t.slice(i, i + 2));
        if (t.length === 1) grams.add(t);
        return grams;
    }

    _keywordSearchFiltered(query, memories) {
        const q = this._bigrams(query);
        if (q.size === 0) return [];
        const out = [];
        for (const m of memories) {
            const b = this._bigrams((m.content || '') + ' ' + (m.meta_content || ''));
            if (b.size === 0) continue;
            let shared = 0;
            for (const g of q) if (b.has(g)) shared++;
            const score = shared / Math.min(q.size, b.size);
            // 至少共有兩組相鄰字且佔較短文字的三成以上，避免只因一兩個常見字就命中
            if ((shared >= 2 || (q.size === 1 && shared === 1)) && score >= 0.3) {
                out.push({ ...m, similarity: Math.min(0.9, 0.4 + score * 0.5) });
            }
        }
        return out;
    }

    async _keywordSearch(query, chatId) {
        const allMemories = chatId
            ? await MemoryDB.getByChatId(chatId)
            : await MemoryDB.getAll();
        const lowerQuery = query.toLowerCase();
        return allMemories.filter(m =>
            m.content && m.content.toLowerCase().includes(lowerQuery)
        );
    }

    async reinforceMemory(memoryId) {
        const memory = await MemoryDB.reinforce(memoryId);
        const newDecayFactor = this.decayEngine.reinforce(memory.decayFactor);
        await MemoryDB.update(memoryId, { decayFactor: newDecayFactor });
        return { ...memory, decayFactor: newDecayFactor };
    }

    async runSleepCycle() {
        const allMemories = await MemoryDB.getAll();
        const now = Date.now();

        const decayed = this.decayEngine.batchDecay(allMemories, now);
        const forgotten = [];
        const reinforced = [];

        for (const memory of decayed) {
            if (this.decayEngine.shouldForget(memory.decayFactor, this.settings.forgetThreshold || 0.1) && !this.decayEngine.isProtected(memory, now)) {
                await MemoryDB.delete(memory.id);
                forgotten.push(memory.id);
            } else {
                let decayFactor = memory.decayFactor;
                // 常被想起的記憶在睡眠時被強化（強化後把計數歸零，才不會每晚都強化一次）
                const frequentlyRecalled = memory.accessCount > 3;
                if (frequentlyRecalled) {
                    decayFactor = this.decayEngine.reinforce(decayFactor);
                    reinforced.push(memory.id);
                }
                await MemoryDB.update(memory.id, {
                    decayFactor,
                    decayStage: this.decayEngine.getDecayStage(decayFactor),
                    lastDecayed: now,
                    ...(frequentlyRecalled ? { accessCount: 0 } : {})
                });
            }
        }

        this.lastSleepRun = now;
        try { await this.onSleepCycleDone?.(now); } catch (_) {}
        return { forgotten, reinforced, totalProcessed: decayed.length };
    }

    // 睡眠週期原本只在「App 開著而且是 02:00–06:00」才會跑，手機 PWA 幾乎碰不到；
    // 啟動時補跑：距離上次超過 24 小時（或從沒跑過）就整理一次
    async runSleepCycleIfDue({ lastRun = null, now = Date.now(), minIntervalMs = 24 * 60 * 60 * 1000 } = {}) {
        const last = Number(lastRun ?? this.lastSleepRun) || 0;
        if (last && now - last < minIntervalMs) return null;
        return this.runSleepCycle();
    }

    async getStats() {
        const allMemories = await MemoryDB.getAll();
        const decayStats = this.decayEngine.getDecayStats(allMemories);
        const sleepStatus = this.sleepEngine.getStatus();

        const typeCounts = {};
        for (const m of allMemories) {
            const t = m.memory_type || 'dynamic';
            typeCounts[t] = (typeCounts[t] || 0) + 1;
        }

        return {
            totalMemories: allMemories.length,
            decay: decayStats,
            sleep: sleepStatus,
            embeddingEnabled: !!this.embeddingClient,
            typeCounts
        };
    }

    start() {
        this.sleepEngine.start();
    }

    stop() {
        this.sleepEngine.stop();
    }
}
