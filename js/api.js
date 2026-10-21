import { minorSafetyPrompt } from './core/age-gate.js';
import Router from './router.js';
import { SettingsDB, ChatsDB, CharactersDB, UsersDB, HealthDB, ZiweiCacheDB } from './db.js';
import { loadWorldInfoContext } from './core/world-info-loader.js';
import { generateRPPrompt, buildResponseModePrompt, getResponseMode, withResponseReminder } from './constants/rp-system-prompt.js';
import { stripReasoning } from './core/reasoning-filter.js';
import { buildMemoryFilters } from './core/memory-prefs.js';
import { loadActivityContext } from './core/activity-context.js';
import { MEMORY_SOURCES } from './core/memory-sources.js';
import { buildRealWorldContext } from './core/real-world-context.js';
import { PeriodCalculator } from './core/period-calculator.js';
import { createErrorModal } from './components.js';
import { mcpManager } from './core/mcp-client.js';

// 非文字訊息轉成文字描述，讓角色知道使用者傳了什麼（文字訊息原樣回傳）
// 歷史裡舊的回覆如果帶著思考過程，模型會照著繼續輸出；送給模型前先去掉（去完是空的就保留原文）
function cleanAssistantText(text) {
    return typeof text === 'string' ? (stripReasoning(text) || text) : text;
}

export function describeMessageForAI(m) {
    const meta = m.meta || {};
    switch (m.type) {
        case 'sticker': return `[貼圖：${meta.name || m.content}]`;
        case 'image': return `[圖片：${m.content || '一張圖片'}]`;
        case 'card': return `[卡片：${meta.title || m.content}${meta.desc ? '，' + meta.desc : ''}]`;
        case 'gift': return `[禮物：${meta.name || m.content}]`;
        case 'transfer': return `[轉帳：$${Number(meta.amount || 0).toLocaleString()}${meta.note ? '，備註：' + meta.note : ''}]`;
        case 'icon': return `[圖示：${meta.name || m.content}]`;
        case 'video': return `[影片：${meta.name || m.content}]`;
        case 'audio':
            if (meta.kind === 'music') return `[音樂：${meta.caption || m.content}]`;
            return meta.transcript ? `[語音訊息，內容：${meta.transcript}]` : '[語音訊息，無法辨識內容]';
        case 'file': return `[檔案：${meta.name || m.content}]`;
        case 'location': return `[位置：${meta.label || '位置'}（${Number(meta.lat).toFixed(4)}, ${Number(meta.lng).toFixed(4)}）]`;
        default: return m.content;
    }
}

const APIClient = {
    showError(errorInfo) {
        const info = typeof errorInfo === 'string' 
            ? { message: errorInfo } 
            : errorInfo;
        createErrorModal({
            title: info.title || 'API 錯誤',
            message: info.message,
            details: info.details || '',
            timestamp: new Date().toISOString()
        });
    },
    
    async getSettings() {
        return SettingsDB.getAll();
    },
    
    async getCharacterData(chatId) {
        const chat = await ChatsDB.getById(chatId);
        if (!chat || !chat.character_id) return null;
        
        const character = await CharactersDB.getById(chat.character_id);
        return character;
    },
    
    async getUserData(chatId) {
        const chat = await ChatsDB.getById(chatId);
        if (!chat || !chat.bound_user_id) return null;
        
        const user = await UsersDB.getById(chat.bound_user_id);
        return user;
    },
    
    async buildMessages(chatId, userMessage, settings, messages, memoryContext = null, characterData = null, userData = null) {
        const systemMessages = [];
        
        const chat = await ChatsDB.getById(chatId);
        
        if (chat && chat.enable_real_world_info) {
            const realWorldInfo = await buildRealWorldContext(chat);
            if (realWorldInfo) {
                systemMessages.push({
                    role: 'system',
                    content: realWorldInfo
                });
            }
        }
        
        if (chat && chat.bound_user_id) {
            try {
                const memoryTemplate = await HealthDB.getMemoryTemplate(chat.bound_user_id);
                const prediction = await PeriodCalculator.shouldRemind(chat.bound_user_id);
                
                if (memoryTemplate || prediction) {
                    const healthContext = PeriodCalculator.buildHealthContext(prediction, memoryTemplate);
                    if (healthContext) {
                        systemMessages.push({
                            role: 'system',
                            content: healthContext
                        });
                    }
                }
            } catch (e) {
            }
        }
        
        const activityContext = await loadActivityContext();
        if (activityContext) systemMessages.push({ role: 'system', content: activityContext });

        if (characterData?.ziwei_cache_id) {
            try {
                const ziweiCache = await ZiweiCacheDB.getById(characterData.ziwei_cache_id);
                
                if (ziweiCache && !ziweiCache.is_stale) {
                    const ziweiContext = this.buildZiweiContext(ziweiCache);
                    if (ziweiContext) {
                        systemMessages.push({
                            role: 'system',
                            content: ziweiContext
                        });
                    }
                }
            } catch (e) {
                console.error('[API] Ziwei context injection failed:', e);
            }
        }
        
        // 宅家的精力值偏低時，讓角色知道使用者的狀態（只有低精力才提示，避免每句都被干擾）
        try {
            const home = await SettingsDB.get('home_state');
            if (home && typeof home.energy === 'number') {
                // 精力只在開啟宅家時才會結算自然恢復，這裡用基本速度（每 6 分鐘 +1，不含家具加成）估算現在的值
                const regen = Math.max(0, Math.floor((Date.now() - (home.energyTs || Date.now())) / (6 * 60000)));
                const energy = Math.min(100, home.energy + regen);
                if (energy <= 30) {
                    systemMessages.push({ role: 'system', content: '【使用者近況】使用者在「宅家」裡的精力值偏低（' + energy + '%），看起來有點疲憊。可以自然地關心他，必要時提醒他休息，但不要每句話都提。' });
                }
            }
        } catch (e) { /* 讀不到就略過 */ }

        const minorPrompt = minorSafetyPrompt();
        if (minorPrompt) {
            systemMessages.push({ role: 'system', content: minorPrompt });
        }

        const charName = characterData?.name || 'AI';
        const rpPrompt = generateRPPrompt(charName);
        systemMessages.push({
            role: 'system',
            content: rpPrompt
        });
        
        const modePrompt = buildResponseModePrompt(chat?.response_mode, chat?.custom_response_prompt);
        if (modePrompt) {
            systemMessages.push({
                role: 'system',
                content: modePrompt
            });
        }
        
        const worldInfoOptions = {};
        if (characterData?.id) {
            worldInfoOptions.characterId = characterData.id;
        }
        if (userData?.id) {
            worldInfoOptions.userId = userData.id;
        }
        const worldInfoContext = await loadWorldInfoContext(chatId, userMessage, worldInfoOptions);
        
        const frontEntries = worldInfoContext.filter(e => e.priority === 'front');
        const middleEntries = worldInfoContext.filter(e => e.priority === 'middle');
        const backEntries = worldInfoContext.filter(e => e.priority === 'back');
        
        for (const entry of frontEntries) {
            if (entry.isForbidden) {
                systemMessages.push({
                    role: 'system',
                    content: `[FORBIDDEN]\n${entry.content}\n[/FORBIDDEN]`
                });
            } else {
                systemMessages.push({
                    role: 'system',
                    content: `[${entry.name}]\n${entry.content}`
                });
            }
        }
        
        let promptContent = '';
        if (characterData) {
            if (characterData.personality) {
                promptContent += characterData.personality;
            }
            if (characterData.scenario) {
                promptContent += '\n\n場景設定:\n' + characterData.scenario;
            }
        }
        
        if (memoryContext && memoryContext.length > 0) {
            const maxChars = Math.min(2000, (settings.context_size || 4096) * 0.3);
            let usedChars = 0;
            const memoryLines = [];
            for (const m of memoryContext) {
                const sanitized = (m.content || '').replace(/[\r\n]/g, ' ').replace(/\[.*?\]/g, '');
                const source = m.source_app && m.source_app !== 'chat' ? MEMORY_SOURCES.find(s => s.id === m.source_app)?.name : '';
                const line = `- ${source ? '（' + source + '）' : ''}${sanitized}`;
                if (usedChars + line.length > maxChars) break;
                memoryLines.push(line);
                usedChars += line.length;
            }
            if (memoryLines.length > 0) {
                promptContent += `\n\n[Related Memories]\n${memoryLines.join('\n')}`;
            }
        }
        
        if (promptContent) {
            systemMessages.push({
                role: 'system',
                content: promptContent
            });
        }
        
        for (const entry of middleEntries) {
            systemMessages.push({
                role: 'system',
                content: `[${entry.name}]\n${entry.content}`
            });
        }
        
        // 模型支援視覺時，把最近 3 張圖片真的送給模型；其餘退回文字標記
        // 最後一則使用者文字訊息已經存在資料庫裡（傳送時就存了），下面會再把它（附上回應格式提醒）接在最後，
        // 所以這裡先從歷史拿掉，避免同一句話在提示詞裡出現兩次
        const lastStored = messages[messages.length - 1];
        const historyMessages = (lastStored && lastStored.role === 'user' && (!lastStored.type || lastStored.type === 'text') && lastStored.content === userMessage)
            ? messages.slice(0, -1)
            : messages;
        const visionIds = new Set(settings.vision_enabled
            ? historyMessages.filter(m => m.type === 'image' && m.meta?.src).slice(-3).map(m => m.id)
            : []);
        const conversationMessages = historyMessages.map(m => ({
            role: m.role,
            content: visionIds.has(m.id)
                ? [
                    { type: 'text', text: m.content || '圖片' },
                    { type: 'image_url', image_url: { url: m.meta.src } }
                ]
                : (m.role === 'assistant' ? cleanAssistantText(describeMessageForAI(m)) : describeMessageForAI(m))
        }));
        
        const backMessages = backEntries.map(entry => ({
            role: 'system',
            content: `[${entry.name}]\n${entry.content}`
        }));
        
        return [
            ...systemMessages,
            ...conversationMessages,
            { role: 'user', content: withResponseReminder(userMessage, chat?.response_mode, chat?.custom_response_prompt) },
            ...backMessages
        ];
    },
    
    // 輸出的 token 上限：預設看上下文大小；回應模式（例如單句）有自己的上限時以它為準
    outputLimit(settings) {
        return Math.min(4096, settings.output_max_tokens || settings.context_size || 4096);
    },

    async stream(chatId, userMessage, onChunk, onComplete, onError, options = {}) {
        const settings = await this.getSettings();
        
        if (!settings.api_url || !settings.api_key) {
            const errorMsg = 'API URL 或 API Key 未設定。請前往設定頁面進行配置。';
            onError(errorMsg);
            this.showError({ message: errorMsg, title: '設定錯誤' });
            return;
        }
        
        const { MessagesDB, CharactersDB, UsersDB, ChatsDB } = await import('./db.js');
        const messages = await MessagesDB.getByChatId(chatId);
        
        const chat = await ChatsDB.getById(chatId);
        settings.output_max_tokens = getResponseMode(chat?.response_mode, chat?.custom_response_prompt).maxTokens || undefined;
        const enabledMcpIds = chat?.enabled_mcp_ids || null;
        
        let characterData = null;
        if (options.characterId) {
            characterData = await CharactersDB.getById(options.characterId);
        } else {
            characterData = await this.getCharacterData(chatId);
        }
        
        let userData = null;
        if (characterData?.bound_user_id) {
            userData = await UsersDB.getById(characterData.bound_user_id);
        } else {
            userData = await this.getUserData(chatId);
        }
        
        let memoryContext = null;
        if (settings.memory_enabled && window.App?.memorySystem) {
            try {
                // 只取這個角色自己的記憶，避免其他角色的對話內容混進來
                // 套用「記憶設定」的來源／虛構內容偏好；其他 App 寫入的記憶會標示來源
                memoryContext = await window.App.memorySystem.retrieveMemories(
                    userMessage, chatId, 5, await buildMemoryFilters({ characterId: characterData?.id })
                );
            } catch {
                memoryContext = null;
            }
        }

        await mcpManager.loadConfigs();
        const characterId = characterData?.id || null;
        const mcpTools = chat?.mcp_enabled === false ? [] : mcpManager.getToolsForLLM(characterId, enabledMcpIds);
        
        const apiMessages = await this.buildMessages(chatId, userMessage, settings, messages, memoryContext, characterData, userData);
        
        try {
            const requestBody = {
                model: settings.model || 'gpt-3.5-turbo',
                messages: apiMessages,
                temperature: settings.temperature || 0.7,
                top_p: settings.top_p || 1.0,
                frequency_penalty: settings.frequency_penalty || 0,
                presence_penalty: settings.presence_penalty || 0,
                max_tokens: this.outputLimit(settings),
                stream: true
            };
            
            if (mcpTools.length > 0) {
                requestBody.tools = mcpTools;
                requestBody.tool_choice = 'auto';
            }
            
            const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.api_key}`
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API 錯誤: ${response.status}`);
            }
            
            await this.processStreamWithTools(response, apiMessages, settings, characterData, onChunk, onComplete, onError);
            
        } catch (error) {
            const errorMsg = error.message || '連線失敗，請檢查網路設定。';
            onError(errorMsg);
            this.showError({
                message: errorMsg,
                title: 'API 請求失敗',
                details: error.stack || ''
            });
        }
    },
    
    // 非串流的單次補全，供總結、思維鏈、日記等輔助功能使用；失敗時丟出 Error
    async complete(messages, options = {}) {
        const settings = await this.getSettings();
        if (!settings.api_url || !settings.api_key) {
            throw new Error('API URL 或 API Key 未設定。請前往設定頁面進行配置。');
        }
        const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${settings.api_key}`
            },
            body: JSON.stringify({
                model: settings.model || 'gpt-3.5-turbo',
                messages,
                temperature: options.temperature ?? settings.temperature ?? 0.7,
                max_tokens: options.maxTokens || 1024,
                stream: false
            })
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API 錯誤: ${response.status}`);
        }
        const data = await response.json();
        const text = stripReasoning(data.choices?.[0]?.message?.content);
        if (!text) throw new Error('模型沒有回傳內容');
        return text;
    },

    async processStreamWithTools(response, apiMessages, settings, characterData, onChunk, onComplete, onError, options = {}) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let lastVisible = '';
        let toolCalls = [];
        let currentToolCall = null;
        let buffer = '';
        
        const processLine = (line) => {
            if (!line.startsWith('data: ')) return;
            
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
                const parsed = JSON.parse(data);
                const delta = parsed.choices?.[0]?.delta;
                
                if (delta?.content) {
                    fullContent += delta.content;
                    const visible = stripReasoning(fullContent, { streaming: true });
                    const piece = visible.startsWith(lastVisible) ? visible.slice(lastVisible.length) : '';
                    lastVisible = visible;
                    onChunk(piece, visible);
                }
                
                if (delta?.tool_calls) {
                    for (const toolCallDelta of delta.tool_calls) {
                        const index = toolCallDelta.index;
                        
                        if (!toolCalls[index]) {
                            toolCalls[index] = {
                                id: toolCallDelta.id,
                                type: 'function',
                                function: {
                                    name: '',
                                    arguments: ''
                                }
                            };
                        }
                        
                        if (toolCallDelta.id) {
                            toolCalls[index].id = toolCallDelta.id;
                        }
                        if (toolCallDelta.function?.name) {
                            toolCalls[index].function.name = toolCallDelta.function.name;
                        }
                        if (toolCallDelta.function?.arguments) {
                            toolCalls[index].function.arguments += toolCallDelta.function.arguments;
                        }
                    }
                }
            } catch (e) {
            }
        };
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';
            
            for (const line of lines) {
                processLine(line);
            }
        }
        
        buffer += decoder.decode();
        if (buffer.trim()) {
            processLine(buffer);
        }
        
        if (toolCalls.length > 0) {
            await this.handleToolCalls(toolCalls, apiMessages, settings, characterData, onChunk, onComplete, onError);
        } else if (fullContent) {
            const finalContent = stripReasoning(fullContent);
            if (!finalContent) {
                onError('模型只輸出了思考過程、沒有正式回覆，請重新生成');
            } else if (options.skipVerify) {
                onComplete(finalContent);
            } else {
                await this.verifyReply(apiMessages, finalContent, settings, characterData, onChunk, onComplete, onError);
            }
        } else {
            onComplete('');
        }
    },
    
    async verifyReply(apiMessages, draftContent, settings, characterData, onChunk, onComplete, onError) {
        const verifyMessages = [
            ...apiMessages,
            { role: 'assistant', content: draftContent },
            {
                role: 'user',
                content: '請檢查你剛才的那則回覆：句子是否完整、語氣是否符合角色、是否使用自然口語（避免文言文或書面語）。同時確認回覆的格式與長度符合上面最後一則使用者訊息結尾的「回應格式」要求。如果沒有問題，就直接原樣重複一次；如果有問題，修正後重新輸出完整回覆。只輸出回覆內容本身，不要解釋或說明。'
            }
        ];
        
        try {
            const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.api_key}`
                },
                body: JSON.stringify({
                    model: settings.model || 'gpt-3.5-turbo',
                    messages: verifyMessages,
                    temperature: settings.temperature || 0.7,
                    top_p: settings.top_p || 1.0,
                    frequency_penalty: settings.frequency_penalty || 0,
                    presence_penalty: settings.presence_penalty || 0,
                    max_tokens: this.outputLimit(settings),
                    stream: true
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API 錯誤: ${response.status}`);
            }
            
            // 檢查那一輪若只回了思考過程（沒有正式內容），沿用原本的草稿，不要當成錯誤
            await this.processStreamWithTools(response, verifyMessages, settings, characterData, onChunk, onComplete, () => onComplete(draftContent), { skipVerify: true });
            
        } catch (error) {
            console.error('[API] Reply verification failed, using draft:', error);
            onComplete(draftContent);
        }
    },
    
    async handleToolCalls(toolCalls, apiMessages, settings, characterData, onChunk, onComplete, onError) {
        const toolMessages = [];
        
        const context = {
            characterId: characterData?.id || null,
            characterName: characterData?.name || null,
            characterPersonality: characterData?.personality || null
        };
        
        for (const toolCall of toolCalls) {
            const toolName = toolCall.function.name;
            let toolArgs = {};
            
            try {
                toolArgs = JSON.parse(toolCall.function.arguments);
            } catch (e) {
                toolArgs = {};
            }
            
            const tool = mcpManager.findToolByName(toolName);
            
            if (tool) {
                try {
                    const result = await mcpManager.callTool(tool.mcpId, toolName, toolArgs, context);
                    
                    toolMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: toolName,
                        content: JSON.stringify(result.success ? result.result : { error: result.error })
                    });
                } catch (error) {
                    toolMessages.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: toolName,
                        content: JSON.stringify({ error: error.message })
                    });
                }
            } else {
                toolMessages.push({
                    role: 'tool',
                    tool_call_id: toolCall.id,
                    name: toolName,
                    content: JSON.stringify({ error: `Tool ${toolName} not found` })
                });
            }
        }
        
        apiMessages.push({
            role: 'assistant',
            tool_calls: toolCalls
        });
        
        for (const toolMsg of toolMessages) {
            apiMessages.push(toolMsg);
        }
        
        try {
            const followUpResponse = await fetch(`${settings.api_url}/v1/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.api_key}`
                },
                body: JSON.stringify({
                    model: settings.model || 'gpt-3.5-turbo',
                    messages: apiMessages,
                    temperature: settings.temperature || 0.7,
                    top_p: settings.top_p || 1.0,
                    frequency_penalty: settings.frequency_penalty || 0,
                    presence_penalty: settings.presence_penalty || 0,
                    max_tokens: this.outputLimit(settings),
                    stream: true
                })
            });
            
            if (!followUpResponse.ok) {
                const errorData = await followUpResponse.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API 錯誤: ${followUpResponse.status}`);
            }
            
            await this.processStreamWithTools(followUpResponse, apiMessages, settings, characterData, onChunk, onComplete, onError);
            
        } catch (error) {
            const errorMsg = error.message || '工具調用後續處理失敗。';
            onError(errorMsg);
            this.showError({
                message: errorMsg,
                title: 'API 請求失敗',
                details: error.stack || ''
            });
        }
    },
    
    async groupStream(chatId, userMessage, memberCharacterIds, callbacks) {
        const promises = memberCharacterIds.map((memberId, index) => {
            return this.stream(chatId, userMessage,
                callbacks[index].onChunk,
                callbacks[index].onComplete,
                callbacks[index].onError,
                { characterId: memberId }
            );
        });
        return Promise.allSettled(promises);
    },
    
    async groupBuildMessages(chatId, userMessage, characterId, settings, messages, memoryContext = null) {
        const { CharactersDB, UsersDB } = await import('./db.js');
        const characterData = characterId ? await CharactersDB.getById(characterId) : null;
        let userData = null;
        if (characterData?.bound_user_id) {
            userData = await UsersDB.getById(characterData.bound_user_id);
        }
        return this.buildMessages(chatId, userMessage, settings, messages, memoryContext, characterData, userData);
    },
    
    async testConnection() {
        const settings = await this.getSettings();
        
        if (!settings.api_url) {
            return { success: false, message: 'API URL 未設定' };
        }
        
        try {
            const response = await fetch(`${settings.api_url}/v1/models`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${settings.api_key || ''}`
                }
            });
            
            if (response.ok) {
                return { success: true, message: '連線成功' };
            } else {
                return { success: false, message: `錯誤: ${response.status}` };
            }
        } catch (error) {
            return { success: false, message: error.message || '連線失敗' };
        }
    },
    
    buildZiweiContext(cache) {
        const { fortune_summary, liu_ri_temple, events, sihua } = cache;
        
        if (!fortune_summary || !liu_ri_temple) return null;
        
        let context = '[今日命理提示]\n';
        context += `流日命宮：${liu_ri_temple}\n`;
        context += `整體運勢：${fortune_summary.daily || '暫無資料'}\n`;
        // 命盤本身與流年焦點（由真實排盤產生；舊版快取沒有這兩欄就略過）
        if (fortune_summary.base) context += `命盤：${fortune_summary.base}\n`;
        if (fortune_summary.yearly) context += `流年：${fortune_summary.yearly}\n`;
        
        if (sihua) {
            const sihuaParts = [];
            if (sihua.祿) sihuaParts.push(`祿(${sihua.祿})`);
            if (sihua.權) sihuaParts.push(`權(${sihua.權})`);
            if (sihua.科) sihuaParts.push(`科(${sihua.科})`);
            if (sihua.忌) sihuaParts.push(`忌(${sihua.忌})`);
            if (sihuaParts.length > 0) {
                context += `四化：${sihuaParts.join(' ')}\n`;
            }
        }
        
        if (events && events.length > 0) {
            const topEvents = events.filter(e => e.confidence > 0.7).slice(0, 3);
            if (topEvents.length > 0) {
                context += `可能事件：${topEvents.map(e => e.description).join('、')}\n`;
            }
        }
        
        context += '\n這些是命盤上的客觀資訊（各宮位代表的關注面向），不是吉凶預言。請根據它們，自然地融入角色的日常對話中，不要斷言會發生什麼事。';
        context += '例如：流日命宮在財帛宮時，角色可能隨口聊到買東西或理財的小事；在疾厄宮時，可能關心作息與身體。';
        
        return context;
    }
};

export default APIClient;
