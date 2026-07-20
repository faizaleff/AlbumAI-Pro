const environment = {

    mode: "production",

    version: "1.0.0",

    debug: false,

    verbose: false

};

export function get(key) {

    return environment[key];

}

export function set(key, value) {

    environment[key] = value;

}

export function has(key) {

    return Object.prototype.hasOwnProperty.call(

        environment,

        key

    );

}

export function all() {

    return {

        ...environment

    };

}

export function isDevelopment() {

    return environment.mode === "development";

}

export function isProduction() {

    return environment.mode === "production";

}

export function enableDebug() {

    environment.debug = true;

}

export function disableDebug() {

    environment.debug = false;

}

export function isDebug() {

    return environment.debug;

}

export default {

    get,

    set,

    has,

    all,

    isDevelopment,

    isProduction,

    enableDebug,

    disableDebug,

    isDebug

};