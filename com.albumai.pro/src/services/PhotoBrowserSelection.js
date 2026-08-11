import App from "../app/AppController";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

let canonicalPhotos = [];
let canonicalPhotosConfigured = false;

export function setCanonicalBrowserPhotos(photos = []) {
    canonicalPhotosConfigured = true;
    canonicalPhotos = Array.isArray(photos)
        ? photos.filter(photo => photo?.id)
        : [];
}

export function resolveCanonicalBrowserPhotos(fallbackPhotos = []) {
    if (canonicalPhotosConfigured) return canonicalPhotos;
    return Array.isArray(fallbackPhotos) ? fallbackPhotos : [];
}

export function selectAllBrowserPhotos() {
    const photos = resolveCanonicalBrowserPhotos(App.getPhotos());

    App.selection.setOrderedPhotos(photos);
    App.selection.selectAll();
    PhotoBrowserPerformance.trace("BROWSER_SELECT_ALL", {
        selected: photos.length
    });
}
