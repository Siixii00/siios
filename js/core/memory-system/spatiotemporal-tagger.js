/**
 * SpatiotemporalTagger - 時空標註器
 * 
 * 為記憶添加時空資訊：
 * - 時間標記（絕對時間、相對時間）
 * - 空間標記（地點、環境）
 * - 情境標記（活動類型）
 */

export class SpatiotemporalTagger {
    constructor() {
        this.locationPatterns = {
            indoor: [
                '家', '房間', '臥室', '客廳', '廚房', '浴室',
                '學校', '教室', '辦公室', '公司',
                '餐廳', '咖啡廳', '酒吧', '商店', '超市',
                '醫院', '圖書館', '博物館', '電影院', '劇院',
                '旅館', '飯店', '宿舍',
                'home', 'room', 'bedroom', 'living room', 'kitchen', 'bathroom',
                'school', 'classroom', 'office', 'company',
                'restaurant', 'cafe', 'bar', 'shop', 'store',
                'hospital', 'library', 'museum', 'cinema', 'theater',
                'hotel', 'dorm'
            ],
            outdoor: [
                '公園', '花園', '街道', '路', '廣場',
                '海邊', '海灘', '山上', '森林', '田野',
                '操場', '運動場', '球場',
                'park', 'garden', 'street', 'road', 'square',
                'beach', 'mountain', 'forest', 'field',
                'playground', 'stadium'
            ],
            transport: [
                '車', '汽車', '公車', '捷運', '地鐵', '火車', '飛機',
                '計程車', 'Uber',
                'car', 'bus', 'subway', 'metro', 'train', 'plane', 'taxi'
            ]
        };
        
        this.timePatterns = {
            morning: ['早上', '早晨', '上午', 'morning'],
            noon: ['中午', '正午', 'noon'],
            afternoon: ['下午', 'afternoon'],
            evening: ['傍晚', '黃昏', 'evening'],
            night: ['晚上', '夜晚', '深夜', 'night', 'midnight'],
            dawn: ['凌晨', '黎明', 'dawn']
        };
        
        this.activityPatterns = {
            dining: ['吃', '喝', '用餐', '午餐', '晚餐', '早餐', 'eat', 'drink', 'dinner', 'lunch', 'breakfast'],
            working: ['工作', '上班', '開會', '報告', 'work', 'meeting', 'report'],
            studying: ['讀書', '學習', '考試', '寫作業', 'study', 'learn', 'exam', 'homework'],
            exercising: ['運動', '健身', '跑步', '游泳', 'exercise', 'gym', 'run', 'swim'],
            shopping: ['購物', '逛街', '買', 'shopping', 'buy'],
            traveling: ['旅行', '旅遊', '出遊', 'travel', 'trip', 'tour'],
            resting: ['休息', '睡覺', '放鬆', 'rest', 'sleep', 'relax'],
            socializing: ['聊天', '聚會', '約會', 'chat', 'party', 'date', 'hangout'],
            entertainment: ['看電影', '聽音樂', '玩遊戲', 'movie', 'music', 'game']
        };
        
        this.contextKeywords = {
            romantic: ['約會', '浪漫', '親吻', '擁抱', 'date', 'romantic', 'kiss', 'hug'],
            friendly: ['朋友', '聊天', '聚會', 'friend', 'chat', 'party'],
            professional: ['工作', '會議', '報告', 'work', 'meeting', 'report'],
            casual: ['隨意', '放鬆', '休閒', 'casual', 'relax', 'leisure'],
            intimate: ['親密', '私密', '親近', 'intimate', 'private'],
            conflict: ['爭吵', '衝突', '吵架', 'fight', 'conflict', 'argue']
        };
    }
    
    tag(text, context = {}) {
        const result = {
            timestamp: context.timestamp || new Date().toISOString(),
            relativeTime: this.extractRelativeTime(text),
            location: this.extractLocation(text),
            environment: this.extractEnvironment(text),
            activity: this.extractActivity(text),
            context: this.extractContext(text)
        };
        
        return result;
    }
    
    extractRelativeTime(text) {
        const lowerText = text.toLowerCase();
        
        for (const [period, keywords] of Object.entries(this.timePatterns)) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    return period;
                }
            }
        }
        
        const timeMatch = text.match(/(\d{1,2}):(\d{2})/);
        if (timeMatch) {
            const hour = parseInt(timeMatch[1]);
            if (hour >= 5 && hour < 12) return 'morning';
            if (hour >= 12 && hour < 14) return 'noon';
            if (hour >= 14 && hour < 18) return 'afternoon';
            if (hour >= 18 && hour < 21) return 'evening';
            return 'night';
        }
        
        const relativePatterns = [
            { pattern: /剛才|剛剛|just now/i, value: 'just_now' },
            { pattern: /今天|today/i, value: 'today' },
            { pattern: /昨天|yesterday/i, value: 'yesterday' },
            { pattern: /前天/i, value: 'day_before_yesterday' },
            { pattern: /明天|tomorrow/i, value: 'tomorrow' },
            { pattern: /上週|上個星期|last week/i, value: 'last_week' },
            { pattern: /下週|下個星期|next week/i, value: 'next_week' },
            { pattern: /上個月|last month/i, value: 'last_month' },
            { pattern: /下個月|next month/i, value: 'next_month' }
        ];
        
        for (const { pattern, value } of relativePatterns) {
            if (pattern.test(text)) {
                return value;
            }
        }
        
        return null;
    }
    
    extractLocation(text) {
        const lowerText = text.toLowerCase();
        const foundLocations = [];
        
        for (const [type, keywords] of Object.entries(this.locationPatterns)) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    foundLocations.push({ keyword, type });
                }
            }
        }
        
        if (foundLocations.length === 0) return null;
        
        foundLocations.sort((a, b) => {
            const indexA = lowerText.indexOf(a.keyword.toLowerCase());
            const indexB = lowerText.indexOf(b.keyword.toLowerCase());
            return indexA - indexB;
        });
        
        return foundLocations[0].keyword;
    }
    
    extractEnvironment(text) {
        const lowerText = text.toLowerCase();
        
        const environmentKeywords = {
            indoor: ['室內', '裡面', '裡', 'inside', 'indoor'],
            outdoor: ['室外', '外面', '外', 'outside', 'outdoor'],
            crowded: ['擁擠', '人多', '熱鬧', 'crowded', 'busy'],
            quiet: ['安靜', '清靜', '安寧', 'quiet', 'peaceful'],
            dark: ['黑暗', '昏暗', '暗', 'dark'],
            bright: ['明亮', '光亮', '亮', 'bright', 'light']
        };
        
        const found = [];
        
        for (const [env, keywords] of Object.entries(environmentKeywords)) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    found.push(env);
                    break;
                }
            }
        }
        
        return found.length > 0 ? found : null;
    }
    
    extractActivity(text) {
        const lowerText = text.toLowerCase();
        
        for (const [activity, keywords] of Object.entries(this.activityPatterns)) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    return activity;
                }
            }
        }
        
        return null;
    }
    
    extractContext(text) {
        const lowerText = text.toLowerCase();
        
        for (const [context, keywords] of Object.entries(this.contextKeywords)) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    return context;
                }
            }
        }
        
        return null;
    }
    
    formatSpatiotemporal(data) {
        const parts = [];
        
        if (data.relativeTime) {
            parts.push(`時間: ${this.translateTime(data.relativeTime)}`);
        }
        
        if (data.location) {
            parts.push(`地點: ${data.location}`);
        }
        
        if (data.environment) {
            parts.push(`環境: ${data.environment.join(', ')}`);
        }
        
        if (data.activity) {
            parts.push(`活動: ${this.translateActivity(data.activity)}`);
        }
        
        if (data.context) {
            parts.push(`情境: ${this.translateContext(data.context)}`);
        }
        
        return parts.join('\n');
    }
    
    translateTime(time) {
        const translations = {
            morning: '早上',
            noon: '中午',
            afternoon: '下午',
            evening: '傍晚',
            night: '晚上',
            dawn: '凌晨',
            just_now: '剛才',
            today: '今天',
            yesterday: '昨天',
            day_before_yesterday: '前天',
            tomorrow: '明天',
            last_week: '上週',
            next_week: '下週',
            last_month: '上個月',
            next_month: '下個月'
        };
        
        return translations[time] || time;
    }
    
    translateActivity(activity) {
        const translations = {
            dining: '用餐',
            working: '工作',
            studying: '學習',
            exercising: '運動',
            shopping: '購物',
            traveling: '旅行',
            resting: '休息',
            socializing: '社交',
            entertainment: '娛樂'
        };
        
        return translations[activity] || activity;
    }
    
    translateContext(context) {
        const translations = {
            romantic: '浪漫',
            friendly: '友好',
            professional: '專業',
            casual: '休閒',
            intimate: '親密',
            conflict: '衝突'
        };
        
        return translations[context] || context;
    }
}