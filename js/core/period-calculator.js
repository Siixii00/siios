import { HealthDB } from '../db.js';

class PeriodCalculator {
    static async calculateNextPeriod(userId) {
        const periods = await HealthDB.getRecentPeriods(userId, 6);
        const settings = await HealthDB.getPeriodSettings(userId);
        
        if (periods.length === 0 && !settings?.last_period_date) {
            return null;
        }
        
        let avgCycleLength = settings?.default_cycle_length || 28;
        
        if (periods.length >= 2) {
            const cycles = [];
            for (let i = 0; i < periods.length - 1; i++) {
                const current = periods[i].start_date;
                const next = periods[i + 1].start_date;
                const diff = Math.round((current - next) / (1000 * 60 * 60 * 24));
                if (diff > 14 && diff < 45) {
                    cycles.push(diff);
                }
            }
            if (cycles.length > 0) {
                avgCycleLength = Math.round(cycles.reduce((a, b) => a + b, 0) / cycles.length);
            }
        }
        
        const lastPeriod = periods[0];
        const lastDate = lastPeriod?.start_date || settings?.last_period_date;
        
        if (!lastDate) return null;
        
        const predictedDate = new Date(lastDate);
        predictedDate.setDate(predictedDate.getDate() + avgCycleLength);
        
        return {
            predicted_date: predictedDate.getTime(),
            cycle_length: avgCycleLength,
            days_until: Math.round((predictedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
            confidence: periods.length >= 3 ? 'high' : periods.length >= 1 ? 'medium' : 'low'
        };
    }
    
    static async getPeriodHistory(userId, limit = 12) {
        return await HealthDB.getRecentPeriods(userId, limit);
    }
    
    static async updatePrediction(userId) {
        const prediction = await this.calculateNextPeriod(userId);
        if (!prediction) return null;
        
        const settings = await HealthDB.getPeriodSettings(userId);
        if (settings) {
            await HealthDB.savePeriodSettings({
                user_id: userId,
                predicted_next_date: prediction.predicted_date,
                default_cycle_length: prediction.cycle_length
            });
        }
        
        return prediction;
    }
    
    static async shouldRemind(userId) {
        const settings = await HealthDB.getPeriodSettings(userId);
        if (!settings || !settings.reminder_in_chat) return null;
        
        const prediction = await this.calculateNextPeriod(userId);
        if (!prediction) return null;
        
        const daysBefore = settings.reminder_days_before || 3;
        
        if (prediction.days_until <= daysBefore && prediction.days_until >= 0) {
            return prediction;
        }
        
        return null;
    }
    
    static buildHealthContext(prediction, memoryTemplate) {
        if (!prediction && !memoryTemplate) return null;
        
        let context = '[Health Context - For Your Information Only]\n';
        
        if (prediction && prediction.days_until <= 7) {
            context += 'User period is expected in about ' + prediction.days_until + ' day(s).\n';
        }
        
        if (memoryTemplate) {
            if (memoryTemplate.period_symptoms && memoryTemplate.period_symptoms.length > 0) {
                context += 'User often experiences: ' + memoryTemplate.period_symptoms.join(', ') + '.\n';
            }
            if (memoryTemplate.period_mood_changes && memoryTemplate.period_mood_changes.length > 0) {
                context += 'Mood changes may include: ' + memoryTemplate.period_mood_changes.join(', ') + '.\n';
            }
        }
        
        context += '\nUse this information based on YOUR character personality. Think naturally.';
        context += '\nRemember: Care naturally, respect boundaries.';
        context += '\n[/Health Context]';
        
        return context;
    }
}

export { PeriodCalculator };