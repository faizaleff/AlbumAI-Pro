#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PLUGIN_ROOT = path.join(PROJECT_ROOT, "plugin");
const EXPECTED_BUILD_ID = "ALB-130-v1.2.0-smart-typography-v1";
const RETIRED_BUILD_ID = "ALB-030.3-scroll-commit-timing-v1";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function walkFiles(rootPath, relativePath = "") {
    const directoryPath = path.join(rootPath, relativePath);
    return fs.readdirSync(directoryPath, { withFileTypes: true })
        .flatMap(entry => {
            const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
            return entry.isDirectory()
                ? walkFiles(rootPath, entryPath)
                : [entryPath];
        });
}

try {
    check(
        !fs.existsSync(path.join(PLUGIN_ROOT, "index.js")),
        "plugin/index.js must not compete with Webpack's generated dist/index.js"
    );

    const pluginFiles = walkFiles(PLUGIN_ROOT);
    check(
        pluginFiles.every(filePath => !filePath.endsWith(".js")),
        "plugin/ must contain static assets only"
    );

    const webpackConfig = require(path.join(PROJECT_ROOT, "webpack.config"))(
        {},
        { mode: "production" }
    );
    const copyPlugin = webpackConfig.plugins.find(
        plugin => plugin?.constructor?.name === "CopyPlugin"
    );
    check(Boolean(copyPlugin), "Webpack must retain the static plugin asset copy step");

    const pluginPattern = copyPlugin?.patterns?.find(pattern => pattern.from === "plugin");
    check(Boolean(pluginPattern), "Webpack must copy static assets from plugin/");
    check(
        pluginPattern.globOptions?.ignore?.includes("**/index.js"),
        "Webpack must explicitly reject JavaScript bundle input from plugin/"
    );

    const identitySource = fs.readFileSync(
        path.join(PROJECT_ROOT, "src/config/buildIdentity.js"),
        "utf8"
    );
    check(
        identitySource.includes(`"${EXPECTED_BUILD_ID}"`),
        "Source must expose the current runtime identity"
    );
    check(
        !identitySource.includes(RETIRED_BUILD_ID),
        "Source must not retain the retired ALB-030.3 runtime identity"
    );

    const entrySource = fs.readFileSync(
        path.join(PROJECT_ROOT, "src/index.jsx"),
        "utf8"
    );
    check(
        entrySource.includes("console.log(\"ALBUMAI_BUILD_ID\", ALBUMAI_BUILD_ID)"),
        "Runtime entrypoint must log the build identity used by Photoshop"
    );

    console.info(`PASS ALB-094: ${assertions} runtime bundle hygiene assertions`);
} catch (error) {
    console.error(`FAIL ALB-094: ${error.message}`);
    process.exitCode = 1;
}
