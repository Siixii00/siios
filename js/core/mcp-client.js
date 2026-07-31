import { MCPConfigDB } from '../db.js';

class MCPClient {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.endpoint = config.endpoint;
        this.apiKey = config.apiKey;
        this.tools = config.tools || [];
    }

    getHeaders() {
        const headers = {
            'Content-Type': 'application/json'
        };
        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }
        return headers;
    }

    async listTools() {
        try {
            const response = await fetch(`${this.endpoint}/tools`, {
                method: 'GET',
                headers: this.getHeaders()
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const tools = await response.json();
            return { success: true, tools };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async callTool(toolName, args, context = {}) {
        try {
            const body = { 
                name: toolName, 
                arguments: args,
                context: {
                    characterId: context.characterId,
                    characterName: context.characterName,
                    characterPersonality: context.characterPersonality,
                    userId: context.userId,
                    userName: context.userName
                }
            };
            
            const response = await fetch(`${this.endpoint}/tools/call`, {
                method: 'POST',
                headers: this.getHeaders(),
                body: JSON.stringify(body)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `HTTP ${response.status}`);
            }

            const result = await response.json();
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async testConnection() {
        const result = await this.listTools();
        if (result.success) {
            return {
                success: true,
                toolCount: result.tools.length,
                tools: result.tools
            };
        }
        return result;
    }
}

class MCPManager {
    constructor() {
        this.clients = new Map();
        this.allTools = [];
        this.configs = [];
    }

    async loadConfigs() {
        const configs = await MCPConfigDB.getEnabled();
        this.clients.clear();
        this.allTools = [];
        this.configs = configs;

        for (const config of configs) {
            const client = new MCPClient(config);
            this.clients.set(config.id, client);

            if (config.tools && config.tools.length > 0) {
                for (const tool of config.tools) {
                    this.allTools.push({
                        ...tool,
                        mcpId: config.id,
                        mcpName: config.name,
                        boundCharacterId: config.bound_character_id
                    });
                }
            }
        }

        return this.allTools;
    }

    async refreshTools() {
        const configs = await MCPConfigDB.getAll();
        const results = [];

        for (const config of configs) {
            const client = new MCPClient(config);
            const testResult = await client.testConnection();

            if (testResult.success) {
                const tools = testResult.tools.map(t => ({
                    name: t.name,
                    description: t.description || '',
                    parameters: t.parameters || {}
                }));

                await MCPConfigDB.update(config.id, {
                    tools,
                    status: 'connected',
                    lastChecked: Date.now()
                });

                results.push({
                    id: config.id,
                    success: true,
                    toolCount: tools.length
                });
            } else {
                await MCPConfigDB.update(config.id, {
                    status: 'error',
                    lastChecked: Date.now()
                });

                results.push({
                    id: config.id,
                    success: false,
                    error: testResult.error
                });
            }
        }

        await this.loadConfigs();
        return results;
    }

    async callTool(mcpId, toolName, args, context = {}) {
        const client = this.clients.get(mcpId);
        if (!client) {
            return { success: false, error: 'MCP client not found' };
        }
        return client.callTool(toolName, args, context);
    }

    getToolsForLLM(characterId = null, enabledMcpIds = null) {
        let filteredTools = this.allTools;
        
        if (enabledMcpIds && enabledMcpIds.length > 0) {
            filteredTools = filteredTools.filter(t => enabledMcpIds.includes(t.mcpId));
        }
        
        if (characterId) {
            filteredTools = filteredTools.filter(t => !t.boundCharacterId || t.boundCharacterId === characterId);
        }
        
        return filteredTools.map(tool => ({
            type: 'function',
            function: {
                name: tool.name,
                description: tool.description || `Tool from ${tool.mcpName}`,
                parameters: tool.parameters
            }
        }));
    }

    findToolByName(toolName) {
        return this.allTools.find(t => t.name === toolName);
    }
}

const mcpManager = new MCPManager();

export { MCPClient, MCPManager, mcpManager };