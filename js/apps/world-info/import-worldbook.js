import Router from '../../router.js';
import { createElement, createIOSNavBar, createToast } from '../../components.js';
import worldbookInstaller from '../../core/worldbook-installer.js';
import { parseWorldbookText } from '../../core/worldbook-parser.js';

const TARGET_LABEL = { global: '全域', keyword: '關鍵字', theater: '劇場' };
const PRIORITY_LABEL = { front: '前置', middle: '中置', back: '後置' };
const FIELD_STYLE = 'width:100%;padding:10px;border:1px solid #ddd;border-radius:8px;box-sizing:border-box;font-size:15px;background:#fff;';

async function renderImportWorldbook() {
    const container = createElement('div', 'app-container bg-ios-bg');
    container.appendChild(createIOSNavBar({ title: '匯入世界書', backPath: '/world-info' }));

    const main = createElement('main', 'flex-1 overflow-y-auto hide-scrollbar pb-24');
    main.style.marginTop = 'calc(44px + env(safe-area-inset-top, 0px))';
    main.style.padding = '16px';
    container.appendChild(main);

    let entries = []; // 已解析、可勾選的條目：{ ...entry, checked }

    main.appendChild(createElement('div', 'text-sm text-ios-muted', {
        textContent: '支援 JSON（SXIOS 世界書、SillyTavern 等 Lorebook、條目陣列）、TXT／Markdown，或直接貼上文字。純文字會依「# 標題」分成多個條目；標題下方第一行寫「關鍵字：甲, 乙」會變成關鍵字觸發條目，沒有標題就整段當一個條目。'
    }));

    // ── 選檔 ──
    const fileInput = createElement('input', '', { type: 'file' });
    fileInput.accept = '.json,.txt,.md,.markdown,text/plain,application/json';
    fileInput.multiple = true;
    fileInput.style.cssText = 'display:none';
    const pickBtn = createElement('button', 'ios-btn', { textContent: '選擇檔案（可多選）' });
    pickBtn.style.cssText = 'margin-top:12px;padding:10px 14px;border-radius:8px;background:#fff;border:1px solid #ddd;font-size:15px;';
    pickBtn.addEventListener('click', () => fileInput.click());
    main.append(fileInput, pickBtn);

    // ── 貼上 ──
    const nameInput = createElement('input', 'ios-input', { type: 'text', placeholder: '條目名稱（選填；貼上的文字沒有標題時使用）' });
    nameInput.style.cssText = FIELD_STYLE + 'margin-top:16px;';
    const pasteArea = createElement('textarea', 'ios-input', { placeholder: '或在這裡貼上世界書內容（JSON 或純文字）' });
    pasteArea.rows = 8;
    pasteArea.style.cssText = FIELD_STYLE + 'margin-top:8px;resize:vertical;';
    const parseBtn = createElement('button', 'ios-btn', { textContent: '解析貼上的內容' });
    parseBtn.style.cssText = 'margin-top:8px;padding:10px 14px;border-radius:8px;background:#fff;border:1px solid #ddd;font-size:15px;';
    main.append(nameInput, pasteArea, parseBtn);

    // ── 預覽與匯入 ──
    const preview = createElement('div', '');
    preview.style.marginTop = '20px';
    main.appendChild(preview);

    function addParsed(text, fileName) {
        const r = parseWorldbookText(text, { fileName });
        r.entries.forEach(e => entries.push({ ...e, checked: true, source: fileName || '貼上' }));
        return r;
    }

    function renderPreview(messages = []) {
        preview.innerHTML = '';
        messages.forEach(m => preview.appendChild(createElement('div', 'text-sm', { textContent: m, style: 'color:#b45309;margin-bottom:6px;' })));
        if (!entries.length) return;

        const head = createElement('div', 'text-base font-semibold', { textContent: `找到 ${entries.length} 個條目` });
        preview.appendChild(head);

        const placeSel = createElement('select', 'ios-input');
        [['auto', '放置位置：依內容自動判斷'], ['global', '全部放到：全域設定'], ['keyword', '全部放到：關鍵字設定'], ['theater', '全部放到：劇場設定']]
            .forEach(([v, l]) => placeSel.appendChild(createElement('option', '', { value: v, textContent: l })));
        placeSel.style.cssText = FIELD_STYLE + 'margin-top:8px;';
        const dupSel = createElement('select', 'ios-input');
        [['skip', '遇到同名條目：略過'], ['overwrite', '遇到同名條目：覆蓋']].forEach(([v, l]) => dupSel.appendChild(createElement('option', '', { value: v, textContent: l })));
        dupSel.style.cssText = FIELD_STYLE + 'margin-top:8px;';
        preview.append(placeSel, dupSel);

        const list = createElement('div', 'ios-grouped-list');
        list.style.marginTop = '12px';
        const refreshTags = [];
        entries.forEach(e => {
            const cell = createElement('label', 'ios-list-cell ios-list-cell-full');
            cell.style.cssText = 'display:flex;gap:10px;align-items:flex-start;padding:10px 12px;';
            const cb = createElement('input', '', { type: 'checkbox' });
            cb.checked = e.checked;
            cb.addEventListener('change', () => { e.checked = cb.checked; updateButton(); });
            const body = createElement('div', 'flex-1');
            body.style.minWidth = '0';
            body.appendChild(createElement('div', 'text-base font-semibold', { textContent: e.name }));
            const tag = createElement('div', 'text-xs text-ios-muted');
            refreshTags.push(() => {
                const t = placeSel.value === 'auto' ? e.target : placeSel.value;
                const kw = t === 'keyword' && e.keywords.length ? ` · 關鍵字：${e.keywords.slice(0, 6).join('、')}${e.keywords.length > 6 ? '…' : ''}` : '';
                tag.textContent = `${TARGET_LABEL[t]} · ${PRIORITY_LABEL[e.priority]}${kw} · ${e.content.length} 字${e.enabled ? '' : ' · 停用'} · 來源：${e.source}`;
            });
            body.appendChild(tag);
            body.appendChild(createElement('div', 'text-sm text-ios-muted', { textContent: e.content.slice(0, 60).replace(/\s+/g, ' ') + (e.content.length > 60 ? '…' : ''), style: 'overflow:hidden;white-space:nowrap;text-overflow:ellipsis;' }));
            cell.append(cb, body);
            list.appendChild(cell);
        });
        preview.appendChild(list);
        placeSel.addEventListener('change', () => refreshTags.forEach(f => f()));
        refreshTags.forEach(f => f());

        const importBtn = createElement('button', 'px-4 py-2 rounded-lg bg-kakao-yellow text-kakao-brown font-medium');
        importBtn.style.cssText = 'margin-top:16px;width:100%;padding:12px;font-size:16px;';
        const clearBtn = createElement('button', 'ios-btn', { textContent: '清除全部重來' });
        clearBtn.style.cssText = 'margin-top:8px;width:100%;padding:10px;color:#666;';
        function updateButton() {
            const n = entries.filter(e => e.checked).length;
            importBtn.textContent = `匯入選取的 ${n} 個條目`;
            importBtn.disabled = n === 0;
        }
        updateButton();
        clearBtn.addEventListener('click', () => { entries = []; renderPreview(); });
        importBtn.addEventListener('click', async () => {
            importBtn.disabled = true;
            try {
                const chosen = entries.filter(e => e.checked).map(e => (placeSel.value === 'auto' ? e : { ...e, target: placeSel.value }));
                const r = await worldbookInstaller.importEntries(chosen, dupSel.value);
                createToast(`匯入完成：新增 ${r.created}、覆蓋 ${r.overwritten}、略過 ${r.skipped}`);
                entries = [];
                pasteArea.value = '';
                renderPreview([`上次匯入：新增 ${r.created}、覆蓋 ${r.overwritten}、略過重複 ${r.skipped}。可以到「全局設定／關鍵字設定／劇場設定」查看。`]);
            } catch (err) {
                createToast('匯入失敗：' + err.message);
                importBtn.disabled = false;
            }
        });
        preview.append(importBtn, clearBtn);
    }

    fileInput.addEventListener('change', async () => {
        const messages = [];
        for (const file of Array.from(fileInput.files || [])) {
            try {
                const r = addParsed(await file.text(), file.name);
                r.warnings.forEach(w => messages.push(`${file.name}：${w}`));
            } catch (e) {
                messages.push(`${file.name}：讀取失敗（${e.message}）`);
            }
        }
        fileInput.value = '';
        renderPreview(messages);
    });

    parseBtn.addEventListener('click', () => {
        const r = addParsed(pasteArea.value, nameInput.value.trim());
        renderPreview(r.warnings);
    });

    return { element: container, cleanup: null };
}

export default {
    id: 'import-worldbook',
    name: 'Import Worldbook',
    icon: 'upload_file',
    routes: [{ path: '/import-worldbook', render: renderImportWorldbook }]
};
