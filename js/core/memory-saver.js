import { MemoryDB } from '../db.js';

/**
 * Save interaction memory from various apps
 * @param {Object} options
 * @param {string} options.characterId - Character ID
 * @param {string} options.userId - User ID (optional)
 * @param {string} options.chatId - Chat ID (optional, for chat memories)
 * @param {string} options.sourceApp - Source app: 'chat', 'youtube', 'chrome', 'instagram', 'dating', 'bubbles', 'weverse', 'ao3', 'lofter', 'theater'
 * @param {string} options.sourceType - 'interaction' or 'fiction'
 * @param {string} options.sourceSubtype - 'chat', 'viewing', 'browsing', 'dating', 'social', 'ao3', 'lofter', 'theater'
 * @param {string} options.content - Full content of the memory
 * @param {string} options.metaContent - Brief description (auto-generated if not provided)
 * @param {string[]} options.theaterIds - Theater IDs this memory belongs to (empty = main storyline)
 * @param {boolean} options.isFiction - Whether this is fictional content
 * @param {string} options.fictionContext - Context for fictional content
 * @param {number} options.importance - Importance score (0-1)
 */
async function saveInteractionMemory(options) {
    const {
        characterId = '',
        userId = '',
        chatId = '',
        sourceApp = 'chat',
        sourceType = 'interaction',
        sourceSubtype = 'chat',
        content = '',
        metaContent = '',
        fullContent = '',
        theaterIds = [],
        isFiction = false,
        fictionContext = null,
        importance = 0.5
    } = options;

    if (!characterId) {
        console.warn('[MemorySaver] No characterId provided, skipping memory save');
        return null;
    }

    // Generate meta content if not provided
    const generatedMetaContent = metaContent || generateMetaContent(sourceApp, sourceSubtype, content);
    
    // Use fullContent or fall back to content
    const actualFullContent = fullContent || content;

    try {
        const memory = await MemoryDB.create({
            chat_id: chatId,
            character_id: characterId,
            user_id: userId,
            content: actualFullContent,
            // Source info
            source_app: sourceApp,
            source_type: sourceType,
            source_subtype: sourceSubtype,
            // Memory levels
            memory_level: 'full',
            meta_content: generatedMetaContent,
            full_content: actualFullContent,
            // Theater binding
            theater_ids: theaterIds,
            is_fiction: isFiction,
            fiction_context: fictionContext,
            // Importance
            importance: importance,
            memory_type: 'dynamic'
        });

        console.log(`[MemorySaver] Saved ${sourceType} memory from ${sourceApp} for character ${characterId}`);
        return memory;
    } catch (error) {
        console.error('[MemorySaver] Failed to save memory:', error);
        return null;
    }
}

/**
 * Generate meta content based on source app
 */
function generateMetaContent(sourceApp, sourceSubtype, content) {
    const sourceLabels = {
        'youtube': 'YouTube',
        'chrome': 'Chrome',
        'instagram': 'Instagram',
        'dating': '約會',
        'bubbles': 'Bubbles',
        'weverse': 'Weverse',
        'ao3': 'AO3',
        'lofter': 'Lofter',
        'theater': '劇場',
        'chat': '對話'
    };

    const actionLabels = {
        'chat': '進行了對話',
        'viewing': '一起觀看了內容',
        'browsing': '一起瀏覽了網站',
        'dating': '進行了約會互動',
        'social': '進行了社交互動',
        'ao3': '閱讀了同人創作',
        'lofter': '閱讀了同人內容',
        'theater': '進行了劇場演出'
    };

    const sourceLabel = sourceLabels[sourceApp] || sourceApp;
    const actionLabel = actionLabels[sourceSubtype] || '進行了互動';

    // Truncate content for preview
    const preview = content.length > 50 ? content.substring(0, 50) + '...' : content;

    return `在${sourceLabel}與用戶${actionLabel}`;
}

/**
 * Get default memory settings for a chat
 */
function getDefaultMemorySettings() {
    return {
        include_main_memories: true,
        include_fiction: false,
        selected_sources: ['chat', 'youtube', 'instagram', 'chrome', 'dating', 'bubbles', 'weverse'],
        memory_level: 'meta'
    };
}

export { saveInteractionMemory, generateMetaContent, getDefaultMemorySettings };
