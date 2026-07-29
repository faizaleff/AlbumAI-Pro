/*
 * Browser cards and Preview receive only reduced Blob URLs. The producer
 * prefers an embedded EXIF JPEG and falls back to one guarded, single-
 * concurrency software decode of the source JPEG when no embedded preview is
 * available. Direct Entry URLs, native paths, session tokens, full-resolution
 * display sources, and Photoshop document rendering are not part of the
 * normal browser image path.
 */
export const BROWSER_THUMBNAIL_MODE = "reduced-software-jpeg";
