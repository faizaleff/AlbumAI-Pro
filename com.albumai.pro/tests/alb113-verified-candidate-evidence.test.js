import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {
    PhotoAiCandidateReviewStatus,
    evaluatePhotoAiCandidateInventory
} from "../scripts/PhotoAiCandidateInventory";
import {
    completePhotoAiCandidateEvidenceManifest
} from "./fixtures/PhotoAiCandidateEvidenceManifest";

const {
    CandidateEvidenceError,
    PhotoAiCandidateEvidenceError,
    buildPhotoAiCandidateEvidence,
    writeEvidenceFile
} = require("../scripts/PhotoAiCandidateEvidenceBuilder.cjs");

const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "albumai-alb113-evidence-")
);

function artifactFiles() {
    const files = {};
    for (const [kind, content] of Object.entries({
        MODEL: "model-weights",
        RUNTIME: "runtime-wasm",
        GLUE: "runtime-glue",
        NOTICES: "license-notices"
    })) {
        files[kind] = path.join(temporaryDirectory, `${kind.toLowerCase()}.bin`);
        fs.writeFileSync(files[kind], content);
    }
    return files;
}

async function expectEvidenceError(action, code) {
    await assert.rejects(action, error =>
        error instanceof CandidateEvidenceError && error.code === code
    );
}

async function run() {
    const files = artifactFiles();
    const manifest = completePhotoAiCandidateEvidenceManifest(files);
    const evidence = await buildPhotoAiCandidateEvidence(manifest);
    assert.strictEqual(evidence.verification.status, "VERIFIED_FROM_LOCAL_FILES");
    assert.strictEqual(evidence.verification.algorithm, "SHA-256");
    assert.strictEqual(evidence.verification.artifactCount, 4);
    assert.deepStrictEqual(
        evidence.candidateInventory.artifacts.map(({ kind }) => kind),
        ["MODEL", "RUNTIME", "GLUE", "NOTICES"]
    );
    const modelBytes = fs.readFileSync(files.MODEL);
    const expectedModelDigest = `sha256:${crypto
        .createHash("sha256")
        .update(modelBytes)
        .digest("hex")}`;
    assert.strictEqual(
        evidence.candidateInventory.candidate.modelDigest,
        expectedModelDigest
    );
    assert.strictEqual(
        evidence.candidateInventory.artifacts[0].digest,
        expectedModelDigest
    );
    assert.strictEqual(
        evidence.candidateInventory.artifacts[0].bytes,
        modelBytes.length
    );
    assert.strictEqual(JSON.stringify(evidence).includes(temporaryDirectory), false);
    assert.strictEqual(Object.hasOwn(evidence, "filePath"), false);
    assert.strictEqual(
        evaluatePhotoAiCandidateInventory(evidence.candidateInventory).status,
        PhotoAiCandidateReviewStatus.ELIGIBLE_FOR_TECHNICAL_EVALUATION
    );
    const undisclosedEvidence = await buildPhotoAiCandidateEvidence({
        ...manifest,
        licensing: {
            ...manifest.licensing,
            trainingDataDisclosure: {
                status: "NOT_DISCLOSED"
            }
        }
    });
    assert.strictEqual(
        evaluatePhotoAiCandidateInventory(
            undisclosedEvidence.candidateInventory
        ).status,
        PhotoAiCandidateReviewStatus.REJECTED
    );
    const outputPath = path.join(temporaryDirectory, "evidence.json");
    await writeEvidenceFile(outputPath, evidence);
    const writtenEvidence = JSON.parse(fs.readFileSync(outputPath, "utf8"));
    assert.deepStrictEqual(writtenEvidence, evidence);
    await expectEvidenceError(
        () => writeEvidenceFile(outputPath, evidence),
        PhotoAiCandidateEvidenceError.OUTPUT_WRITE_FAILED
    );
    assert.deepStrictEqual(
        JSON.parse(fs.readFileSync(outputPath, "utf8")),
        evidence
    );

    await expectEvidenceError(
        () => buildPhotoAiCandidateEvidence({ ...manifest, schemaVersion: 99 }),
        PhotoAiCandidateEvidenceError.UNKNOWN_SCHEMA
    );
    await expectEvidenceError(
        () => buildPhotoAiCandidateEvidence({
            ...manifest,
            artifacts: manifest.artifacts.slice(0, 3)
        }),
        PhotoAiCandidateEvidenceError.ARTIFACT_INVENTORY_INVALID
    );
    await expectEvidenceError(
        () => buildPhotoAiCandidateEvidence({
            ...manifest,
            artifacts: manifest.artifacts.map((artifact, index) =>
                index === 0 ? { ...artifact, filePath: "/missing/model.bin" } : artifact
            )
        }),
        PhotoAiCandidateEvidenceError.ARTIFACT_FILE_INVALID
    );
    await expectEvidenceError(
        () => buildPhotoAiCandidateEvidence({
            ...manifest,
            artifacts: [manifest.artifacts[0], ...manifest.artifacts.slice(0, 3)]
        }),
        PhotoAiCandidateEvidenceError.ARTIFACT_INVENTORY_INVALID
    );
    await expectEvidenceError(
        () => buildPhotoAiCandidateEvidence({
            ...manifest,
            candidate: {
                ...manifest.candidate,
                sourceUrl: "https://example.com/model?token=secret"
            }
        }),
        PhotoAiCandidateEvidenceError.MANIFEST_INVALID
    );
    await expectEvidenceError(
        () => buildPhotoAiCandidateEvidence(manifest, {
            inspectArtifact: async () => ({
                digest: "not-a-digest",
                bytes: 1
            })
        }),
        PhotoAiCandidateEvidenceError.ARTIFACT_FILE_INVALID
    );
    await expectEvidenceError(
        () => buildPhotoAiCandidateEvidence(manifest, {
            inspectArtifact: async () => {
                throw new CandidateEvidenceError(
                    PhotoAiCandidateEvidenceError
                        .ARTIFACT_CHANGED_DURING_VERIFICATION
                );
            }
        }),
        PhotoAiCandidateEvidenceError.ARTIFACT_CHANGED_DURING_VERIFICATION
    );
}

run()
    .then(() => console.log("ALB-113 verified candidate evidence tests passed."))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => fs.rmSync(
        temporaryDirectory,
        { recursive: true, force: true }
    ));
