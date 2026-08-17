/**
 * Print Export Preset & PDF Proofing Engine for AlbumAI Pro
 * Provides lab print profiles, bleed calculations, preflight resolution analysis,
 * and multi-page client PDF proof manifests.
 */

export const PrintPresetType = Object.freeze({
    LAB_300_DPI_FLUSHMOUNT: "LAB_300_DPI_FLUSHMOUNT",
    MULTI_PAGE_PDF_PROOF: "MULTI_PAGE_PDF_PROOF",
    SOCIAL_WEB_PREVIEW: "SOCIAL_WEB_PREVIEW"
});

export const StandardAlbumSizes = Object.freeze({
    SIZE_12X12: Object.freeze({
        id: "12x12",
        name: "12×12\" Square Flush Mount",
        widthIn: 12,
        heightIn: 12,
        targetDpi: 300,
        baseWidthPx: 3600,
        baseHeightPx: 3600
    }),
    SIZE_12X18: Object.freeze({
        id: "12x18",
        name: "12×18\" Panoramic Spread",
        widthIn: 18,
        heightIn: 12,
        targetDpi: 300,
        baseWidthPx: 5400,
        baseHeightPx: 3600
    }),
    SIZE_10X10: Object.freeze({
        id: "10x10",
        name: "10×10\" Storybook",
        widthIn: 10,
        heightIn: 10,
        targetDpi: 300,
        baseWidthPx: 3000,
        baseHeightPx: 3000
    }),
    SIZE_8X11: Object.freeze({
        id: "8.5x11",
        name: "8.5×11\" Magazine Landscape",
        widthIn: 11,
        heightIn: 8.5,
        targetDpi: 300,
        baseWidthPx: 3300,
        baseHeightPx: 2550
    })
});

export const BleedPreset = Object.freeze({
    NONE: 0,
    STANDARD_0125: 0.125, // 1/8 inch = 3.175 mm
    EXTENDED_025: 0.25    // 1/4 inch = 6.35 mm
});

/**
 * Calculate exact pixel dimensions, trim box, and safe zone for a given print size & bleed
 */
export function calculatePrintDimensions(sizePreset = StandardAlbumSizes.SIZE_12X12, bleedInches = BleedPreset.STANDARD_0125, targetDpi = 300) {
    const widthIn = sizePreset?.widthIn || 12;
    const heightIn = sizePreset?.heightIn || 12;
    const dpi = targetDpi || 300;
    const bleed = typeof bleedInches === "number" ? bleedInches : 0.125;

    const baseWidthPx = Math.round(widthIn * dpi);
    const baseHeightPx = Math.round(heightIn * dpi);
    const bleedPxTotal = Math.round(bleed * 2 * dpi);
    const bleedPxPerSide = Math.round(bleed * dpi);
    const totalWidthPx = baseWidthPx + bleedPxTotal;
    const totalHeightPx = baseHeightPx + bleedPxTotal;

    const safeMarginIn = 0.25; // 1/4 inch inside trim
    const safeMarginPx = Math.round(safeMarginIn * dpi);

    return Object.freeze({
        dpi,
        widthIn,
        heightIn,
        bleedInches: bleed,
        totalWidthPx,
        totalHeightPx,
        baseWidthPx,
        baseHeightPx,
        bleedPxPerSide,
        trimBox: Object.freeze({
            x: bleedPxPerSide,
            y: bleedPxPerSide,
            width: baseWidthPx,
            height: baseHeightPx
        }),
        safeBox: Object.freeze({
            x: bleedPxPerSide + safeMarginPx,
            y: bleedPxPerSide + safeMarginPx,
            width: Math.max(0, baseWidthPx - (safeMarginPx * 2)),
            height: Math.max(0, baseHeightPx - (safeMarginPx * 2))
        })
    });
}

/**
 * Preflight analysis for print readiness (resolution & missing slots)
 */
export function preflightAlbumForPrint({
    album,
    photos = [],
    templates = [],
    sizePreset = StandardAlbumSizes.SIZE_12X12,
    targetDpi = 300
}) {
    const sheets = album?.sheets || [];
    const photoMap = new Map((photos || []).map(p => [String(p.id), p]));
    const templateMap = new Map((templates || []).map(t => [t.id, t]));

    let totalSlots = 0;
    let filledSlots = 0;
    const unfilledSlotDetails = [];
    const lowResolutionWarnings = [];

    const printDims = calculatePrintDimensions(sizePreset, BleedPreset.NONE, targetDpi);

    for (let i = 0; i < sheets.length; i++) {
        const sheet = sheets[i];
        const template = templateMap.get(sheet.templateId);
        const templateSlots = template?.smartObjects || [];
        const sheetSlots = Array.isArray(sheet.slots) ? sheet.slots : [];

        const expectedSlotCount = templateSlots.length > 0 ? templateSlots.length : Math.max(1, sheetSlots.length);
        totalSlots += expectedSlotCount;
        filledSlots += sheetSlots.length;

        if (sheetSlots.length < expectedSlotCount) {
            unfilledSlotDetails.push({
                sheetIndex: i + 1,
                sheetId: sheet.id,
                sheetLabel: sheet.label || sheet.id,
                missingCount: expectedSlotCount - sheetSlots.length
            });
        }

        // Check resolution for assigned photos
        for (const slot of sheetSlots) {
            const photo = photoMap.get(String(slot.photoId));
            if (!photo) continue;

            const photoWidth = photo.metadata?.width || photo.width || 0;
            const photoHeight = photo.metadata?.height || photo.height || 0;

            if (photoWidth > 0 && photoHeight > 0) {
                // Approximate slot fraction on spread (e.g. 1/2 or 1/3 of spread width)
                const fraction = 1 / Math.max(1, expectedSlotCount);
                const estimatedSlotWidthIn = printDims.widthIn * fraction;
                const effectiveDpi = photoWidth / Math.max(1, estimatedSlotWidthIn);

                if (effectiveDpi < 200) {
                    lowResolutionWarnings.push({
                        sheetIndex: i + 1,
                        sheetId: sheet.id,
                        photoId: photo.id,
                        photoName: photo.name || photo.id,
                        effectiveDpi: Math.round(effectiveDpi),
                        minRecommendedDpi: 250
                    });
                }
            }
        }
    }

    const isReadyForPrint = sheets.length > 0 && unfilledSlotDetails.length === 0;

    return Object.freeze({
        totalSheets: sheets.length,
        totalSlots,
        filledSlots,
        unfilledSlots: totalSlots - filledSlots,
        unfilledSlotDetails: Object.freeze(unfilledSlotDetails),
        lowResolutionWarnings: Object.freeze(lowResolutionWarnings),
        isReadyForPrint,
        printDimensions: printDims
    });
}

/**
 * Generate a structured Multi-Page PDF Proof Manifest
 */
export function generatePdfProofManifest({
    album,
    photos = [],
    templates = [],
    proofConfig = {}
}) {
    const {
        watermarkText = "PROOF - DO NOT PRINT",
        includePageNumbers = true,
        includeSheetLabels = true,
        clientName = "",
        studioName = "AlbumAI Studio"
    } = proofConfig;

    const sheets = album?.sheets || [];
    const photoMap = new Map((photos || []).map(p => [String(p.id), p]));
    const templateMap = new Map((templates || []).map(t => [t.id, t]));

    const pages = sheets.map((sheet, index) => {
        const template = templateMap.get(sheet.templateId);
        const assignedSlots = (sheet.slots || []).map(s => {
            const photo = photoMap.get(String(s.photoId));
            return {
                slotId: s.slotId,
                photoId: s.photoId,
                photoName: photo?.name || s.photoId,
                cropFocus: s.cropFocus || "center"
            };
        });

        return Object.freeze({
            pageNumber: index + 1,
            sheetId: sheet.id,
            label: sheet.label || sheet.id,
            templateId: sheet.templateId,
            templateName: template?.name || sheet.templateId,
            slots: Object.freeze(assignedSlots),
            pageIndicator: `Spread ${index + 1} of ${sheets.length}`
        });
    });

    return Object.freeze({
        schemaVersion: 1,
        generatedAt: new Date().toISOString(),
        albumId: album?.id || "album-main",
        totalPages: sheets.length,
        watermarkText: watermarkText.trim(),
        hasWatermark: Boolean(watermarkText.trim()),
        includePageNumbers,
        includeSheetLabels,
        clientName: clientName.trim(),
        studioName: studioName.trim(),
        pages: Object.freeze(pages)
    });
}
