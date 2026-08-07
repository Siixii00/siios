import Router from './router.js';
import { SettingsDB, ChatsDB, CharactersDB, UsersDB, HealthDB, ZiweiCacheDB } from './db.js';
import { loadWorldInfoContext } from './core/world-info-loader.js';
import { generateRPPrompt } from './constants/rp-system-prompt.js';
import { buildRealWorldContext } from './core/real-world-context.js';
import { PeriodCalculator } from './core/period-calculator.js';
import { createErrorModal } from './components.js';
import { mcpManager } from './core/mcp-client.js';

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
        
        const charName = characterData?.name || 'AI';
        const rpPrompt = generateRPPrompt(charName);
        systemMessages.push({
            role: 'system',
            content: rpPrompt
        });
        
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
                const line = `- ${sanitized}`;
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
        
        const conversationMessages = messages.map(m => ({
            role: m.role,
            content: m.content
        }));
        
        const backMessages = backEntries.map(entry => ({
            role: 'system',
            content: `[${entry.name}]\n${entry.content}`
        }));
        
        return [
            ...systemMessages,
            ...conversationMessages,
            { role: 'user', content: userMessage },
            ...backMessages
        ];
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
                memoryContext = await window.App.memorySystem.retrieveMemories(
                    userMessage, chatId, 5
                );
            } catch {
                memoryContext = null;
            }
        }

        await mcpManager.loadConfigs();
        const characterId = characterData?.id || null;
        const mcpTools = mcpManager.getToolsForLLM(characterId, enabledMcpIds);
        
        const apiMessages = await this.buildMessages(chatId, userMessage, settings, messages, memoryContext, characterData, userData);
        
        try {
            const requestBody = {
                model: settings.model || 'gpt-3.5-turbo',
                messages: apiMessages,
                temperature: settings.temperature || 0.7,
                top_p: settings.top_p || 1.0,
                frequency_penalty: settings.frequency_penalty || 0,
                presence_penalty: settings.presence_penalty || 0,
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
    
    async processStreamWithTools(response, apiMessages, settings, characterData, onChunk, onComplete, onError) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        let toolCalls = [];
        let currentToolCall = null;
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        const delta = parsed.choices?.[0]?.delta;
                        
                        if (delta?.content) {
                            fullContent += delta.content;
                            onChunk(delta.content, fullContent);
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
                }
            }
        }
        
        if (toolCalls.length > 0) {
            await this.handleToolCalls(toolCalls, apiMessages, settings, characterData, onChunk, onComplete, onError);
        } else if (fullContent) {
            onComplete(fullContent);
        } else {
            onComplete('');
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
        
        context += '\n請根據這些命理資訊，自然地融入角色的日常對話中。';
        context += '例如：如果運勢提到「精力充沛」，角色可能會主動提議外出或運動。';
        
        return context;
    }
};

export default APIClient;
