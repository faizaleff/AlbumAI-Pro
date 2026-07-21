import AlbumEventBus from "../album/AlbumEventBus";
import Logger from "../photoshop/Logger";

export default class ShortcutManager {

    constructor({

        eventBus = new AlbumEventBus()

    } = {}) {

        this.eventBus = eventBus;

        this.shortcuts = new Map();

        this.groups = new Map();

        this.enabledGroups = new Set(["global"]);

    }

    register({

        id,

        keys,

        handler,

        group = "global",

        description = ""

    }) {

        if (!id || !keys || typeof handler !== "function") {

            throw new Error("Invalid shortcut registration.");

        }

        if (this.shortcuts.has(id)) {

            Logger.warn(`Shortcut "${id}" already exists.`);

        }

        this.shortcuts.set(id, {

            id,

            keys: this.normalize(keys),

            handler,

            group,

            description

        });

        if (!this.groups.has(group)) {

            this.groups.set(group, new Set());

        }

        this.groups.get(group).add(id);

    }

    unregister(id) {

        const shortcut = this.shortcuts.get(id);

        if (!shortcut) {

            return;

        }

        this.shortcuts.delete(id);

        const group = this.groups.get(shortcut.group);

        if (group) {

            group.delete(id);

        }

    }

    async execute(keys) {

        const normalized = this.normalize(keys);

        for (const shortcut of this.shortcuts.values()) {

            if (

                shortcut.keys === normalized &&

                this.enabledGroups.has(shortcut.group)

            ) {

                this.eventBus.emit(

                    "shortcut:executed",

                    shortcut

                );

                return await shortcut.handler();

            }

        }

        return false;

    }

    enableGroup(group) {

        this.enabledGroups.add(group);

    }

    disableGroup(group) {

        this.enabledGroups.delete(group);

    }

    isGroupEnabled(group) {

        return this.enabledGroups.has(group);

    }

    registerDefaults(services = {}) {

        this.register({

            id: "save",

            keys: "Ctrl+S",

            handler: () =>

                services.projectManager?.save?.(),

            description: "Save Project"

        });

        this.register({

            id: "undo",

            keys: "Ctrl+Z",

            handler: () =>

                services.historyManager?.undo?.(),

            description: "Undo"

        });

        this.register({

            id: "redo",

            keys: "Ctrl+Shift+Z",

            handler: () =>

                services.historyManager?.redo?.(),

            description: "Redo"

        });

        this.register({

            id: "generate",

            keys: "Ctrl+G",

            handler: () =>

                services.albumEngine?.generate?.(),

            description: "Generate Album"

        });

        this.register({

            id: "export",

            keys: "Ctrl+E",

            handler: () =>

                services.exportManager?.export?.(),

            description: "Export Album"

        });

    }

    list() {

        return Array.from(

            this.shortcuts.values()

        );

    }

    detectConflict(keys) {

        const normalized = this.normalize(keys);

        return this.list().filter(

            shortcut =>

                shortcut.keys === normalized

        );

    }

    normalize(keys) {

        if (Array.isArray(keys)) {

            keys = keys.join("+");

        }

        return keys

            .split("+")

            .map(

                key =>

                    key.trim().toUpperCase()

            )

            .sort()

            .join("+");

    }

    clear() {

        this.shortcuts.clear();

        this.groups.clear();

        this.enabledGroups.clear();

        this.enabledGroups.add("global");

    }

}