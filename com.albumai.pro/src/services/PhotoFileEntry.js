import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

const SCHEMA_PROPERTIES = [
    "id",
    "name",
    "extension",
    "entry",
    "fileEntry",
    "file",
    "sourceEntry"
];

let schemaLogged = false;

function isEntryCandidate(candidate) {

    if (!candidate || (
        typeof candidate !== "object" &&
        typeof candidate !== "function"
    )) return false;

    const hasFileSignal = candidate.isFile === true ||
        (typeof candidate.nativePath === "string" &&
            candidate.nativePath.length > 0) ||
        candidate.provider != null ||
        typeof candidate.read === "function";

    return hasFileSignal && typeof candidate.name === "string";

}

function boundedErrorMessage(error, candidate, fallback) {

    let message = String(error?.message || fallback || "URL resolution failed.");
    const nativePath = typeof candidate?.nativePath === "string"
        ? candidate.nativePath
        : "";
    if (nativePath) message = message.split(nativePath).join("<path>");
    return message.slice(0, 200);

}

export function getCanonicalPhotoEntry(photoOrEntry) {

    const candidates = [
        ["file", photoOrEntry?.file],
        ["entry", photoOrEntry?.entry],
        ["fileEntry", photoOrEntry?.fileEntry],
        ["sourceEntry", photoOrEntry?.sourceEntry],
        ["direct", photoOrEntry]
    ];

    for (const [propertyName, candidate] of candidates) {
        if (isEntryCandidate(candidate)) {
            return { candidate, propertyName };
        }
    }

    return { candidate: null, propertyName: null };

}

export function resolvePhotoEntryUrl(photoOrEntry) {

    const { candidate, propertyName } =
        getCanonicalPhotoEntry(photoOrEntry);
    const flags = {
        propertyName,
        isFile: candidate?.isFile === true,
        nativePathType: typeof candidate?.nativePath,
        hasProvider: candidate?.provider != null,
        readType: typeof candidate?.read,
        nameType: typeof candidate?.name,
        urlType: typeof candidate?.url
    };

    if (!candidate) {
        return {
            source: null,
            flags,
            error: {
                name: "TypeError",
                message: "No accessible UXP File candidate was found."
            }
        };
    }

    let resolvedUrl = null;
    let resolutionError = null;
    try {
        const lfs = require("uxp").storage.localFileSystem;
        resolvedUrl = lfs.getFsUrl(candidate);
    } catch (error) {
        resolutionError = error;
    }
    const getFsUrlReturnType = typeof resolvedUrl;

    if (
        typeof resolvedUrl !== "string" ||
        resolvedUrl.trim().length === 0
    ) {
        if (
            typeof candidate.url === "string" &&
            candidate.url.trim().length > 0
        ) {
            resolvedUrl = candidate.url;
        }
    }

    const source = typeof resolvedUrl === "string"
        ? resolvedUrl.trim()
        : "";
    const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(source);
    const scheme = schemeMatch ? schemeMatch[1].toLowerCase() : null;
    const allowed = new Set([
        "file",
        "plugin",
        "plugin-data",
        "plugin-temp"
    ]);
    const success = source.length > 0 && allowed.has(scheme);

    return {
        source: success ? source : null,
        flags: {
            ...flags,
            getFsUrlReturnType,
            finalUrlScheme: scheme,
            success
        },
        error: success ? null : {
            name: resolutionError?.name || "TypeError",
            message: boundedErrorMessage(
                resolutionError,
                candidate,
                "Resolved Entry URL was empty or used an unsupported scheme."
            )
        }
    };

}

function candidateDetails(candidate, prefix) {

    return {
        [`${prefix}Constructor`]: candidate?.constructor?.name || null,
        [`${prefix}UrlType`]: typeof candidate?.url,
        [`${prefix}UrlLength`]:
            typeof candidate?.url === "string" ? candidate.url.length : 0
    };

}

/** Return the live UXP FileEntry retained by the Photo model. */
export function getPhotoFileEntry(photo) {

    return getCanonicalPhotoEntry(photo).candidate;

}

/** Log the published Photo schema once without exposing paths or URLs. */
export function logPhotoRuntimeSchemaOnce(photo) {

    if (schemaLogged || !photo) return;
    schemaLogged = true;

    const entry = photo.entry;
    const fileEntry = photo.fileEntry;
    const file = photo.file;
    const sourceEntry = photo.sourceEntry;
    const authoritative = getPhotoFileEntry(photo);

    PhotoBrowserPerformance.trace("PHOTO_RUNTIME_SCHEMA", {
        photoConstructor: photo?.constructor?.name || null,
        propertyNames: Object.keys(photo).filter(name =>
            SCHEMA_PROPERTIES.includes(name)
        ),
        hasEntry: !!entry,
        hasFileEntry: !!fileEntry,
        hasFile: !!file,
        hasSourceEntry: !!sourceEntry,
        ...candidateDetails(entry, "entry"),
        ...candidateDetails(fileEntry, "fileEntry"),
        ...candidateDetails(file, "file"),
        ...candidateDetails(sourceEntry, "sourceEntry"),
        nativePathType: typeof authoritative?.nativePath,
        isFile: authoritative?.isFile ?? null
    });

}
