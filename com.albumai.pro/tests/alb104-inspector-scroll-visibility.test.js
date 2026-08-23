const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const stylesSource = fs.readFileSync(path.join(root, "src", "styles.css"), "utf8");
const previewPanelSource = fs.readFileSync(path.join(root, "src", "components", "PreviewPanel.jsx"), "utf8");

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message);
}

const previewPanelRule = stylesSource.match(/\.album-preview-panel\s*\{([^}]*)\}/)?.[1] || "";
const executionViewportRule = stylesSource.match(/\.album-preview-panel\s+\[data-execution-log-viewport="true"\]\s*\{([^}]*)\}/)?.[1] || "";

check(previewPanelRule.includes("display: flex"), "Inspector parent remains a flex container");
check(previewPanelRule.includes("flex-direction: column"), "Inspector parent stacks preview and diagnostics vertically");
check(previewPanelRule.includes("min-height: 0"), "Inspector parent may shrink inside the workspace");
check(previewPanelRule.includes("overflow: hidden"), "Inspector parent bounds the inner scroll viewport");
check(previewPanelSource.includes('data-execution-log-viewport="true"'), "Execution log viewport marker remains present");
check(previewPanelSource.includes('overflowY: "auto"'), "Execution log viewport remains vertically scrollable");
check(previewPanelSource.includes("minHeight: 0"), "Execution log viewport may shrink before scrolling");
check(executionViewportRule.includes("scrollbar-color: #686868 #252525"), "Execution log uses a visible scrollbar contrast");
check(executionViewportRule.includes("scrollbar-width: auto"), "Execution log scrollbar is not hidden or thinned");
check(!executionViewportRule.includes("scrollbar-width: none"), "Execution log scrollbar is never suppressed");

console.log(`ALB-104 inspector scroll visibility tests passed (${assertions} assertions).`);
