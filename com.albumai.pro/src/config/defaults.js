import defaultConfig from "./defaultConfig";
import FEATURES from "./features";
import UI from "./ui";
import THEME, { DEFAULT_THEME } from "./theme";
import STORAGE_KEYS from "./storage";
import CONFIG_SCHEMA from "./schema";

const DEFAULTS = Object.freeze({

    config: defaultConfig,

    features: FEATURES,

    ui: UI,

    theme: THEME[DEFAULT_THEME.toUpperCase()],

    storage: STORAGE_KEYS,

    schema: CONFIG_SCHEMA

});

export function getDefaults() {

    return DEFAULTS;

}

export function getDefaultConfig() {

    return DEFAULTS.config;

}

export function getDefaultTheme() {

    return DEFAULTS.theme;

}

export function getDefaultFeatures() {

    return DEFAULTS.features;

}

export function getDefaultUI() {

    return DEFAULTS.ui;

}

export function getDefaultStorage() {

    return DEFAULTS.storage;

}

export function getDefaultSchema() {

    return DEFAULTS.schema;

}

export default DEFAULTS;