#!/usr/bin/env node

"use strict";

const { inspectMarketplaceReadiness } = require("./marketplace-readiness");

try {
    const result = inspectMarketplaceReadiness();
    console.info(`ALB-134 MARKETPLACE READINESS: ${JSON.stringify(result)}`);
    if (process.argv.includes("--require-ready") && result.status !== "READY_FOR_CONSOLE_DRAFT") {
        process.exitCode = 2;
    }
} catch (error) {
    console.error(`FAIL ALB-134: ${error.message}`);
    process.exitCode = 1;
}
