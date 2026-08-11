#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const policy = JSON.parse(fs.readFileSync(path.join(root, "Architecture", "ALB-052_HARDENING_POLICY.json"), "utf8"));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
const testSource = fs.readFileSync(path.join(root, policy.testEntry), "utf8");
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

function source(file) {
    const target = path.join(root, file);
    check(fs.existsSync(target), `Missing ALB-052 source: ${file}.`);
    return fs.readFileSync(target, "utf8");
}

function main() {
    check(policy.schemaVersion === 1, "Unsupported ALB-052 policy schema.");
    check(policy.ticket === "ALB-052", "Hardening policy ticket mismatch.");
    check(packageJson.scripts.test.includes("run-alb052-product-hardening-tests.js"), "ALB-052 suite is not in npm test.");
    check(Array.isArray(policy.criteria) && policy.criteria.length === 6, "ALB-052 criteria inventory changed.");

    const ids = new Set();
    policy.criteria.forEach(criterion => {
        check(Boolean(criterion.id) && !ids.has(criterion.id), "ALB-052 criterion ids must be unique.");
        ids.add(criterion.id);
        check(criterion.status.includes("PASS"), `${criterion.id} has no passing automated status.`);
        check(Array.isArray(criterion.sources) && criterion.sources.length > 0, `${criterion.id} has no sources.`);
        check(Array.isArray(criterion.evidence) && criterion.evidence.length > 0, `${criterion.id} has no evidence.`);
        criterion.sources.forEach(source);
        criterion.evidence.forEach(name => check(testSource.includes(name) || name === "project executor releases a template after terminal failure",
            `${criterion.id} references missing evidence: ${name}.`));
    });

    check(policy.duplicateGuardAudit.length === 6, "Duplicate-action audit is incomplete.");
    policy.duplicateGuardAudit.forEach(item => {
        check(item.status === "PASS", `Duplicate-action guard is not closed: ${item.action}.`);
        check(Boolean(item.guard), `Duplicate-action guard is undocumented: ${item.action}.`);
    });

    const runtime = new Map(policy.runtimeBoundary.map(item => [item.id, item]));
    check(runtime.get("ALB-045-RT-03")?.status === "HARNESS_PASS_RUNTIME_NOT_REPEATED", "RT-03 boundary changed.");
    check(runtime.get("ALB-045-RT-03")?.reason.includes("Do not manufacture unsafe"), "RT-03 safety reason is missing.");
    check(runtime.get("ALB-051-RT-01")?.status === "PASS_ALB_053", "Core runtime scenario is not qualified by ALB-053.");
    check(runtime.get("ALB-051-RT-02")?.status === "PASS_ALB_053", "Cleanup runtime scenario is not qualified by ALB-053.");

    const release = new Map(policy.releaseChecklist.map(item => [item.id, item.status]));
    ["AUTOMATED_SUITE", "PRODUCTION_BUILD", "REPRODUCIBLE_PACKAGE"].forEach(id =>
        check(release.get(id) === "PASS_ALB_052", `${id} is not closed for ALB-052.`));
    check(release.get("PHOTOSHOP_REGRESSION") === "PASS_ALB_053", "Photoshop regression is not qualified by ALB-053.");
    check(release.get("VERSION_CHANGELOG_NOTES_TAG") === "READY_FOR_COMMIT_AND_TAG", "Release metadata is not ready for commit and tag.");
    check(release.get("CLEAN_RELEASE_TREE") === "READY_AFTER_COMMIT", "Clean release tree boundary changed.");

    const projectService = source("src/services/ProjectService.js");
    const recovery = source("src/project/BatchRecoverySnapshot.js");
    const reader = source("src/services/TemplateDocumentReader.js");
    const autoSave = source("src/services/TemplateAutoSaveService.js");
    const exportService = source("src/services/TemplateExportService.js");
    check(projectService.includes("PROJECT_SCHEMA_INCOMPATIBLE"), "Newer project schema protection is missing.");
    check(recovery.includes("validatePersisted"), "Recovery schema validation is missing.");
    check(reader.includes("TEMPLATE_READ_CLEANUP_FAILED"), "PSD cleanup remediation is missing.");
    check(autoSave.includes("this.inFlight = new Map()"), "Auto Save in-flight guard is missing.");
    check(exportService.includes("this.inFlight = new Map()"), "Export in-flight guard is missing.");

    console.info(`ALB-052 hardening verification: PASS (${assertions} assertions)`);
}

main();
