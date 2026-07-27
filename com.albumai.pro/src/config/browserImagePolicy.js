/*
 * Photoshop UXP cannot create a thumbnail directly from a FileEntry with the
 * Imaging API. Rendering the original file in every virtualized browser card
 * decodes full-resolution images in the host and does not provide a reliable
 * release boundary, so production browser cards are cache-only.
 *
 * Keep the unsafe fallback available only for an explicit diagnostic session.
 * It must never be enabled in a production build or persisted as a user
 * preference.
 */
export function isBrowserOriginalFallbackEnabled() {

    try {
        return globalThis
            .__ALBUMAI_DIAGNOSTIC_BROWSER_ORIGINAL_FALLBACK__ === true;
    } catch (_) {
        return false;
    }

}

export const BROWSER_THUMBNAIL_MODE = "bounded-cache-only";
