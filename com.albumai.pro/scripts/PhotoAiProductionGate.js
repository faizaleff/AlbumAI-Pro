import {
    PhotoAiCandidateReviewStatus,
    evaluatePhotoAiCandidateInventory
} from "./PhotoAiCandidateInventory";

function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

export const PHOTO_AI_PRODUCTION_GATE_SCHEMA = 1;

export const PhotoAiProductionGateStatus = Object.freeze({
    BLOCKED: "BLOCKED",
    REJECTED: "REJECTED",
    ELIGIBLE_FOR_TECHNICAL_EVALUATION:
        "ELIGIBLE_FOR_TECHNICAL_EVALUATION"
});

export const PhotoAiProductionGateReason = Object.freeze({
    UNKNOWN_SCHEMA: "UNKNOWN_SCHEMA",
    LICENSING_GATE_INCOMPLETE: "LICENSING_GATE_INCOMPLETE",
    LICENSING_GATE_REJECTED: "LICENSING_GATE_REJECTED",
    PRIVACY_BOUNDARY_UNVERIFIED: "PRIVACY_BOUNDARY_UNVERIFIED",
    NETWORK_BOUNDARY_UNVERIFIED: "NETWORK_BOUNDARY_UNVERIFIED",
    NETWORK_DEPENDENCY_REQUIRED: "NETWORK_DEPENDENCY_REQUIRED",
    CANCELLATION_UNVERIFIED: "CANCELLATION_UNVERIFIED",
    CONCURRENCY_POLICY_INVALID: "CONCURRENCY_POLICY_INVALID",
    HOST_EVIDENCE_INCOMPLETE: "HOST_EVIDENCE_INCOMPLETE",
    PACKAGE_EVIDENCE_INCOMPLETE: "PACKAGE_EVIDENCE_INCOMPLETE",
    PACKAGE_BUDGET_EXCEEDED: "PACKAGE_BUDGET_EXCEEDED",
    LATENCY_EVIDENCE_INCOMPLETE: "LATENCY_EVIDENCE_INCOMPLETE",
    LATENCY_BUDGET_EXCEEDED: "LATENCY_BUDGET_EXCEEDED",
    MEMORY_EVIDENCE_INCOMPLETE: "MEMORY_EVIDENCE_INCOMPLETE",
    MEMORY_BUDGET_EXCEEDED: "MEMORY_BUDGET_EXCEEDED"
});

export const PHOTO_AI_PRODUCTION_BUDGETS = Object.freeze({
    maximumPackageDeltaBytes: 32 * 1024 * 1024,
    maximumPreprocessingMs: 250,
    maximumColdStartMs: 3000,
    maximumFirstInferenceMs: 1500,
    maximumWarmInferenceMs: 500,
    maximumBatch20Ms: 15000,
    maximumWasmBytes: 256 * 1024 * 1024,
    maximumHostPeakDeltaBytes: 768 * 1024 * 1024,
    maximumHostIdleDeltaBytes: 192 * 1024 * 1024
});

export const PHOTO_AI_PRODUCTION_CONCURRENCY = Object.freeze({
    queueOwner: "PhotoWorkspaceService",
    maximumActiveProjects: 1,
    maximumModelInstances: 1,
    maximumConcurrentInferences: 1,
    maximumQueuedPhotos: 128,
    duplicateRequestsReuseWork: true,
    cancellationRequired: true,
    stalePublicationGuardRequired: true
});

const PRODUCTION_HOSTS = Object.freeze(["MACOS", "WINDOWS"]);

function nonNegativeInteger(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function normalizeProductionPackage(value) {
    const source = objectValue(value);
    const parts = [
        "runtimeBytes",
        "modelBytes",
        "noticesBytes",
        "glueBytes"
    ].map(key => nonNegativeInteger(source[key]));
    if (parts.some(value => value === null)) return null;
    const totalBytes = parts.reduce((total, value) => total + value, 0);
    return Number.isSafeInteger(totalBytes)
        ? Object.freeze({
            runtimeBytes: parts[0],
            modelBytes: parts[1],
            noticesBytes: parts[2],
            glueBytes: parts[3],
            totalBytes
        })
        : null;
}

function packageFromCandidateReview(candidateReview) {
    const artifacts = Array.isArray(candidateReview?.artifacts)
        ? candidateReview.artifacts
        : [];
    const byKind = new Map(artifacts
        .filter(Boolean)
        .map(artifact => [artifact.kind, artifact]));
    return normalizeProductionPackage({
        runtimeBytes: byKind.get("RUNTIME")?.bytes,
        modelBytes: byKind.get("MODEL")?.bytes,
        noticesBytes: byKind.get("NOTICES")?.bytes,
        glueBytes: byKind.get("GLUE")?.bytes
    });
}

function normalizeProductionHost(value) {
    const source = objectValue(value);
    const platform = PRODUCTION_HOSTS.includes(source.platform)
        ? source.platform
        : null;
    const timings = objectValue(source.timings);
    const memory = objectValue(source.memory);
    const normalizedTimings = {
        preprocessingMs: nonNegativeInteger(timings.preprocessingMs),
        coldStartMs: nonNegativeInteger(timings.coldStartMs),
        firstInferenceMs: nonNegativeInteger(timings.firstInferenceMs),
        warmInferenceMs: nonNegativeInteger(timings.warmInferenceMs),
        batch20Ms: nonNegativeInteger(timings.batch20Ms)
    };
    const normalizedMemory = {
        wasmBytes: nonNegativeInteger(memory.wasmBytes),
        hostPeakDeltaBytes: nonNegativeInteger(memory.hostPeakDeltaBytes),
        hostIdleDeltaBytes: nonNegativeInteger(memory.hostIdleDeltaBytes)
    };
    const timingComplete = Object.values(normalizedTimings)
        .every(value => value !== null);
    const memoryComplete = Object.values(normalizedMemory)
        .every(value => value !== null);
    if (!platform) return null;
    return Object.freeze({
        platform,
        executed: source.executed === true,
        documentCountUnchanged: source.documentCountUnchanged === true,
        timingComplete,
        memoryComplete,
        timings: Object.freeze(normalizedTimings),
        memory: Object.freeze(normalizedMemory)
    });
}

function productionConcurrencyMatches(value) {
    const source = objectValue(value);
    return Object.keys(PHOTO_AI_PRODUCTION_CONCURRENCY).every(key =>
        source[key] === PHOTO_AI_PRODUCTION_CONCURRENCY[key]
    );
}

function hostBudgetFailures(host) {
    const timing = host.timings;
    const memory = host.memory;
    const timingExceeded = timing.preprocessingMs >
            PHOTO_AI_PRODUCTION_BUDGETS.maximumPreprocessingMs ||
        timing.coldStartMs >
            PHOTO_AI_PRODUCTION_BUDGETS.maximumColdStartMs ||
        timing.firstInferenceMs >
            PHOTO_AI_PRODUCTION_BUDGETS.maximumFirstInferenceMs ||
        timing.warmInferenceMs >
            PHOTO_AI_PRODUCTION_BUDGETS.maximumWarmInferenceMs ||
        timing.batch20Ms > PHOTO_AI_PRODUCTION_BUDGETS.maximumBatch20Ms;
    const memoryExceeded = memory.wasmBytes >
            PHOTO_AI_PRODUCTION_BUDGETS.maximumWasmBytes ||
        memory.hostPeakDeltaBytes >
            PHOTO_AI_PRODUCTION_BUDGETS.maximumHostPeakDeltaBytes ||
        memory.hostIdleDeltaBytes >
            PHOTO_AI_PRODUCTION_BUDGETS.maximumHostIdleDeltaBytes;
    return { timingExceeded, memoryExceeded };
}

/**
 * Classifies bounded, public-safe evidence for a future local-WASM candidate.
 * It neither selects a model nor authorizes product integration.
 */
export function evaluatePhotoAiProductionGate(value = {}) {
    const source = objectValue(value);
    const reasons = new Set();
    const rejectedReasons = new Set();
    if (source.schemaVersion !== PHOTO_AI_PRODUCTION_GATE_SCHEMA) {
        reasons.add(PhotoAiProductionGateReason.UNKNOWN_SCHEMA);
    }
    const candidateReview = evaluatePhotoAiCandidateInventory(
        source.candidateInventory
    );
    if (candidateReview.status === PhotoAiCandidateReviewStatus.REJECTED) {
        rejectedReasons.add(
            PhotoAiProductionGateReason.LICENSING_GATE_REJECTED
        );
    } else if (candidateReview.status !==
        PhotoAiCandidateReviewStatus.ELIGIBLE_FOR_TECHNICAL_EVALUATION) {
        reasons.add(PhotoAiProductionGateReason.LICENSING_GATE_INCOMPLETE);
    }
    if (source.privacyBoundaryPassed !== true) {
        reasons.add(PhotoAiProductionGateReason.PRIVACY_BOUNDARY_UNVERIFIED);
    }
    if (source.networkRequired === true) {
        rejectedReasons.add(
            PhotoAiProductionGateReason.NETWORK_DEPENDENCY_REQUIRED
        );
    } else if (source.networkRequired !== false) {
        reasons.add(
            PhotoAiProductionGateReason.NETWORK_BOUNDARY_UNVERIFIED
        );
    }
    if (source.cancellationPassed !== true ||
        source.stalePublicationPassed !== true) {
        reasons.add(PhotoAiProductionGateReason.CANCELLATION_UNVERIFIED);
    }
    if (!productionConcurrencyMatches(source.concurrency)) {
        reasons.add(PhotoAiProductionGateReason.CONCURRENCY_POLICY_INVALID);
    }

    const packageEvidence = packageFromCandidateReview(candidateReview);
    if (!packageEvidence) {
        reasons.add(PhotoAiProductionGateReason.PACKAGE_EVIDENCE_INCOMPLETE);
    } else if (packageEvidence.totalBytes >
        PHOTO_AI_PRODUCTION_BUDGETS.maximumPackageDeltaBytes) {
        rejectedReasons.add(
            PhotoAiProductionGateReason.PACKAGE_BUDGET_EXCEEDED
        );
    }

    const hostsByPlatform = new Map();
    for (const candidate of (Array.isArray(source.hosts) ? source.hosts : [])) {
        const host = normalizeProductionHost(candidate);
        if (host && !hostsByPlatform.has(host.platform)) {
            hostsByPlatform.set(host.platform, host);
        }
    }
    for (const platform of PRODUCTION_HOSTS) {
        const host = hostsByPlatform.get(platform);
        if (!host || !host.executed || !host.documentCountUnchanged) {
            reasons.add(PhotoAiProductionGateReason.HOST_EVIDENCE_INCOMPLETE);
            continue;
        }
        if (!host.timingComplete) {
            reasons.add(
                PhotoAiProductionGateReason.LATENCY_EVIDENCE_INCOMPLETE
            );
        }
        if (!host.memoryComplete) {
            reasons.add(
                PhotoAiProductionGateReason.MEMORY_EVIDENCE_INCOMPLETE
            );
        }
        if (host.timingComplete && host.memoryComplete) {
            const failures = hostBudgetFailures(host);
            if (failures.timingExceeded) {
                rejectedReasons.add(
                    PhotoAiProductionGateReason.LATENCY_BUDGET_EXCEEDED
                );
            }
            if (failures.memoryExceeded) {
                rejectedReasons.add(
                    PhotoAiProductionGateReason.MEMORY_BUDGET_EXCEEDED
                );
            }
        }
    }

    const allReasons = [...new Set([...reasons, ...rejectedReasons])].sort();
    const status = rejectedReasons.size
        ? PhotoAiProductionGateStatus.REJECTED
        : allReasons.length
            ? PhotoAiProductionGateStatus.BLOCKED
            : PhotoAiProductionGateStatus
                .ELIGIBLE_FOR_TECHNICAL_EVALUATION;
    return Object.freeze({
        schemaVersion: PHOTO_AI_PRODUCTION_GATE_SCHEMA,
        status,
        reasonCodes: Object.freeze(allReasons),
        budgets: PHOTO_AI_PRODUCTION_BUDGETS,
        concurrency: PHOTO_AI_PRODUCTION_CONCURRENCY,
        candidateReview,
        package: packageEvidence,
        hosts: Object.freeze(PRODUCTION_HOSTS.map(platform =>
            hostsByPlatform.get(platform) || null
        ))
    });
}
