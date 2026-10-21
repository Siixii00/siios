// 測試用：把 memory-system/index.js 的 db.js 換成記憶體裡的假資料庫（真正的 db.js 要連瀏覽器的 IndexedDB 與 CDN）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../../', import.meta.url));

export function makeFakeDb() {
    const rows = new Map();
    const MemoryDB = {
        async getAll() { return [...rows.values()]; },
        async getByChatId(chatId) { return [...rows.values()].filter(m => m.chat_id === chatId); },
        async create(data) { const m = { id: 'm' + (rows.size + 1), created_at: Date.now(), timestamp: Date.now(), decayFactor: 1, importance: 0.5, ...data }; rows.set(m.id, m); return m; },
        async update(id, data) { const m = { ...rows.get(id), ...data }; rows.set(id, m); return m; },
        async delete(id) { rows.delete(id); }
    };
    const store = { get: async id => rows.get(id), put: async m => { rows.set(m.id, m); } };
    const initDB = async () => ({ transaction: () => ({ store }) });
    return { rows, MemoryDB, initDB };
}

// 回傳 { MemorySystem, db }；fake 的 db 物件在 globalThis.__fakeMemoryDb 上（讓產生出來的模組取得）
export async function loadMemorySystem(name = 'index') {
    const dir = join(root, 'tests/.gen-memory');
    mkdirSync(dir, { recursive: true });
    const srcDir = join(root, 'js/core/memory-system');
    const toUrl = p => JSON.stringify(pathToFileURL(p).href);
    let src = readFileSync(join(srcDir, 'index.js'), 'utf8').replace(/^﻿/, '');
    src = src
        .replace(/from '\.\/([\w-]+\.js)'/g, (_, f) => `from ${toUrl(join(srcDir, f))}`)
        .replace("from '../embedding/index.js'", `from ${toUrl(join(root, 'js/core/embedding/index.js'))}`)
        .replace(/import \{ MemoryDB, hashContent, cosineSimilarity, initDB \} from '\.\.\/\.\.\/db\.js';/,
            `const { MemoryDB, initDB } = globalThis.__fakeMemoryDb;
const hashContent = s => String(s).length + ':' + String(s).slice(0, 8);
const cosineSimilarity = (a, b) => { let d = 0, x = 0, y = 0; for (let i = 0; i < a.length; i++) { d += a[i] * b[i]; x += a[i] * a[i]; y += b[i] * b[i]; } return d / Math.sqrt(x * y || 1); };`);
    const file = join(dir, `${name}-${process.pid}.mjs`); // 測試檔平行執行，檔名要各自獨立
    writeFileSync(file, src);
    return import(pathToFileURL(file).href + '?t=' + Date.now());
}
