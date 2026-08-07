import { CharactersDB, ZiweiCacheDB } from '../db.js';
import { ziweiClient } from './ziwei-mcp-client.js';
import { createToast } from '../components.js';

class ZiweiService {
    constructor() {
        this.analysisTimeout = 15000;
        this.cacheTTL = 24 * 60 * 60 * 1000;
    }

    async analyzeAndCache(characterId, forceRefresh = false) {
        try {
            const char = await CharactersDB.getById(characterId);
            if (!char) {
                throw new Error('找不到角色資料');
            }

            if (!char.birth_date || !char.birth_time) {
                throw new Error('缺少出生日期或時間');
            }

            if (!char.gender) {
                throw new Error('缺少性別資訊');
            }

            const today = new Date().toISOString().split('T')[0];
            
            if (!forceRefresh) {
                const existingCache = await ZiweiCacheDB.getByDate(characterId, today);
                if (existingCache && !this.isCacheStale(existingCache)) {
                    console.log('[ZiweiService] 使用現有快取:', existingCache.id);
                    return {
                        fromCache: true,
                        data: existingCache
                    };
                }
            }

            console.log('[ZiweiService] 開始分析角色:', characterId);
            createToast('正在分析命理資料...', 'info');

            const analysisResult = await ziweiClient.analyzeBirth(characterId);
            
            const cache = await ziweiClient.saveCache(characterId, analysisResult);
            
            console.log('[ZiweiService] 分析完成並已快取:', cache.id);
            createToast('命理分析完成', 'success');

            return {
                fromCache: false,
                data: cache
            };
        } catch (error) {
            console.error('[ZiweiService] 分析失敗:', error);
            createToast(`分析失敗: ${error.message}`, 'error');
            throw error;
        }
    }

    async getCachedAnalysis(characterId) {
        const today = new Date().toISOString().split('T')[0];
        const cache = await ZiweiCacheDB.getByDate(characterId, today);
        
        if (!cache) {
            return null;
        }

        if (this.isCacheStale(cache)) {
            console.log('[ZiweiService] 快取已過期');
            return { ...cache, is_stale: true };
        }

        return cache;
    }

    isCacheStale(cache) {
        const now = Date.now();
        const expiresAt = cache.expires_at || 0;
        return now > expiresAt;
    }

    async shouldAutoAnalyze(characterId) {
        const char = await CharactersDB.getById(characterId);
        
        if (!char || !char.birth_date || !char.birth_time || !char.gender) {
            return false;
        }

        const today = new Date().toISOString().split('T')[0];
        const cache = await ZiweiCacheDB.getByDate(characterId, today);
        
        return !cache || this.isCacheStale(cache);
    }

    async batchAnalyze(characterIds, options = {}) {
        const results = [];
        const { concurrency = 1, forceRefresh = false } = options;

        for (let i = 0; i < characterIds.length; i += concurrency) {
            const batch = characterIds.slice(i, i + concurrency);
            
            const batchResults = await Promise.allSettled(
                batch.map(id => this.analyzeAndCache(id, forceRefresh))
            );

            for (let j = 0; j < batchResults.length; j++) {
                const result = batchResults[j];
                results.push({
                    characterId: batch[j],
                    status: result.status,
                    data: result.status === 'fulfilled' ? result.value : null,
                    error: result.status === 'rejected' ? result.reason.message : null
                });
            }
        }

        return results;
    }

    async clearExpiredCaches() {
        const allCaches = await ZiweiCacheDB.getAll();
        const now = Date.now();
        const expiredIds = [];

        for (const cache of allCaches) {
            if (cache.expires_at && now > cache.expires_at) {
                expiredIds.push(cache.id);
            }
        }

        for (const id of expiredIds) {
            await ZiweiCacheDB.delete(id);
        }

        console.log(`[ZiweiService] 清除了 ${expiredIds.length} 個過期快取`);
        return expiredIds.length;
    }

    getAnalysisSummary(cache) {
        if (!cache || !cache.chart_data) {
            return null;
        }

        const chart = cache.chart_data;
        const events = cache.events || [];

        return {
            temples: {
                year: cache.liu_nian_temple,
                month: cache.liu_yue_temple,
                day: cache.liu_ri_temple
            },
            sihua: chart.sihua || {},
            fortuneSummary: cache.fortune_summary || '',
            importantEvents: events.filter(e => e.confidence > 0.7).slice(0, 5),
            lastUpdated: cache.analysis_date
        };
    }
}

export const ziweiService = new ZiweiService();
