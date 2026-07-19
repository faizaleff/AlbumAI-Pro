// src/core/smartobjects/SmartObjectHistory.js

class SmartObjectHistory {

    constructor(editor) {

        this.editor = editor;
        this.active = false;
        this.completed = false;

    }

    /**
     * Begin a Smart Object transaction.
     */
    async begin() {

        this.active = true;
        this.completed = false;

    }

    /**
     * Commit changes.
     */
    async commit() {

        if (!this.active)
            return;

        await this.editor.commit();

        this.active = false;
        this.completed = true;

    }

    /**
     * Rollback changes.
     */
    async rollback() {

        if (!this.active)
            return;

        await this.editor.rollback();

        this.active = false;
        this.completed = false;

    }

    /**
     * Execute work inside a transaction.
     */
    async execute(callback) {

        await this.begin();

        try {

            const result = await callback();

            await this.commit();

            return result;

        } catch (error) {

            await this.rollback();

            throw error;

        }

    }

    /**
     * Transaction state.
     */
    isActive() {

        return this.active;

    }

    /**
     * Last transaction completed successfully.
     */
    isCompleted() {

        return this.completed;

    }

    /**
     * Reset state.
     */
    reset() {

        this.active = false;
        this.completed = false;

    }

}

export default SmartObjectHistory;