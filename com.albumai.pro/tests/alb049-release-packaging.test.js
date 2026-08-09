"use strict";

const assert = require("assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
    DIST_FILES,
    FIXED_DOS_DATE,
    FIXED_DOS_TIME,
    PACKAGE_FILES,
    isForbiddenPackagePath,
    listZipEntries,
    packageRelease,
    sha256,
    validateReleaseInputs
} = require("../scripts/release-package");

let assertionCount = 0;
function test(name, callback) {
    callback();
    assertionCount += 1;
    console.info(`PASS ALB-049: ${name}`);
}

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "albumai-alb049-"));

try {
    const first = packageRelease({ outputDir: path.join(testRoot, "one") });
    const second = packageRelease({ outputDir: path.join(testRoot, "two") });

    test("packages the exact allowlisted runtime and license files", () => {
        assert.deepStrictEqual(
            first.inventory.entries.map(entry => entry.path),
            PACKAGE_FILES.map(file => file.archivePath)
        );
        assert.strictEqual(first.inventory.entries.length, DIST_FILES.length + 1);
    });

    test("creates byte-identical archives from independent runs", () => {
        assert(first.archiveBuffer.equals(second.archiveBuffer));
        assert.strictEqual(first.inventory.archive.sha256, second.inventory.archive.sha256);
    });

    test("uses fixed ZIP timestamps and normalized file modes", () => {
        const entries = listZipEntries(first.archiveBuffer);
        assert(entries.every(entry => entry.dosDate === FIXED_DOS_DATE));
        assert(entries.every(entry => entry.dosTime === FIXED_DOS_TIME));
        assert(entries.every(entry => entry.mode === ((0o100644 << 16) >>> 0)));
    });

    test("writes a valid SHA-256 sidecar", () => {
        assert.strictEqual(first.inventory.archive.sha256, sha256(first.archiveBuffer));
        assert.strictEqual(
            fs.readFileSync(first.checksumPath, "utf8"),
            `${first.inventory.archive.sha256}  ${path.basename(first.archivePath)}\n`
        );
    });

    test("writes an inventory matching the ZIP central directory", () => {
        const writtenInventory = JSON.parse(fs.readFileSync(first.inventoryPath, "utf8"));
        assert.deepStrictEqual(writtenInventory, first.inventory);
        assert.deepStrictEqual(
            listZipEntries(first.archiveBuffer).map(entry => entry.path),
            writtenInventory.entries.map(entry => entry.path)
        );
    });

    test("rejects version mismatches", () => {
        assert.throws(
            () => validateReleaseInputs(
                { version: "1.0.1" },
                { id: "com.albumai.pro", version: "1.0.0" },
                { version: "1.0.1", packages: { "": { version: "1.0.1" } } }
            ),
            /Version mismatch/
        );
    });

    test("rejects lockfile version mismatches", () => {
        assert.throws(
            () => validateReleaseInputs(
                { version: "1.0.0" },
                { id: "com.albumai.pro", version: "1.0.0" },
                { version: "1.0.0", packages: { "": { version: "0.0.0" } } }
            ),
            /Lockfile version mismatch/
        );
    });

    test("rejects forbidden release paths", () => {
        [
            ".DS_Store",
            "__MACOSX/manifest.json",
            "node_modules/react/index.js",
            "src/index.jsx",
            "tests/package.test.js",
            "icons/._icon.png",
            "output.albumai-stage.psd",
            "output_albumai-backup.psd"
        ].forEach(file => assert.strictEqual(isForbiddenPackagePath(file), true, file));
        assert.strictEqual(isForbiddenPackagePath("icons/icon_D.png"), false);
    });

    test("keeps package and manifest identity aligned", () => {
        assert.strictEqual(first.inventory.packageVersion, first.inventory.pluginVersion);
        assert.strictEqual(first.inventory.pluginId, "com.albumai.pro");
        assert.strictEqual(first.inventory.archive.file, "AlbumAI-Pro-1.0.0.zip");
    });
} finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
}

console.info(`ALB-049 release packaging tests complete: ${assertionCount} assertions.`);
