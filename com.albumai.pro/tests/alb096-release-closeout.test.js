#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const RELEASE_URL = "https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.1.0";
const TAG_TARGET = "fa5cc59adcb49807e680ea544bd5c81c68d956d8";
const PACKAGE_SHA256 = "52eb9d8afe903a546ba65ab11a0a53dbdbeee763c423b431db12bd67b1f0a0dc";

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

try {
    const readme = readProjectFile("README.md");
    const roadmap = readProjectFile("docs/ROADMAP.md");
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const qualification = readRepositoryFile("ALB-095_V1.1.0_RELEASE_QUALIFICATION.md");
    const closeout = readRepositoryFile("ALB-096_V1.1.0_RELEASE_CLOSEOUT.md");

    check(readme.includes("current stable release is **1.1.0**"), "README does not identify the stable release");
    check(readme.includes(RELEASE_URL), "README lacks the published release URL");
    check(!readme.includes("current release candidate"), "README retains release-candidate wording");
    check(readme.includes("ALB-043 through ALB-096"), "README test boundary is stale");

    check(roadmap.includes("1.1.0 stable — released 2026-08-21"), "roadmap stable release line is missing");
    check(roadmap.includes(RELEASE_URL), "roadmap lacks the published release URL");
    check(!roadmap.includes("qualification in progress"), "roadmap retains in-progress qualification wording");
    check(roadmap.includes("ALB-070 local-AI architecture issue remains open"), "roadmap hides the active AI gate");

    check(qualification.includes("RELEASED — v1.1.0"), "qualification does not record publication");
    check(qualification.includes(TAG_TARGET), "qualification tag target differs");
    check(qualification.includes(RELEASE_URL), "qualification release URL differs");

    check(closeout.includes("Tag: `v1.1.0`"), "closeout tag is missing");
    check(closeout.includes(TAG_TARGET), "closeout tag target differs");
    check(closeout.includes("2026-08-21T04:28:21Z"), "closeout publication time differs");
    check(closeout.includes("AlbumAI-Pro-1.1.0.zip"), "closeout package name differs");
    check(closeout.includes(PACKAGE_SHA256), "closeout package checksum differs");
    check(closeout.includes("no Photoshop runtime retest is\nrequired"), "closeout runtime boundary is missing");
    check(closeout.includes("GitHub issue #14 remains open"), "closeout loses active AI backlog truth");
    check(closeout.includes("PR #19 is a conflicting historical ALB-081 branch"), "closeout loses stale PR truth");

    check(packageJson.scripts.test.includes("alb096-release-closeout.test.js"), "ALB-096 is absent from npm test");

    console.info(`PASS ALB-096: ${assertions} release closeout assertions`);
} catch (error) {
    console.error(`FAIL ALB-096: ${error.message}`);
    process.exitCode = 1;
}
