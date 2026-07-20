export const APP_NAME = "AlbumAI Pro";

export const APP_VERSION = "1.0.0";

export const DEFAULT_TEMPLATE_EXTENSION = ".psd";

export const SUPPORTED_IMAGE_TYPES = Object.freeze([

    ".jpg",

    ".jpeg",

    ".png",

    ".tif",

    ".tiff",

    ".psd",

    ".webp"

]);

export const SUPPORTED_TEMPLATE_TYPES = Object.freeze([

    ".psd"

]);

export const DEFAULT_EXPORT_FORMAT = "PSD";

export const DEFAULT_JPEG_QUALITY = 12;

export const MAX_RECENT_FILES = 20;

export const MAX_CONCURRENT_JOBS = 1;

export const DEFAULT_RETRY_COUNT = 3;

export const DEFAULT_RETRY_DELAY = 1000;

export const CACHE_LIMIT = 100;

export const MEMORY_LIMIT_MB = 2048;

export const LOG_LEVEL = "info";

export default {

    APP_NAME,

    APP_VERSION,

    DEFAULT_TEMPLATE_EXTENSION,

    SUPPORTED_IMAGE_TYPES,

    SUPPORTED_TEMPLATE_TYPES,

    DEFAULT_EXPORT_FORMAT,

    DEFAULT_JPEG_QUALITY,

    MAX_RECENT_FILES,

    MAX_CONCURRENT_JOBS,

    DEFAULT_RETRY_COUNT,

    DEFAULT_RETRY_DELAY,

    CACHE_LIMIT,

    MEMORY_LIMIT_MB,

    LOG_LEVEL

};