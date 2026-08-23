const PHOTO_AI_RUNTIME_HOST_EVIDENCE_SCHEMA = 1;
const PHOTO_AI_RUNTIME_LOADER_KIND = "LOCAL_BYTES_SYNC_WASM";
const REQUIRED_HOSTS = Object.freeze(["MACOS", "WINDOWS"]);

const PhotoAiRuntimeHostEvidenceError = Object.freeze({
    UNKNOWN_SCHEMA: "UNKNOWN_SCHEMA",
    RECORDER_MANIFEST_INVALID: "RECORDER_MANIFEST_INVALID",
    VERIFIED_EVIDENCE_INVALID: "VERIFIED_EVIDENCE_INVALID",
    RUNTIME_ARTIFACT_INVALID: "RUNTIME_ARTIFACT_INVALID",
    RUNTIME_DIGEST_MISMATCH: "RUNTIME_DIGEST_MISMATCH",
    PLATFORM_UNSUPPORTED: "PLATFORM_UNSUPPORTED",
    DOCUMENT_COUNT_INVALID: "DOCUMENT_COUNT_INVALID",
    RUNTIME_IMPORTS_REQUIRE_REVIEWED_GLUE:
        "RUNTIME_IMPORTS_REQUIRE_REVIEWED_GLUE",
    HOST_RECORD_INVALID: "HOST_RECORD_INVALID",
    HOST_RECORD_DUPLICATE: "HOST_RECORD_DUPLICATE",
    HOST_RECORD_MISMATCH: "HOST_RECORD_MISMATCH",
    HOST_RECORDS_INCOMPLETE: "HOST_RECORDS_INCOMPLETE",
    OUTPUT_WRITE_FAILED: "OUTPUT_WRITE_FAILED"
});

class RuntimeHostEvidenceError extends Error {
    constructor(code) {
        super(code);
        this.name = "RuntimeHostEvidenceError";
        this.code = code;
    }
}

function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

function boundedIdentifier(value, maximumLength = 120) {
    return typeof value === "string" &&
        value.length > 0 &&
        value.length <= maximumLength &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
        ? value
        : null;
}

function sha256Digest(value) {
    return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value)
        ? value
        : null;
}

function bytesView(value) {
    if (value instanceof Uint8Array) return value;
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    throw new RuntimeHostEvidenceError(
        PhotoAiRuntimeHostEvidenceError.RUNTIME_ARTIFACT_INVALID
    );
}

function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
}

// Dependency-free SHA-256 keeps the same recorder core usable in Node tests
// and in a standalone Photoshop UXP script where Node crypto is unavailable.
function sha256Hex(value) {
    const input = bytesView(value);
    const bitLength = input.length * 8;
    const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
    const padded = new Uint8Array(paddedLength);
    padded.set(input);
    padded[input.length] = 0x80;
    const lengthHigh = Math.floor(bitLength / 0x100000000);
    const lengthLow = bitLength >>> 0;
    const view = new DataView(padded.buffer);
    view.setUint32(paddedLength - 8, lengthHigh, false);
    view.setUint32(paddedLength - 4, lengthLow, false);

    const constants = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
        0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
        0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
        0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
        0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
        0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
        0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
        0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
        0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
        0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
        0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
        0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
        0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
        0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    const hash = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
        0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const words = new Uint32Array(64);
    for (let offset = 0; offset < paddedLength; offset += 64) {
        for (let index = 0; index < 16; index += 1) {
            words[index] = view.getUint32(offset + index * 4, false);
        }
        for (let index = 16; index < 64; index += 1) {
            const x = words[index - 15];
            const y = words[index - 2];
            const sigma0 = rightRotate(x, 7) ^ rightRotate(x, 18) ^ (x >>> 3);
            const sigma1 = rightRotate(y, 17) ^ rightRotate(y, 19) ^ (y >>> 10);
            words[index] = (words[index - 16] + sigma0 +
                words[index - 7] + sigma1) >>> 0;
        }
        let [a, b, c, d, e, f, g, h] = hash;
        for (let index = 0; index < 64; index += 1) {
            const sum1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^
                rightRotate(e, 25);
            const choice = (e & f) ^ (~e & g);
            const temporary1 = (h + sum1 + choice + constants[index] +
                words[index]) >>> 0;
            const sum0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^
                rightRotate(a, 22);
            const majority = (a & b) ^ (a & c) ^ (b & c);
            const temporary2 = (sum0 + majority) >>> 0;
            h = g;
            g = f;
            f = e;
            e = (d + temporary1) >>> 0;
            d = c;
            c = b;
            b = a;
            a = (temporary1 + temporary2) >>> 0;
        }
        hash[0] = (hash[0] + a) >>> 0;
        hash[1] = (hash[1] + b) >>> 0;
        hash[2] = (hash[2] + c) >>> 0;
        hash[3] = (hash[3] + d) >>> 0;
        hash[4] = (hash[4] + e) >>> 0;
        hash[5] = (hash[5] + f) >>> 0;
        hash[6] = (hash[6] + g) >>> 0;
        hash[7] = (hash[7] + h) >>> 0;
    }
    return hash.map(word => word.toString(16).padStart(8, "0")).join("");
}

function normalizeRecorderManifest(value) {
    const source = objectValue(value);
    if (source.schemaVersion !== PHOTO_AI_RUNTIME_HOST_EVIDENCE_SCHEMA) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.UNKNOWN_SCHEMA
        );
    }
    const runtimeId = boundedIdentifier(source.runtimeId);
    const runtimeVersion = boundedIdentifier(source.runtimeVersion);
    if (!runtimeId || !runtimeVersion ||
        source.loaderKind !== PHOTO_AI_RUNTIME_LOADER_KIND) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.RECORDER_MANIFEST_INVALID
        );
    }
    return { runtimeId, runtimeVersion };
}

function verifiedRuntimeArtifact(value) {
    const evidence = objectValue(value);
    const inventory = objectValue(evidence.candidateInventory);
    if (evidence.schemaVersion !== 1 ||
        objectValue(evidence.verification).status !==
            "VERIFIED_FROM_LOCAL_FILES" ||
        inventory.schemaVersion !== 1 ||
        !Array.isArray(inventory.artifacts)) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.VERIFIED_EVIDENCE_INVALID
        );
    }
    const runtimeArtifacts = inventory.artifacts.filter(item =>
        objectValue(item).kind === "RUNTIME"
    );
    const artifact = objectValue(runtimeArtifacts[0]);
    if (runtimeArtifacts.length !== 1 ||
        !boundedIdentifier(artifact.artifactId) ||
        !sha256Digest(artifact.digest) ||
        !Number.isSafeInteger(artifact.bytes) || artifact.bytes < 0) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.VERIFIED_EVIDENCE_INVALID
        );
    }
    return {
        artifactId: artifact.artifactId,
        digest: artifact.digest,
        bytes: artifact.bytes
    };
}

function normalizePlatform(value) {
    const normalized = typeof value === "string" ? value.toLowerCase() : "";
    if (["darwin", "macos"].includes(normalized)) return "MACOS";
    if (["win32", "windows"].includes(normalized)) return "WINDOWS";
    throw new RuntimeHostEvidenceError(
        PhotoAiRuntimeHostEvidenceError.PLATFORM_UNSUPPORTED
    );
}

function validateDocumentCount(value) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.DOCUMENT_COUNT_INVALID
        );
    }
    return value;
}

function recordPhotoAiRuntimeHostEvidence(value = {}) {
    const manifest = normalizeRecorderManifest(value.recorderManifest);
    const artifact = verifiedRuntimeArtifact(value.verifiedCandidateEvidence);
    const runtimeBytes = bytesView(value.runtimeBytes);
    const measuredDigest = `sha256:${sha256Hex(runtimeBytes)}`;
    if (artifact.bytes !== runtimeBytes.byteLength ||
        artifact.digest !== measuredDigest) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.RUNTIME_DIGEST_MISMATCH
        );
    }
    const platform = normalizePlatform(value.platform);
    const documentCountBefore = validateDocumentCount(
        value.documentCountBefore
    );
    const documentCountAfter = validateDocumentCount(value.documentCountAfter);
    const wasm = value.WebAssemblyImpl || WebAssembly;
    let moduleConstructorPassed = false;
    let instanceConstructorPassed = false;
    let module;
    try {
        module = new wasm.Module(runtimeBytes);
        moduleConstructorPassed = true;
    } catch (_error) {
        module = null;
    }
    if (moduleConstructorPassed) {
        const imports = typeof wasm.Module.imports === "function"
            ? wasm.Module.imports(module)
            : null;
        if (!Array.isArray(imports) || imports.length > 0) {
            throw new RuntimeHostEvidenceError(
                PhotoAiRuntimeHostEvidenceError
                    .RUNTIME_IMPORTS_REQUIRE_REVIEWED_GLUE
            );
        }
        try {
            new wasm.Instance(module, {});
            instanceConstructorPassed = true;
        } catch (_error) {
            instanceConstructorPassed = false;
        }
    }
    return Object.freeze({
        schemaVersion: PHOTO_AI_RUNTIME_HOST_EVIDENCE_SCHEMA,
        recorder: Object.freeze({
            kind: "PHOTOSHOP_UXP_STANDALONE_PSJS",
            revision: "ALB-114-runtime-host-evidence-v1"
        }),
        runtime: Object.freeze({
            runtimeId: manifest.runtimeId,
            runtimeVersion: manifest.runtimeVersion,
            runtimeDigest: measuredDigest,
            loaderKind: PHOTO_AI_RUNTIME_LOADER_KIND,
            artifactId: artifact.artifactId,
            artifactBytes: runtimeBytes.byteLength
        }),
        host: Object.freeze({
            platform,
            tested: true,
            localAssetBytesPassed: true,
            moduleConstructorPassed,
            instanceConstructorPassed,
            documentCountUnchanged:
                documentCountBefore === documentCountAfter,
            asyncInstantiationRequired: false,
            fetchRequired: false,
            workerRequired: false,
            crossOriginIsolationRequired: false
        })
    });
}

function normalizeHostRecord(value) {
    const source = objectValue(value);
    const recorder = objectValue(source.recorder);
    const runtime = objectValue(source.runtime);
    const host = objectValue(source.host);
    const normalized = {
        runtime: {
            runtimeId: boundedIdentifier(runtime.runtimeId),
            runtimeVersion: boundedIdentifier(runtime.runtimeVersion),
            runtimeDigest: sha256Digest(runtime.runtimeDigest),
            loaderKind: runtime.loaderKind === PHOTO_AI_RUNTIME_LOADER_KIND
                ? runtime.loaderKind
                : null,
            artifactId: boundedIdentifier(runtime.artifactId),
            artifactBytes: Number.isSafeInteger(runtime.artifactBytes) &&
                runtime.artifactBytes >= 0 ? runtime.artifactBytes : null
        },
        host: {
            platform: REQUIRED_HOSTS.includes(host.platform)
                ? host.platform
                : null,
            tested: host.tested,
            localAssetBytesPassed: host.localAssetBytesPassed,
            moduleConstructorPassed: host.moduleConstructorPassed,
            instanceConstructorPassed: host.instanceConstructorPassed,
            documentCountUnchanged: host.documentCountUnchanged,
            asyncInstantiationRequired: host.asyncInstantiationRequired,
            fetchRequired: host.fetchRequired,
            workerRequired: host.workerRequired,
            crossOriginIsolationRequired: host.crossOriginIsolationRequired
        }
    };
    const booleansComplete = [
        "tested",
        "localAssetBytesPassed",
        "moduleConstructorPassed",
        "instanceConstructorPassed",
        "documentCountUnchanged",
        "asyncInstantiationRequired",
        "fetchRequired",
        "workerRequired",
        "crossOriginIsolationRequired"
    ].every(field => typeof normalized.host[field] === "boolean");
    if (source.schemaVersion !== PHOTO_AI_RUNTIME_HOST_EVIDENCE_SCHEMA ||
        recorder.kind !== "PHOTOSHOP_UXP_STANDALONE_PSJS" ||
        recorder.revision !== "ALB-114-runtime-host-evidence-v1" ||
        Object.values(normalized.runtime).some(value => value === null) ||
        !normalized.host.platform || !booleansComplete) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.HOST_RECORD_INVALID
        );
    }
    return normalized;
}

function buildPhotoAiRuntimeCompatibilityEvidence(records) {
    if (!Array.isArray(records) || records.length !== REQUIRED_HOSTS.length) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.HOST_RECORDS_INCOMPLETE
        );
    }
    const normalized = records.map(normalizeHostRecord);
    const platforms = new Set(normalized.map(record => record.host.platform));
    if (platforms.size !== REQUIRED_HOSTS.length) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.HOST_RECORD_DUPLICATE
        );
    }
    const reference = normalized[0].runtime;
    const sameRuntime = normalized.every(record =>
        Object.keys(reference).every(key => record.runtime[key] === reference[key])
    );
    if (!sameRuntime) {
        throw new RuntimeHostEvidenceError(
            PhotoAiRuntimeHostEvidenceError.HOST_RECORD_MISMATCH
        );
    }
    const hostsByPlatform = new Map(normalized.map(record => [
        record.host.platform,
        record.host
    ]));
    return Object.freeze({
        schemaVersion: 1,
        runtime: Object.freeze({
            runtimeId: reference.runtimeId,
            runtimeVersion: reference.runtimeVersion,
            runtimeDigest: reference.runtimeDigest,
            loaderKind: reference.loaderKind
        }),
        hosts: Object.freeze(REQUIRED_HOSTS.map(platform =>
            Object.freeze(hostsByPlatform.get(platform))
        ))
    });
}

module.exports = {
    PHOTO_AI_RUNTIME_HOST_EVIDENCE_SCHEMA,
    PHOTO_AI_RUNTIME_LOADER_KIND,
    PhotoAiRuntimeHostEvidenceError,
    RuntimeHostEvidenceError,
    buildPhotoAiRuntimeCompatibilityEvidence,
    recordPhotoAiRuntimeHostEvidence,
    sha256Hex
};
