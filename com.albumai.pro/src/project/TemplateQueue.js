/** Immutable, deterministic queue of unique template descriptors. */
export default class TemplateQueue {

    constructor(templates = []) {

        const seen = new Set();
        const entries = templates.reduce((result, template, index) => {
            const key = TemplateQueue.key(template);
            if (!template || seen.has(key)) return result;
            seen.add(key);
            result.push(Object.freeze({ template, index, key }));
            return result;
        }, []);

        this.entries = Object.freeze(entries);
        Object.freeze(this);

    }

    get total() { return this.entries.length; }

    descriptorAt(index) { return this.entries[index]?.template ?? null; }

    snapshot({ currentIndex = -1, completed = 0, failed = 0 } = {}) {

        const normalizedCompleted = Math.max(0, Math.min(completed, this.total));
        const normalizedFailed = Math.max(0, Math.min(failed, normalizedCompleted));

        return Object.freeze({
            total: this.total,
            pending: Math.max(0, this.total - normalizedCompleted),
            current: this.descriptorAt(currentIndex),
            currentIndex: currentIndex >= 0 ? currentIndex : null,
            completed: normalizedCompleted,
            failed: normalizedFailed
        });

    }

    static key(template) {

        return String(template?.id ?? template?.filePath ?? template?.name ?? "");

    }

}
