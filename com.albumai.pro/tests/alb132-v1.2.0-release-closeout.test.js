#!/usr/bin/env node

"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const RELEASE_URL = "https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.2.0";
const TAG_TARGET = "5027adc97d0f208e84fa92404615556c4ffd5a5c";
const BUILD_ID = "ALB-131-v1.2.0-release-v1";
const RUNTIME_REVISION_ID = "ALB-131-v1.2.0-publication-ready-v1";
const BUNDLE_SHA256 = "c51e3d2c8de1cd6f0a8d33042fe5fae18ae24be3c43786ff3cb95390cbdecfbd";
const ZIP_SHA256 = "6fbd51bbee87df3f3c3c0072425384b93e085f91ba0f4bf22f8ffa8389b5292e";
const CCX_SHA256 = "9c4c22a737b51d9a961a9a9bb9272fe4aa041933332416100d21914bf4db7b47";
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function readRepositoryFile(relativePath) {
    return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

try {
    const closeout = readProjectFile("docs/ALB-132_V1.2.0_RELEASE_CLOSEOUT.md");
    const readiness = readProjectFile("docs/ALB-131_V1.2.0_PUBLICATION_READINESS.md");
    const readme = readProjectFile("README.md");
    const roadmap = readProjectFile("docs/ROADMAP.md");
    const changelog = readRepositoryFile("CHANGELOG.md");
    const releaseNotes = readRepositoryFile("RELEASE_NOTES_1.2.0.md");
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const identity = readProjectFile("src/config/buildIdentity.js");
    const bundle = fs.readFileSync(path.join(PROJECT_ROOT, "dist/index.js"));
    const tagTarget = childProcess.execFileSync("git", ["rev-list", "-n", "1", "v1.2.0"], {
        cwd: PROJECT_ROOT,
        encoding: "utf8"
    }).trim();

    check(tagTarget === TAG_TARGET, "local v1.2.0 tag target differs");
    check(closeout.includes(RELEASE_URL), "closeout release URL differs");
    check(closeout.includes(TAG_TARGET), "closeout tag target differs");
    check(closeout.includes("d439d937eceb5a703e660ab1421a94216e045688"), "annotated tag object differs");
    check(closeout.includes("2026-08-31T21:10:05Z"), "publication time differs");
    check(closeout.includes("33438470051"), "main CI evidence differs");
    check(closeout.includes(BUILD_ID), "closeout build ID differs");
    check(closeout.includes(RUNTIME_REVISION_ID), "closeout runtime revision differs");
    check(closeout.includes(BUNDLE_SHA256), "bundle checksum differs");
    check(closeout.includes(ZIP_SHA256) && closeout.includes("201,617 bytes"), "ZIP evidence differs");
    check(closeout.includes(CCX_SHA256) && closeout.includes("197,299 bytes"), "CCX evidence differs");
    check(closeout.includes("fresh-download SHA-256"), "fresh-download verification is missing");
    check(closeout.includes("tag and release assets are immutable"), "immutability boundary is missing");
    check(closeout.includes("no additional Photoshop runtime\n  retest is required"), "runtime retest boundary is missing");
    check(readiness.includes("No external publication has been performed"), "historical ALB-131 boundary changed");
    check(readme.includes("current stable release is **1.2.0**"), "README stable version differs");
    check(readme.includes(RELEASE_URL), "README release URL differs");
    check(!readme.includes("stable release stays\nat **1.1.2**"), "README retains stale stable-release wording");
    check(roadmap.includes("v1.2.0 stable — released 2026-08-31"), "roadmap release date differs");
    check(roadmap.includes("ALB-132 release closeout"), "roadmap omits release closeout");
    check(changelog.includes("## [1.2.0] - 2026-08-31"), "changelog release date differs");
    check(changelog.includes(RELEASE_URL), "changelog release URL differs");
    check(releaseNotes.includes("Status: released 2026-08-31"), "release notes status differs");
    check(releaseNotes.includes(TAG_TARGET), "release notes tag target differs");
    check(!releaseNotes.includes("not yet published"), "release notes retain stale publication status");
    check(packageJson.scripts.test.includes("npm run test:alb132"), "ALB-132 is absent from npm test");
    check(identity.includes(BUILD_ID) && identity.includes(RUNTIME_REVISION_ID), "runtime identity changed after release");
    check(crypto.createHash("sha256").update(bundle).digest("hex") === BUNDLE_SHA256, "committed bundle checksum differs");

    console.info(`PASS ALB-132: ${assertions} v1.2.0 release closeout assertions`);
} catch (error) {
    console.error(`FAIL ALB-132: ${error.message}`);
    process.exitCode = 1;
}
