import AlbumEventBus from "../album/AlbumEventBus";
import PanelStateManager from "./PanelStateManager";

export default class UIRouter {

    constructor({

        eventBus = new AlbumEventBus(),

        panelState = new PanelStateManager()

    } = {}) {

        this.eventBus = eventBus;

        this.panelState = panelState;

        this.routes = new Map();

        this.history = [];

        this.future = [];

        this.current = null;

    }

    register(route, options = {}) {

        this.routes.set(route, {

            protected: false,

            handler: null,

            ...options

        });

    }

    unregister(route) {

        this.routes.delete(route);

    }

    has(route) {

        return this.routes.has(route);

    }

    async navigate(route, params = {}) {

        if (!this.routes.has(route)) {

            throw new Error(

                `Unknown route: ${route}`

            );

        }

        const config = this.routes.get(route);

        if (

            config.protected &&

            typeof config.guard === "function"

        ) {

            const allowed =

                await config.guard(params);

            if (!allowed) {

                this.eventBus.emit(

                    "router:blocked",

                    {

                        route,

                        params

                    }

                );

                return false;

            }

        }

        if (this.current) {

            this.history.push(

                this.current

            );

        }

        this.future = [];

        this.current = {

            route,

            params,

            timestamp: Date.now()

        };

        this.panelState.setActivePanel(

            route

        );

        if (

            typeof config.handler ===

            "function"

        ) {

            await config.handler(params);

        }

        this.eventBus.emit(

            "router:navigated",

            this.current

        );

        return true;

    }

    async back() {

        if (

            this.history.length === 0

        ) {

            return false;

        }

        if (this.current) {

            this.future.push(

                this.current

            );

        }

        const previous =

            this.history.pop();

        return this.restore(previous);

    }

    async forward() {

        if (

            this.future.length === 0

        ) {

            return false;

        }

        if (this.current) {

            this.history.push(

                this.current

            );

        }

        const next =

            this.future.pop();

        return this.restore(next);

    }

    async restore(state) {

        if (!state) {

            return false;

        }

        this.current = state;

        this.panelState.setActivePanel(

            state.route

        );

        const config =

            this.routes.get(

                state.route

            );

        if (

            config &&

            typeof config.handler ===

            "function"

        ) {

            await config.handler(

                state.params

            );

        }

        this.eventBus.emit(

            "router:restored",

            state

        );

        return true;

    }

    getCurrentRoute() {

        return this.current;

    }

    getHistory() {

        return [

            ...this.history

        ];

    }

    clearHistory() {

        this.history = [];

        this.future = [];

    }

    listRoutes() {

        return Array.from(

            this.routes.keys()

        );

    }

}