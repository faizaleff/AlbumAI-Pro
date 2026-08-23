import assert from "assert";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";
import {
    PhotoAiRuntimeCompatibilityStatus,
    evaluatePhotoAiRuntimeCompatibility
} from "../scripts/PhotoAiRuntimeCompatibility";

const {
    PhotoAiRuntimeHostEvidenceError,
    RuntimeHostEvidenceError,
    buildPhotoAiRuntimeCompatibilityEvidence,
    recordPhotoAiRuntimeHostEvidence,
    sha256Hex
} = require("../scripts/PhotoAiRuntimeHostEvidenceCore.js");
const {
    writeNewJson
} = require("../scripts/PhotoAiRuntimeCompatibilityEvidenceBuilder.cjs");

const EMPTY_WASM_MODULE = Uint8Array.from([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00
]);
const temporaryDirectory = fs.mkdtempSync(
    path.join(os.tmpdir(), "albumai-alb114-")
);

function digest(bytes) {
    return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function verifiedEvidence(bytes = EMPTY_WASM_MODULE) {
    return {
        schemaVersion: 1,
        verification: { status: "VERIFIED_FROM_LOCAL_FILES" },
        candidateInventory: {
            schemaVersion: 1,
            artifacts: [{
                kind: "RUNTIME",
                artifactId: "runtime-wasm-1",
                digest: digest(bytes),
                bytes: bytes.byteLength
            }]
        }
    };
}

function recorderManifest(overrides = {}) {
    return {
        schemaVersion: 1,
        runtimeId: "runtime-wasm",
        runtimeVersion: "1.0.0",
        loaderKind: "LOCAL_BYTES_SYNC_WASM",
        ...overrides
    };
}

function record(platform, overrides = {}) {
    return recordPhotoAiRuntimeHostEvidence({
        recorderManifest: recorderManifest(),
        verifiedCandidateEvidence: verifiedEvidence(),
        runtimeBytes: EMPTY_WASM_MODULE,
        platform,
        documentCountBefore: 0,
        documentCountAfter: 0,
        ...overrides
    });
}

function expectCode(action, code) {
    assert.throws(action, error =>
        error instanceof RuntimeHostEvidenceError && error.code === code
    );
}

async function run() {
    assert.strictEqual(
        sha256Hex(new TextEncoder().encode("abc")),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    assert.strictEqual(
        `sha256:${sha256Hex(EMPTY_WASM_MODULE)}`,
        digest(EMPTY_WASM_MODULE)
    );

    const macos = record("darwin");
    const windows = record("win32");
    assert.strictEqual(macos.host.platform, "MACOS");
    assert.strictEqual(windows.host.platform, "WINDOWS");
    assert.strictEqual(macos.host.moduleConstructorPassed, true);
    assert.strictEqual(macos.host.instanceConstructorPassed, true);
    assert.strictEqual(macos.host.documentCountUnchanged, true);
    assert.strictEqual(macos.host.fetchRequired, false);
    assert.strictEqual(macos.host.workerRequired, false);
    assert.strictEqual(macos.host.crossOriginIsolationRequired, false);
    assert.strictEqual(JSON.stringify(macos).includes(temporaryDirectory), false);
    assert.strictEqual(Object.hasOwn(macos, "runtimeBytes"), false);

    const compatibility = buildPhotoAiRuntimeCompatibilityEvidence([
        windows,
        macos
    ]);
    assert.deepStrictEqual(
        compatibility.hosts.map(host => host.platform),
        ["MACOS", "WINDOWS"]
    );
    assert.strictEqual(
        evaluatePhotoAiRuntimeCompatibility(compatibility).status,
        PhotoAiRuntimeCompatibilityStatus.ELIGIBLE_FOR_TECHNICAL_EVALUATION
    );

    const changedDocumentCount = record("darwin", {
        documentCountAfter: 1
    });
    assert.strictEqual(
        changedDocumentCount.host.documentCountUnchanged,
        false
    );

    const invalidBytes = Uint8Array.from([1, 2, 3]);
    const invalidModule = record("darwin", {
        runtimeBytes: invalidBytes,
        verifiedCandidateEvidence: verifiedEvidence(invalidBytes)
    });
    assert.strictEqual(invalidModule.host.moduleConstructorPassed, false);
    assert.strictEqual(invalidModule.host.instanceConstructorPassed, false);

    expectCode(
        () => record("linux"),
        PhotoAiRuntimeHostEvidenceError.PLATFORM_UNSUPPORTED
    );
    expectCode(
        () => record("darwin", {
            recorderManifest: recorderManifest({ schemaVersion: 99 })
        }),
        PhotoAiRuntimeHostEvidenceError.UNKNOWN_SCHEMA
    );
    expectCode(
        () => record("darwin", {
            recorderManifest: recorderManifest({ loaderKind: "FETCH_WASM" })
        }),
        PhotoAiRuntimeHostEvidenceError.RECORDER_MANIFEST_INVALID
    );
    expectCode(
        () => record("darwin", {
            verifiedCandidateEvidence: {}
        }),
        PhotoAiRuntimeHostEvidenceError.VERIFIED_EVIDENCE_INVALID
    );
    expectCode(
        () => record("darwin", {
            runtimeBytes: Uint8Array.from([...EMPTY_WASM_MODULE, 0])
        }),
        PhotoAiRuntimeHostEvidenceError.RUNTIME_DIGEST_MISMATCH
    );
    expectCode(
        () => record("darwin", {
            documentCountBefore: -1
        }),
        PhotoAiRuntimeHostEvidenceError.DOCUMENT_COUNT_INVALID
    );

    class ImportedModule {
        static imports() {
            return [{ module: "env", name: "memory", kind: "memory" }];
        }
        constructor() {}
    }
    expectCode(
        () => record("darwin", {
            WebAssemblyImpl: {
                Module: ImportedModule,
                Instance: class Instance {}
            }
        }),
        PhotoAiRuntimeHostEvidenceError
            .RUNTIME_IMPORTS_REQUIRE_REVIEWED_GLUE
    );

    expectCode(
        () => buildPhotoAiRuntimeCompatibilityEvidence([macos]),
        PhotoAiRuntimeHostEvidenceError.HOST_RECORDS_INCOMPLETE
    );
    expectCode(
        () => buildPhotoAiRuntimeCompatibilityEvidence([macos, macos]),
        PhotoAiRuntimeHostEvidenceError.HOST_RECORD_DUPLICATE
    );
    expectCode(
        () => buildPhotoAiRuntimeCompatibilityEvidence([
            macos,
            {
                ...windows,
                runtime: { ...windows.runtime, runtimeVersion: "2.0.0" }
            }
        ]),
        PhotoAiRuntimeHostEvidenceError.HOST_RECORD_MISMATCH
    );
    expectCode(
        () => buildPhotoAiRuntimeCompatibilityEvidence([
            macos,
            {
                ...windows,
                unsafePath: "/private/runtime.wasm",
                host: { ...windows.host, tested: "yes" }
            }
        ]),
        PhotoAiRuntimeHostEvidenceError.HOST_RECORD_INVALID
    );

    const outputPath = path.join(temporaryDirectory, "compatibility.json");
    await writeNewJson(outputPath, compatibility);
    assert.deepStrictEqual(
        JSON.parse(fs.readFileSync(outputPath, "utf8")),
        compatibility
    );
    await assert.rejects(
        () => writeNewJson(outputPath, compatibility),
        error => error instanceof RuntimeHostEvidenceError &&
            error.code === PhotoAiRuntimeHostEvidenceError.OUTPUT_WRITE_FAILED
    );
}

run()
    .then(() => console.log("ALB-114 runtime host evidence tests passed."))
    .catch(error => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(() => fs.rmSync(
        temporaryDirectory,
        { recursive: true, force: true }
    ));
