import Logger from "../core/photoshop/Logger";

export default class UndoRedoService {

    constructor() {

        this.undoStack = [];

        this.redoStack = [];

    }

    push(action) {

        if (!action)
            return;

        this.undoStack.push(action);

        this.redoStack.length = 0;

    }

    async undo() {

        if (!this.undoStack.length)
            return false;

        const action =
            this.undoStack.pop();

        if (
            typeof action.undo ===
            "function"
        ) {

            await action.undo();

        }

        this.redoStack.push(action);

        Logger.info("Undo");

        return true;

    }

    async redo() {

        if (!this.redoStack.length)
            return false;

        const action =
            this.redoStack.pop();

        if (
            typeof action.redo ===
            "function"
        ) {

            await action.redo();

        }

        this.undoStack.push(action);

        Logger.info("Redo");

        return true;

    }

    clear() {

        this.undoStack.length = 0;

        this.redoStack.length = 0;

    }

    canUndo() {

        return this.undoStack.length > 0;

    }

    canRedo() {

        return this.redoStack.length > 0;

    }

    undoCount() {

        return this.undoStack.length;

    }

    redoCount() {

        return this.redoStack.length;

    }

}