import { CharactersDB, UsersDB, SettingsDB, GlobalSettingsDB, GlobalForbiddenDB } from '../db.js';

async function buildAppContext(options = {}) {
    const {
        characterId = null,
        userId = null,
        userMessage = ''
    } = options;

    const context = {
        character: null,
        user: null,
        worldInfo: [],
        forbidden: [],
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

    context.systemPrompt = buildSystemPrompt(context);

    return context;
}

function buildSystemPrompt(context) {
    let prompt = '';

    if (context.character) {
        prompt += `# 角色設定\n`;
        prompt += `名稱: ${context.character.name || '未知'}\n`;
        if (context.character.personality) {
            prompt += `性格: ${context.character.personality}\n`;
        }
        if (context.character.scenario) {
            prompt += `場景: ${context.character.scenario}\n`;
        }
        if (context.character.speech_style) {
            prompt += `說話風格: ${context.character.speech_style}\n`;
        }
    }

    if (context.user) {
        prompt += `\n# 使用者設定\n`;
        prompt += `名稱: ${context.user.name || '使用者'}\n`;
        if (context.user.personality) {
            prompt += `性格: ${context.user.personality}\n`;
        }
        if (context.user.speech_style) {
            prompt += `說話風格: ${context.user.speech_style}\n`;
        }
        if (context.user.taboos && context.user.taboos.length > 0) {
            prompt += `禁忌: ${context.user.taboos.join(', ')}\n`;
        }
    }

    if (context.worldInfo.length > 0) {
        prompt += `\n# 世界設定\n`;
        const sorted = [...context.worldInfo].sort((a, b) => {
            const order = { front: 0, middle: 1, back: 2 };
            return (order[a.priority] || 1) - (order[b.priority] || 1);
        });
        for (const entry of sorted) {
            prompt += `[${entry.name}]\n${entry.content}\n\n`;
        }
    }

    if (context.forbidden.length > 0) {
        prompt += `\n# 禁止事項\n`;
        prompt += `以下內容絕對不可出現在生成內容中：\n`;
        for (const entry of context.forbidden) {
            prompt += `- ${entry.content}\n`;
        }
    }

    return prompt;
}

export { buildAppContext, buildSystemPrompt };
