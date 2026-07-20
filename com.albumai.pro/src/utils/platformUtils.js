export function isMac() {

    return /mac/i.test(

        navigator.platform ||

        ""

    );

}

export function isWindows() {

    return /win/i.test(

        navigator.platform ||

        ""

    );

}

export function isLinux() {

    return /linux/i.test(

        navigator.platform ||

        ""

    );

}

export function getPlatform() {

    if (isMac()) {

        return "mac";

    }

    if (isWindows()) {

        return "windows";

    }

    if (isLinux()) {

        return "linux";

    }

    return "unknown";

}

export function getUserAgent() {

    return navigator.userAgent || "";

}

export function getLanguage() {

    return navigator.language || "en";

}

export function supportsTouch() {

    return (

        "ontouchstart" in window ||

        navigator.maxTouchPoints > 0

    );

}

export function isOnline() {

    return navigator.onLine;

}