import assert from "assert";
import {
    PhotoAiCandidateReviewReason,
    PhotoAiCandidateReviewStatus,
    evaluatePhotoAiCandidateInventory
} from "../scripts/PhotoAiCandidateInventory";
import {
    completePhotoAiCandidateInventory
} from "./fixtures/PhotoAiCandidateFixture";

{
    const result = evaluatePhotoAiCandidateInventory({
        unsafePath: "/private/model.onnx"
    });
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.UNKNOWN_SCHEMA
    ));
    assert.strictEqual(Object.hasOwn(result, "unsafePath"), false);
}

{
    const result = evaluatePhotoAiCandidateInventory(
        completePhotoAiCandidateInventory()
    );
    assert.strictEqual(
        result.status,
        PhotoAiCandidateReviewStatus.ELIGIBLE_FOR_TECHNICAL_EVALUATION
    );
    assert.deepStrictEqual(result.reasonCodes, []);
    assert.deepStrictEqual(
        result.artifacts.map(artifact => artifact.kind),
        ["MODEL", "RUNTIME", "GLUE", "NOTICES"]
    );
}

{
    const input = completePhotoAiCandidateInventory();
    input.artifacts = input.artifacts.filter(({ kind }) => kind !== "NOTICES");
    const result = evaluatePhotoAiCandidateInventory(input);
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.ARTIFACT_INVENTORY_INCOMPLETE
    ));
}

{
    const result = evaluatePhotoAiCandidateInventory(
        completePhotoAiCandidateInventory({
            candidate: { modelDigest: `sha256:${"e".repeat(64)}` }
        })
    );
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.ARTIFACT_DIGEST_INVALID
    ));
}

{
    const result = evaluatePhotoAiCandidateInventory(
        completePhotoAiCandidateInventory({
            candidate: {
                sourceUrl: "https://example.com/model?access_token=secret"
            }
        })
    );
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.SOURCE_EVIDENCE_INCOMPLETE
    ));
    assert.strictEqual(result.candidate.sourceUrl, null);
}

{
    const result = evaluatePhotoAiCandidateInventory(
        completePhotoAiCandidateInventory({
            licensing: {
                commercialUseAllowed: false,
                redistributionAllowed: false,
                researchOnly: true,
                fieldOfUseRestriction: true
            }
        })
    );
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.REJECTED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.COMMERCIAL_USE_NOT_APPROVED
    ));
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.REDISTRIBUTION_NOT_APPROVED
    ));
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.RESEARCH_ONLY_TERMS
    ));
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.FIELD_OF_USE_RESTRICTION
    ));
}

{
    const result = evaluatePhotoAiCandidateInventory(
        completePhotoAiCandidateInventory({
            licensing: {
                trainingDataDisclosure: { status: "NOT_DISCLOSED" }
            }
        })
    );
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.REJECTED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.TRAINING_DATA_DISCLOSURE_REJECTED
    ));
}

{
    const result = evaluatePhotoAiCandidateInventory(
        completePhotoAiCandidateInventory({
            review: { decision: "PENDING" }
        })
    );
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.REVIEW_EVIDENCE_INCOMPLETE
    ));
}

{
    const result = evaluatePhotoAiCandidateInventory(
        completePhotoAiCandidateInventory({
            review: { reviewedAt: "2026-99-99" }
        })
    );
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.REVIEW_EVIDENCE_INCOMPLETE
    ));
}

{
    const result = evaluatePhotoAiCandidateInventory(
        completePhotoAiCandidateInventory({
            review: { decision: "REJECTED" }
        })
    );
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.REJECTED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.REVIEW_REJECTED
    ));
}

{
    const input = completePhotoAiCandidateInventory({
        licensing: { obligations: ["NOTICE", "unsafe obligation"] }
    });
    const result = evaluatePhotoAiCandidateInventory(input);
    assert.strictEqual(result.status, PhotoAiCandidateReviewStatus.BLOCKED);
    assert(result.reasonCodes.includes(
        PhotoAiCandidateReviewReason.ATTRIBUTION_OBLIGATIONS_INCOMPLETE
    ));
}

console.log("ALB-111 model candidate licensing gate tests passed.");
