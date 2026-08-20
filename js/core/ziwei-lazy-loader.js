import { CharactersDB, ZiweiCacheDB } from '../db.js';
import { ziweiClient } from './ziwei-mcp-client.js';

class ZiweiLazyLoader {
    constructor() {
        this.lastCheckDate = null;
        this.checkInterval = null;
    }
    
    async checkAndRefreshIfNeeded(characterId) {
        const today = this.getTodayString();
        const char = await CharactersDB.getById(characterId);
        
        if (!char.birth_date || !char.birth_time || !char.gender) {
            return null;
        }
        
        const cache = char.ziwei_cache_id 
            ? await ZiweiCacheDB.getById(char.ziwei_cache_id)
            : null;
        
        const needsUpdate = this.shouldUpdate(cache, today);
        
        if (needsUpdate) {
            return await this.refreshCache(characterId, today);
        }
        
        return cache;
    }
    
    shouldUpdate(cache, today) {
        if (!cache) return true;
        
        if (cache.analysis_date !== today) return true;
        
        if (cache.expires_at && cache.expires_at < Date.now()) return true;
        
        return false;
    }
    
    async refreshCache(characterId, today) {
        try {
            const result = await ziweiClient.analyzeBirth(characterId);
            
            const chart = result.chart || {};
            const runtime = result.runtime || {};
            const newCache = await ZiweiCacheDB.create({
                character_id: characterId,
                analysis_date: today,
                analysis_type: 'daily',
                chart_data: chart,
                fortune_summary: result.fortune_summary || '',
                sihua: chart.sihua || runtime.sihua || {},
                liu_nian_temple: runtime.liu_nian_temple,
                liu_yue_temple: runtime.liu_yue_temple,
                liu_ri_temple: runtime.liu_ri_temple,
                events: result.events || [],
                expires_at: this.getTomorrowMidnight()
            });
            
            await CharactersDB.update(characterId, {
                ziwei_cache_id: newCache.id
            });
            
            return newCache;
        } catch (error) {
            console.error('[ZiweiLazyLoader] 更新失敗:', error);
            
            const char = await CharactersDB.getById(characterId);
            if (char.ziwei_cache_id) {
                const oldCache = await ZiweiCacheDB.getById(char.ziwei_cache_id);
                if (oldCache) {
                    oldCache.is_stale = true;
                    await ZiweiCacheDB.update(oldCache.id, { is_stale: true });
                    return oldCache;
                }
            }
            
            return null;
        }
    }
    
    getTodayString() {
        return new Date().toISOString().split('T')[0];
    }
    
    getTomorrowMidnight() {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.getTime();
    }
    
    startDayChangeDetection() {
        this.lastCheckDate = this.getTodayString();
        
        this.checkInterval = setInterval(async () => {
            const today = this.getTodayString();
            if (today !== this.lastCheckDate) {
                console.log('[ZiweiLazyLoader] 偵測到跨日，觸發更新');
                this.lastCheckDate = today;
                await this.refreshAllCharacters();
            }
        }, 60000);
    }
    
    stopDayChangeDetection() {
        if (this.checkInterval) {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
    }
    
    async refreshAllCharacters() {
        try {
            const characters = await CharactersDB.getAll();
            for (const char of characters) {
                if (char.birth_date && char.birth_time && char.gender) {
                    await this.checkAndRefreshIfNeeded(char.id);
                }
            }
        } catch (error) {
            console.error('[ZiweiLazyLoader] 批次更新失敗:', error);
        }
    }
}

export const ziweiLazyLoader = new ZiweiLazyLoader();
