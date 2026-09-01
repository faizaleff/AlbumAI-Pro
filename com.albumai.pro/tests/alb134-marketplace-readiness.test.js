#!/usr/bin/env node

"use strict";

const assert = require("assert");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const {
    DISALLOWED_PLACEHOLDER_ICON_SHA256,
    evaluateMarketplaceReadiness,
    inspectMarketplaceReadiness,
    uniqueManifestIconPaths
} = require("../scripts/marketplace-readiness");

const PROJECT_ROOT = path.resolve(__dirname, "..");
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

function readyInput() {
    const manifest = {
        id: "com.albumai.pro",
        name: "AlbumAI Pro",
        version: "1.2.1",
        manifestVersion: 5,
        host: { app: "PS", minVersion: "24.0.0" },
        requiredPermissions: {},
        icons: [{ path: "icons/owned.png" }],
        entrypoints: [{ type: "panel", icons: [{ path: "icons/owned.png" }] }]
    };
    const evidence = (width, height, bytes = 1000, digest = "a".repeat(64)) => ({
        bytes,
        width,
        height,
        sha256: digest
    });
    return {
        config: {
            schemaVersion: 1,
            submissionTarget: "ADOBE_CREATIVE_CLOUD_MARKETPLACE",
            currentRelease: "1.2.0",
            targetVersion: "1.2.1",
            ccxFileName: "com.albumai.pro_PS.ccx",
            adobePluginIdConfirmed: true,
            publisherProfile: { approved: true, euTraderDecision: "EU_TRADER" },
            listing: {
                publicName: "AlbumAI Pro",
                subtitle: "Offline album workflow automation",
                supportEmail: "support@example.com",
                helpUrl: "https://example.com/help",
                description: "A complete English marketplace description.",
                languages: ["en"],
                categories: ["Productivity"],
                customTags: ["album"],
                privacyPolicyUrl: "https://example.com/privacy",
                termsOfServiceUrl: "https://example.com/terms",
                commerce: "FREE",
                requiresThirdPartyService: false,
                releaseNotes: "Marketplace identity and icon qualification."
            },
            packageIconReview: { ownershipConfirmed: true, adobeAssetUse: "NONE" },
            qualification: {
                targetCcxQualified: true,
                marketplaceRuntimeSmokePassed: true,
                consolePreviewApproved: false,
                submissionApproved: false,
                publicationMode: "MANUAL"
            }
        },
        packageJson: { version: "1.2.1" },
        packageLock: { version: "1.2.1", packages: { "": { version: "1.2.1" } } },
        sourceManifest: manifest,
        builtManifest: JSON.parse(JSON.stringify(manifest)),
        pluginIcons: [{ path: "icons/owned.png", evidence: evidence(32, 32) }],
        marketplaceIcons: [48, 96, 192].map(size => ({
            path: `marketplace/icon-${size}.png`,
            evidence: evidence(size, size)
        })),
        screenshots: [{ path: "marketplace/screenshot.png", evidence: evidence(1360, 800, 2000) }]
    };
}

try {
    const live = inspectMarketplaceReadiness();
    const config = JSON.parse(fs.readFileSync(
        path.join(PROJECT_ROOT, "marketplace/marketplace-readiness.json"),
        "utf8"
    ));
    const manifest = JSON.parse(fs.readFileSync(
        path.join(PROJECT_ROOT, "plugin/manifest.json"),
        "utf8"
    ));
    const plan = fs.readFileSync(
        path.join(PROJECT_ROOT, "docs/ALB-134_ADOBE_MARKETPLACE_READINESS.md"),
        "utf8"
    );

    check(live.status === "BLOCKED", "live Marketplace state must fail closed");
    check(live.currentVersion === "1.2.0", "published source version changed during audit");
    check(live.targetVersion === "1.2.1", "bounded Marketplace patch target differs");
    check(live.blockers.includes("TARGET_VERSION_NOT_APPLIED"), "version boundary blocker missing");
    check(live.blockers.includes("ADOBE_PLUGIN_ID_NOT_CONFIRMED"), "Console ID blocker missing");
    check(live.blockers.includes("PUBLISHER_PROFILE_NOT_APPROVED"), "publisher blocker missing");
    check(live.blockers.includes("EU_TRADER_DECISION_MISSING"), "trader decision blocker missing");
    check(live.blockers.includes("PLUGIN_ICON_PLACEHOLDER_OR_MISSING"), "placeholder blocker missing");
    check(live.blockers.includes("MARKETPLACE_ICONS_INVALID"), "listing icon blocker missing");
    check(live.blockers.includes("SCREENSHOTS_INVALID"), "screenshot blocker missing");
    check(live.blockers.includes("PRIVACY_POLICY_URL_MISSING"), "privacy blocker missing");
    check(live.blockers.includes("TERMS_OF_SERVICE_URL_MISSING"), "terms blocker missing");
    check(live.blockers.includes("TARGET_CCX_NOT_QUALIFIED"), "CCX blocker missing");
    check(live.blockers.includes("MARKETPLACE_RUNTIME_SMOKE_MISSING"), "runtime blocker missing");
    check(live.submissionApproved === false, "submission approval must default false");
    check(config.qualification.publicationMode === "MANUAL", "manual publication boundary differs");
    check(config.qualification.submissionApproved === false, "submission is incorrectly approved");
    check(manifest.version === "1.2.0", "ALB-134.1 must not mutate the manifest version");
    check(uniqueManifestIconPaths(manifest).length === 2, "manifest icon inventory differs");
    check(DISALLOWED_PLACEHOLDER_ICON_SHA256.size === 4, "placeholder digest set differs");
    check(plan.includes("selects **`v1.2.1`**"), "version decision is missing");
    check(plan.includes("No Adobe upload, draft creation, submission, or publication"), "external safety boundary missing");
    check(plan.includes("official-requirement audit") || plan.includes("Official requirements reviewed"), "official audit missing");

    const requiredGate = childProcess.spawnSync(
        process.execPath,
        [path.join(PROJECT_ROOT, "scripts/verify-marketplace-readiness.js"), "--require-ready"],
        { encoding: "utf8" }
    );
    check(requiredGate.status === 2, "required gate does not fail while blockers remain");

    const ready = evaluateMarketplaceReadiness(readyInput());
    check(ready.status === "READY_FOR_CONSOLE_DRAFT", "complete evidence is not ready for draft");
    check(ready.blockerCount === 0, "complete evidence retains blockers");
    check(ready.submissionApproved === false, "draft readiness must not imply submission approval");
    check(ready.nextAction === "CREATE_AND_REVIEW_ADOBE_CONSOLE_DRAFT", "ready next action differs");

    const unsafe = readyInput();
    unsafe.config.ccxFileName = "AlbumAI-Pro-1.2.1-marketplace-package.ccx";
    unsafe.pluginIcons[0].evidence.sha256 = [...DISALLOWED_PLACEHOLDER_ICON_SHA256][0];
    const unsafeResult = evaluateMarketplaceReadiness(unsafe);
    check(unsafeResult.blockers.includes("CCX_FILENAME_INVALID"), "versioned CCX filename is accepted");
    check(unsafeResult.blockers.includes("PLUGIN_ICON_PLACEHOLDER_OR_MISSING"), "sample icon is accepted");

    console.info(`PASS ALB-134: ${assertions} Marketplace readiness assertions`);
} catch (error) {
    console.error(`FAIL ALB-134: ${error.message}`);
    process.exitCode = 1;
}
