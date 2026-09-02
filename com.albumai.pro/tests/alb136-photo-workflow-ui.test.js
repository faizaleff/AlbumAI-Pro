#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const browser = read("src/components/PhotoBrowserSection.jsx");
const openFolder = read("src/components/OpenFolder.jsx");
const card = read("src/components/ThumbnailCard.jsx");
const grid = read("src/components/ThumbnailGrid.jsx");
const model = read("src/services/PhotoBrowserModel.js");
const styles = read("src/styles.css");
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

check(browser.includes("Library") && browser.includes("Sequence") && browser.includes("Album Selects"), "professional photo-stage names are missing");
check(browser.includes("Review the Library"), "Library review heading is missing");
check(browser.includes("Build the album sequence"), "Sequence heading is missing");
check(browser.includes("Review the final album selects"), "Album Selects review heading is missing");
check(browser.includes('key === "k"'), "Keep keyboard shortcut is missing");
check(browser.includes('key === "r" || key === "x"'), "Reject keyboard shortcut is missing");
check(browser.includes('["0", "1", "2", "3", "4", "5"]'), "0–5 rating shortcuts are missing");
check(browser.includes('["6", "7", "8"]'), "6–8 label shortcuts are missing");
check(browser.includes('e.key === "9"'), "9 clear-label shortcut is missing");
check(browser.includes("requested === 0 || current === requested ? 0 : requested"), "rating toggle/clear behavior is missing");
check(browser.includes("current === Number(e.key) ? 0 : Number(e.key)"), "color-label toggle behavior is missing");
check(browser.includes("ratingFilterActive: !(preferences.ratingFilterActive"), "rating comparator/filter toggle is missing");
check(browser.includes('value === 0 ? "Unrated"'), "Unrated filter must not display numeric zero");
check(!browser.includes('>0</button>'), "numeric zero is exposed as a rating-filter button");
check(browser.includes("quickPreviewPhoto") && browser.includes("photo-quick-preview"), "hold-Space preview is missing");
check(browser.includes("App.selection.toggle(next)"), "Ctrl/Cmd plus arrow additive selection is missing");
check(card.includes("photo-card-hover-controls"), "thumbnail hover controls are missing");
check(card.includes("photo-card-persistent-rating"), "persistent star marker is missing");
check(card.includes("colorLabel === value ? 0 : value"), "thumbnail label toggle is missing");
check(!card.includes("onContextMenu"), "complex thumbnail context menu remains connected");
check(grid.includes("Unrated"), "list view does not use the Unrated label");
check(model.includes('new Set(["exact", "above", "below"])'), "rating comparison model is missing");
check(model.includes("new Set([6, 7, 8])"), "approved color-label model is missing");
check(styles.includes(".photo-rating-label-filter"), "compact rating/label filter styling is missing");
check(styles.includes(".photo-quick-preview"), "quick-preview styling is missing");
check(browser.includes("photo-prep-sidebar"), "persistent photo-preparation left panel is missing");
check(browser.includes("Events") && browser.includes("Cameras") && browser.includes("Photo type") && browser.includes("Ratings & Labels"), "left-panel facet groups are incomplete");
check(browser.includes("selectedEventFilters") && browser.includes("selectedCameraFilters") && browser.includes("selectedPhotoKinds"), "dynamic left-panel filter state is incomplete");
check(browser.includes("click.ctrlKey || click.metaKey"), "multi-select facet behavior is missing");
check(browser.includes("Click again for all cameras") && browser.includes("Click again for all photos"), "repeat-click facet reset behavior is missing");
check(browser.includes("getCameraKey(photo)"), "camera filtering is not connected to photo metadata");
check(browser.includes("burstPhotoIds.has(photo.id)"), "burst/single filtering is not connected");
check(browser.includes("workflowPhotoCount"), "selected-photo workflow count is missing");
check(browser.includes("onRefreshPhotoFolder"), "photo-folder refresh control is missing");
check(openFolder.includes("async function refreshPhotoFolder()") && openFolder.includes("await App.refreshPhotos()"), "photo-folder refresh action is not connected");
check(styles.includes(".photo-prep-workspace") && styles.includes(".photo-facet-group"), "left-panel layout styling is missing");

console.info(`PASS ALB-136: Photos workflow UI (${assertions} assertions)`);
