/**
 * DecayEngine - 遺忘曲線引擎
 * 
 * 基於艾賓浩斯遺忘曲線實現記憶衰減：
 * - 自然衰減：隨時間自然遺忘
 * - 強化機制：成功提取後強化記憶
 * - 選擇性遺忘：重要性高的記憶衰減較慢
 */

export class DecayEngine {
    constructor(decayRate = 0.1) {
        this.decayRate = decayRate;
        
        this.ebbinghausRetention = {
            minutes_20: 0.58,
            hour_1: 0.44,
            hour_8: 0.36,
            day_1: 0.33,
            day_2: 0.28,
            day_6: 0.25,
            day_31: 0.21
        };
    }
    
    decay(currentFactor, ageInDays, importance = 0.5) {
        const importanceFactor = 1 - (importance * 0.5);
        
        const timeDecay = Math.exp(-this.decayRate * ageInDays * importanceFactor);
        
        const newFactor = currentFactor * timeDecay;
        
        return Math.max(0.01, Math.min(1.0, newFactor));
    }
    
    reinforce(currentFactor, reinforcementStrength = 0.2) {
        const boost = (1 - currentFactor) * reinforcementStrength;
        
        const newFactor = currentFactor + boost;
        
        return Math.min(1.0, newFactor);
    }
    
    calculateRetention(ageInDays) {
        if (ageInDays <= 0) return 1.0;
        
        const retention = Math.exp(-ageInDays / 9);
        
        return Math.max(0.1, retention);
    }
    
    // 從「上一次衰減的時間點」到現在經過的衰減（不是從建立時間算起，否則每次睡眠週期都會把整段時間重複算一次，
    // 記憶會以時間平方的速度消失，約一個月就全部被遺忘）
    effectiveFactor(memory, now = Date.now()) {
        const since = new Date(memory.lastDecayed || memory.timestamp || memory.created_at || now).getTime();
        const days = Math.max(0, (now - (Number.isNaN(since) ? now : since)) / (1000 * 60 * 60 * 24));
        return this.decay(memory.decayFactor ?? 1.0, days, memory.importance ?? 0.5);
    }

    // 永久記憶與重要的記憶不會被遺忘，剛建立不到 7 天的也不會
    isProtected(memory, now = Date.now()) {
        if (memory.memory_type === 'permanent' || (memory.importance ?? 0) >= 0.8) return true;
        const created = new Date(memory.created_at || memory.timestamp || now).getTime();
        return !Number.isNaN(created) && now - created < 7 * 24 * 60 * 60 * 1000;
    }

    shouldForget(decayFactor, threshold = 0.1) {
        return decayFactor < threshold;
    }
    
    getDecayStage(decayFactor) {
        if (decayFactor >= 0.9) return 'fresh';
        if (decayFactor >= 0.7) return 'recent';
        if (decayFactor >= 0.5) return 'fading';
        if (decayFactor >= 0.3) return 'weak';
        if (decayFactor >= 0.1) return 'fading_fast';
        return 'forgotten';
    }
    
    calculateOptimalReviewTime(memory) {
        const currentFactor = memory.decayFactor;
        const importance = memory.importance;
        
        const baseInterval = 1;
        const intervalMultiplier = currentFactor * importance;
        
        const optimalDays = baseInterval + (7 * intervalMultiplier);
        
        const reviewDate = new Date();
        reviewDate.setDate(reviewDate.getDate() + optimalDays);
        
        return {
            date: reviewDate.toISOString(),
            daysUntilReview: optimalDays,
            urgency: 1 - currentFactor
        };
    }
    
    applySpacedRepetition(memory, success = true) {
        const currentInterval = memory.reviewInterval || 1;
        const easeFactor = memory.easeFactor || 2.5;
        
        let newInterval;
        let newEaseFactor;
        
        if (success) {
            newInterval = currentInterval * easeFactor;
            newEaseFactor = easeFactor + 0.1;
        } else {
            newInterval = currentInterval * 0.5;
            newEaseFactor = Math.max(1.3, easeFactor - 0.2);
        }
        
        newInterval = Math.max(1, Math.min(365, newInterval));
        newEaseFactor = Math.max(1.3, Math.min(3.0, newEaseFactor));
        
        return {
            reviewInterval: newInterval,
            easeFactor: newEaseFactor,
            nextReview: this.calculateNextReview(newInterval)
        };
    }
    
    calculateNextReview(days) {
        const next = new Date();
        next.setDate(next.getDate() + days);
        return next.toISOString();
    }
    
    batchDecay(memories, currentTimestamp = Date.now()) {
        return memories.map(memory => {
            const memoryTime = new Date(memory.timestamp || memory.created_at || currentTimestamp).getTime();
            const ageInDays = (currentTimestamp - memoryTime) / (1000 * 60 * 60 * 24);
            const newDecayFactor = this.effectiveFactor(memory, currentTimestamp);

            return {
                ...memory,
                decayFactor: newDecayFactor,
                decayStage: this.getDecayStage(newDecayFactor),
                lastDecayed: currentTimestamp,
                age: ageInDays
            };
        });
    }
    
    updateDecayRate(newRate) {
        this.decayRate = Math.max(0.01, Math.min(1.0, newRate));
    }
    
    getDecayStats(memories) {
        const stages = {
            fresh: 0,
            recent: 0,
            fading: 0,
            weak: 0,
            fading_fast: 0,
            forgotten: 0
        };
        
        let totalDecay = 0;
        
        for (const memory of memories) {
            const stage = this.getDecayStage(memory.decayFactor);
            stages[stage]++;
            totalDecay += memory.decayFactor;
        }
        
        return {
            stages,
            averageDecay: memories.length > 0 ? totalDecay / memories.length : 0,
            totalMemories: memories.length,
            forgottenCount: stages.forgotten + stages.fading_fast,
            healthyCount: stages.fresh + stages.recent
        };
    }
}
