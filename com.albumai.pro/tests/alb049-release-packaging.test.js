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
    checkReleaseDestinationSafety,
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
        assert.strictEqual(first.inventory.archive.file, "AlbumAI-Pro-1.0.1.zip");
    });

    test("refuses to overwrite an existing release archive and leaves original intact", () => {
        const overwriteDir = path.join(testRoot, "overwrite-zip-test");
        fs.mkdirSync(overwriteDir, { recursive: true });
        const existingArchive = path.join(overwriteDir, "AlbumAI-Pro-1.0.1.zip");
        const sentinelContent = Buffer.from("SENTINEL_ZIP_DO_NOT_OVERWRITE", "utf8");
        fs.writeFileSync(existingArchive, sentinelContent);

        assert.throws(
            () => packageRelease({ outputDir: overwriteDir }),
            /Refusing to overwrite existing release artifact.*AlbumAI-Pro-1\.0\.1\.zip/
        );

        assert.strictEqual(fs.readFileSync(existingArchive).toString("utf8"), "SENTINEL_ZIP_DO_NOT_OVERWRITE");
    });

    test("refuses to overwrite when checksum sidecar exists even if ZIP is absent", () => {
        const sidecarDir = path.join(testRoot, "sidecar-test");
        fs.mkdirSync(sidecarDir, { recursive: true });
        const existingSha = path.join(sidecarDir, "AlbumAI-Pro-1.0.1.zip.sha256");
        fs.writeFileSync(existingSha, "SENTINEL_SHA_DO_NOT_OVERWRITE");

        assert.throws(
            () => packageRelease({ outputDir: sidecarDir }),
            /Refusing to overwrite existing release artifact.*AlbumAI-Pro-1\.0\.1\.zip\.sha256/
        );

        assert.strictEqual(fs.readFileSync(existingSha).toString("utf8"), "SENTINEL_SHA_DO_NOT_OVERWRITE");
    });

    test("refuses to overwrite when inventory JSON exists even if ZIP is absent", () => {
        const inventoryDir = path.join(testRoot, "inventory-test");
        fs.mkdirSync(inventoryDir, { recursive: true });
        const existingInventory = path.join(inventoryDir, "AlbumAI-Pro-1.0.1.zip.inventory.json");
        fs.writeFileSync(existingInventory, "SENTINEL_INVENTORY_DO_NOT_OVERWRITE");

        assert.throws(
            () => packageRelease({ outputDir: inventoryDir }),
            /Refusing to overwrite existing release artifact.*AlbumAI-Pro-1\.0\.1\.zip\.inventory\.json/
        );

        assert.strictEqual(fs.readFileSync(existingInventory).toString("utf8"), "SENTINEL_INVENTORY_DO_NOT_OVERWRITE");
    });

    test("enforces Git release tag protection on canonical default destination without bypass", () => {
        const defaultDest = path.join(testRoot, "release", "1.0.1");
        assert.throws(
            () => checkReleaseDestinationSafety(defaultDest, "AlbumAI-Pro-1.0.1.zip", "1.0.1", {
                isDefaultReleaseTarget: true,
                gitTagReader: () => new Set(["v1.0.1"])
            }),
            /Refusing to generate release package for version 1\.0\.1.*Git release tag 'v1\.0\.1' already exists/
        );
    });

    test("permits packaging when no Git tag matches and destination is clean", () => {
        const cleanDir = path.join(testRoot, "clean-test");
        const result = packageRelease({
            outputDir: cleanDir,
            gitTagReader: () => new Set(["v1.0.0", "v0.9.0"])
        });
        assert.strictEqual(fs.existsSync(result.archivePath), true);
        assert.strictEqual(fs.existsSync(result.checksumPath), true);
        assert.strictEqual(fs.existsSync(result.inventoryPath), true);
    });
} finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
}

console.info(`ALB-049 release packaging tests complete: ${assertionCount} assertions.`);
