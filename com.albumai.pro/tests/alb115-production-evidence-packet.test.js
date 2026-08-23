import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";
import {
    PHOTO_AI_PRODUCTION_CONCURRENCY,
    PhotoAiProductionGateReason,
    PhotoAiProductionGateStatus,
    evaluatePhotoAiProductionGate
} from "../scripts/PhotoAiProductionGate";
import {
    completePhotoAiCandidateInventory
} from "./fixtures/PhotoAiCandidateFixture";
import {
    completePhotoAiRuntimeCompatibility
} from "./fixtures/PhotoAiRuntimeCompatibilityFixture";

const {
    PhotoAiProductionEvidenceError,
    ProductionEvidenceError,
    buildPhotoAiProductionEvidencePacket,
    writeNewJson
} = require("../scripts/PhotoAiProductionEvidencePacket.cjs");

const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "albumai-alb115-")
);

function candidateEvidence(overrides = {}) {
    return {
        schemaVersion: 1,
        verification: {
            status: "VERIFIED_FROM_LOCAL_FILES",
            algorithm: "SHA-256",
            artifactCount: 4
        },
        candidateInventory: completePhotoAiCandidateInventory(),
        ...overrides
    };
}

function policyManifest(overrides = {}) {
    return {
        schemaVersion: 1,
        privacyBoundaryPassed: true,
        networkRequired: false,
        cancellationPassed: true,
        stalePublicationPassed: true,
        concurrency: { ...PHOTO_AI_PRODUCTION_CONCURRENCY },
        ...overrides
    };
}

function hostRecord(platform, overrides = {}) {
    const inventory = completePhotoAiCandidateInventory();
    const runtime = inventory.artifacts.find(({ kind }) => kind === "RUNTIME");
    return {
        schemaVersion: 1,
        candidateId: inventory.candidate.candidateId,
        modelDigest: inventory.candidate.modelDigest,
        runtimeDigest: runtime.digest,
        platform,
        executed: true,
        documentCountUnchanged: true,
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
        },
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

function packetInput(overrides = {}) {
    return {
        schemaVersion: 1,
        candidateEvidence: candidateEvidence(),
        runtimeCompatibility: completePhotoAiRuntimeCompatibility(),
        policyManifest: policyManifest(),
        hostRecords: [hostRecord("WINDOWS"), hostRecord("MACOS")],
        ...overrides
    };
}

function expectCode(action, code) {
    assert.throws(action, error =>
        error instanceof ProductionEvidenceError && error.code === code
    );
}

async function run() {
    const packet = buildPhotoAiProductionEvidencePacket(packetInput());
    assert.strictEqual(packet.schemaVersion, 1);
    assert.strictEqual(packet.verification.status, "VERIFIED_EVIDENCE_PACKET");
    assert.deepStrictEqual(packet.verification.platforms, ["MACOS", "WINDOWS"]);
    assert.deepStrictEqual(
        packet.gateInput.hosts.map(host => host.platform),
        ["MACOS", "WINDOWS"]
    );
    assert.strictEqual(
        evaluatePhotoAiProductionGate(packet.gateInput).status,
        PhotoAiProductionGateStatus.ELIGIBLE_FOR_TECHNICAL_EVALUATION
    );
    assert.strictEqual(JSON.stringify(packet).includes("filePath"), false);
    assert.strictEqual(JSON.stringify(packet).includes(temporaryDirectory), false);

    const rejectedPacket = buildPhotoAiProductionEvidencePacket(packetInput({
        policyManifest: policyManifest({ networkRequired: true })
    }));
    const rejectedResult = evaluatePhotoAiProductionGate(
        rejectedPacket.gateInput
    );
    assert.strictEqual(rejectedResult.status, PhotoAiProductionGateStatus.REJECTED);
    assert(rejectedResult.reasonCodes.includes(
        PhotoAiProductionGateReason.NETWORK_DEPENDENCY_REQUIRED
    ));

    const overBudgetPacket = buildPhotoAiProductionEvidencePacket(packetInput({
        hostRecords: [
            hostRecord("MACOS"),
            hostRecord("WINDOWS", { timings: { warmInferenceMs: 501 } })
        ]
    }));
    const overBudgetResult = evaluatePhotoAiProductionGate(
        overBudgetPacket.gateInput
    );
    assert.strictEqual(overBudgetResult.status, PhotoAiProductionGateStatus.REJECTED);
    assert(overBudgetResult.reasonCodes.includes(
        PhotoAiProductionGateReason.LATENCY_BUDGET_EXCEEDED
    ));

    expectCode(
        () => buildPhotoAiProductionEvidencePacket(packetInput({
            schemaVersion: 99
        })),
        PhotoAiProductionEvidenceError.UNKNOWN_SCHEMA
    );
    expectCode(
        () => buildPhotoAiProductionEvidencePacket(packetInput({
            candidateEvidence: candidateEvidence({
                unsafePath: "/private/model.onnx"
            })
        })),
        PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
    );
    expectCode(
        () => buildPhotoAiProductionEvidencePacket(packetInput({
            runtimeCompatibility: completePhotoAiRuntimeCompatibility({
                runtime: { runtimeDigest: `sha256:${"e".repeat(64)}` }
            })
        })),
        PhotoAiProductionEvidenceError.EVIDENCE_IDENTITY_MISMATCH
    );
    expectCode(
        () => buildPhotoAiProductionEvidencePacket(packetInput({
            hostRecords: [hostRecord("MACOS")]
        })),
        PhotoAiProductionEvidenceError.HOST_RECORDS_INCOMPLETE
    );
    expectCode(
        () => buildPhotoAiProductionEvidencePacket(packetInput({
            hostRecords: [hostRecord("MACOS"), hostRecord("MACOS")]
        })),
        PhotoAiProductionEvidenceError.HOST_RECORD_DUPLICATE
    );
    expectCode(
        () => buildPhotoAiProductionEvidencePacket(packetInput({
            hostRecords: [
                hostRecord("MACOS"),
                hostRecord("WINDOWS", {
                    modelDigest: `sha256:${"f".repeat(64)}`
                })
            ]
        })),
        PhotoAiProductionEvidenceError.EVIDENCE_IDENTITY_MISMATCH
    );
    expectCode(
        () => buildPhotoAiProductionEvidencePacket(packetInput({
            policyManifest: policyManifest({
                concurrency: {
                    ...PHOTO_AI_PRODUCTION_CONCURRENCY,
                    unsafeToken: "secret"
                }
            })
        })),
        PhotoAiProductionEvidenceError.POLICY_MANIFEST_INVALID
    );

    const outputPath = path.join(temporaryDirectory, "packet.json");
    await writeNewJson(outputPath, packet);
    assert.deepStrictEqual(
        JSON.parse(fs.readFileSync(outputPath, "utf8")),
        packet
    );
    await assert.rejects(
        () => writeNewJson(outputPath, packet),
        error => error instanceof ProductionEvidenceError &&
            error.code === PhotoAiProductionEvidenceError.OUTPUT_WRITE_FAILED
    );
}

run()
    .then(() => console.log("ALB-115 production evidence packet tests passed."))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => fs.rmSync(
        temporaryDirectory,
        { recursive: true, force: true }
    ));
