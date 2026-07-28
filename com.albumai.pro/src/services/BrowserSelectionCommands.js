import App from "../app/AppController";
import PhotoBrowserPerformance from "./PhotoBrowserPerformance";

let canonicalPhotos = [];

export function setCanonicalBrowserPhotos(photos = []) {

    canonicalPhotos = Array.isArray(photos)
        ? photos.filter(photo => photo?.id)
        : [];

}

export function selectAllBrowserPhotos() {

    const photos = canonicalPhotos.length
        ? canonicalPhotos
        : App.getPhotos();

    App.selection.setOrderedPhotos(photos);
    App.selection.selectAll();
    PhotoBrowserPerformance.trace("BROWSER_SELECT_ALL", {
        selected: photos.length
    });

}
