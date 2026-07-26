import { SensoryExtractor } from './sensory-extractor.js';
import { EmotionTagger } from './emotion-tagger.js';
import { SpatiotemporalTagger } from './spatiotemporal-tagger.js';
import { DecayEngine } from './decay-engine.js';
import { SleepEngine } from './sleep-engine.js';
import { MemoryClassifier } from './memory-classifier.js';
import { MemoryDB, hashContent, cosineSimilarity, initDB } from '../../db.js';
import { createEmbeddingClient } from '../embedding/index.js';

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

    async processMessage(message, chatId, characterId) {
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
            content: message,
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
                if (typeof content !== 'string' || content.trim().length === 0) continue;
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

        if (this.embeddingClient) {
            try {
                const queryEmbedding = await this.embeddingClient.getEmbedding(query);
                const allMemories = chatId
                    ? await MemoryDB.getByChatId(chatId)
                    : await MemoryDB.getAll();

                const seen = new Map();
                for (const m of allMemories) {
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
                memories = Array.from(seen.values());
            } catch {
                memories = await this._keywordSearch(query, chatId);
            }
        } else {
            memories = await this._keywordSearch(query, chatId);
        }

        if (filters.memory_type) {
            memories = memories.filter(m => m.memory_type === filters.memory_type);
        }
        if (filters.domain) {
            memories = memories.filter(m => m.domain === filters.domain);
        }

        const scored = memories.map(memory => {
            const ageInDays = (Date.now() - (memory.timestamp || memory.created_at)) / (1000 * 60 * 60 * 24);
            const decayedFactor = this.decayEngine.decay(memory.decayFactor, ageInDays, memory.importance);
            const similarity = memory.similarity || 0.5;
            const relevance = similarity * decayedFactor * (memory.importance || 0.5);
            return { ...memory, relevance, decayedFactor };
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
            if (this.decayEngine.shouldForget(memory.decayFactor)) {
                await MemoryDB.delete(memory.id);
                forgotten.push(memory.id);
            } else {
                await MemoryDB.update(memory.id, {
                    decayFactor: memory.decayFactor,
                    decayStage: memory.decayStage
                });

                if (memory.accessCount > 3) {
                    const newDecayFactor = this.decayEngine.reinforce(memory.decayFactor);
                    await MemoryDB.update(memory.id, { decayFactor: newDecayFactor });
                    reinforced.push(memory.id);
                }
            }
        }

        return { forgotten, reinforced, totalProcessed: decayed.length };
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
