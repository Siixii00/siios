class HistoryManager {
    constructor(maxHistorySize = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistorySize = maxHistorySize;
        this.isPerformingAction = false;
    }

    pushState(state, description = '') {
        if (this.isPerformingAction) return;

        const historyEntry = {
            state: this.deepClone(state),
            description,
            timestamp: Date.now()
        };

        this.undoStack.push(historyEntry);

        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }

        this.redoStack = [];
    }

    canUndo() {
        return this.undoStack.length > 1;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    undo(currentState) {
        if (!this.canUndo()) {
            return null;
        }

        this.isPerformingAction = true;

        const currentEntry = {
            state: this.deepClone(currentState),
            description: 'Current state',
            timestamp: Date.now()
        };
        this.redoStack.push(currentEntry);

        const previousEntry = this.undoStack.pop();

        this.isPerformingAction = false;

        return previousEntry.state;
    }

    redo(currentState) {
        if (!this.canRedo()) {
            return null;
        }

        this.isPerformingAction = true;

        const currentEntry = {
            state: this.deepClone(currentState),
            description: 'Current state',
            timestamp: Date.now()
        };
        this.undoStack.push(currentEntry);

        const nextEntry = this.redoStack.pop();

        this.isPerformingAction = false;

        return nextEntry.state;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    getHistoryInfo() {
        return {
            undoCount: this.undoStack.length,
            redoCount: this.redoStack.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            lastAction: this.undoStack.length > 0 
                ? this.undoStack[this.undoStack.length - 1].description 
                : null
        };
    }

    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }

        if (Array.isArray(obj)) {
            return obj.map(item => this.deepClone(item));
        }

        const cloned = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                cloned[key] = this.deepClone(obj[key]);
            }
        }
        return cloned;
    }
}

export { HistoryManager };