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
    const photoBrowser = readProjectFile("src/components/PhotoBrowserSection.jsx");
    const photoBrowserModel = readProjectFile("src/services/PhotoBrowserModel.js");
    const photoGroupingEngine = readProjectFile("src/services/PhotoGroupingEngine.js");
    const jpegRenderer = readProjectFile("src/services/SoftwareJpegRenderer.js");
    const projectService = readProjectFile("src/services/ProjectService.js");
    const thumbnailGrid = readProjectFile("src/components/ThumbnailGrid.jsx");
    const thumbnailCard = readProjectFile("src/components/ThumbnailCard.jsx");
    const panelController = readProjectFile("src/controllers/PanelController.jsx");
    const styles = readProjectFile("src/styles.css");
    const index = fs.readFileSync(
        path.join(REPOSITORY_ROOT, "ALB-116_ENGINEERING_RECORD_INDEX.md"),
        "utf8"
    );

    check(plan.includes("Status: **implementation in progress — Import/Sort/Cull started**"), "implementation status differs");
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
    check(plan.includes("CSS Grid box measured 0x0"), "UXP header-collapse diagnosis is missing");
    check(plan.includes("non-shrinking, wrapping flex layout"), "UXP header runtime fix is missing");
    check(plan.includes("panel document at **420x675**"), "live panel measurement evidence is missing");
    check(plan.includes("live 420-pixel Photoshop dock width"), "preferred-dock runtime evidence is missing");
    check(plan.includes("320x500 visual check remains environment-limited"), "minimum-dock runtime boundary is missing");
    check(plan.includes("900x700 visual check remains open"), "floating runtime boundary is missing");
    check(plan.includes("ALB-135.3 implementation progress"), "Import/Sort/Cull implementation record is missing");
    check(plan.includes("Persistent manual drag ordering"), "remaining Sort-workbench boundary is missing");
    check(plan.includes("six-photo REC005 fixture"), "Import/Sort/Cull runtime evidence is missing");
    check(plan.includes("Persistent manual story order"), "manual story-order implementation record is missing");
    check(plan.includes("path-free ordered list"), "manual order privacy boundary is missing");
    check(plan.includes("Multi-photo story moves and session undo"), "multi-photo order implementation record is missing");
    check(plan.includes("move all 6 together"), "multi-photo order runtime evidence is missing");
    check(photoBrowser.includes("secondaryFiltersOpen"), "secondary filter disclosure state is missing");
    check(photoBrowser.includes('aria-controls="photo-browser-secondary-filters"'), "secondary filter disclosure is not connected to its panel");
    check(photoBrowser.includes("Filters{secondaryFilterCount"), "active secondary filter count is missing");
    check(photoBrowser.includes('{ value: "manual", label: "Manual Order" }'), "manual order sort option is missing");
    check(photoBrowser.includes("onReorderPhoto={handleManualReorder}"), "manual drag reorder is not connected to the photo grid");
    check(photoBrowser.includes("Clear filters before editing the full story order."), "filtered manual-order guard is missing");
    check(photoBrowserModel.includes("normalizePhotoStoryOrder"), "manual story-order normalization is missing");
    check(photoBrowserModel.includes("movePhotosInStoryOrder"), "multi-photo story movement is missing");
    check(photoBrowser.includes("handleStoryOrderTravel"), "manual story-order undo/redo is missing");
    check(photoBrowser.includes("handleStoryOrderReset"), "manual story-order reset is missing");
    check(photoBrowser.includes("move all ${selectedCount} together"), "multi-photo move guidance is missing");
    check(projectService.includes('"photoStoryOrder"'), "project metadata validation omits manual story order");
    check(photoBrowser.includes("Align camera clocks"), "camera clock correction UI is missing");
    check(photoBrowser.includes("cameraClockOffsets"), "camera clock correction persistence is not connected");
    check(photoGroupingEngine.includes("normalizeCameraClockOffsets"), "camera correction normalization is missing");
    check(photoGroupingEngine.includes("applyCameraClockCorrections"), "camera correction projection is missing");
    check(jpegRenderer.includes("cameraMake"), "JPEG camera make extraction is missing");
    check(jpegRenderer.includes("cameraModel"), "JPEG camera model extraction is missing");
    check(projectService.includes('"cameraClockOffsets"'), "project metadata validation omits camera corrections");
    check(photoBrowser.includes("Event chapters"), "manual event chapter UI is missing");
    check(photoBrowser.includes("handleCreateEventChapter"), "manual event creation is not connected");
    check(photoBrowser.includes("handleRenameEventChapter"), "manual event rename is not connected");
    check(photoBrowser.includes("handleMoveEventChapter"), "manual event reorder is not connected");
    check(photoBrowserModel.includes("normalizePhotoEventChapters"), "manual event normalization is missing");
    check(photoBrowserModel.includes("assignPhotosToEventChapter"), "manual event photo assignment is missing");
    check(projectService.includes('"photoEventChapters"'), "project metadata validation omits manual events");
    check(plan.includes("Manual event chapters"), "manual event chapter implementation record is missing");
    check(plan.includes("Reception membership restored"), "manual event runtime persistence evidence is missing");
    check(thumbnailGrid.includes("handleReorderDrop"), "manual reorder drop routing is missing");
    check(thumbnailCard.includes("is-reorder-target"), "manual reorder target feedback is missing");
    check(styles.includes(".photo-filter-panel"), "secondary filter panel styling is missing");
    check(openFolder.includes("workspace-brand-mark"), "compact workspace brand mark is missing");
    check(openFolder.includes("Step {activeWizardStep.id} of {WIZARD_STEPS.length}"), "docked active-step context is missing");
    check(openFolder.includes("workspace-quick-btn workspace-quick-btn--primary"), "Save action hierarchy is missing");
    check(!openFolder.includes("<span>✨ AlbumAI Pro</span>"), "legacy emoji product title remains");
    check(!openFolder.includes("wizard-step-connector"), "legacy workflow connectors remain rendered");
    check(styles.includes(".workspace-top-bar {\n    display: flex;"), "UXP-safe workspace-shell flex layout is missing");
    check(styles.includes("flex: 0 0 auto;\n    flex-wrap: nowrap;"), "workspace header can collapse in the UXP flex root");
    check(!styles.includes("grid-template-columns: minmax(170px, auto) minmax(260px, 1fr) auto"), "unsupported workspace-shell grid remains");
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
