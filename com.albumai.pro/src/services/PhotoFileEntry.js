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

    return photo?.file || null;

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
