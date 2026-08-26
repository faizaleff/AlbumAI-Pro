#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const {
    discoverRecordPaths,
    parseIndexedRecordPaths,
    validateIndexedRecordPaths,
    verifyEngineeringRecordIndex
} = require("../scripts/verify-engineering-record-index");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const INDEX_PATH = path.join(REPOSITORY_ROOT, "ALB-116_ENGINEERING_RECORD_INDEX.md");
let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) throw new Error(message || "Assertion failed");
}

function expectCode(code, operation) {
    assertions += 1;
    try {
        operation();
    } catch (error) {
        if (error.code === code) return;
        throw new Error(`Expected ${code}, received ${error.code || error.message}`);
    }
    throw new Error(`Expected ${code} to be thrown`);
}

try {
    const records = discoverRecordPaths(REPOSITORY_ROOT);
    const indexedPaths = parseIndexedRecordPaths(fs.readFileSync(INDEX_PATH, "utf8"));
    const result = verifyEngineeringRecordIndex();

    check(records.length >= 52, "canonical engineering record inventory regressed");
    check(result.recordCount === records.length, "verified record count differs");
    check(indexedPaths.length === records.length, "index link count differs");
    [109, 110, 111, 112, 113, 114, 115, 118, 119, 120, 121, 122, 123, 124, 125].forEach((number) => {
        check(
            indexedPaths.some((record) => record.includes(`ALB-${number}`)),
            `ALB-${number} is not discoverable from the root index`
        );
    });

    expectCode("MISSING_RECORD", () => validateIndexedRecordPaths(
        records,
        indexedPaths.slice(1)
    ));
    expectCode("DUPLICATE_RECORD", () => validateIndexedRecordPaths(
        records,
        [...indexedPaths, indexedPaths[0]]
    ));
    expectCode("STALE_RECORD", () => validateIndexedRecordPaths(
        records,
        [...indexedPaths, "ALB-999_STALE.md"].sort()
    ));
    expectCode("OUT_OF_ORDER", () => validateIndexedRecordPaths(
        records,
        [indexedPaths[1], indexedPaths[0], ...indexedPaths.slice(2)]
    ));

    console.info(`PASS ALB-116: ${assertions} engineering record index assertions`);
} catch (error) {
    console.error(`FAIL ALB-116: ${error.message}`);
    process.exitCode = 1;
}
