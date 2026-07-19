// src/core/photo/PhotoTypes.js

/**
 * Shared enums and constants for the Photo Engine.
 * Avoid using magic strings throughout the application.
 */

export const PhotoOrientation = Object.freeze({

    PORTRAIT: "portrait",

    LANDSCAPE: "landscape",

    SQUARE: "square",

    PANORAMA: "panorama",

    UNKNOWN: "unknown"

});

export const PhotoFormat = Object.freeze({

    JPEG: "jpeg",

    JPG: "jpg",

    PNG: "png",

    TIFF: "tiff",

    TIF: "tif",

    PSD: "psd",

    PSB: "psb",

    HEIC: "heic",

    WEBP: "webp",

    UNKNOWN: "unknown"

});

export const PhotoRating = Object.freeze({

    REJECTED: 0,

    ONE: 1,

    TWO: 2,

    THREE: 3,

    FOUR: 4,

    FIVE: 5

});

export const PhotoQuality = Object.freeze({

    LOW: "low",

    MEDIUM: "medium",

    HIGH: "high",

    EXCELLENT: "excellent"

});

export const PhotoStatus = Object.freeze({

    NEW: "new",

    SCANNED: "scanned",

    ANALYZED: "analyzed",

    MATCHED: "matched",

    USED: "used",

    SKIPPED: "skipped"

});

export const PlaceholderType = Object.freeze({

    COVER: "cover",

    FULL_PAGE: "full_page",

    HALF_PAGE: "half_page",

    SQUARE: "square",

    STRIP: "strip",

    COLLAGE: "collage"

});

export const SortOrder = Object.freeze({

    ASC: "asc",

    DESC: "desc"

});

export const SortField = Object.freeze({

    NAME: "name",

    DATE: "date",

    SIZE: "size",

    WIDTH: "width",

    HEIGHT: "height",

    RESOLUTION: "resolution",

    QUALITY: "quality",

    RATING: "rating"

});

export const SupportedExtensions = Object.freeze([

    ".jpg",

    ".jpeg",

    ".png",

    ".tif",

    ".tiff",

    ".psd",

    ".psb",

    ".heic",

    ".webp"

]);

export default {

    PhotoOrientation,

    PhotoFormat,

    PhotoRating,

    PhotoQuality,

    PhotoStatus,

    PlaceholderType,

    SortOrder,

    SortField,

    SupportedExtensions

};