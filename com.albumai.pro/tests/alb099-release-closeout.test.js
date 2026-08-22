#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const RELEASE_URL = "https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.1.1";
const TAG_TARGET = "2fb03a453575b2d91a76d2ae7fefa488b8500816";
const CCX_SHA256 = "ec50eed854563ee445fec4772b6400a17e53211bf55a4cb6c1b02f6107b2cd3d";
const ZIP_SHA256 = "2cfe0237d468ed3a140b4fab725887ca4ab7f06df2f48d247d1d4dba24548ee9";

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
    const closeout = readProjectFile("docs/ALB-099_V1.1.1_RELEASE_CLOSEOUT.md");
    const readme = readProjectFile("README.md");
    const roadmap = readProjectFile("docs/ROADMAP.md");
    const changelog = readRepositoryFile("CHANGELOG.md");
    const releaseNotes = readRepositoryFile("RELEASE_NOTES_1.1.1.md");
    const packageJson = JSON.parse(readProjectFile("package.json"));

    check(closeout.includes(RELEASE_URL), "closeout release URL differs");
    check(closeout.includes(TAG_TARGET), "closeout tag target differs");
    check(closeout.includes("2026-08-21T07:24:46Z"), "closeout publication time differs");
    check(closeout.includes("com.albumai.pro_PS.ccx"), "closeout direct installer name differs");
    check(closeout.includes(CCX_SHA256), "closeout CCX checksum differs");
    check(closeout.includes(ZIP_SHA256), "closeout ZIP checksum differs");
    check(closeout.includes("no additional Photoshop runtime retest is required"), "closeout runtime boundary is missing");
    check(closeout.includes("GitHub issue #14"), "closeout loses active AI gate truth");
    check(closeout.includes("PR #19 is a conflicting historical ALB-081 branch"), "closeout loses stale PR truth");
    check(readme.includes("current stable release is **1.1.1**"), "README stable version differs");
    check(roadmap.includes("1.1.1 stable — released 2026-08-21"), "roadmap release date differs");
    check(!roadmap.includes("qualification is in progress"), "roadmap retains stale qualification wording");
    check(changelog.includes("## [1.1.1] - 2026-08-21"), "canonical changelog release date differs");
    check(releaseNotes.includes("Status: released 2026-08-21"), "release notes status differs");
    check(releaseNotes.includes(RELEASE_URL), "release notes release URL differs");
    check(!fs.existsSync(path.join(PROJECT_ROOT, "CHANGELOG.md")), "duplicate plugin changelog remains");
    check(packageJson.scripts.test.includes("alb099-release-closeout.test.js"), "ALB-099 is absent from npm test");

    console.info(`PASS ALB-099: ${assertions} release closeout assertions`);
} catch (error) {
    console.error(`FAIL ALB-099: ${error.message}`);
    process.exitCode = 1;
}
