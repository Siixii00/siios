export function createBlock(type = 'text', content = '') {
    return {
        id: 'blk_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
        type,
        content,
        checked: false,
        metadata: {},
        confidence: null
    };
}

export function createNotePage(title = 'Untitled') {
    return {
        page_type: 'note',
        title,
        source_type: 'manual',
        confidence: 'UNVERIFIED',
        blocks: [createBlock('text', '')],
        links: [],
        tags: [],
        icon: '📝'
    };
}

export function createTopicPage(title = 'Untitled') {
    return {
        page_type: 'topic',
        title,
        source_type: 'manual',
        confidence: 'UNVERIFIED',
        blocks: [
            createBlock('heading1', title),
            createBlock('text', '')
        ],
        links: [],
        tags: [],
        icon: '📌'
    };
}
