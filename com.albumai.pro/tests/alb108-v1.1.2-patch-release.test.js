#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const projectRoot = path.resolve(__dirname, "..");
const repositoryRoot = path.resolve(projectRoot, "..");
const read = relativePath => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
const readRepository = relativePath => fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8");
const readJson = relativePath => JSON.parse(read(relativePath));
const VERSION = "1.1.2";
const BUILD_ID = "ALB-108-v1.1.2-patch-v1";
const RUNTIME_REVISION_ID = "ALB-108-v1.1.2-release-candidate-v1";
const BUNDLE_SHA256 = "5fc1de71ffb03f21a9f732905a4fb7344a87aae53dc93cf50ae6375cda15fc63";
const ZIP_SHA256 = "eb06188e3eb7e06d04ba12a2cb70b046c6836489c28b36aba3ff8ab9e55c4f3f";
const CCX_SHA256 = "e8c574ba2effa46cd93479f5b5134bed8483861f3c53bcb76021ed91f4868816";
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

try {
    const packageJson = readJson("package.json");
    const packageLock = readJson("package-lock.json");
    const sourceManifest = readJson("plugin/manifest.json");
    const builtManifest = readJson("dist/manifest.json");
    const identity = read("src/config/buildIdentity.js");
    const bundleVerifier = read("scripts/verify-runtime-bundle.js");
    const distributionVerifier = read("scripts/ccx-distribution.js");
    const qualification = readRepository("ALB-108_V1.1.2_PATCH_RELEASE_QUALIFICATION.md");
    const releaseNotes = readRepository("RELEASE_NOTES_1.1.2.md");
    const changelog = readRepository("CHANGELOG.md");
    const historicalCloseout = read("docs/ALB-099_V1.1.1_RELEASE_CLOSEOUT.md");

    check(packageJson.version === VERSION, "package version differs from v1.1.2");
    check(packageLock.version === VERSION, "lockfile version differs from v1.1.2");
    check(packageLock.packages?.[""]?.version === VERSION, "lockfile root version differs");
    check(sourceManifest.version === VERSION, "source manifest version differs");
    check(builtManifest.version === VERSION, "built manifest version differs");
    check(sourceManifest.id === "com.albumai.pro", "plugin ID changed");
    check(sourceManifest.manifestVersion === 5, "manifest generation changed");
    check(sourceManifest.host?.app === "PS", "release no longer targets Photoshop only");
    check(!sourceManifest.requiredPermissions?.network, "release adds network permission");
    check(!sourceManifest.requiredPermissions?.launchProcess, "release adds launch permission");
    check(identity.includes(`"${VERSION}"`), "runtime display version differs");
    check(identity.includes(`"${BUILD_ID}"`), "runtime build ID differs");
    check(identity.includes(`"${RUNTIME_REVISION_ID}"`), "runtime revision differs");
    check(bundleVerifier.includes(`"${BUILD_ID}"`), "bundle verifier build ID differs");
    check(bundleVerifier.includes(`"${RUNTIME_REVISION_ID}"`), "bundle verifier revision differs");
    check(distributionVerifier.includes(`"${BUILD_ID}"`), "CCX verifier build ID differs");
    check(qualification.includes("false source-to-artifact\nprovenance claim"), "qualification root cause is missing");
    check(qualification.includes(`Version: \`${VERSION}\``), "qualification version differs");
    check(qualification.includes(BUILD_ID), "qualification build ID differs");
    check(qualification.includes(RUNTIME_REVISION_ID), "qualification runtime revision differs");
    check(qualification.includes("RELEASE QUALIFICATION PASS"), "release qualification status is stale");
    check(qualification.includes(BUNDLE_SHA256), "qualification bundle checksum differs");
    check(qualification.includes(ZIP_SHA256), "qualification ZIP checksum differs");
    check(qualification.includes(CCX_SHA256), "qualification CCX checksum differs");
    check(qualification.includes("CCX result: **PASS**"), "CCX qualification status is stale");
    check(qualification.includes("Installed runtime result: **PASS**"), "installed runtime qualification status is stale");
    check(qualification.includes("`2/2`, `1/1`, `2/2`, `1/1`"), "installed assignment evidence is missing");
    check(qualification.includes("Do not commit, push, tag, publish"), "approval gate is missing");
    check(releaseNotes.includes("Status: released 2026-08-23"), "release notes publication status differs");
    check(releaseNotes.includes(BUILD_ID), "release notes build ID differs");
    check(releaseNotes.includes(RUNTIME_REVISION_ID), "release notes runtime revision differs");
    check(releaseNotes.includes(BUNDLE_SHA256), "release notes bundle checksum differs");
    check(releaseNotes.includes(ZIP_SHA256), "release notes ZIP checksum differs");
    check(releaseNotes.includes(CCX_SHA256), "release notes CCX checksum differs");
    check(releaseNotes.includes("installed Photoshop runtime qualification:\n  PASS"), "release notes installed-runtime status is stale");
    check(changelog.includes("## [1.1.2] - 2026-08-23"), "changelog release date differs");
    check(historicalCloseout.includes("v1.1.1"), "historical v1.1.1 closeout was lost");
    check(historicalCloseout.includes("2fb03a453575b2d91a76d2ae7fefa488b8500816"), "historical tag target changed");
    check(packageJson.scripts.test.includes("alb108-v1.1.2-patch-release.test.js"), "ALB-108 test is absent from npm test");

    console.info(`PASS ALB-108: ${assertions} patch release assertions`);
} catch (error) {
    console.error(`FAIL ALB-108: ${error.message}`);
    process.exitCode = 1;
}
