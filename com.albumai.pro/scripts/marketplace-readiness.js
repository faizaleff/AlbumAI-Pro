#!/usr/bin/env node

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MARKETPLACE_ICON_SIZES = Object.freeze([48, 96, 192]);
const SCREENSHOT_WIDTH = 1360;
const SCREENSHOT_HEIGHT = 800;
const MAX_ICON_BYTES = 1024 * 1024;
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
const DISALLOWED_PLACEHOLDER_ICON_SHA256 = Object.freeze(new Set([
    "e834266ac648a7f34b6b4feb774686573da13c846749dd6d9907b2fa64ab552f",
    "ffd28526cc9fa3769414fb1c949cb012ee8bb66e2700b5f2b3d149eda0baea4a",
    "79a7cae0574ffabe4c8316d0928356eca8521c4b121bb422c47627657c3fc00f",
    "19ead83276724ea967a9df37f681f81d2af33925ef78a8fce73e7a07e43f9a7d"
]));

function sha256(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function isHttpsUrl(value) {
    try {
        return new URL(value).protocol === "https:";
    } catch (_) {
        return false;
    }
}

function isThreePartVersion(value) {
    return /^\d+\.\d+\.\d+$/.test(String(value || ""));
}

function readPngEvidence(filePath) {
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) return null;
    const buffer = fs.readFileSync(filePath);
    if (buffer.length < 24 || buffer.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
        return { bytes: buffer.length, width: null, height: null, sha256: sha256(buffer) };
    }
    return {
        bytes: buffer.length,
        width: buffer.readUInt32BE(16),
        height: buffer.readUInt32BE(20),
        sha256: sha256(buffer)
    };
}

function uniqueManifestIconPaths(manifest) {
    const paths = [];
    const collect = icons => (Array.isArray(icons) ? icons : []).forEach(icon => {
        if (typeof icon?.path === "string" && !paths.includes(icon.path)) paths.push(icon.path);
    });
    collect(manifest?.icons);
    (Array.isArray(manifest?.entrypoints) ? manifest.entrypoints : []).forEach(entrypoint => {
        collect(entrypoint?.icons);
    });
    return paths;
}

function mediaEvidence(projectRoot, paths) {
    return (Array.isArray(paths) ? paths : []).map(relativePath => ({
        path: relativePath,
        evidence: typeof relativePath === "string"
            ? readPngEvidence(path.join(projectRoot, relativePath))
            : null
    }));
}

function evaluateMarketplaceReadiness(input) {
    const blockers = [];
    const add = code => {
        if (!blockers.includes(code)) blockers.push(code);
    };
    const config = input.config || {};
    const listing = config.listing || {};
    const publisher = config.publisherProfile || {};
    const qualification = config.qualification || {};
    const sourceManifest = input.sourceManifest || {};
    const packageVersion = input.packageJson?.version;

    if (config.schemaVersion !== 1 || config.submissionTarget !== "ADOBE_CREATIVE_CLOUD_MARKETPLACE") {
        add("READINESS_SCHEMA_INVALID");
    }
    if (!isThreePartVersion(config.targetVersion)) add("TARGET_VERSION_INVALID");
    if (packageVersion !== input.packageLock?.version ||
        packageVersion !== input.packageLock?.packages?.[""]?.version ||
        packageVersion !== sourceManifest.version ||
        packageVersion !== input.builtManifest?.version) {
        add("PACKAGE_VERSION_MISMATCH");
    }
    if (packageVersion !== config.targetVersion) add("TARGET_VERSION_NOT_APPLIED");
    if (config.currentRelease !== "1.2.0") add("CURRENT_RELEASE_BOUNDARY_INVALID");
    if (sourceManifest.id !== "com.albumai.pro" || sourceManifest.host?.app !== "PS" ||
        Array.isArray(sourceManifest.host)) {
        add("MANIFEST_MARKETPLACE_IDENTITY_INVALID");
    }
    if (Number.parseFloat(sourceManifest.host?.minVersion) < 22) add("PHOTOSHOP_MIN_VERSION_INVALID");
    if (sourceManifest.requiredPermissions?.network !== undefined ||
        sourceManifest.requiredPermissions?.launchProcess !== undefined) {
        add("NETWORK_OR_PROCESS_PERMISSION_PRESENT");
    }
    if (!config.adobePluginIdConfirmed) add("ADOBE_PLUGIN_ID_NOT_CONFIRMED");
    if (!publisher.approved) add("PUBLISHER_PROFILE_NOT_APPROVED");
    if (!["EU_TRADER", "NON_EU_DISTRIBUTION"].includes(publisher.euTraderDecision)) {
        add("EU_TRADER_DECISION_MISSING");
    }

    if (listing.publicName !== sourceManifest.name) add("PUBLIC_NAME_MISMATCH");
    if (!String(listing.subtitle || "").trim()) add("LISTING_SUBTITLE_MISSING");
    if (!/^\S+@\S+\.\S+$/.test(String(listing.supportEmail || ""))) add("SUPPORT_EMAIL_MISSING");
    if (!isHttpsUrl(listing.helpUrl)) add("HELP_URL_MISSING");
    if (!String(listing.description || "").trim()) add("LISTING_DESCRIPTION_MISSING");
    if (!Array.isArray(listing.languages) || !listing.languages.includes("en")) add("ENGLISH_LISTING_MISSING");
    if (!Array.isArray(listing.categories) || listing.categories.length === 0) add("CATEGORIES_MISSING");
    if (!Array.isArray(listing.customTags) || listing.customTags.length === 0) add("CUSTOM_TAGS_MISSING");
    if (!isHttpsUrl(listing.privacyPolicyUrl)) add("PRIVACY_POLICY_URL_MISSING");
    if (!isHttpsUrl(listing.termsOfServiceUrl)) add("TERMS_OF_SERVICE_URL_MISSING");
    if (!["FREE", "PAID"].includes(listing.commerce)) add("COMMERCE_DECISION_MISSING");
    if (!String(listing.releaseNotes || "").trim()) add("RELEASE_NOTES_MISSING");

    if (!config.packageIconReview?.operatorApproved) add("PLUGIN_ICON_DIRECTION_NOT_APPROVED");
    if (!config.packageIconReview?.ownershipConfirmed) add("PLUGIN_ICON_OWNERSHIP_UNCONFIRMED");
    if (config.packageIconReview?.adobeAssetUse !== "NONE") add("PLUGIN_ICON_ADOBE_ASSET_REVIEW_INCOMPLETE");
    if (input.pluginIcons.length === 0 || input.pluginIcons.some(item => (
        !item.evidence || DISALLOWED_PLACEHOLDER_ICON_SHA256.has(item.evidence.sha256)
    ))) {
        add("PLUGIN_ICON_PLACEHOLDER_OR_MISSING");
    }

    const marketplaceIconSizes = new Set(input.marketplaceIcons
        .filter(item => item.evidence && item.evidence.bytes > 0 &&
            item.evidence.bytes < MAX_ICON_BYTES && item.evidence.width === item.evidence.height)
        .map(item => item.evidence.width));
    if (MARKETPLACE_ICON_SIZES.some(size => !marketplaceIconSizes.has(size))) {
        add("MARKETPLACE_ICONS_INVALID");
    }
    const validScreenshots = input.screenshots.filter(item => item.evidence &&
        item.evidence.bytes > 0 && item.evidence.bytes < MAX_SCREENSHOT_BYTES &&
        item.evidence.width === SCREENSHOT_WIDTH && item.evidence.height === SCREENSHOT_HEIGHT);
    if (validScreenshots.length < 1 || validScreenshots.length > 5 ||
        validScreenshots.length !== input.screenshots.length) {
        add("SCREENSHOTS_INVALID");
    }

    if (String(config.ccxFileName || "").length > 45 ||
        !String(config.ccxFileName || "").endsWith(".ccx") ||
        /\d+\.\d+\.\d+/.test(String(config.ccxFileName || ""))) {
        add("CCX_FILENAME_INVALID");
    }
    if (!qualification.targetCcxQualified) add("TARGET_CCX_NOT_QUALIFIED");
    if (!qualification.marketplaceRuntimeSmokePassed) add("MARKETPLACE_RUNTIME_SMOKE_MISSING");
    if (qualification.publicationMode !== "MANUAL") add("PUBLICATION_MODE_NOT_MANUAL");

    return Object.freeze({
        status: blockers.length === 0 ? "READY_FOR_CONSOLE_DRAFT" : "BLOCKED",
        currentVersion: packageVersion || null,
        targetVersion: config.targetVersion || null,
        blockerCount: blockers.length,
        blockers: Object.freeze(blockers),
        submissionApproved: qualification.submissionApproved === true,
        nextAction: blockers.length === 0
            ? "CREATE_AND_REVIEW_ADOBE_CONSOLE_DRAFT"
            : "RESOLVE_MARKETPLACE_BLOCKERS"
    });
}

function readCurrentMarketplaceInputs(projectRoot = PROJECT_ROOT) {
    const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(projectRoot, relativePath), "utf8"));
    const config = readJson("marketplace/marketplace-readiness.json");
    const sourceManifest = readJson("plugin/manifest.json");
    return {
        config,
        packageJson: readJson("package.json"),
        packageLock: readJson("package-lock.json"),
        sourceManifest,
        builtManifest: readJson("dist/manifest.json"),
        pluginIcons: mediaEvidence(
            path.join(projectRoot, "plugin"),
            uniqueManifestIconPaths(sourceManifest)
        ),
        marketplaceIcons: mediaEvidence(projectRoot, config.media?.icons),
        screenshots: mediaEvidence(projectRoot, config.media?.screenshots)
    };
}

function inspectMarketplaceReadiness({ projectRoot = PROJECT_ROOT } = {}) {
    return evaluateMarketplaceReadiness(readCurrentMarketplaceInputs(projectRoot));
}

module.exports = {
    DISALLOWED_PLACEHOLDER_ICON_SHA256,
    MARKETPLACE_ICON_SIZES,
    MAX_ICON_BYTES,
    MAX_SCREENSHOT_BYTES,
    SCREENSHOT_HEIGHT,
    SCREENSHOT_WIDTH,
    evaluateMarketplaceReadiness,
    inspectMarketplaceReadiness,
    readCurrentMarketplaceInputs,
    readPngEvidence,
    uniqueManifestIconPaths
};
