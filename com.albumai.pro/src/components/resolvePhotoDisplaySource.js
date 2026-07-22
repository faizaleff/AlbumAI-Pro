/**
 * Returns a browser-safe image URL from the display data already attached to
 * an AlbumAI photo. FileEntry objects and native paths are deliberately not
 * used as image sources.
 */
export default function resolvePhotoDisplaySource(photo) {

    if (!photo) {
        return null;
    }

    const candidates = [
        photo.thumbnail,
        photo.thumbnailUrl,
        photo.previewUrl,
        photo.objectUrl,
        photo.url,
        photo.src,
        photo.dataUrl,
        photo.preview
    ];

    return candidates.find(value =>
        typeof value === "string" &&
        value.trim().length > 0 &&
        !value.startsWith("/")
    ) || null;
}
