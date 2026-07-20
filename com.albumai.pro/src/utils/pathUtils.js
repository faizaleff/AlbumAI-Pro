export function normalize(path = "") {

    return path.replace(/\\/g, "/");

}

export function join(...parts) {

    return normalize(

        parts

            .filter(Boolean)

            .join("/")

            .replace(/\/+/g, "/")

    );

}

export function dirname(path = "") {

    const normalized = normalize(path);

    const index = normalized.lastIndexOf("/");

    if (index === -1) {

        return "";

    }

    return normalized.substring(0, index);

}

export function basename(path = "") {

    const normalized = normalize(path);

    const index = normalized.lastIndexOf("/");

    if (index === -1) {

        return normalized;

    }

    return normalized.substring(index + 1);

}

export function extension(path = "") {

    const name = basename(path);

    const index = name.lastIndexOf(".");

    if (index === -1) {

        return "";

    }

    return name.substring(index + 1).toLowerCase();

}

export function withoutExtension(path = "") {

    const name = basename(path);

    const index = name.lastIndexOf(".");

    if (index === -1) {

        return name;

    }

    return name.substring(0, index);

}