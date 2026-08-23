#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const RELEASE_URL = "https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.1.2";
const TAG_TARGET = "549c76482867bbf8e46af1609dfca866e8c1a598";
const BUILD_ID = "ALB-108-v1.1.2-patch-v1";
const RUNTIME_REVISION_ID = "ALB-108-v1.1.2-release-candidate-v1";
const BUNDLE_SHA256 = "5fc1de71ffb03f21a9f732905a4fb7344a87aae53dc93cf50ae6375cda15fc63";
const ZIP_SHA256 = "eb06188e3eb7e06d04ba12a2cb70b046c6836489c28b36aba3ff8ab9e55c4f3f";
const CCX_SHA256 = "e8c574ba2effa46cd93479f5b5134bed8483861f3c53bcb76021ed91f4868816";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message || "Assertion failed");
}

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function readRepositoryFile(relativePath) {
    return fs.readFileSync(path.join(REPOSITORY_ROOT, relativePath), "utf8");
}

try {
    const closeout = readProjectFile("docs/ALB-109_V1.1.2_RELEASE_CLOSEOUT.md");
    const readme = readProjectFile("README.md");
    const roadmap = readProjectFile("docs/ROADMAP.md");
    const changelog = readRepositoryFile("CHANGELOG.md");
    const releaseNotes = readRepositoryFile("RELEASE_NOTES_1.1.2.md");
    const packageJson = JSON.parse(readProjectFile("package.json"));

    check(closeout.includes(RELEASE_URL), "closeout release URL differs");
    check(closeout.includes(TAG_TARGET), "closeout tag target differs");
    check(closeout.includes("2026-08-23T10:00:10Z"), "closeout publication time differs");
    check(closeout.includes("2026-08-23"), "closeout release date differs");
    check(closeout.includes(BUILD_ID), "closeout build ID differs");
    check(closeout.includes(RUNTIME_REVISION_ID), "closeout runtime revision differs");
    check(closeout.includes(BUNDLE_SHA256), "closeout bundle checksum differs");
    check(closeout.includes(ZIP_SHA256), "closeout ZIP checksum differs");
    check(closeout.includes(CCX_SHA256), "closeout CCX checksum differs");
    check(closeout.includes("no additional Photoshop runtime retest is\n  required"), "closeout runtime boundary is missing");
    check(closeout.includes("tag and release assets are immutable"), "closeout immutability boundary is missing");
    check(readme.includes("current stable release is **1.1.2**"), "README stable version differs");
    check(readme.includes(RELEASE_URL), "README release URL differs");
    check(!readme.includes("1.1.1 remains the current stable release"), "README retains stale stable-release wording");
    check(!readme.includes("1.1.2** patch candidate"), "README retains candidate wording");
    check(roadmap.includes("1.1.2 stable — released 2026-08-23"), "roadmap release date differs");
    check(roadmap.includes(RELEASE_URL), "roadmap release URL differs");
    check(changelog.includes("## [1.1.2] - 2026-08-23"), "canonical changelog release date differs");
    check(changelog.includes("ALB-108 automated, CCX, and installed Photoshop qualification: PASS"), "changelog qualification result differs");
    check(changelog.includes(RELEASE_URL), "changelog release URL differs");
    check(releaseNotes.includes("Status: released 2026-08-23"), "release notes status differs");
    check(releaseNotes.includes(RELEASE_URL), "release notes release URL differs");
    check(releaseNotes.includes(TAG_TARGET), "release notes tag target differs");
    check(!releaseNotes.includes("not created; explicit approval required"), "release notes retain stale publication gate");
    check(packageJson.scripts.test.includes("alb109-release-closeout.test.js"), "ALB-109 is absent from npm test");

    console.info(`PASS ALB-109: ${assertions} release closeout assertions`);
} catch (error) {
    console.error(`FAIL ALB-109: ${error.message}`);
    process.exitCode = 1;
}
