#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
    inspectCcxPackage,
    inspectDistributionReadiness
} = require("./ccx-distribution");

function parseArguments(argumentsList) {
    if (!argumentsList.length) {
        return {};
    }
    if (argumentsList.length === 2 && argumentsList[0] === "--ccx") {
        return { ccxPath: path.resolve(argumentsList[1]) };
    }
    throw new Error("Usage: npm run distribution:verify -- [--ccx /absolute/path/to/plugin.ccx]");
}

try {
    const { ccxPath } = parseArguments(process.argv.slice(2));
    const readiness = inspectDistributionReadiness();
    const result = ccxPath
        ? inspectCcxPackage({ archiveBuffer: fs.readFileSync(ccxPath), readiness })
        : readiness;
    process.stdout.write(`PASS ALB-097: ${JSON.stringify(result)}\n`);
} catch (error) {
    console.error(`FAIL ALB-097: ${error.message}`);
    process.exitCode = 1;
}
