function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

function boundedIdentifier(value, maximumLength = 80) {
    return typeof value === "string" &&
        value.length > 0 &&
        value.length <= maximumLength &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
        ? value
        : null;
}

function safeHttpsUrl(value) {
    if (typeof value !== "string" || value.length > 512) return null;
    try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" &&
            !parsed.username &&
            !parsed.password &&
            !parsed.search &&
            !parsed.hash
            ? parsed.toString()
            : null;
    } catch (_error) {
        return null;
    }
}

function sha256Digest(value) {
    return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value)
        ? value
        : null;
}

function nonNegativeInteger(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function calendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
        ? value
        : null;
}

export const PHOTO_AI_CANDIDATE_INVENTORY_SCHEMA = 1;

export const PhotoAiCandidateReviewStatus = Object.freeze({
    BLOCKED: "BLOCKED",
    REJECTED: "REJECTED",
    ELIGIBLE_FOR_TECHNICAL_EVALUATION:
        "ELIGIBLE_FOR_TECHNICAL_EVALUATION"
});

export const PhotoAiCandidateReviewReason = Object.freeze({
    UNKNOWN_SCHEMA: "UNKNOWN_SCHEMA",
    CANDIDATE_IDENTITY_INVALID: "CANDIDATE_IDENTITY_INVALID",
    SOURCE_EVIDENCE_INCOMPLETE: "SOURCE_EVIDENCE_INCOMPLETE",
    ARTIFACT_INVENTORY_INCOMPLETE: "ARTIFACT_INVENTORY_INCOMPLETE",
    ARTIFACT_DIGEST_INVALID: "ARTIFACT_DIGEST_INVALID",
    WEIGHTS_LICENSE_INCOMPLETE: "WEIGHTS_LICENSE_INCOMPLETE",
    CODE_LICENSE_INCOMPLETE: "CODE_LICENSE_INCOMPLETE",
    TRAINING_DATA_DISCLOSURE_INCOMPLETE:
        "TRAINING_DATA_DISCLOSURE_INCOMPLETE",
    TRAINING_DATA_DISCLOSURE_REJECTED:
        "TRAINING_DATA_DISCLOSURE_REJECTED",
    COMMERCIAL_USE_NOT_APPROVED: "COMMERCIAL_USE_NOT_APPROVED",
    REDISTRIBUTION_NOT_APPROVED: "REDISTRIBUTION_NOT_APPROVED",
    RESEARCH_ONLY_TERMS: "RESEARCH_ONLY_TERMS",
    FIELD_OF_USE_RESTRICTION: "FIELD_OF_USE_RESTRICTION",
    ATTRIBUTION_OBLIGATIONS_INCOMPLETE:
        "ATTRIBUTION_OBLIGATIONS_INCOMPLETE",
    REVIEW_EVIDENCE_INCOMPLETE: "REVIEW_EVIDENCE_INCOMPLETE",
    REVIEW_REJECTED: "REVIEW_REJECTED"
});

const REQUIRED_ARTIFACT_KINDS = Object.freeze([
    "MODEL",
    "RUNTIME",
    "GLUE",
    "NOTICES"
]);

function normalizeArtifact(value) {
    const source = objectValue(value);
    const kind = REQUIRED_ARTIFACT_KINDS.includes(source.kind)
        ? source.kind
        : null;
    const artifactId = boundedIdentifier(source.artifactId);
    const sourceUrl = safeHttpsUrl(source.sourceUrl);
    const digest = sha256Digest(source.digest);
    const bytes = nonNegativeInteger(source.bytes);
    if (!kind || !artifactId || !sourceUrl || bytes === null) return null;
    return Object.freeze({ kind, artifactId, sourceUrl, digest, bytes });
}

function normalizeLicense(value) {
    const source = objectValue(value);
    const licenseId = boundedIdentifier(source.licenseId, 120);
    const sourceUrl = safeHttpsUrl(source.sourceUrl);
    return licenseId && sourceUrl
        ? Object.freeze({ licenseId, sourceUrl })
        : null;
}

function normalizeObligations(value) {
    if (!Array.isArray(value) || value.length > 16) return null;
    const obligations = value.map(item => boundedIdentifier(item, 80));
    return obligations.some(item => !item)
        ? null
        : Object.freeze([...new Set(obligations)].sort());
}

function normalizeReview(value) {
    const source = objectValue(value);
    const decision = ["APPROVED", "PENDING", "REJECTED"]
        .includes(source.decision)
        ? source.decision
        : null;
    const reviewId = boundedIdentifier(source.reviewId, 120);
    const reviewerRole = boundedIdentifier(source.reviewerRole, 80);
    const reviewedAt = calendarDate(source.reviewedAt);
    return decision && reviewId && reviewerRole && reviewedAt
        ? Object.freeze({
            decision,
            reviewId,
            reviewerRole,
            reviewedAt,
            noticesComplete: source.noticesComplete === true,
            obligationsAccepted: source.obligationsAccepted === true
        })
        : null;
}

/**
 * Validates public-safe inventory and recorded human licensing review evidence.
 * It does not interpret license text or replace legal review.
 */
export function evaluatePhotoAiCandidateInventory(value = {}) {
    const source = objectValue(value);
    const blockedReasons = new Set();
    const rejectedReasons = new Set();
    if (source.schemaVersion !== PHOTO_AI_CANDIDATE_INVENTORY_SCHEMA) {
        blockedReasons.add(PhotoAiCandidateReviewReason.UNKNOWN_SCHEMA);
    }

    const candidate = objectValue(source.candidate);
    const candidateId = boundedIdentifier(candidate.candidateId);
    const modelVersion = boundedIdentifier(candidate.modelVersion);
    const modelDigest = sha256Digest(candidate.modelDigest);
    const sourceUrl = safeHttpsUrl(candidate.sourceUrl);
    if (!candidateId || !modelVersion || candidate.providerKind !== "LOCAL_WASM") {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.CANDIDATE_IDENTITY_INVALID
        );
    }
    if (!sourceUrl) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.SOURCE_EVIDENCE_INCOMPLETE
        );
    }
    if (!modelDigest) {
        blockedReasons.add(PhotoAiCandidateReviewReason.ARTIFACT_DIGEST_INVALID);
    }

    const artifactsByKind = new Map();
    let artifactInvalid = false;
    for (const value of (Array.isArray(source.artifacts)
        ? source.artifacts
        : [])) {
        const artifact = normalizeArtifact(value);
        if (!artifact || artifactsByKind.has(artifact.kind)) {
            artifactInvalid = true;
            continue;
        }
        artifactsByKind.set(artifact.kind, artifact);
        if (!artifact.digest) artifactInvalid = true;
    }
    if (artifactInvalid) {
        blockedReasons.add(PhotoAiCandidateReviewReason.ARTIFACT_DIGEST_INVALID);
    }
    if (REQUIRED_ARTIFACT_KINDS.some(kind => !artifactsByKind.has(kind))) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.ARTIFACT_INVENTORY_INCOMPLETE
        );
    }
    const modelArtifact = artifactsByKind.get("MODEL");
    if (modelArtifact && modelDigest && modelArtifact.digest !== modelDigest) {
        blockedReasons.add(PhotoAiCandidateReviewReason.ARTIFACT_DIGEST_INVALID);
    }

    const licensing = objectValue(source.licensing);
    const weightsLicense = normalizeLicense(licensing.weights);
    const codeLicense = normalizeLicense(licensing.code);
    if (!weightsLicense) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.WEIGHTS_LICENSE_INCOMPLETE
        );
    }
    if (!codeLicense) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.CODE_LICENSE_INCOMPLETE
        );
    }
    const disclosure = objectValue(licensing.trainingDataDisclosure);
    const disclosureSourceUrl = safeHttpsUrl(disclosure.sourceUrl);
    if (disclosure.status === "NOT_DISCLOSED") {
        rejectedReasons.add(
            PhotoAiCandidateReviewReason
                .TRAINING_DATA_DISCLOSURE_REJECTED
        );
    } else if (disclosure.status !== "DISCLOSED" || !disclosureSourceUrl) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason
                .TRAINING_DATA_DISCLOSURE_INCOMPLETE
        );
    }
    if (licensing.commercialUseAllowed === false) {
        rejectedReasons.add(
            PhotoAiCandidateReviewReason.COMMERCIAL_USE_NOT_APPROVED
        );
    } else if (licensing.commercialUseAllowed !== true) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.COMMERCIAL_USE_NOT_APPROVED
        );
    }
    if (licensing.redistributionAllowed === false) {
        rejectedReasons.add(
            PhotoAiCandidateReviewReason.REDISTRIBUTION_NOT_APPROVED
        );
    } else if (licensing.redistributionAllowed !== true) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.REDISTRIBUTION_NOT_APPROVED
        );
    }
    if (licensing.researchOnly === true) {
        rejectedReasons.add(PhotoAiCandidateReviewReason.RESEARCH_ONLY_TERMS);
    } else if (licensing.researchOnly !== false) {
        blockedReasons.add(PhotoAiCandidateReviewReason.RESEARCH_ONLY_TERMS);
    }
    if (licensing.fieldOfUseRestriction === true) {
        rejectedReasons.add(
            PhotoAiCandidateReviewReason.FIELD_OF_USE_RESTRICTION
        );
    } else if (licensing.fieldOfUseRestriction !== false) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.FIELD_OF_USE_RESTRICTION
        );
    }
    const obligations = normalizeObligations(licensing.obligations);
    if (!obligations) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason
                .ATTRIBUTION_OBLIGATIONS_INCOMPLETE
        );
    }

    const review = normalizeReview(source.review);
    if (!review || !review.noticesComplete || !review.obligationsAccepted) {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.REVIEW_EVIDENCE_INCOMPLETE
        );
    } else if (review.decision === "REJECTED") {
        rejectedReasons.add(PhotoAiCandidateReviewReason.REVIEW_REJECTED);
    } else if (review.decision !== "APPROVED") {
        blockedReasons.add(
            PhotoAiCandidateReviewReason.REVIEW_EVIDENCE_INCOMPLETE
        );
    }

    const reasonCodes = [...new Set([
        ...blockedReasons,
        ...rejectedReasons
    ])].sort();
    const status = rejectedReasons.size
        ? PhotoAiCandidateReviewStatus.REJECTED
        : reasonCodes.length
            ? PhotoAiCandidateReviewStatus.BLOCKED
            : PhotoAiCandidateReviewStatus
                .ELIGIBLE_FOR_TECHNICAL_EVALUATION;
    return Object.freeze({
        schemaVersion: PHOTO_AI_CANDIDATE_INVENTORY_SCHEMA,
        status,
        reasonCodes: Object.freeze(reasonCodes),
        candidate: Object.freeze({
            candidateId,
            modelVersion,
            providerKind: candidate.providerKind === "LOCAL_WASM"
                ? candidate.providerKind
                : null,
            sourceUrl,
            modelDigest
        }),
        artifacts: Object.freeze(REQUIRED_ARTIFACT_KINDS.map(kind =>
            artifactsByKind.get(kind) || null
        )),
        licensing: Object.freeze({
            weights: weightsLicense,
            code: codeLicense,
            trainingDataDisclosure: Object.freeze({
                status: disclosure.status === "DISCLOSED"
                    ? disclosure.status
                    : null,
                sourceUrl: disclosureSourceUrl
            }),
            obligations: obligations || null
        }),
        review
    });
}
