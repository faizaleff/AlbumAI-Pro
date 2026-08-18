#!/usr/bin/env node

"use strict";

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const zlib = require("zlib");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DIST_ROOT = path.join(PROJECT_ROOT, "dist");
const FIXED_DOS_TIME = 0;
const FIXED_DOS_DATE = 33; // 1980-01-01, the earliest ZIP timestamp.
const ZIP_UTF8_FLAG = 0x0800;
const ZIP_DEFLATE_METHOD = 8;
const ZIP_FILE_MODE = (0o100644 << 16) >>> 0;

const DIST_FILES = Object.freeze([
    "icons/icon_D.png",
    "icons/icon_D@2x.png",
    "icons/icon_N.png",
    "icons/icon_N@2x.png",
    "index.html",
    "index.js",
    "index.js.LICENSE.txt",
    "manifest.json"
]);

const PACKAGE_FILES = Object.freeze([
    { archivePath: "LICENSE", sourcePath: path.join(PROJECT_ROOT, "LICENSE") },
    ...DIST_FILES.map(relativePath => ({
        archivePath: relativePath,
        sourcePath: path.join(DIST_ROOT, relativePath)
    }))
].sort((left, right) => comparePaths(left.archivePath, right.archivePath)));

const FORBIDDEN_PATH_SEGMENTS = new Set([
    "__MACOSX",
    "node_modules",
    "scripts",
    "src",
    "tests"
]);

function comparePaths(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(buffer) {
    return crypto.createHash("sha256").update(buffer).digest("hex");
}

function createCrc32Table() {
    return Array.from({ length: 256 }, (_, value) => {
        let crc = value;
        for (let bit = 0; bit < 8; bit += 1) {
            crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
        }
        return crc >>> 0;
    });
}

const CRC32_TABLE = createCrc32Table();

function crc32(buffer) {
    let crc = 0xffffffff;
    for (const byte of buffer) {
        crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function walkFiles(rootPath, relativePath = "") {
    const directoryPath = path.join(rootPath, relativePath);
    return fs.readdirSync(directoryPath, { withFileTypes: true })
        .sort((left, right) => comparePaths(left.name, right.name))
        .flatMap(entry => {
            const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                return walkFiles(rootPath, entryPath);
            }
            if (!entry.isFile()) {
                throw new Error(`Release input contains a non-file entry: ${entryPath}`);
            }
            return [entryPath];
        });
}

function isForbiddenPackagePath(relativePath) {
    const normalized = relativePath.replace(/\\/g, "/");
    const segments = normalized.split("/");
    const fileName = segments[segments.length - 1];
    return normalized.startsWith("/") ||
        normalized.includes("../") ||
        segments.some(segment => FORBIDDEN_PATH_SEGMENTS.has(segment)) ||
        fileName === ".DS_Store" ||
        fileName.startsWith("._") ||
        /(?:^|[._-])(?:stage|staging|backup)(?:[._-]|$)/i.test(fileName);
}

function validateReleaseInputs(packageJson, manifest, packageLock) {
    if (packageJson.version !== manifest.version) {
        throw new Error(
            `Version mismatch: package.json=${packageJson.version}, manifest.json=${manifest.version}`
        );
    }
    if (manifest.id !== "com.albumai.pro") {
        throw new Error(`Unexpected plugin id: ${manifest.id}`);
    }
    if (packageLock.version !== packageJson.version ||
        packageLock.packages?.[""]?.version !== packageJson.version) {
        throw new Error(
            `Lockfile version mismatch: package.json=${packageJson.version}, ` +
            `package-lock.json=${packageLock.version}, root=${packageLock.packages?.[""]?.version}`
        );
    }
    if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(packageJson.version)) {
        throw new Error(`Unsafe release version: ${packageJson.version}`);
    }

    const actualDistFiles = walkFiles(DIST_ROOT);
    if (JSON.stringify(actualDistFiles) !== JSON.stringify(DIST_FILES)) {
        throw new Error(
            `Production dist inventory mismatch. Expected ${DIST_FILES.join(", ")}; ` +
            `received ${actualDistFiles.join(", ")}`
        );
    }

    for (const file of PACKAGE_FILES) {
        if (isForbiddenPackagePath(file.archivePath)) {
            throw new Error(`Forbidden release path: ${file.archivePath}`);
        }
        if (!fs.statSync(file.sourcePath).isFile()) {
            throw new Error(`Release input is not a regular file: ${file.sourcePath}`);
        }
    }
}

function createDeterministicZip(entries) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    for (const entry of entries) {
        const name = Buffer.from(entry.path, "utf8");
        const compressed = zlib.deflateRawSync(entry.content, { level: 9 });
        const checksum = crc32(entry.content);
        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034b50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(ZIP_UTF8_FLAG, 6);
        localHeader.writeUInt16LE(ZIP_DEFLATE_METHOD, 8);
        localHeader.writeUInt16LE(FIXED_DOS_TIME, 10);
        localHeader.writeUInt16LE(FIXED_DOS_DATE, 12);
        localHeader.writeUInt32LE(checksum, 14);
        localHeader.writeUInt32LE(compressed.length, 18);
        localHeader.writeUInt32LE(entry.content.length, 22);
        localHeader.writeUInt16LE(name.length, 26);
        localHeader.writeUInt16LE(0, 28);
        localParts.push(localHeader, name, compressed);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014b50, 0);
        centralHeader.writeUInt16LE((3 << 8) | 20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(ZIP_UTF8_FLAG, 8);
        centralHeader.writeUInt16LE(ZIP_DEFLATE_METHOD, 10);
        centralHeader.writeUInt16LE(FIXED_DOS_TIME, 12);
        centralHeader.writeUInt16LE(FIXED_DOS_DATE, 14);
        centralHeader.writeUInt32LE(checksum, 16);
        centralHeader.writeUInt32LE(compressed.length, 20);
        centralHeader.writeUInt32LE(entry.content.length, 24);
        centralHeader.writeUInt16LE(name.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(ZIP_FILE_MODE, 38);
        centralHeader.writeUInt32LE(localOffset, 42);
        centralParts.push(centralHeader, name);

        localOffset += localHeader.length + name.length + compressed.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(0, 4);
    end.writeUInt16LE(0, 6);
    end.writeUInt16LE(entries.length, 8);
    end.writeUInt16LE(entries.length, 10);
    end.writeUInt32LE(centralDirectory.length, 12);
    end.writeUInt32LE(localOffset, 16);
    end.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, end]);
}

function listZipEntries(zipBuffer) {
    const endOffset = zipBuffer.length - 22;
    if (endOffset < 0 || zipBuffer.readUInt32LE(endOffset) !== 0x06054b50) {
        throw new Error("Invalid deterministic ZIP end record");
    }
    const entryCount = zipBuffer.readUInt16LE(endOffset + 10);
    let offset = zipBuffer.readUInt32LE(endOffset + 16);
    const entries = [];
    for (let index = 0; index < entryCount; index += 1) {
        if (zipBuffer.readUInt32LE(offset) !== 0x02014b50) {
            throw new Error("Invalid deterministic ZIP central directory");
        }
        const nameLength = zipBuffer.readUInt16LE(offset + 28);
        const extraLength = zipBuffer.readUInt16LE(offset + 30);
        const commentLength = zipBuffer.readUInt16LE(offset + 32);
        entries.push({
            path: zipBuffer.subarray(offset + 46, offset + 46 + nameLength).toString("utf8"),
            dosTime: zipBuffer.readUInt16LE(offset + 12),
            dosDate: zipBuffer.readUInt16LE(offset + 14),
            mode: zipBuffer.readUInt32LE(offset + 38),
            sizeBytes: zipBuffer.readUInt32LE(offset + 24)
        });
        offset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

function writeAtomically(filePath, content) {
    const temporaryPath = `${filePath}.albumai-stage-${process.pid}`;
    try {
        fs.writeFileSync(temporaryPath, content, { flag: "wx" });
        fs.renameSync(temporaryPath, filePath);
    } finally {
        fs.rmSync(temporaryPath, { force: true });
    }
}

const childProcess = require("child_process");

function getGitReleaseTags({ cwd = PROJECT_ROOT } = {}) {
    try {
        const output = childProcess.execSync("git tag -l", {
            cwd,
            encoding: "utf8",
            stdio: ["ignore", "pipe", "ignore"]
        });
        return new Set(output.split(/\r?\n/).map(tag => tag.trim()).filter(Boolean));
    } catch (_) {
        return new Set();
    }
}

function checkReleaseDestinationSafety(destinationPath, archiveName, version, {
    isDefaultReleaseTarget = true,
    gitTagReader = getGitReleaseTags
} = {}) {
    if (isDefaultReleaseTarget) {
        const tags = typeof gitTagReader === "function" ? gitTagReader() : getGitReleaseTags();
        const expectedTag = `v${version}`;
        if (tags && typeof tags.has === "function" && tags.has(expectedTag)) {
            throw new Error(
                `Refusing to generate release package for version ${version}. ` +
                `Git release tag '${expectedTag}' already exists and historical releases are immutable. ` +
                `Bump the project version in package.json and manifests to cut a new release.`
            );
        }
    }

    const targetFiles = [
        path.join(destinationPath, archiveName),
        path.join(destinationPath, `${archiveName}.sha256`),
        path.join(destinationPath, `${archiveName}.inventory.json`)
    ];

    for (const filePath of targetFiles) {
        if (fs.existsSync(filePath)) {
            throw new Error(
                `Refusing to overwrite existing release artifact: ${filePath}. ` +
                `Release artifacts are immutable. Bump the version or package to a dedicated clean directory.`
            );
        }
    }
}

function packageRelease({ outputDir, gitTagReader } = {}) {
    const packageJson = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8"));
    const packageLock = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package-lock.json"), "utf8"));
    const manifest = JSON.parse(fs.readFileSync(path.join(DIST_ROOT, "manifest.json"), "utf8"));
    validateReleaseInputs(packageJson, manifest, packageLock);

    const isDefaultReleaseTarget = !outputDir ||
        path.resolve(outputDir) === path.resolve(path.join(PROJECT_ROOT, "release", packageJson.version));
    const destination = path.resolve(outputDir || path.join(PROJECT_ROOT, "release", packageJson.version));
    const archiveName = `AlbumAI-Pro-${packageJson.version}.zip`;

    checkReleaseDestinationSafety(destination, archiveName, packageJson.version, {
        isDefaultReleaseTarget,
        gitTagReader
    });

    const entries = PACKAGE_FILES.map(file => ({
        path: file.archivePath,
        content: fs.readFileSync(file.sourcePath)
    }));
    const archiveBuffer = createDeterministicZip(entries);
    const archiveHash = sha256(archiveBuffer);

    fs.mkdirSync(destination, { recursive: true });

    const inventory = {
        schemaVersion: 1,
        packageName: "AlbumAI Pro",
        packageVersion: packageJson.version,
        pluginId: manifest.id,
        pluginVersion: manifest.version,
        archive: {
            file: archiveName,
            format: "zip",
            sha256: archiveHash,
            sizeBytes: archiveBuffer.length
        },
        entries: entries.map(entry => ({
            path: entry.path,
            sha256: sha256(entry.content),
            sizeBytes: entry.content.length
        }))
    };

    const archivePath = path.join(destination, archiveName);
    const checksumPath = `${archivePath}.sha256`;
    const inventoryPath = `${archivePath}.inventory.json`;
    writeAtomically(archivePath, archiveBuffer);
    writeAtomically(checksumPath, `${archiveHash}  ${archiveName}\n`);
    writeAtomically(inventoryPath, `${JSON.stringify(inventory, null, 2)}\n`);

    return { archivePath, checksumPath, inventoryPath, archiveBuffer, inventory };
}

function parseArguments(argumentsList) {
    let outputDir;
    for (let index = 0; index < argumentsList.length; index += 1) {
        const argument = argumentsList[index];
        if (argument === "--output-dir" && argumentsList[index + 1]) {
            outputDir = argumentsList[index + 1];
            index += 1;
        } else {
            throw new Error(`Unknown or incomplete argument: ${argument}`);
        }
    }
    return { outputDir };
}

if (require.main === module) {
    try {
        const result = packageRelease(parseArguments(process.argv.slice(2)));
        process.stdout.write(`${JSON.stringify({
            archive: result.archivePath,
            checksum: result.checksumPath,
            inventory: result.inventoryPath,
            sha256: result.inventory.archive.sha256
        }, null, 2)}\n`);
    } catch (error) {
        console.error(`Release packaging failed: ${error.message}`);
        process.exitCode = 1;
    }
}

module.exports = {
    DIST_FILES,
    PACKAGE_FILES,
    FIXED_DOS_DATE,
    FIXED_DOS_TIME,
    checkReleaseDestinationSafety,
    createDeterministicZip,
    getGitReleaseTags,
    isForbiddenPackagePath,
    listZipEntries,
    packageRelease,
    sha256,
    validateReleaseInputs
};
