class AlbumCommandManager {

    constructor() {

        this.commands = new Map();

        this.history = [];

    }

    register(name, execute, undo = null) {

        this.commands.set(name, {

            execute,

            undo

        });

    }

    unregister(name) {

        this.commands.delete(name);

    }

    has(name) {

        return this.commands.has(name);

    }

    async execute(name, payload = {}) {

        const command = this.commands.get(name);

        if (!command)
            throw new Error(`Unknown command: ${name}`);

        const result = await command.execute(payload);

        this.history.push({

            name,

            payload,

            timestamp: Date.now()

        });

        return result;

    }

    async undo() {

        if (!this.history.length)
            return;

        const item = this.history.pop();

        const command = this.commands.get(item.name);

        if (!command?.undo)
            return;

        await command.undo(item.payload);

    }

    clearHistory() {

        this.history = [];

    }

    historySize() {

        return this.history.length;

    }

    getHistory() {

        return [...this.history];

    }

    list() {

        return [...this.commands.keys()].sort();

    }

    clear() {

        this.commands.clear();

        this.history = [];

    }

}

export default new AlbumCommandManager();