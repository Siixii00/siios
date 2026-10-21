// 產生 sw.js 裡的「離線快取清單」：所有 js/、css/ 底下的檔案。
// 新增或移除檔案後執行：node scripts/update-sw-assets.mjs（tests/unit/sw-assets.test.mjs 會檢查清單是最新的）
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function listAppAssets(root) {
    const out = [];
    const walk = dir => {
        for (const name of readdirSync(join(root, dir)).sort()) {
            const rel = `${dir}/${name}`;
            if (statSync(join(root, rel)).isDirectory()) walk(rel);
            else if (/\.(js|css)$/.test(name)) out.push('/siios/' + rel);
        }
    };
    walk('js'); walk('css');
    return out;
}

export function renderBlock(files) {
    return '// <<app-assets（由 scripts/update-sw-assets.mjs 產生，請勿手改）\nconst APP_ASSETS = [\n' + files.map(f => `  '${f}'`).join(',\n') + '\n];\n// app-assets>>';
}

if (process.argv[1] && process.argv[1].endsWith('update-sw-assets.mjs')) {
    const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    const swPath = join(root, 'sw.js');
    const raw = readFileSync(swPath, 'utf8');
    const crlf = raw.includes('\r\n');
    let s = raw.replace(/\r\n/g, '\n');
    const a = s.indexOf('// <<app-assets'), b = s.indexOf('// app-assets>>');
    const block = renderBlock(listAppAssets(root));
    if (a >= 0 && b > a) s = s.slice(0, a) + block + s.slice(b + '// app-assets>>'.length);
    else s = s.replace('const STATIC_ASSETS = [', block + '\n\nconst STATIC_ASSETS = [');
    writeFileSync(swPath, crlf ? s.replace(/\n/g, '\r\n') : s);
    console.log('已更新', swPath);
}
