const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = relativePath => fs.readFileSync(path.join(root, relativePath), "utf8");
const dropdownSource = read("src/components/UxpDropdown.jsx");
const packageJson = JSON.parse(read("package.json"));
const RUNTIME_REVISION_ID = "ALB-107-picker-deprecation-migration-v1";
const qualification = fs.readFileSync(
    path.resolve(root, "../ALB-107_PICKER_DEPRECATION_MIGRATION.md"),
    "utf8"
);
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    assert(condition, message);
}

try {
    check(dropdownSource.includes("<sp-picker"), "shared selector does not render sp-picker");
    check(dropdownSource.includes("</sp-picker>"), "shared selector does not close sp-picker");
    check(!dropdownSource.includes("sp-dropdown"), "deprecated sp-dropdown remains in shared selector");
    check(dropdownSource.includes('<sp-menu slot="options">'), "picker option menu contract changed");
    check(dropdownSource.includes("dropdown.selectedIndex = selectedIndex"), "controlled selection sync changed");
    check(dropdownSource.includes('addEventListener("change", handleChange)'), "picker change handling changed");
    check(dropdownSource.includes("onValueChange(selectedOption.value)"), "picker value mapping changed");
    check(dropdownSource.includes("disabled={disabled || undefined}"), "picker disabled behavior changed");
    check(dropdownSource.includes("event.stopPropagation()"), "optional click isolation changed");
    check(qualification.includes(RUNTIME_REVISION_ID), "ALB-107 runtime revision evidence is missing");
    check(qualification.includes("Runtime acceptance: PASS"), "ALB-107 runtime acceptance evidence is missing");
    check(packageJson.scripts.test.includes("alb107-picker-deprecation-migration.test.js"), "ALB-107 regression test is not in npm test");

    console.info(`PASS ALB-107: ${assertions} picker migration assertions`);
} catch (error) {
    console.error(`FAIL ALB-107: ${error.message}`);
    process.exitCode = 1;
}
