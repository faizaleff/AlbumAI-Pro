export const VERSION = Object.freeze({

    MAJOR: 1,

    MINOR: 0,

    PATCH: 0,

    BUILD: 1,

    CHANNEL: "stable"

});

export function version() {

    return `${VERSION.MAJOR}.${VERSION.MINOR}.${VERSION.PATCH}`;

}

export function build() {

    return VERSION.BUILD;

}

export function channel() {

    return VERSION.CHANNEL;

}

export function fullVersion() {

    return `${version()}+${build()}-${channel()}`;

}

export function isStable() {

    return VERSION.CHANNEL === "stable";

}

export function isBeta() {

    return VERSION.CHANNEL === "beta";

}

export function isAlpha() {

    return VERSION.CHANNEL === "alpha";

}

export default {

    VERSION,

    version,

    build,

    channel,

    fullVersion,

    isStable,

    isBeta,

    isAlpha

};