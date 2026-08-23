#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const REPOSITORY_ROOT = path.resolve(PROJECT_ROOT, "..");
const INDEX_FILENAME = "ALB-116_ENGINEERING_RECORD_INDEX.md";
const INDEX_PATH = path.join(REPOSITORY_ROOT, INDEX_FILENAME);
const RECORD_PATTERN = /^ALB-(\d{3})(?:[-_].+)?\.md$/;

class EngineeringRecordIndexError extends Error {
    constructor(code, message) {
        super(message);
        this.name = "EngineeringRecordIndexError";
        this.code = code;
    }
}

function recordNumber(relativePath) {
    const match = path.basename(relativePath).match(RECORD_PATTERN);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function compareRecordPaths(left, right) {
    return recordNumber(left) - recordNumber(right) || left.localeCompare(right);
}

function listRecordFiles(directoryPath, relativePrefix = "") {
    if (!fs.existsSync(directoryPath)) return [];
    return fs.readdirSync(directoryPath, { withFileTypes: true })
        .filter((entry) => (
            entry.isFile()
            && RECORD_PATTERN.test(entry.name)
            && entry.name !== INDEX_FILENAME
        ))
        .map((entry) => path.posix.join(relativePrefix, entry.name));
}

function discoverRecordPaths(repositoryRoot = REPOSITORY_ROOT) {
    return [
        ...listRecordFiles(repositoryRoot),
        ...listRecordFiles(
            path.join(repositoryRoot, "com.albumai.pro", "docs"),
            "com.albumai.pro/docs"
        )
    ].sort(compareRecordPaths);
}

function parseIndexedRecordPaths(markdown) {
    const paths = [];
    const linkPattern = /\[[^\]]+\]\(([^)]+)\)/g;
    let match;
    while ((match = linkPattern.exec(markdown)) !== null) {
        const target = match[1];
        if (RECORD_PATTERN.test(path.posix.basename(target))) paths.push(target);
    }
    return paths;
}

function findDuplicates(values) {
    const seen = new Set();
    const duplicates = new Set();
    values.forEach((value) => {
        if (seen.has(value)) duplicates.add(value);
        seen.add(value);
    });
    return [...duplicates].sort(compareRecordPaths);
}

function validateIndexedRecordPaths(records, indexedPaths) {
    const duplicates = findDuplicates(indexedPaths);
    if (duplicates.length > 0) {
        throw new EngineeringRecordIndexError(
            "DUPLICATE_RECORD",
            `Duplicate engineering record links: ${duplicates.join(", ")}`
        );
    }

    const recordSet = new Set(records);
    const indexedSet = new Set(indexedPaths);
    const missing = records.filter((record) => !indexedSet.has(record));
    if (missing.length > 0) {
        throw new EngineeringRecordIndexError(
            "MISSING_RECORD",
            `Engineering records absent from the index: ${missing.join(", ")}`
        );
    }

    const stale = indexedPaths.filter((record) => !recordSet.has(record));
    if (stale.length > 0) {
        throw new EngineeringRecordIndexError(
            "STALE_RECORD",
            `Index links without a canonical record: ${stale.join(", ")}`
        );
    }

    const ordered = [...indexedPaths].sort(compareRecordPaths);
    if (indexedPaths.some((record, index) => record !== ordered[index])) {
        throw new EngineeringRecordIndexError(
            "OUT_OF_ORDER",
            "Engineering record links must be ordered by ALB number and path."
        );
    }

    return { recordCount: records.length };
}

function verifyEngineeringRecordIndex({
    repositoryRoot = REPOSITORY_ROOT,
    indexPath = INDEX_PATH
} = {}) {
    if (!fs.existsSync(indexPath)) {
        throw new EngineeringRecordIndexError(
            "INDEX_MISSING",
            `Engineering record index not found: ${indexPath}`
        );
    }
    const records = discoverRecordPaths(repositoryRoot);
    const indexedPaths = parseIndexedRecordPaths(fs.readFileSync(indexPath, "utf8"));
    return validateIndexedRecordPaths(records, indexedPaths);
}

if (require.main === module) {
    try {
        const result = verifyEngineeringRecordIndex();
        console.info(`PASS ALB-116: ${result.recordCount} engineering records indexed`);
    } catch (error) {
        console.error(`FAIL ALB-116 [${error.code || "UNKNOWN"}]: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    EngineeringRecordIndexError,
    compareRecordPaths,
    discoverRecordPaths,
    parseIndexedRecordPaths,
    validateIndexedRecordPaths,
    verifyEngineeringRecordIndex
};
