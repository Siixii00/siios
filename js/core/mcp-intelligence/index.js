import { MemoryDB, HealthDB, MCPConfigDB, CharactersDB, WikiRecordsDB } from '../db.js';

export class IntelligentMCPInvoker {
    constructor(characterId, userId) {
        this.characterId = characterId;
        this.userId = userId;
        this.mcpConfigs = [];
        this.recentMemories = [];
        this.healthData = [];
        this.contextAnalysis = null;
        this.character = null;
        this.worldBook = [];
        this.personalityStyle = null;
    }

    async initialize() {
        await this.loadMCPConfigs();
        await this.loadRecentMemories();
        await this.loadHealthData();
        await this.loadCharacter();
        await this.loadWorldBook();
    }

    async loadMCPConfigs() {
        const allConfigs = await MCPConfigDB.getAll();
        this.mcpConfigs = allConfigs.filter(config => 
            config.enabled && 
            (!config.bound_character_id || config.bound_character_id === this.characterId)
        );
    }

    async loadRecentMemories(limit = 50) {
        this.recentMemories = await MemoryDB.getByCharacter(this.characterId, limit);
    }

    async loadHealthData() {
        if (this.userId) {
            this.healthData = await HealthDB.getByUserId(this.userId);
        }
    }

    async loadCharacter() {
        this.character = await CharactersDB.getById(this.characterId);
        if (this.character) {
            this.personalityStyle = {
                name: this.character.name,
                personality: this.character.personality || '',
                description: this.character.description || '',
                scenario: this.character.scenario || '',
                first_mes: this.character.first_mes || '',
                mes_example: this.character.mes_example || ''
            };
        }
    }

    async loadWorldBook() {
        this.worldBook = await WikiRecordsDB.getByCharacterId(this.characterId);
    }

    searchWorldBook(query) {
        if (!this.worldBook || this.worldBook.length === 0) return [];

        const results = [];
        const queryLower = query.toLowerCase();

        this.worldBook.forEach(entry => {
            if (entry.keywords && Array.isArray(entry.keywords)) {
                const matchedKeywords = entry.keywords.filter(kw => 
                    queryLower.includes(kw.toLowerCase())
                );

                if (matchedKeywords.length > 0) {
                    results.push({
                        entry,
                        matchedKeywords,
                        relevance: matchedKeywords.length / entry.keywords.length
                    });
                }
            } else if (entry.content && entry.content.toLowerCase().includes(queryLower)) {
                results.push({
                    entry,
                    matchedKeywords: [query],
                    relevance: 0.5
                });
            }
        });

        return results.sort((a, b) => b.relevance - a.relevance).slice(0, 5);
    }

    getRelevantWorldBookContext(userMessage) {
        const matches = this.searchWorldBook(userMessage);
        
        if (matches.length === 0) return null;

        return {
            entries: matches.map(m => m.entry),
            context: matches.map(m => m.entry.content).join('\n\n')
        };
    }

    async analyzeContext(userMessage) {
        const context = {
            userMessage: userMessage,
            keywords: this.extractKeywords(userMessage),
            sentiment: await this.analyzeSentiment(userMessage),
            healthContext: this.analyzeHealthContext(),
            memoryContext: this.analyzeMemoryContext(),
            worldBookContext: this.getRelevantWorldBookContext(userMessage),
            characterPersonality: this.personalityStyle,
            possibleNeeds: [],
            recommendedTools: [],
            reasoning: ''
        };

        context.possibleNeeds = this.inferPossibleNeeds(context);
        context.recommendedTools = this.recommendTools(context);
        context.reasoning = this.generateReasoning(context);

        this.contextAnalysis = context;
        return context;
    }

    extractKeywords(message) {
        const healthKeywords = [
            '不舒服', '痛', '頭痛', '肚子痛', '感冒', '發燒', '咳嗽', '疲勞', '累',
            '經期', '生理期', '月經', '懷孕', '藥', '吃藥', '生病', '過敏'
        ];

        const shoppingKeywords = [
            '買', '購買', '訂購', '需要', '缺', '不夠', '忘了買', '訂', '下單'
        ];

        const dailyKeywords = [
            '天氣', '提醒', '行程', '會議', '約會', '餐', '吃', '食譜', '煮'
        ];

        const foundKeywords = {
            health: healthKeywords.filter(kw => message.includes(kw)),
            shopping: shoppingKeywords.filter(kw => message.includes(kw)),
            daily: dailyKeywords.filter(kw => message.includes(kw))
        };

        return foundKeywords;
    }

    async analyzeSentiment(message) {
        const negativeWords = ['不舒服', '痛', '難過', '累', '煩', '不舒服', '生病'];
        const positiveWords = ['開心', '快樂', '好', '棒', '喜歡'];

        let sentiment = 'neutral';
        let intensity = 0;

        for (const word of negativeWords) {
            if (message.includes(word)) {
                sentiment = 'negative';
                intensity += 0.3;
            }
        }

        for (const word of positiveWords) {
            if (message.includes(word)) {
                sentiment = 'positive';
                intensity += 0.3;
            }
        }

        return { sentiment, intensity: Math.min(1, intensity) };
    }

    analyzeHealthContext() {
        if (this.healthData.length === 0) return null;

        const recentHealth = this.healthData.slice(-10);
        const medications = recentHealth.filter(h => h.type === 'medication');
        const periods = recentHealth.filter(h => h.type === 'period');
        const moods = recentHealth.filter(h => h.type === 'mood');

        return {
            medications,
            periods,
            moods,
            lastMedication: medications[medications.length - 1],
            lastPeriod: periods[periods.length - 1],
            avgMood: moods.length > 0 ? 
                moods.reduce((sum, m) => sum + (m.score || 0), 0) / moods.length : null
        };
    }

    analyzeMemoryContext() {
        if (this.recentMemories.length === 0) return null;

        const recentTopics = new Map();
        const recentEntities = new Map();

        this.recentMemories.slice(-20).forEach(memory => {
            if (memory.classification?.topics) {
                memory.classification.topics.forEach(topic => {
                    recentTopics.set(topic, (recentTopics.get(topic) || 0) + 1);
                });
            }

            if (memory.classification?.entities) {
                memory.classification.entities.forEach(entity => {
                    recentEntities.set(entity, (recentEntities.get(entity) || 0) + 1);
                });
            }
        });

        return {
            recentTopics: Array.from(recentTopics.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10),
            recentEntities: Array.from(recentEntities.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
        };
    }

    inferPossibleNeeds(context) {
        const needs = [];
        const { keywords, healthContext, memoryContext } = context;

        if (keywords.health.length > 0) {
            if (keywords.health.includes('經期') || keywords.health.includes('生理期') || keywords.health.includes('月經')) {
                needs.push({
                    type: 'health_period',
                    confidence: 0.8,
                    description: '使用者可能需要生理期相關協助',
                    suggestedActions: ['記錄經期', '購買衛生用品', '休息建議']
                });
            }

            if (keywords.health.includes('不舒服') || keywords.health.includes('生病') || keywords.health.includes('感冒')) {
                needs.push({
                    type: 'health_issue',
                    confidence: 0.7,
                    description: '使用者身體不適',
                    suggestedActions: ['症狀查詢', '就醫建議', '購買藥品']
                });
            }

            if (keywords.health.includes('藥') || keywords.health.includes('吃藥')) {
                needs.push({
                    type: 'medication',
                    confidence: 0.85,
                    description: '使用者需要藥物相關協助',
                    suggestedActions: ['用藥提醒', '購買藥品', '記錄用藥']
                });
            }
        }

        if (keywords.shopping.length > 0) {
            needs.push({
                type: 'shopping',
                confidence: 0.75,
                description: '使用者需要購物協助',
                suggestedActions: ['搜尋商品', '下單購買', '價格比較']
            });
        }

        if (keywords.daily.includes('天氣')) {
            needs.push({
                type: 'weather',
                confidence: 0.9,
                description: '使用者想知道天氣資訊',
                suggestedActions: ['查詢天氣', '穿搭建議']
            });
        }

        if (healthContext?.lastMedication) {
            const lastMedTime = new Date(healthContext.lastMedication.timestamp || healthContext.lastMedTime);
            const hoursSinceLastMed = (Date.now() - lastMedTime.getTime()) / (1000 * 60 * 60);

            if (hoursSinceLastMed > 8) {
                needs.push({
                    type: 'medication_reminder',
                    confidence: 0.6,
                    description: '可能需要用藥提醒',
                    suggestedActions: ['設定提醒']
                });
            }
        }

        return needs;
    }

    recommendTools(context) {
        const recommendations = [];

        context.possibleNeeds.forEach(need => {
            const matchingTools = this.findMatchingTools(need);
            recommendations.push(...matchingTools.map(tool => ({
                tool,
                need,
                confidence: need.confidence * 0.9,
                reason: `因為 ${need.description}，推薦使用 ${tool.displayName}`
            })));
        });

        return recommendations.sort((a, b) => b.confidence - a.confidence);
    }

    findMatchingTools(need) {
        const toolMapping = {
            'health_period': ['health_period_log', 'shop_sanitary_pads'],
            'health_issue': ['daily_weather', 'health_mood_track'],
            'medication': ['health_medication', 'daily_reminder'],
            'medication_reminder': ['daily_reminder', 'health_medication'],
            'shopping': ['shop_sanitary_pads', 'taobao_search', 'daily_recipe'],
            'weather': ['daily_weather']
        };

        const matchingToolIds = toolMapping[need.type] || [];

        return matchingToolIds.map(toolId => {
            return this.mcpConfigs.reduce((found, config) => {
                if (found) return found;
                return config.tools?.find(t => t.name === toolId);
            }, null);
        }).filter(Boolean);
    }

    generateReasoning(context) {
        let reasoning = '根據分析：\n';

        if (context.worldBookContext) {
            reasoning += `- 世界書匹配：找到 ${context.worldBookContext.entries.length} 個相關條目\n`;
            reasoning += `  內容摘要：${context.worldBookContext.context.substring(0, 100)}...\n`;
        }

        if (context.characterPersonality) {
            reasoning += `- 角色性格：${context.characterPersonality.traits.join('、')}\n`;
        }

        if (context.keywords.health.length > 0) {
            reasoning += `- 偵測到健康相關關鍵字：${context.keywords.health.join('、')}\n`;
        }

        if (context.healthContext) {
            if (context.healthContext.lastMedication) {
                reasoning += `- 最近有用藥記錄：${context.healthContext.lastMedication.medication_name || '未知名稱'}\n`;
            }
            if (context.healthContext.lastPeriod) {
                const lastPeriodDate = new Date(context.healthContext.lastPeriod.date);
                reasoning += `- 上次經期：${lastPeriodDate.toLocaleDateString()}\n`;
            }
        }

        if (context.memoryContext?.recentTopics.length > 0) {
            const topTopics = context.memoryContext.recentTopics.slice(0, 3).map(([topic]) => topic);
            reasoning += `- 最近討論話題：${topTopics.join('、')}\n`;
        }

        if (context.possibleNeeds.length > 0) {
            reasoning += `\n推測需求：\n`;
            context.possibleNeeds.forEach(need => {
                reasoning += `- ${need.description}（信心度：${(need.confidence * 100).toFixed(0)}%）\n`;
            });
        }

        if (context.recommendedTools.length > 0) {
            reasoning += `\n推薦工具：\n`;
            context.recommendedTools.slice(0, 3).forEach(rec => {
                reasoning += `- ${rec.tool.displayName}：${rec.reason}\n`;
            });
        }

        return reasoning;
    }

    generateCharacterResponse(template, context) {
        if (!this.personalityStyle) {
            return template;
        }

        const charName = this.personalityStyle.name;
        const sentiment = context?.sentiment?.sentiment || 'neutral';

        return template;
    }

    askForConfirmation() {
        if (!this.contextAnalysis || this.contextAnalysis.possibleNeeds.length === 0) {
            return null;
        }

        const topNeed = this.contextAnalysis.possibleNeeds[0];
        const topTool = this.contextAnalysis.recommendedTools[0];

        if (!topTool) return null;

        const action = topNeed.suggestedActions[0];
        const charName = this.personalityStyle?.name || '我';

        const questionTemplate = `我看你${topNeed.description}，是不是需要我幫你${action}？`;

        const finalQuestion = this.generateCharacterResponse(questionTemplate, this.contextAnalysis);

        return {
            type: 'confirmation_needed',
            need: topNeed,
            tool: topTool,
            question: finalQuestion,
            reasoning: this.contextAnalysis.reasoning,
            characterName: charName,
            characterData: this.character,
            worldBookContext: this.contextAnalysis.worldBookContext
        };
    }

    async invokeTool(toolName, args = {}) {
        const config = this.mcpConfigs.find(c => 
            c.tools?.some(t => t.name === toolName)
        );

        if (!config) {
            throw new Error(`找不到工具 ${toolName} 的配置`);
        }

        try {
            const response = await fetch(`${config.endpoint}/tools/call`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${config.apiKey}`
                },
                body: JSON.stringify({
                    name: toolName,
                    arguments: args
                })
            });

            if (!response.ok) {
                throw new Error(`工具調用失敗：${response.statusText}`);
            }

            const result = await response.json();
            
            await this.learnFromInvocation(toolName, args, result);

            const characterResponse = this.generateToolResultResponse(toolName, result);

            return {
                ...result,
                characterResponse
            };
        } catch (error) {
            console.error('[MCP] 工具調用錯誤:', error);
            throw error;
        }
    }

    generateToolResultResponse(toolName, result) {
        if (!this.personalityStyle) {
            return `已執行 ${toolName}`;
        }

        const charName = this.personalityStyle.name;
        const success = result.success !== false;

        if (!success) {
            return `${charName}試過了，但好像出了點問題...`;
        }

        if (toolName.includes('shop') || toolName.includes('order')) {
            return `${charName}已經幫你下單囉！預計 ${result.result?.estimatedDelivery || '3-5天'} 送到。`;
        }

        if (toolName.includes('health') || toolName.includes('medication')) {
            return `${charName}已經幫你記錄下來了！`;
        }

        return `${charName}已經幫你處理好了！`;
    }

    async learnFromInvocation(toolName, args, result) {
        const learning = {
            tool_name: toolName,
            args: args,
            result: result,
            context_summary: this.contextAnalysis?.reasoning || '',
            user_need: this.contextAnalysis?.possibleNeeds[0]?.type || 'unknown',
            timestamp: new Date().toISOString(),
            success: result.success !== false
        };

        await MemoryDB.create({
            chat_id: this.recentMemories[0]?.chat_id || 'unknown',
            character_id: this.characterId,
            content: `MCP 工具調用學習：${toolName}`,
            source_app: 'mcp',
            source_type: 'tool_invocation',
            metadata: learning,
            memory_level: 'semantic',
            importance: 0.7
        });

        console.log('[MCP] 已學習此次調用經驗');
    }

    async executeWithLearning(userMessage) {
        await this.initialize();

        const context = await this.analyzeContext(userMessage);

        const confirmation = await this.askForConfirmation();
        if (confirmation) {
            return {
                status: 'confirmation_needed',
                confirmation,
                context
            };
        }

        if (context.recommendedTools.length > 0 && context.possibleNeeds[0]?.confidence > 0.8) {
            const topRecommendation = context.recommendedTools[0];
            
            try {
                const result = await this.invokeTool(topRecommendation.tool.name);
                
                return {
                    status: 'executed',
                    tool: topRecommendation.tool,
                    result,
                    context
                };
            } catch (error) {
                return {
                    status: 'error',
                    error: error.message,
                    context
                };
            }
        }

        return {
            status: 'no_action_needed',
            context
        };
    }
}

export async function createIntelligentMCP(characterId, userId) {
    const invoker = new IntelligentMCPInvoker(characterId, userId);
    await invoker.initialize();
    return invoker;
}