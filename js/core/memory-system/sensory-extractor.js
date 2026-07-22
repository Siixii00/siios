/**
 * SensoryExtractor - 五感提取器
 * 
 * 從文本中提取五感資訊：
 * - 視覺 (visual)
 * - 聽覺 (auditory)
 * - 嗅覺 (olfactory) - 最高觸發優先級
 * - 觸覺 (tactile)
 * - 味覺 (gustatory)
 */

export class SensoryExtractor {
    constructor(weights = {}) {
        this.weights = {
            visual: 0.25,
            auditory: 0.25,
            olfactory: 0.20,
            tactile: 0.20,
            gustatory: 0.10,
            ...weights
        };
        
        this.patterns = {
            visual: {
                keywords: [
                    '看', '見', '望', '瞧', '盯', '瞪', '瞥', '注視', '凝視',
                    '顏色', '色彩', '光', '暗', '亮', '影', '閃', '耀',
                    '紅', '橙', '黃', '綠', '藍', '紫', '黑', '白', '灰',
                    '大', '小', '高', '矮', '長', '短', '寬', '窄',
                    '圓', '方', '三角', '形狀', '樣子', '外貌', '模樣',
                    '美', '醜', '漂亮', '帥', '可愛', '精緻', '華麗',
                    'see', 'look', 'watch', 'color', 'bright', 'dark', 'light',
                    'beautiful', 'ugly', 'shape', 'appearance'
                ],
                phrases: [
                    /我看見/g, /我看到/g, /眼前/g, /映入眼簾/g,
                    /閃閃發光/g, /五顏六色/g, /色彩斑斕/g,
                    /我看起來/g, /你看起來/g, /看起來/g
                ]
            },
            auditory: {
                keywords: [
                    '聽', '聞', '聲', '音', '響', '叫', '喊', '說', '唱',
                    '吵', '靜', '鬧', '嗡', '轟', '砰', '啪', '叮', '咚',
                    '音樂', '歌曲', '旋律', '節奏', '聲調', '語氣',
                    '低沉', '高亢', '清脆', '沙啞', '溫柔', '粗獷',
                    'hear', 'listen', 'sound', 'noise', 'voice', 'music',
                    'loud', 'quiet', 'melody', 'rhythm'
                ],
                phrases: [
                    /我聽到/g, /傳來/g, /響起/g, /聲音/g,
                    /耳邊/g, /耳語/g, /低語/g,
                    /大聲/g, /小聲/g, /輕聲/g
                ]
            },
            olfactory: {
                keywords: [
                    '聞', '嗅', '香', '臭', '味', '氣味', '味道',
                    '芬芳', '芳香', '清香', '濃香', '淡香',
                    '香水', '花香', '果香', '咖啡香', '茶香',
                    '腥', '酸', '臭味', '異味',
                    'smell', 'scent', 'fragrance', 'aroma', 'odor',
                    'perfume', 'flower', 'coffee', 'tea'
                ],
                phrases: [
                    /聞到/g, /嗅到/g, /香氣/g, /氣味/g,
                    /香味/g, /臭味/g, /味道/g,
                    /撲鼻/g, /飄散/g
                ]
            },
            tactile: {
                keywords: [
                    '摸', '觸', '碰', '抓', '握', '抱', '摟', '撫', '拍',
                    '熱', '冷', '溫', '涼', '冰', '暖', '燙', '凍',
                    '軟', '硬', '滑', '粗', '細', '柔', '韌', '脆',
                    '痛', '癢', '麻', '酸', '脹', '緊', '鬆',
                    '皮膚', '手感', '質地', '觸感',
                    'touch', 'feel', 'hold', 'grab', 'hug', 'caress',
                    'hot', 'cold', 'warm', 'soft', 'hard', 'smooth', 'rough',
                    'pain', 'itch', 'texture'
                ],
                phrases: [
                    /摸到/g, /觸碰/g, /手感/g, /觸感/g,
                    /溫暖/g, /冰冷/g, /柔軟/g, /堅硬/g,
                    /緊緊/g, /輕輕/g, /用力/g
                ]
            },
            gustatory: {
                keywords: [
                    '吃', '喝', '嚐', '咬', '嚼', '吞', '嚥', '舔',
                    '甜', '酸', '苦', '辣', '鹹', '淡', '澀',
                    '美味', '好吃', '難吃', '可口', '鮮美',
                    '食物', '飲料', '菜', '湯', '飯', '麵',
                    'eat', 'drink', 'taste', 'bite', 'chew', 'lick',
                    'sweet', 'sour', 'bitter', 'spicy', 'salty',
                    'delicious', 'yummy', 'food', 'drink'
                ],
                phrases: [
                    /吃到/g, /喝到/g, /嚐到/g, /味道/g,
                    /美味/g, /可口/g, /香甜/g,
                    /入口/g, /舌尖/g
                ]
            }
        };
    }
    
    extract(text) {
        if (!text || typeof text !== 'string') {
            return {
                visual: [],
                auditory: [],
                olfactory: [],
                tactile: [],
                gustatory: []
            };
        }
        
        const result = {
            visual: [],
            auditory: [],
            olfactory: [],
            tactile: [],
            gustatory: []
        };
        
        for (const [sense, config] of Object.entries(this.patterns)) {
            const found = this.extractSense(text, config);
            result[sense] = found;
        }
        
        return result;
    }
    
    extractSense(text, config) {
        const found = new Set();
        const lowerText = text.toLowerCase();
        
        for (const keyword of config.keywords) {
            if (lowerText.includes(keyword.toLowerCase())) {
                found.add(keyword);
            }
        }
        
        for (const pattern of config.phrases) {
            const matches = text.match(pattern);
            if (matches) {
                for (const match of matches) {
                    found.add(match);
                }
            }
        }
        
        return Array.from(found);
    }
    
    getDominantSense(sensoryData) {
        let maxCount = 0;
        let dominant = null;
        
        for (const [sense, data] of Object.entries(sensoryData)) {
            const count = data.length;
            const weightedCount = count * (this.weights[sense] || 0.2);
            
            if (weightedCount > maxCount) {
                maxCount = weightedCount;
                dominant = sense;
            }
        }
        
        return dominant;
    }
    
    getSensoryScore(sensoryData) {
        let totalScore = 0;
        
        for (const [sense, data] of Object.entries(sensoryData)) {
            const count = data.length;
            const weight = this.weights[sense] || 0.2;
            totalScore += count * weight;
        }
        
        return Math.min(1.0, totalScore / 5);
    }
    
    formatSensoryDescription(sensoryData) {
        const parts = [];
        
        if (sensoryData.visual.length > 0) {
            parts.push(`視覺: ${sensoryData.visual.join(', ')}`);
        }
        if (sensoryData.auditory.length > 0) {
            parts.push(`聽覺: ${sensoryData.auditory.join(', ')}`);
        }
        if (sensoryData.olfactory.length > 0) {
            parts.push(`嗅覺: ${sensoryData.olfactory.join(', ')}`);
        }
        if (sensoryData.tactile.length > 0) {
            parts.push(`觸覺: ${sensoryData.tactile.join(', ')}`);
        }
        if (sensoryData.gustatory.length > 0) {
            parts.push(`味覺: ${sensoryData.gustatory.join(', ')}`);
        }
        
        return parts.join('\n');
    }
}