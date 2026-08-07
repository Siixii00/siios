import { MCPConfigDB } from '../db.js';

class MCPClient {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.endpoint = config.endpoint;
        this.apiKey = config.apiKey;
        this.tools = config.tools || [];
        this.timeout = config.timeout || 30000;
        this.maxRetries = config.maxRetries || 3;
        this.retryDelay = config.retryDelay || 1000;
        this.circuitBreaker = {
            failures: 0,
            threshold: 5,
            state: 'closed',
            lastFailure: null,
            cooldownPeriod: 60000
        };
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

    async checkCircuitBreaker() {
        const cb = this.circuitBreaker;
        
        if (cb.state === 'open') {
            const now = Date.now();
            if (now - cb.lastFailure > cb.cooldownPeriod) {
                cb.state = 'half-open';
                cb.failures = 0;
            } else {
                throw new Error('Circuit breaker is open - service unavailable');
            }
        }
    }

    updateCircuitBreaker(success) {
        const cb = this.circuitBreaker;
        
        if (success) {
            cb.failures = 0;
            cb.state = 'closed';
        } else {
            cb.failures++;
            cb.lastFailure = Date.now();
            
            if (cb.failures >= cb.threshold) {
                cb.state = 'open';
            }
        }
    }

    async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async fetchWithTimeout(url, options) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(url, {
                ...options,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.timeout}ms`);
            }
            throw error;
        }
    }

    async retryWithBackoff(operation) {
        let lastError;
        
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                await this.checkCircuitBreaker();
                const result = await operation();
                this.updateCircuitBreaker(true);
                return result;
            } catch (error) {
                lastError = error;
                this.updateCircuitBreaker(false);
                
                if (attempt < this.maxRetries) {
                    const delay = this.retryDelay * Math.pow(2, attempt);
                    console.warn(`[MCPClient] Attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
                    await this.sleep(delay);
                }
            }
        }
        
        throw lastError;
    }

    async listTools() {
        try {
            return await this.retryWithBackoff(async () => {
                const response = await this.fetchWithTimeout(`${this.endpoint}/tools`, {
                    method: 'GET',
                    headers: this.getHeaders()
                });

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }

                const tools = await response.json();
                return { success: true, tools };
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async callTool(toolName, args, context = {}) {
        try {
            return await this.retryWithBackoff(async () => {
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
                
                const response = await this.fetchWithTimeout(`${this.endpoint}/tools/call`, {
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
            });
        } catch (error) {
            console.error(`[MCPClient] Tool call failed after ${this.maxRetries} retries:`, error);
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
        this.healthCheckInterval = null;
        this.toolsCache = {
            data: null,
            timestamp: null,
            ttl: 300000
        };
    }

    startHealthCheck(intervalMs = 60000) {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
        }
        
        this.healthCheckInterval = setInterval(async () => {
            console.log('[MCPManager] Running scheduled health check...');
            const results = await this.refreshTools();
            const healthy = results.filter(r => r.success).length;
            console.log(`[MCPManager] Health check complete: ${healthy}/${results.length} servers healthy`);
        }, intervalMs);
    }

    stopHealthCheck() {
        if (this.healthCheckInterval) {
            clearInterval(this.healthCheckInterval);
            this.healthCheckInterval = null;
        }
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

        this.toolsCache.data = this.allTools;
        this.toolsCache.timestamp = Date.now();

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

    getToolsForLLM(characterId = null, enabledMcpIds = null, useCache = true) {
        if (useCache && this.toolsCache.data && 
            Date.now() - this.toolsCache.timestamp < this.toolsCache.ttl) {
            return this.getCachedToolsForLLM(characterId, enabledMcpIds);
        }

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

    getCachedToolsForLLM(characterId, enabledMcpIds) {
        let filteredTools = this.toolsCache.data || this.allTools;
        
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

    getHealthStatus() {
        const status = {
            total: this.clients.size,
            healthy: 0,
            unhealthy: 0,
            details: []
        };

        for (const [id, client] of this.clients) {
            const isHealthy = client.circuitBreaker.state === 'closed';
            if (isHealthy) {
                status.healthy++;
            } else {
                status.unhealthy++;
            }
            
            status.details.push({
                id,
                name: client.name,
                healthy: isHealthy,
                circuitBreaker: client.circuitBreaker.state,
                failures: client.circuitBreaker.failures
            });
        }

        return status;
    }
}

const mcpManager = new MCPManager();

export { MCPClient, MCPManager, mcpManager };