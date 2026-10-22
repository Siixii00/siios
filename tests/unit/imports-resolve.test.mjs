import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';

const root = resolve(new URL('../../js', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));

const KNOWN_DEAD = new Set();

function walk(dir) {
    return readdirSync(dir).flatMap(n => {
        const p = join(dir, n);
        return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
    });
}

test('js/ 底下所有相對路徑的 import 都指向存在的檔案（路徑寫錯會讓整個 App 載入失敗）', () => {
    const missing = [];
    const re = /(?:^|\n)\s*(?:import|export)\s[^'"\n]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|\n)\s*import\s*['"](\.{1,2}\/[^'"]+)['"]/g;
    for (const file of walk(root)) {
        if (KNOWN_DEAD.has(file.slice(root.length + 1))) continue;
        const src = readFileSync(file, 'utf8');
        for (const m of src.matchAll(re)) {
            const spec = m[1] || m[2];
            if (!existsSync(resolve(dirname(file), spec))) missing.push(`${file.slice(root.length + 1)} → ${spec}`);
        }
    }
    assert.deepEqual(missing, []);
});
