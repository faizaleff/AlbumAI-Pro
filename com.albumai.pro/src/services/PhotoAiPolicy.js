export const PHOTO_AI_ANALYSIS_SCHEMA = 1;
export const PHOTO_AI_CONSENT_SCHEMA = 1;

export const PhotoAiProviderKind = Object.freeze({
    LOCAL_WASM: "LOCAL_WASM"
});

export const PhotoAiCapabilityStatus = Object.freeze({
    AVAILABLE: "AVAILABLE",
    UNAVAILABLE: "UNAVAILABLE",
    UNSUPPORTED: "UNSUPPORTED"
});

export const PhotoAiSignalStatus = Object.freeze({
    SUCCEEDED: "SUCCEEDED",
    UNSUPPORTED: "UNSUPPORTED",
    CANCELLED: "CANCELLED",
    FAILED: "FAILED"
});

export const PhotoAiAggregateStatus = Object.freeze({
    COMPLETE: "COMPLETE",
    PARTIAL: "PARTIAL",
    UNAVAILABLE: "UNAVAILABLE"
});

export const PhotoAiReasonCode = Object.freeze({
    EVIDENCE_UNAVAILABLE: "EVIDENCE_UNAVAILABLE",
    UNKNOWN_SCHEMA: "UNKNOWN_SCHEMA",
    INVALID_EVIDENCE: "INVALID_EVIDENCE",
    INVALID_RESULT: "INVALID_RESULT",
    RUNTIME_UNSUPPORTED: "RUNTIME_UNSUPPORTED",
    RUNTIME_UNAVAILABLE: "RUNTIME_UNAVAILABLE",
    MODEL_UNAVAILABLE: "MODEL_UNAVAILABLE",
    LICENSE_UNAPPROVED: "LICENSE_UNAPPROVED",
    CAPABILITY_CHECK_FAILED: "CAPABILITY_CHECK_FAILED",
    SIGNAL_FAILED: "SIGNAL_FAILED",
    SIGNAL_UNSUPPORTED: "SIGNAL_UNSUPPORTED",
    CANCELLED: "CANCELLED",
    STALE_INPUT: "STALE_INPUT",
    INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE"
});

const PROVIDERS = new Set(Object.values(PhotoAiProviderKind));
const CAPABILITY_STATUSES = new Set(Object.values(PhotoAiCapabilityStatus));
const SIGNAL_STATUSES = new Set(Object.values(PhotoAiSignalStatus));
const REASON_CODES = new Set(Object.values(PhotoAiReasonCode));
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._+-]{0,79}$/;
const PHOTO_KEY = /^p1-[0-9a-f]{16}$/;
const PHOTO_REVISION_KEY = /^r1-[0-9a-f]{16}$/;
const LIBRARY_REVISION_KEY = /^l1-[0-9a-f]{16}$/;
const ANALYSIS_ID = /^a1-[0-9a-f]{16,64}$/;
const MODEL_DIGEST = /^[0-9a-f]{64}$/;
const MAX_SIGNALS = 32;
const MAX_REASON_CODES = 12;

function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

function safeId(value) {
    return typeof value === "string" && SAFE_ID.test(value)
        ? value
        : null;
}

function safeKey(value, pattern) {
    return typeof value === "string" && pattern.test(value)
        ? value
        : null;
}

function normalizedTimestamp(value) {
    if (typeof value !== "string") return null;
    const timestamp = new Date(value);
    return Number.isFinite(timestamp.getTime())
        ? timestamp.toISOString()
        : null;
}

function boundedScore(value) {
    return typeof value === "number" &&
        Number.isFinite(value) &&
        value >= 0 &&
        value <= 1
        ? value
        : null;
}

function boundedInteger(value, maximum) {
    return Number.isSafeInteger(value) && value > 0 && value <= maximum
        ? value
        : null;
}

function normalizedReasonCodes(value, fallback = []) {
    const requested = Array.isArray(value) ? value : [];
    const allowed = requested
        .slice(0, MAX_REASON_CODES)
        .filter(item => REASON_CODES.has(item));
    const candidates = allowed.length ? allowed : fallback;
    return Object.freeze([...new Set(candidates
        .filter(item => REASON_CODES.has(item)))].sort());
}

function unavailableAnalysis(reasonCode = PhotoAiReasonCode.EVIDENCE_UNAVAILABLE) {
    return Object.freeze({
        schemaVersion: PHOTO_AI_ANALYSIS_SCHEMA,
        photoKey: null,
        photoRevisionKey: null,
        libraryRevisionKey: null,
        analysisId: null,
        createdAt: null,
        providerKind: null,
        model: null,
        preprocessing: null,
        signals: Object.freeze([]),
        aggregate: Object.freeze({
            policyVersion: null,
            status: PhotoAiAggregateStatus.UNAVAILABLE,
            rankScore: null,
            reasonCodes: Object.freeze([reasonCode])
        })
    });
}

function normalizeModel(value) {
    const source = objectValue(value);
    const modelId = safeId(source.modelId);
    const modelVersion = safeId(source.modelVersion);
    const modelDigest = typeof source.modelDigest === "string" &&
        MODEL_DIGEST.test(source.modelDigest)
        ? source.modelDigest
        : null;
    const licenseId = safeId(source.licenseId);
    if (!modelId || !modelVersion || !modelDigest || !licenseId) return null;
    return Object.freeze({ modelId, modelVersion, modelDigest, licenseId });
}

function normalizePreprocessing(value) {
    const source = objectValue(value);
    const pipelineVersion = safeId(source.pipelineVersion);
    const width = boundedInteger(source.width, 8192);
    const height = boundedInteger(source.height, 8192);
    const colorSpace = ["SRGB", "RGB"].includes(source.colorSpace)
        ? source.colorSpace
        : null;
    if (!pipelineVersion || !width || !height || !colorSpace) return null;
    return Object.freeze({ pipelineVersion, width, height, colorSpace });
}

function normalizeSignal(value) {
    const source = objectValue(value);
    const signalId = safeId(source.signalId);
    const signalVersion = safeId(source.signalVersion);
    const requestedStatus = SIGNAL_STATUSES.has(source.status)
        ? source.status
        : PhotoAiSignalStatus.FAILED;
    if (!signalId || !signalVersion) return null;
    let status = requestedStatus;
    let score = null;
    let confidence = null;
    let fallbackReasons = [];
    if (status === PhotoAiSignalStatus.SUCCEEDED) {
        score = boundedScore(source.score);
        confidence = source.confidence === null ||
            source.confidence === undefined
            ? null
            : boundedScore(source.confidence);
        if (score === null || (
            source.confidence !== null &&
            source.confidence !== undefined &&
            confidence === null
        )) {
            status = PhotoAiSignalStatus.FAILED;
            score = null;
            confidence = null;
            fallbackReasons = [PhotoAiReasonCode.INVALID_RESULT];
        }
    } else if (status === PhotoAiSignalStatus.CANCELLED) {
        fallbackReasons = [PhotoAiReasonCode.CANCELLED];
    } else if (status === PhotoAiSignalStatus.UNSUPPORTED) {
        fallbackReasons = [PhotoAiReasonCode.SIGNAL_UNSUPPORTED];
    } else {
        fallbackReasons = [PhotoAiReasonCode.SIGNAL_FAILED];
    }
    return Object.freeze({
        signalId,
        signalVersion,
        status,
        score,
        confidence,
        reasonCodes: normalizedReasonCodes(
            source.reasonCodes,
            fallbackReasons
        )
    });
}

function normalizeSignals(value) {
    const byId = new Map();
    for (const candidate of (Array.isArray(value) ? value : [])
        .slice(0, MAX_SIGNALS)) {
        const signal = normalizeSignal(candidate);
        if (signal && !byId.has(signal.signalId)) {
            byId.set(signal.signalId, signal);
        }
    }
    return Object.freeze([...byId.values()].sort((left, right) =>
        left.signalId.localeCompare(right.signalId)
    ));
}

function aggregateStatus(signals) {
    const succeeded = signals.filter(signal =>
        signal.status === PhotoAiSignalStatus.SUCCEEDED
    ).length;
    if (signals.length > 0 && succeeded === signals.length) {
        return PhotoAiAggregateStatus.COMPLETE;
    }
    if (succeeded > 0) return PhotoAiAggregateStatus.PARTIAL;
    return PhotoAiAggregateStatus.UNAVAILABLE;
}

export function normalizePhotoAiAnalysis(value = {}) {
    const source = objectValue(value);
    if (source.schemaVersion !== PHOTO_AI_ANALYSIS_SCHEMA) {
        return unavailableAnalysis(
            Object.keys(source).length
                ? PhotoAiReasonCode.UNKNOWN_SCHEMA
                : PhotoAiReasonCode.EVIDENCE_UNAVAILABLE
        );
    }
    const photoKey = safeKey(source.photoKey, PHOTO_KEY);
    const photoRevisionKey = safeKey(
        source.photoRevisionKey,
        PHOTO_REVISION_KEY
    );
    const libraryRevisionKey = safeKey(
        source.libraryRevisionKey,
        LIBRARY_REVISION_KEY
    );
    const analysisId = safeKey(source.analysisId, ANALYSIS_ID);
    const createdAt = normalizedTimestamp(source.createdAt);
    const providerKind = PROVIDERS.has(source.providerKind)
        ? source.providerKind
        : null;
    const model = normalizeModel(source.model);
    const preprocessing = normalizePreprocessing(source.preprocessing);
    const aggregateSource = objectValue(source.aggregate);
    const policyVersion = safeId(aggregateSource.policyVersion);
    if (
        !photoKey || !photoRevisionKey || !libraryRevisionKey ||
        !analysisId || !createdAt || !providerKind || !model ||
        !preprocessing || !policyVersion
    ) {
        return unavailableAnalysis(PhotoAiReasonCode.INVALID_EVIDENCE);
    }
    const signals = normalizeSignals(source.signals);
    const status = aggregateStatus(signals);
    const rankScore = status === PhotoAiAggregateStatus.UNAVAILABLE
        ? null
        : boundedScore(aggregateSource.rankScore);
    const defaultReasons = status === PhotoAiAggregateStatus.UNAVAILABLE
        ? [PhotoAiReasonCode.INSUFFICIENT_EVIDENCE]
        : status === PhotoAiAggregateStatus.PARTIAL
            ? [PhotoAiReasonCode.SIGNAL_FAILED]
            : [];
    return Object.freeze({
        schemaVersion: PHOTO_AI_ANALYSIS_SCHEMA,
        photoKey,
        photoRevisionKey,
        libraryRevisionKey,
        analysisId,
        createdAt,
        providerKind,
        model,
        preprocessing,
        signals,
        aggregate: Object.freeze({
            policyVersion,
            status,
            rankScore,
            reasonCodes: normalizedReasonCodes(
                aggregateSource.reasonCodes,
                defaultReasons
            )
        })
    });
}

export function serializePublicPhotoAiAnalysis(value = {}) {
    return normalizePhotoAiAnalysis(value);
}

export function normalizePhotoAiConsent(value = {}) {
    const source = objectValue(value);
    const disclosureVersion = safeId(source.disclosureVersion);
    const consentedAt = normalizedTimestamp(source.consentedAt);
    const localAnalysisEnabled =
        source.schemaVersion === PHOTO_AI_CONSENT_SCHEMA &&
        source.localAnalysisEnabled === true &&
        Boolean(disclosureVersion) &&
        Boolean(consentedAt);
    return Object.freeze({
        schemaVersion: PHOTO_AI_CONSENT_SCHEMA,
        localAnalysisEnabled,
        remoteInferenceEnabled: false,
        disclosureVersion: localAnalysisEnabled ? disclosureVersion : null,
        consentedAt: localAnalysisEnabled ? consentedAt : null
    });
}

export function grantLocalPhotoAiConsent({ disclosureVersion, consentedAt } = {}) {
    return normalizePhotoAiConsent({
        schemaVersion: PHOTO_AI_CONSENT_SCHEMA,
        localAnalysisEnabled: true,
        remoteInferenceEnabled: false,
        disclosureVersion,
        consentedAt
    });
}

export function revokePhotoAiConsent() {
    return normalizePhotoAiConsent();
}

export function normalizePhotoAiCapability(value = {}) {
    const source = objectValue(value);
    let status = CAPABILITY_STATUSES.has(source.status)
        ? source.status
        : PhotoAiCapabilityStatus.UNAVAILABLE;
    const providerKind = PROVIDERS.has(source.providerKind)
        ? source.providerKind
        : null;
    const runtimeVersion = safeId(source.runtimeVersion);
    if (
        status === PhotoAiCapabilityStatus.AVAILABLE &&
        (!providerKind || !runtimeVersion)
    ) {
        status = PhotoAiCapabilityStatus.UNAVAILABLE;
    }
    const fallbackReasons = status === PhotoAiCapabilityStatus.UNSUPPORTED
        ? [PhotoAiReasonCode.RUNTIME_UNSUPPORTED]
        : status === PhotoAiCapabilityStatus.UNAVAILABLE
            ? [PhotoAiReasonCode.RUNTIME_UNAVAILABLE]
            : [];
    return Object.freeze({
        status,
        providerKind: status === PhotoAiCapabilityStatus.AVAILABLE
            ? providerKind
            : null,
        runtimeVersion: status === PhotoAiCapabilityStatus.AVAILABLE
            ? runtimeVersion
            : null,
        reasonCodes: normalizedReasonCodes(
            source.reasonCodes,
            fallbackReasons
        )
    });
}

function normalizedSignalVersions(value) {
    const source = objectValue(value);
    return Object.keys(source).sort().map(signalId => [
        safeId(signalId),
        safeId(source[signalId])
    ]).filter(([signalId, version]) => signalId && version);
}

export function isPhotoAiAnalysisCacheCompatible(value, expected = {}) {
    const analysis = normalizePhotoAiAnalysis(value);
    const source = objectValue(expected);
    if (analysis.aggregate.status === PhotoAiAggregateStatus.UNAVAILABLE) {
        return false;
    }
    const expectedVersions = normalizedSignalVersions(source.signalVersions);
    const actualVersions = analysis.signals.map(signal => [
        signal.signalId,
        signal.signalVersion
    ]);
    return analysis.photoKey === source.photoKey &&
        analysis.photoRevisionKey === source.photoRevisionKey &&
        analysis.libraryRevisionKey === source.libraryRevisionKey &&
        analysis.providerKind === source.providerKind &&
        analysis.model.modelDigest === source.modelDigest &&
        analysis.preprocessing.pipelineVersion === source.pipelineVersion &&
        analysis.aggregate.policyVersion === source.policyVersion &&
        JSON.stringify(actualVersions) === JSON.stringify(expectedVersions);
}

export function canPublishPhotoAiAnalysis(value, current = {}) {
    const source = objectValue(current);
    const consent = normalizePhotoAiConsent(source.consent);
    const analysis = normalizePhotoAiAnalysis(value);
    return consent.localAnalysisEnabled &&
        source.isCurrent === true &&
        analysis.analysisId !== null &&
        analysis.analysisId === source.analysisId &&
        isPhotoAiAnalysisCacheCompatible(analysis, source);
}
