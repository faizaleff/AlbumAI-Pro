import ApplicationBootstrap from "./core/bootstrap/ApplicationBootstrap";
import DependencyContainer from "./core/bootstrap/DependencyContainer";
import ServiceRegistry from "./core/bootstrap/ServiceRegistry";
import PluginLifecycleManager from "./core/bootstrap/PluginLifecycleManager";

const container = new DependencyContainer();

const registry = new ServiceRegistry(container);

registry.registerAll();

const bootstrap = new ApplicationBootstrap();

const lifecycle = new PluginLifecycleManager({

    bootstrap

});

async function start() {

    try {

        await lifecycle.startup();

        if (

            typeof window !==

            "undefined"

        ) {

            window.AlbumAI = {

                container,

                registry,

                bootstrap,

                lifecycle,

                services:

                    bootstrap.getServices()

            };

        }

        console.log(

            "AlbumAI Pro Started"

        );

    }

    catch (error) {

        console.error(

            "AlbumAI Pro Startup Failed",

            error

        );

    }

}

async function stop() {

    try {

        await lifecycle.shutdown();

        console.log(

            "AlbumAI Pro Stopped"

        );

    }

    catch (error) {

        console.error(

            "AlbumAI Pro Shutdown Failed",

            error

        );

    }

}

if (

    typeof window !==

    "undefined"

) {

    window.addEventListener(

        "load",

        start

    );

    window.addEventListener(

        "beforeunload",

        stop

    );

}

export {

    container,

    registry,

    bootstrap,

    lifecycle,

    start,

    stop

};

export default lifecycle;