import Router from './router.js';
import { SettingsDB, WorldInfoDB } from './db.js';

const APIClient = {
    async getSettings() {
        return SettingsDB.getAll();
    },
    
    buildMessages(chatId, userMessage, settings, messages) {
        const systemMessages = [];
        
        const systemPrompt = settings.system_prompt || 'You are a helpful AI assistant.';
        systemMessages.push({
            role: 'system',
            content: systemPrompt
        });
        
        return [...systemMessages, ...messages.map(m => ({
            role: m.role,
            content: m.content
        })), {
            role: 'user',
            content: userMessage
        }];
    },
    
    async stream(chatId, userMessage, onChunk, onComplete, onError) {
        const settings = await this.getSettings();
        
        if (!settings.api_url || !settings.api_key) {
            onError('API URL 或 API Key 未設定。請前往設定頁面進行配置。');
            return;
        }
        
        const { MessagesDB } = await import('./db.js');
        const messages = await MessagesDB.getByChatId(chatId);
        const apiMessages = this.buildMessages(chatId, userMessage, settings, messages);
        
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
                            // Skip invalid JSON
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