import {
    APP_NAME,
    APP_VERSION
} from "./constants";

import {
    VERSION,
    fullVersion
} from "./version";

const BUILD = Object.freeze({

    application: APP_NAME,

    version: APP_VERSION,

    fullVersion: fullVersion(),

    build: VERSION.BUILD,

    channel: VERSION.CHANNEL,

    copyright: "© AlbumAI Pro",

    author: "AlbumAI Pro",

    license: "Commercial",

    releaseDate: "2026-07-19",

    minimumPhotoshopVersion: "27.0.0",

    manifestVersion: 5,

    platform: [

        "macOS",

        "Windows"

    ]

});

export function info() {

    return {

        ...BUILD

    };

}

export function buildNumber() {

    return BUILD.build;

}

export function channel() {

    return BUILD.channel;

}

export function releaseDate() {

    return BUILD.releaseDate;

}

export default BUILD;