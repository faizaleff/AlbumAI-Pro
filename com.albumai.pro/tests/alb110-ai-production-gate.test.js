import assert from "assert";
import {
    PHOTO_AI_PRODUCTION_BUDGETS,
    PHOTO_AI_PRODUCTION_CONCURRENCY,
    PHOTO_AI_PRODUCTION_GATE_SCHEMA,
    PhotoAiProductionGateReason,
    PhotoAiProductionGateStatus,
    evaluatePhotoAiProductionGate
} from "../scripts/PhotoAiProductionGate";

function host(platform, overrides = {}) {
    return {
        platform,
        executed: true,
        documentCountUnchanged: true,
        ...overrides,
        timings: {
            preprocessingMs: 100,
            coldStartMs: 1000,
            firstInferenceMs: 500,
            warmInferenceMs: 100,
            batch20Ms: 5000,
            ...(overrides.timings || {})
        },
        memory: {
            wasmBytes: 64 * 1024 * 1024,
            hostPeakDeltaBytes: 256 * 1024 * 1024,
            hostIdleDeltaBytes: 32 * 1024 * 1024,
            ...(overrides.memory || {})
        }
    };
}

function eligibleEvidence(overrides = {}) {
    return {
        schemaVersion: PHOTO_AI_PRODUCTION_GATE_SCHEMA,
        candidateReviewState: "ELIGIBLE_FOR_TECHNICAL_EVALUATION",
        privacyBoundaryPassed: true,
        networkRequired: false,
        cancellationPassed: true,
        stalePublicationPassed: true,
        concurrency: { ...PHOTO_AI_PRODUCTION_CONCURRENCY },
        package: {
            runtimeBytes: 2 * 1024 * 1024,
            modelBytes: 12 * 1024 * 1024,
            noticesBytes: 32 * 1024,
            glueBytes: 128 * 1024
        },
        hosts: [host("MACOS"), host("WINDOWS")],
        ...overrides
    };
}

{
    const result = evaluatePhotoAiProductionGate({ unsafePath: "/private" });
    assert.strictEqual(result.status, PhotoAiProductionGateStatus.BLOCKED);
    assert(result.reasonCodes.includes(PhotoAiProductionGateReason.UNKNOWN_SCHEMA));
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.NETWORK_BOUNDARY_UNVERIFIED
    ));
    assert.strictEqual(Object.hasOwn(result, "unsafePath"), false);
}

{
    const result = evaluatePhotoAiProductionGate(eligibleEvidence());
    assert.strictEqual(
        result.status,
        PhotoAiProductionGateStatus.ELIGIBLE_FOR_TECHNICAL_EVALUATION
    );
    assert.deepStrictEqual(result.reasonCodes, []);
    assert.strictEqual(result.hosts.length, 2);
}

{
    const windows = host("WINDOWS", {
        timings: { batch20Ms: undefined },
        memory: { hostIdleDeltaBytes: undefined }
    });
    const result = evaluatePhotoAiProductionGate(eligibleEvidence({
        hosts: [host("MACOS"), windows]
    }));
    assert.strictEqual(result.status, PhotoAiProductionGateStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.LATENCY_EVIDENCE_INCOMPLETE
    ));
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.MEMORY_EVIDENCE_INCOMPLETE
    ));
}

{
    const result = evaluatePhotoAiProductionGate(eligibleEvidence({
        concurrency: {
            ...PHOTO_AI_PRODUCTION_CONCURRENCY,
            maximumConcurrentInferences: 2
        }
    }));
    assert.strictEqual(result.status, PhotoAiProductionGateStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.CONCURRENCY_POLICY_INVALID
    ));
}

{
    const result = evaluatePhotoAiProductionGate(eligibleEvidence({
        networkRequired: true
    }));
    assert.strictEqual(result.status, PhotoAiProductionGateStatus.REJECTED);
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.NETWORK_DEPENDENCY_REQUIRED
    ));
}

{
    const result = evaluatePhotoAiProductionGate(eligibleEvidence({
        candidateReviewState: "PENDING"
    }));
    assert.strictEqual(result.status, PhotoAiProductionGateStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.LICENSING_GATE_INCOMPLETE
    ));
}

{
    const result = evaluatePhotoAiProductionGate(eligibleEvidence({
        package: {
            runtimeBytes: PHOTO_AI_PRODUCTION_BUDGETS.maximumPackageDeltaBytes,
            modelBytes: 1,
            noticesBytes: 0,
            glueBytes: 0
        }
    }));
    assert.strictEqual(result.status, PhotoAiProductionGateStatus.REJECTED);
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.PACKAGE_BUDGET_EXCEEDED
    ));
}

{
    const result = evaluatePhotoAiProductionGate(eligibleEvidence({
        hosts: [host("MACOS", {
            timings: {
                warmInferenceMs:
                    PHOTO_AI_PRODUCTION_BUDGETS.maximumWarmInferenceMs + 1
            }
        }), host("WINDOWS")]
    }));
    assert.strictEqual(result.status, PhotoAiProductionGateStatus.REJECTED);
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.LATENCY_BUDGET_EXCEEDED
    ));
}

{
    const result = evaluatePhotoAiProductionGate(eligibleEvidence({
        hosts: [host("MACOS"), host("WINDOWS", {
            memory: {
                wasmBytes: PHOTO_AI_PRODUCTION_BUDGETS.maximumWasmBytes + 1
            }
        })]
    }));
    assert.strictEqual(result.status, PhotoAiProductionGateStatus.REJECTED);
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.MEMORY_BUDGET_EXCEEDED
    ));
}

{
    const result = evaluatePhotoAiProductionGate(eligibleEvidence({
        package: { runtimeBytes: -1 },
        hosts: [{ platform: "MACOS" }, { platform: "WINDOWS" }]
    }));
    assert.strictEqual(result.status, PhotoAiProductionGateStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.PACKAGE_EVIDENCE_INCOMPLETE
    ));
    assert(result.reasonCodes.includes(
        PhotoAiProductionGateReason.HOST_EVIDENCE_INCOMPLETE
    ));
}

console.log("ALB-110 AI production evaluation gate tests passed.");
