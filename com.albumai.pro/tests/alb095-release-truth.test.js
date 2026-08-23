#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const PUBLISHED_VERSION = "1.1.0";
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

    check(packageLock.version === packageJson.version, "package-lock version differs from package.json");
    check(packageLock.packages?.[""]?.version === packageJson.version, "lockfile root version differs");
    check(sourceManifest.version === packageJson.version, "source manifest version differs");
    check(builtManifest.version === packageJson.version, "built manifest version differs");
    check(
        Number(packageJson.version.split(".").join("")) >= Number(PUBLISHED_VERSION.split(".").join("")),
        "current version regressed below the published v1.1.0 baseline"
    );
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
    const stableVersion = readme.match(/current stable release is \*\*(\d+\.\d+\.\d+)\*\*/)?.[1];
    check(
        Boolean(stableVersion) && Number(stableVersion.split(".").join("")) >= Number(PUBLISHED_VERSION.split(".").join("")),
        "README stable release regressed below v1.1.0"
    );
    const testBoundary = readme.match(/ALB-043 through ALB-(\d+)/);
    check(
        Boolean(testBoundary) && Number(testBoundary[1]) >= 95,
        "README test boundary regressed below ALB-095"
    );
    check(readme.includes("above 700 KiB"), "README bundle budget is stale");

    const roadmap = fs.readFileSync(path.join(PROJECT_ROOT, "docs/ROADMAP.md"), "utf8");
    const roadmapVersion = roadmap.match(/\*\*(\d+\.\d+\.\d+) stable — released/)?.[1];
    check(
        Boolean(roadmapVersion) && Number(roadmapVersion.split(".").join("")) >= Number(PUBLISHED_VERSION.split(".").join("")),
        "roadmap stable release regressed below v1.1.0"
    );
    check(roadmap.includes("Roadmap items are not shipped claims"), "roadmap claims boundary is missing");

    console.info(`PASS ALB-095: ${assertions} release truth assertions`);
} catch (error) {
    console.error(`FAIL ALB-095: ${error.message}`);
    process.exitCode = 1;
}
