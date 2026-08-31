#!/usr/bin/env node

"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const VERSION = "1.2.0";
const BUILD_ID = "ALB-131-v1.2.0-release-v1";
const RUNTIME_REVISION_ID = "ALB-131-v1.2.0-publication-ready-v1";
const RELEASE_URL = "https://github.com/faizaleff/AlbumAI-Pro/releases/tag/v1.2.0";
const MAX_BUNDLE_BYTES = 740 * 1024;
const MIN_BUNDLE_HEADROOM_BYTES = 16 * 1024;
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

function read(relativePath) {
    return fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8");
}

function readJson(relativePath) {
    return JSON.parse(read(relativePath));
}

try {
    const packageJson = readJson("package.json");
    const packageLock = readJson("package-lock.json");
    const sourceManifest = readJson("plugin/manifest.json");
    const builtManifest = readJson("dist/manifest.json");
    const identity = read("src/config/buildIdentity.js");
    const details = read("src/components/ExecutionDetailsPanel.jsx");
    const bundleVerifier = read("scripts/verify-runtime-bundle.js");
    const distributionVerifier = read("scripts/ccx-distribution.js");
    const record = read("docs/ALB-131_V1.2.0_PUBLICATION_READINESS.md");
    const releaseNotes = fs.readFileSync(path.join(REPOSITORY_ROOT, "RELEASE_NOTES_1.2.0.md"), "utf8");
    const candidateRecord = read("docs/ALB-130_V1.2.0_RELEASE_CANDIDATE.md");
    const candidateSummary = read("docs/evidence/alb-130/installed-runtime-summary.txt");
    const installedSummary = read("docs/evidence/alb-131/installed-runtime-summary.txt");
    const installedDebug = read("docs/evidence/alb-131/installed-runtime-debug.txt");
    const installedSmoke = read("docs/evidence/alb-131/INSTALLED_RUNTIME_SMOKE.md");
    const appliedScreenshot = path.join(PROJECT_ROOT, "docs/evidence/alb-131/installed-typography-applied.jpeg");
    const restoredScreenshot = path.join(PROJECT_ROOT, "docs/evidence/alb-131/installed-typography-restored.jpeg");
    const bundle = fs.readFileSync(path.join(PROJECT_ROOT, "dist/index.js"));
    const tags = childProcess.execFileSync("git", ["tag", "--list", "v1.2.0"], {
        cwd: PROJECT_ROOT,
        encoding: "utf8"
    }).trim();

    check(packageJson.version === VERSION, "package version differs from v1.2.0");
    check(packageLock.version === VERSION && packageLock.packages?.[""]?.version === VERSION, "lockfile version differs");
    check(sourceManifest.version === VERSION && builtManifest.version === VERSION, "manifest version differs");
    check(identity.includes(`"${BUILD_ID}"`), "release build ID differs");
    check(identity.includes(`"${RUNTIME_REVISION_ID}"`), "release runtime revision differs");
    check(identity.includes('ALBUMAI_RELEASE_STATUS =\n    "RELEASE"'), "release artifact status differs");
    check(identity.includes("v${ALBUMAI_VERSION}"), "canonical release URL is not version-driven");
    check(details.includes("ALBUMAI_RELEASE_URL ||"), "candidate-safe release fallback was removed");
    check(bundle.length <= MAX_BUNDLE_BYTES, "release bundle exceeds 740 KiB");
    check(MAX_BUNDLE_BYTES - bundle.length >= MIN_BUNDLE_HEADROOM_BYTES, "release bundle headroom is below 16 KiB");
    check(bundle.includes(BUILD_ID), "release bundle omits build ID");
    check(bundle.includes(RUNTIME_REVISION_ID), "release bundle omits runtime revision");
    check(bundle.includes(RELEASE_URL), "release bundle omits canonical support URL");
    check(bundleVerifier.includes(`"${BUILD_ID}"`) && bundleVerifier.includes(`"${RUNTIME_REVISION_ID}"`), "bundle verifier identity differs");
    check(distributionVerifier.includes(`"${BUILD_ID}"`), "distribution verifier identity differs");
    check(record.includes("Status: local qualification complete"), "publication-readiness record status differs");
    check(releaseNotes.includes("Status: publication-ready; not yet published"), "release notes make a false publication claim");
    check(releaseNotes.includes("Smart Typography"), "release notes omit Smart Typography");
    check(tags === "", "v1.2.0 tag already exists before publication approval");
    check(candidateRecord.includes("Status: release candidate qualified"), "ALB-130 candidate history changed");
    check(candidateSummary.includes("Release: Not published (candidate)"), "ALB-130 candidate truth changed");
    check(packageJson.scripts.test.includes("npm run test:alb131"), "ALB-131 is absent from npm test");
    check(record.includes("6fbd51bbee87df3f3c3c0072425384b93e085f91ba0f4bf22f8ffa8389b5292e"), "release ZIP checksum is not recorded");
    check(record.includes("9c4c22a737b51d9a961a9a9bb9272fe4aa041933332416100d21914bf4db7b47"), "release CCX checksum is not recorded");
    check(installedSummary.includes(BUILD_ID) && installedSummary.includes(RUNTIME_REVISION_ID), "installed summary identity differs");
    check(installedDebug.includes("Batch Errors: None"), "installed debug evidence reports batch errors");
    check(installedSmoke.includes("Result: PASS") && installedSmoke.includes("grouped Undo"), "installed runtime smoke is incomplete");
    check(fs.existsSync(appliedScreenshot) && fs.statSync(appliedScreenshot).size > 0, "applied typography screenshot is missing");
    check(fs.existsSync(restoredScreenshot) && fs.statSync(restoredScreenshot).size > 0, "restored typography screenshot is missing");

    console.info(`PASS ALB-131: ${assertions} v1.2.0 publication-readiness assertions`);
} catch (error) {
    console.error(`FAIL ALB-131: ${error.message}`);
    process.exitCode = 1;
}
