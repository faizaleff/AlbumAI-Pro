#!/usr/bin/env node

"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PLUGIN_ROOT = path.join(PROJECT_ROOT, "plugin");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");
const EXPECTED_BUILD_ID = "ALB-098-v1.1.1-patch-v1";
const EXPECTED_RUNTIME_REVISION_ID = "ALB-106-runtime-provenance-v1";
const RETIRED_BUILD_ID = "ALB-030.3-scroll-commit-timing-v1";
const STATIC_FILES = Object.freeze([
    "icons/icon_D.png",
    "icons/icon_D@2x.png",
    "icons/icon_N.png",
    "icons/icon_N@2x.png",
    "index.html",
    "manifest.json"
]);

function assert(condition, message) {
    if (!condition) {
        throw new Error(message);
    }
}

function sha256(content) {
    return crypto.createHash("sha256").update(content).digest("hex");
}

try {
    assert(
        !fs.existsSync(path.join(PLUGIN_ROOT, "index.js")),
        "plugin/index.js exists; dist/index.js no longer has a single source of truth"
    );

    const bundlePath = path.join(DIST_ROOT, "index.js");
    assert(fs.statSync(bundlePath).isFile(), "dist/index.js is missing");

    const bundle = fs.readFileSync(bundlePath);
    const bundleText = bundle.toString("utf8");
    assert(
        bundleText.includes(EXPECTED_BUILD_ID),
        `dist/index.js does not contain ${EXPECTED_BUILD_ID}`
    );
    assert(
        bundleText.includes(EXPECTED_RUNTIME_REVISION_ID),
        `dist/index.js does not contain ${EXPECTED_RUNTIME_REVISION_ID}`
    );
    assert(
        !bundleText.includes(RETIRED_BUILD_ID),
        `dist/index.js still contains retired identity ${RETIRED_BUILD_ID}`
    );

    for (const relativePath of STATIC_FILES) {
        const source = fs.readFileSync(path.join(PLUGIN_ROOT, relativePath));
        const output = fs.readFileSync(path.join(DIST_ROOT, relativePath));
        assert(
            source.equals(output),
            `Static asset differs after production build: ${relativePath}`
        );
    }

    console.info(
        `PASS ALB-106 bundle: ${EXPECTED_BUILD_ID} ${EXPECTED_RUNTIME_REVISION_ID} ` +
        `${bundle.length} bytes sha256=${sha256(bundle)}`
    );
} catch (error) {
    console.error(`FAIL ALB-094 bundle: ${error.message}`);
    process.exitCode = 1;
}
