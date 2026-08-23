function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

function boundedIdentifier(value, maximumLength = 80) {
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

export const PHOTO_AI_RUNTIME_COMPATIBILITY_SCHEMA = 1;

export const PhotoAiRuntimeCompatibilityStatus = Object.freeze({
    BLOCKED: "BLOCKED",
    REJECTED: "REJECTED",
    ELIGIBLE_FOR_TECHNICAL_EVALUATION:
        "ELIGIBLE_FOR_TECHNICAL_EVALUATION"
});

export const PhotoAiRuntimeCompatibilityReason = Object.freeze({
    UNKNOWN_SCHEMA: "UNKNOWN_SCHEMA",
    RUNTIME_IDENTITY_INVALID: "RUNTIME_IDENTITY_INVALID",
    LOADER_KIND_UNSUPPORTED: "LOADER_KIND_UNSUPPORTED",
    HOST_EVIDENCE_INCOMPLETE: "HOST_EVIDENCE_INCOMPLETE",
    HOST_EVIDENCE_DUPLICATE: "HOST_EVIDENCE_DUPLICATE",
    SYNC_WASM_PATH_UNSUPPORTED: "SYNC_WASM_PATH_UNSUPPORTED",
    ASYNC_INSTANTIATION_REQUIRED: "ASYNC_INSTANTIATION_REQUIRED",
    FETCH_REQUIRED: "FETCH_REQUIRED",
    WORKER_REQUIRED: "WORKER_REQUIRED",
    CROSS_ORIGIN_ISOLATION_REQUIRED:
        "CROSS_ORIGIN_ISOLATION_REQUIRED"
});

export const PHOTO_AI_RUNTIME_LOADER_KIND = "LOCAL_BYTES_SYNC_WASM";

const REQUIRED_HOSTS = Object.freeze(["MACOS", "WINDOWS"]);

function booleanOrNull(value) {
    return value === true ? true : value === false ? false : null;
}

function normalizeHost(value) {
    const source = objectValue(value);
    const platform = REQUIRED_HOSTS.includes(source.platform)
        ? source.platform
        : null;
    if (!platform) return null;
    return Object.freeze({
        platform,
        tested: source.tested === true,
        localAssetBytesPassed: source.localAssetBytesPassed === true,
        moduleConstructorPassed: booleanOrNull(
            source.moduleConstructorPassed
        ),
        instanceConstructorPassed: booleanOrNull(
            source.instanceConstructorPassed
        ),
        documentCountUnchanged: source.documentCountUnchanged === true,
        asyncInstantiationRequired:
            source.asyncInstantiationRequired === true
                ? true
                : source.asyncInstantiationRequired === false
                    ? false
                    : null,
        fetchRequired: source.fetchRequired === true
            ? true
            : source.fetchRequired === false
                ? false
                : null,
        workerRequired: source.workerRequired === true
            ? true
            : source.workerRequired === false
                ? false
                : null,
        crossOriginIsolationRequired:
            source.crossOriginIsolationRequired === true
                ? true
                : source.crossOriginIsolationRequired === false
                    ? false
                    : null
    });
}

function hostEvidenceComplete(host) {
    return host.tested &&
        host.localAssetBytesPassed &&
        host.documentCountUnchanged &&
        host.moduleConstructorPassed !== null &&
        host.instanceConstructorPassed !== null &&
        host.asyncInstantiationRequired !== null &&
        host.fetchRequired !== null &&
        host.workerRequired !== null &&
        host.crossOriginIsolationRequired !== null;
}

/**
 * Validates public-safe evidence for an exact local runtime loader artifact.
 * Eligibility permits technical measurement only; it does not authorize use.
 */
export function evaluatePhotoAiRuntimeCompatibility(value = {}) {
    const source = objectValue(value);
    const blockedReasons = new Set();
    const rejectedReasons = new Set();
    if (source.schemaVersion !== PHOTO_AI_RUNTIME_COMPATIBILITY_SCHEMA) {
        blockedReasons.add(PhotoAiRuntimeCompatibilityReason.UNKNOWN_SCHEMA);
    }

    const runtime = objectValue(source.runtime);
    const runtimeId = boundedIdentifier(runtime.runtimeId);
    const runtimeVersion = boundedIdentifier(runtime.runtimeVersion);
    const runtimeDigest = sha256Digest(runtime.runtimeDigest);
    const loaderKind = boundedIdentifier(runtime.loaderKind);
    if (!runtimeId || !runtimeVersion || !runtimeDigest || !loaderKind) {
        blockedReasons.add(
            PhotoAiRuntimeCompatibilityReason.RUNTIME_IDENTITY_INVALID
        );
    } else if (loaderKind !== PHOTO_AI_RUNTIME_LOADER_KIND) {
        rejectedReasons.add(
            PhotoAiRuntimeCompatibilityReason.LOADER_KIND_UNSUPPORTED
        );
    }

    const hostsByPlatform = new Map();
    for (const candidate of (Array.isArray(source.hosts) ? source.hosts : [])) {
        const host = normalizeHost(candidate);
        if (!host) continue;
        if (hostsByPlatform.has(host.platform)) {
            blockedReasons.add(
                PhotoAiRuntimeCompatibilityReason.HOST_EVIDENCE_DUPLICATE
            );
            continue;
        }
        hostsByPlatform.set(host.platform, host);
    }
    for (const platform of REQUIRED_HOSTS) {
        const host = hostsByPlatform.get(platform);
        if (!host || !hostEvidenceComplete(host)) {
            blockedReasons.add(
                PhotoAiRuntimeCompatibilityReason.HOST_EVIDENCE_INCOMPLETE
            );
            continue;
        }
        if (!host.moduleConstructorPassed ||
            !host.instanceConstructorPassed) {
            rejectedReasons.add(
                PhotoAiRuntimeCompatibilityReason.SYNC_WASM_PATH_UNSUPPORTED
            );
        }
        if (host.asyncInstantiationRequired) {
            rejectedReasons.add(
                PhotoAiRuntimeCompatibilityReason
                    .ASYNC_INSTANTIATION_REQUIRED
            );
        }
        if (host.fetchRequired) {
            rejectedReasons.add(
                PhotoAiRuntimeCompatibilityReason.FETCH_REQUIRED
            );
        }
        if (host.workerRequired) {
            rejectedReasons.add(
                PhotoAiRuntimeCompatibilityReason.WORKER_REQUIRED
            );
        }
        if (host.crossOriginIsolationRequired) {
            rejectedReasons.add(
                PhotoAiRuntimeCompatibilityReason
                    .CROSS_ORIGIN_ISOLATION_REQUIRED
            );
        }
    }

    const reasonCodes = [...new Set([
        ...blockedReasons,
        ...rejectedReasons
    ])].sort();
    const status = rejectedReasons.size
        ? PhotoAiRuntimeCompatibilityStatus.REJECTED
        : reasonCodes.length
            ? PhotoAiRuntimeCompatibilityStatus.BLOCKED
            : PhotoAiRuntimeCompatibilityStatus
                .ELIGIBLE_FOR_TECHNICAL_EVALUATION;
    return Object.freeze({
        schemaVersion: PHOTO_AI_RUNTIME_COMPATIBILITY_SCHEMA,
        status,
        reasonCodes: Object.freeze(reasonCodes),
        runtime: Object.freeze({
            runtimeId,
            runtimeVersion,
            runtimeDigest,
            loaderKind: loaderKind === PHOTO_AI_RUNTIME_LOADER_KIND
                ? loaderKind
                : null
        }),
        hosts: Object.freeze(REQUIRED_HOSTS.map(platform =>
            hostsByPlatform.get(platform) || null
        ))
    });
}
