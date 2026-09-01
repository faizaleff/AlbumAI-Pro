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
    const plan = readProjectFile("docs/ALB-135_PRODUCT_UI_FINALIZATION.md");
    const marketplacePlan = readProjectFile("docs/ALB-134_ADOBE_MARKETPLACE_READINESS.md");
    const supportPlan = readProjectFile("marketplace/SUPPORT_LEGAL_AND_MEDIA_PLAN.md");
    const roadmap = readProjectFile("docs/ROADMAP.md");
    const readme = readProjectFile("README.md");
    const packageJson = JSON.parse(readProjectFile("package.json"));
    const identity = readProjectFile("src/config/buildIdentity.js");
    const openFolder = readProjectFile("src/components/OpenFolder.jsx");
    const panelController = readProjectFile("src/controllers/PanelController.jsx");
    const styles = readProjectFile("src/styles.css");
    const index = fs.readFileSync(
        path.join(REPOSITORY_ROOT, "ALB-116_ENGINEERING_RECORD_INDEX.md"),
        "utf8"
    );

    check(plan.includes("Status: **implementation in progress — workspace shell started**"), "implementation status differs");
    check(plan.includes("P0 — runtime entry and panel visibility"), "runtime visibility priority is missing");
    check(plan.includes("Developer/diagnostic actions compete"), "Design action-hierarchy finding is missing");
    check(plan.includes("Minimum dock | 320x500"), "minimum-dock acceptance is missing");
    check(plan.includes("Preferred dock | 420x800"), "preferred-dock acceptance is missing");
    check(plan.includes("Preferred floating | 900x700"), "floating acceptance is missing");
    check(plan.includes("Marketplace review | 1360x800"), "Marketplace-size acceptance is missing");
    check(plan.includes("ALB-135.2 — workspace shell"), "next implementation slice is missing");
    check(plan.includes("ALB-135.5 — responsive runtime qualification"), "runtime qualification slice is missing");
    check(plan.includes("Import → Sort → Cull → Enhance → Design → Export"), "approved workflow foundation is missing");
    check(plan.includes("per-camera clock offsets"), "multi-camera clock correction provision is missing");
    check(plan.includes("bride/groom and\n  outfit continuity"), "future visual story evidence is missing");
    check(plan.includes("cover, wrapper, index, story spreads"), "future album-structure provision is missing");
    check(plan.includes("Approved PSD templates remain the deterministic design source"), "template fallback boundary is missing");
    check(plan.includes("capability-gated by ALB-070"), "future AI gate boundary is missing");
    check(plan.includes("ALB-135.2 implementation progress"), "workspace-shell implementation record is missing");
    check(plan.includes("Plugin Reload Successful"), "updated-bundle reload evidence is missing");
    check(plan.includes("Plugin Load Successful"), "clean plugin-load evidence is missing");
    check(plan.includes("900x700\npanel document"), "runtime panel-mount evidence is missing");
    check(plan.includes("Reset Essentials"), "workspace-reset evidence is missing");
    check(plan.includes("expanding that collapsed dock surfaced"), "visible panel evidence is missing");
    check(plan.includes("ALB-135.2 remains open only for inspecting"), "remaining runtime acceptance boundary is missing");
    check(openFolder.includes("workspace-brand-mark"), "compact workspace brand mark is missing");
    check(openFolder.includes("Step {activeWizardStep.id} of {WIZARD_STEPS.length}"), "docked active-step context is missing");
    check(openFolder.includes("workspace-quick-btn workspace-quick-btn--primary"), "Save action hierarchy is missing");
    check(!openFolder.includes("<span>✨ AlbumAI Pro</span>"), "legacy emoji product title remains");
    check(!openFolder.includes("wizard-step-connector"), "legacy workflow connectors remain rendered");
    check(styles.includes("grid-template-columns: minmax(170px, auto) minmax(260px, 1fr) auto"), "workspace-shell grid is missing");
    check(styles.includes(".workspace-step-context"), "responsive active-step styling is missing");
    check(styles.includes(".workspace-quick-btn--primary"), "primary header action styling is missing");
    check(panelController.includes("create(rootNode)"), "Manifest v5 panel create signature is missing");
    check(panelController.includes("rootNode.appendChild(this[_root])"), "panel content is not attached during create");
    check(panelController.includes("show(rootNode)"), "Manifest v5 panel show signature is missing");
    check(panelController.includes("ReactDOM.unmountComponentAtNode"), "panel destroy does not release the React root");
    check(plan.includes("No permanent logo decision and no final Marketplace screenshots"), "visual-asset boundary is missing");
    check(marketplacePlan.includes("Final screenshot capture is explicitly\ndeferred"), "ALB-134 screenshot boundary changed");
    check(supportPlan.includes("temporary Option 3 icon remains candidate-test artwork only"), "temporary-icon boundary changed");
    check(packageJson.version === "1.2.1", "UI planning changed the candidate version");
    check(identity.includes("ALB-134-v1.2.1-marketplace-candidate-v1"), "UI planning changed runtime identity");
    check(packageJson.scripts["test:alb135"] === "node tests/run-alb135-tests.js", "ALB-135 script differs");
    check(packageJson.scripts.test.includes("npm run test:alb135"), "ALB-135 is absent from npm test");
    check(roadmap.includes("Product UI finalization — ALB-135 audit complete"), "roadmap UI milestone is missing");
    check(readme.includes("ALB-135 starts product UI finalization"), "README UI milestone is missing");
    check(index.includes("ALB-135_PRODUCT_UI_FINALIZATION.md"), "engineering index omits ALB-135");

    console.info(`PASS ALB-135: ${assertions} product UI finalization assertions`);
} catch (error) {
    console.error(`FAIL ALB-135: ${error.message}`);
    process.exitCode = 1;
}
