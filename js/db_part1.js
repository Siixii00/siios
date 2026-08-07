import { openDB, deleteDB } from 'https://cdn.jsdelivr.net/npm/idb@8/+esm';

const DB_NAME = 'sxios';
const DB_VERSION = 7;
const LEGACY_DB_NAMES = ['ios-classic-ai'];

let db = null;

async function cleanLegacyDatabases() {
    for (const legacyName of LEGACY_DB_NAMES) {
        try {
            await deleteDB(legacyName);
            console.log([DB] 已刪除舊資料庫: );
        } catch (e) {
        }
    }
}

async function initDB() {
    if (db) {
        try {
            const stores = db.objectStoreNames;
            if (!stores.contains('users')) {
                db.close();
                db = null;
            }
        } catch (e) {
            db = null;
        }
    }
    if (db) return db;

    await cleanLegacyDatabases();

    db = await openDB(DB_NAME, DB_VERSION, {
        upgrade(database, oldVersion, newVersion, transaction) {
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
        },
        blocked() {
            if (db) { db.close(); db = null; }
        },
        blocking() {
            if (db) { db.close(); db = null; }
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
