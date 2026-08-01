import { openDB, deleteDB } from 'https://cdn.jsdelivr.net/npm/idb@8/+esm';

const DB_NAME = 'sxios';
const DB_VERSION = 12;
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
    try {
        console.log('[DB] 開始初始化數據庫...');
        
        if (db) {
            try {
                const stores = db.objectStoreNames;
                if (!stores.contains('users')) {
                    console.log('[DB] 存儲結構不完整，重新初始化');
                    db.close();
                    db = null;
                }
            } catch (e) {
                console.error('[DB] 檢查存儲失敗:', e);
                db = null;
            }
        }
        if (db) {
            console.log('[DB] 使用現有數據庫連接');
            return db;
        }

        await cleanLegacyDatabases();

        console.log('[DB] 創建/打開數據庫:', DB_NAME, '版本:', DB_VERSION);
        db = await openDB(DB_NAME, DB_VERSION, {
            upgrade(database, oldVersion, newVersion, transaction) {
                console.log('[DB] 升級數據庫從版本', oldVersion, '到', newVersion);
                
                if (!database.objectStoreNames.contains('chats')) {
                    const chatsStore = database.createObjectStore('chats', { keyPath: 'id' });
                    chatsStore.createIndex('last_updated', 'last_updated');
                }

                if (!database.objectStoreNames.contains('messages')) {
                    const messagesStore = database.createObjectStore('messages', { keyPath: 'id' });
                    messagesStore.createIndex('chat_id', 'chat_id');
                    messagesStore.createIndex('timestamp', 'timestamp');
                }

                if (database.objectStoreNames.contains('worldInfo')) {
                    database.deleteObjectStore('worldInfo');
                }

                if (!database.objectStoreNames.contains('globalSettings')) {
                    const globalSettingsStore = database.createObjectStore('globalSettings', { keyPath: 'id' });
                    globalSettingsStore.createIndex('priority', 'priority');
                }

                if (!database.objectStoreNames.contains('globalForbidden')) {
                    const globalForbiddenStore = database.createObjectStore('globalForbidden', { keyPath: 'id' });
                    globalForbiddenStore.createIndex('priority', 'priority');
                }

                if (!database.objectStoreNames.contains('theaterSettings')) {
                    const theaterSettingsStore = database.createObjectStore('theaterSettings', { keyPath: 'id' });
                    theaterSettingsStore.createIndex('priority', 'priority');
                }

                if (!database.objectStoreNames.contains('keywordSettings')) {
                    const keywordSettingsStore = database.createObjectStore('keywordSettings', { keyPath: 'id' });
                    keywordSettingsStore.createIndex('priority', 'priority');
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
                    memoriesStore.createIndex('domain', 'domain');
                }

                if (oldVersion < 4 && database.objectStoreNames.contains('memories')) {
                    const memoriesStore = transaction.objectStore('memories');
                    if (!memoriesStore.indexNames.contains('domain')) {
                        memoriesStore.createIndex('domain', 'domain');
                    }
                }

                if (!database.objectStoreNames.contains('wikiRecords')) {
                    const wikiStore = database.createObjectStore('wikiRecords', { keyPath: 'id' });
                    wikiStore.createIndex('character_id', 'character_id');
                    wikiStore.createIndex('page_type', 'page_type');
                    wikiStore.createIndex('title', 'title');
                    wikiStore.createIndex('updated_at', 'updated_at');
                }

                if (!database.objectStoreNames.contains('users')) {
                    database.createObjectStore('users', { keyPath: 'id' });
                }

                if (!database.objectStoreNames.contains('health')) {
                    const healthStore = database.createObjectStore('health', { keyPath: 'id' });
                    healthStore.createIndex('user_id', 'user_id');
                    healthStore.createIndex('type', 'type');
                    healthStore.createIndex('start_date', 'start_date');
                }

                if (!database.objectStoreNames.contains('mcpConfigs')) {
                    const mcpStore = database.createObjectStore('mcpConfigs', { keyPath: 'id' });
                    mcpStore.createIndex('enabled', 'enabled');
                }

                if (!database.objectStoreNames.contains('activities')) {
                    const activitiesStore = database.createObjectStore('activities', { keyPath: 'id' });
                    activitiesStore.createIndex('user_id', 'user_id');
                    activitiesStore.createIndex('timestamp', 'timestamp');
                    activitiesStore.createIndex('platform', 'platform');
                    activitiesStore.createIndex('activity_type', 'activity_type');
                }

                if (!database.objectStoreNames.contains('activitySettings')) {
                    database.createObjectStore('activitySettings', { keyPath: 'id' });
                }

                if (!database.objectStoreNames.contains('activitySources')) {
                    const activitySourcesStore = database.createObjectStore('activitySources', { keyPath: 'id' });
                    activitySourcesStore.createIndex('device_type', 'device_type');
                    activitySourcesStore.createIndex('last_sync', 'last_sync');
                }

                if (!database.objectStoreNames.contains('discordUserBindings')) {
                    const discordBindingStore = database.createObjectStore('discordUserBindings', { keyPath: 'discord_user_id' });
                    discordBindingStore.createIndex('user_id', 'user_id');
                    discordBindingStore.createIndex('character_id', 'character_id');
                }
                
                console.log('[DB] 數據庫升級完成');
            },
            blocked() {
                console.warn('[DB] 數據庫被阻塞');
                if (db) { db.close(); db = null; }
            },
            blocking() {
                console.warn('[DB] 數據庫正在阻塞其他連接');
                if (db) { db.close(); db = null; }
            }
        });

        console.log('[DB] 數據庫初始化成功');
        return db;
    } catch (error) {
        console.error('[DB] 數據庫初始化失敗:', error);
        window.showError?.({
            message: '數據庫初始化失敗: ' + error.message,
            title: '數據庫錯誤',
            details: error.stack || ''
        });
        throw error;
    }
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
            is_group: data.is_group || false,
            member_ids: data.member_ids || [],
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

    async create(chatId, role, content, speakerCharacterId = null) {
        const database = await initDB();
        const id = generateId();
        const message = {
            id,
            chat_id: chatId,
            role,
            content,
            speaker_character_id: speakerCharacterId,
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
    },

    async clearByChatId(chatId) {
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
            memory_type: data.memory_type || 'dynamic',
            domain: data.domain || '',
            status: data.status || '',
            resolved: data.resolved || false,
            meaning: data.meaning || '',
            embedding: data.embedding || null,
            embeddingHash: data.embeddingHash || '',
            embeddingMeaning: data.embeddingMeaning || null,
            embeddingMeaningHash: data.embeddingMeaningHash || '',
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

    async updateEmbedding(id, embedding, hash, meaningEmbedding, meaningHash) {
        const database = await initDB();
        const memory = await database.get('memories', id);
        if (!memory) throw new Error('Memory not found');
        const updated = { ...memory, embedding, embeddingHash: hash };
        if (meaningEmbedding !== undefined) {
            updated.embeddingMeaning = meaningEmbedding;
            updated.embeddingMeaningHash = meaningHash || '';
        }
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

const WikiRecordsDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('wikiRecords');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('wikiRecords', id);
    },

    async getByCharacterId(characterId) {
        const database = await initDB();
        return database.getAllFromIndex('wikiRecords', 'character_id', characterId);
    },

    async getByPageType(pageType) {
        const database = await initDB();
        return database.getAllFromIndex('wikiRecords', 'page_type', pageType);
    },

    async getByTitle(title) {
        const database = await initDB();
        return database.getAllFromIndex('wikiRecords', 'title', title);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = data.id || generateId();
        const now = Date.now();
        const record = {
            id,
            page_type: data.page_type || 'note',
            title: data.title || 'Untitled',
            character_id: data.character_id || null,
            source_type: data.source_type || 'manual',
            source_ids: data.source_ids || [],
            confidence: data.confidence || 'UNVERIFIED',
            blocks: data.blocks || [],
            links: data.links || [],
            tags: data.tags || [],
            cover_image: data.cover_image || null,
            icon: data.icon || '📄',
            parent_id: data.parent_id || null,
            chat_log_index: data.chat_log_index || 0,
            message_range: data.message_range || { start: 0, end: 0 },
            synced_at: data.synced_at || null,
            created_at: data.created_at || now,
            updated_at: data.updated_at || now
        };
        await database.put('wikiRecords', record);
        return record;
    },

    async update(id, data) {
        const database = await initDB();
        const record = await database.get('wikiRecords', id);
        if (!record) throw new Error('WikiRecord not found');
        const updated = { ...record, ...data, updated_at: Date.now() };
        await database.put('wikiRecords', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('wikiRecords', id);
    },

    async deleteByCharacterId(characterId) {
        const database = await initDB();
        const records = await database.getAllFromIndex('wikiRecords', 'character_id', characterId);
        const tx = database.transaction('wikiRecords', 'readwrite');
        for (const record of records) {
            await tx.store.delete(record.id);
        }
    },

    async bulkCreate(records) {
        const database = await initDB();
        const tx = database.transaction('wikiRecords', 'readwrite');
        for (const record of records) {
            await tx.store.put(record);
        }
    }
};

const UsersDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('users');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('users', id);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = generateId();
        const user = {
            id,
            name: data.name || '',
            avatar: data.avatar || '',
            nicknames: data.nicknames || [],
            personality: data.personality || '',
            mbti: data.mbti || '',
            speech_style: data.speech_style || '',
            sleep_start: data.sleep_start || '23:00',
            sleep_end: data.sleep_end || '07:00',
            assigned_chars: data.assigned_chars || [],
            taboos: data.taboos || [],
            created_at: Date.now(),
            ...data
        };
        await database.put('users', user);
        return user;
    },

    async update(id, data) {
        const database = await initDB();
        const user = await database.get('users', id);
        if (!user) throw new Error('User not found');
        const updated = { ...user, ...data };
        await database.put('users', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('users', id);
    }
};


const GlobalSettingsDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('globalSettings');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('globalSettings', id);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = generateId();
        const entry = {
            id,
            name: data.name || '',
            content: data.content || '',
            priority: data.priority || 'front',
            enabled: data.enabled !== undefined ? data.enabled : true,
            created_at: Date.now(),
            updated_at: Date.now()
        };
        await database.put('globalSettings', entry);
        return entry;
    },

    async update(id, data) {
        const database = await initDB();
        const entry = await database.get('globalSettings', id);
        if (!entry) throw new Error('GlobalSettings entry not found');
        const updated = { ...entry, ...data, updated_at: Date.now() };
        await database.put('globalSettings', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('globalSettings', id);
    },

    async getByPriority(priority) {
        const database = await initDB();
        return database.getAllFromIndex('globalSettings', 'priority', priority);
    }
};

const GlobalForbiddenDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('globalForbidden');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('globalForbidden', id);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = generateId();
        const entry = {
            id,
            name: data.name || '',
            content: data.content || '',
            priority: data.priority || 'front',
            enabled: data.enabled !== undefined ? data.enabled : true,
            created_at: Date.now(),
            updated_at: Date.now()
        };
        await database.put('globalForbidden', entry);
        return entry;
    },

    async update(id, data) {
        const database = await initDB();
        const entry = await database.get('globalForbidden', id);
        if (!entry) throw new Error('GlobalForbidden entry not found');
        const updated = { ...entry, ...data, updated_at: Date.now() };
        await database.put('globalForbidden', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('globalForbidden', id);
    },

    async getByPriority(priority) {
        const database = await initDB();
        return database.getAllFromIndex('globalForbidden', 'priority', priority);
    }
};

const TheaterSettingsDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('theaterSettings');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('theaterSettings', id);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = generateId();
        const entry = {
            id,
            name: data.name || '',
            content: data.content || '',
            priority: data.priority || 'middle',
            enabled: data.enabled !== undefined ? data.enabled : true,
            created_at: Date.now(),
            updated_at: Date.now()
        };
        await database.put('theaterSettings', entry);
        return entry;
    },

    async update(id, data) {
        const database = await initDB();
        const entry = await database.get('theaterSettings', id);
        if (!entry) throw new Error('TheaterSettings entry not found');
        const updated = { ...entry, ...data, updated_at: Date.now() };
        await database.put('theaterSettings', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('theaterSettings', id);
    },

    async getByPriority(priority) {
        const database = await initDB();
        return database.getAllFromIndex('theaterSettings', 'priority', priority);
    }
};

const KeywordSettingsDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('keywordSettings');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('keywordSettings', id);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = generateId();
        const entry = {
            id,
            name: data.name || '',
            content: data.content || '',
            keywords: data.keywords || [],
            priority: data.priority || 'middle',
            enabled: data.enabled !== undefined ? data.enabled : true,
            created_at: Date.now(),
            updated_at: Date.now()
        };
        await database.put('keywordSettings', entry);
        return entry;
    },

    async update(id, data) {
        const database = await initDB();
        const entry = await database.get('keywordSettings', id);
        if (!entry) throw new Error('KeywordSettings entry not found');
        const updated = { ...entry, ...data, updated_at: Date.now() };
        await database.put('keywordSettings', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('keywordSettings', id);
    },

    async getByPriority(priority) {
        const database = await initDB();
        return database.getAllFromIndex('keywordSettings', 'priority', priority);
    },

    async matchKeywords(message) {
        const all = await this.getAll();
        const matches = [];
        const lowerMessage = message.toLowerCase();
        for (const entry of all) {
            if (!entry.enabled) continue;
            if (entry.keywords && entry.keywords.length > 0) {
                for (const keyword of entry.keywords) {
                    if (keyword && lowerMessage.includes(keyword.toLowerCase())) {
                        matches.push(entry);
                        break;
                    }
                }
            }
        }
        return matches;
    }
};

const HealthDB = {
    async getByUserId(userId) {
        const database = await initDB();
        return database.getAllFromIndex('health', 'user_id', userId);
    },

    async getByType(userId, type) {
        const database = await initDB();
        const all = await database.getAllFromIndex('health', 'user_id', userId);
        return all.filter(item => item.type === type);
    },

    async getById(id) {
        const database = await initDB();
        return database.get('health', id);
    },

    async createMedication(data) {
        const database = await initDB();
        const id = generateId();
        const now = Date.now();
        const entry = {
            id,
            user_id: data.user_id,
            type: 'medication',
            medication_name: data.medication_name || '',
            dosage: data.dosage || '',
            frequency: data.frequency || 'daily',
            start_date: data.start_date || now,
            end_date: data.end_date || null,
            notes: data.notes || '',
            reminders_enabled: data.reminders_enabled || false,
            reminder_times: data.reminder_times || [],
            created_at: now,
            updated_at: now
        };
        await database.put('health', entry);
        return entry;
    },

    async createPeriod(data) {
        const database = await initDB();
        const id = generateId();
        const now = Date.now();
        const entry = {
            id,
            user_id: data.user_id,
            type: 'period',
            start_date: data.start_date || now,
            end_date: data.end_date || null,
            cycle_length: data.cycle_length || 28,
            period_length: data.period_length || 5,
            symptoms: data.symptoms || [],
            notes: data.notes || '',
            created_at: now
        };
        await database.put('health', entry);
        return entry;
    },

    async getPeriodSettings(userId) {
        const database = await initDB();
        const id = 'period_settings_' + userId;
        return database.get('health', id);
    },

    async savePeriodSettings(data) {
        const database = await initDB();
        const id = 'period_settings_' + data.user_id;
        const now = Date.now();
        const existing = await database.get('health', id);
        const entry = {
            id,
            user_id: data.user_id,
            type: 'period_settings',
            default_cycle_length: data.default_cycle_length || 28,
            default_period_length: data.default_period_length || 5,
            reminder_days_before: data.reminder_days_before || 3,
            reminder_in_chat: data.reminder_in_chat || true,
            reminder_notification: data.reminder_notification || false,
            last_period_date: data.last_period_date || existing?.last_period_date || null,
            predicted_next_date: data.predicted_next_date || null,
            created_at: existing?.created_at || now,
            updated_at: now
        };
        await database.put('health', entry);
        return entry;
    },

    async getMemoryTemplate(userId) {
        const database = await initDB();
        const id = 'health_memory_' + userId;
        return database.get('health', id);
    },

    async saveMemoryTemplate(data) {
        const database = await initDB();
        const id = 'health_memory_' + data.user_id;
        const now = Date.now();
        const entry = {
            id,
            user_id: data.user_id,
            type: 'health_memory_template',
            category: data.category || 'general',
            period_symptoms: data.period_symptoms || [],
            period_mood_changes: data.period_mood_changes || [],
            current_medications: data.current_medications || [],
            behavior_rules: {
                no_surveillance: true,
                no_interference: true,
                no_nagging: true,
                no_over_caring: true,
                must_think_before_respond: true,
                respect_user_stance: true
            },
            created_at: now,
            updated_at: now
        };
        await database.put('health', entry);
        return entry;
    },

    async update(id, data) {
        const database = await initDB();
        const entry = await database.get('health', id);
        if (!entry) throw new Error('Health entry not found');
        const updated = { ...entry, ...data, updated_at: Date.now() };
        await database.put('health', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('health', id);
    },

    async getRecentPeriods(userId, limit = 12) {
        const database = await initDB();
        const all = await database.getAllFromIndex('health', 'user_id', userId);
        const periods = all
            .filter(item => item.type === 'period')
            .sort((a, b) => b.start_date - a.start_date)
            .slice(0, limit);
        return periods;
    }
};

const MCPConfigDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('mcpConfigs');
    },

    async getById(id) {
        const database = await initDB();
        return database.get('mcpConfigs', id);
    },

    async getEnabled() {
        const database = await initDB();
        const all = await database.getAll('mcpConfigs');
        return all.filter(config => config.enabled);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = 'mcp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const config = {
            id,
            name: data.name || '',
            endpoint: data.endpoint || '',
            apiKey: data.apiKey || '',
            enabled: false,
            bound_character_id: data.bound_character_id || null,
            tools: [],
            lastChecked: null,
            status: 'unchecked',
            created_at: Date.now(),
            updated_at: Date.now()
        };
        await database.put('mcpConfigs', config);
        return config;
    },

    async update(id, data) {
        const database = await initDB();
        const config = await database.get('mcpConfigs', id);
        if (!config) throw new Error('MCP Config not found');
        const updated = { ...config, ...data, updated_at: Date.now() };
        await database.put('mcpConfigs', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('mcpConfigs', id);
    },

    async toggle(id) {
        const database = await initDB();
        const config = await database.get('mcpConfigs', id);
        if (!config) throw new Error('MCP Config not found');
        const updated = { ...config, enabled: !config.enabled, updated_at: Date.now() };
        await database.put('mcpConfigs', updated);
        return updated;
    }
};

const ActivityDB = {
    async getAll(limit = 100) {
        const database = await initDB();
        const all = await database.getAll('activities');
        return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    },

    async getById(id) {
        const database = await initDB();
        return database.get('activities', id);
    },

    async getByUserId(userId, limit = 50) {
        const database = await initDB();
        const all = await database.getAllFromIndex('activities', 'user_id', userId);
        return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    },

    async getByPlatform(platform, limit = 50) {
        const database = await initDB();
        const all = await database.getAllFromIndex('activities', 'platform', platform);
        return all.sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
    },

    async getByDateRange(startDate, endDate) {
        const database = await initDB();
        const all = await database.getAll('activities');
        return all.filter(a => a.timestamp >= startDate && a.timestamp <= endDate)
                  .sort((a, b) => b.timestamp - a.timestamp);
    },

    async create(data = {}) {
        const database = await initDB();
        const id = 'act_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        const activity = {
            id,
            user_id: data.user_id || null,
            platform: data.platform || 'unknown',
            activity_type: data.activity_type || 'general',
            title: data.title || '',
            content: data.content || '',
            metadata: data.metadata || {},
            timestamp: data.timestamp || Date.now(),
            synced_at: Date.now(),
            source: data.source || 'manual'
        };
        await database.put('activities', activity);
        return activity;
    },

    async update(id, data) {
        const database = await initDB();
        const activity = await database.get('activities', id);
        if (!activity) throw new Error('Activity not found');
        const updated = { ...activity, ...data, synced_at: Date.now() };
        await database.put('activities', updated);
        return updated;
    },

    async delete(id) {
        const database = await initDB();
        await database.delete('activities', id);
    },

    async clear() {
        const database = await initDB();
        const all = await database.getAll('activities');
        const tx = database.transaction('activities', 'readwrite');
        for (const activity of all) {
            await tx.store.delete(activity.id);
        }
    },

    async getSummary(hours = 24) {
        const database = await initDB();
        const all = await database.getAll('activities');
        const cutoff = Date.now() - (hours * 60 * 60 * 1000);
        const recent = all.filter(a => a.timestamp >= cutoff);
        
        const summary = {
            total: recent.length,
            platforms: {},
            types: {},
            timeRange: {
                start: recent.length > 0 ? Math.min(...recent.map(a => a.timestamp)) : null,
                end: recent.length > 0 ? Math.max(...recent.map(a => a.timestamp)) : null
            }
        };
        
        for (const activity of recent) {
            summary.platforms[activity.platform] = (summary.platforms[activity.platform] || 0) + 1;
            summary.types[activity.activity_type] = (summary.types[activity.activity_type] || 0) + 1;
        }
        
        return summary;
    }
};

const DiscordUserBindingDB = {
    async getByDiscordUserId(discordUserId) {
        const database = await initDB();
        return database.get('discordUserBindings', discordUserId);
    },

    async getByUserId(userId) {
        const database = await initDB();
        return database.getAllFromIndex('discordUserBindings', 'user_id', userId);
    },

    async getByCharacterId(characterId) {
        const database = await initDB();
        return database.getAllFromIndex('discordUserBindings', 'character_id', characterId);
    },

    async create(data) {
        const database = await initDB();
        const now = Date.now();
        const binding = {
            discord_user_id: data.discord_user_id,
            user_id: data.user_id,
            character_id: data.character_id || null,
            discord_username: data.discord_username || '',
            user_display_name: data.user_display_name || '',
            created_at: now,
            updated_at: now
        };
        await database.put('discordUserBindings', binding);
        return binding;
    },

    async update(discordUserId, data) {
        const database = await initDB();
        const binding = await database.get('discordUserBindings', discordUserId);
        if (!binding) throw new Error('Discord user binding not found');
        const updated = { ...binding, ...data, updated_at: Date.now() };
        await database.put('discordUserBindings', updated);
        return updated;
    },

    async delete(discordUserId) {
        const database = await initDB();
        await database.delete('discordUserBindings', discordUserId);
    },

    async getAll() {
        const database = await initDB();
        return database.getAll('discordUserBindings');
    }
};

const ActivitySettingsDB = {
    async get() {
        const database = await initDB();
        return database.get('activitySettings', 'global');
    },
    
    async set(settings) {
        const database = await initDB();
        const data = {
            id: 'global',
            ...settings,
            updated_at: Date.now()
        };
        await database.put('activitySettings', data);
        return data;
    }
};

const ActivitySourcesDB = {
    async getAll() {
        const database = await initDB();
        return database.getAll('activitySources');
    },
    
    async getById(id) {
        const database = await initDB();
        return database.get('activitySources', id);
    },
    
    async register(data) {
        const database = await initDB();
        const source = {
            id: data.id || `src_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            device_type: data.device_type,
            device_name: data.device_name || 'Unknown Device',
            platform: data.platform,
            last_sync: Date.now(),
            enabled: data.enabled !== false,
            created_at: Date.now()
        };
        await database.put('activitySources', source);
        return source;
    },
    
    async update(id, data) {
        const database = await initDB();
        const source = await database.get('activitySources', id);
        if (!source) throw new Error('Activity source not found');
        const updated = { ...source, ...data, updated_at: Date.now() };
        await database.put('activitySources', updated);
        return updated;
    },
    
    async delete(id) {
        const database = await initDB();
        await database.delete('activitySources', id);
    }
};

export { initDB, ChatsDB, MessagesDB, MemoryDB, CharactersDB, SettingsDB, WikiRecordsDB, UsersDB, GlobalSettingsDB, GlobalForbiddenDB, TheaterSettingsDB, KeywordSettingsDB, HealthDB, MCPConfigDB, ActivityDB, DiscordUserBindingDB, ActivitySettingsDB, ActivitySourcesDB, hashContent, cosineSimilarity };



