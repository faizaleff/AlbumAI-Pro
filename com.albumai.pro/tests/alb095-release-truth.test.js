#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const EXPECTED_VERSION = "1.1.0";
const EXPECTED_PACKAGE_SHA256 =
    "52eb9d8afe903a546ba65ab11a0a53dbdbeee763c423b431db12bd67b1f0a0dc";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8"));
}

function readRepositoryFile(relativePath) {
    return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

try {
    const packageJson = readJson("package.json");
    const packageLock = readJson("package-lock.json");
    const sourceManifest = readJson("plugin/manifest.json");
    const builtManifest = readJson("dist/manifest.json");

    check(packageJson.version === EXPECTED_VERSION, "package.json release version differs");
    check(packageLock.version === EXPECTED_VERSION, "package-lock release version differs");
    check(packageLock.packages?.[""]?.version === EXPECTED_VERSION, "lockfile root version differs");
    check(sourceManifest.version === EXPECTED_VERSION, "source manifest version differs");
    check(builtManifest.version === EXPECTED_VERSION, "built manifest version differs");
    check(sourceManifest.id === "com.albumai.pro", "source manifest plugin id differs");
    check(builtManifest.id === sourceManifest.id, "built manifest plugin id differs");

    const changelog = readRepositoryFile("CHANGELOG.md");
    check(changelog.includes("## [1.1.0] - 2026-08-21"), "changelog lacks v1.1.0 entry");
    check(changelog.includes("Multi-Template Album Qualification (ALB-092)"), "changelog lacks ALB-092 evidence");
    check(changelog.includes("Full Album Batch Render (ALB-093)"), "changelog lacks ALB-093 evidence");
    check(changelog.includes("Runtime Bundle Verification (ALB-094)"), "changelog lacks ALB-094 evidence");

    const releaseNotes = readRepositoryFile("RELEASE_NOTES_1.1.0.md");
    check(releaseNotes.includes("AlbumAI-Pro-1.1.0.zip"), "release notes package name differs");
    check(releaseNotes.includes(EXPECTED_PACKAGE_SHA256), "release notes checksum differs");
    check(releaseNotes.includes("ALB-094-bundle-v1"), "release notes runtime identity differs");

    const qualification = readRepositoryFile("ALB-095_V1.1.0_RELEASE_QUALIFICATION.md");
    check(qualification.includes(EXPECTED_PACKAGE_SHA256), "qualification checksum differs");
    check(qualification.includes("exactly nine allowlisted runtime files"), "qualification inventory boundary missing");
    check(qualification.includes("ALBUMAI_BUILD_ID ALB-094-bundle-v1"), "runtime evidence is missing");
    check(qualification.includes("RELEASED — v1.1.0"), "qualification result is stale");

    const readme = fs.readFileSync(path.join(PROJECT_ROOT, "README.md"), "utf8");
    check(readme.includes("current stable release is **1.1.0**"), "README release line is stale");
    check(readme.includes("ALB-043 through ALB-096"), "README test boundary is stale");
    check(readme.includes("above 700 KiB"), "README bundle budget is stale");

    const roadmap = fs.readFileSync(path.join(PROJECT_ROOT, "docs/ROADMAP.md"), "utf8");
    check(roadmap.includes("1.1.0 stable — released 2026-08-21"), "roadmap release line is stale");
    check(roadmap.includes("Roadmap items are not shipped claims"), "roadmap claims boundary is missing");

    console.info(`PASS ALB-095: ${assertions} release truth assertions`);
} catch (error) {
    console.error(`FAIL ALB-095: ${error.message}`);
    process.exitCode = 1;
}
