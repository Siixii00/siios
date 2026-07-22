import { SensoryExtractor } from './sensory-extractor.js';
import { EmotionTagger } from './emotion-tagger.js';
import { SpatiotemporalTagger } from './spatiotemporal-tagger.js';
import { DecayEngine } from './decay-engine.js';
import { SleepEngine } from './sleep-engine.js';
import { MemoryDB, hashContent } from '../../db.js';
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

        this.sleepEngine.onSleep(() => this.runSleepCycle());
    }

    async processMessage(message, chatId, characterId) {
        const sensoryData = this.sensoryExtractor.extract(message);
        const emotionalData = this.emotionTagger.tag(message);
        const spatiotemporalData = this.spatiotemporalTagger.tag(message);

        const emotionalIntensity = Math.abs(emotionalData.valence) * emotionalData.arousal;
        const sensoryRichness = this.sensoryExtractor.getSensoryScore(sensoryData);
        const importance = Math.min(1.0, (emotionalIntensity * 0.6 + sensoryRichness * 0.4));

        let embedding = null;
        let embeddingHash = '';
        if (this.embeddingClient) {
            try {
                embedding = await this.embeddingClient.getEmbedding(message);
                embeddingHash = hashContent(JSON.stringify(embedding));
            } catch {
                embedding = null;
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
            memory_type: 'episodic',
            embedding,
            embeddingHash,
            characterId
        });

        return memory;
    }

    async retrieveMemories(query, chatId, limit = 10) {
        let memories;

        if (this.embeddingClient) {
            try {
                const queryEmbedding = await this.embeddingClient.embed(query);
                const vectorResults = await MemoryDB.searchByVector(queryEmbedding, 0.5);
                memories = vectorResults.filter(m => !chatId || m.chat_id === chatId);
            } catch {
                memories = await this._keywordSearch(query, chatId);
            }
        } else {
            memories = await this._keywordSearch(query, chatId);
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
        for (const memory of results) {
            await MemoryDB.access(memory.id);
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

        return {
            totalMemories: allMemories.length,
            decay: decayStats,
            sleep: sleepStatus,
            embeddingEnabled: !!this.embeddingClient
        };
    }

    start() {
        this.sleepEngine.start();
    }

    stop() {
        this.sleepEngine.stop();
    }
}

export function createMemorySystem(settings = {}) {
    return new MemorySystem(settings);
}

export { SensoryExtractor, EmotionTagger, SpatiotemporalTagger, DecayEngine, SleepEngine };
