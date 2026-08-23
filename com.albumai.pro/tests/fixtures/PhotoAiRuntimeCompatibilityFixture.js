import {
    PHOTO_AI_RUNTIME_COMPATIBILITY_SCHEMA,
    PHOTO_AI_RUNTIME_LOADER_KIND
} from "../../scripts/PhotoAiRuntimeCompatibility";
import {
    PHOTO_AI_FIXTURE_RUNTIME_DIGEST
} from "./PhotoAiCandidateFixture";

function host(platform, overrides = {}) {
    return {
        platform,
        tested: true,
        localAssetBytesPassed: true,
        moduleConstructorPassed: true,
        instanceConstructorPassed: true,
        documentCountUnchanged: true,
        asyncInstantiationRequired: false,
        fetchRequired: false,
        workerRequired: false,
        crossOriginIsolationRequired: false,
        ...overrides
    };
}

export function completePhotoAiRuntimeCompatibility(overrides = {}) {
    const base = {
        schemaVersion: PHOTO_AI_RUNTIME_COMPATIBILITY_SCHEMA,
        runtime: {
            runtimeId: "fixture-runtime",
            runtimeVersion: "1.0.0",
            runtimeDigest: PHOTO_AI_FIXTURE_RUNTIME_DIGEST,
            loaderKind: PHOTO_AI_RUNTIME_LOADER_KIND
        },
        hosts: [host("MACOS"), host("WINDOWS")]
    };
    return {
        ...base,
        ...overrides,
        runtime: { ...base.runtime, ...(overrides.runtime || {}) }
    };
}

export { host as photoAiRuntimeCompatibilityHost };
