#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const identitySource = fs.readFileSync(
    path.join(projectRoot, "src/config/buildIdentity.js"),
    "utf8"
);
const detailsSource = fs.readFileSync(
    path.join(projectRoot, "src/components/ExecutionDetailsPanel.jsx"),
    "utf8"
);
const webpackSource = fs.readFileSync(
    path.join(projectRoot, "webpack.config.js"),
    "utf8"
);
const sourceManifest = JSON.parse(fs.readFileSync(
    path.join(projectRoot, "plugin/manifest.json"),
    "utf8"
));

let assertions = 0;
function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

try {
    check(identitySource.includes('"com.albumai.pro"'), "canonical plugin ID is missing");
    check(identitySource.includes('"ALB-103-runtime-identity-support-v1"'), "ALB-103 support identity is missing");
    check(identitySource.includes("ALBUMAI_RELEASE_URL"), "canonical release reference is missing");
    check(identitySource.includes("v${ALBUMAI_VERSION}"), "release reference is not version-driven");
    check(detailsSource.includes("export function runtimeIdentityLines"), "runtime identity formatter is missing");
    check(detailsSource.includes('...runtimeIdentityLines()'), "copied diagnostics omit runtime identity");
    check(detailsSource.match(/\.\.\.runtimeIdentityLines\(\)/g)?.length === 2, "summary and debug log must both contain runtime identity");
    check(detailsSource.includes('label="Runtime" value={`${ALBUMAI_PLUGIN_ID} v${ALBUMAI_VERSION}`}'), "visible runtime identity is missing");
    check(detailsSource.includes('label="Build ID" value={ALBUMAI_BUILD_ID}'), "visible build identity is missing");
    check(detailsSource.includes('label="Support ID" value={ALBUMAI_SUPPORT_ID}'), "visible support identity is missing");
    check(detailsSource.includes("Not requested (offline by default)"), "offline runtime posture is missing");
    check(sourceManifest.id === "com.albumai.pro", "manifest plugin ID differs from support identity");
    check(!sourceManifest.requiredPermissions?.network, "ALB-103 must not add network permission");
    check(!sourceManifest.requiredPermissions?.launchProcess, "ALB-103 must not add external-launch permission");
    check(!detailsSource.includes("fetch("), "ALB-103 must not add an update network request");
    check(webpackSource.includes("maxAssetSize: 701 * 1024"), "ALB-103 bundle budget is not explicit");
    check(webpackSource.includes("maxEntrypointSize: 701 * 1024"), "ALB-103 entrypoint budget is not explicit");

    console.info(`PASS ALB-103: ${assertions} runtime identity and support assertions`);
} catch (error) {
    console.error(`FAIL ALB-103: ${error.message}`);
    process.exitCode = 1;
}
