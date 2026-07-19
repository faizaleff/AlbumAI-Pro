// src/core/photoshop/Constants.js

export const PHOTOSHOP = Object.freeze({
    HISTORY_NAME: "AlbumAI Operation",

    DOCUMENTS: {
        RGB: "RGBColor",
        CMYK: "CMYKColor",
        GRAYSCALE: "Grayscale"
    },

    LAYERS: {
        SMART_OBJECT: "smartObject",
        PIXEL: "pixel",
        GROUP: "layerSection",
        TEXT: "textLayer"
    },

    EXPORT: {
        JPEG_QUALITY: 12,
        PNG_COMPRESSION: 6,
        PDF_PRESET: "High Quality Print"
    },

    PERFORMANCE: {
        BATCH_SIZE: 25,
        MAX_RETRY: 3,
        MODAL_TIMEOUT: 30000
    },

    EVENTS: {
        START: "photoshop:start",
        FINISH: "photoshop:finish",
        ERROR: "photoshop:error"
    }
});

export default PHOTOSHOP;