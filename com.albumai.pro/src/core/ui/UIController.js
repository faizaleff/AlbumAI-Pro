import AlbumEventBus from "../album/AlbumEventBus";

import UIStateStore from "./UIStateStore";
import UIRouter from "./UIRouter";
import PanelStateManager from "./PanelStateManager";
import DialogManager from "./DialogManager";
import NotificationManager from "./NotificationManager";
import ShortcutManager from "./ShortcutManager";
import DragDropManager from "./DragDropManager";
import UICommandManager from "./UICommandManager";
import StateSynchronizer from "./StateSynchronizer";

export default class UIController {

    constructor({

        services = {}

    } = {}) {

        this.eventBus = new AlbumEventBus();

        this.stateStore = new UIStateStore({

            eventBus: this.eventBus

        });

        this.panelState = new PanelStateManager({

            eventBus: this.eventBus

        });

        this.router = new UIRouter({

            eventBus: this.eventBus,

            panelState: this.panelState

        });

        this.dialogs = new DialogManager({

            eventBus: this.eventBus

        });

        this.notifications =

            new NotificationManager({

                eventBus: this.eventBus

            });

        this.shortcuts =

            new ShortcutManager({

                eventBus: this.eventBus

            });

        this.dragDrop =

            new DragDropManager({

                eventBus: this.eventBus

            });

        this.commands =

            new UICommandManager({

                eventBus: this.eventBus,

                services

            });

        this.synchronizer =

            new StateSynchronizer({

                eventBus: this.eventBus,

                stateManager: this.panelState

            });

        this.services = services;

    }

    initialize() {

        this.registerRoutes();

        this.registerCommands();

        this.registerShortcuts();

        this.registerSynchronization();

        this.eventBus.emit(

            "ui:initialized"

        );

    }

    registerRoutes() {

        this.router.register(

            "dashboard"

        );

        this.router.register(

            "projects"

        );

        this.router.register(

            "templates"

        );

        this.router.register(

            "photos"

        );

        this.router.register(

            "albums"

        );

        this.router.register(

            "export"

        );

        this.router.register(

            "settings"

        );

    }

    registerCommands() {

        this.commands.registerDefaults();

    }

    registerShortcuts() {

        this.shortcuts.registerDefaults(

            this.services

        );

    }

    registerSynchronization() {

        this.synchronizer.registerSource(

            "panel",

            this.panelState

        );

        this.synchronizer.registerSource(

            "store",

            this.stateStore

        );

    }

    navigate(route, params = {}) {

        return this.router.navigate(

            route,

            params

        );

    }

    notify(message, type = "info") {

        return this.notifications[type](

            message

        );

    }

    execute(command, payload = {}) {

        return this.commands.execute(

            command,

            payload

        );

    }

    dispatch(action) {

        return this.stateStore.dispatch(

            action

        );

    }

    getState() {

        return {

            ui:

                this.panelState.getState(),

            store:

                this.stateStore.getState()

        };

    }

    reset() {

        this.stateStore.reset();

        this.panelState.reset();

        this.notifications.clear();

        this.dialogs.closeAll();

        this.dragDrop.clear();

    }

    destroy() {

        this.reset();

        this.shortcuts.clear();

        this.synchronizer.destroy();

        this.eventBus.emit(

            "ui:destroyed"

        );

    }

}