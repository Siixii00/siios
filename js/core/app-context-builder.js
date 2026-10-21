import { minorSafetyPrompt } from './age-gate.js';
import { CharactersDB, UsersDB, SettingsDB, GlobalSettingsDB, GlobalForbiddenDB, KeywordSettingsDB } from '../db.js';
import { buildMemoryFilters } from './memory-prefs.js';
import { getDislikePrompt } from './dislikes.js';
import { describeRecentShopping } from './gift-ideas.js';

async function buildAppContext(options = {}) {
    const {
        characterId = null,
        userId = null,
        userMessage = '',
        chatId = null,
        keywordText = '' // 額外拿來比對世界書關鍵字的文字（例如場景、最近的對話），不當作記憶的查詢句
    } = options;

    const context = {
        character: null,
        user: null,
        worldInfo: [],
        forbidden: [],
        memories: [],
        systemPrompt: ''
    };

    if (characterId) {
        context.character = await CharactersDB.getById(characterId);
    }

    if (context.character?.bound_user_id) {
        context.user = await UsersDB.getById(context.character.bound_user_id);
    } else if (userId) {
        context.user = await UsersDB.getById(userId);
    }

    const globalSettings = await GlobalSettingsDB.getAll();
    for (const entry of globalSettings) {
        if (entry.enabled) {
            context.worldInfo.push({
                id: entry.id,
                name: entry.name,
                content: entry.content,
                priority: entry.priority || 'front'
            });
        }
    }

    const globalForbidden = await GlobalForbiddenDB.getAll();
    for (const entry of globalForbidden) {
        if (entry.enabled) {
            context.forbidden.push({
                id: entry.id,
                name: entry.name,
                content: entry.content
            });
        }
    }

    // 世界書的「關鍵字」條目：訊息或額外文字裡出現關鍵字才會帶入（聊天室一直是這樣，各個 App 之前沒有讀）
    const triggerText = [userMessage, keywordText].filter(Boolean).join('\n');
    if (triggerText) {
        try {
            for (const entry of await KeywordSettingsDB.matchKeywords(triggerText)) {
                if (entry.content) context.worldInfo.push({ id: entry.id, name: entry.name, content: entry.content, priority: entry.priority || 'middle' });
            }
        } catch { /* 世界書讀取失敗不影響其他內容 */ }
    }

    // Retrieve memories if memory system is enabled
    const settings = await SettingsDB.getAll();
    if (settings.memory_enabled && window.App?.memorySystem) {
        try {
            // Build memory filters based on chat settings
            // 以使用者的「記憶設定」為底，呼叫端（例如劇場）可以覆蓋個別項目
            const memoryFilters = await buildMemoryFilters({ characterId, options });

            const memories = await window.App.memorySystem.retrieveMemories(
                userMessage || '', 
                chatId, 
                5,
                memoryFilters
            );
            context.memories = memories || [];
        } catch {
            context.memories = [];
        }
    }

    context.systemPrompt = buildSystemPrompt(context);
    // 最近在購物 App 的事（收下、真的買了、不需要的禮物）
    if (characterId) {
        const shopText = describeRecentShopping(await SettingsDB.get('shop_records'), characterId);
        if (shopText) context.systemPrompt += '\n\n' + shopText;
    }
    // 用戶討厭的事：不靠檢索，每次都帶，放在最後
    const dislikeText = await getDislikePrompt();
    if (dislikeText) context.systemPrompt += '\n\n' + dislikeText;
    const minorPrompt = minorSafetyPrompt();
    if (minorPrompt) context.systemPrompt += '\n\n' + minorPrompt;

    return context;
}

function buildSystemPrompt(context) {
    let prompt = '';

    if (context.character) {
        prompt += `# 角色設定
`;
        prompt += `名稱: ${context.character.name || '未知'}
`;
        if (context.character.personality) {
            prompt += `性格: ${context.character.personality}
`;
        }
        if (context.character.scenario) {
            prompt += `場景: ${context.character.scenario}
`;
        }
        if (context.character.speech_style) {
            prompt += `說話風格: ${context.character.speech_style}
`;
        }
    }

    if (context.user) {
        prompt += `
# 使用者設定
`;
        prompt += `名稱: ${context.user.name || '使用者'}
`;
        if (context.user.personality) {
            prompt += `性格: ${context.user.personality}
`;
        }
        if (context.user.speech_style) {
            prompt += `說話風格: ${context.user.speech_style}
`;
        }
        if (context.user.taboos && context.user.taboos.length > 0) {
            prompt += `禁忌（避開即可，不要提到它們，也不要說明你避開了什麼）: ${context.user.taboos.join(', ')}
`;
        }
    }

    if (context.worldInfo.length > 0) {
        prompt += `
# 世界設定
`;
        const sorted = [...context.worldInfo].sort((a, b) => {
            const order = { front: 0, middle: 1, back: 2 };
            return (order[a.priority] || 1) - (order[b.priority] || 1);
        });
        for (const entry of sorted) {
            prompt += `[${entry.name}]
${entry.content}

`;
        }
    }

    if (context.memories && context.memories.length > 0) {
        prompt += `
# 相關記憶
`;
        prompt += `以下是與當前對話相關的過往記憶：
`;
        for (const memory of context.memories) {
            const sanitized = (memory.displayContent || memory.content || '').replace(/[\r\n]/g, ' ').replace(/\[.*?\]/g, '');
            prompt += `- ${sanitized}
`;
        }
    }

    if (context.forbidden.length > 0) {
        prompt += `
# 禁止事項
`;
        prompt += `以下內容絕對不可出現在生成內容中：
`;
        for (const entry of context.forbidden) {
            prompt += `- ${entry.content}
`;
        }
    }

    return prompt;
}

export { buildAppContext, buildSystemPrompt };
