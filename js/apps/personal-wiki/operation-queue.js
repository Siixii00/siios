class OperationQueue {
    constructor() {
        this.queue = [];
        this.isProcessing = false;
        this.currentOperation = null;
    }

    async enqueue(operation, priority = 'normal') {
        return new Promise((resolve, reject) => {
            const item = {
                operation,
                priority: priority === 'high' ? 1 : priority === 'low' ? 3 : 2,
                resolve,
                reject,
                timestamp: Date.now()
            };

            this.queue.push(item);
            this.queue.sort((a, b) => a.priority - b.priority);

            if (!this.isProcessing) {
                this.processNext();
            }
        });
    }

    async processNext() {
        if (this.queue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const item = this.queue.shift();
        this.currentOperation = item;

        try {
            const result = await item.operation();
            item.resolve(result);
        } catch (error) {
            item.reject(error);
        } finally {
            this.currentOperation = null;
            await this.processNext();
        }
    }

    clear() {
        this.queue = [];
        this.isProcessing = false;
        this.currentOperation = null;
    }

    getQueueLength() {
        return this.queue.length;
    }

    isLocked() {
        return this.isProcessing;
    }
}

class SaveManager {
    constructor() {
        this.pendingSaves = new Map();
        this.operationQueue = new OperationQueue();
        this.debounceTimers = new Map();
        this.debounceDelay = 300;
    }

    async saveWithDebounce(recordId, saveFunction, immediate = false) {
        if (this.debounceTimers.has(recordId)) {
            clearTimeout(this.debounceTimers.get(recordId));
        }

        if (immediate) {
            return await this.operationQueue.enqueue(async () => {
                return await saveFunction();
            }, 'high');
        }

        return new Promise((resolve, reject) => {
            const timer = setTimeout(async () => {
                try {
                    const result = await this.operationQueue.enqueue(async () => {
                        return await saveFunction();
                    }, 'normal');
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.debounceTimers.delete(recordId);
                }
            }, this.debounceDelay);

            this.debounceTimers.set(recordId, timer);
        });
    }

    async saveImmediate(recordId, saveFunction) {
        if (this.debounceTimers.has(recordId)) {
            clearTimeout(this.debounceTimers.get(recordId));
            this.debounceTimers.delete(recordId);
        }

        return await this.operationQueue.enqueue(async () => {
            return await saveFunction();
        }, 'high');
    }

    cancelPendingSave(recordId) {
        if (this.debounceTimers.has(recordId)) {
            clearTimeout(this.debounceTimers.get(recordId));
            this.debounceTimers.delete(recordId);
        }
    }

    clearAll() {
        for (const timer of this.debounceTimers.values()) {
            clearTimeout(timer);
        }
        this.debounceTimers.clear();
        this.operationQueue.clear();
    }
}

export { OperationQueue, SaveManager };