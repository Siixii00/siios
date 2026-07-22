import { openDB, deleteDB } from 'https://cdn.jsdelivr.net/npm/idb@8/+esm';

const DB_NAME = 'sxios';
const DB_VERSION = 2;
const LEGACY_DB_NAMES = ['ios-classic-ai'];

let db = null;

async function cleanLegacyDatabases() {
    for (const legacyName of LEGACY_DB_NAMES) {
        try {
            await deleteDB(legacyName);
            console.log(`[DB] 已刪除舊資料庫: ${legacyName}`);
        } catch (e) {
            // 資料庫不存在，忽略錯誤
        }
    }
}

async function initDB() {
    if (db) return db;

    await cleanLegacyDatabases();

    db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(database, oldVersion, newVersion) {
            if (!database.objectStoreNames.contains('chats')) {
                const chatsStore = database.createObjectStore('chats', { keyPath: 'id' });
                chatsStore.createIndex('last_updated', 'last_updated');
            }

            if (!database.objectStoreNames.contains('messages')) {
                const messagesStore = database.createObjectStore('messages', { keyPath: 'id' });
                messagesStore.createIndex('chat_id', 'chat_id');
                messagesStore.createIndex('timestamp', 'timestamp');
            }

            if (!database.objectStoreNames.contains('worldInfo')) {
                const worldInfoStore = database.createObjectStore('worldInfo', { keyPath: 'id' });
                worldInfoStore.createIndex('name', 'name');
                worldInfoStore.createIndex('strategy', 'strategy');
            }

            if (!database.objectStoreNames.contains('characters')) {
                database.createObjectStore('characters', { keyPath: 'id' });
            }

            if (!database.objectStoreNames.contains('settings')) {
                database.createObjectStore('settings', { keyPath: 'key' });
            }

            if (!database.objectStoreNames.contains('memories')) {
                const memoriesStore = database.createObjectStore('memories', { keyPath: 'id' });
                memoriesStore.createIndex('chat_id', 'chat_id');
                memoriesStore.createIndex('timestamp', 'timestamp');
                memoriesStore.createIndex('memory_type', 'memory_type');
            }
        }
    });

    return db;
}

function generateId() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

function hashContent(content) {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
        const char = content.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return hash.toString(16);
}

const ChatsDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('chats');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('chats', id);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = generateId();
        const chat = {
            id,
            character_name: data.character_name || 'AI',
            character_avatar: data.character_avatar || '',
            last_message: data.last_message || '',
            last_updated: Date.now(),
            created_at: Date.now(),
            ...data
        };
        await database.put('chats', chat);
        return chat;
    },

    async update(id, data) {
        const database = await initDB();
        const chat = await database.get('chats', id);
        if (!chat) throw new Error('Chat not found');
        const updated = { ...chat, ...data, last_updated: Date.now() };
        await database.put('chats', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('chats', id);
    }
};

const MessagesDB = {
    async getByChatId(chatId) {
        const database = await initDB();
        return database.getAllFromIndex('messages', 'chat_id', chatId);
    },

    async create(chatId, role, content) {
        const database = await initDB();
        const id = generateId();
        const message = {
            id,
            chat_id: chatId,
            role,
            content,
            timestamp: Date.now()
        };
        await database.put('messages', message);
        return message;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('messages', id);
    },

    async deleteByChatId(chatId) {
        const database = await initDB();
        const messages = await database.getAllFromIndex('messages', 'chat_id', chatId);
        const tx = database.transaction('messages', 'readwrite');
        for (const msg of messages) {
            await tx.store.delete(msg.id);
        }
    }
};

const WorldInfoDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('worldInfo');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('worldInfo', id);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = generateId();
        const entry = {
            id,
            name: data.name || '',
            keywords: data.keywords || [],
            content: data.content || '',
            insertion: data.insertion || 'after',
            priority: data.priority || 10,
            enabled: data.enabled !== undefined ? data.enabled : true,
            strategy: data.strategy || 'keyword',
            position: data.position || 'after_char',
            depth: data.depth || 0,
            probability: data.probability || 100,
            characterFilter: data.characterFilter || [],
            embedding: data.embedding || null,
            embeddingHash: data.embeddingHash || '',
            created_at: Date.now(),
            updated_at: Date.now()
        };
        await database.put('worldInfo', entry);
        return entry;
    },

    async update(id, data) {
        const database = await initDB();
        const entry = await database.get('worldInfo', id);
        if (!entry) throw new Error('WorldInfo entry not found');
        const updated = { ...entry, ...data, updated_at: Date.now() };
        await database.put('worldInfo', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('worldInfo', id);
    },

    async getByStrategy(strategy) {
        const database = await initDB();
        return database.getAllFromIndex('worldInfo', 'strategy', strategy);
    },

    async updateEmbedding(id, embedding, hash) {
        const database = await initDB();
        const entry = await database.get('worldInfo', id);
        if (!entry) throw new Error('WorldInfo entry not found');
        const updated = { ...entry, embedding, embeddingHash: hash, updated_at: Date.now() };
        await database.put('worldInfo', updated);
        return updated;
    },

    async searchByVector(queryVector, threshold = 0.7) {
        const all = await this.getAll();
        const results = [];
        for (const entry of all) {
            if (!entry.embedding) continue;
            const similarity = cosineSimilarity(queryVector, entry.embedding);
            if (similarity >= threshold) {
                results.push({ ...entry, similarity });
            }
        }
        return results.sort((a, b) => b.similarity - a.similarity);
    }
};

function cosineSimilarity(vec1, vec2) {
    if (!vec1 || !vec2 || vec1.length !== vec2.length) return 0;
    let dot = 0, norm1 = 0, norm2 = 0;
    for (let i = 0; i < vec1.length; i++) {
        dot += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
    }
    const denom = Math.sqrt(norm1) * Math.sqrt(norm2);
    return denom === 0 ? 0 : dot / denom;
}

const MemoryDB = {
    async getByChatId(chatId) {
        const database = await initDB();
        return database.getAllFromIndex('memories', 'chat_id', chatId);
    },

    async getAll() {
        const database = await initDB();
        return database.getAll('memories');
    },

    async getByType(memoryType) {
        const database = await initDB();
        return database.getAllFromIndex('memories', 'memory_type', memoryType);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = generateId();
        const now = Date.now();
        const memory = {
            id,
            chat_id: data.chat_id || '',
            content: data.content || '',
            sensory: {
                visual: data.sensory?.visual || [],
                auditory: data.sensory?.auditory || [],
                olfactory: data.sensory?.olfactory || [],
                tactile: data.sensory?.tactile || [],
                gustatory: data.sensory?.gustatory || []
            },
            spatiotemporal: {
                location: data.spatiotemporal?.location || '',
                environment: data.spatiotemporal?.environment || '',
                activity: data.spatiotemporal?.activity || '',
                context: data.spatiotemporal?.context || '',
                relativeTime: data.spatiotemporal?.relativeTime || ''
            },
            emotional: {
                valence: data.emotional?.valence || 0,
                arousal: data.emotional?.arousal || 0,
                emotions: data.emotional?.emotions || []
            },
            aiTags: data.aiTags || [],
            importance: data.importance || 0.5,
            decayFactor: data.decayFactor || 1.0,
            accessCount: data.accessCount || 0,
            memory_type: data.memory_type || 'episodic',
            embedding: data.embedding || null,
            embeddingHash: data.embeddingHash || '',
            reinforcementCount: data.reinforcementCount || 0,
            lastReinforced: data.lastReinforced || null,
            lastAccessed: data.lastAccessed || now,
            timestamp: data.timestamp || now,
            created_at: now
        };
        await database.put('memories', memory);
        return memory;
    },

    async update(id, data) {
        const database = await initDB();
        const memory = await database.get('memories', id);
        if (!memory) throw new Error('Memory not found');
        const updated = { ...memory, ...data };
        await database.put('memories', updated);
        return updated;
    },

    async access(id) {
        const database = await initDB();
        const memory = await database.get('memories', id);
        if (!memory) throw new Error('Memory not found');
        const updated = {
            ...memory,
            accessCount: (memory.accessCount || 0) + 1,
            lastAccessed: Date.now()
        };
        await database.put('memories', updated);
        return updated;
    },

    async reinforce(id) {
        const database = await initDB();
        const memory = await database.get('memories', id);
        if (!memory) throw new Error('Memory not found');
        const now = Date.now();
        const updated = {
            ...memory,
            reinforcementCount: (memory.reinforcementCount || 0) + 1,
            lastReinforced: now,
            decayFactor: Math.min(memory.decayFactor * 1.2, 10)
        };
        await database.put('memories', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('memories', id);
    },

    async searchByVector(queryVector, threshold = 0.7) {
        const all = await this.getAll();
        const results = [];
        for (const memory of all) {
            if (!memory.embedding) continue;
            const similarity = cosineSimilarity(queryVector, memory.embedding);
            if (similarity >= threshold) {
                results.push({ ...memory, similarity });
            }
        }
        return results.sort((a, b) => b.similarity - a.similarity);
    },

    async applyDecay() {
        const database = await initDB();
        const all = await this.getAll();
        const now = Date.now();
        const tx = database.transaction('memories', 'readwrite');
        for (const memory of all) {
            const hoursSinceAccess = (now - (memory.lastAccessed || memory.created_at)) / (1000 * 60 * 60);
            const decay = Math.exp(-hoursSinceAccess * 0.01 / (memory.decayFactor || 1.0));
            const effectiveImportance = (memory.importance || 0.5) * decay;
            if (effectiveImportance < 0.01) {
                await tx.store.delete(memory.id);
            } else {
                await tx.store.put({ ...memory, importance: effectiveImportance });
            }
        }
    }
};

const CharactersDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('characters');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('characters', id);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = generateId();
        const character = {
            id,
            name: data.name || '',
            avatar: data.avatar || '',
            description: data.description || '',
            personality: data.personality || '',
            scenario: data.scenario || '',
            first_message: data.first_message || '',
            created_at: Date.now(),
            ...data
        };
        await database.put('characters', character);
        return character;
    },

    async update(id, data) {
        const database = await initDB();
        const character = await database.get('characters', id);
        if (!character) throw new Error('Character not found');
        const updated = { ...character, ...data };
        await database.put('characters', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('characters', id);
    }
};

const SettingsDB = {
    getDefaults() {
        return {
            api_url: '',
            api_key: '',
            model: 'gpt-3.5-turbo',
            system_prompt: 'You are a helpful AI assistant.',
            temperature: 0.7,
            top_p: 1.0,
            frequency_penalty: 0,
            presence_penalty: 0,
            context_size: 4096,
            embedding_url: '',
            embedding_model: '',
            embedding_dimensions: 1536,
            embedding_api_key: '',
            memory_enabled: false,
            memory_decay_rate: 0.01,
            memory_threshold: 0.01
        };
    },

    async getAll() {
        const database = await initDB();
        const all = await database.getAll('settings');
        const settings = {};
        for (const item of all) {
            settings[item.key] = item.value;
        }
        return settings;
    },

    async get(key) {
        const database = await initDB();
        const item = await database.get('settings', key);
        return item ? item.value : undefined;
    },

    async set(key, value) {
        const database = await initDB();
        await database.put('settings', { key, value });
    }
};

export { initDB, ChatsDB, MessagesDB, WorldInfoDB, MemoryDB, CharactersDB, SettingsDB, hashContent };
