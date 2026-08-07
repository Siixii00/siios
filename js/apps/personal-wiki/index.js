import Router from '../../router.js';
import { createElement } from '../../components.js';
import { SettingsDB, WikiRecordsDB, ZiweiCacheDB, CharactersDB } from '../../db.js';
import { compressImage } from '../../utils/image.js';
import { escapeHtml, stripHtml, debounce } from '../../utils/html.js';
import { migrateFromSettingsDB } from './migration.js';
import { runFullSync, incrementalSync } from './sync-engine.js';
import { parseLinks, getBacklinks, renderLinksInContent, showLinkPicker, updateLinks, setRecordsCache } from './link-system.js';
import { createBlock, createNotePage, createTopicPage } from './templates.js';
import { HistoryManager } from './history-manager.js';

const BLOCK_TYPES = [
  { type: 'text', label: 'Text', icon: 'T', desc: 'Plain text' },
  { type: 'heading1', label: 'Heading 1', icon: 'H1', desc: 'Large heading' },
  { type: 'heading2', label: 'Heading 2', icon: 'H2', desc: 'Medium heading' },
  { type: 'heading3', label: 'Heading 3', icon: 'H3', desc: 'Small heading' },
  { type: 'bulleted-list', label: 'Bulleted List', icon: '‧', desc: 'Bullet point' },
  { type: 'numbered-list', label: 'Numbered List', icon: '1.', desc: 'Numbered item' },
  { type: 'todo', label: 'To-do', icon: '?', desc: 'Checkbox item' },
  { type: 'divider', label: 'Divider', icon: '—', desc: 'Horizontal rule' },
  { type: 'quote', label: 'Quote', icon: '?', desc: 'Quote block' },
  { type: 'image', label: 'Image', icon: '??', desc: 'Image block' },
  { type: 'page-link', label: 'Page Link', icon: '??', desc: 'Linked page' }
];

const PAGE_ICONS = ['??', '??', '??', '??', '??', '??', '??', '??', '??', '??', '?', '??', '??', '??', '??', '??'];

const CONFIDENCE_LABELS = {
  EXTRACTED: { label: '提取', color: '#4caf50' },
  INFERRED: { label: '推斷', color: '#2196f3' },
  AMBIGUOUS: { label: '模糊', color: '#ff9800' },
  UNVERIFIED: { label: '未驗證', color: '#9e9e9e' }
};

let records = [];
let recentPages = [];
let activePageId = null;
let slashMenuState = { open: false, blockId: null, filter: '', index: 0 };
let docListeners = [];
let notionConfig = { token: '', databaseId: '', mcpUrl: '' };
let isSyncing = false;
let historyManager = new HistoryManager(50);

let pendingSaveId = null;
let pendingSaveTimer = null;

const debouncedSaveRecord = (recordId) => {
    if (pendingSaveTimer) clearTimeout(pendingSaveTimer);
    pendingSaveId = recordId;
    pendingSaveTimer = setTimeout(async () => {
        if (pendingSaveId) {
            const record = records.find(r => r.id === pendingSaveId);
            if (record) await WikiRecordsDB.update(pendingSaveId, record);
            pendingSaveId = null;
        }
    }, 300);
};

function cancelPendingSave() {
    if (pendingSaveTimer) {
        clearTimeout(pendingSaveTimer);
        pendingSaveTimer = null;
        pendingSaveId = null;
    }
}

async function loadData() {
    await migrateFromSettingsDB();

    const allRecords = await WikiRecordsDB.getAll();
    records = allRecords;
    setRecordsCache(records);

    const r = await SettingsDB.get('wiki_recent_pages');
    recentPages = r || [];

    const nc = await SettingsDB.get('wiki_notion_config');
    notionConfig = nc || { token: '', databaseId: '', mcpUrl: '' };
}

async function saveRecent() { await SettingsDB.set('wiki_recent_pages', recentPages); }

function generateId(prefix = 'wiki') {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5);
}

function getRecord(id) { return records.find(r => r.id === id); }

function getRecordsByType(type) {
    return records.filter(r => r.page_type === type).sort((a, b) => (a.updated_at || 0) - (b.updated_at || 0));
}

function getRecordsByCharacter(charId) {
    return records.filter(r => r.character_id === charId).sort((a, b) => {
        if (r.page_type === 'character') return -1;
        if (r.page_type === 'chat-log') return (a.chat_log_index || 0) - (b.chat_log_index || 0);
        return 0;
    });
}

function getBreadcrumbs(recordId) {
    const crumbs = [];
    const visited = new Set();
    let current = getRecord(recordId);
    while (current) {
        if (visited.has(current.id)) break;
        visited.add(current.id);
        crumbs.unshift(current);
        current = current.parent_id ? getRecord(current.parent_id) : null;
    }
    return crumbs;
}

function addRecentPage(pageId) {
    recentPages = recentPages.filter(id => id !== pageId);
    recentPages.unshift(pageId);
    if (recentPages.length > 10) recentPages = recentPages.slice(0, 10);
    saveRecent();
}

function createPage(pageType = 'note', title = 'Untitled') {
    const template = pageType === 'topic' ? createTopicPage(title) : createNotePage(title);
    const record = {
        ...template,
        id: generateId('page'),
        created_at: Date.now(),
        updated_at: Date.now()
    };
    records.push(record);
    WikiRecordsDB.create(record);
    return record;
}

async function deletePage(recordId) {
    const childIds = records.filter(r => r.parent_id === recordId).map(r => r.id);
    for (const id of childIds) await deletePage(id);
    records = records.filter(r => r.id !== recordId);
    recentPages = recentPages.filter(id => id !== recordId);
    if (activePageId === recordId) activePageId = null;
    await WikiRecordsDB.delete(recordId);
    await saveRecent();
}

function duplicatePage(recordId) {
    const source = getRecord(recordId);
    if (!source) return;
    const newRecord = {
        ...JSON.parse(JSON.stringify(source)),
        id: generateId('page'),
        title: source.title + ' (copy)',
        source_type: 'manual',
        parent_id: source.parent_id,
        created_at: Date.now(),
        updated_at: Date.now()
    };
    newRecord.blocks = newRecord.blocks.map(b => ({ ...b, id: generateId('blk'), confidence: null }));
    records.push(newRecord);
    WikiRecordsDB.create(newRecord);
    return newRecord;
}

function addDocListener(event, handler) {
    document.addEventListener(event, handler);
    docListeners.push({ event, handler });
}

function cleanup() {
    docListeners.forEach(({ event, handler }) => document.removeEventListener(event, handler));
    docListeners = [];
}

function uploadCoverImage(record, container) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        record.cover_image = await compressImage(file);
        record.updated_at = Date.now();
        await WikiRecordsDB.update(record.id, { cover_image: record.cover_image });
        renderEditor(container);
    };
    input.click();
}

function renderSidebar(container) {
    const sidebar = container.querySelector('.wiki-sidebar');
    if (!sidebar) return;

    const charRecords = getRecordsByType('character');
    const topicRecords = getRecordsByType('topic');
    const noteRecords = getRecordsByType('note');

    function renderCharGroup(charRecord) {
        const children = getRecordsByCharacter(charRecord.character_id).filter(r => r.id !== charRecord.id);
        const isActive = charRecord.id === activePageId;
        const collapsed = charRecord._collapsed;

        return `
            <div class='wiki-page-item${isActive ? ' active' : ''}' data-page-id='${charRecord.id}' style='padding-left:20px'>
                ${children.length > 0 ? `<span class='wiki-page-toggle' data-toggle='${charRecord.id}'>${collapsed ? '?' : '▼'}</span>` : '<span style='width:18px'></span>'}
                <span class='wiki-page-icon'>${charRecord.icon || '??'}</span>
                <span class='wiki-page-name'>${escapeHtml(charRecord.title || 'Untitled')}</span>
            </div>
            ${!collapsed ? children.map(child => {
                const childActive = child.id === activePageId;
                return `
                    <div class='wiki-page-item${childActive ? ' active' : ''} child' data-page-id='${child.id}' style='padding-left:40px'>
                        <span style='width:18px'></span>
                        <span class='wiki-page-icon'>${child.icon || '??'}</span>
                        <span class='wiki-page-name'>${escapeHtml(child.title || 'Untitled')}</span>
                    </div>
                `;
            }).join('') : ''}
        `;
    }

    const listEl = sidebar.querySelector('.wiki-page-list');
    if (listEl) {
        listEl.innerHTML = `
            ${charRecords.length > 0 ? `
                <div class='wiki-sidebar-section'>
                    <div class='wiki-sidebar-section-header'>?? 角色檔案</div>
                    ${charRecords.map(renderCharGroup).join('')}
                </div>
            ` : ''}
            ${topicRecords.length > 0 ? `
                <div class='wiki-sidebar-section'>
                    <div class='wiki-sidebar-section-header'>?? 主題</div>
                    ${topicRecords.map(r => `
                        <div class='wiki-page-item${r.id === activePageId ? ' active' : ''}' data-page-id='${r.id}' style='padding-left:20px'>
                            <span style='width:18px'></span>
                            <span class='wiki-page-icon'>${r.icon || '??'}</span>
                            <span class='wiki-page-name'>${escapeHtml(r.title || 'Untitled')}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            ${noteRecords.length > 0 ? `
                <div class='wiki-sidebar-section'>
                    <div class='wiki-sidebar-section-header'>?? 筆記</div>
                    ${noteRecords.map(r => `
                        <div class='wiki-page-item${r.id === activePageId ? ' active' : ''}' data-page-id='${r.id}' style='padding-left:20px'>
                            <span style='width:18px'></span>
                            <span class='wiki-page-icon'>${r.icon || '??'}</span>
                            <span class='wiki-page-name'>${escapeHtml(r.title || 'Untitled')}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
            ${records.length === 0 ? '<div style='padding:24px;text-align:center;color:var(--nt-ink-faint);font-size:13px'>尚無頁面<br>點擊同步或新增</div>' : ''}
        `;

        listEl.querySelectorAll('.wiki-page-item').forEach(item => {
            item.onclick = (e) => {
                if (e.target.classList.contains('wiki-page-toggle')) return;
                navigateToPage(container, item.dataset.pageId);
            };
            item.oncontextmenu = (e) => {
                e.preventDefault();
                showContextMenu(container, item.dataset.pageId, e.clientX, e.clientY);
            };
        });

        listEl.querySelectorAll('.wiki-page-toggle').forEach(toggle => {
            toggle.onclick = (e) => {
                e.stopPropagation();
                const recordId = toggle.dataset.toggle;
                const record = getRecord(recordId);
                if (record) {
                    record._collapsed = !record._collapsed;
                    toggle.textContent = record._collapsed ? '?' : '▼';
                    renderSidebar(container);
                }
            };
        });
    }
}

function renderEditor(container) {
    cancelPendingSave();
    const editorArea = container.querySelector('.wiki-editor-area');
    if (!editorArea) return;

    const record = getRecord(activePageId);
    if (!record) {
        editorArea.innerHTML = "`<div class=`"`wiki-editor-empty`"`>選擇或建立一個頁面</div>`";
        return;
    }

    const breadcrumbs = getBreadcrumbs(activePageId);

    editorArea.innerHTML = `
        <div class='wiki-breadcrumb'>
            ${breadcrumbs.map((b, i) => `
                <span class='wiki-breadcrumb-item${i === breadcrumbs.length - 1 ? ' wiki-breadcrumb-current' : ''}' data-nav-page='${b.id}'>${b.icon || '??'} ${escapeHtml(b.title || 'Untitled')}</span>
                ${i < breadcrumbs.length - 1 ? '<span class='wiki-breadcrumb-sep'>/</span>' : ''}
            `).join('')}
        </div>
        ${record.cover_image
            ? `<img class='wiki-cover' src='${escapeHtml(record.cover_image)}' alt=''>`
            : `<div class='wiki-cover-placeholder' data-action='add-cover'>+ Add cover</div>`
        }
        <div class='wiki-page-header'>
            <div class='wiki-page-icon-title'>
                <span class='wiki-page-emoji' data-action='change-icon'>${record.icon || '??'}</span>
                <input class='wiki-page-title-input' value='${escapeHtml(record.title)}' placeholder='Untitled' data-field='title'>
            </div>
            ${record.source_type === 'auto' ? `<div class='wiki-page-meta'>自動生成 · ${record.page_type}</div>` : ''}
        </div>
        <div class='wiki-blocks' data-page-id='${record.id}'>
            ${renderBlocks(record.blocks, record.id)}
        </div>
        <div class='wiki-ziwei-area' data-page-id='${record.id}'></div>
        <div class='wiki-backlinks-area' data-page-id='${record.id}'></div>
    `;

    setupUndoRedoShortcuts(container);

    const titleInput = editorArea.querySelector('.wiki-page-title-input');
    titleInput.oninput = debounce(async () => {
        record.title = titleInput.value;
        record.updated_at = Date.now();
        await debouncedSaveRecord(record.id);
        renderSidebar(container);
    }, 200);

    editorArea.querySelectorAll('[data-nav-page]').forEach(el => {
        el.onclick = () => navigateToPage(container, el.dataset.navPage);
    });

    const coverAction = editorArea.querySelector('[data-action='add-cover']');
    if (coverAction) coverAction.onclick = () => uploadCoverImage(record, container);

    const coverImg = editorArea.querySelector('.wiki-cover');
    if (coverImg) coverImg.onclick = () => uploadCoverImage(record, container);

    const emojiBtn = editorArea.querySelector('[data-action='change-icon']');
    if (emojiBtn) {
        emojiBtn.onclick = async () => {
            const current = record.icon || '??';
            const idx = PAGE_ICONS.indexOf(current);
            record.icon = PAGE_ICONS[(idx + 1) % PAGE_ICONS.length];
            record.updated_at = Date.now();
            await WikiRecordsDB.update(record.id, { icon: record.icon });
            renderEditor(container);
            renderSidebar(container);
        };
    }

    bindBlockEvents(container, record);
    loadBacklinks(container, record.id);
    loadZiweiFortune(container, record.id);
    
    requestAnimationFrame(() => {
        updateAllNumberedLists();
    });
}

function renderBlocks(blocks, recordId) {
    return blocks.map((block, idx) => {
        const handle = `<span class='wiki-block-handle' data-drag='${block.id}'>??</span>`;
        const confidenceTag = block.confidence && CONFIDENCE_LABELS[block.confidence]
            ? `<span class='wiki-confidence-tag' data-confidence='${block.confidence}' style='background:${CONFIDENCE_LABELS[block.confidence].color}20;color:${CONFIDENCE_LABELS[block.confidence].color}'>${CONFIDENCE_LABELS[block.confidence].label}</span>`
            : '';

        if (block.type === 'divider') {
            return `<div class='wiki-block' data-block-id='${block.id}' data-block-type='divider'>${handle}<div class='wiki-block-content' data-type='divider'></div>${confidenceTag}</div>`;
        }

        if (block.type === 'todo') {
            return `<div class='wiki-block' data-block-id='${block.id}' data-block-type='todo'>${handle}
                <div class='wiki-block-content' data-type='todo'>
                    <div class='wiki-todo-checkbox${block.checked ? ' checked' : ''}' data-check='${block.id}'></div>
                    <div class='wiki-todo-text${block.checked ? ' checked' : ''}' contenteditable='true' data-block-id='${block.id}' data-placeholder='To-do'>${block.content || ''}</div>
                </div>
                ${confidenceTag}
            </div>`;
        }

        if (block.type === 'image') {
            const imgSrc = block.metadata.src || '';
            return `<div class='wiki-block' data-block-id='${block.id}' data-block-type='image'>${handle}
                <div class='wiki-block-content' data-type='image'>
                    ${imgSrc ? `<img src='${escapeHtml(imgSrc)}' alt=''>` : '<div style='padding:12px;color:var(--nt-ink-faint);cursor:pointer' data-action='upload-image'>Click to upload image</div>'}
                </div>
                ${confidenceTag}
            </div>`;
        }

        if (block.type === 'page-link') {
            const linkedRecord = getRecord(block.metadata.pageId);
            const linkText = linkedRecord ? `${linkedRecord.icon || '??'} ${escapeHtml(linkedRecord.title || 'Untitled')}` : 'Select page';
            return `<div class='wiki-block' data-block-id='${block.id}' data-block-type='page-link'>${handle}
                <div class='wiki-block-content' data-type='page-link' data-link-page='${escapeHtml(block.metadata.pageId || '')}'>${linkText}</div>
                ${confidenceTag}
            </div>`;
        }

        const placeholder = block.type === 'heading1' ? 'Heading 1'
            : block.type === 'heading2' ? 'Heading 2'
            : block.type === 'heading3' ? 'Heading 3'
            : block.type === 'quote' ? 'Quote'
            : block.type === 'bulleted-list' ? 'List'
            : block.type === 'numbered-list' ? 'List'
            : 'Type / for commands...';

        const renderedContent = renderLinksInContent(block.content || '');

        return `<div class='wiki-block' data-block-id='${block.id}' data-block-type='${block.type}'>${handle}
            <div class='wiki-block-content' contenteditable='true' data-type='${block.type}' data-block-id='${block.id}' data-placeholder='${placeholder}'>${renderedContent}</div>
            ${confidenceTag}
        </div>`;
    }).join('');
}

function isBlockEmpty(el) {
    const text = (el.textContent || '').trim();
    if (text !== '') return false;
    const html = el.innerHTML;
    return html === '' || html === '<br>' || html === '<div><br></div>';
}

function bindBlockEvents(container, record) {
    const blocksEl = container.querySelector('.wiki-blocks');
    if (!blocksEl) return;

    blocksEl.querySelectorAll('[contenteditable]').forEach(el => {
        el.oninput = () => {
            const blockId = el.dataset.blockId;
            const block = record.blocks.find(b => b.id === blockId);
            if (block) {
                block.content = el.innerHTML;
                record.updated_at = Date.now();
                debouncedSaveRecord(record.id);
            }
        };

        el.onkeydown = (e) => {
            const blockId = el.dataset.blockId;
            const block = record.blocks.find(b => b.id === blockId);
            if (!block) return;

            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const newBlock = createBlock('text', '');
                const idx = record.blocks.findIndex(b => b.id === blockId);
                record.blocks.splice(idx + 1, 0, newBlock);
                record.updated_at = Date.now();
                WikiRecordsDB.update(record.id, { blocks: record.blocks });
                renderEditor(container);
                requestAnimationFrame(() => {
                    const newEl = blocksEl.querySelector(`[data-block-id='${newBlock.id}']`);
                    if (newEl) newEl.focus();
                });
            }

            if (e.key === 'Backspace' && isBlockEmpty(el) && record.blocks.length > 1) {
                e.preventDefault();
                const idx = record.blocks.findIndex(b => b.id === blockId);
                record.blocks.splice(idx, 1);
                record.updated_at = Date.now();
                WikiRecordsDB.update(record.id, { blocks: record.blocks });
                renderEditor(container);
                requestAnimationFrame(() => {
                    const prevIdx = Math.max(0, idx - 1);
                    const prevBlock = record.blocks[prevIdx];
                    if (prevBlock) {
                        const prevEl = blocksEl.querySelector(`[data-block-id='${prevBlock.id}']`);
                        if (prevEl) prevEl.focus();
                    }
                });
            }

            if (e.key === '/' && isBlockEmpty(el)) {
                e.preventDefault();
                showSlashMenu(container, blockId, el);
            }

            if (e.key === '[' && el.textContent.endsWith('[')) {
                const text = el.textContent;
                if (text.endsWith('[[')) {
                    e.preventDefault();
                    const beforeBrackets = el.textContent.slice(0, -2);
                    el.textContent = beforeBrackets;
                    showLinkPicker(container, el, (title) => {
                        const linkText = `[[${title}]]`;
                        const currentContent = el.textContent || '';
                        el.textContent = currentContent + linkText;
                        block.content = el.innerHTML;
                        record.updated_at = Date.now();
                        debouncedSaveRecord(record.id);
                        updateLinks(record.id);
                    });
                }
            }
        };

        el.onfocus = () => {
            const blockId = el.dataset.blockId;
            const block = record.blocks.find(b => b.id === blockId);
            if (block && block.type === 'numbered-list') {
                updateNumberedListNumbers(record, blocksEl);
            }
        };
    });

    blocksEl.querySelectorAll('[data-check]').forEach(el => {
        el.onclick = async () => {
            const blockId = el.dataset.check;
            const block = record.blocks.find(b => b.id === blockId);
            if (block) {
                block.checked = !block.checked;
                record.updated_at = Date.now();
                await WikiRecordsDB.update(record.id, { blocks: record.blocks });
                renderEditor(container);
            }
        };
    });

    blocksEl.querySelectorAll('[data-action='upload-image']').forEach(el => {
        el.onclick = async () => {
            const blockId = el.closest('.wiki-block').dataset.blockId;
            const block = record.blocks.find(b => b.id === blockId);
            if (!block) return;
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = async (e) => {
                const file = e.target.files[0];
                if (!file) return;
                const result = await compressImage(file);
                if (result) {
                    block.metadata.src = result;
                    record.updated_at = Date.now();
                    await WikiRecordsDB.update(record.id, { blocks: record.blocks });
                    renderEditor(container);
                }
            };
            input.click();
        };
    });

    blocksEl.querySelectorAll('[data-type='page-link']').forEach(el => {
        el.onclick = () => {
            const linkedPageId = el.dataset.linkPage;
            if (linkedPageId) navigateToPage(container, linkedPageId);
        };
    });

    blocksEl.querySelectorAll('.wiki-bilink').forEach(el => {
        el.onclick = (e) => {
            e.stopPropagation();
            const title = el.dataset.linkTitle;
            if (!title) return;
            const target = records.find(r => r.title === title) ||
                           records.find(r => r.title && r.title.toLowerCase() === title.toLowerCase());
            if (target) {
                navigateToPage(container, target.id);
            }
        };
    });

    blocksEl.querySelectorAll('[data-drag]').forEach(handle => {
        handle.onmousedown = (e) => {
            e.preventDefault();
            const blockEl = handle.closest('.wiki-block');
            const blockId = blockEl.dataset.blockId;
            startDrag(container, record, blockId, e);
        };
    });

    blocksEl.onclick = (e) => {
        if (e.target === blocksEl || e.target.classList.contains('wiki-bilink')) return;
        if (e.target !== blocksEl) return;
        const lastBlock = record.blocks[record.blocks.length - 1];
        if (lastBlock && isBlockEmpty(blocksEl.querySelector(`[data-block-id='${lastBlock.id}']`))) {
            const el = blocksEl.querySelector(`[data-block-id='${lastBlock.id}']`);
            if (el) el.focus();
        } else {
            const newBlock = createBlock('text', '');
            record.blocks.push(newBlock);
            record.updated_at = Date.now();
            WikiRecordsDB.update(record.id, { blocks: record.blocks });
            renderEditor(container);
            requestAnimationFrame(() => {
                const el = blocksEl.querySelector(`[data-block-id='${newBlock.id}']`);
                if (el) el.focus();
            });
        }
    };
}

async function loadBacklinks(container, recordId) {
    const area = container.querySelector('.wiki-backlinks-area');
    if (!area) return;

    const backlinks = await getBacklinks(recordId);
    if (backlinks.length === 0) {
        area.innerHTML = '';
        return;
    }

    area.innerHTML = `
        <div class='wiki-section-card'>
            <div class='wiki-section-header collapsed' data-toggle>
                <div class='wiki-section-title'>?? 反向連結 (${backlinks.length})</div>
                <div class='wiki-section-toggle'>▼</div>
            </div>
            <div class='wiki-section-content collapsed'>
                <div class='wiki-backlinks-list'>
                    ${backlinks.map(r => `
                        <div class='wiki-backlink-item' data-nav-page='${r.id}'>
                            <span class='wiki-backlink-icon'>${r.icon || '??'}</span>
                            <span class='wiki-backlink-text'>${escapeHtml(r.title || 'Untitled')}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    area.querySelectorAll('[data-nav-page]').forEach(el => {
        el.onclick = () => navigateToPage(container, el.dataset.navPage);
    });
    
    bindSectionToggle(area);
}

async function loadZiweiFortune(container, recordId) {
    const area = container.querySelector('.wiki-ziwei-area');
    if (!area) return;

    const record = getRecord(recordId);
    if (!record || record.page_type !== 'character' || !record.character_id) {
        area.innerHTML = '';
        return;
    }

    try {
        const character = await CharactersDB.getById(record.character_id);
        if (!character || !character.birth_date || !character.birth_time || !character.gender) {
            area.innerHTML = `
                <div class='wiki-section-card'>
                    <div class='wiki-section-header collapsed' data-toggle>
                        <div class='wiki-section-title'>?? 命理分析</div>
                        <div class='wiki-section-toggle'>▼</div>
                    </div>
                    <div class='wiki-section-content collapsed'>
                        <div class='wiki-ziwei-empty'>
                            <p>尚未設定完整的出生資訊</p>
                            <p class='wiki-ziwei-hint'>請在角色設定中補充出生日期、時間與性別</p>
                        </div>
                    </div>
                </div>
            `;
            bindSectionToggle(area);
            return;
        }

        const today = new Date().toISOString().split('T')[0];
        const cache = await ZiweiCacheDB.getByDate(record.character_id, today);

        if (!cache) {
            area.innerHTML = `
                <div class='wiki-section-card'>
                    <div class='wiki-section-header collapsed' data-toggle>
                        <div class='wiki-section-title'>?? 命理分析</div>
                        <div class='wiki-section-toggle'>▼</div>
                    </div>
                    <div class='wiki-section-content collapsed'>
                        <div class='wiki-ziwei-loading'>載入中...</div>
                    </div>
                </div>
            `;
            bindSectionToggle(area);
            return;
        }

        if (cache.is_stale) {
            area.innerHTML = `
                <div class='wiki-section-card'>
                    <div class='wiki-section-header collapsed' data-toggle>
                        <div class='wiki-section-title'>?? 命理分析</div>
                        <div class='wiki-section-toggle'>▼</div>
                    </div>
                    <div class='wiki-section-content collapsed'>
                        <div class='wiki-warning-banner'>?? 資料可能過期（無法連線至分析服務）</div>
                        ${renderZiweiCards(cache)}
                    </div>
                </div>
            `;
            bindSectionToggle(area);
            return;
        }

        area.innerHTML = `
            <div class='wiki-section-card'>
                <div class='wiki-section-header collapsed' data-toggle>
                    <div class='wiki-section-title'>?? 命理分析</div>
                    <div class='wiki-section-toggle'>▼</div>
                </div>
                <div class='wiki-section-content collapsed'>
                    ${renderZiweiCards(cache)}
                </div>
            </div>
        `;
        bindSectionToggle(area);
    } catch (error) {
        console.error('[Wiki] Ziwei load error:', error);
        area.innerHTML = '';
    }
}

function renderZiweiCards(cache) {
    const summary = typeof cache.fortune_summary === 'string' 
        ? { daily: cache.fortune_summary }
        : cache.fortune_summary || {};
    
    return `
        <div class='wiki-ziwei-cards'>
            <div class='wiki-ziwei-card'>
                <div class='wiki-ziwei-card-title'>流年運勢</div>
                ${cache.liu_nian_temple ? `<div class='wiki-ziwei-card-temple'>命宮：${escapeHtml(cache.liu_nian_temple)}</div>` : ''}
                ${summary.yearly ? `<div class='wiki-ziwei-card-summary'>${escapeHtml(summary.yearly)}</div>` : ''}
            </div>
            <div class='wiki-ziwei-card'>
                <div class='wiki-ziwei-card-title'>流月運勢</div>
                ${cache.liu_yue_temple ? `<div class='wiki-ziwei-card-temple'>命宮：${escapeHtml(cache.liu_yue_temple)}</div>` : ''}
                ${summary.monthly ? `<div class='wiki-ziwei-card-summary'>${escapeHtml(summary.monthly)}</div>` : ''}
            </div>
            <div class='wiki-ziwei-card'>
                <div class='wiki-ziwei-card-title'>流日運勢</div>
                ${cache.liu_ri_temple ? `<div class='wiki-ziwei-card-temple'>命宮：${escapeHtml(cache.liu_ri_temple)}</div>` : ''}
                ${summary.daily ? `<div class='wiki-ziwei-card-summary'>${escapeHtml(summary.daily)}</div>` : ''}
                ${cache.events && cache.events.length > 0 ? `
                    <div class='wiki-ziwei-events'>
                        ${cache.events.filter(e => e.confidence > 0.7).slice(0, 3).map(event => `
                            <div class='wiki-ziwei-event'>${escapeHtml(event.description)} (${Math.round(event.confidence * 100)}%)</div>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

function bindSectionToggle(area) {
    const header = area.querySelector('.wiki-section-header');
    const content = area.querySelector('.wiki-section-content');
    if (!header || !content) return;
    
    header.onclick = () => {
        header.classList.toggle('collapsed');
        content.classList.toggle('collapsed');
    };
}

function updateNumberedListNumbers(record, blocksEl) {
    let counter = 1;
    record.blocks.forEach((block, index) => {
        if (block.type === 'numbered-list') {
            const el = blocksEl.querySelector(`[data-block-id='${block.id}']`);
            if (el) {
                el.style.counterReset = 'none';
                el.dataset.number = counter;
                
                const contentEl = el.querySelector('.wiki-block-content');
                if (contentEl) {
                    contentEl.setAttribute('data-number', counter);
                }
            }
            counter++;
        } else {
            counter = 1;
        }
    });
}

function updateAllNumberedLists() {
    const blocksEl = document.querySelector('.wiki-blocks');
    const record = getRecord(activePageId);
    
    if (blocksEl && record) {
        updateNumberedListNumbers(record, blocksEl);
    }
}

function showSlashMenu(container, blockId, triggerEl) {
    closeSlashMenu(container);

    const rect = triggerEl.getBoundingClientRect();
    const menu = createElement('div', 'wiki-slash-menu');
    menu.style.top = (rect.bottom + 4) + 'px';
    menu.style.left = rect.left + 'px';

    slashMenuState = { open: true, blockId, filter: '', index: 0 };

    function renderMenuItems(filter = '') {
        const filtered = BLOCK_TYPES.filter(bt =>
            bt.label.toLowerCase().includes(filter.toLowerCase()) ||
            bt.type.toLowerCase().includes(filter.toLowerCase())
        );

        menu.innerHTML = `
            <div class='wiki-slash-search'>
                <input type='text' placeholder='Search blocks...' value='${escapeHtml(filter)}' autofocus>
            </div>
            ${filtered.map((bt, i) => `
                <div class='wiki-slash-item${i === slashMenuState.index ? ' active' : ''}' data-block-type='${bt.type}'>
                    <span class='wiki-slash-item-icon'>${bt.icon}</span>
                    <span class='wiki-slash-item-label'>${bt.label}</span>
                    <span class='wiki-slash-item-desc'>${bt.desc}</span>
                </div>
            `).join('')}
        `;

        const searchInput = menu.querySelector('input');
        searchInput.oninput = () => {
            slashMenuState.filter = searchInput.value;
            slashMenuState.index = 0;
            renderMenuItems(searchInput.value);
        };

        searchInput.onkeydown = (e) => {
            const items = menu.querySelectorAll('.wiki-slash-item');
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                slashMenuState.index = Math.min(slashMenuState.index + 1, items.length - 1);
                renderMenuItems(slashMenuState.filter);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                slashMenuState.index = Math.max(slashMenuState.index - 1, 0);
                renderMenuItems(slashMenuState.filter);
            } else if (e.key === 'Enter') {
                e.preventDefault();
                if (items[slashMenuState.index]) {
                    applyBlockType(container, blockId, items[slashMenuState.index].dataset.blockType);
                    closeSlashMenu(container);
                }
            } else if (e.key === 'Escape') {
                closeSlashMenu(container);
            }
        };

        menu.querySelectorAll('.wiki-slash-item').forEach(item => {
            item.onclick = () => {
                applyBlockType(container, blockId, item.dataset.blockType);
                closeSlashMenu(container);
            };
        });
    }

    renderMenuItems();
    container.appendChild(menu);

    const onClickOutside = (e) => {
        if (!menu.contains(e.target)) {
            closeSlashMenu(container);
            document.removeEventListener('mousedown', onClickOutside);
        }
    };
    setTimeout(() => addDocListener('mousedown', onClickOutside), 0);
}

function closeSlashMenu(container) {
    const menu = container.querySelector('.wiki-slash-menu');
    if (menu) menu.remove();
    slashMenuState.open = false;
}

function applyBlockType(container, blockId, type) {
    const record = getRecord(activePageId);
    if (!record) return;

    const block = record.blocks.find(b => b.id === blockId);
    if (!block) return;

    if (type === 'page-link') {
        block.type = 'page-link';
        block.content = '';
        block.metadata = { pageId: '' };
        showPagePicker(container, block);
    } else if (type === 'image') {
        block.type = 'image';
        block.content = '';
        block.metadata = { src: '' };
    } else {
        block.type = type;
        block.content = '';
    }

    record.updated_at = Date.now();
    WikiRecordsDB.update(record.id, { blocks: record.blocks });
    renderEditor(container);

    if (type !== 'divider' && type !== 'image' && type !== 'page-link') {
        requestAnimationFrame(() => {
            const blocksEl = container.querySelector('.wiki-blocks');
            const el = blocksEl?.querySelector(`[data-block-id='${blockId}']`);
            if (el) el.focus();
        });
    }
}

function showPagePicker(container, block) {
    const otherRecords = records.filter(r => r.id !== activePageId);
    if (otherRecords.length === 0) return;

    const picker = createElement('div', 'wiki-slash-menu');
    const rect = container.querySelector(`[data-block-id='${block.id}']`)?.getBoundingClientRect();
    if (rect) {
        picker.style.top = (rect.bottom + 4) + 'px';
        picker.style.left = rect.left + 'px';
    }

    picker.innerHTML = otherRecords.map(r => `
        <div class='wiki-slash-item' data-pick-page='${r.id}'>
            <span class='wiki-slash-item-icon'>${r.icon || '??'}</span>
            <span class='wiki-slash-item-label'>${escapeHtml(r.title || 'Untitled')}</span>
        </div>
    `).join('');

    picker.querySelectorAll('.wiki-slash-item').forEach(item => {
        item.onclick = async () => {
            block.metadata.pageId = item.dataset.pickPage;
            const linkedRecord = getRecord(block.metadata.pageId);
            block.content = linkedRecord ? `${linkedRecord.icon || '??'} ${escapeHtml(linkedRecord.title)}` : '';
            const record = getRecord(activePageId);
            if (record) {
                record.updated_at = Date.now();
                await WikiRecordsDB.update(record.id, { blocks: record.blocks });
            }
            picker.remove();
            renderEditor(container);
        };
    });

    container.appendChild(picker);

    const onClickOutside = (e) => {
        if (!picker.contains(e.target)) {
            picker.remove();
            document.removeEventListener('mousedown', onClickOutside);
        }
    };
    setTimeout(() => addDocListener('mousedown', onClickOutside), 0);
}

function startDrag(container, record, blockId, startEvent) {
    const blocksEl = container.querySelector('.wiki-blocks');
    if (!blocksEl) return;

    const blockEls = [...blocksEl.querySelectorAll('.wiki-block')];
    const dragEl = blockEls.find(el => el.dataset.blockId === blockId);
    if (!dragEl) return;

    const startY = startEvent.clientY;
    const idx = record.blocks.findIndex(b => b.id === blockId);
    let targetIdx = idx;

    dragEl.style.opacity = '0.5';

    const onMouseMove = (e) => {
        const deltaY = e.clientY - startY;
        dragEl.style.transform = `translateY(${deltaY}px)`;

        blockEls.forEach((el, i) => {
            if (i === idx) return;
            const rect = el.getBoundingClientRect();
            const midY = rect.top + rect.height / 2;
            if (e.clientY < midY && i < idx) targetIdx = i;
            if (e.clientY > midY && i > idx) targetIdx = i;
        });
    };

    const onMouseUp = async () => {
        dragEl.style.opacity = '';
        dragEl.style.transform = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (targetIdx !== idx) {
            const adjustedIdx = targetIdx > idx ? targetIdx - 1 : targetIdx;
            const [moved] = record.blocks.splice(idx, 1);
            record.blocks.splice(adjustedIdx, 0, moved);
            record.updated_at = Date.now();
            await WikiRecordsDB.update(record.id, { blocks: record.blocks });
            renderEditor(container);
        }
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
}

function showContextMenu(container, recordId, x, y) {
    closeContextMenu(container);

    const record = getRecord(recordId);
    if (!record) return;

    const isAuto = record.source_type === 'auto';

    const menu = createElement('div', 'wiki-page-context-menu');
    menu.style.top = y + 'px';
    menu.style.left = x + 'px';

    menu.innerHTML = `
        <div class='wiki-context-item' data-ctx='rename'>重新命名</div>
        ${!isAuto ? `
            <div class='wiki-context-item' data-ctx='duplicate'>複製</div>
            <div class='wiki-context-item' data-ctx='add-child'>新增子頁面</div>
        ` : ''}
        <div class='wiki-context-item danger' data-ctx='delete'>刪除</div>
    `;

    container.appendChild(menu);

    menu.querySelectorAll('.wiki-context-item').forEach(item => {
        item.onclick = async () => {
            const action = item.dataset.ctx;

            if (action === 'rename') {
                const newName = prompt('頁面名稱', record.title);
                if (newName !== null) {
                    record.title = newName;
                    record.updated_at = Date.now();
                    await WikiRecordsDB.update(record.id, { title: newName });
                    renderSidebar(container);
                    if (activePageId === recordId) renderEditor(container);
                }
            } else if (action === 'duplicate') {
                const newRecord = duplicatePage(recordId);
                if (newRecord) renderSidebar(container);
            } else if (action === 'add-child') {
                const child = createPage('note', 'New Page');
                child.parent_id = recordId;
                await WikiRecordsDB.update(child.id, { parent_id: recordId });
                renderSidebar(container);
                navigateToPage(container, child.id);
            } else if (action === 'delete') {
                if (confirm('確定刪除此頁面？')) {
                    await deletePage(recordId);
                    renderSidebar(container);
                    renderEditor(container);
                }
            }

            closeContextMenu(container);
        };
    });

    const onClickOutside = (e) => {
        if (!menu.contains(e.target)) {
            closeContextMenu(container);
            document.removeEventListener('mousedown', onClickOutside);
        }
    };
    setTimeout(() => addDocListener('mousedown', onClickOutside), 0);
}

function closeContextMenu(container) {
    const menu = container.querySelector('.wiki-page-context-menu');
    if (menu) menu.remove();
}

function navigateToPage(container, pageId) {
    activePageId = pageId;
    addRecentPage(pageId);
    renderSidebar(container);
    renderEditor(container);
    closeSidebar(container);
}

function handleSearch(container, query) {
    if (!query.trim()) return;

    const results = records.filter(r => {
        const titleMatch = r.title && r.title.toLowerCase().includes(query.toLowerCase());
        const contentMatch = r.blocks && r.blocks.some(b => {
            if (typeof b.content === 'string') return b.content.toLowerCase().includes(query.toLowerCase());
            return false;
        });
        return titleMatch || contentMatch;
    });

    const searchWrap = container.querySelector('.wiki-search');
    if (!searchWrap) return;

    let resultsEl = searchWrap.querySelector('.wiki-search-results');
    if (!resultsEl) {
        resultsEl = createElement('div', 'wiki-search-results');
        searchWrap.appendChild(resultsEl);
    }

    if (results.length === 0) {
        resultsEl.innerHTML = "`<div class=`"`wiki-search-result-item`"` style=`"color:var(--nt-ink-faint)'>No results</div>';
    } else {
        resultsEl.innerHTML = results.slice(0, 8).map(r => {
            const matchBlock = r.blocks && r.blocks.find(b => typeof b.content === 'string' && b.content.toLowerCase().includes(query.toLowerCase()));
            const excerpt = matchBlock ? stripHtml(matchBlock.content).substring(0, 60) : '';
            return `
                <div class='wiki-search-result-item' data-nav-page='${r.id}'>
                    <div class='wiki-search-result-title'>${r.icon || '??'} ${escapeHtml(r.title || 'Untitled')}</div>
                    ${excerpt ? `<div class='wiki-search-result-excerpt'>${escapeHtml(excerpt)}</div>` : ''}
                </div>
            `;
        }).join('');

        resultsEl.querySelectorAll('[data-nav-page]').forEach(el => {
            el.onclick = () => {
                navigateToPage(container, el.dataset.navPage);
                resultsEl.remove();
                const input = searchWrap.querySelector('input');
                if (input) input.value = '';
            };
        });
    }
}

function toggleSidebar(container) {
    const sidebar = container.querySelector('.wiki-sidebar');
    const overlay = container.querySelector('.wiki-sidebar-overlay');
    if (sidebar) sidebar.classList.toggle('open');
    if (overlay) overlay.classList.toggle('open');
}

function closeSidebar(container) {
    const sidebar = container.querySelector('.wiki-sidebar');
    const overlay = container.querySelector('.wiki-sidebar-overlay');
    if (sidebar) sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('open');
}

async function handleSync(container) {
    if (isSyncing) return;
    isSyncing = true;

    const syncBtn = container.querySelector('.wiki-sync-btn');
    if (syncBtn) {
        syncBtn.textContent = '同步中...';
        syncBtn.disabled = true;
    }

    try {
        const lastSync = await SettingsDB.get('wiki_last_sync');
        if (lastSync) {
            records = await incrementalSync();
        } else {
            records = await runFullSync();
        }
        renderSidebar(container);
        if (activePageId) renderEditor(container);
    } catch (err) {
        console.error('[Wiki] Sync failed:', err);
        alert('同步失敗: ' + err.message);
    } finally {
        isSyncing = false;
        if (syncBtn) {
            syncBtn.textContent = '?? 同步角色數據';
            syncBtn.disabled = false;
        }
    }
}

function openSettingsModal(container) {
    let modal = container.querySelector('.wiki-settings-modal');
    if (modal) modal.remove();

    const isConnected = notionConfig.token && notionConfig.databaseId;

    modal = createElement('div', 'wiki-settings-modal');
    modal.innerHTML = `
        <div class='wiki-settings-card'>
            <h3>Wiki 設定</h3>
            
            <div class='wiki-settings-section'>
                <h4>Notion API 整合</h4>
                <div class='wiki-settings-field'>
                    <label>API Token (Internal Integration Token)</label>
                    <input type='password' class='wiki-settings-input' id='notion-token' 
                        placeholder='secret_xxxx...' value='${escapeHtml(notionConfig.token || '')}'>
                    <p class='wiki-settings-hint'>從 Notion Integrations 頁面建立並複製 Token</p>
                </div>
                <div class='wiki-settings-field'>
                    <label>Database ID</label>
                    <input type='text' class='wiki-settings-input' id='notion-database-id' 
                        placeholder='xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' value='${escapeHtml(notionConfig.databaseId || '')}'>
                    <p class='wiki-settings-hint'>從 Notion Database URL 中取得（複製整個 URL 或只要 ID）</p>
                </div>
                <button class='wiki-settings-btn primary' id='notion-connect'>
                    ${isConnected ? '儲存設定' : '連接 Notion'}
                </button>
                ${isConnected ? `
                    <button class='wiki-settings-btn secondary' id='notion-sync'>同步到 Notion</button>
                    <button class='wiki-settings-btn secondary' id='notion-pull'>從 Notion 拉取</button>
                ` : ''}
            </div>
            
            <div class='wiki-settings-section'>
                <h4>MCP 整合（進階）</h4>
                <div class='wiki-settings-field'>
                    <label>MCP Server URL</label>
                    <input type='text' class='wiki-settings-input' id='mcp-url' 
                        placeholder='http://localhost:3000/mcp' value='${escapeHtml(notionConfig.mcpUrl || '')}'>
                    <p class='wiki-settings-hint'>連接到本地 MCP Server 以使用 Model Context Protocol</p>
                </div>
                <button class='wiki-settings-btn secondary' id='mcp-connect'>連接 MCP</button>
            </div>
            
            <div class='wiki-settings-status'>
                <span class='wiki-status-indicator ${isConnected ? 'connected' : ''}'></span>
                <span>${isConnected ? '已連接到 Notion' : '尚未連接'}</span>
            </div>
            
            <div class='wiki-settings-actions'>
                <button class='wiki-settings-close'>關閉</button>
            </div>
        </div>
    `;

    container.appendChild(modal);

    const tokenInput = modal.querySelector('#notion-token');
    const databaseInput = modal.querySelector('#notion-database-id');
    const mcpInput = modal.querySelector('#mcp-url');

    modal.querySelector('#notion-connect').onclick = async () => {
        notionConfig.token = tokenInput.value.trim();
        notionConfig.databaseId = extractDatabaseId(databaseInput.value.trim());
        notionConfig.mcpUrl = mcpInput.value.trim();
        await SettingsDB.set('wiki_notion_config', notionConfig);
        alert('設定已儲存');
        modal.remove();
        openSettingsModal(container);
    };

    const syncBtn = modal.querySelector('#notion-sync');
    if (syncBtn) {
        syncBtn.onclick = async () => {
            if (!notionConfig.token || !notionConfig.databaseId) {
                alert('請先設定 Notion Token 和 Database ID');
                return;
            }
            syncBtn.textContent = '同步中...';
            syncBtn.disabled = true;
            try {
                await syncToNotion(container);
                alert('同步完成');
            } catch (err) {
                alert('同步失敗: ' + err.message);
            }
            syncBtn.textContent = '同步到 Notion';
            syncBtn.disabled = false;
        };
    }

    const pullBtn = modal.querySelector('#notion-pull');
    if (pullBtn) {
        pullBtn.onclick = async () => {
            if (!notionConfig.token || !notionConfig.databaseId) {
                alert('請先設定 Notion Token 和 Database ID');
                return;
            }
            pullBtn.textContent = '拉取中...';
            pullBtn.disabled = true;
            try {
                await pullFromNotion(container);
                alert('拉取完成');
            } catch (err) {
                alert('拉取失敗: ' + err.message);
            }
            pullBtn.textContent = '從 Notion 拉取';
            pullBtn.disabled = false;
        };
    }

    modal.querySelector('#mcp-connect').onclick = async () => {
        notionConfig.mcpUrl = mcpInput.value.trim();
        await SettingsDB.set('wiki_notion_config', notionConfig);
        if (!notionConfig.mcpUrl) {
            alert('MCP URL 已清除');
            return;
        }
        alert('MCP 設定已儲存。未來將支援直接透過 MCP 與 Notion 互動。');
    };

    modal.querySelector('.wiki-settings-close').onclick = () => modal.remove();
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
    };
}

function extractDatabaseId(input) {
    if (!input) return '';
    const match = input.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (match) return match[0];
    if (/^[0-9a-f]{32}$/i.test(input.replace(/-/g, ''))) {
        return input.replace(/-/g, '').replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5');
    }
    return input;
}

const notionRateLimiter = {
    requests: [],
    maxRequestsPerSecond: 3,
    minRequestInterval: 350,
    lastRequestTime: 0,

    async waitForRateLimit() {
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        
        if (timeSinceLastRequest < this.minRequestInterval) {
            await this.sleep(this.minRequestInterval - timeSinceLastRequest);
        }
        
        this.requests = this.requests.filter(t => now - t < 1000);
        
        if (this.requests.length >= this.maxRequestsPerSecond) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = 1000 - (now - oldestRequest);
            if (waitTime > 0) {
                await this.sleep(waitTime);
            }
        }
        
        this.requests.push(Date.now());
        this.lastRequestTime = Date.now();
    },

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
};

async function notionRequest(endpoint, body, retryCount = 0) {
    await notionRateLimiter.waitForRateLimit();
    
    try {
        const response = await fetch(`https://api.notion.com/v1${endpoint}`, {
            method: body ? 'POST' : 'GET',
            headers: {
                'Authorization': `Bearer ${notionConfig.token}`,
                'Content-Type': 'application/json',
                'Notion-Version': '2022-06-28'
            },
            body: body ? JSON.stringify(body) : undefined
        });

        if (response.status === 429) {
            const retryAfter = parseInt(response.headers.get('Retry-After') || '60');
            console.warn(`[Notion] Rate limit exceeded, retrying after ${retryAfter}s`);
            
            if (retryCount < 3) {
                await notionRateLimiter.sleep(retryAfter * 1000);
                return notionRequest(endpoint, body, retryCount + 1);
            } else {
                throw new Error('Notion API rate limit exceeded, max retries reached');
            }
        }

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(error.message || `HTTP ${response.status}`);
        }

        return response.json();
    } catch (error) {
        if (retryCount < 3 && error.message.includes('fetch')) {
            console.warn(`[Notion] Network error, retrying (${retryCount + 1}/3)`);
            await notionRateLimiter.sleep(1000 * Math.pow(2, retryCount));
            return notionRequest(endpoint, body, retryCount + 1);
        }
        throw error;
    }
}

async function syncToNotion(container) {
    for (const record of records) {
        const properties = {
            Name: { title: [{ text: { content: record.title || 'Untitled' } }] }
        };
        const children = record.blocks.map(block => blockToNotionBlock(block)).filter(Boolean);
        
        const existingPage = await findNotionPage(record.id);
        if (existingPage) {
            await notionRequest(`/pages/${existingPage.id}`, {
                properties,
                archived: false
            });
        } else {
            const newPage = await notionRequest('/pages', {
                parent: { database_id: notionConfig.databaseId },
                properties: {
                    ...properties,
                    WikiId: { rich_text: [{ text: { content: record.id } }] }
                }
            });
            if (children.length > 0) {
                await notionRequest(`/blocks/${newPage.id}/children`, { children });
            }
        }
    }
}

async function pullFromNotion(container) {
    let hasMore = true;
    let startCursor = undefined;
    const notionRecords = [];
    
    while (hasMore) {
        const result = await notionRequest(`/databases/${notionConfig.databaseId}/query`, {
            start_cursor: startCursor
        });
        
        for (const page of result.results) {
            const wikiId = page.properties.WikiId?.rich_text?.[0]?.text?.content || generateId('page');
            const title = page.properties.Name?.title?.[0]?.text?.content || 'Untitled';
            
            const blocksResult = await notionRequest(`/blocks/${page.id}/children`);
            const blocks = blocksResult.results.map(notionBlockToBlock).filter(Boolean);
            
            notionRecords.push({
                id: wikiId,
                title,
                page_type: 'note',
                source_type: 'manual',
                blocks: blocks.length > 0 ? blocks : [createBlock('text', '')],
                cover_image: page.cover?.external?.url || page.cover?.file?.url || null,
                icon: page.icon?.emoji || '??',
                created_at: page.created_time ? new Date(page.created_time).getTime() : Date.now(),
                updated_at: page.last_edited_time ? new Date(page.last_edited_time).getTime() : Date.now()
            });
        }
        
        hasMore = result.has_more;
        startCursor = result.next_cursor;
    }
    
    const localOnlyRecords = records.filter(r => !r.notionPageId);
    const existingNotionIds = new Set(notionRecords.map(r => r.id));
    for (const local of records) {
        if (existingNotionIds.has(local.id)) {
            const idx = notionRecords.findIndex(r => r.id === local.id);
            if (idx !== -1) notionRecords[idx] = { ...notionRecords[idx], ...local, blocks: notionRecords[idx].blocks };
        }
    }
    
    records = [...localOnlyRecords, ...notionRecords];
    await WikiRecordsDB.bulkCreate(records);
    renderSidebar(container);
    if (records.length > 0) {
        navigateToPage(container, records[0].id);
    }
}

async function findNotionPage(wikiId) {
    const result = await notionRequest(`/databases/${notionConfig.databaseId}/query`, {
        filter: {
            property: 'WikiId',
            rich_text: { equals: wikiId }
        }
    });
    return result.results[0] || null;
}

function blockToNotionBlock(block) {
    switch (block.type) {
        case 'text':
        case 'paragraph':
            return { object: 'block', type: 'paragraph', paragraph: { rich_text: [{ text: { content: stripHtml(block.content || '') } }] } };
        case 'heading1':
            return { object: 'block', type: 'heading_1', heading_1: { rich_text: [{ text: { content: stripHtml(block.content || '') } }] } };
        case 'heading2':
            return { object: 'block', type: 'heading_2', heading_2: { rich_text: [{ text: { content: stripHtml(block.content || '') } }] } };
        case 'heading3':
            return { object: 'block', type: 'heading_3', heading_3: { rich_text: [{ text: { content: stripHtml(block.content || '') } }] } };
        case 'bulleted-list':
            return { object: 'block', type: 'bulleted_list_item', bulleted_list_item: { rich_text: [{ text: { content: stripHtml(block.content || '') } }] } };
        case 'numbered-list':
            return { object: 'block', type: 'numbered_list_item', numbered_list_item: { rich_text: [{ text: { content: stripHtml(block.content || '') } }] } };
        case 'todo':
            return { object: 'block', type: 'to_do', to_do: { rich_text: [{ text: { content: stripHtml(block.content || '') } }], checked: block.checked || false } };
        case 'divider':
            return { object: 'block', type: 'divider', divider: {} };
        case 'quote':
            return { object: 'block', type: 'quote', quote: { rich_text: [{ text: { content: stripHtml(block.content || '') } }] } };
        default:
            return null;
    }
}

function notionBlockToBlock(notionBlock) {
    const getText = (block) => block[block.type]?.rich_text?.map(r => r.text?.content || '').join('') || '';
    
    switch (notionBlock.type) {
        case 'paragraph':
            return createBlock('text', getText(notionBlock));
        case 'heading_1':
            return createBlock('heading1', getText(notionBlock));
        case 'heading_2':
            return createBlock('heading2', getText(notionBlock));
        case 'heading_3':
            return createBlock('heading3', getText(notionBlock));
        case 'bulleted_list_item':
            return createBlock('bulleted-list', getText(notionBlock));
        case 'numbered_list_item':
            return createBlock('numbered-list', getText(notionBlock));
        case 'to_do':
            const todoBlock = createBlock('todo', getText(notionBlock));
            todoBlock.checked = notionBlock.to_do?.checked || false;
            return todoBlock;
        case 'divider':
            return createBlock('divider', '');
        case 'quote':
            return createBlock('quote', getText(notionBlock));
        default:
            return createBlock('text', getText(notionBlock));
    }
}

function openFabMenu(container) {
    let menu = container.querySelector('.wiki-fab-menu');
    if (menu) { menu.remove(); return; }

    menu = createElement('div', 'wiki-fab-menu');
    menu.innerHTML = `
        <div class='wiki-fab-item' data-action='new-note'>
            <i class='fas fa-plus'></i>
            <span>新增筆記</span>
        </div>
        <div class='wiki-fab-item' data-action='new-topic'>
            <i class='fas fa-bookmark'></i>
            <span>新增主題</span>
        </div>
        <div class='wiki-fab-item' data-action='sync'>
            <i class='fas fa-sync'></i>
            <span>同步角色數據</span>
        </div>
        ${activePageId ? `
            <div class='wiki-fab-item danger' data-action='delete'>
                <i class='fas fa-trash'></i>
                <span>刪除目前頁面</span>
            </div>
        ` : ''}
    `;

    container.appendChild(menu);

    menu.querySelectorAll('.wiki-fab-item').forEach(item => {
        item.onclick = async () => {
            const action = item.dataset.action;
            if (action === 'new-note') {
                const record = createPage('note', 'New Page');
                renderSidebar(container);
                navigateToPage(container, record.id);
            } else if (action === 'new-topic') {
                const record = createPage('topic', 'New Topic');
                renderSidebar(container);
                navigateToPage(container, record.id);
            } else if (action === 'sync') {
                await handleSync(container);
            } else if (action === 'delete' && activePageId) {
                if (confirm('確定刪除此頁面？')) {
                    await deletePage(activePageId);
                    renderSidebar(container);
                    renderEditor(container);
                }
            }
            menu.remove();
        };
    });

    const onClickOutside = (e) => {
        if (!menu.contains(e.target) && !container.querySelector('.wiki-fab').contains(e.target)) {
            menu.remove();
            document.removeEventListener('mousedown', onClickOutside);
        }
    };
    setTimeout(() => addDocListener('mousedown', onClickOutside), 0);
}

async function renderPersonalWiki(params) {
    await loadData();
    cleanup();

    const container = createElement('div', 'app-container wiki-app');

    container.innerHTML = `
        <div class='wiki-sidebar-overlay'></div>
        <div class='wiki-sidebar'>
            <div class='wiki-sidebar-header'>
                <button class='wiki-sidebar-toggle'><i class='fas fa-chevron-left'></i></button>
                <span class='wiki-sidebar-title'>角色 Wiki</span>
                <button class='wiki-sidebar-back'><i class='fas fa-chevron-left'></i> 返回</button>
            </div>
            <div class='wiki-search' style='position:relative'>
                <input class='wiki-search-input' type='text' placeholder='搜尋頁面...'>
            </div>
            <div class='wiki-page-list'></div>
            <div class='wiki-sidebar-footer'>
                <button class='wiki-sync-btn'>?? 同步角色數據</button>
                <button class='wiki-settings-btn'><i class='fas fa-cog'></i> 設定</button>
            </div>
        </div>
        <button class='wiki-editor-toggle'><i class='fas fa-chevron-right'></i></button>
        <div class='wiki-editor-area'>
            <div class='wiki-mobile-header'>
                <button class='wiki-mobile-menu-btn'>?</button>
                <span class='wiki-mobile-title'>角色 Wiki</span>
                <button class='wiki-mobile-back'><i class='fas fa-chevron-left'></i> 返回</button>
            </div>
            <div class='wiki-editor-empty'>選擇或建立一個頁面</div>
        </div>
        <button class='wiki-fab'><i class='fas fa-plus'></i></button>
    `;

    container.querySelector('.wiki-sidebar-back').onclick = () => Router.back();
    container.querySelector('.wiki-mobile-back').onclick = () => Router.back();

    container.querySelector('.wiki-sidebar-toggle').onclick = () => {
        const sidebar = container.querySelector('.wiki-sidebar');
        if (sidebar) sidebar.classList.add('collapsed');
    };
    container.querySelector('.wiki-editor-toggle').onclick = () => {
        const sidebar = container.querySelector('.wiki-sidebar');
        if (sidebar) sidebar.classList.remove('collapsed');
    };
    container.querySelector('.wiki-mobile-menu-btn').onclick = () => toggleSidebar(container);
    container.querySelector('.wiki-sidebar-overlay').onclick = () => closeSidebar(container);
    container.querySelector('.wiki-settings-btn').onclick = () => openSettingsModal(container);
    container.querySelector('.wiki-sync-btn').onclick = () => handleSync(container);
    container.querySelector('.wiki-fab').onclick = () => openFabMenu(container);

    const searchInput = container.querySelector('.wiki-search-input');
    const debouncedSearch = debounce((query) => handleSearch(container, query), 200);
    searchInput.oninput = () => {
        const query = searchInput.value;
        if (query.trim()) {
            debouncedSearch(query);
        } else {
            const resultsEl = container.querySelector('.wiki-search-results');
            if (resultsEl) resultsEl.remove();
        }
    };

    renderSidebar(container);

    if (records.length > 0 && !activePageId) {
        const lastPage = recentPages.length > 0 ? getRecord(recentPages[0]) : null;
        const firstPage = lastPage || records[0];
        if (firstPage) navigateToPage(container, firstPage.id);
    } else if (activePageId) {
        renderEditor(container);
    }

    return { element: container, cleanup };
}

export default {
    id: 'personal-wiki',
    name: '角色 Wiki',
    icon: 'import_contacts',
    routes: [
        { path: '/personal-wiki', render: renderPersonalWiki }
    ],
    navItem: { label: '角色 Wiki', icon: 'import_contacts', path: '/personal-wiki', showInNav: true, order: 130 },
    stylesPath: 'js/apps/personal-wiki/style.css'
};


function setupUndoRedoShortcuts(container) {
    const handleKeyDown = (e) => {
        const isUndo = (e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey;
        const isRedo = (e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey));
        
        if (isUndo) {
            e.preventDefault();
            performUndo(container);
        } else if (isRedo) {
            e.preventDefault();
            performRedo(container);
        }
    };
    
    container.addEventListener('keydown', handleKeyDown);
}

function saveStateForUndo(record, description = 'Edit') {
    const state = {
        blocks: JSON.parse(JSON.stringify(record.blocks)),
        title: record.title,
        icon: record.icon,
        cover_image: record.cover_image
    };
    historyManager.pushState(state, description);
}

function performUndo(container) {
    const record = getRecord(activePageId);
    if (!record || !historyManager.canUndo()) return;
    
    const currentState = {
        blocks: record.blocks,
        title: record.title,
        icon: record.icon,
        cover_image: record.cover_image
    };
    
    const previousState = historyManager.undo(currentState);
    if (!previousState) return;
    
    record.blocks = previousState.blocks;
    record.title = previousState.title;
    record.icon = previousState.icon;
    record.cover_image = previousState.cover_image;
    record.updated_at = Date.now();
    
    WikiRecordsDB.update(record.id, record);
    renderEditor(container);
    renderSidebar(container);
    
    showUndoRedoToast('Undo', historyManager.getHistoryInfo());
}

function performRedo(container) {
    const record = getRecord(activePageId);
    if (!record || !historyManager.canRedo()) return;
    
    const currentState = {
        blocks: record.blocks,
        title: record.title,
        icon: record.icon,
        cover_image: record.cover_image
    };
    
    const nextState = historyManager.redo(currentState);
    if (!nextState) return;
    
    record.blocks = nextState.blocks;
    record.title = nextState.title;
    record.icon = nextState.icon;
    record.cover_image = nextState.cover_image;
    record.updated_at = Date.now();
    
    WikiRecordsDB.update(record.id, record);
    renderEditor(container);
    renderSidebar(container);
    
    showUndoRedoToast('Redo', historyManager.getHistoryInfo());
}

function showUndoRedoToast(action, info) {
    const undoCount = info.undoCount;
    const redoCount = info.redoCount;
    
    import('../../components.js').then(({ createToast }) => {
        createToast(\\ (\ undo, \ redo available)\, 'info');
    });
}
