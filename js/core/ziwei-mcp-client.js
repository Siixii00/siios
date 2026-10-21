import { CharactersDB, ZiweiCacheDB, SettingsDB } from '../db.js';

// 紫微斗數服務：每位使用者部署自己的（神秘門勾選「紫微斗數排盤」產生 Worker），到「設定 → MCP 工具整合」填網址與金鑰。沒有預設的公用服務。
export const DEFAULT_ZIWEI_ENDPOINT = '';
export const ZIWEI_NOT_CONFIGURED = '尚未設定紫微斗數服務：到「神秘門」勾選「紫微斗數排盤」產生並部署自己的 Worker，再到「設定 → MCP 工具整合」填入網址與金鑰';

class ZiweiMCPClient {
    constructor() {
        this.endpoint = DEFAULT_ZIWEI_ENDPOINT;
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
        
        const custom = String((await SettingsDB.get('ziwei_endpoint')) || '').trim().replace(/\/+$/, '');
        if (custom) this.endpoint = custom;
        if (!this.endpoint) throw new Error(ZIWEI_NOT_CONFIGURED);
        const apiKey = String((await SettingsDB.get('ziwei_api_key')) || '').trim();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeout);
        
        try {
            const response = await fetch(`${this.endpoint}/tools/call`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', ...(apiKey ? { 'Authorization': `Bearer ${apiKey}` } : {}) },
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
                throw new Error(response.status === 401 ? '紫微斗數服務拒絕存取：金鑰（MCP_API_KEY）不正確或沒填' : `MCP 調用失敗: ${response.status}`);
            }
            
            const result = await response.json();
            
            if (!result.success) {
                throw new Error(result.error || '分析失敗');
            }
            
            return result.result;
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
            sihua: analysisResult.chart?.sihua,
            liu_nian_temple: analysisResult.runtime?.liu_nian_temple,
            liu_yue_temple: analysisResult.runtime?.liu_yue_temple,
            liu_ri_temple: analysisResult.runtime?.liu_ri_temple,
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
