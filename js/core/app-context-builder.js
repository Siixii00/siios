import { CharactersDB, UsersDB, SettingsDB, GlobalSettingsDB, GlobalForbiddenDB } from '../db.js';

async function buildAppContext(options = {}) {
    const {
        characterId = null,
        userId = null,
        userMessage = '',
        chatId = null
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

    // Retrieve memories if memory system is enabled
    const settings = await SettingsDB.getAll();
    if (settings.memory_enabled && window.App?.memorySystem) {
        try {
            // Build memory filters based on chat settings
            const memoryFilters = {
                character_id: characterId,
                include_main_memories: options.includeMainMemories !== false,
                include_fiction: options.includeFiction || false,
                selected_sources: options.selectedSources || ['chat', 'youtube', 'instagram', 'chrome', 'dating', 'bubbles', 'weverse'],
                memory_level: options.memoryLevel || 'meta'
            };

            // Add theater filter if specified
            if (options.theaterId) {
                memoryFilters.theater_id = options.theaterId;
            }

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
            prompt += `禁忌: ${context.user.taboos.join(', ')}
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
            const sanitized = (memory.content || '').replace(/[\r\n]/g, ' ').replace(/\[.*?\]/g, '');
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
