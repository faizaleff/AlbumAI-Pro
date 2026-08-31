#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { minifyCss } = require("../scripts/minify-css-loader");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const VERSION = "1.2.0";
const BUILD_ID = "ALB-130-v1.2.0-smart-typography-v1";
const RUNTIME_REVISION_ID = "ALB-130-v1.2.0-release-candidate-v1";
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
    const webpack = read("webpack.config.js");
    const css = read("src/styles.css");
    const minifiedCss = minifyCss(css);
    const bundle = fs.readFileSync(path.join(PROJECT_ROOT, "dist/index.js"));
    const historicalQualification = fs.readFileSync(
        path.join(REPOSITORY_ROOT, "ALB-108_V1.1.2_PATCH_RELEASE_QUALIFICATION.md"),
        "utf8"
    );
    const candidateRecord = read("docs/ALB-130_V1.2.0_RELEASE_CANDIDATE.md");
    const installedSummary = read("docs/evidence/alb-130/installed-runtime-summary.txt");
    const installedDebug = read("docs/evidence/alb-130/installed-runtime-debug.txt");
    const appliedEvidence = fs.readFileSync(path.join(
        PROJECT_ROOT,
        "docs/evidence/alb-130/installed-typography-applied.jpeg"
    ));
    const restoredEvidence = fs.readFileSync(path.join(
        PROJECT_ROOT,
        "docs/evidence/alb-130/installed-typography-undo-restored.jpeg"
    ));

    check(packageJson.version === VERSION, "package version differs from v1.2.0");
    check(packageLock.version === VERSION, "lockfile version differs from v1.2.0");
    check(packageLock.packages?.[""]?.version === VERSION, "lockfile root version differs");
    check(sourceManifest.version === VERSION, "source manifest version differs");
    check(builtManifest.version === VERSION, "built manifest version differs");
    check(identity.includes(`"${BUILD_ID}"`), "candidate build ID differs");
    check(identity.includes(`"${RUNTIME_REVISION_ID}"`), "candidate runtime revision differs");
    check(identity.includes('ALBUMAI_RELEASE_STATUS =\n    "CANDIDATE"'), "candidate release status differs");
    check(identity.includes("ALBUMAI_RELEASE_URL = null"), "candidate falsely claims a release URL");
    check(details.includes("Not published (${ALBUMAI_RELEASE_STATUS.toLowerCase()})"), "candidate disclosure is missing from diagnostics");
    check(webpack.includes('path.resolve(__dirname, "scripts/minify-css-loader.js")'), "production CSS minifier is not wired");
    check(minifyCss('a::before { content: "a /* keep */ b"; }') === 'a::before{content:"a /* keep */ b"}', "CSS minifier changes quoted content");
    check(minifyCss("/* drop */ .a { color: red; }") === ".a{color:red}", "CSS minifier does not collapse comments and syntax");
    check(minifiedCss.length < css.length - 10000, "CSS minifier does not provide meaningful headroom");
    check((minifiedCss.match(/{/g) || []).length === (minifiedCss.match(/}/g) || []).length, "minified stylesheet braces are unbalanced");
    check(bundle.length <= MAX_BUNDLE_BYTES, "candidate bundle exceeds 740 KiB");
    check(MAX_BUNDLE_BYTES - bundle.length >= MIN_BUNDLE_HEADROOM_BYTES, "candidate bundle headroom is below 16 KiB");
    check(bundle.includes(BUILD_ID), "candidate bundle omits build ID");
    check(bundle.includes(RUNTIME_REVISION_ID), "candidate bundle omits runtime revision");
    check(historicalQualification.includes("ALB-108-v1.1.2-patch-v1"), "historical v1.1.2 build identity changed");
    check(historicalQualification.includes("RELEASE QUALIFICATION PASS"), "historical v1.1.2 qualification changed");
    check(candidateRecord.includes("Status: release candidate qualified"), "candidate qualification status is stale");
    check(candidateRecord.includes("ed4753a599f66eee0cb5b44d54610b258f638f5f8febc6ecf6372fae80e54e37"), "verified CCX checksum is missing");
    check(installedSummary.includes(`Version: ${VERSION}`) && installedSummary.includes(`Build ID: ${BUILD_ID}`), "installed Summary identity differs");
    check(installedDebug.includes("Name: ALB-127-Storyboard-Typography-Test.psd"), "installed workflow fixture evidence differs");
    check(appliedEvidence.length > 50000, "applied typography screenshot is missing or truncated");
    check(restoredEvidence.length > 50000, "Undo-restored screenshot is missing or truncated");
    check(appliedEvidence[0] === 0xff && appliedEvidence[1] === 0xd8, "applied evidence is not JPEG");
    check(restoredEvidence[0] === 0xff && restoredEvidence[1] === 0xd8, "restored evidence is not JPEG");
    check(packageJson.scripts.test.includes("npm run test:alb130"), "ALB-130 is absent from npm test");

    console.info(`PASS ALB-130: ${assertions} v1.2.0 release-candidate assertions`);
} catch (error) {
    console.error(`FAIL ALB-130: ${error.message}`);
    process.exitCode = 1;
}
