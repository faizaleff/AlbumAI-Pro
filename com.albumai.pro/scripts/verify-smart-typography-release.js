#!/usr/bin/env node

"use strict";

const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const MAX_BUNDLE_BYTES = 740 * 1024;
const MIN_BUNDLE_BYTES = 700 * 1024;
const SMART_TYPOGRAPHY_TICKETS = Object.freeze(
    Array.from({ length: 11 }, (_, index) => 118 + index)
);
const SMART_TYPOGRAPHY_RUNNERS = Object.freeze(
    SMART_TYPOGRAPHY_TICKETS.map(ticket => `node tests/run-alb${ticket}-tests.js`)
);
const REQUIRED_EVIDENCE_FILES = Object.freeze([
    "albumai-debug-log.txt",
    "albumai-summary.txt",
    "locked-layer-guidance.png",
    "locked-layer-runtime.png",
    "output-failure-photoshop.png",
    "output-failure-runtime.png",
    "sheet-5-after-reopen.png",
    "sheet-5-runtime.png",
    "sheet-6-after-reopen.png",
    "sheet-6-grouped-undo.png",
    "sheet-6-runtime.png",
    "stale-request-runtime.png",
    "typography-cancellation-runtime.png"
]);
const TEMPORARY_RUNTIME_MARKERS = Object.freeze([
    "__ALBUMAI_ALB128_",
    "ALB_128_STALE_SHEET_QUALIFICATION",
    "ALB_128_TYPOGRAPHY_CANCEL_QUALIFICATION"
]);

class SmartTypographyReleaseReadinessError extends Error {
    constructor(codes) {
        super(`Smart Typography release readiness failed: ${codes.join(", ")}`);
        this.name = "SmartTypographyReleaseReadinessError";
        this.codes = Object.freeze([...codes]);
    }
}

function canonicalJson(value) {
    if (Array.isArray(value)) return value.map(canonicalJson);
    if (value && typeof value === "object") {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = canonicalJson(value[key]);
            return result;
        }, {});
    }
    return value;
}

function exportedString(source, name) {
    return String(source || "").match(
        new RegExp(`export\\s+const\\s+${name}\\s*=\\s*[\\r\\n\\s]*[\"']([^\"']+)[\"']`)
    )?.[1] || null;
}

function evaluateSmartTypographyReadiness(input) {
    const errors = [];
    const add = code => {
        if (!errors.includes(code)) errors.push(code);
    };
    const scripts = input.packageJson?.scripts || {};
    const typographyCommand = scripts["test:smart-typography"] || "";
    const version = input.packageJson?.version;
    const buildId = exportedString(input.identitySource, "ALBUMAI_BUILD_ID");
    const runtimeRevision = exportedString(input.identitySource, "ALBUMAI_RUNTIME_REVISION_ID");

    if (!version || input.packageLock?.version !== version ||
        input.packageLock?.packages?.[""]?.version !== version) {
        add("PACKAGE_VERSION_MISMATCH");
    }
    if (input.sourceManifest?.version !== version || input.builtManifest?.version !== version) {
        add("MANIFEST_VERSION_MISMATCH");
    }
    if (JSON.stringify(canonicalJson(input.sourceManifest)) !==
        JSON.stringify(canonicalJson(input.builtManifest))) {
        add("SOURCE_DIST_MANIFEST_DRIFT");
    }
    if (input.sourceManifest?.id !== "com.albumai.pro" ||
        input.sourceManifest?.host?.app !== "PS") {
        add("PLUGIN_IDENTITY_MISMATCH");
    }
    if (input.sourceManifest?.requiredPermissions?.network !== undefined ||
        input.sourceManifest?.requiredPermissions?.launchProcess !== undefined) {
        add("NETWORK_OR_PROCESS_PERMISSION_NOT_ALLOWED");
    }

    SMART_TYPOGRAPHY_RUNNERS.forEach(command => {
        if (!typographyCommand.includes(command)) add("MISSING_TYPOGRAPHY_TEST");
    });
    if (!scripts.test?.includes("npm run test:smart-typography") ||
        !scripts.test?.includes("npm run test:alb129")) {
        add("CANONICAL_TEST_GATE_MISSING");
    }
    if (scripts["smart-typography:release:verify"] !==
        "node scripts/verify-smart-typography-release.js") {
        add("RELEASE_GATE_SCRIPT_MISMATCH");
    }

    if (!Buffer.isBuffer(input.bundle) || input.bundle.length < MIN_BUNDLE_BYTES ||
        input.bundle.length > MAX_BUNDLE_BYTES) {
        add("BUNDLE_SIZE_OUT_OF_BOUNDS");
    }
    if (!buildId || !runtimeRevision || !input.bundle?.includes(Buffer.from(buildId)) ||
        !input.bundle?.includes(Buffer.from(runtimeRevision))) {
        add("RUNTIME_PROVENANCE_MISMATCH");
    }

    const sourceCorpus = Object.values(input.sourceTexts || {}).join("\n");
    TEMPORARY_RUNTIME_MARKERS.forEach(marker => {
        if (sourceCorpus.includes(marker) || input.bundle?.includes(Buffer.from(marker))) {
            add("QUALIFICATION_HOOK_PRESENT");
        }
    });

    REQUIRED_EVIDENCE_FILES.forEach(fileName => {
        if (!Number.isFinite(input.evidenceSizes?.[fileName]) ||
            input.evidenceSizes[fileName] <= 0) {
            add("MISSING_RUNTIME_EVIDENCE");
        }
    });
    if (!String(input.qualificationMarkdown).includes("Status: delivered and runtime-qualified.")) {
        add("QUALIFICATION_STATUS_INCOMPLETE");
    }
    if (!String(input.summary).includes("Progress: 100%") ||
        !String(input.summary).includes("Cleanup Required: 1")) {
        add("SUMMARY_EVIDENCE_INCOMPLETE");
    }
    if (!String(input.debugLog).includes("Template export failed.") ||
        !String(input.debugLog).includes("CLEANUP_FAILED")) {
        add("DEBUG_EVIDENCE_INCOMPLETE");
    }

    if (errors.length) throw new SmartTypographyReleaseReadinessError(errors);

    const publishedVersionImmutable = input.gitTags?.includes(`v${version}`) || false;
    return Object.freeze({
        status: publishedVersionImmutable ? "READY_FOR_VERSION_BUMP" : "READY_FOR_RELEASE_CANDIDATE",
        smartTypographyRange: "ALB-118..ALB-128",
        suiteCount: SMART_TYPOGRAPHY_TICKETS.length,
        evidenceFileCount: REQUIRED_EVIDENCE_FILES.length,
        pluginId: input.sourceManifest.id,
        currentVersion: version,
        publishedVersionImmutable,
        nextAction: publishedVersionImmutable
            ? "SELECT_AND_APPLY_A_NEW_VERSION_BEFORE_PACKAGING"
            : "BUILD_AND_PACKAGE_RELEASE_CANDIDATE",
        bundleBytes: input.bundle.length,
        bundleBudgetBytes: MAX_BUNDLE_BYTES,
        bundleHeadroomBytes: MAX_BUNDLE_BYTES - input.bundle.length,
        buildId,
        runtimeRevision,
        networkPermission: false
    });
}

function walkSourceTexts(directoryPath, relativePrefix = "") {
    const result = {};
    for (const entry of fs.readdirSync(directoryPath, { withFileTypes: true })) {
        const relativePath = relativePrefix ? `${relativePrefix}/${entry.name}` : entry.name;
        const fullPath = path.join(directoryPath, entry.name);
        if (entry.isDirectory()) {
            Object.assign(result, walkSourceTexts(fullPath, relativePath));
        } else if (entry.isFile() && /\.(?:js|jsx)$/.test(entry.name)) {
            result[relativePath] = fs.readFileSync(fullPath, "utf8");
        }
    }
    return result;
}

function readGitTags() {
    try {
        return childProcess.execFileSync("git", ["tag", "-l"], {
            cwd: PROJECT_ROOT,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"]
        }).split(/\r?\n/).map(tag => tag.trim()).filter(Boolean);
    } catch (_) {
        return [];
    }
}

function readCurrentReadinessInputs(projectRoot = PROJECT_ROOT) {
    const read = relativePath => fs.readFileSync(path.join(projectRoot, relativePath));
    const readText = relativePath => read(relativePath).toString("utf8");
    const readJson = relativePath => JSON.parse(readText(relativePath));
    const evidenceRoot = path.join(projectRoot, "docs/evidence/alb-128");
    const evidenceSizes = Object.fromEntries(REQUIRED_EVIDENCE_FILES.map(fileName => {
        const filePath = path.join(evidenceRoot, fileName);
        return [fileName, fs.existsSync(filePath) ? fs.statSync(filePath).size : 0];
    }));

    return {
        packageJson: readJson("package.json"),
        packageLock: readJson("package-lock.json"),
        sourceManifest: readJson("plugin/manifest.json"),
        builtManifest: readJson("dist/manifest.json"),
        identitySource: readText("src/config/buildIdentity.js"),
        bundle: read("dist/index.js"),
        sourceTexts: walkSourceTexts(path.join(projectRoot, "src"), "src"),
        evidenceSizes,
        qualificationMarkdown: readText("docs/ALB-128_TYPOGRAPHY_MULTISHEET_STABILIZATION.md"),
        summary: readText("docs/evidence/alb-128/albumai-summary.txt"),
        debugLog: readText("docs/evidence/alb-128/albumai-debug-log.txt"),
        gitTags: readGitTags()
    };
}

function inspectSmartTypographyReleaseReadiness({ projectRoot = PROJECT_ROOT } = {}) {
    return evaluateSmartTypographyReadiness(readCurrentReadinessInputs(projectRoot));
}

if (require.main === module) {
    try {
        console.info(`PASS ALB-129: ${JSON.stringify(inspectSmartTypographyReleaseReadiness())}`);
    } catch (error) {
        console.error(`FAIL ALB-129: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    MAX_BUNDLE_BYTES,
    REQUIRED_EVIDENCE_FILES,
    SMART_TYPOGRAPHY_RUNNERS,
    SmartTypographyReleaseReadinessError,
    TEMPORARY_RUNTIME_MARKERS,
    evaluateSmartTypographyReadiness,
    inspectSmartTypographyReleaseReadiness,
    readCurrentReadinessInputs
};
