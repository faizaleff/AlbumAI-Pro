#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const identitySource = read("src/config/buildIdentity.js");
const detailsSource = read("src/components/ExecutionDetailsPanel.jsx");
const entrySource = read("src/index.jsx");
const verifierSource = read("scripts/verify-runtime-bundle.js");
const manifest = JSON.parse(read("plugin/manifest.json"));

const RELEASE_BUILD_ID = identitySource.match(
    /ALBUMAI_BUILD_ID\s*=\s*\n?\s*"([^"]+)"/
)?.[1];
const RELEASE_VERSION = identitySource.match(
    /ALBUMAI_VERSION\s*=\s*\n?\s*"([^"]+)"/
)?.[1];
const RUNTIME_REVISION_ID = identitySource.match(
    /ALBUMAI_RUNTIME_REVISION_ID\s*=\s*\n?\s*"([^"]+)"/
)?.[1];
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

try {
    check(/^ALB-\d+-v\d+\.\d+\.\d+-[a-z0-9.-]+-v\d+$/.test(RELEASE_BUILD_ID || ""), "current release build provenance is missing or invalid");
    check(/^ALB-\d+-[a-z0-9.-]+-v\d+$/.test(RUNTIME_REVISION_ID || ""), "current runtime revision is missing or invalid");
    check(identitySource.includes("ALBUMAI_RUNTIME_REVISION_ID"), "runtime revision export is missing");
    check(detailsSource.includes("ALBUMAI_RUNTIME_REVISION_ID"), "diagnostics do not consume runtime revision");
    check(detailsSource.includes("`Runtime Revision: ${ALBUMAI_RUNTIME_REVISION_ID}`"), "copied diagnostics omit runtime revision");
    check(detailsSource.includes('label="Runtime Revision" value={ALBUMAI_RUNTIME_REVISION_ID}'), "visible diagnostics omit runtime revision");
    check(entrySource.includes('console.log("ALBUMAI_RUNTIME_REVISION_ID", ALBUMAI_RUNTIME_REVISION_ID)'), "startup console omits runtime revision");
    check(verifierSource.includes(`"${RUNTIME_REVISION_ID}"`), "bundle verification omits runtime revision");
    check(manifest.version === RELEASE_VERSION, "manifest and runtime release versions differ");
    check(!manifest.requiredPermissions?.network, "ALB-106 must remain offline by default");
    check(!manifest.requiredPermissions?.launchProcess, "ALB-106 must not add external-launch permission");

    console.info(`PASS ALB-106: ${assertions} runtime provenance assertions`);
} catch (error) {
    console.error(`FAIL ALB-106: ${error.message}`);
    process.exitCode = 1;
}
