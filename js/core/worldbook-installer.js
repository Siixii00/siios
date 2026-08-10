import { GlobalSettingsDB, KeywordSettingsDB, TheaterSettingsDB, SettingsDB } from '../db.js';

const CATEGORY_PRIORITY_MAP = {
    'sx_worldbook_cot': 'front',
    'sx_worldbook_style': 'front',
    'sx_worldbook_global': 'front',
    'sx_worldbook_keywords': 'middle',
    'sx_worldbook_backend': 'back',
    'sx_worldbook_core': 'front',
    'sx_worldbook_theater': 'middle'
};

const CATEGORY_TARGET_DB = {
    'sx_worldbook_cot': 'global',
    'sx_worldbook_style': 'global',
    'sx_worldbook_global': 'global',
    'sx_worldbook_keywords': 'keyword',
    'sx_worldbook_backend': 'global',
    'sx_worldbook_core': 'global',
    'sx_worldbook_theater': 'theater'
};

function extractWorldbookId(filename) {
    const match = filename.match(/^(.+?)_worldbook\.json$/);
    return match ? match[1] : filename.replace('.json', '');
}

class WorldbookInstaller {
    async scanWorldbooks() {
        const knownWorldbooks = [
            'ivory_tower', '4o', 'gemini31', 'opus', 'claude42', 'claude46',
            'deepseek', 'deepseek2', 'glm', 'kimi', 'kimi25', 'minimax',
            'sonnet', 'grok42', '5.2', 'literary_style', 'intimate',
            'eating', 'mino', 'universal_reset',
            '象牙塔_條件預設', '象牙塔_核心預設', '象牙塔_劇場預設',
            '蛾摩拉_lofter', '蛾摩拉_chat',
            '月讀_theater', '月讀_lofter', '月讀_chat',
            'xeno_male', 'xeno_female', 'xeno_common',
            'toy_male', 'toy_female',
            'outfit_male', 'outfit_female',
            'body_slender', 'body_round', 'body_normal'
        ];
        
        return knownWorldbooks.map(id => ({
            id,
            filename: `${id}_worldbook.json`
        }));
    }
    
    async loadWorldbook(worldbookId) {
        const response = await fetch(`worldbook/${worldbookId}_worldbook.json`);
        if (!response.ok) {
            throw new Error(`無法載入世界書: ${worldbookId}`);
        }
        return await response.json();
    }
    
    _getCategoryEntries(worldbook) {
        const result = [];
        for (const [category, value] of Object.entries(worldbook)) {
            if (category.startsWith('sx_worldbook_') && Array.isArray(value)) {
                const targetDB = CATEGORY_TARGET_DB[category];
                if (targetDB) {
                    result.push({ category, entries: value, targetDB });
                }
            } else if (value && typeof value === 'object' && !Array.isArray(value) && Array.isArray(value.entries)) {
                result.push({ category, entries: value.entries, targetDB: 'keyword' });
            }
        }
        return result;
    }

    async checkDuplicates(worldbookId) {
        const worldbook = await this.loadWorldbook(worldbookId);
        const duplicates = [];
        
        const existingGlobal = await GlobalSettingsDB.getAll();
        const existingKeyword = await KeywordSettingsDB.getAll();
        const existingTheater = await TheaterSettingsDB.getAll();
        
        const categories = this._getCategoryEntries(worldbook);
        if (!categories || !Array.isArray(categories)) {
            throw new Error(`世界書結構異常: 找不到 sx_worldbook_* 類別 (categories=${typeof categories})`);
        }
        
        for (const { category, entries, targetDB } of categories) {
            if (!Array.isArray(entries)) {
                throw new Error(`類別 ${category} 的 entries 不是陣列`);
            }
            for (const entry of entries) {
                const name = entry.title || 'Untitled';
                
                if (targetDB === 'global') {
                    const found = existingGlobal.find(e => e.name === name);
                    if (found) {
                        duplicates.push({ name, category, existingId: found.id, type: 'global' });
                    }
                } else if (targetDB === 'keyword') {
                    const found = existingKeyword.find(e => e.name === name);
                    if (found) {
                        duplicates.push({ name, category, existingId: found.id, type: 'keyword' });
                    }
                } else if (targetDB === 'theater') {
                    const found = existingTheater.find(e => e.name === name);
                    if (found) {
                        duplicates.push({ name, category, existingId: found.id, type: 'theater' });
                    }
                }
            }
        }
        
        return { worldbook, duplicates };
    }
    
    async importWorldbook(worldbookId, mode = 'skip') {
        const { worldbook, duplicates } = await this.checkDuplicates(worldbookId);
        
        let imported = 0;
        let skipped = 0;
        
        const categories = this._getCategoryEntries(worldbook);
        if (!categories || !Array.isArray(categories)) {
            throw new Error(`世界書結構異常: 找不到 sx_worldbook_* 類別 (categories=${typeof categories})`);
        }
        
        for (const { category, entries, targetDB } of categories) {
            if (!Array.isArray(entries)) {
                throw new Error(`類別 ${category} 的 entries 不是陣列`);
            }
            const priority = CATEGORY_PRIORITY_MAP[category] || (targetDB === 'keyword' ? 'middle' : 'front');
            
            for (const entry of entries) {
                const name = entry.title || 'Untitled';
                const duplicate = duplicates.find(d => d.name === name && d.type === targetDB);
                
                if (duplicate) {
                    if (mode === 'overwrite') {
                        if (duplicate.type === 'global') {
                            await GlobalSettingsDB.update(duplicate.existingId, {
                                content: entry.content || '',
                                priority: priority,
                                enabled: entry.enabled !== undefined ? entry.enabled : true
                            });
                        } else if (duplicate.type === 'keyword') {
                            await KeywordSettingsDB.update(duplicate.existingId, {
                                content: entry.content || '',
                                keywords: entry.triggers || [],
                                priority: priority,
                                enabled: entry.enabled !== undefined ? entry.enabled : true
                            });
                        } else if (duplicate.type === 'theater') {
                            await TheaterSettingsDB.update(duplicate.existingId, {
                                content: entry.content || '',
                                priority: priority,
                                enabled: entry.enabled !== undefined ? entry.enabled : true
                            });
                        }
                        imported++;
                    } else {
                        skipped++;
                    }
                } else {
                    if (targetDB === 'global') {
                        await GlobalSettingsDB.create({
                            name: name,
                            content: entry.content || '',
                            priority: priority,
                            enabled: entry.enabled !== undefined ? entry.enabled : true
                        });
                    } else if (targetDB === 'keyword') {
                        await KeywordSettingsDB.create({
                            name: name,
                            content: entry.content || '',
                            keywords: entry.triggers || [],
                            priority: priority,
                            enabled: entry.enabled !== undefined ? entry.enabled : true
                        });
                    } else if (targetDB === 'theater') {
                        await TheaterSettingsDB.create({
                            name: name,
                            content: entry.content || '',
                            priority: priority,
                            enabled: entry.enabled !== undefined ? entry.enabled : true
                        });
                    }
                    imported++;
                }
            }
        }
        
        return { imported, skipped };
    }
    
    async importWorldbookWithPrompt(worldbookId, onProgress) {
        const { worldbook, duplicates } = await this.checkDuplicates(worldbookId);
        
        if (duplicates.length > 0) {
            return { needPrompt: true, duplicates, worldbook };
        }
        
        return await this.importWorldbook(worldbookId, 'overwrite');
    }
}

export default new WorldbookInstaller();
export { WorldbookInstaller };
