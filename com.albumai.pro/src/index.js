import PluginBootstrap from "./core/PluginBootstrap";
import DependencyContainer from "./core/DependencyContainer";
import Application from "./core/Application";
import Kernel from "./core/Kernel";
import AlbumFacade from "./services/AlbumFacade";

let container = null;
let application = null;
let kernel = null;
let album = null;

export async function initialize() {

    if (kernel) {
        return kernel;
    }

    container = new DependencyContainer();

    await container.initialize();

    application = new Application({
        container
    });

    kernel = new Kernel({
        application,
        container
    });

    await kernel.boot();

    album = container.resolve
        ? container.resolve("AlbumFacade")
        : new AlbumFacade({});

    return kernel;

}

export async function shutdown() {

    if (!kernel) {
        return;
    }

    await kernel.shutdown();

    kernel = null;
    application = null;
    container = null;
    album = null;

}

export function getAlbum() {
    return album;
}

export default {
    initialize,
    shutdown,
    getAlbum
};