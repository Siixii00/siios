import { GlobalSettingsDB, GlobalForbiddenDB, TheaterSettingsDB, KeywordSettingsDB, CharactersDB, UsersDB, ChatsDB, SettingsDB } from '../db.js';

const PRIORITY_ORDER = { 'front': 0, 'middle': 1, 'back': 2 };

function sortByPriority(entries) {
    return entries.sort((a, b) => {
        const priorityA = PRIORITY_ORDER[a.priority] || 1;
        const priorityB = PRIORITY_ORDER[b.priority] || 1;
        return priorityA - priorityB;
    });
}

function inferBodyType(heightCm, weightKg) {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return null;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    if (bmi < 18.5) return { category: 'slender', bmi, label: '纖細/骨感', vocabSet: 'slender' };
    if (bmi < 24) return { category: 'healthy', bmi, label: '健康勻稱', vocabSet: 'normal' };
    if (bmi < 27) return { category: 'round', bmi, label: '豐腴/圓潤', vocabSet: 'round' };
    return { category: 'plus_size', bmi, label: '豐滿', vocabSet: 'round' };
}

async function getCharacterData(chatId) {
    const chat = await ChatsDB.getById(chatId);
    if (!chat || !chat.character_id) return null;
    return await CharactersDB.getById(chat.character_id);
}

async function getUserData(chatId) {
    const chat = await ChatsDB.getById(chatId);
    if (!chat || !chat.bound_user_id) return null;
    return await UsersDB.getById(chat.bound_user_id);
}

async function loadTheaterSettings(chatId) {
    const chat = await ChatsDB.getById(chatId);
    let mountedIds = null;
    
    if (chat && chat.mounted_theater_settings) {
        mountedIds = chat.mounted_theater_settings;
    } else {
        mountedIds = await SettingsDB.get('theater_mounted_settings');
    }
    
    if (!mountedIds || mountedIds.length === 0) return [];
    
    const allTheater = await TheaterSettingsDB.getAll();
    return allTheater.filter(entry => mountedIds.includes(entry.id) && entry.enabled);
}

async function matchKeywords(userMessage) {
    if (!userMessage || typeof userMessage !== 'string') return [];
    return await KeywordSettingsDB.matchKeywords(userMessage);
}

function formatEntry(entry, type, defaultPriority) {
    if (!entry || !entry.content) return null;
    return {
        id: entry.id,
        name: entry.name || '',
        content: entry.content,
        priority: entry.priority || defaultPriority,
        type: type,
        enabled: entry.enabled
    };
}

async function loadWorldInfoContext(chatId, userMessage, options = {}) {
    const results = [];
    
    const globalSettings = await GlobalSettingsDB.getAll();
    for (const entry of globalSettings) {
        if (entry.enabled) {
            const formatted = formatEntry(entry, 'global', 'front');
            if (formatted) results.push(formatted);
        }
    }
    
    const globalForbidden = await GlobalForbiddenDB.getAll();
    for (const entry of globalForbidden) {
        if (entry.enabled) {
            const formatted = formatEntry(entry, 'forbidden', 'front');
            if (formatted) formatted.isForbidden = true;
            if (formatted) results.push(formatted);
        }
    }
    
    if (chatId) {
        let characterData = null;
        if (options.characterId) {
            characterData = await CharactersDB.getById(options.characterId);
        } else {
            characterData = await getCharacterData(chatId);
        }
        if (characterData) {
            if (characterData.personality) {
                results.push({
                    id: 'char-personality',
                    name: '角色性格',
                    content: characterData.personality,
                    priority: 'front',
                    type: 'character',
                    enabled: true
                });
            }
            if (characterData.scenario) {
                results.push({
                    id: 'char-scenario',
                    name: '角色場景',
                    content: characterData.scenario,
                    priority: 'front',
                    type: 'character',
                    enabled: true
                });
            }
        }
        
        let userData = null;
        if (characterData?.bound_user_id) {
            userData = await UsersDB.getById(characterData.bound_user_id);
        } else if (options.userId) {
            userData = await UsersDB.getById(options.userId);
        } else {
            userData = await getUserData(chatId);
        }
        if (userData) {
            let userContent = '';
            if (userData.name) userContent += `用戶名稱: ${userData.name}\n`;
            if (userData.personality) userContent += `用戶個性: ${userData.personality}\n`;
            if (userData.speech_style) userContent += `用戶說話風格: ${userData.speech_style}\n`;
            if (userData.taboos && userData.taboos.length > 0) {
                userContent += `用戶禁忌: ${userData.taboos.join(', ')}\n`;
            }
            if (userContent) {
                results.push({
                    id: 'user-settings',
                    name: '用戶設定',
                    content: userContent,
                    priority: 'front',
                    type: 'user',
                    enabled: true
                });
            }

            if (userData.height || userData.weight) {
                const bodyType = inferBodyType(userData.height, userData.weight);
                if (bodyType) {
                    results.push({
                        id: 'user-body-type',
                        name: '使用者體型',
                        content: `[使用者體型推斷]\n根據使用者提供的數據（身高 ${userData.height}cm，體重 ${userData.weight}kg，BMI ${bodyType.bmi.toFixed(1)}），推斷使用者體型為「${bodyType.label}」。\n嚴格遵守：必須使用符合此體型的描述詞彙，禁止使用不符合的詞彙。`,
                        priority: 'front',
                        type: 'user',
                        enabled: true
                    });
                }
            }
        }
        
        const theaterSettings = await loadTheaterSettings(chatId);
        for (const entry of theaterSettings) {
            const formatted = formatEntry(entry, 'theater', 'middle');
            if (formatted) results.push(formatted);
        }
    }
    
    if (userMessage) {
        const keywordMatches = await matchKeywords(userMessage);
        for (const entry of keywordMatches) {
            const formatted = formatEntry(entry, 'keyword', 'middle');
            if (formatted) results.push(formatted);
        }
    }
    
    return sortByPriority(results);
}

export { loadWorldInfoContext, loadTheaterSettings, matchKeywords, sortByPriority };
