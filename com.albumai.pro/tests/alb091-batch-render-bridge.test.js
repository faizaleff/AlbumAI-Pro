import assert from "assert";
import {
    createAlbumBatchRenderRequest,
    validateAlbumBatchRenderRequest,
    AlbumSheetRenderReason,
    ALBUM_BATCH_RENDER_REQUEST_SCHEMA_VERSION
} from "../src/project/AlbumSheetRenderBridge";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export async function runAlb091Tests() {
    console.info("Starting ALB-091 Batch Render Bridge tests...");

    const templateRegistry = [
        {
            id: "t-1",
            name: "Template 1",
            validationState: "READY",
            validationReason: null,
            validationSchemaVersion: 1,
            registrationOrder: 0,
            smartObjects: [{ layerId: 1 }]
        },
        {
            id: "t-2",
            name: "Template 2",
            validationState: "READY",
            validationReason: null,
            validationSchemaVersion: 1,
            registrationOrder: 1,
            smartObjects: [{ layerId: 1 }, { layerId: 2 }]
        }
    ];

    // Test 1: createAlbumBatchRenderRequest with empty album
    {
        const emptyAlbum = { schemaVersion: 1, id: "album-1", sheets: [] };
        const result = createAlbumBatchRenderRequest({
            projectId: "proj-1",
            album: emptyAlbum,
            registry: templateRegistry,
            selectedPhotoIds: ["p1", "p2"]
        });

        check(result.accepted === false, "Empty album is rejected");
        check(result.reasonCodes.includes(AlbumSheetRenderReason.NO_RENDERABLE_SHEETS), "Reports NO_RENDERABLE_SHEETS");
    }

    // Test 2: createAlbumBatchRenderRequest with valid multiple sheets
    {
        const album = {
            schemaVersion: 1,
            id: "album-1",
            sheets: [
                { id: "sheet-1", templateId: "t-1", label: "Cover Spread", slots: [{ slotId: 1, photoId: "p1" }] },
                { id: "sheet-2", templateId: "t-2", label: "Ceremony Spread", slots: [{ slotId: 1, photoId: "p2" }, { slotId: 2, photoId: "p3" }] }
            ]
        };

        const result = createAlbumBatchRenderRequest({
            projectId: "proj-1",
            album,
            registry: templateRegistry,
            selectedPhotoIds: ["p1", "p2", "p3"],
            options: { targetDpi: 300, bleedInches: 0.125, format: "JPEG" }
        });

        check(result.accepted === true, "Valid multi-sheet album is accepted");
        check(result.request.schemaVersion === ALBUM_BATCH_RENDER_REQUEST_SCHEMA_VERSION, "Schema version is correct");
        check(result.request.projectId === "proj-1", "Project ID matches");
        check(result.request.totalSheets === 2, "Total sheets is 2");
        check(result.request.sheetRequests.length === 2, "Contains 2 sheet requests");
        check(result.request.options.targetDpi === 300, "Preserves targetDpi option");
        check(result.request.options.bleedInches === 0.125, "Preserves bleedInches option");

        // Sheet 1 details
        const s1 = result.request.sheetRequests[0];
        check(s1.sheet.id === "sheet-1", "Sheet 1 ID matches");
        check(s1.template.id === "t-1", "Sheet 1 template ID matches");
        check(s1.selectedPhotoIds[0] === "p1", "Sheet 1 assigned photo is p1");

        // Sheet 2 details
        const s2 = result.request.sheetRequests[1];
        check(s2.sheet.id === "sheet-2", "Sheet 2 ID matches");
        check(s2.template.id === "t-2", "Sheet 2 template ID matches");
        check(s2.selectedPhotoIds.length === 2, "Sheet 2 has 2 assigned photos");
    }

    // Test 3: validateAlbumBatchRenderRequest
    {
        const album = {
            schemaVersion: 1,
            id: "album-1",
            sheets: [
                { id: "sheet-1", templateId: "t-1", label: "Cover", slots: [{ slotId: 1, photoId: "p1" }] }
            ]
        };

        const batch = createAlbumBatchRenderRequest({
            projectId: "proj-1",
            album,
            registry: templateRegistry,
            selectedPhotoIds: ["p1"]
        });

        check(batch.accepted === true, "Batch creation succeeded");

        const validation = validateAlbumBatchRenderRequest(batch.request, {
            projectId: "proj-1",
            album,
            registry: templateRegistry,
            selectedPhotoIds: ["p1"]
        });

        check(validation.accepted === true, "Batch validation succeeded with matched context");
        check(validation.request.totalSheets === 1, "Validated batch total sheets is 1");

        // Validation fails if projectId differs
        const invalidProject = validateAlbumBatchRenderRequest(batch.request, {
            projectId: "different-project",
            album,
            registry: templateRegistry,
            selectedPhotoIds: ["p1"]
        });

        check(invalidProject.accepted === false, "Fails validation when projectId differs");
    }

    // Test 4: Batch request preserves Lab Print options across multiple sheets
    {
        const album = {
            schemaVersion: 1,
            id: "album-1",
            sheets: [
                { id: "s1", templateId: "t-1", label: "Spread 1", slots: [{ slotId: 1, photoId: "p1" }] },
                { id: "s2", templateId: "t-2", label: "Spread 2", slots: [{ slotId: 1, photoId: "p2" }, { slotId: 2, photoId: "p3" }] }
            ]
        };
        const exportOptions = {
            type: "LAB_PRINT",
            presetType: "LAB_300_DPI_FLUSHMOUNT",
            bleedInches: 0.125,
            format: "JPEG"
        };
        const result = createAlbumBatchRenderRequest({
            projectId: "proj-1",
            album,
            registry: templateRegistry,
            selectedPhotoIds: ["p1", "p2", "p3"],
            options: exportOptions
        });
        check(result.accepted === true, "Lab Print batch request accepted");
        check(result.request.sheetRequests.length === 2, "2 sheet requests in Lab Print batch");
        check(result.request.options.type === "LAB_PRINT", "Preserves LAB_PRINT type in batch options");
        check(result.request.options.format === "JPEG", "Preserves format JPEG in batch options");
    }

    // Test 5: Fully assigned album -> LAB_PRINT batch request accepted
    {
        const album = {
            schemaVersion: 1,
            id: "album-1",
            sheets: [
                { id: "s1", templateId: "t-1", label: "Spread 1", slots: [{ slotId: 1, photoId: "p1" }] },
                { id: "s2", templateId: "t-2", label: "Spread 2", slots: [{ slotId: 1, photoId: "p2" }, { slotId: 2, photoId: "p3" }] }
            ]
        };
        const result = createAlbumBatchRenderRequest({
            projectId: "proj-1",
            album,
            registry: templateRegistry,
            selectedPhotoIds: ["p1", "p2", "p3"],
            options: { type: "LAB_PRINT", format: "JPEG" }
        });
        check(result.accepted === true, "Test 5: Fully assigned album accepted for LAB_PRINT");
        check(result.request.sheetRequests.length === 2, "Test 5: 2 sheet requests generated");
    }

    // Test 6: One incomplete spread -> LAB_PRINT batch request blocked with INCOMPLETE_SPREADS
    {
        const album = {
            schemaVersion: 1,
            id: "album-1",
            sheets: [
                { id: "s1", templateId: "t-1", label: "Spread 1", slots: [{ slotId: 1, photoId: "p1" }] }, // 1/1 complete
                { id: "s2", templateId: "t-2", label: "Spread 2", slots: [{ slotId: 1, photoId: "p2" }] }  // 1/2 INCOMPLETE
            ]
        };
        const result = createAlbumBatchRenderRequest({
            projectId: "proj-1",
            album,
            registry: templateRegistry,
            selectedPhotoIds: ["p1", "p2"],
            options: { type: "LAB_PRINT", format: "JPEG" }
        });
        check(result.accepted === false, "Test 6: Incomplete album rejected for LAB_PRINT");
        check(result.reasonCodes.includes(AlbumSheetRenderReason.INCOMPLETE_SPREADS), "Test 6: Reason is INCOMPLETE_SPREADS");
        check(result.details.totalIncomplete === 1, "Test 6: 1 incomplete spread reported");
        check(result.details.totalMissing === 1, "Test 6: 1 missing slot reported");
        check(result.details.incompleteSheets[0].sheetId === "s2", "Test 6: Identified s2 as incomplete");
        check(result.details.incompleteSheets[0].assignedCount === 1, "Test 6: s2 has 1 assigned");
        check(result.details.incompleteSheets[0].totalCount === 2, "Test 6: s2 has 2 total");
        check(result.details.message.includes("Spread 2 (1/2)"), "Test 6: Message details affected spread");
    }

    // Test 7: Multiple incomplete spreads -> deterministic preflight details
    {
        const album = {
            schemaVersion: 1,
            id: "album-1",
            sheets: [
                { id: "s1", templateId: "t-2", label: "Spread 1", slots: [{ slotId: 1, photoId: "p1" }] }, // 1/2 INCOMPLETE
                { id: "s2", templateId: "t-2", label: "Spread 2", slots: [] }                               // 0/2 INCOMPLETE
            ]
        };
        const result = createAlbumBatchRenderRequest({
            projectId: "proj-1",
            album,
            registry: templateRegistry,
            selectedPhotoIds: ["p1"],
            options: { type: "LAB_PRINT", format: "JPEG" }
        });
        check(result.accepted === false, "Test 7: Multi-incomplete album rejected");
        check(result.details.totalIncomplete === 2, "Test 7: 2 incomplete spreads reported");
        check(result.details.totalMissing === 3, "Test 7: 3 missing slots reported (1 + 2)");
        check(result.details.incompleteSheets.length === 2, "Test 7: 2 incomplete sheet entries");
    }

    // Test 8: Non-LAB_PRINT (e.g. proof draft) allows incomplete spreads (warning-only separation)
    {
        const album = {
            schemaVersion: 1,
            id: "album-1",
            sheets: [
                { id: "s1", templateId: "t-2", label: "Spread 1", slots: [{ slotId: 1, photoId: "p1" }] } // 1/2 partial
            ]
        };
        const result = createAlbumBatchRenderRequest({
            projectId: "proj-1",
            album,
            registry: templateRegistry,
            selectedPhotoIds: ["p1"],
            options: { type: "PDF_PROOF" }
        });
        check(result.accepted === true, "Test 8: PDF_PROOF allows partial layout as warning-only");
    }

    console.info(`PASS ALB-091: All assertions passed (${assertions} assertions).`);
}

runAlb091Tests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
