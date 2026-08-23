import assert from "assert";
import {
    PhotoAiRuntimeCompatibilityReason,
    PhotoAiRuntimeCompatibilityStatus,
    evaluatePhotoAiRuntimeCompatibility
} from "../scripts/PhotoAiRuntimeCompatibility";
import {
    completePhotoAiRuntimeCompatibility,
    photoAiRuntimeCompatibilityHost
} from "./fixtures/PhotoAiRuntimeCompatibilityFixture";

function rejectHost(overrides) {
    return completePhotoAiRuntimeCompatibility({
        hosts: [
            photoAiRuntimeCompatibilityHost("MACOS", overrides),
            photoAiRuntimeCompatibilityHost("WINDOWS")
        ]
    });
}

{
    const result = evaluatePhotoAiRuntimeCompatibility({
        unsafePath: "/private/runtime.wasm"
    });
    assert.strictEqual(result.status, PhotoAiRuntimeCompatibilityStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiRuntimeCompatibilityReason.UNKNOWN_SCHEMA
    ));
    assert.strictEqual(Object.hasOwn(result, "unsafePath"), false);
}

{
    const result = evaluatePhotoAiRuntimeCompatibility(
        completePhotoAiRuntimeCompatibility()
    );
    assert.strictEqual(
        result.status,
        PhotoAiRuntimeCompatibilityStatus.ELIGIBLE_FOR_TECHNICAL_EVALUATION
    );
    assert.deepStrictEqual(result.reasonCodes, []);
    assert.strictEqual(result.hosts.length, 2);
}

{
    const result = evaluatePhotoAiRuntimeCompatibility(
        completePhotoAiRuntimeCompatibility({
            hosts: [photoAiRuntimeCompatibilityHost("MACOS")]
        })
    );
    assert.strictEqual(result.status, PhotoAiRuntimeCompatibilityStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiRuntimeCompatibilityReason.HOST_EVIDENCE_INCOMPLETE
    ));
}

{
    const result = evaluatePhotoAiRuntimeCompatibility(
        completePhotoAiRuntimeCompatibility({
            runtime: { runtimeDigest: "sha256:not-a-digest" }
        })
    );
    assert.strictEqual(result.status, PhotoAiRuntimeCompatibilityStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiRuntimeCompatibilityReason.RUNTIME_IDENTITY_INVALID
    ));
}

{
    const macos = photoAiRuntimeCompatibilityHost("MACOS");
    const result = evaluatePhotoAiRuntimeCompatibility(
        completePhotoAiRuntimeCompatibility({ hosts: [macos, macos] })
    );
    assert.strictEqual(result.status, PhotoAiRuntimeCompatibilityStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiRuntimeCompatibilityReason.HOST_EVIDENCE_DUPLICATE
    ));
}

{
    const result = evaluatePhotoAiRuntimeCompatibility(rejectHost({
        moduleConstructorPassed: false
    }));
    assert.strictEqual(result.status, PhotoAiRuntimeCompatibilityStatus.REJECTED);
    assert(result.reasonCodes.includes(
        PhotoAiRuntimeCompatibilityReason.SYNC_WASM_PATH_UNSUPPORTED
    ));
}

{
    const result = evaluatePhotoAiRuntimeCompatibility(rejectHost({
        asyncInstantiationRequired: true
    }));
    assert.strictEqual(result.status, PhotoAiRuntimeCompatibilityStatus.REJECTED);
    assert(result.reasonCodes.includes(
        PhotoAiRuntimeCompatibilityReason.ASYNC_INSTANTIATION_REQUIRED
    ));
}

for (const [field, reason] of [
    ["fetchRequired", PhotoAiRuntimeCompatibilityReason.FETCH_REQUIRED],
    ["workerRequired", PhotoAiRuntimeCompatibilityReason.WORKER_REQUIRED],
    [
        "crossOriginIsolationRequired",
        PhotoAiRuntimeCompatibilityReason.CROSS_ORIGIN_ISOLATION_REQUIRED
    ]
]) {
    const result = evaluatePhotoAiRuntimeCompatibility(rejectHost({
        [field]: true
    }));
    assert.strictEqual(result.status, PhotoAiRuntimeCompatibilityStatus.REJECTED);
    assert(result.reasonCodes.includes(reason));
}

{
    const result = evaluatePhotoAiRuntimeCompatibility(rejectHost({
        moduleConstructorPassed: undefined
    }));
    assert.strictEqual(result.status, PhotoAiRuntimeCompatibilityStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiRuntimeCompatibilityReason.HOST_EVIDENCE_INCOMPLETE
    ));
}

console.log("ALB-112 runtime compatibility gate tests passed.");
