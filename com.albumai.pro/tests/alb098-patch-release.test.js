#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const PATCH_VERSION = "1.1.1";
const PATCH_BUILD_ID = "ALB-098-v1.1.1-patch-v1";
const PATCH_BUNDLE_SHA256 =
    "62a2fc71bc402b9895d60207cb7b587b3eee0a01fb8ae5abf9fc5e414b635fc8";
const PATCH_ZIP_SHA256 =
    "2cfe0237d468ed3a140b4fab725887ca4ab7f06df2f48d247d1d4dba24548ee9";
const PATCH_CCX_SHA256 =
    "ec50eed854563ee445fec4772b6400a17e53211bf55a4cb6c1b02f6107b2cd3d";
const PUBLISHED_V110_SHA256 =
    "52eb9d8afe903a546ba65ab11a0a53dbdbeee763c423b431db12bd67b1f0a0dc";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function readRepositoryFile(relativePath) {
    return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
    return JSON.parse(readProjectFile(relativePath));
}

try {
    const packageJson = readJson("package.json");
    const packageLock = readJson("package-lock.json");
    const sourceManifest = readJson("plugin/manifest.json");
    const builtManifest = readJson("dist/manifest.json");

    check(packageJson.version === PATCH_VERSION, "package version is not the v1.1.1 patch");
    check(packageLock.version === PATCH_VERSION, "lockfile version differs");
    check(packageLock.packages?.[""]?.version === PATCH_VERSION, "lockfile root version differs");
    check(sourceManifest.version === PATCH_VERSION, "source manifest version differs");
    check(builtManifest.version === PATCH_VERSION, "built manifest version differs");
    check(sourceManifest.id === "com.albumai.pro", "plugin ID changed during patch qualification");
    check(builtManifest.id === sourceManifest.id, "built plugin ID differs");
    check(sourceManifest.manifestVersion === 5, "manifest version changed");
    check(sourceManifest.host?.app === "PS", "patch does not target Photoshop only");
    check(sourceManifest.requiredPermissions?.network === undefined, "patch adds a network permission");

    const buildIdentity = readProjectFile("src/config/buildIdentity.js");
    const runtimeVerifier = readProjectFile("scripts/verify-runtime-bundle.js");
    const distributionVerifier = readProjectFile("scripts/ccx-distribution.js");
    check(buildIdentity.includes(`"${PATCH_BUILD_ID}"`), "source build identity differs");
    check(buildIdentity.includes(`"${PATCH_VERSION}"`), "source display version differs");
    check(runtimeVerifier.includes(`"${PATCH_BUILD_ID}"`), "bundle verifier identity differs");
    check(distributionVerifier.includes(`"${PATCH_BUILD_ID}"`), "CCX verifier identity differs");

    const openFolder = readProjectFile("src/components/OpenFolder.jsx");
    check(!openFolder.includes("v1.0.1"), "stale v1.0.1 badge returned");
    check(openFolder.includes("ALBUMAI_VERSION"), "panel badges are not canonical-version driven");

    const qualification = readRepositoryFile("ALB-098_V1.1.1_PATCH_RELEASE_QUALIFICATION.md");
    const releaseNotes = readRepositoryFile("RELEASE_NOTES_1.1.1.md");
    const changelog = readRepositoryFile("CHANGELOG.md");
    check(qualification.includes("false source and\nartifact provenance claim"), "root provenance gap is missing");
    check(qualification.includes(`Version: \`${PATCH_VERSION}\``), "qualification version differs");
    check(qualification.includes(PATCH_BUILD_ID), "qualification build identity differs");
    check(qualification.includes("RELEASE QUALIFIED — AUTOMATED, CCX, AND INSTALLED RUNTIME PASS"), "qualification status is stale");
    check(qualification.includes(PATCH_BUNDLE_SHA256), "qualification bundle checksum differs");
    check(qualification.includes(PATCH_ZIP_SHA256), "qualification ZIP checksum differs");
    check(qualification.includes(PATCH_CCX_SHA256), "qualification CCX checksum differs");
    check(qualification.includes("Existing REC005 project reopen: **PASS**"), "qualification runtime evidence is missing");
    check(qualification.includes("Registered templates: `2`; ready: `2`; blocking: `0`"), "qualification template evidence is missing");
    check(qualification.includes("Do not tag, publish, overwrite release assets"), "release approval gate is missing");
    check(releaseNotes.includes(`Version: ${PATCH_VERSION}`), "release notes version differs");
    check(releaseNotes.includes("com.albumai.pro_PS.ccx"), "release notes omit the end-user artifact");
    check(releaseNotes.includes("release candidate"), "release notes overclaim publication");
    check(releaseNotes.includes(PATCH_ZIP_SHA256), "release notes ZIP checksum differs");
    check(releaseNotes.includes(PATCH_CCX_SHA256), "release notes CCX checksum differs");
    check(releaseNotes.includes("installed Photoshop startup: PASS"), "release notes runtime result is missing");
    check(releaseNotes.includes("persisted assignments: PASS"), "release notes persistence result is missing");
    check(changelog.includes("## [1.1.1] - Unreleased"), "changelog patch entry is missing");

    const readme = readProjectFile("README.md");
    const roadmap = readProjectFile("docs/ROADMAP.md");
    check(readme.includes("current stable release is **1.1.0**"), "published stable line changed prematurely");
    check(readme.includes("1.1.1` patch line is under ALB-098 qualification"), "README patch status missing");
    check(readme.includes("ALB-043 through ALB-098"), "README test boundary is stale");
    check(roadmap.includes("1.1.1 patch qualification is in progress"), "roadmap patch status missing");

    const v110Notes = readRepositoryFile("RELEASE_NOTES_1.1.0.md");
    const v110Qualification = readRepositoryFile("ALB-095_V1.1.0_RELEASE_QUALIFICATION.md");
    check(v110Notes.includes(PUBLISHED_V110_SHA256), "published v1.1.0 checksum changed");
    check(v110Qualification.includes(PUBLISHED_V110_SHA256), "v1.1.0 qualification changed");
    check(v110Qualification.includes("RELEASED — v1.1.0"), "v1.1.0 release history was rewritten");

    check(packageJson.scripts.test.includes("alb098-patch-release.test.js"), "ALB-098 is absent from npm test");
    check(packageJson.scripts["verify:ci"].includes("distribution:verify"), "patch CI omits CCX preflight");

    console.info(`PASS ALB-098: ${assertions} patch release assertions`);
} catch (error) {
    console.error(`FAIL ALB-098: ${error.message}`);
    process.exitCode = 1;
}
