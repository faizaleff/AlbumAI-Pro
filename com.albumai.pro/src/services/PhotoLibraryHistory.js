export const PhotoLibraryHistoryKind = Object.freeze({
    SELECTION: "selection",
    DECISION: "decision",
    EVENT: "event"
});

export default class PhotoLibraryHistory {
    constructor({ limit = 200 } = {}) {
        this.limit = Math.max(1, Number(limit) || 200);
        this.undoStack = [];
        this.redoStack = [];
    }

    push(kind, snapshot, { equals } = {}) {
        if (!kind) return false;
        const previous = this.undoStack[this.undoStack.length - 1];
        if (previous?.kind === kind && typeof equals === "function" &&
            equals(previous.snapshot, snapshot)) {
            return false;
        }

        this.undoStack.push({ kind, snapshot });
        if (this.undoStack.length > this.limit) this.undoStack.shift();
        this.redoStack = [];
        return true;
    }

    undo(currentSnapshotForKind) {
        const entry = this.undoStack.pop();
        if (!entry) return null;
        this.redoStack.push({
            kind: entry.kind,
            snapshot: currentSnapshotForKind(entry.kind)
        });
        return entry;
    }

    redo(currentSnapshotForKind) {
        const entry = this.redoStack.pop();
        if (!entry) return null;
        this.undoStack.push({
            kind: entry.kind,
            snapshot: currentSnapshotForKind(entry.kind)
        });
        return entry;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }
}
