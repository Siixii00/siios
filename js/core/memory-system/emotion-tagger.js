/**
 * EmotionTagger - 情緒標記器
 * 
 * 使用效價（Valence）與喚醒度（Arousal）標記情感：
 * - 效價：正向到負向（-1 到 +1）
 * - 喚醒度：平靜到激動（0 到 1）
 */

export class EmotionTagger {
    constructor() {
        this.emotionLexicon = {
            positive: {
                highArousal: {
                    keywords: [
                        '興奮', '激動', '狂喜', '熱血', '振奮',
                        '驚喜', '興奮不已', '雀躍', '歡呼', '狂歡',
                        'excited', 'thrilled', 'ecstatic', 'elated', 'euphoric',
                        'passionate', 'enthusiastic', 'exhilarated'
                    ],
                    valence: 0.9,
                    arousal: 0.9
                },
                mediumArousal: {
                    keywords: [
                        '開心', '快樂', '高興', '幸福', '滿足',
                        '喜歡', '愛', '甜蜜', '溫馨', '感動',
                        'happy', 'joy', 'glad', 'pleased', 'content',
                        'love', 'sweet', 'warm', 'touched'
                    ],
                    valence: 0.7,
                    arousal: 0.5
                },
                lowArousal: {
                    keywords: [
                        '平靜', '安詳', '放鬆', '舒適', '安心',
                        '寧靜', '祥和', '恬靜', '悠閒', '自在',
                        'calm', 'peaceful', 'relaxed', 'comfortable', 'serene',
                        'tranquil', 'at ease'
                    ],
                    valence: 0.5,
                    arousal: 0.2
                }
            },
            negative: {
                highArousal: {
                    keywords: [
                        '憤怒', '暴怒', '狂怒', '恐懼', '驚恐',
                        '恐慌', '焦慮', '崩潰', '絕望', '痛苦',
                        'angry', 'furious', 'rage', 'terror', 'panic',
                        'anxious', 'devastated', 'despair', 'agony'
                    ],
                    valence: -0.9,
                    arousal: 0.9
                },
                mediumArousal: {
                    keywords: [
                        '難過', '悲傷', '憂鬱', '失落', '沮喪',
                        '失望', '寂寞', '孤獨', '委屈', '心疼',
                        'sad', 'sorrow', 'depressed', 'down', 'disappointed',
                        'lonely', 'hurt', 'grief'
                    ],
                    valence: -0.7,
                    arousal: 0.5
                },
                lowArousal: {
                    keywords: [
                        '疲憊', '疲倦', '無力', '無聊', '倦怠',
                        '厭煩', '麻木', '空虛', '消沉', '低迷',
                        'tired', 'exhausted', 'weary', 'bored', 'lethargic',
                        'numb', 'empty', 'downcast'
                    ],
                    valence: -0.4,
                    arousal: 0.2
                }
            },
            neutral: {
                keywords: [
                    '普通', '一般', '正常', '平常', '日常',
                    'neutral', 'normal', 'ordinary', 'regular', 'usual'
                ],
                valence: 0,
                arousal: 0.3
            }
        };
        
        this.modifiers = {
            intensifiers: [
                '非常', '很', '超級', '極度', '特別', '異常',
                'very', 'extremely', 'super', 'incredibly', 'especially',
                'really', 'absolutely', 'totally'
            ],
            diminishers: [
                '有點', '稍微', '些許', '一點', '略微',
                'a bit', 'slightly', 'somewhat', 'a little', 'kind of',
                'sort of', 'rather'
            ],
            negators: [
                '不', '沒', '無', '非', '不是',
                'not', 'no', 'never', 'none', "don't", "doesn't", "didn't"
            ]
        };
        
        this.emotionPhrases = {
            love: {
                keywords: ['我愛你', '愛你', '喜歡你', 'I love you', 'love you'],
                valence: 0.9,
                arousal: 0.7
            },
            hate: {
                keywords: ['我恨你', '恨你', '討厭你', 'I hate you', 'hate you'],
                valence: -0.9,
                arousal: 0.8
            },
            miss: {
                keywords: ['想你', '思念', '好想你', 'miss you', 'missing you'],
                valence: 0.3,
                arousal: 0.5
            },
            worry: {
                keywords: ['擔心', '擔憂', '煩惱', 'worry', 'worried', 'concern'],
                valence: -0.5,
                arousal: 0.6
            },
            gratitude: {
                keywords: ['謝謝', '感謝', '感恩', 'thank you', 'thanks', 'grateful'],
                valence: 0.8,
                arousal: 0.4
            },
            apology: {
                keywords: ['對不起', '抱歉', '不好意思', 'sorry', 'apologize'],
                valence: -0.3,
                arousal: 0.5
            }
        };
    }
    
    tag(text) {
        if (!text || typeof text !== 'string') {
            return { valence: 0, arousal: 0.3, emotions: [] };
        }
        
        const detectedEmotions = this.detectEmotions(text);
        
        let totalValence = 0;
        let totalArousal = 0;
        let count = 0;
        
        for (const emotion of detectedEmotions) {
            totalValence += emotion.valence;
            totalArousal += emotion.arousal;
            count++;
        }
        
        let finalValence = count > 0 ? totalValence / count : 0;
        let finalArousal = count > 0 ? totalArousal / count : 0.3;
        
        const modifierEffect = this.applyModifiers(text, finalValence, finalArousal);
        finalValence = modifierEffect.valence;
        finalArousal = modifierEffect.arousal;
        
        return {
            valence: Math.max(-1, Math.min(1, finalValence)),
            arousal: Math.max(0, Math.min(1, finalArousal)),
            emotions: detectedEmotions.map(e => e.category)
        };
    }
    
    detectEmotions(text) {
        const detected = [];
        const lowerText = text.toLowerCase();
        
        for (const [phrase, config] of Object.entries(this.emotionPhrases)) {
            for (const keyword of config.keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    detected.push({
                        category: phrase,
                        valence: config.valence,
                        arousal: config.arousal,
                        matched: keyword
                    });
                }
            }
        }
        
        for (const [polarity, arousalLevels] of Object.entries(this.emotionLexicon)) {
            if (polarity === 'neutral') {
                for (const keyword of arousalLevels.keywords) {
                    if (lowerText.includes(keyword.toLowerCase())) {
                        detected.push({
                            category: 'neutral',
                            valence: arousalLevels.valence,
                            arousal: arousalLevels.arousal,
                            matched: keyword
                        });
                    }
                }
            } else {
                for (const [arousalLevel, config] of Object.entries(arousalLevels)) {
                    for (const keyword of config.keywords) {
                        if (lowerText.includes(keyword.toLowerCase())) {
                            detected.push({
                                category: `${polarity}_${arousalLevel}`,
                                valence: config.valence,
                                arousal: config.arousal,
                                matched: keyword
                            });
                        }
                    }
                }
            }
        }
        
        return this.deduplicateEmotions(detected);
    }
    
    deduplicateEmotions(emotions) {
        const seen = new Set();
        return emotions.filter(e => {
            if (seen.has(e.category)) return false;
            seen.add(e.category);
            return true;
        });
    }
    
    applyModifiers(text, valence, arousal) {
        const lowerText = text.toLowerCase();
        let modifiedValence = valence;
        let modifiedArousal = arousal;
        
        for (const intensifier of this.modifiers.intensifiers) {
            if (lowerText.includes(intensifier.toLowerCase())) {
                modifiedArousal = Math.min(1, modifiedArousal * 1.3);
                modifiedValence *= 1.2;
                break;
            }
        }
        
        for (const diminisher of this.modifiers.diminishers) {
            if (lowerText.includes(diminisher.toLowerCase())) {
                modifiedArousal = Math.max(0, modifiedArousal * 0.7);
                modifiedValence *= 0.7;
                break;
            }
        }
        
        for (const negator of this.modifiers.negators) {
            const regex = new RegExp(`${negator}\\s*\\S+`, 'gi');
            if (regex.test(text)) {
                modifiedValence *= -0.7;
                break;
            }
        }
        
        return { valence: modifiedValence, arousal: modifiedArousal };
    }
    
    getEmotionLabel(valence, arousal) {
        if (valence > 0.5 && arousal > 0.6) return '興奮';
        if (valence > 0.5 && arousal <= 0.6) return '愉快';
        if (valence > 0 && arousal <= 0.4) return '平靜';
        if (valence < -0.5 && arousal > 0.6) return '憤怒';
        if (valence < -0.5 && arousal <= 0.6) return '悲傷';
        if (valence < 0 && arousal <= 0.4) return '疲憊';
        if (valence >= -0.3 && valence <= 0.3) return '中性';
        
        return '未知';
    }
    
    formatEmotionalData(data) {
        const label = this.getEmotionLabel(data.valence, data.arousal);
        const valenceDesc = data.valence > 0 ? '正向' : (data.valence < 0 ? '負向' : '中性');
        const arousalDesc = data.arousal > 0.6 ? '高喚醒' : (data.arousal < 0.4 ? '低喚醒' : '中喚醒');
        
        return {
            label,
            valence: data.valence.toFixed(2),
            arousal: data.arousal.toFixed(2),
            description: `${valenceDesc} / ${arousalDesc}`,
            emotions: data.emotions
        };
    }
}