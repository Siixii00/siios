const DB_NAME = 'ios-classic-ai';
const DB_VERSION = 1;

let db = null;

async function initDB() {
    if (db) return db;
    
    db = await idb.openDB(DB_NAME, DB_VERSION, {
        upgrade(database) {
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
            }
            
            if (!database.objectStoreNames.contains('characters')) {
                database.createObjectStore('characters', { keyPath: 'id' });
            }
            
            if (!database.objectStoreNames.contains('settings')) {
                database.createObjectStore('settings', { keyPath: 'key' });
            }
        }
    });
    
    return db;
}

function generateId() {
    return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

const ChatsDB = {
    async getAll() {
        const database = await initDB();
        const chats = await database.getAll('chats');
        return chats.sort((a, b) => b.last_updated - a.last_updated);
    },
    
    async getById(id) {
        const database = await initDB();
        return database.get('chats', id);
    },
    
    async create(chat) {
        const database = await initDB();
        const newChat = {
            id: generateId(),
            character_id: chat.character_id || null,
            character_name: chat.character_name || 'AI',
            character_avatar: chat.character_avatar || '',
            last_message: '',
            last_updated: Date.now(),
            unread: 0
        };
        await database.put('chats', newChat);
        return newChat;
    },
    
    async update(id, data) {
        const database = await initDB();
        const chat = await database.get('chats', id);
        if (chat) {
            const updated = { ...chat, ...data, last_updated: Date.now() };
            await database.put('chats', updated);
            return updated;
        }
        return null;
    },
    
    async delete(id) {
        const database = await initDB();
        const messages = await database.getAllFromIndex('messages', 'chat_id', id);
        const tx = database.transaction(['chats', 'messages'], 'readwrite');
        await tx.objectStore('chats').delete(id);
        for (const msg of messages) {
            await tx.objectStore('messages').delete(msg.id);
        }
        await tx.done;
    }
};

const MessagesDB = {
    async getByChatId(chatId) {
        const database = await initDB();
        const messages = await database.getAllFromIndex('messages', 'chat_id', chatId);
        return messages.sort((a, b) => a.timestamp - b.timestamp);
    },
    
    async create(chatId, role, content) {
        const database = await initDB();
        const message = {
            id: generateId(),
            chat_id: chatId,
            role,
            content,
            timestamp: Date.now()
        };
        await database.put('messages', message);
        
        await ChatsDB.update(chatId, { last_message: content.substring(0, 50) });
        
        return message;
    },
    
    async delete(id) {
        const database = await initDB();
        await database.delete('messages', id);
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
    
    async create(entry) {
        const database = await initDB();
        const newEntry = {
            id: generateId(),
            name: entry.name || '',
            keywords: entry.keywords || [],
            content: entry.content || '',
            insertion: entry.insertion || 'after',
            priority: entry.priority || 10,
            enabled: entry.enabled !== false,
            created_at: Date.now(),
            updated_at: Date.now()
        };
        await database.put('worldInfo', newEntry);
        return newEntry;
    },
    
    async update(id, data) {
        const database = await initDB();
        const entry = await database.get('worldInfo', id);
        if (entry) {
            const updated = { ...entry, ...data, updated_at: Date.now() };
            await database.put('worldInfo', updated);
            return updated;
        }
        return null;
    },
    
    async delete(id) {
        const database = await initDB();
        await database.delete('worldInfo', id);
    },
    
    async searchByKeywords(keywords) {
        const all = await this.getAll();
        return all.filter(entry => {
            if (!entry.enabled) return false;
            return entry.keywords.some(k => 
                keywords.some(inputK => 
                    inputK.toLowerCase().includes(k.toLowerCase())
                )
            );
        }).sort((a, b) => b.priority - a.priority);
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
    
    async create(character) {
        const database = await initDB();
        const newCharacter = {
            id: generateId(),
            name: character.name || 'AI',
            avatar: character.avatar || '',
            description: character.description || '',
            personality: character.personality || '',
            system_prompt: character.system_prompt || '',
            created_at: Date.now()
        };
        await database.put('characters', newCharacter);
        return newCharacter;
    },
    
    async update(id, data) {
        const database = await initDB();
        const character = await database.get('characters', id);
        if (character) {
            const updated = { ...character, ...data };
            await database.put('characters', updated);
            return updated;
        }
        return null;
    },
    
    async delete(id) {
        const database = await initDB();
        await database.delete('characters', id);
    }
};

const SettingsDB = {
    async get(key) {
        const database = await initDB();
        const setting = await database.get('settings', key);
        return setting ? setting.value : null;
    },
    
    async set(key, value) {
        const database = await initDB();
        await database.put('settings', { key, value });
    },
    
    async getAll() {
        const database = await initDB();
        const settings = await database.getAll('settings');
        const result = {};
        settings.forEach(s => {
            result[s.key] = s.value;
        });
        return result;
    },
    
    async getDefaults() {
        return {
            api_url: '',
            api_key: '',
            context_size: 4096,
            temperature: 0.7,
            top_p: 1.0,
            frequency_penalty: 0,
            presence_penalty: 0,
            stream_responses: true
        };
    }
};

export { initDB, ChatsDB, MessagesDB, WorldInfoDB, CharactersDB, SettingsDB };