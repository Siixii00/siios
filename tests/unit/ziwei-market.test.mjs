import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { ZIWEI_ENGINE_JS } from '../../js/apps/mcp-market/ziwei-engine-template.js';

const root = fileURLToPath(new URL('../../', import.meta.url));
const haveDeps = existsSync(join(root, 'ziwei-mcp-server/node_modules/lunar-javascript')) && existsSync(join(root, 'ziwei-mcp-server/node_modules/esbuild'));

// code-templates.js 會 import db.js（瀏覽器專用的 IndexedDB），測試時換成一個假的；其餘都是純程式
async function loadTemplates() {
    const dir = join(root, 'ziwei-mcp-server/.gen-test');
    mkdirSync(dir, { recursive: true });
    let src = readFileSync(join(root, 'js/apps/mcp-market/code-templates.js'), 'utf8');
    src = src.replace("import { initDB } from '../../db.js';", 'const initDB = async () => ({ objectStoreNames: { contains: () => false } });')
        .replace("'./tools-catalog.js'", JSON.stringify(pathToFileURL(join(root, 'js/apps/mcp-market/tools-catalog.js')).href))
        .replace("'./ziwei-engine-template.js'", JSON.stringify(pathToFileURL(join(root, 'js/apps/mcp-market/ziwei-engine-template.js')).href));
    const file = join(dir, 'code-templates.mjs');
    writeFileSync(file, src);
    return { dir, mod: await import(pathToFileURL(file).href) };
}

test('範本是最新的：和目前的排盤引擎（TypeScript）編譯結果一致（引擎改了就重跑 node scripts/build-ziwei-template.mjs）', { skip: !haveDeps && '需要 ziwei-mcp-server 的 node_modules' }, async () => {
    const { compileEngine } = await import('../../scripts/build-ziwei-template.mjs');
    assert.equal(ZIWEI_ENGINE_JS, compileEngine());
});

test('神秘門勾選紫微斗數：產生的檔案包含引擎、依賴與 import；沒勾就沒有', async () => {
    const { mod, dir } = await loadTemplates();
    try {
        const files = await mod.generateZipContent(['fortune_ziwei', 'work_wiki']);
        assert.ok(files['src/ziwei-engine.js'].includes('analyzeBirth'));
        assert.match(files['src/index.js'], /import \{ analyzeBirth \} from '\.\/ziwei-engine\.js'/);
        assert.match(files['src/index.js'], /case 'ziwei_analyze_birth':/);
        assert.equal(JSON.parse(files['package.json']).dependencies['lunar-javascript'], '^1.7.7');
        assert.match(files['README.md'], /紫微斗數排盤/);
        const plain = await mod.generateZipContent(['work_wiki']);
        assert.equal('src/ziwei-engine.js' in plain, false);
        assert.equal('dependencies' in JSON.parse(plain['package.json']), false);
        assert.ok(!plain['src/index.js'].includes('ziwei'));
    } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('產生出來的 Worker 真的能跑：要金鑰、列出工具、紫微排盤結果和獨立伺服器一致', { skip: !haveDeps && '需要 ziwei-mcp-server 的 node_modules' }, async () => {
    const { mod, dir } = await loadTemplates();
    try {
        const files = await mod.generateZipContent(['fortune_ziwei']);
        mkdirSync(join(dir, 'src'), { recursive: true });
        for (const [name, content] of Object.entries(files)) if (name.startsWith('src/')) writeFileSync(join(dir, name), content);
        const worker = (await import(pathToFileURL(join(dir, 'src/index.js')).href)).default;
        const env = { MCP_API_KEY: 'k' };
        const call = (path, init = {}, key = 'k') => worker.fetch(new Request('https://w.test' + path, { ...init, headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: 'Bearer ' + key } : {}) } }), env, {});
        assert.equal((await call('/tools', {}, null)).status, 401);
        assert.equal((await call('/tools', {}, 'wrong')).status, 401);
        const tools = await (await call('/tools')).json();
        assert.equal(tools[0].name, 'ziwei_analyze_birth');
        const args = { birth_date: '1990-05-15', birth_time: '14:30', birth_location: '台北市', calendar_type: 'solar', gender: 'female' };
        const res = await call('/tools/call', { method: 'POST', body: JSON.stringify({ name: 'ziwei_analyze_birth', arguments: args }) });
        const body = await res.json();
        assert.equal(body.success, true, JSON.stringify(body).slice(0, 200));
        assert.equal(body.result.chart.twelve_palaces.length, 12);
        // 與目前部署的獨立伺服器（已用 iztro 交叉驗證）同一個命盤：命宮在戌、紫微天相
        const life = body.result.chart.twelve_palaces[0];
        assert.deepEqual([life.name, life.branch, life.stem, life.stars], ['命宮', '戌', '丙', ['紫微', '天相']]);
    } finally { rmSync(dir, { recursive: true, force: true }); }
});
