#!/usr/bin/env node

"use strict";

const assert = require("assert");
const {
    MAX_BUNDLE_BYTES,
    SmartTypographyReleaseReadinessError,
    evaluateSmartTypographyReadiness,
    inspectSmartTypographyReleaseReadiness,
    readCurrentReadinessInputs
} = require("../scripts/verify-smart-typography-release");

let assertions = 0;
const check = (condition, message) => {
    assertions += 1;
    assert(condition, message);
};
const expectCode = (input, code) => {
    assertions += 1;
    assert.throws(
        () => evaluateSmartTypographyReadiness(input),
        error => error instanceof SmartTypographyReleaseReadinessError && error.codes.includes(code),
        `Expected ${code}`
    );
};
const clone = input => ({
    ...input,
    packageJson: JSON.parse(JSON.stringify(input.packageJson)),
    packageLock: JSON.parse(JSON.stringify(input.packageLock)),
    sourceManifest: JSON.parse(JSON.stringify(input.sourceManifest)),
    builtManifest: JSON.parse(JSON.stringify(input.builtManifest)),
    sourceTexts: { ...input.sourceTexts },
    evidenceSizes: { ...input.evidenceSizes },
    bundle: Buffer.from(input.bundle),
    gitTags: [...input.gitTags]
});

const live = inspectSmartTypographyReleaseReadiness();
check(live.status === "READY_FOR_VERSION_BUMP", "published v1.2.0 must require a new version");
check(live.smartTypographyRange === "ALB-118..ALB-128", "typography range differs");
check(live.suiteCount === 11, "typography suite count differs");
check(live.evidenceFileCount === 13, "runtime evidence count differs");
check(live.publishedVersionImmutable === true, "published version must be immutable");
check(live.nextAction === "SELECT_AND_APPLY_A_NEW_VERSION_BEFORE_PACKAGING", "next action differs");
check(live.bundleBytes <= MAX_BUNDLE_BYTES, "bundle exceeds the release ceiling");
check(live.bundleHeadroomBytes >= 0, "bundle headroom is negative");
check(live.networkPermission === false, "release gate introduced network access");

const current = readCurrentReadinessInputs();

const historicalCandidate = clone(current);
historicalCandidate.gitTags = historicalCandidate.gitTags.filter(tag => tag !== "v1.2.0");
const candidateResult = evaluateSmartTypographyReadiness(historicalCandidate);
check(candidateResult.status === "READY_FOR_RELEASE_CANDIDATE", "prepublication candidate state changed");
check(candidateResult.publishedVersionImmutable === false, "prepublication candidate is incorrectly immutable");

const network = clone(current);
network.sourceManifest.requiredPermissions.network = { domains: ["https://example.com"] };
network.builtManifest.requiredPermissions.network = { domains: ["https://example.com"] };
expectCode(network, "NETWORK_OR_PROCESS_PERMISSION_NOT_ALLOWED");

const missingEvidence = clone(current);
missingEvidence.evidenceSizes["albumai-summary.txt"] = 0;
expectCode(missingEvidence, "MISSING_RUNTIME_EVIDENCE");

const hook = clone(current);
hook.sourceTexts["src/index.jsx"] += "\n__ALBUMAI_ALB128_TEMPORARY__";
expectCode(hook, "QUALIFICATION_HOOK_PRESENT");

const missingSuite = clone(current);
missingSuite.packageJson.scripts["test:smart-typography"] = "node tests/run-alb128-tests.js";
expectCode(missingSuite, "MISSING_TYPOGRAPHY_TEST");

const oversized = clone(current);
oversized.bundle = Buffer.concat([
    oversized.bundle,
    Buffer.alloc(MAX_BUNDLE_BYTES - oversized.bundle.length + 1)
]);
expectCode(oversized, "BUNDLE_SIZE_OUT_OF_BOUNDS");

const staleManifest = clone(current);
staleManifest.builtManifest.version = "0.0.0";
expectCode(staleManifest, "MANIFEST_VERSION_MISMATCH");

console.info(`PASS ALB-129: ${assertions} Smart Typography release-readiness assertions`);
