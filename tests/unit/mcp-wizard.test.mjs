import { test } from 'node:test';
import assert from 'node:assert/strict';

const mod = await import('../../js/apps/mcp-market/deploy-helpers.js');
const t = test;

t('generateKey：長度、字元、每次不同', () => {
    const a = mod.generateKey(), b = mod.generateKey();
    assert.equal(a.length, 32); assert.match(a, /^[A-Za-z0-9]+$/); assert.notEqual(a, b);
    assert.doesNotMatch(a, /[0OIl1]/); // 容易看錯的字元不用
});

t('normalizeWorkerUrl：補 https、去掉路徑與結尾斜線，不是網址回 null', () => {
    assert.equal(mod.normalizeWorkerUrl('siios.me.workers.dev'), 'https://siios.me.workers.dev');
    assert.equal(mod.normalizeWorkerUrl('  https://a.b.workers.dev/tools/  '), 'https://a.b.workers.dev');
    assert.equal(mod.normalizeWorkerUrl('http://localhost:8787'), null); // 沒有點的主機名稱不收
    assert.equal(mod.normalizeWorkerUrl(''), null);
    assert.equal(mod.normalizeWorkerUrl('not a url'), null);
});

t('explainConnectError：常見錯誤要告訴使用者去改哪裡', () => {
    assert.match(mod.explainConnectError('HTTP 401'), /金鑰不對/);
    assert.match(mod.explainConnectError('HTTP 503'), /MCP_API_KEY/);
    assert.match(mod.explainConnectError('HTTP 404'), /部署/);
    assert.match(mod.explainConnectError('Failed to fetch'), /連不到/);
    assert.equal(mod.explainConnectError('怪錯誤'), '怪錯誤');
});

t('needsBundle：只有標準 4 個檔案能貼進網頁編輯器', () => {
    assert.equal(mod.needsBundle({ 'src/index.js': 'x', 'wrangler.toml': 'x', 'package.json': 'x', 'README.md': 'x' }), false);
    assert.equal(mod.needsBundle({ 'src/index.js': 'x', 'src/ziwei-engine.js': 'x' }), true);
});
