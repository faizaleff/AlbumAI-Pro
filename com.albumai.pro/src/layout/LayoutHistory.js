class LayoutHistory {

    constructor(limit = 100) {

        this.limit = limit;

        this.undoStack = [];

        this.redoStack = [];

    }

    push(state) {

        if (!state)
            return;

        this.undoStack.push(this.clone(state));

        if (this.undoStack.length > this.limit)
            this.undoStack.shift();

        this.redoStack = [];

    }

    undo(currentState) {

        if (!this.canUndo())
            return currentState;

        this.redoStack.push(this.clone(currentState));

        return this.undoStack.pop();

    }

    redo(currentState) {

        if (!this.canRedo())
            return currentState;

        this.undoStack.push(this.clone(currentState));

        return this.redoStack.pop();

    }

    canUndo() {

        return this.undoStack.length > 0;

    }

    canRedo() {

        return this.redoStack.length > 0;

    }

    clear() {

        this.undoStack = [];

        this.redoStack = [];

    }

    undoCount() {

        return this.undoStack.length;

    }

    redoCount() {

        return this.redoStack.length;

    }

    clone(state) {

        return structuredClone(state);

    }

}

export default LayoutHistory;