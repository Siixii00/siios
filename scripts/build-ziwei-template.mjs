// 把 ziwei-mcp-server 的排盤引擎（TypeScript）編譯成單一 JS 檔，放進「神秘門」的程式碼範本，
// 讓使用者勾選「紫微斗數」就能產生自己的 MCP Worker。引擎有更動時重跑：node scripts/build-ziwei-template.mjs
// （tests/unit/ziwei-template.test.mjs 會檢查範本是最新的）
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';

const root = new URL('..', import.meta.url);
const require = createRequire(new URL('ziwei-mcp-server/', root));

export function compileEngine() {
    const esbuild = require('esbuild');
    const src = readFileSync(new URL('ziwei-mcp-server/src/lib/ziwei-engine.ts', root), 'utf8');
    return esbuild.transformSync(src, { loader: 'ts', format: 'esm', target: 'es2022' }).code;
}

export function renderTemplate(js) {
    return '// 由 scripts/build-ziwei-template.mjs 產生（來源：ziwei-mcp-server/src/lib/ziwei-engine.ts），請勿手改。\n'
        + '// 紫微斗數排盤引擎：給「神秘門」產生的 MCP Worker 使用（需要 npm 套件 lunar-javascript）。\n'
        + 'export const ZIWEI_ENGINE_JS = ' + JSON.stringify(js) + ';\n';
}

if (process.argv[1] && process.argv[1].endsWith('build-ziwei-template.mjs')) {
    const out = new URL('js/apps/mcp-market/ziwei-engine-template.js', root);
    writeFileSync(out, renderTemplate(compileEngine()));
    console.log('已產生', out.pathname);
}
