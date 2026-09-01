import assert from "assert";
import {
    extractLuminance,
    computeSharpnessScore,
    computeExposureScore,
    computeContrastScore,
    calculateRankScore,
    derivePhotoQualityAnalysis,
    SignalIds,
    QUALITY_POLICY_VERSION,
    QUALITY_PIPELINE_VERSION
} from "../src/services/PhotoQualitySignalEngine";
import {
    applyCameraClockCorrections,
    groupPhotosByBurst,
    groupPhotosByEvent,
    buildPhotoGroupIndex,
    detectCameras,
    normalizeCameraClockOffsets,
    updateCameraClockOffset
} from "../src/services/PhotoGroupingEngine";
import {
    assignPhotosToEventChapter,
    createPhotoEventChapter,
    deleteEmptyPhotoEventChapter,
    findUnassignedPhotoEventChapterPhotos,
    movePhotoEventChapter,
    mergePhotoEventChapters,
    normalizePhotoEventChapters,
    photoDecisionKey,
    removePhotosFromEventChapters,
    renamePhotoEventChapter
} from "../src/services/PhotoBrowserModel";
import {
    PHOTO_AI_ANALYSIS_SCHEMA,
    PhotoAiAggregateStatus,
    PhotoAiProviderKind,
    PhotoAiReasonCode,
    PhotoAiSignalStatus,
    normalizePhotoAiAnalysis,
    normalizePhotoAiConsent,
    grantLocalPhotoAiConsent,
    revokePhotoAiConsent
} from "../src/services/PhotoAiPolicy";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export async function runAlb071Tests() {
    console.info("Starting ALB-071 Photo Quality & Grouping tests...");

    // Test 1: Luminance extraction
    {
        const width = 2;
        const height = 2;
        // 4 pixels: red, green, blue, white
        const rgba = new Uint8Array([
            255, 0, 0, 255,     // red -> ~76
            0, 255, 0, 255,     // green -> ~149
            0, 0, 255, 255,     // blue -> ~28
            255, 255, 255, 255  // white -> 255
        ]);
        const lum = extractLuminance(rgba, width, height);
        check(lum instanceof Uint8Array, "extractLuminance returns Uint8Array");
        check(lum.length === 4, "extractLuminance produces correct length");
        check(lum[0] === 76, `Red luminance is 76 (got ${lum[0]})`);
        check(lum[1] === 149, `Green luminance is 149 (got ${lum[1]})`);
        check(lum[2] === 28, `Blue luminance is 28 (got ${lum[2]})`);
        check(lum[3] === 255, `White luminance is 255 (got ${lum[3]})`);

        // Null / edge handling
        check(extractLuminance(null, 10, 10) === null, "extractLuminance handles null buffer");
        check(extractLuminance(rgba, 0, 10) === null, "extractLuminance handles 0 width");
    }

    // Test 2: Sharpness calculation
    {
        const size = 16;
        const pixelCount = size * size;
        
        // 2a: Flat uniform image (zero Laplacian variance)
        const flatLum = new Uint8Array(pixelCount).fill(128);
        const flatSharpness = computeSharpnessScore(flatLum, size, size);
        check(flatSharpness.status === PhotoAiSignalStatus.SUCCEEDED, "Flat sharpness succeeded");
        check(flatSharpness.score === 0, `Flat image sharpness is 0 (got ${flatSharpness.score})`);
        check(flatSharpness.variance === 0, "Flat image variance is 0");

        // 2b: High frequency alternating pattern (crisp checkerboard)
        const crispLum = new Uint8Array(pixelCount);
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                crispLum[y * size + x] = (x + y) % 2 === 0 ? 0 : 255;
            }
        }
        const crispSharpness = computeSharpnessScore(crispLum, size, size);
        check(crispSharpness.status === PhotoAiSignalStatus.SUCCEEDED, "Crisp sharpness succeeded");
        check(crispSharpness.score > 0.8, `Crisp image has high sharpness score (got ${crispSharpness.score})`);
        check(crispSharpness.variance > 1000, `Crisp image has high variance (got ${crispSharpness.variance})`);

        // 2c: Edge / invalid dimensions
        const smallSharpness = computeSharpnessScore(new Uint8Array(4), 2, 2);
        check(smallSharpness.status === PhotoAiSignalStatus.FAILED, "Too small image fails sharpness safely");
    }

    // Test 3: Exposure score
    {
        const size = 16;
        const pixelCount = size * size;

        // 3a: Perfectly exposed midtone image (all 128)
        const midtoneLum = new Uint8Array(pixelCount).fill(128);
        const midExposure = computeExposureScore(midtoneLum, size, size);
        check(midExposure.status === PhotoAiSignalStatus.SUCCEEDED, "Midtone exposure succeeded");
        check(midExposure.score === 1.0, `Midtone exposure score is 1.0 (got ${midExposure.score})`);
        check(midExposure.darkRatio === 0, "Midtone darkRatio is 0");
        check(midExposure.brightRatio === 0, "Midtone brightRatio is 0");

        // 3b: Completely black image (under-exposed)
        const blackLum = new Uint8Array(pixelCount).fill(0);
        const blackExposure = computeExposureScore(blackLum, size, size);
        check(blackExposure.score === 0, `All black exposure score is 0 (got ${blackExposure.score})`);
        check(blackExposure.darkRatio === 1.0, "Black darkRatio is 1.0");

        // 3c: Completely white image (over-exposed)
        const whiteLum = new Uint8Array(pixelCount).fill(255);
        const whiteExposure = computeExposureScore(whiteLum, size, size);
        check(whiteExposure.score === 0, `All white exposure score is 0 (got ${whiteExposure.score})`);
        check(whiteExposure.brightRatio === 1.0, "White brightRatio is 1.0");
    }

    // Test 4: Contrast score
    {
        const size = 16;
        const pixelCount = size * size;

        // Flat image -> 0 contrast
        const flatLum = new Uint8Array(pixelCount).fill(100);
        const flatContrast = computeContrastScore(flatLum, size, size);
        check(flatContrast.score === 0, `Flat contrast is 0 (got ${flatContrast.score})`);

        // Half black, half white -> maximum contrast
        const highContrastLum = new Uint8Array(pixelCount);
        for (let i = 0; i < pixelCount; i++) {
            highContrastLum[i] = i < pixelCount / 2 ? 0 : 255;
        }
        const highContrast = computeContrastScore(highContrastLum, size, size);
        check(highContrast.score === 1.0, `High contrast score is 1.0 (got ${highContrast.score})`);
        check(highContrast.stdDev > 100, "High contrast stdDev > 100");
    }

    // Test 5: Composite quality rank calculation
    {
        const score1 = calculateRankScore(1.0, 1.0, 1.0);
        check(score1 === 1.0, `Max score is 1.0 (got ${score1})`);

        const score2 = calculateRankScore(0, 0, 0);
        check(score2 === 0, `Min score is 0 (got ${score2})`);

        const score3 = calculateRankScore(0.8, 0.6, 0.4);
        // (0.5 * 0.8) + (0.35 * 0.6) + (0.15 * 0.4) = 0.40 + 0.21 + 0.06 = 0.67
        check(Math.abs(score3 - 0.67) < 0.01, `Weighted score is ~0.67 (got ${score3})`);
    }

    // Test 6: derivePhotoQualityAnalysis
    {
        const width = 8;
        const height = 8;
        const rgba = new Uint8Array(width * height * 4).fill(128);

        const analysis = derivePhotoQualityAnalysis({
            photoKey: "p1-0123456789abcdef",
            photoRevisionKey: "r1-0123456789abcdef",
            libraryRevisionKey: "l1-0123456789abcdef",
            analysisId: "a1-0123456789abcdef0123456789abcdef",
            rgbaPixels: rgba,
            width,
            height
        });

        check(analysis.schemaVersion === PHOTO_AI_ANALYSIS_SCHEMA, "Analysis schema version is 1");
        check(analysis.aggregate.status === PhotoAiAggregateStatus.COMPLETE, "Analysis aggregate status is COMPLETE");
        check(typeof analysis.aggregate.rankScore === "number", "Analysis rankScore is a number");
        check(analysis.signals.length === 3, "Analysis has 3 signals");
        check(analysis.signals.some(s => s.signalId === SignalIds.SHARPNESS), "Contains sharpness signal");
        check(analysis.signals.some(s => s.signalId === SignalIds.EXPOSURE), "Contains exposure signal");
        check(analysis.signals.some(s => s.signalId === SignalIds.CONTRAST), "Contains contrast signal");

        // Missing keys fail closed
        const malformed = derivePhotoQualityAnalysis({ photoKey: null });
        check(malformed.aggregate.status === PhotoAiAggregateStatus.UNAVAILABLE, "Malformed analysis fails closed");
    }

    // Test 7: Burst grouping
    {
        const baseTime = 1700000000000;
        const photos = [
            { id: "photo-1", dateTaken: baseTime, rating: 3 },
            { id: "photo-2", dateTaken: baseTime + 500, rating: 5 },  // Burst 1 (best)
            { id: "photo-3", dateTaken: baseTime + 1200, rating: 2 }, // Burst 1
            { id: "photo-4", dateTaken: baseTime + 60000, rating: 4 }, // Standalone
            { id: "photo-5", dateTaken: baseTime + 120000, rating: 1 }, // Burst 2
            { id: "photo-6", dateTaken: baseTime + 121000, rating: 4 }  // Burst 2 (best)
        ];

        const bursts = groupPhotosByBurst(photos, 3000);
        check(bursts.length === 2, `Found 2 burst groups (got ${bursts.length})`);
        
        // Burst 1
        check(bursts[0].photoIds.length === 3, "Burst 1 has 3 photos");
        check(bursts[0].bestPhotoId === "photo-2", `Burst 1 best is photo-2 (got ${bursts[0].bestPhotoId})`);
        check(bursts[0].count === 3, "Burst 1 count is 3");

        // Burst 2
        check(bursts[1].photoIds.length === 2, "Burst 2 has 2 photos");
        check(bursts[1].bestPhotoId === "photo-6", `Burst 2 best is photo-6 (got ${bursts[1].bestPhotoId})`);

        // Empty / single photo handling
        check(groupPhotosByBurst([]).length === 0, "Empty photos returns empty bursts");
        check(groupPhotosByBurst([photos[0]]).length === 0, "Single photo produces no burst group");
    }

    // Test 8: Event grouping
    {
        const baseTime = new Date("2026-06-15T10:00:00Z").getTime();
        const photos = [
            // Morning Event (10:00 - 10:15)
            { id: "p1", dateTaken: baseTime },
            { id: "p2", dateTaken: baseTime + (5 * 60 * 1000) },
            { id: "p3", dateTaken: baseTime + (15 * 60 * 1000) },
            // Afternoon Event (14:00 - 14:10) -> 3h 45m gap (> 30m)
            { id: "p4", dateTaken: baseTime + (4 * 60 * 60 * 1000) },
            { id: "p5", dateTaken: baseTime + (4 * 60 * 60 * 1000) + (10 * 60 * 1000) }
        ];

        const events = groupPhotosByEvent(photos, 30 * 60 * 1000);
        check(events.length === 2, `Found 2 events (got ${events.length})`);
        check(events[0].count === 3, "Event 1 has 3 photos");
        check(events[0].photoIds.includes("p1"), "Event 1 includes p1");
        check(events[1].count === 2, "Event 2 has 2 photos");
        check(events[1].photoIds.includes("p4"), "Event 2 includes p4");
    }

    // Test 9: Photo group index lookup
    {
        const baseTime = 1700000000000;
        const photos = [
            { id: "p1", dateTaken: baseTime, rating: 2 },
            { id: "p2", dateTaken: baseTime + 1000, rating: 5 }
        ];
        const index = buildPhotoGroupIndex(photos, { burstThresholdMs: 3000 });
        check(index instanceof Map, "buildPhotoGroupIndex returns a Map");
        
        const p1Info = index.get("p1");
        check(p1Info.burstGroupId === "burst-group-1", "p1 is in burst-group-1");
        check(p1Info.isBurstBest === false, "p1 is not burst best");

        const p2Info = index.get("p2");
        check(p2Info.burstGroupId === "burst-group-1", "p2 is in burst-group-1");
        check(p2Info.isBurstBest === true, "p2 is burst best");
    }

    // Test 10: Persistent per-camera clock correction
    {
        const baseTime = new Date("2026-06-15T10:00:00Z").getTime();
        const photos = [
            {
                id: "canon-1",
                dateTaken: baseTime + 5 * 60 * 1000,
                cameraMake: "Canon",
                cameraModel: "EOS R5"
            },
            {
                id: "sony-1",
                dateTaken: baseTime,
                cameraMake: "Sony",
                cameraModel: "A7 IV"
            }
        ];
        const cameras = detectCameras(photos);
        check(cameras.length === 2, "Two camera identities are detected");
        const canon = cameras.find(camera => camera.label === "Canon EOS R5");
        const correctedOffsets = updateCameraClockOffset(
            {},
            canon.cameraKey,
            -5,
            cameras
        );
        check(correctedOffsets.items.length === 1, "One non-zero correction is persisted");
        check(correctedOffsets.items[0].correctionMinutes === -5, "Signed correction is retained");

        const corrected = applyCameraClockCorrections(
            photos,
            correctedOffsets,
            cameras
        );
        check(corrected[0].dateTaken === baseTime, "Correction is added to Date Taken");
        check(corrected[0].metadata._timeCorrected === true, "Corrected photo is marked in memory");
        check(photos[0].dateTaken === baseTime + 5 * 60 * 1000, "Original photo metadata is unchanged");

        const normalized = normalizeCameraClockOffsets({
            items: [
                { cameraKey: canon.cameraKey, correctionMinutes: 999999 },
                { cameraKey: "stale|camera", correctionMinutes: 10 }
            ]
        }, cameras);
        check(normalized.items.length === 1, "Stale camera corrections are removed");
        check(normalized.items[0].correctionMinutes === 10080, "Corrections are bounded to seven days");
        check(Object.isFrozen(normalized.items), "Normalized camera corrections are immutable");
    }

    // Test 11: Persistent manual event chapters
    {
        const photos = [
            { id: "event-photo-1", name: "001.jpg" },
            { id: "event-photo-2", name: "002.jpg" },
            { id: "event-photo-3", name: "003.jpg" }
        ];
        const first = createPhotoEventChapter({}, photos.slice(0, 2), photos);
        check(first.items.length === 1, "A manual event chapter is created");
        check(first.items[0].photoKeys.length === 2, "Selected photos seed the new event");
        check(!JSON.stringify(first).includes("001.jpg"), "Event metadata does not contain filenames or paths");

        const second = createPhotoEventChapter(first, [photos[2]], photos);
        const renamed = renamePhotoEventChapter(second, "chapter-2", "Reception", photos);
        check(renamed.items[1].name === "Reception", "A manual event can be renamed");

        const reassigned = assignPhotosToEventChapter(
            renamed,
            "chapter-2",
            [photos[1]],
            photos
        );
        const secondPhotoKey = photoDecisionKey(photos[1]);
        check(!reassigned.items[0].photoKeys.includes(secondPhotoKey), "Reassignment removes a photo from its old event");
        check(reassigned.items[1].photoKeys.includes(secondPhotoKey), "Reassignment adds a photo to the target event");

        const unassignedBeforeRemoval = findUnassignedPhotoEventChapterPhotos(
            reassigned,
            photos
        );
        check(unassignedBeforeRemoval.length === 0, "Every chapter member is excluded from the unassigned review");

        const removed = removePhotosFromEventChapters(
            reassigned,
            [photos[1]],
            photos
        );
        check(!removed.items.some(item => item.photoKeys.includes(secondPhotoKey)), "Removing membership clears the selected photo from every event");
        check(findUnassignedPhotoEventChapterPhotos(removed, photos)[0] === photos[1], "Removed membership returns the photo to the unassigned review in library order");
        check(reassigned.items[1].photoKeys.includes(secondPhotoKey), "Removing membership does not mutate the prior chapter model");

        const guardedDelete = deleteEmptyPhotoEventChapter(
            reassigned,
            "chapter-1",
            photos
        );
        check(JSON.stringify(guardedDelete) === JSON.stringify(reassigned), "A non-empty event cannot be deleted");

        const emptyThird = createPhotoEventChapter(reassigned, [], photos);
        const deleted = deleteEmptyPhotoEventChapter(
            emptyThird,
            "chapter-3",
            photos
        );
        check(deleted.items.length === 2, "An empty event can be deleted");
        check(emptyThird.items.length === 3, "Deleting an empty event does not mutate prior state");

        const merged = mergePhotoEventChapters(
            reassigned,
            "chapter-2",
            "chapter-1",
            photos
        );
        check(merged.items.length === 1, "Merging removes only the source event");
        check(merged.items[0].chapterId === "chapter-1", "Merging retains the destination identity and name");
        check(merged.items[0].photoKeys.length === 3, "Merging preserves every unique photo membership");
        check(new Set(merged.items[0].photoKeys).size === 3, "Merging cannot duplicate photo membership");
        check(reassigned.items.length === 2, "Merging does not mutate prior state");

        const moved = movePhotoEventChapter(reassigned, "chapter-2", "up", photos);
        check(moved.items[0].chapterId === "chapter-2", "Manual events can move earlier");
        check(reassigned.items[0].chapterId === "chapter-1", "Event reordering does not mutate prior state");

        const reconciled = normalizePhotoEventChapters(moved, [photos[0], photos[2]]);
        check(reconciled.items.length === 2, "Empty event chapters survive photo reconciliation");
        check(reconciled.items.every(item => !item.photoKeys.includes(secondPhotoKey)), "Unavailable photo memberships are removed");
        check(Object.isFrozen(reconciled.items), "Normalized event chapters are immutable");
    }

    console.info(`PASS ALB-071: All assertions passed (${assertions} assertions).`);
}

runAlb071Tests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
