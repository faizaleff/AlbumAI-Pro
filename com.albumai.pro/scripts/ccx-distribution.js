"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { DIST_FILES } = require("./release-package");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const EXPECTED_PLUGIN_ID = "com.albumai.pro";
const EXPECTED_HOST_APP = "PS";
const EXPECTED_BUILD_ID = "ALB-130-v1.2.0-smart-typography-v1";

function comparePaths(left, right) {
    return left < right ? -1 : left > right ? 1 : 0;
}

function sha256(content) {
    return crypto.createHash("sha256").update(content).digest("hex");
}

function walkFiles(rootPath, relativePath = "") {
    return fs.readdirSync(path.join(rootPath, relativePath), { withFileTypes: true })
        .sort((left, right) => comparePaths(left.name, right.name))
        .flatMap(entry => {
            const entryPath = relativePath ? `${relativePath}/${entry.name}` : entry.name;
            if (entry.isDirectory()) {
                return walkFiles(rootPath, entryPath);
            }
            if (!entry.isFile()) {
                throw new Error(`Distribution input contains a non-file entry: ${entryPath}`);
            }
            return [entryPath];
        });
}

function canonicalJson(value) {
    if (Array.isArray(value)) {
        return value.map(canonicalJson);
    }
    if (value && typeof value === "object") {
        return Object.keys(value).sort().reduce((result, key) => {
            result[key] = canonicalJson(value[key]);
            return result;
        }, {});
    }
    return value;
}

function validateDistributionInputs({
    packageJson,
    packageLock,
    sourceManifest,
    builtManifest,
    distFiles,
    indexHtml,
    runtimeBundle
}) {
    const errors = [];
    const version = packageJson?.version;

    if (!version || packageLock?.version !== version || packageLock?.packages?.[""]?.version !== version) {
        errors.push("PACKAGE_VERSION_MISMATCH");
    }
    if (sourceManifest?.version !== version || builtManifest?.version !== version) {
        errors.push("MANIFEST_VERSION_MISMATCH");
    }
    if (sourceManifest?.id !== EXPECTED_PLUGIN_ID || builtManifest?.id !== EXPECTED_PLUGIN_ID) {
        errors.push("DIRECT_DISTRIBUTION_ID_MISMATCH");
    }
    if (sourceManifest?.manifestVersion !== 5 || builtManifest?.manifestVersion !== 5) {
        errors.push("MANIFEST_VERSION_UNSUPPORTED");
    }
    if (Array.isArray(sourceManifest?.host) || Array.isArray(builtManifest?.host) ||
        sourceManifest?.host?.app !== EXPECTED_HOST_APP || builtManifest?.host?.app !== EXPECTED_HOST_APP) {
        errors.push("SINGLE_PHOTOSHOP_HOST_REQUIRED");
    }
    if (!sourceManifest?.host?.minVersion || sourceManifest.host.minVersion !== builtManifest?.host?.minVersion) {
        errors.push("HOST_MIN_VERSION_MISMATCH");
    }
    if (sourceManifest?.main !== "index.html" || builtManifest?.main !== "index.html") {
        errors.push("MAIN_ENTRYPOINT_MISMATCH");
    }
    if (sourceManifest?.requiredPermissions?.network !== undefined ||
        builtManifest?.requiredPermissions?.network !== undefined) {
        errors.push("NETWORK_PERMISSION_NOT_ALLOWED");
    }
    if (JSON.stringify(canonicalJson(sourceManifest)) !== JSON.stringify(canonicalJson(builtManifest))) {
        errors.push("SOURCE_DIST_MANIFEST_DRIFT");
    }

    const expectedFiles = [...DIST_FILES].sort(comparePaths);
    const actualFiles = [...(distFiles || [])].sort(comparePaths);
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
        errors.push("DIST_INVENTORY_MISMATCH");
    }
    if (!String(indexHtml || "").includes("index.js")) {
        errors.push("RUNTIME_SCRIPT_NOT_LOADED");
    }
    if (!Buffer.isBuffer(runtimeBundle) ||
        !runtimeBundle.includes(Buffer.from(EXPECTED_BUILD_ID, "utf8"))) {
        errors.push("RUNTIME_IDENTITY_MISMATCH");
    }

    if (errors.length) {
        throw new Error(`Direct distribution preflight failed: ${errors.join(", ")}`);
    }

    return Object.freeze({
        status: "READY_FOR_UDT_PACKAGE",
        pluginId: EXPECTED_PLUGIN_ID,
        pluginVersion: version,
        hostApp: EXPECTED_HOST_APP,
        hostMinVersion: sourceManifest.host.minVersion,
        manifestVersion: sourceManifest.manifestVersion,
        networkPermission: false,
        distFileCount: actualFiles.length,
        runtimeBuildId: EXPECTED_BUILD_ID,
        runtimeBundleSize: runtimeBundle.length,
        runtimeBundleSha256: sha256(runtimeBundle)
    });
}

function inspectDistributionReadiness({ projectRoot = PROJECT_ROOT } = {}) {
    const readJson = relativePath => JSON.parse(
        fs.readFileSync(path.join(projectRoot, relativePath), "utf8")
    );
    const distRoot = path.join(projectRoot, "dist");
    return validateDistributionInputs({
        packageJson: readJson("package.json"),
        packageLock: readJson("package-lock.json"),
        sourceManifest: readJson("plugin/manifest.json"),
        builtManifest: readJson("dist/manifest.json"),
        distFiles: walkFiles(distRoot),
        indexHtml: fs.readFileSync(path.join(distRoot, "index.html"), "utf8"),
        runtimeBundle: fs.readFileSync(path.join(distRoot, "index.js"))
    });
}

function findEndOfCentralDirectory(archiveBuffer) {
    const minimumOffset = Math.max(0, archiveBuffer.length - 22 - 0xffff);
    for (let offset = archiveBuffer.length - 22; offset >= minimumOffset; offset -= 1) {
        if (archiveBuffer.readUInt32LE(offset) === 0x06054b50) {
            return offset;
        }
    }
    throw new Error("CCX is not a readable ZIP archive");
}

function readZipEntries(archiveBuffer) {
    const endOffset = findEndOfCentralDirectory(archiveBuffer);
    const entryCount = archiveBuffer.readUInt16LE(endOffset + 10);
    let centralOffset = archiveBuffer.readUInt32LE(endOffset + 16);
    const entries = new Map();

    for (let index = 0; index < entryCount; index += 1) {
        if (archiveBuffer.readUInt32LE(centralOffset) !== 0x02014b50) {
            throw new Error("CCX central directory is invalid");
        }
        const method = archiveBuffer.readUInt16LE(centralOffset + 10);
        const compressedSize = archiveBuffer.readUInt32LE(centralOffset + 20);
        const uncompressedSize = archiveBuffer.readUInt32LE(centralOffset + 24);
        const nameLength = archiveBuffer.readUInt16LE(centralOffset + 28);
        const extraLength = archiveBuffer.readUInt16LE(centralOffset + 30);
        const commentLength = archiveBuffer.readUInt16LE(centralOffset + 32);
        const localOffset = archiveBuffer.readUInt32LE(centralOffset + 42);
        const name = archiveBuffer
            .subarray(centralOffset + 46, centralOffset + 46 + nameLength)
            .toString("utf8")
            .replace(/\\/g, "/");

        if (!name || name.startsWith("/") || name.includes("../") || entries.has(name)) {
            throw new Error(`CCX contains an unsafe or duplicate path: ${name}`);
        }
        if (archiveBuffer.readUInt32LE(localOffset) !== 0x04034b50) {
            throw new Error(`CCX local entry is invalid: ${name}`);
        }
        const localNameLength = archiveBuffer.readUInt16LE(localOffset + 26);
        const localExtraLength = archiveBuffer.readUInt16LE(localOffset + 28);
        const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = archiveBuffer.subarray(dataOffset, dataOffset + compressedSize);
        const content = method === 0
            ? Buffer.from(compressed)
            : method === 8
                ? zlib.inflateRawSync(compressed)
                : null;

        if (!content || content.length !== uncompressedSize) {
            throw new Error(`CCX entry uses an unsupported or invalid encoding: ${name}`);
        }
        entries.set(name, content);
        centralOffset += 46 + nameLength + extraLength + commentLength;
    }
    return entries;
}

function inspectCcxPackage({ archiveBuffer, readiness = inspectDistributionReadiness() }) {
    if (!Buffer.isBuffer(archiveBuffer)) {
        throw new Error("CCX archive must be provided as a Buffer");
    }
    const entries = readZipEntries(archiveBuffer);
    const actualFiles = [...entries.keys()].sort(comparePaths);
    const expectedFiles = [...DIST_FILES].sort(comparePaths);
    if (JSON.stringify(actualFiles) !== JSON.stringify(expectedFiles)) {
        throw new Error(
            `CCX inventory mismatch. Expected ${expectedFiles.join(", ")}; received ${actualFiles.join(", ")}`
        );
    }

    const manifest = JSON.parse(entries.get("manifest.json").toString("utf8"));
    if (manifest.id !== readiness.pluginId || manifest.version !== readiness.pluginVersion ||
        manifest.host?.app !== readiness.hostApp || manifest.manifestVersion !== readiness.manifestVersion) {
        throw new Error("CCX embedded manifest differs from qualified distribution identity");
    }
    const runtimeBundle = entries.get("index.js");
    const runtimeHash = sha256(runtimeBundle);
    if (runtimeHash !== readiness.runtimeBundleSha256 ||
        !runtimeBundle.includes(Buffer.from(readiness.runtimeBuildId, "utf8"))) {
        throw new Error("CCX embedded runtime differs from the qualified dist bundle");
    }

    return Object.freeze({
        status: "CCX_VERIFIED",
        pluginId: manifest.id,
        pluginVersion: manifest.version,
        fileCount: actualFiles.length,
        archiveSize: archiveBuffer.length,
        archiveSha256: sha256(archiveBuffer),
        runtimeBuildId: readiness.runtimeBuildId,
        runtimeBundleSha256: runtimeHash
    });
}

module.exports = {
    EXPECTED_BUILD_ID,
    EXPECTED_HOST_APP,
    EXPECTED_PLUGIN_ID,
    inspectCcxPackage,
    inspectDistributionReadiness,
    readZipEntries,
    sha256,
    validateDistributionInputs,
    walkFiles
};
