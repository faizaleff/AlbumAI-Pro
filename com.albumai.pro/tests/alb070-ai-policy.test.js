import assert from "assert";

import PhotoWorkspaceService from "../src/services/PhotoWorkspaceService";
import {
    canPublishPhotoAiAnalysis,
    grantLocalPhotoAiConsent,
    isPhotoAiAnalysisCacheCompatible,
    normalizePhotoAiAnalysis,
    normalizePhotoAiCapability,
    normalizePhotoAiConsent,
    PhotoAiAggregateStatus,
    PhotoAiCapabilityStatus,
    PhotoAiProviderKind,
    PhotoAiReasonCode,
    PhotoAiSignalStatus,
    revokePhotoAiConsent,
    serializePublicPhotoAiAnalysis
} from "../src/services/PhotoAiPolicy";

let assertions = 0;

function test(name, callback) {
    callback();
    assertions += 1;
    console.info(`PASS ALB-070 Slice 1: ${name}`);
}

const digest = "a".repeat(64);

function validAnalysis(values = {}) {
    return {
        schemaVersion: 1,
        photoKey: "p1-0000000000000001",
        photoRevisionKey: "r1-0000000000000002",
        libraryRevisionKey: "l1-0000000000000003",
        analysisId: "a1-0000000000000004",
        createdAt: "2026-08-13T00:00:00.000Z",
        providerKind: PhotoAiProviderKind.LOCAL_WASM,
        model: {
            modelId: "synthetic-test-model",
            modelVersion: "1.0.0",
            modelDigest: digest,
            licenseId: "Apache-2.0"
        },
        preprocessing: {
            pipelineVersion: "synthetic-v1",
            width: 32,
            height: 32,
            colorSpace: "SRGB"
        },
        signals: [{
            signalId: "synthetic-signal",
            signalVersion: "1.0.0",
            status: PhotoAiSignalStatus.SUCCEEDED,
            score: 0.75,
            confidence: 0.8,
            reasonCodes: []
        }],
        aggregate: {
            policyVersion: "policy-v1",
            status: PhotoAiAggregateStatus.COMPLETE,
            rankScore: 0.75,
            reasonCodes: []
        },
        ...values
    };
}

function cacheContext(values = {}) {
    return {
        photoKey: "p1-0000000000000001",
        photoRevisionKey: "r1-0000000000000002",
        libraryRevisionKey: "l1-0000000000000003",
        providerKind: PhotoAiProviderKind.LOCAL_WASM,
        modelDigest: digest,
        pipelineVersion: "synthetic-v1",
        policyVersion: "policy-v1",
        signalVersions: { "synthetic-signal": "1.0.0" },
        ...values
    };
}

function run() {
    test("keeps AI disabled until valid local consent exists", () => {
        assert.deepStrictEqual(normalizePhotoAiConsent({
            schemaVersion: 1,
            localAnalysisEnabled: true,
            remoteInferenceEnabled: true,
            disclosureVersion: "/secret/disclosure",
            consentedAt: "invalid"
        }), revokePhotoAiConsent());
        const consent = grantLocalPhotoAiConsent({
            disclosureVersion: "privacy-v1",
            consentedAt: "2026-08-13T00:00:00Z"
        });
        assert.strictEqual(consent.localAnalysisEnabled, true);
        assert.strictEqual(consent.remoteInferenceEnabled, false);
        assert(Object.isFrozen(consent));
    });

    test("normalizes an available local capability", () => {
        const capability = normalizePhotoAiCapability({
            status: PhotoAiCapabilityStatus.AVAILABLE,
            providerKind: PhotoAiProviderKind.LOCAL_WASM,
            runtimeVersion: "uxp-wasm-spike-v1",
            endpoint: "https://secret.example"
        });
        assert.strictEqual(capability.status, PhotoAiCapabilityStatus.AVAILABLE);
        assert.strictEqual(capability.providerKind, PhotoAiProviderKind.LOCAL_WASM);
        assert(!JSON.stringify(capability).includes("secret"));
    });

    test("fails closed for malformed or unsupported capabilities", () => {
        assert.strictEqual(
            normalizePhotoAiCapability({ status: "READY", path: "/secret" })
                .status,
            PhotoAiCapabilityStatus.UNAVAILABLE
        );
        const unsupported = normalizePhotoAiCapability({
            status: PhotoAiCapabilityStatus.UNSUPPORTED,
            reasonCodes: [PhotoAiReasonCode.RUNTIME_UNSUPPORTED, "/secret"]
        });
        assert.deepStrictEqual(
            unsupported.reasonCodes,
            [PhotoAiReasonCode.RUNTIME_UNSUPPORTED]
        );
    });

    test("normalizes complete evidence without trusting aggregate status", () => {
        const result = normalizePhotoAiAnalysis(validAnalysis({
            aggregate: {
                policyVersion: "policy-v1",
                status: PhotoAiAggregateStatus.UNAVAILABLE,
                rankScore: 0.75
            }
        }));
        assert.strictEqual(result.aggregate.status, PhotoAiAggregateStatus.COMPLETE);
        assert.strictEqual(result.aggregate.rankScore, 0.75);
        assert(Object.isFrozen(result));
        assert(Object.isFrozen(result.signals));
    });

    test("derives partial evidence from per-signal outcomes", () => {
        const source = validAnalysis();
        source.signals.push({
            signalId: "second-signal",
            signalVersion: "1.0.0",
            status: PhotoAiSignalStatus.FAILED,
            error: "/secret/source.jpg"
        });
        const result = normalizePhotoAiAnalysis(source);
        assert.strictEqual(result.aggregate.status, PhotoAiAggregateStatus.PARTIAL);
        assert.deepStrictEqual(
            result.aggregate.reasonCodes,
            [PhotoAiReasonCode.SIGNAL_FAILED]
        );
        assert(!JSON.stringify(result).includes("secret"));
    });

    test("converts invalid successful scores into safe failures", () => {
        const source = validAnalysis();
        source.signals[0].score = 4;
        source.signals[0].confidence = -1;
        const result = normalizePhotoAiAnalysis(source);
        assert.strictEqual(result.signals[0].status, PhotoAiSignalStatus.FAILED);
        assert.strictEqual(result.signals[0].score, null);
        assert.deepStrictEqual(
            result.signals[0].reasonCodes,
            [PhotoAiReasonCode.INVALID_RESULT]
        );
        assert.strictEqual(
            result.aggregate.status,
            PhotoAiAggregateStatus.UNAVAILABLE
        );
    });

    test("fails closed for unknown schemas and unsafe identifiers", () => {
        const unknown = normalizePhotoAiAnalysis({
            schemaVersion: 99,
            path: "/Users/faizal/private.jpg",
            token: "secret-token"
        });
        assert.strictEqual(
            unknown.aggregate.status,
            PhotoAiAggregateStatus.UNAVAILABLE
        );
        assert.deepStrictEqual(
            unknown.aggregate.reasonCodes,
            [PhotoAiReasonCode.UNKNOWN_SCHEMA]
        );
        assert(!JSON.stringify(unknown).includes("faizal"));
        const unsafe = normalizePhotoAiAnalysis(validAnalysis({
            photoKey: "/Users/faizal/private.jpg"
        }));
        assert.deepStrictEqual(
            unsafe.aggregate.reasonCodes,
            [PhotoAiReasonCode.INVALID_EVIDENCE]
        );
    });

    test("serializes only allowlisted public-safe fields", () => {
        const result = serializePublicPhotoAiAnalysis(validAnalysis({
            filename: "private.jpg",
            entry: { nativePath: "/secret/private.jpg" },
            host: { documentId: 7 },
            userDecision: { rating: 1, reject: true }
        }));
        const serialized = JSON.stringify(result);
        assert(!serialized.includes("private"));
        assert(!serialized.includes("secret"));
        assert(!serialized.includes("documentId"));
        assert(!serialized.includes("reject"));
    });

    test("requires the complete cache compatibility tuple", () => {
        const result = validAnalysis();
        assert.strictEqual(
            isPhotoAiAnalysisCacheCompatible(result, cacheContext()),
            true
        );
        for (const values of [
            { photoRevisionKey: "r1-0000000000000009" },
            { libraryRevisionKey: "l1-0000000000000009" },
            { modelDigest: "b".repeat(64) },
            { pipelineVersion: "synthetic-v2" },
            { policyVersion: "policy-v2" },
            { signalVersions: { "synthetic-signal": "2.0.0" } }
        ]) {
            assert.strictEqual(
                isPhotoAiAnalysisCacheCompatible(
                    result,
                    cacheContext(values)
                ),
                false
            );
        }
    });

    test("blocks stale, cancelled, unconsented, and mismatched publication", () => {
        const result = validAnalysis();
        const consent = grantLocalPhotoAiConsent({
            disclosureVersion: "privacy-v1",
            consentedAt: "2026-08-13T00:00:00Z"
        });
        const current = cacheContext({
            consent,
            isCurrent: true,
            analysisId: result.analysisId
        });
        assert.strictEqual(canPublishPhotoAiAnalysis(result, current), true);
        assert.strictEqual(canPublishPhotoAiAnalysis(
            result,
            { ...current, isCurrent: false }
        ), false);
        assert.strictEqual(canPublishPhotoAiAnalysis(
            result,
            { ...current, analysisId: "a1-0000000000000009" }
        ), false);
        assert.strictEqual(canPublishPhotoAiAnalysis(
            result,
            { ...current, consent: revokePhotoAiConsent() }
        ), false);
    });

    test("bounds and de-duplicates signal evidence", () => {
        const source = validAnalysis({
            signals: Array.from({ length: 40 }, (_, index) => ({
                signalId: `signal-${index % 33}`,
                signalVersion: "1.0.0",
                status: PhotoAiSignalStatus.SUCCEEDED,
                score: 0.5
            }))
        });
        const result = normalizePhotoAiAnalysis(source);
        assert.strictEqual(result.signals.length, 32);
        assert.strictEqual(
            new Set(result.signals.map(signal => signal.signalId)).size,
            32
        );
    });

    test("projects policy state through the canonical Photo owner", () => {
        let metadata = {
            id: "project-one",
            photoAiConsent: {
                schemaVersion: 1,
                localAnalysisEnabled: true,
                remoteInferenceEnabled: true,
                disclosureVersion: "/secret",
                consentedAt: "invalid"
            },
            photoAiAnalysis: {
                schemaVersion: 99,
                path: "/secret/photo.jpg"
            }
        };
        const service = new PhotoWorkspaceService({
            library: { getPhotos: () => [] },
            selection: {},
            projectEngine: {
                isOpen: () => true,
                getProject: () => ({ metadata })
            },
            projectService: {},
            localFileSystem: {},
            thumbnailService: {},
            thumbnailQueue: {},
            refreshService: {},
            performance: {},
            metadataScheduler: {},
            metadataSource: {},
            metadataInspector: {},
            duplicateSource: {}
        });
        const first = service.getPhotoAiPolicyState();
        assert.strictEqual(first.consent.localAnalysisEnabled, false);
        assert(!JSON.stringify(first).includes("secret"));
        metadata = {
            id: "project-two",
            photoAiConsent: grantLocalPhotoAiConsent({
                disclosureVersion: "privacy-v1",
                consentedAt: "2026-08-13T00:00:00Z"
            }),
            photoAiAnalysis: validAnalysis()
        };
        const second = service.getPhotoAiPolicyState();
        assert.notStrictEqual(second, first);
        assert.strictEqual(second.consent.localAnalysisEnabled, true);
        assert.strictEqual(
            second.analysis.aggregate.status,
            PhotoAiAggregateStatus.COMPLETE
        );
    });

    console.info(`ALB-070 AI policy tests: PASS (${assertions} assertions)`);
}

run();
