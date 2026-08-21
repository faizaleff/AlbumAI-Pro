#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { createDeterministicZip, DIST_FILES } = require("../scripts/release-package");
const {
    EXPECTED_BUILD_ID,
    inspectCcxPackage,
    inspectDistributionReadiness,
    readZipEntries,
    validateDistributionInputs
} = require("../scripts/ccx-distribution");

const PROJECT_ROOT = path.resolve(__dirname, "..");
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

function readJson(relativePath) {
    return JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, relativePath), "utf8"));
}

function currentInputs() {
    return {
        packageJson: readJson("package.json"),
        packageLock: readJson("package-lock.json"),
        sourceManifest: readJson("plugin/manifest.json"),
        builtManifest: readJson("dist/manifest.json"),
        distFiles: [...DIST_FILES],
        indexHtml: fs.readFileSync(path.join(PROJECT_ROOT, "dist/index.html"), "utf8"),
        runtimeBundle: fs.readFileSync(path.join(PROJECT_ROOT, "dist/index.js"))
    };
}

try {
    const packageJson = readJson("package.json");
    const readiness = inspectDistributionReadiness();
    check(readiness.status === "READY_FOR_UDT_PACKAGE", "dist is not ready for UDT packaging");
    check(readiness.pluginId === "com.albumai.pro", "direct distribution ID differs");
    check(readiness.pluginVersion === packageJson.version, "distribution version differs from package.json");
    check(readiness.hostApp === "PS", "CCX must target Photoshop only");
    check(readiness.manifestVersion === 5, "CCX must use manifest v5");
    check(readiness.networkPermission === false, "direct package must remain network-free");
    check(readiness.distFileCount === 8, "qualified dist inventory differs");
    check(readiness.runtimeBuildId === EXPECTED_BUILD_ID, "runtime identity differs");
    check(readiness.runtimeBundleSize > 700000, "runtime bundle unexpectedly fell below the qualified budget floor");
    check(
        /^[a-f0-9]{64}$/.test(readiness.runtimeBundleSha256),
        "runtime bundle checksum is invalid"
    );

    const hostArrayInputs = currentInputs();
    hostArrayInputs.sourceManifest.host = [hostArrayInputs.sourceManifest.host];
    assert.throws(() => validateDistributionInputs(hostArrayInputs), /SINGLE_PHOTOSHOP_HOST_REQUIRED/);
    assertions += 1;

    const networkInputs = currentInputs();
    networkInputs.sourceManifest.requiredPermissions.network = { domains: ["https://example.com"] };
    assert.throws(() => validateDistributionInputs(networkInputs), /NETWORK_PERMISSION_NOT_ALLOWED/);
    assertions += 1;

    const extraFileInputs = currentInputs();
    extraFileInputs.distFiles.push("debug.log");
    assert.throws(() => validateDistributionInputs(extraFileInputs), /DIST_INVENTORY_MISMATCH/);
    assertions += 1;

    const entries = DIST_FILES.map(relativePath => ({
        path: relativePath,
        content: fs.readFileSync(path.join(PROJECT_ROOT, "dist", relativePath))
    }));
    const syntheticCcx = createDeterministicZip(entries);
    check(readZipEntries(syntheticCcx).size === DIST_FILES.length, "CCX ZIP reader loses entries");

    const verified = inspectCcxPackage({ archiveBuffer: syntheticCcx, readiness });
    check(verified.status === "CCX_VERIFIED", "qualified CCX is not accepted");
    check(verified.fileCount === 8, "verified CCX inventory differs");
    check(verified.runtimeBundleSha256 === readiness.runtimeBundleSha256, "CCX runtime checksum differs");

    const unsafeCcx = createDeterministicZip([
        ...entries,
        { path: "src/index.jsx", content: Buffer.from("unsafe", "utf8") }
    ]);
    assert.throws(() => inspectCcxPackage({ archiveBuffer: unsafeCcx, readiness }), /CCX inventory mismatch/);
    assertions += 1;

    const docs = fs.readFileSync(
        path.resolve(PROJECT_ROOT, "../ALB-097_DIRECT_CCX_DISTRIBUTION.md"),
        "utf8"
    );
    check(/UXP Developer Tool\s+`Package` action/.test(docs), "Adobe packaging boundary is missing");
    check(docs.includes("Marketplace ID is not approved"), "Marketplace identity gate is missing");
    check(docs.includes("--ccx /absolute/path/to/AlbumAI-Pro.ccx"), "CCX verification command is missing");
    check(docs.includes("DIRECT CCX QUALIFIED — PACKAGE, INSTALL, AND STARTUP PASS"), "CCX qualification status is stale");
    check(docs.includes("0befdef555f24082cb0b041bb2877845440641920be0301b883fef0c3cb1c6d8"), "qualified CCX checksum is missing");
    check(docs.includes("Installed package runtime: **PASS**"), "installed runtime evidence is missing");
    check(docs.includes("photo folder after reinstall"), "folder reauthorization boundary is missing");

    const readme = fs.readFileSync(path.join(PROJECT_ROOT, "README.md"), "utf8");
    const testBoundary = readme.match(/ALB-043 through ALB-(\d+)/);
    check(Boolean(testBoundary) && Number(testBoundary[1]) >= 97, "README test boundary regressed below ALB-097");
    check(readme.includes("ALB-097 qualified a UXP Developer Tool-generated CCX"), "README distribution status is stale");

    const roadmap = fs.readFileSync(path.join(PROJECT_ROOT, "docs/ROADMAP.md"), "utf8");
    check(roadmap.includes("delivered and runtime-qualified"), "roadmap distribution status is stale");

    const buildIdentity = fs.readFileSync(
        path.join(PROJECT_ROOT, "src/config/buildIdentity.js"),
        "utf8"
    );
    const openFolder = fs.readFileSync(
        path.join(PROJECT_ROOT, "src/components/OpenFolder.jsx"),
        "utf8"
    );
    check(
        buildIdentity.includes(`ALBUMAI_VERSION =\n    "${packageJson.version}"`),
        "display version differs from package version"
    );
    check(openFolder.includes('import { ALBUMAI_VERSION } from "../config/buildIdentity"'), "panel does not consume release identity");
    check(!openFolder.includes("v1.0.1"), "panel retains the stale v1.0.1 badge");
    check(openFolder.includes("`v${ALBUMAI_VERSION}`"), "workspace badge is not release-driven");
    check(openFolder.includes("v{ALBUMAI_VERSION}"), "welcome badge is not release-driven");

    check(packageJson.scripts["distribution:verify"] === "node scripts/verify-direct-distribution.js", "distribution verifier script differs");
    check(packageJson.scripts["verify:ci"].includes("npm run distribution:verify"), "CI does not enforce distribution readiness");
    check(packageJson.scripts.test.includes("alb097-direct-distribution.test.js"), "ALB-097 is absent from npm test");

    console.info(`PASS ALB-097: ${assertions} direct distribution assertions`);
} catch (error) {
    console.error(`FAIL ALB-097: ${error.message}`);
    process.exitCode = 1;
}
