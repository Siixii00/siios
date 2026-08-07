import { createIntelligentMCP } from './mcp-intelligence/index.js';
import { WikiRecordsDB } from '../db.js';

export class ChatMCPHandler {
    constructor(chatId, characterId, userId) {
        this.chatId = chatId;
        this.characterId = characterId;
        this.userId = userId;
        this.invoker = null;
        this.autoWikiEnabled = true;
        this.autoMCPEnabled = true;
    }

    async initialize() {
        this.invoker = await createIntelligentMCP(this.characterId, this.userId);
    }

    async processUserMessage(userMessage, fullContext) {
        if (!this.invoker) {
            await this.initialize();
        }

        const allMessages = fullContext || [];
        const recentMessages = allMessages.slice(-20);

        const analysisResult = await this.analyzeAndAct(userMessage, recentMessages);

        if (analysisResult.shouldAutoWiki) {
            await this.autoSaveToWiki(analysisResult.wikiContent);
        }

        return analysisResult;
    }

    async analyzeAndAct(userMessage, recentMessages) {
        const result = await this.invoker.executeWithLearning(userMessage);

        const analysis = {
            mcpAction: null,
            characterResponse: null,
            shouldAutoWiki: false,
            wikiContent: null,
            context: result.context
        };

        if (result.status === 'confirmation_needed') {
            analysis.characterResponse = {
                type: 'mcp_confirmation',
                message: result.confirmation.question,
                tool: result.confirmation.tool,
                onConfirm: async () => {
                    return await this.executeTool(result.confirmation.tool.name);
                },
                onDecline: () => {
                    return null;
                }
            };
        } else if (result.status === 'executed') {
            analysis.characterResponse = {
                type: 'mcp_executed',
                message: result.characterResponse,
                tool: result.tool
            };
        }

        analysis.shouldAutoWiki = this.shouldSaveToWiki(userMessage, recentMessages);
        if (analysis.shouldAutoWiki) {
            analysis.wikiContent = this.extractWikiContent(userMessage, recentMessages);
        }

        return analysis;
    }

    shouldSaveToWiki(userMessage, recentMessages) {
        const importantKeywords = [
            '想要', '希望', '目標', '計劃', '存錢', '買', '夢想',
            '喜歡', '討厭', '愛吃', '不吃', '過敏',
            '生日', '紀念日', '重要', '日期',
            '電話', '地址', '密碼', '帳號'
        ];

        const hasImportantInfo = importantKeywords.some(kw => 
            userMessage.includes(kw)
        );

        if (hasImportantInfo) {
            const lastWikiSave = recentMessages.find(msg => 
                msg.metadata?.auto_wiki_saved === true
            );
            
            if (!lastWikiSave || Date.now() - new Date(lastWikiSave.timestamp).getTime() > 60000) {
                return true;
            }
        }

        return false;
    }

    extractWikiContent(userMessage, recentMessages) {
        const categories = {
            financial: {
                keywords: ['存錢', '理財', '投資', '目標', '存款'],
                title: '理財目標',
                type: 'financial_goal'
            },
            preference: {
                keywords: ['喜歡', '愛吃', '討厭', '不吃', '過敏'],
                title: '偏好與禁忌',
                type: 'preference'
            },
            important_date: {
                keywords: ['生日', '紀念日', '重要', '日期'],
                title: '重要日期',
                type: 'important_date'
            },
            plan: {
                keywords: ['計劃', '想要', '希望', '目標', '夢想'],
                title: '計劃與目標',
                type: 'plan'
            },
            contact: {
                keywords: ['電話', '地址', '帳號'],
                title: '聯絡資訊',
                type: 'contact_info'
            }
        };

        for (const [categoryKey, category] of Object.entries(categories)) {
            const matchedKeywords = category.keywords.filter(kw => 
                userMessage.includes(kw)
            );

            if (matchedKeywords.length > 0) {
                return {
                    title: category.title,
                    content: userMessage,
                    type: category.type,
                    keywords: matchedKeywords,
                    character_id: this.characterId,
                    importance: matchedKeywords.length / category.keywords.length
                };
            }
        }

        return {
            title: '重要資訊',
            content: userMessage,
            type: 'general',
            keywords: [],
            character_id: this.characterId,
            importance: 0.5
        };
    }

    async autoSaveToWiki(wikiContent) {
        try {
            const entry = await WikiRecordsDB.create({
                title: wikiContent.title,
                content: wikiContent.content,
                page_type: wikiContent.type,
                character_id: wikiContent.character_id,
                keywords: wikiContent.keywords,
                source: 'auto_detected',
                importance: wikiContent.importance,
                auto_created: true,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

            console.log('[Chat MCP] 已自動儲存到 Wiki:', entry.title);
            
            return entry;
        } catch (error) {
            console.error('[Chat MCP] 自動儲存 Wiki 失敗:', error);
            return null;
        }
    }

    async executeTool(toolName, args = {}) {
        if (!this.invoker) {
            await this.initialize();
        }

        try {
            const result = await this.invoker.invokeTool(toolName, args);
            return result;
        } catch (error) {
            console.error('[Chat MCP] 工具執行失敗:', error);
            throw error;
        }
    }

    generateContextSummary(recentMessages) {
        if (recentMessages.length === 0) return '';

        const topics = new Map();
        const entities = new Map();
        const sentimentTrend = [];

        recentMessages.forEach(msg => {
            if (msg.classification?.topics) {
                msg.classification.topics.forEach(topic => {
                    topics.set(topic, (topics.get(topic) || 0) + 1);
                });
            }

            if (msg.classification?.entities) {
                msg.classification.entities.forEach(entity => {
                    entities.set(entity, (entities.get(entity) || 0) + 1);
                });
            }

            if (msg.sentiment) {
                sentimentTrend.push(msg.sentiment);
            }
        });

        const topTopics = Array.from(topics.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([topic]) => topic);

        const topEntities = Array.from(entities.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([entity]) => entity);

        return {
            topics: topTopics,
            entities: topEntities,
            sentimentTrend: sentimentTrend.slice(-5),
            messageCount: recentMessages.length
        };
    }

    async shouldTriggerMCP(userMessage) {
        if (!this.autoMCPEnabled) return false;

        const mcpKeywords = [
            '買', '訂', '購買', '下單', '訂購',
            '不舒服', '痛', '生病', '吃藥',
            '經期', '生理期',
            '忘記', '提醒', '記得',
            '天氣', '溫度',
            '記帳', '支出', '花費'
        ];

        return mcpKeywords.some(kw => userMessage.includes(kw));
    }

    setAutoWiki(enabled) {
        this.autoWikiEnabled = enabled;
    }

    setAutoMCP(enabled) {
        this.autoMCPEnabled = enabled;
    }
}

export async function createChatMCPHandler(chatId, characterId, userId) {
    const handler = new ChatMCPHandler(chatId, characterId, userId);
    await handler.initialize();
    return handler;
}