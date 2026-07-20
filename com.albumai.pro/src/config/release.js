import BUILD from "./build";
import {
    VERSION,
    fullVersion
} from "./version";

const RELEASE = Object.freeze({

    name: "AlbumAI Pro",

    codename: "Genesis",

    version: fullVersion(),

    major: VERSION.MAJOR,

    minor: VERSION.MINOR,

    patch: VERSION.PATCH,

    build: VERSION.BUILD,

    channel: VERSION.CHANNEL,

    releaseDate: BUILD.releaseDate,

    status: "Production",

    compatiblePhotoshop: {

        minimum: BUILD.minimumPhotoshopVersion,

        recommended: "27.4.0"

    },

    compatibility: {

        macOS: true,

        Windows: true

    }

});

export function getRelease() {

    return RELEASE;

}

export function getVersion() {

    return RELEASE.version;

}

export function getChannel() {

    return RELEASE.channel;

}

export function getStatus() {

    return RELEASE.status;

}

export function isProduction() {

    return RELEASE.status === "Production";

}

export default RELEASE;