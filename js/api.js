import Router from './router.js';
import { SettingsDB, ChatsDB, CharactersDB, UsersDB, HealthDB } from './db.js';
import { loadWorldInfoContext } from './core/world-info-loader.js';
import { generateRPPrompt } from './constants/rp-system-prompt.js';
import { buildRealWorldContext } from './core/real-world-context.js';
import { PeriodCalculator } from './core/period-calculator.js';

const APIClient = {
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
                // Health info not available, continue
            }
        }
        
        const charName = characterData?.name || 'AI';
        const rpPrompt = generateRPPrompt(charName);
        systemMessages.push({
            role: 'system',
            content: rpPrompt
        });
        
        const worldInfoContext = await loadWorldInfoContext(chatId, userMessage);
        
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
    
    async stream(chatId, userMessage, onChunk, onComplete, onError) {
        const settings = await this.getSettings();
        
        if (!settings.api_url || !settings.api_key) {
            onError('API URL 或 API Key 未設定。請前往設定頁面進行配置。');
            return;
        }
        
        const { MessagesDB } = await import('./db.js');
        const messages = await MessagesDB.getByChatId(chatId);
        
        const characterData = await this.getCharacterData(chatId);
        const userData = await this.getUserData(chatId);
        
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
        
        const apiMessages = await this.buildMessages(chatId, userMessage, settings, messages, memoryContext, characterData, userData);
        
        try {
            const response = await fetch(`${settings.api_url}/v1/chat/completions`, {
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
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error?.message || `API 錯誤: ${response.status}`);
            }
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullContent = '';
            
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
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                fullContent += content;
                                onChunk(content, fullContent);
                            }
                        } catch (e) {
                        }
                    }
                }
            }
            
            onComplete(fullContent);
            
        } catch (error) {
            onError(error.message || '連線失敗，請檢查網路設定。');
        }
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
    }
};

export default APIClient;
