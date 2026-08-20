import assert from "assert";
import fs from "fs";
import path from "path";
import { AppController } from "../src/app/AppController";
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

export async function runAlb093Tests() {
    console.info("Starting ALB-093 Full Album Batch Render tests...");

    const templateRegistry = [
        {
            id: "template-01",
            name: "01.psd",
            validationState: "READY",
            validationReason: null,
            validationSchemaVersion: 1,
            registrationOrder: 0,
            smartObjects: [
                { layerId: 2, layerName: "01 Photo Left" },
                { layerId: 4, layerName: "01 Photo Right" }
            ],
            slotCount: 2
        },
        {
            id: "template-02",
            name: "02.psd",
            validationState: "READY",
            validationReason: null,
            validationSchemaVersion: 1,
            registrationOrder: 1,
            smartObjects: [
                { layerId: 2, layerName: "02 Photo" }
            ],
            slotCount: 1
        }
    ];

    const fourSpreadAlbum = {
        schemaVersion: 1,
        id: "album-abab-01",
        sheets: [
            {
                id: "Spread_01",
                templateId: "template-01",
                label: "Spread 01",
                slots: [
                    { slotId: 2, photoId: "photo_01.jpg" },
                    { slotId: 4, photoId: "photo_02.jpg" }
                ]
            },
            {
                id: "Spread_02",
                templateId: "template-02",
                label: "Spread 02",
                slots: [
                    { slotId: 2, photoId: "photo_03.jpg" }
                ]
            },
            {
                id: "Spread_03",
                templateId: "template-01",
                label: "Spread 03",
                slots: [
                    { slotId: 2, photoId: "photo_04.jpg" },
                    { slotId: 4, photoId: "photo_05.jpg" }
                ]
            },
            {
                id: "Spread_04",
                templateId: "template-02",
                label: "Spread 04",
                slots: [
                    { slotId: 2, photoId: "photo_06.jpg" }
                ]
            }
        ]
    };

    // Test 1: 4-Spread A-B-A-B batch request creation & independent template resolution
    {
        const result = createAlbumBatchRenderRequest({
            projectId: "proj-abab-1",
            album: fourSpreadAlbum,
            registry: templateRegistry,
            selectedPhotoIds: ["photo_01.jpg", "photo_02.jpg", "photo_03.jpg", "photo_04.jpg", "photo_05.jpg", "photo_06.jpg"],
            options: { format: "JPEG", targetDpi: 300 }
        });

        check(result.accepted === true, "4-spread A-B-A-B batch request accepted");
        check(result.request.schemaVersion === ALBUM_BATCH_RENDER_REQUEST_SCHEMA_VERSION, "Schema version is correct");
        check(result.request.totalSheets === 4, "Total sheets is 4");
        check(result.request.sheetRequests.length === 4, "4 sheet requests created");

        // Sheet 1 (01.psd, 2 slots)
        const req1 = result.request.sheetRequests[0];
        check(req1.sheet.id === "Spread_01", "Sheet 1 ID is Spread_01");
        check(req1.template.id === "template-01", "Sheet 1 template is template-01");
        check(req1.selectedPhotoIds.length === 2, "Sheet 1 has 2 assigned photos");
        check(req1.selectedPhotoIds[0] === "photo_01.jpg" && req1.selectedPhotoIds[1] === "photo_02.jpg", "Sheet 1 photo IDs match");

        // Sheet 2 (02.psd, 1 slot)
        const req2 = result.request.sheetRequests[1];
        check(req2.sheet.id === "Spread_02", "Sheet 2 ID is Spread_02");
        check(req2.template.id === "template-02", "Sheet 2 template is template-02");
        check(req2.selectedPhotoIds.length === 1, "Sheet 2 has 1 assigned photo");
        check(req2.selectedPhotoIds[0] === "photo_03.jpg", "Sheet 2 photo ID matches");

        // Sheet 3 (01.psd, 2 slots)
        const req3 = result.request.sheetRequests[2];
        check(req3.sheet.id === "Spread_03", "Sheet 3 ID is Spread_03");
        check(req3.template.id === "template-01", "Sheet 3 template is template-01");
        check(req3.selectedPhotoIds.length === 2, "Sheet 3 has 2 assigned photos");
        check(req3.selectedPhotoIds[0] === "photo_04.jpg" && req3.selectedPhotoIds[1] === "photo_05.jpg", "Sheet 3 photo IDs match");

        // Sheet 4 (02.psd, 1 slot)
        const req4 = result.request.sheetRequests[3];
        check(req4.sheet.id === "Spread_04", "Sheet 4 ID is Spread_04");
        check(req4.template.id === "template-02", "Sheet 4 template is template-02");
        check(req4.selectedPhotoIds.length === 1, "Sheet 4 has 1 assigned photo");
        check(req4.selectedPhotoIds[0] === "photo_06.jpg", "Sheet 4 photo ID matches");
    }

    // Test 2: Preflight validation with validateAlbumBatchRenderRequest
    {
        const batchReq = createAlbumBatchRenderRequest({
            projectId: "proj-abab-1",
            album: fourSpreadAlbum,
            registry: templateRegistry,
            selectedPhotoIds: ["photo_01.jpg", "photo_02.jpg", "photo_03.jpg", "photo_04.jpg", "photo_05.jpg", "photo_06.jpg"]
        }).request;

        const val = validateAlbumBatchRenderRequest(batchReq, {
            projectId: "proj-abab-1",
            album: fourSpreadAlbum,
            registry: templateRegistry,
            selectedPhotoIds: ["photo_01.jpg", "photo_02.jpg", "photo_03.jpg", "photo_04.jpg", "photo_05.jpg", "photo_06.jpg"]
        });

        check(val.accepted === true, "Valid batch request passes validation");
        check(val.request.sheetRequests.length === 4, "All 4 sheet requests validated");

        // Missing template-02 in registry during validation
        const valStale = validateAlbumBatchRenderRequest(batchReq, {
            projectId: "proj-abab-1",
            album: fourSpreadAlbum,
            registry: [
                { id: "template-01", name: "01.psd", validationState: "READY", validationSchemaVersion: 1, registrationOrder: 0 }
            ]
        });
        check(valStale.accepted === false, "Full album validation rejects a partially stale template registry");
        check(valStale.reasonCodes.includes(AlbumSheetRenderReason.SHEET_NOT_RENDERABLE), "Stale full album reports the unrenderable sheet boundary");

        const reorderedAlbum = {
            ...fourSpreadAlbum,
            sheets: [
                fourSpreadAlbum.sheets[1],
                fourSpreadAlbum.sheets[0],
                fourSpreadAlbum.sheets[2],
                fourSpreadAlbum.sheets[3]
            ]
        };
        const valReordered = validateAlbumBatchRenderRequest(batchReq, {
            projectId: "proj-abab-1",
            album: reorderedAlbum,
            registry: templateRegistry,
            selectedPhotoIds: ["photo_01.jpg", "photo_02.jpg", "photo_03.jpg", "photo_04.jpg", "photo_05.jpg", "photo_06.jpg"]
        });
        check(valReordered.accepted === false, "Storyboard reorder invalidates a detached full album request");
        check(valReordered.reasonCodes.includes(AlbumSheetRenderReason.SHEET_STALE), "Storyboard reorder reports SHEET_STALE");
    }

    // Test 3: Lab Print Safety Gate on Incomplete Spreads
    {
        const incompleteAlbum = {
            schemaVersion: 1,
            id: "album-incomplete",
            sheets: [
                {
                    id: "Spread_01",
                    templateId: "template-01",
                    label: "Spread 01",
                    slots: [
                        { slotId: 2, photoId: "photo_01.jpg" },
                        { slotId: 4, photoId: "photo_02.jpg" }
                    ]
                },
                {
                    id: "Spread_02",
                    templateId: "template-02",
                    label: "Spread 02",
                    slots: [
                        { slotId: 2, photoId: "photo_03.jpg" }
                    ]
                },
                {
                    id: "Spread_03",
                    templateId: "template-01",
                    label: "Spread 03",
                    slots: [
                        { slotId: 2, photoId: "photo_04.jpg" } // missing slot 4 (needs 2, has 1)
                    ]
                }
            ]
        };

        const result = createAlbumBatchRenderRequest({
            projectId: "proj-incomplete",
            album: incompleteAlbum,
            registry: templateRegistry,
            selectedPhotoIds: ["photo_01.jpg", "photo_02.jpg", "photo_03.jpg", "photo_04.jpg"],
            options: { type: "LAB_PRINT" }
        });

        check(result.accepted === false, "Lab Print is rejected when spreads are incomplete");
        check(result.reasonCodes.includes(AlbumSheetRenderReason.INCOMPLETE_SPREADS), "Reason code is INCOMPLETE_SPREADS");
        check(result.details.incompleteSheets.length === 1, "Reports 1 incomplete sheet");
        check(result.details.incompleteSheets[0].sheetId === "Spread_03", "Identifies Spread_03 as incomplete");
        check(result.details.incompleteSheets[0].missingCount === 1, "Missing count is 1 for Spread_03");
    }

    // Test 4: AppController executeAlbumBatchRenderRequest end-to-end execution
    {
        const controller = new AppController();
        controller.project.getProject = () => ({
            metadata: {
                id: "proj-abab-1",
                name: "REC005-MULTI-TEMPLATE",
                album: fourSpreadAlbum
            }
        });
        controller.projectTemplateRegistry.getAll = () => templateRegistry;
        controller.revalidateProjectTemplates = async () => ({ persisted: true, reason: "ALBUM_BATCH_RENDER_PREFLIGHT", blocking: 0 });
        controller.photoWorkspace.getPhotos = () => [
            { id: "photo_01.jpg", name: "photo_01.jpg", file: { name: "photo_01.jpg" } },
            { id: "photo_02.jpg", name: "photo_02.jpg", file: { name: "photo_02.jpg" } },
            { id: "photo_03.jpg", name: "photo_03.jpg", file: { name: "photo_03.jpg" } },
            { id: "photo_04.jpg", name: "photo_04.jpg", file: { name: "photo_04.jpg" } },
            { id: "photo_05.jpg", name: "photo_05.jpg", file: { name: "photo_05.jpg" } },
            { id: "photo_06.jpg", name: "photo_06.jpg", file: { name: "photo_06.jpg" } }
        ];

        const executedSpreads = [];
        controller.executeAlbumSheetRenderRequest = async (sheetReq, onUpdate, options) => {
            executedSpreads.push(sheetReq.sheet.id);
            return { status: "COMPLETED", sheetId: sheetReq.sheet.id };
        };

        const progressUpdates = [];
        const summary = await controller.executeAlbumBatchRender(
            { album: fourSpreadAlbum, exportOptions: { format: "JPEG" } },
            update => progressUpdates.push(update)
        );

        check(summary.totalSheets === 4, "Summary totalSheets is 4");
        check(summary.completedSheets === 4, "Summary completedSheets is 4");
        check(summary.successfulSheets === 4, "Summary successfulSheets is 4");
        check(summary.failedSheets === 0, "Summary failedSheets is 0");
        check(summary.success === true, "Summary success is true");
        check(executedSpreads.length === 4, "All 4 spreads executed");
        check(executedSpreads.join(",") === "Spread_01,Spread_02,Spread_03,Spread_04", "Executed in exact storyboard order");

        const runningUpdates = progressUpdates.filter(u => u.lifecycle === "RUNNING");
        check(runningUpdates.length === 4, "Received 4 running progress updates");
        check(runningUpdates[0].sheetId === "Spread_01" && runningUpdates[0].currentSheetIndex === 1, "Progress update 1 is Spread_01");
        check(runningUpdates[3].sheetId === "Spread_04" && runningUpdates[3].currentSheetIndex === 4, "Progress update 4 is Spread_04");
        check(progressUpdates.at(-1).lifecycle === "COMPLETED", "Final update lifecycle is COMPLETED");
    }

    // Test 5: Failure Isolation during Batch Execution
    {
        const controller = new AppController();
        controller.project.getProject = () => ({
            metadata: {
                id: "proj-abab-1",
                name: "REC005-MULTI-TEMPLATE",
                album: fourSpreadAlbum
            }
        });
        controller.projectTemplateRegistry.getAll = () => templateRegistry;
        controller.revalidateProjectTemplates = async () => ({ persisted: true, reason: "ALBUM_BATCH_RENDER_PREFLIGHT", blocking: 0 });
        controller.photoWorkspace.getPhotos = () => [
            { id: "photo_01.jpg", name: "photo_01.jpg", file: { name: "photo_01.jpg" } },
            { id: "photo_02.jpg", name: "photo_02.jpg", file: { name: "photo_02.jpg" } },
            { id: "photo_03.jpg", name: "photo_03.jpg", file: { name: "photo_03.jpg" } },
            { id: "photo_04.jpg", name: "photo_04.jpg", file: { name: "photo_04.jpg" } },
            { id: "photo_05.jpg", name: "photo_05.jpg", file: { name: "photo_05.jpg" } },
            { id: "photo_06.jpg", name: "photo_06.jpg", file: { name: "photo_06.jpg" } }
        ];

        const executedSpreads = [];
        controller.executeAlbumSheetRenderRequest = async (sheetReq) => {
            executedSpreads.push(sheetReq.sheet.id);
            if (sheetReq.sheet.id === "Spread_02") {
                throw new Error("Photoshop replacement failed on Spread 02");
            }
            return { status: "COMPLETED", sheetId: sheetReq.sheet.id };
        };

        const summary = await controller.executeAlbumBatchRender(
            { album: fourSpreadAlbum, exportOptions: { format: "JPEG" } }
        );

        check(summary.totalSheets === 4, "Summary totalSheets is 4");
        check(summary.completedSheets === 4, "Summary completedSheets is 4");
        check(summary.successfulSheets === 3, "Summary successfulSheets is 3");
        check(summary.failedSheets === 1, "Summary failedSheets is 1");
        check(summary.success === false, "Summary success is false");
        check(executedSpreads.length === 4, "Failure on Spread 02 did not prevent Spreads 03 and 04 from executing");
        check(summary.results[1].status === "FAILED", "Spread 02 result is FAILED");
        check(summary.results[1].error.includes("Photoshop replacement failed"), "Error message preserved");
        check(summary.results[0].status === "SUCCESS", "Spread 01 is SUCCESS");
        check(summary.results[2].status === "SUCCESS", "Spread 03 is SUCCESS");
        check(summary.results[3].status === "SUCCESS", "Spread 04 is SUCCESS");
    }

    // Test 6: Mutation lock blocks batch render invocation
    {
        const controller = new AppController();
        controller.isAlbumSheetMutationLocked = () => true;

        let blocked = false;
        try {
            await controller.executeAlbumBatchRender({ album: fourSpreadAlbum });
        } catch (e) {
            blocked = true;
            check(e.message.includes("A project batch is running"), "Mutation lock blocks batch execution");
        }
        check(blocked === true, "Batch render threw on active lock");
    }

    // Test 7: Resolved FAILED outcomes are not misreported as successful sheets
    {
        const controller = new AppController();
        controller.project.getProject = () => ({
            metadata: { id: "proj-abab-1", album: fourSpreadAlbum }
        });
        controller.projectTemplateRegistry.getAll = () => templateRegistry;
        controller.revalidateProjectTemplates = async () => ({ persisted: true });
        controller.photoWorkspace.getPhotos = () => [
            "photo_01.jpg", "photo_02.jpg", "photo_03.jpg",
            "photo_04.jpg", "photo_05.jpg", "photo_06.jpg"
        ].map(id => ({ id, name: id, file: { name: id } }));
        controller.executeAlbumSheetRenderRequest = async (sheetReq, onUpdate) => {
            onUpdate?.({ status: "RUNNING", completedTemplates: 0 });
            return sheetReq.sheet.id === "Spread_03"
                ? { status: "FAILED", failedTemplates: 1, templateResults: [{ error: "Replacement failed" }] }
                : { status: "COMPLETED", failedTemplates: 0 };
        };

        const updates = [];
        const summary = await controller.executeAlbumBatchRender(
            { album: fourSpreadAlbum, exportOptions: { format: "JPEG" } },
            update => updates.push(update)
        );

        check(summary.successfulSheets === 3, "Resolved FAILED outcome does not increment successfulSheets");
        check(summary.failedSheets === 1, "Resolved FAILED outcome increments failedSheets");
        check(summary.results[2].status === "FAILED", "Spread 03 is recorded as FAILED");
        check(summary.results[2].error === "Replacement failed", "Resolved failure preserves its execution error");
        check(summary.success === false, "Resolved sheet failure makes the album batch unsuccessful");
        const nestedUpdate = updates.find(update => update.phase === "SHEET_PROGRESS");
        check(nestedUpdate?.sheetId === "Spread_01", "Nested sheet progress stays inside the album batch envelope");
        check(nestedUpdate?.sheetProgress?.status === "RUNNING", "Nested project progress is preserved under sheetProgress");
    }

    // Test 8: Print & Proof surfaces a failed batch instead of showing success
    {
        const openFolderSource = fs.readFileSync(
            path.join(process.cwd(), "src/components/OpenFolder.jsx"),
            "utf8"
        );
        check(openFolderSource.includes("if (!summary?.success)"), "Print & Proof checks the full album batch result");
        check(openFolderSource.includes("ALBUM_BATCH_RENDER_FAILED"), "Print & Proof surfaces a stable failed-batch error code");
        check(openFolderSource.includes("error.summary = summary"), "Print & Proof preserves the failed batch summary for diagnostics");
    }

    console.info(`PASS ALB-093: All assertions passed (${assertions} assertions).`);
}

runAlb093Tests().catch(e => {
    console.error("ALB-093 Test Failure:", e);
    process.exitCode = 1;
});
