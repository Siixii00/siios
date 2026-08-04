import { CharactersDB, ZiweiCacheDB } from '../db.js';

class ZiweiMCPClient {
    constructor() {
        this.endpoint = 'https://ziwei-mcp.vercel.app';
        this.timeout = 10000;
    }
    
    setEndpoint(url) {
        this.endpoint = url;
    }
    
    async analyzeBirth(characterId) {
        const char = await CharactersDB.getById(characterId);
        
        if (!char.birth_date || !char.birth_time) {
            throw new Error('缺少出生資訊');
        }
        
        if (!char.gender) {
            throw new Error('缺少性別資訊');
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(`${this.endpoint}/tools/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: 'ziwei_analyze_birth',
                    arguments: {
                        birth_date: char.birth_date,
                        birth_time: char.birth_time,
                        birth_location: char.birth_location,
                        calendar_type: char.birth_calendar_type || 'solar',
                        gender: char.gender
                    }
                }),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (!response.ok) {
                throw new Error(`MCP 調用失敗: ${response.status}`);
            }
            
            const result = await response.json();
            
            return result;
        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                throw new Error('請求逾時');
            }
            
            throw error;
        }
    }
    
    async saveCache(characterId, analysisResult) {
        const today = this.getTodayString();
        const tomorrow = this.getTomorrowString();
        
        const cache = await ZiweiCacheDB.create({
            character_id: characterId,
            analysis_date: today,
            analysis_type: 'daily',
            chart_data: analysisResult.chart,
            fortune_summary: analysisResult.fortune_summary,
            sihua: analysisResult.runtime?.sihua,
            liu_nian_temple: analysisResult.runtime?.liu_nian?.temple,
            liu_yue_temple: analysisResult.runtime?.liu_yue?.temple,
            liu_ri_temple: analysisResult.runtime?.liu_ri?.temple,
            events: analysisResult.events || [],
            expires_at: new Date(tomorrow + 'T00:00:00').getTime()
        });
        
        await CharactersDB.update(characterId, {
            ziwei_cache_id: cache.id
        });
        
        return cache;
    }
    
    getTodayString() {
        return new Date().toISOString().split('T')[0];
    }
    
    getTomorrowString() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }
    
    async testConnection() {
        try {
            const response = await fetch(`${this.endpoint}/tools`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' }
            });
            
            return response.ok;
        } catch (error) {
            console.error('[ZiweiMCPClient] 連線測試失敗:', error);
            return false;
        }
    }
}

export const ziweiClient = new ZiweiMCPClient();
