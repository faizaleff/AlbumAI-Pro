#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

function readProjectFile(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

try {
    const plan = readProjectFile("docs/ALB-133_POST_RELEASE_DEVELOPMENT_PLAN.md");
    const roadmap = readProjectFile("docs/ROADMAP.md");
    const readme = readProjectFile("README.md");
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const identity = readProjectFile("src/config/buildIdentity.js");
    const closeout = readProjectFile("docs/ALB-132_V1.2.0_RELEASE_CLOSEOUT.md");
    const index = fs.readFileSync(
        path.join(REPOSITORY_ROOT, "ALB-116_ENGINEERING_RECORD_INDEX.md"),
        "utf8"
    );

    check(packageJson.version === "1.2.0", "ALB-133 must not bump the package version");
    check(identity.includes("ALB-131-v1.2.0-release-v1"), "release build identity changed");
    check(
        identity.includes("ALB-131-v1.2.0-publication-ready-v1"),
        "release runtime revision changed"
    );
    check(plan.includes("Do not create an empty `v1.2.1` release"), "patch decision is missing");
    check(plan.includes("Keep `v1.2.0` immutable"), "immutable release boundary is missing");
    check(plan.includes("ALB-134 — Adobe Marketplace Readiness"), "next milestone is missing");
    check(plan.includes("approval boundary before uploading"), "Adobe upload approval gate is missing");
    check(plan.includes("ALB-070") && plan.includes("remains blocked"), "AI blocked state is missing");
    check(/does\s+not authorize model integration/.test(plan), "AI integration boundary is missing");
    check(/Photoshop runtime\s+retest/.test(plan), "runtime retest boundary is missing");
    check(roadmap.includes("**1.2.0 stable — released 2026-08-31**"), "roadmap current release differs");
    check(!roadmap.includes("**1.1.2 stable — released 2026-08-23**"), "roadmap retains stale heading");
    check(
        roadmap.includes("Marketplace readiness — ALB-134 in progress"),
        "roadmap next milestone differs"
    );
    check(readme.includes("ALB-131 qualified the\nexact `v1.2.0` ZIP and CCX"), "README installer provenance differs");
    check(readme.includes("ALB-133 selects Adobe Marketplace readiness"), "README next action differs");
    check(packageJson.scripts.test.includes("npm run test:alb133"), "ALB-133 is absent from npm test");
    check(packageJson.scripts["test:alb133"] === "node tests/run-alb133-tests.js", "ALB-133 script differs");
    check(index.includes("ALB-133_POST_RELEASE_DEVELOPMENT_PLAN.md"), "engineering index omits ALB-133");
    check(closeout.includes("tag and release assets are immutable"), "ALB-132 history changed");

    console.info(`PASS ALB-133: ${assertions} post-release planning assertions`);
} catch (error) {
    console.error(`FAIL ALB-133: ${error.message}`);
    process.exitCode = 1;
}
