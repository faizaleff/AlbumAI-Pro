#!/usr/bin/env node

"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
    FIXED_DOS_DATE,
    FIXED_DOS_TIME,
    isForbiddenPackagePath,
    listZipEntries,
    packageRelease,
    sha256
} = require("./release-package");

const verificationRoot = fs.mkdtempSync(path.join(os.tmpdir(), "albumai-release-verify-"));

try {
    const first = packageRelease({ outputDir: path.join(verificationRoot, "first") });
    const second = packageRelease({ outputDir: path.join(verificationRoot, "second") });
    assert(first.archiveBuffer.equals(second.archiveBuffer), "independent ZIP outputs differ");
    assert.deepStrictEqual(first.inventory, second.inventory, "independent inventories differ");
    assert.strictEqual(first.inventory.archive.sha256, sha256(first.archiveBuffer));

    const zipEntries = listZipEntries(first.archiveBuffer);
    assert.deepStrictEqual(
        zipEntries.map(entry => entry.path),
        first.inventory.entries.map(entry => entry.path),
        "ZIP and inventory paths differ"
    );
    assert(zipEntries.every(entry => entry.dosDate === FIXED_DOS_DATE));
    assert(zipEntries.every(entry => entry.dosTime === FIXED_DOS_TIME));
    assert(zipEntries.every(entry => !isForbiddenPackagePath(entry.path)));

    const checksum = fs.readFileSync(first.checksumPath, "utf8");
    assert.strictEqual(
        checksum,
        `${first.inventory.archive.sha256}  ${path.basename(first.archivePath)}\n`
    );
    assert.deepStrictEqual(
        JSON.parse(fs.readFileSync(first.inventoryPath, "utf8")),
        first.inventory
    );

    console.info(
        `PASS ALB-049: reproducible ${path.basename(first.archivePath)} ` +
        `(${first.archiveBuffer.length} bytes, ${first.inventory.archive.sha256})`
    );
} finally {
    fs.rmSync(verificationRoot, { recursive: true, force: true });
}
