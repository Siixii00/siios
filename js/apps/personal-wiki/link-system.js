import { escapeHtml } from '../../utils/html.js';

const LINK_REGEX = /\[\[([^\]]+)\]\]/g;

let cachedRecords = null;
let backlinkIndex = null;

export function setRecordsCache(records) {
    cachedRecords = records;
    backlinkIndex = null;
}

export function invalidateBacklinkIndex() {
    backlinkIndex = null;
}

function buildBacklinkIndex() {
    if (!cachedRecords) return;
    if (backlinkIndex) return;
    
    backlinkIndex = new Map();
    for (const record of cachedRecords) {
        const links = parseLinksFromBlocks(record.blocks);
        for (const linkTitle of links) {
            const normalized = linkTitle.toLowerCase();
            if (!backlinkIndex.has(normalized)) backlinkIndex.set(normalized, new Set());
            backlinkIndex.get(normalized).add(record.id);
        }
    }
}

export function parseLinks(blockContent) {
    if (!blockContent || typeof blockContent !== 'string') return [];
    const links = [];
    let match;
    const regex = new RegExp(LINK_REGEX.source, LINK_REGEX.flags);
    while ((match = regex.exec(blockContent)) !== null) {
        links.push(match[1]);
    }
    return [...new Set(links)];
}

export function parseLinksFromBlocks(blocks) {
    const allLinks = [];
    for (const block of blocks) {
        const links = parseLinks(block.content);
        allLinks.push(...links);
    }
    return [...new Set(allLinks)];
}

export function resolveLink(title) {
    if (!cachedRecords) return null;
    
    const exact = cachedRecords.find(r => r.title === title);
    if (exact) return exact;

    const normalized = title.toLowerCase();
    const caseInsensitive = cachedRecords.find(r =>
        r.title && r.title.toLowerCase() === normalized
    );
    if (caseInsensitive) return caseInsensitive;

    const partial = cachedRecords.find(r =>
        r.title && r.title.includes(title)
    );
    return partial || null;
}

export function getBacklinks(pageId) {
    if (!cachedRecords) return [];
    
    buildBacklinkIndex();
    
    const targetRecord = cachedRecords.find(r => r.id === pageId);
    if (!targetRecord || !targetRecord.title) return [];

    const normalized = targetRecord.title.toLowerCase();
    const backlinkIds = backlinkIndex?.get(normalized);
    
    return backlinkIds ? cachedRecords.filter(r => backlinkIds.has(r.id) && r.id !== pageId) : [];
}

export function renderLinksInContent(html) {
    if (!html || typeof html !== 'string') return html;
    return html.replace(LINK_REGEX, (match, title) => {
        return `<span class='wiki-bilink' data-link-title='${escapeHtml(title)}'>${escapeHtml(title)}</span>`;
    });
}

export function updateLinks(pageId) {
    if (!cachedRecords) return;

    const record = cachedRecords.find(r => r.id === pageId);
    if (!record) return;

    const linkTitles = parseLinksFromBlocks(record.blocks);
    const linkIds = [];

    for (const title of linkTitles) {
        const target = resolveLink(title);
        if (target) linkIds.push(target.id);
    }

    record.links = [...new Set(linkIds)];
    invalidateBacklinkIndex();
}

export function showLinkPicker(container, triggerEl, onSelect) {
    if (!cachedRecords) return;

    const existing = container.querySelector('.wiki-link-picker');
    if (existing) existing.remove();

    const picker = document.createElement('div');
    picker.className = 'wiki-link-picker';

    const rect = triggerEl.getBoundingClientRect();
    picker.style.top = (rect.bottom + 4) + 'px';
    picker.style.left = Math.min(rect.left, window.innerWidth - 280) + 'px';

    picker.innerHTML = `
        <div class='wiki-link-picker-search'>
            <input type='text' placeholder='搜尋頁面...' autofocus>
        </div>
        <div class='wiki-link-picker-list'></div>
    `;

    container.appendChild(picker);

    const searchInput = picker.querySelector('input');
    const listEl = picker.querySelector('.wiki-link-picker-list');

    function renderItems(query = '') {
        const filtered = query
            ? cachedRecords.filter(r => r.title && r.title.toLowerCase().includes(query.toLowerCase()))
            : cachedRecords;

        listEl.innerHTML = filtered.length === 0
            ? '<div class='wiki-link-picker-empty'>無符合頁面</div>'
            : filtered.slice(0, 10).map(r => `
                <div class='wiki-link-picker-item' data-pick-title='${escapeHtml(r.title)}'>
                    <span class='wiki-link-picker-icon'>${r.icon || '??'}</span>
                    <span class='wiki-link-picker-label'>${escapeHtml(r.title)}</span>
                    <span class='wiki-link-picker-type'>${r.page_type}</span>
                </div>
            `).join('');

        listEl.querySelectorAll('.wiki-link-picker-item').forEach(item => {
            item.onclick = () => {
                onSelect(item.dataset.pickTitle);
                picker.remove();
            };
        });
    }

    renderItems();

    searchInput.oninput = () => renderItems(searchInput.value);
    searchInput.onkeydown = (e) => {
        if (e.key === 'Escape') {
            picker.remove();
        }
    };

    const onClickOutside = (e) => {
        if (!picker.contains(e.target)) {
            picker.remove();
            document.removeEventListener('mousedown', onClickOutside);
        }
    };
    setTimeout(() => document.addEventListener('mousedown', onClickOutside), 0);
}
