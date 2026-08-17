import {
    PHOTO_AI_ANALYSIS_SCHEMA,
    PhotoAiAggregateStatus,
    PhotoAiProviderKind,
    PhotoAiReasonCode,
    PhotoAiSignalStatus,
    normalizePhotoAiAnalysis
} from "./PhotoAiPolicy";

export const QUALITY_PIPELINE_VERSION = "qpipe-v1.0";
export const QUALITY_POLICY_VERSION = "qpolicy-v1.0";
export const QUALITY_MODEL_ID = "local-quality-heuristic";
export const QUALITY_MODEL_VERSION = "1.0.0";
export const QUALITY_MODEL_DIGEST = "0000000000000000000000000000000000000000000000000000000000000001";
export const QUALITY_LICENSE_ID = "internal-mit-compatible";

export const SignalIds = Object.freeze({
    SHARPNESS: "sharpness_v1",
    EXPOSURE: "exposure_v1",
    CONTRAST: "contrast_v1"
});

export const SignalVersions = Object.freeze({
    [SignalIds.SHARPNESS]: "1.0.0",
    [SignalIds.EXPOSURE]: "1.0.0",
    [SignalIds.CONTRAST]: "1.0.0"
});

/**
 * Extract grayscale luminance buffer from RGBA pixels.
 * Y = (77*R + 150*G + 29*B) >> 8
 */
export function extractLuminance(rgbaPixels, width, height) {
    if (!rgbaPixels || width <= 0 || height <= 0) return null;
    const pixelCount = width * height;
    const luminance = new Uint8Array(pixelCount);
    for (let i = 0, j = 0; i < pixelCount; i++, j += 4) {
        const r = rgbaPixels[j];
        const g = rgbaPixels[j + 1];
        const b = rgbaPixels[j + 2];
        luminance[i] = (77 * r + 150 * g + 29 * b) >> 8;
    }
    return luminance;
}

/**
 * Compute sharpness using Laplacian variance on luminance.
 * Laplacian kernel: [0, 1, 0; 1, -4, 1; 0, 1, 0]
 */
export function computeSharpnessScore(luminance, width, height) {
    if (!luminance || width < 3 || height < 3) {
        return { score: 0, variance: 0, status: PhotoAiSignalStatus.FAILED };
    }

    let sum = 0;
    let sumSq = 0;
    let count = 0;

    for (let y = 1; y < height - 1; y++) {
        const rowOffset = y * width;
        const prevRowOffset = (y - 1) * width;
        const nextRowOffset = (y + 1) * width;

        for (let x = 1; x < width - 1; x++) {
            const center = luminance[rowOffset + x];
            const up = luminance[prevRowOffset + x];
            const down = luminance[nextRowOffset + x];
            const left = luminance[rowOffset + x - 1];
            const right = luminance[rowOffset + x + 1];

            const laplacian = up + down + left + right - (4 * center);
            sum += laplacian;
            sumSq += laplacian * laplacian;
            count++;
        }
    }

    if (count === 0) {
        return { score: 0, variance: 0, status: PhotoAiSignalStatus.FAILED };
    }

    const mean = sum / count;
    const variance = (sumSq / count) - (mean * mean);
    const nonNegativeVariance = Math.max(0, variance);

    // Bounded sigmoid scaling: K = 400
    const K = 400.0;
    const rawScore = nonNegativeVariance / (nonNegativeVariance + K);
    const score = Math.max(0, Math.min(1, Math.round(rawScore * 1000) / 1000));

    return {
        score,
        variance: Math.round(nonNegativeVariance * 100) / 100,
        status: PhotoAiSignalStatus.SUCCEEDED
    };
}

/**
 * Compute exposure score from 256-bin luminance histogram.
 * Penalizes excessive clipping at blacks (< 10) and whites (> 245),
 * and scores midtone luminance distribution.
 */
export function computeExposureScore(luminance, width, height) {
    if (!luminance || width <= 0 || height <= 0) {
        return { score: 0, meanLuminance: 0, status: PhotoAiSignalStatus.FAILED };
    }

    const pixelCount = width * height;
    const histogram = new Uint32Array(256);
    let sum = 0;

    for (let i = 0; i < pixelCount; i++) {
        const val = luminance[i];
        histogram[val]++;
        sum += val;
    }

    const meanLuminance = sum / pixelCount;

    let darkClippingCount = 0;
    for (let i = 0; i < 10; i++) {
        darkClippingCount += histogram[i];
    }
    const darkRatio = darkClippingCount / pixelCount;

    let brightClippingCount = 0;
    for (let i = 245; i < 256; i++) {
        brightClippingCount += histogram[i];
    }
    const brightRatio = brightClippingCount / pixelCount;

    // Ideal mean is ~128. Deviation penalty:
    const meanPenalty = Math.abs(meanLuminance - 128) / 256.0;
    const clippingPenalty = (darkRatio * 1.5) + (brightRatio * 1.5);

    const rawScore = Math.max(0, 1.0 - meanPenalty - clippingPenalty);
    const score = Math.max(0, Math.min(1, Math.round(rawScore * 1000) / 1000));

    return {
        score,
        meanLuminance: Math.round(meanLuminance * 100) / 100,
        darkRatio: Math.round(darkRatio * 1000) / 1000,
        brightRatio: Math.round(brightRatio * 1000) / 1000,
        status: PhotoAiSignalStatus.SUCCEEDED
    };
}

/**
 * Compute contrast score based on standard deviation of luminance.
 */
export function computeContrastScore(luminance, width, height) {
    if (!luminance || width <= 0 || height <= 0) {
        return { score: 0, stdDev: 0, status: PhotoAiSignalStatus.FAILED };
    }

    const pixelCount = width * height;
    let sum = 0;
    let sumSq = 0;

    for (let i = 0; i < pixelCount; i++) {
        const val = luminance[i];
        sum += val;
        sumSq += val * val;
    }

    const mean = sum / pixelCount;
    const variance = Math.max(0, (sumSq / pixelCount) - (mean * mean));
    const stdDev = Math.sqrt(variance);

    // Standard deviation of 64 is considered high contrast
    const rawScore = Math.min(1, stdDev / 64.0);
    const score = Math.max(0, Math.min(1, Math.round(rawScore * 1000) / 1000));

    return {
        score,
        stdDev: Math.round(stdDev * 100) / 100,
        status: PhotoAiSignalStatus.SUCCEEDED
    };
}

/**
 * Calculate composite rank score: 50% sharpness + 35% exposure + 15% contrast
 */
export function calculateRankScore(sharpnessScore, exposureScore, contrastScore) {
    const raw = (0.50 * sharpnessScore) + (0.35 * exposureScore) + (0.15 * contrastScore);
    return Math.max(0, Math.min(1, Math.round(raw * 1000) / 1000));
}

/**
 * Derives a full PhotoAiPolicy-compliant analysis structure.
 */
export function derivePhotoQualityAnalysis({
    photoKey,
    photoRevisionKey,
    libraryRevisionKey,
    analysisId,
    createdAt = new Date().toISOString(),
    rgbaPixels,
    width,
    height
} = {}) {
    if (!photoKey || !photoRevisionKey || !libraryRevisionKey || !analysisId) {
        return normalizePhotoAiAnalysis({
            schemaVersion: PHOTO_AI_ANALYSIS_SCHEMA
        });
    }

    const luminance = extractLuminance(rgbaPixels, width, height);
    if (!luminance) {
        return normalizePhotoAiAnalysis({
            schemaVersion: PHOTO_AI_ANALYSIS_SCHEMA,
            photoKey,
            photoRevisionKey,
            libraryRevisionKey,
            analysisId,
            createdAt,
            providerKind: PhotoAiProviderKind.LOCAL_WASM,
            model: {
                modelId: QUALITY_MODEL_ID,
                modelVersion: QUALITY_MODEL_VERSION,
                modelDigest: QUALITY_MODEL_DIGEST,
                licenseId: QUALITY_LICENSE_ID
            },
            preprocessing: {
                pipelineVersion: QUALITY_PIPELINE_VERSION,
                width: width || 1,
                height: height || 1,
                colorSpace: "SRGB"
            },
            signals: [
                {
                    signalId: SignalIds.SHARPNESS,
                    signalVersion: SignalVersions[SignalIds.SHARPNESS],
                    status: PhotoAiSignalStatus.FAILED,
                    score: null,
                    reasonCodes: [PhotoAiReasonCode.SIGNAL_FAILED]
                }
            ],
            aggregate: {
                policyVersion: QUALITY_POLICY_VERSION,
                status: PhotoAiAggregateStatus.UNAVAILABLE,
                rankScore: null,
                reasonCodes: [PhotoAiReasonCode.INVALID_EVIDENCE]
            }
        });
    }

    const sharpness = computeSharpnessScore(luminance, width, height);
    const exposure = computeExposureScore(luminance, width, height);
    const contrast = computeContrastScore(luminance, width, height);

    const signals = [
        {
            signalId: SignalIds.SHARPNESS,
            signalVersion: SignalVersions[SignalIds.SHARPNESS],
            status: sharpness.status,
            score: sharpness.score,
            confidence: 0.95,
            reasonCodes: []
        },
        {
            signalId: SignalIds.EXPOSURE,
            signalVersion: SignalVersions[SignalIds.EXPOSURE],
            status: exposure.status,
            score: exposure.score,
            confidence: 0.95,
            reasonCodes: []
        },
        {
            signalId: SignalIds.CONTRAST,
            signalVersion: SignalVersions[SignalIds.CONTRAST],
            status: contrast.status,
            score: contrast.score,
            confidence: 0.90,
            reasonCodes: []
        }
    ];

    const rankScore = calculateRankScore(sharpness.score, exposure.score, contrast.score);

    return normalizePhotoAiAnalysis({
        schemaVersion: PHOTO_AI_ANALYSIS_SCHEMA,
        photoKey,
        photoRevisionKey,
        libraryRevisionKey,
        analysisId,
        createdAt,
        providerKind: PhotoAiProviderKind.LOCAL_WASM,
        model: {
            modelId: QUALITY_MODEL_ID,
            modelVersion: QUALITY_MODEL_VERSION,
            modelDigest: QUALITY_MODEL_DIGEST,
            licenseId: QUALITY_LICENSE_ID
        },
        preprocessing: {
            pipelineVersion: QUALITY_PIPELINE_VERSION,
            width,
            height,
            colorSpace: "SRGB"
        },
        signals,
        aggregate: {
            policyVersion: QUALITY_POLICY_VERSION,
            status: PhotoAiAggregateStatus.COMPLETE,
            rankScore,
            reasonCodes: []
        }
    });
}
