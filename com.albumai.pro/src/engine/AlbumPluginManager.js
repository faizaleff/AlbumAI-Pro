class AlbumPluginManager {

    constructor() {

        this.plugins = new Map();

    }

    register(plugin) {

        if (!plugin?.id)
            throw new Error("Plugin id is required.");

        this.plugins.set(plugin.id, {

            enabled: true,

            ...plugin

        });

        return plugin;

    }

    unregister(id) {

        this.plugins.delete(id);

    }

    get(id) {

        return this.plugins.get(id) || null;

    }

    getAll() {

        return [...this.plugins.values()];

    }

    enable(id) {

        const plugin = this.get(id);

        if (plugin)
            plugin.enabled = true;

        return plugin;

    }

    disable(id) {

        const plugin = this.get(id);

        if (plugin)
            plugin.enabled = false;

        return plugin;

    }

    isEnabled(id) {

        return !!this.get(id)?.enabled;

    }

    async execute(hook, context = {}) {

        for (const plugin of this.plugins.values()) {

            if (!plugin.enabled)
                continue;

            const fn = plugin[hook];

            if (typeof fn !== "function")
                continue;

            await fn(context);

        }

    }

    clear() {

        this.plugins.clear();

    }

    count() {

        return this.plugins.size;

    }

    ids() {

        return [...this.plugins.keys()];

    }

}

export default new AlbumPluginManager();