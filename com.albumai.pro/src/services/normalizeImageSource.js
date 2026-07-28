/** Normalize browser/Preview sources without exposing native paths. */
export default function normalizeImageSource({
    cachedSource,
    fileEntry
} = {}) {

    if (typeof cachedSource === "string") {
        const source = cachedSource.trim();
        if (source.length > 0) {
            return { source, sourceOrigin: "CACHE" };
        }
    }

    if (fileEntry?.isFile === true) {
        return {
            source: fileEntry,
            sourceOrigin: "FILE_ENTRY"
        };
    }

    const entryUrl = fileEntry?.url;
    if (typeof entryUrl === "string") {
        const source = entryUrl.trim();
        if (source.length > 0) {
            return { source, sourceOrigin: "FILE_ENTRY_URL" };
        }
    }

    return { source: null, sourceOrigin: "NONE" };

}
