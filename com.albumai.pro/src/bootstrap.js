import plugin from "./index";

let initialized = false;

export async function start() {

    if (initialized) {
        return;
    }

    await plugin.initialize();

    initialized = true;

}

export async function stop() {

    if (!initialized) {
        return;
    }

    await plugin.shutdown();

    initialized = false;

}

export async function restart() {

    await stop();

    await start();

}

export function isRunning() {

    return initialized;

}

export default {

    start,

    stop,

    restart,

    isRunning

};