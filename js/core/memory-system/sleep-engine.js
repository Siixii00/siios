/**
 * SleepEngine - 睡眠週期引擎
 * 
 * 模擬睡眠週期處理記憶：
 * - 慢波睡眠：處理陳述性記憶
 * - REM 睡眠：處理情緒與程序性記憶
 */

export class SleepEngine {
    constructor(settings = {}) {
        this.settings = {
            enabled: settings.sleepCycleEnabled ?? true,
            startTime: settings.sleepStartTime || '02:00',
            endTime: settings.sleepEndTime || '06:00',
            timezone: settings.timezone || 'Asia/Taipei'
        };
        
        this.sleepCallbacks = [];
        this.wakeCallbacks = [];
        this.isSleeping = false;
        this.intervalId = null;
        this.lastCheckTime = null;
    }
    
    start() {
        if (!this.settings.enabled) {
            console.log('[SleepEngine] 睡眠週期已停用');
            return;
        }
        
        console.log(`[SleepEngine] 啟動睡眠週期監控: ${this.settings.startTime} - ${this.settings.endTime}`);
        
        this.intervalId = setInterval(() => {
            this.checkSleepCycle();
        }, 60000);
        
        this.checkSleepCycle();
    }
    
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
        
        console.log('[SleepEngine] 睡眠週期監控已停止');
    }
    
    checkSleepCycle() {
        const now = new Date();
        const currentTime = this.getTimeString(now);
        
        const shouldSleep = this.isWithinSleepWindow(currentTime);
        
        if (shouldSleep && !this.isSleeping) {
            this.enterSleep();
        } else if (!shouldSleep && this.isSleeping) {
            this.exitSleep();
        }
        
        this.lastCheckTime = now.toISOString();
    }
    
    getTimeString(date) {
        const hours = date.getHours().toString().padStart(2, '0');
        const minutes = date.getMinutes().toString().padStart(2, '0');
        return `${hours}:${minutes}`;
    }
    
    isWithinSleepWindow(currentTime) {
        const start = this.settings.startTime;
        const end = this.settings.endTime;
        
        if (start <= end) {
            return currentTime >= start && currentTime <= end;
        } else {
            return currentTime >= start || currentTime <= end;
        }
    }
    
    async enterSleep() {
        this.isSleeping = true;
        console.log('[SleepEngine] 進入睡眠週期');
        
        for (const callback of this.sleepCallbacks) {
            try {
                await callback();
            } catch (error) {
                console.error('[SleepEngine] 睡眠回調執行失敗:', error);
            }
        }
    }
    
    async exitSleep() {
        this.isSleeping = false;
        console.log('[SleepEngine] 退出睡眠週期');
        
        for (const callback of this.wakeCallbacks) {
            try {
                await callback();
            } catch (error) {
                console.error('[SleepEngine] 喚醒回調執行失敗:', error);
            }
        }
    }
    
    onSleep(callback) {
        if (typeof callback === 'function') {
            this.sleepCallbacks.push(callback);
        }
    }
    
    onWake(callback) {
        if (typeof callback === 'function') {
            this.wakeCallbacks.push(callback);
        }
    }
    
    async triggerManualSleep() {
        console.log('[SleepEngine] 手動觸發睡眠週期');
        await this.enterSleep();
        
        setTimeout(async () => {
            await this.exitSleep();
        }, 5000);
    }
    
    updateSettings(newSettings) {
        this.settings = {
            ...this.settings,
            ...newSettings
        };
        
        console.log(`[SleepEngine] 設定已更新: ${this.settings.startTime} - ${this.settings.endTime}`);
    }
    
    getStatus() {
        return {
            enabled: this.settings.enabled,
            isSleeping: this.isSleeping,
            sleepWindow: {
                start: this.settings.startTime,
                end: this.settings.endTime
            },
            lastCheck: this.lastCheckTime,
            nextSleep: this.getNextSleepTime(),
            nextWake: this.getNextWakeTime()
        };
    }
    
    getNextSleepTime() {
        if (!this.settings.enabled) return null;
        
        const now = new Date();
        const [startHour, startMin] = this.settings.startTime.split(':').map(Number);
        
        const nextSleep = new Date(now);
        nextSleep.setHours(startHour, startMin, 0, 0);
        
        if (nextSleep <= now) {
            nextSleep.setDate(nextSleep.getDate() + 1);
        }
        
        return nextSleep.toISOString();
    }
    
    getNextWakeTime() {
        if (!this.settings.enabled) return null;
        
        const now = new Date();
        const [endHour, endMin] = this.settings.endTime.split(':').map(Number);
        
        const nextWake = new Date(now);
        nextWake.setHours(endHour, endMin, 0, 0);
        
        if (nextWake <= now) {
            nextWake.setDate(nextWake.getDate() + 1);
        }
        
        return nextWake.toISOString();
    }
    
    getSleepPhase() {
        if (!this.isSleeping) {
            return { phase: 'awake', description: '清醒狀態' };
        }
        
        const now = new Date();
        const [startHour, startMin] = this.settings.startTime.split(':').map(Number);
        const [endHour, endMin] = this.settings.endTime.split(':').map(Number);
        
        const sleepStart = new Date(now);
        sleepStart.setHours(startHour, startMin, 0, 0);
        
        const sleepEnd = new Date(now);
        sleepEnd.setHours(endHour, endMin, 0, 0);
        
        if (sleepEnd < sleepStart) {
            sleepEnd.setDate(sleepEnd.getDate() + 1);
        }
        
        const totalSleepMs = sleepEnd - sleepStart;
        const elapsedMs = now - sleepStart;
        const progress = elapsedMs / totalSleepMs;
        
        if (progress < 0.2) {
            return { phase: 'nrem1', description: '淺睡眠（NREM 1）' };
        } else if (progress < 0.4) {
            return { phase: 'nrem2', description: '淺睡眠（NREM 2）' };
        } else if (progress < 0.6) {
            return { phase: 'nrem3', description: '深睡眠（NREM 3 / 慢波睡眠）' };
        } else if (progress < 0.8) {
            return { phase: 'rem', description: '快速動眼睡眠（REM）' };
        } else {
            return { phase: 'nrem2', description: '淺睡眠（NREM 2）' };
        }
    }
}