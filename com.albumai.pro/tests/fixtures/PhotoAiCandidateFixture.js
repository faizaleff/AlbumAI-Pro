import {
    PHOTO_AI_CANDIDATE_INVENTORY_SCHEMA
} from "../../scripts/PhotoAiCandidateInventory";

export const PHOTO_AI_FIXTURE_DIGEST = `sha256:${"a".repeat(64)}`;
export const PHOTO_AI_FIXTURE_RUNTIME_DIGEST = `sha256:${"b".repeat(64)}`;

export function completePhotoAiCandidateInventory(overrides = {}) {
    const base = {
        schemaVersion: PHOTO_AI_CANDIDATE_INVENTORY_SCHEMA,
        candidate: {
            candidateId: "fixture-model",
            modelVersion: "1.0.0",
            providerKind: "LOCAL_WASM",
            sourceUrl: "https://example.com/models/fixture-model",
            modelDigest: PHOTO_AI_FIXTURE_DIGEST
        },
        artifacts: [
            {
                kind: "MODEL",
                artifactId: "fixture-model-weights",
                sourceUrl: "https://example.com/models/fixture-model/weights",
                digest: PHOTO_AI_FIXTURE_DIGEST,
                bytes: 12 * 1024 * 1024
            },
            {
                kind: "RUNTIME",
                artifactId: "fixture-runtime",
                sourceUrl: "https://example.com/runtime",
                digest: PHOTO_AI_FIXTURE_RUNTIME_DIGEST,
                bytes: 2 * 1024 * 1024
            },
            {
                kind: "GLUE",
                artifactId: "fixture-glue",
                sourceUrl: "https://example.com/glue",
                digest: `sha256:${"c".repeat(64)}`,
                bytes: 128 * 1024
            },
            {
                kind: "NOTICES",
                artifactId: "fixture-notices",
                sourceUrl: "https://example.com/notices",
                digest: `sha256:${"d".repeat(64)}`,
                bytes: 32 * 1024
            }
        ],
        licensing: {
            weights: {
                licenseId: "Fixture-Weights-1.0",
                sourceUrl: "https://example.com/licenses/weights"
            },
            code: {
                licenseId: "Apache-2.0",
                sourceUrl: "https://example.com/licenses/runtime"
            },
            trainingDataDisclosure: {
                status: "DISCLOSED",
                sourceUrl: "https://example.com/training-data"
            },
            commercialUseAllowed: true,
            redistributionAllowed: true,
            researchOnly: false,
            fieldOfUseRestriction: false,
            obligations: ["ATTRIBUTION", "NOTICE"]
        },
        review: {
            decision: "APPROVED",
            reviewId: "ALB-111-fixture-review",
            reviewerRole: "PROJECT_OWNER",
            reviewedAt: "2026-08-23",
            noticesComplete: true,
            obligationsAccepted: true
        }
    };
    return {
        ...base,
        ...overrides,
        candidate: { ...base.candidate, ...(overrides.candidate || {}) },
        licensing: {
            ...base.licensing,
            ...(overrides.licensing || {}),
            trainingDataDisclosure: {
                ...base.licensing.trainingDataDisclosure,
                ...(overrides.licensing?.trainingDataDisclosure || {})
            }
        },
        review: { ...base.review, ...(overrides.review || {}) }
    };
}
