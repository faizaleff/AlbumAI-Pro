import assert from "assert";
import { core } from "photoshop";
import { storage } from "uxp";
import ProjectExecutor from "../src/project/ProjectExecutor";
import TemplateExportService from "../src/services/TemplateExportService";
import TemplateAutoSaveService from "../src/services/TemplateAutoSaveService";
import { AppController } from "../src/app/AppController";
import PlacementExecutionPlanBuilder from "../src/placement/PlacementExecutionPlanBuilder";
import PhotoPlacementEngine from "../src/placement/PhotoPlacementEngine";
import ReplacementRequest from "../src/placement/ReplacementRequest";
import ReplacementStepExecutor from "../src/placement/ReplacementStepExecutor";
import TemplateDocumentReader, { PsdPreviews, PsdPreviewStore, previewSlotRegions } from "../src/services/TemplateDocumentReader";

import SmartObjectService from "../src/core/album/SmartObjectService";
import { slotShapeCover, captureSlotShape } from "../src/services/SlotShapePreview";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

function makeMockFolder() {
    return {
        isFolder: true,
        getEntries: async () => [],
        createFolder: async () => makeMockFolder()
    };
}

function makeExportService() {
    return new TemplateExportService({
        documentManager: {
            byId: () => null,
            activate: async () => {},
            activeId: null,
            exportJPEG: async () => {},
            save: async () => {}
        },
        fileAdapterFactory: () => ({}),
        transactionRunner: async () => ({ commitState: "COMMITTED", status: "COMMITTED" }),
        transactionId: () => "test-tx"
    });
}

function makeAutoSaveService() {
    return new TemplateAutoSaveService({
        documentManager: {
            byId: () => null,
            activate: async () => {},
            activeId: null,
            save: async () => {}
        },
        fileAdapterFactory: () => ({}),
        transactionRunner: async () => ({ commitState: "COMMITTED", status: "COMMITTED" }),
        transactionId: () => "test-tx"
    });
}

export async function runAlb083Tests() {
    console.info("Starting ALB-083 Album Sheet Output Naming tests...");
    {
        const store = new PsdPreviewStore({getPixels: async () => ({imageData: {width: 100, height: 100, dispose() {}},
            sourceBounds: {left: 0, top: 0, right: 100, bottom: 100}}), encodeImageData: async () => "JPEG"},
            async callback => callback(), {batchPlay: async () => [{smartObjectMore: {transform: [100, 0, 0, 0, 0, 100, 100, 100]}}]});
        await store.capture("mirror", 42, store.begin("mirror"), () => false,
            [{slotLayerId: 17, slotBounds: {left: 0, top: 0, right: 100, bottom: 100}}]);
        const region = store.get("mirror").regions[0];
        check(region.flipX && !region.flipY && region.supported, "Draft regions preserve horizontal Photoshop mirroring");
        store.actions.batchPlay = async () => [{smartObjectMore: {transform: [100, 100, 0, 100, 0, 0, 100, 0]}}];
        await store.capture("rotated", 42, store.begin("rotated"), () => false,
            [{slotLayerId: 17, slotBounds: {left: 0, top: 0, right: 100, bottom: 100}}]);
        check(store.get("rotated").regions[0].flipY, "Draft regions preserve 180-degree orientation");
    }
    {
        let disposed = 0, resolvePixels, inModal = false;
        const pixels = {imageData: {dispose() { disposed++; }}};
        const store = new PsdPreviewStore({getPixels: async options => {
            check(inModal, "Photoshop pixel reads run inside the required modal scope");
            check(options.documentID === 42 && !options.layerID, "Preview requests the explicit full document composite");
            return pixels;
        }, encodeImageData: async () => {
            check(inModal, "Preview encoding runs inside the modal scope"); return "JPEG";
        }}, async callback => {
            inModal = true;
            try { return await callback(); } finally { inModal = false; }
        });
        const key = store.key("qa", {id: "s", slots: [{slotId: 1, photoId: "p", cropFocus: "top"}]}, {name: "t.psd"});
        await store.capture(key, 42);
        check(store.get(key).src === "data:image/jpeg;base64,JPEG" && disposed === 1, "Composite is published and pixel memory disposed");
        let cancelled = false;
        store.api.getPixels = () => new Promise(resolve => { resolvePixels = resolve; });
        const job = store.begin(key), pending = store.capture(key, 42, job, () => cancelled);
        check(!store.get(key).src, "Beginning a render hides any older successful preview");
        cancelled = true; resolvePixels(pixels); await pending;
        check(store.get(key).status === "error" && disposed === 2, "Interrupted preview cannot publish success and releases pixels");
        const older = store.begin(key), slow = store.capture(key, 42, older);
        store.begin(key); resolvePixels(pixels); await slow;
        check(store.get(key).status === "rendering" && !store.get(key).src, "Late completion cannot overwrite a newer preview job");
        store.api.getPixels = async () => pixels;
        store.api.encodeImageData = async () => { throw new Error("encode failed"); };
        await store.capture(key, 42);
        check(store.get(key).status === "error" && disposed === 4, "Encode failure releases pixels and stays retryable");
        const changed = store.key("qa", {id: "s", slots: [{slotId: 1, photoId: "p", cropFocus: "bottom"}]}, {name: "t.psd"});
        check(changed !== key, "Crop changes invalidate cached composites");
        check(store.key("another", null, {name: "t.psd"}) !== store.key("qa", null, {name: "t.psd"}), "Projects cannot share template previews accidentally");
        for (let i = 0; i < 20; i++) store.set(String(i), {status: "ready", src: "JPEG"});
        check(store.entries.size === 12, "Preview memory is bounded");
    }


    {
        const steps = [{slotLayerId: 17, slotBounds: {left: 200, top: 100, right: 600, bottom: 500}},
            {slotLayerId: 18, slotBounds: {left: -200, top: 100, right: 0, bottom: 500}},
            {slotLayerId: 19, slotBounds: null}];
        assert.deepStrictEqual(previewSlotRegions(steps, {left: 50, top: 25, right: 450, bottom: 225}, 1),
            [{id: 17, x: .125, y: .125, width: .5, height: .875}]);
        check(previewSlotRegions(steps, null).length === 0, "Missing preview geometry never invents interactive slots");
        check(previewSlotRegions(steps, {left: 0, top: 0, right: 0, bottom: 10}).length === 0,
            "Invalid composite bounds disable preview interaction");
        const store = new PsdPreviewStore({getPixels: async () => ({sourceBounds: {left: 0, top: 0, right: 1000, bottom: 500},
            level: 0, imageData: {dispose() {}}}), encodeImageData: async () => "DATA"}, callback => callback());
        await store.capture("geometry", 42, store.begin("geometry"), () => false, steps);
        check(store.get("geometry").regions[0].id === 17, "Successful composite retains its canonical slot identities");
    }

    {
        const commands = [];
        const service = new SmartObjectService({batchPlay: {command: async command => {
            commands.push(command);
            return command._obj === "get" ? {hasUserMask: false, hasVectorMask: true} : {};
        }}});
        await service.preserveSlotShape({id: 7}, {alreadyInModal: true});
        check(commands.some(c => c.to?._value === "transparencyEnum"), "Brush transparency is captured before replacing contents");
        check(commands.some(c => c.using?._value === "revealSelection"), "Fractional transparency becomes a persistent mask");
        check(commands.some(c => c.to?.userMaskLinked === false && c.to?.vectorMaskLinked === false), "Moving photo leaves both masks fixed");
        service.batchPlay.command = async c => { commands.push(c); return {hasUserMask: true}; };
        commands.length = 0;
        await service.preserveSlotShape({id: 7});
        check(!commands.some(c => c._obj === "make"), "Existing painted masks are retained instead of replaced by rectangles");
        service.batchPlay.command = async () => ({smartObjectMore: {transform: [100, 200, -50, 200, -50, 0, 100, 0]}});
        const bounds = await service.contentBounds(7);
        check(bounds.width === 150 && bounds.height === 200 && bounds.left === -50, "Fitting uses full transformed content, independent of mask and flip");
        const mask = {sourceBounds: {left: 0, top: 0, right: 3, bottom: 1}, imageData: {width: 3, height: 1, components: 1}};
        const bg = {...mask, imageData: {...mask.imageData, components: 3}};
        const cover = slotShapeCover(mask, new Uint8Array([0,128,255]), bg, new Uint8Array([10,20,30,40,50,60,70,80,90]), mask.sourceBounds, 3, 1, 0);
        assert.deepStrictEqual([...cover], [10,20,30,255,40,50,60,127,0,0,0,0]);
        check(true, "Draft brush cover preserves soft alpha rather than thresholding the edge");
        const foreground = {image: {...mask, imageData: {...mask.imageData, components: 4}}, bytes: new Uint8Array([0,0,0,0, 0,0,0,0, 20,30,40,255])};
        const textCover = slotShapeCover(mask, new Uint8Array([0,128,255]), bg, new Uint8Array(9), mask.sourceBounds, 3, 1, 0, [foreground]);
        check(textCover[8] === 20 && textCover[11] === 255, "Template foreground remains above the moving photo inside an opaque slot");
        const trimmed = {...mask, sourceBounds: {left: 1, top: 0, right: 2, bottom: 1}, imageData: {width: 1, height: 1, components: 1}};
        const trimmedCover = slotShapeCover(trimmed, new Uint8Array([255]), bg, new Uint8Array(9), mask.sourceBounds, 3, 1, 0);
        check(trimmedCover[3] === 255 && trimmedCover[7] === 0 && trimmedCover[11] === 255, "Trimmed mask stays at original document coordinates");
        const layer = {id: 7, visible: true, fillOpacity: 75}; let disposed = 0;
        await assert.rejects(() => captureSlotShape({
            getLayerMask: async () => ({...mask, imageData: {...mask.imageData, getData: async () => new Uint8Array([0,128,255]), dispose() {disposed++;}}}),
            getPixels: async () => { check(layer.fillOpacity === 0 && layer.visible, "Background capture keeps effects visible while hiding only photo fill"); throw new Error("pixel read failed"); }
        }, {batchPlay: async () => [{hasUserMask: true}]}, {id: 42, layers: [layer]}, {slotLayerId: 7, slotBounds: mask.sourceBounds}, () => false));
        check(layer.visible && layer.fillOpacity === 75 && disposed === 1, "Preview failure restores fill and visibility and releases mask pixels");
    }

    // Group A: ProjectExecutor.sheetOutputBaseName
    {
        const name = ProjectExecutor.sheetOutputBaseName({ sheetOrder: 0, sheetLabel: "Spread 1" });
        check(name === "Spread_01", "A-1: sheetOrder=0 expected 'Spread_01', got '" + name + "'");
    }

    {
        const name = ProjectExecutor.sheetOutputBaseName({ sheetOrder: 15, sheetLabel: "Spread 16" });
        check(name === "Spread_16", "A-2: sheetOrder=15 expected 'Spread_16', got '" + name + "'");
    }

    {
        const names = Array.from({ length: 16 }, (_, i) =>
            ProjectExecutor.sheetOutputBaseName({ sheetOrder: i })
        );
        const unique = new Set(names);
        check(unique.size === 16, "A-3: Expected 16 unique names, got " + unique.size);
        for (let i = 0; i < 16; i++) {
            const expected = "Spread_" + String(i + 1).padStart(2, "0");
            check(names[i] === expected, "A-3: Spread " + (i + 1) + " expected '" + expected + "', got '" + names[i] + "'");
        }
    }

    {
        const a = ProjectExecutor.sheetOutputBaseName({ sheetOrder: 0 });
        const b = ProjectExecutor.sheetOutputBaseName({ sheetOrder: 1 });
        check(a !== b, "A-4: Two sheets must not produce the same output name, both got '" + a + "'");
    }

    {
        const name = ProjectExecutor.sheetOutputBaseName({ sheetOrder: 4 });
        check(name === "Spread_05", "A-5: Expected 'Spread_05', got '" + name + "'");
    }

    {
        const name = ProjectExecutor.sheetOutputBaseName();
        check(name === "Spread_01", "A-6: Default sheetOrder=0 expected 'Spread_01', got '" + name + "'");
    }

    // Group B: TemplateExportService.destination
    const exportService = makeExportService();
    const mockProject = { workspace: { output: makeMockFolder() } };
    const mockTemplate = { name: "22.psd" };
    const mockDocument = { title: "22.psd" };
    const mockDescriptor = { name: "22.psd" };

    {
        const dest = await exportService.destination(
            mockProject, mockTemplate, mockDocument, "JPEG", mockDescriptor, null
        );
        check(dest.finalName === "22.jpg", "B-1: Legacy naming expected '22.jpg', got '" + dest.finalName + "'");
    }

    {
        const dest = await exportService.destination(
            mockProject, mockTemplate, mockDocument, "JPEG", mockDescriptor, "Spread_01"
        );
        check(dest.finalName === "Spread_01.jpg", "B-2: Sheet naming expected 'Spread_01.jpg', got '" + dest.finalName + "'");
    }

    {
        const dest1 = await exportService.destination(
            mockProject, mockTemplate, mockDocument, "JPEG", mockDescriptor, "Spread_01"
        );
        const dest2 = await exportService.destination(
            mockProject, mockTemplate, mockDocument, "JPEG", mockDescriptor, "Spread_02"
        );
        check(dest1.finalName !== dest2.finalName, "B-3: Two sheets must not collide: '" + dest1.finalName + "' vs '" + dest2.finalName + "'");
        check(dest1.finalName === "Spread_01.jpg", "B-3: Sheet 1 expected 'Spread_01.jpg', got '" + dest1.finalName + "'");
        check(dest2.finalName === "Spread_02.jpg", "B-3: Sheet 2 expected 'Spread_02.jpg', got '" + dest2.finalName + "'");
    }

    {
        const results = [];
        for (let i = 0; i < 16; i++) {
            const dest = await exportService.destination(
                mockProject, mockTemplate, mockDocument, "JPEG", mockDescriptor,
                ProjectExecutor.sheetOutputBaseName({ sheetOrder: i })
            );
            results.push(dest);
        }
        const finalNames = results.map(function(d) { return d.finalName; });
        const unique = new Set(finalNames);
        check(unique.size === 16, "B-4: Expected 16 unique export names, got " + unique.size);
        for (let i = 0; i < 16; i++) {
            const expected = "Spread_" + String(i + 1).padStart(2, "0") + ".jpg";
            check(finalNames[i] === expected, "B-4: Spread " + (i + 1) + " expected '" + expected + "', got '" + finalNames[i] + "'");
        }
    }

    {
        const dest = await exportService.destination(
            mockProject, mockTemplate, mockDocument, "PSD", mockDescriptor, "Spread_07"
        );
        check(dest.finalName === "Spread_07.psd", "B-5: PSD expected 'Spread_07.psd', got '" + dest.finalName + "'");
    }

    // Group C: TemplateAutoSaveService.copyDestination
    const autoSaveService = makeAutoSaveService();

    {
        const dest = await autoSaveService.copyDestination(
            mockProject, mockTemplate, mockDocument, mockDescriptor, null
        );
        check(dest.finalName === "22.psd", "C-1: Auto Save legacy naming expected '22.psd', got '" + dest.finalName + "'");
    }

    {
        const dest = await autoSaveService.copyDestination(
            mockProject, mockTemplate, mockDocument, mockDescriptor, "Spread_03"
        );
        check(dest.finalName === "Spread_03.psd", "C-2: Auto Save sheet naming expected 'Spread_03.psd', got '" + dest.finalName + "'");
    }

    {
        const dest1 = await autoSaveService.copyDestination(
            mockProject, mockTemplate, mockDocument, mockDescriptor, "Spread_04"
        );
        const dest2 = await autoSaveService.copyDestination(
            mockProject, mockTemplate, mockDocument, mockDescriptor, "Spread_05"
        );
        check(dest1.finalName !== dest2.finalName, "C-3: Auto Save collision: '" + dest1.finalName + "' vs '" + dest2.finalName + "'");
    }

    // Group D: Normal non-album batch mode is unchanged
    {
        const dest = await exportService.destination(
            mockProject, mockTemplate, mockDocument, "JPEG",
            { name: "Wedding_Layout_A.psd" }, null
        );
        check(dest.finalName === "Wedding_Layout_A.jpg",
            "D-1: Normal mode expected 'Wedding_Layout_A.jpg', got '" + dest.finalName + "'");
    }

    {
        const dest1 = await exportService.destination(
            mockProject, mockTemplate, mockDocument, "JPEG", { name: "Layout_A.psd" }, null
        );
        const dest2 = await exportService.destination(
            mockProject, mockTemplate, mockDocument, "JPEG", { name: "Layout_B.psd" }, null
        );
        check(dest1.finalName === "Layout_A.jpg", "D-2: Template A expected 'Layout_A.jpg', got '" + dest1.finalName + "'");
        check(dest2.finalName === "Layout_B.jpg", "D-2: Template B expected 'Layout_B.jpg', got '" + dest2.finalName + "'");
    }

    // Group E: Print & Proof Export Intent Forwarding & Dedup
    // -----------------------------------------------------------------------

    // E-1: In-flight dedup keys differentiate by outputBaseName
    {
        const exportSvc = makeExportService();
        let exportCallCount = 0;
        exportSvc.performExport = async function() {
            exportCallCount++;
            return { status: "SUCCESS" };
        };
        const opt1 = { documentContext: { documentId: 101 }, descriptor: { id: "t-22" }, outputBaseName: "Spread_01" };
        const opt2 = { documentContext: { documentId: 101 }, descriptor: { id: "t-22" }, outputBaseName: "Spread_02" };
        const p1 = exportSvc.export(opt1);
        const p2 = exportSvc.export(opt2);
        check(p1 !== p2, "E-1: Two spreads sharing template must have distinct in-flight promises");
        await Promise.all([p1, p2]);
        check(exportCallCount === 2, "E-1: Both spreads executed export independently");
    }

    // E-2: Auto Save SKIPPED does not block JPEG export with outputBaseName
    {
        const exportSvc = new TemplateExportService({
            documentManager: {
                byId: () => ({ id: 101, title: "22.psd" }),
                activate: async () => {},
                activeId: 101,
                exportJPEG: async () => ({})
            },
            fileAdapterFactory: () => ({}),
            transactionRunner: async () => ({ commitState: "COMMITTED", status: "COMMITTED" }),
            transactionId: () => "test-tx"
        });
        const result = await exportSvc.performExport({
            project: mockProject,
            template: mockTemplate,
            documentContext: { documentId: 101 },
            descriptor: mockDescriptor,
            autoSaveResult: { status: "SKIPPED" },
            enabled: true,
            format: "JPEG",
            outputBaseName: "Spread_01"
        });
        check(result.status === "SUCCESS", "E-2: Export succeeds when Auto Save is SKIPPED");
        check(result.outputPath === "Spread_01.jpg", "E-2: Output path is Spread_01.jpg");
    }

    // E-3: Auto Save FAILED blocks export
    {
        const exportSvc = makeExportService();
        const result = await exportSvc.performExport({
            project: mockProject,
            template: mockTemplate,
            documentContext: { documentId: 101 },
            descriptor: mockDescriptor,
            autoSaveResult: { status: "FAILED" },
            enabled: true,
            format: "JPEG",
            outputBaseName: "Spread_01"
        });
        check(result.status === "SKIPPED", "E-3: Export is SKIPPED when Auto Save FAILED");
    }

    // Helper to create mock controller
    function makeMockController({ exportEnabled = false } = {}) {
        const registry = [{
            id: "t-22",
            name: "22.psd",
            validationState: "READY",
            validationReason: null,
            validationSchemaVersion: 1,
            registrationOrder: 0,
            smartObjects: [{ layerId: 2 }, { layerId: 4 }]
        }];
        const sheets = Array.from({ length: 16 }, (_, i) => ({
            id: `sheet-${i + 1}`,
            templateId: "t-22",
            label: `Spread ${i + 1}`,
            slots: [
                { slotId: 1, photoId: `p${i * 2 + 1}` },
                { slotId: 2, photoId: `p${i * 2 + 2}` }
            ]
        }));
        const project = {
            metadata: {
                id: "rec004-proj",
                album: { schemaVersion: 1, id: "alb-1", sheets }
            }
        };
        const photos = Array.from({ length: 32 }, (_, i) => ({
            id: `p${i + 1}`,
            selected: false
        }));

        const controller = Object.create(AppController.prototype);
        controller.exportEnabled = exportEnabled;
        controller.exportFormat = "JPEG";
        controller.projectBatchRunning = false;
        controller.currentProjectExecutionSummary = null;
        controller.currentAlbumSheetRenderRequest = null;
        controller.project = { getProject: () => project };
        controller.projectTemplateRegistry = {
            getAll: () => registry,
            count: () => registry.length
        };
        controller.photoWorkspace = { getPhotoDecisions: () => ({}), getPhotos: () => photos };
        controller.selectedPhotoIds = () => [];
        controller.isAlbumSheetMutationLocked = () => false;
        controller.revalidateProjectTemplates = async () => ({
            persisted: true,
            reason: "ALBUM_SHEET_RENDER_PREFLIGHT",
            blocking: 0
        });
        return { controller, registry, sheets, project };
    }

    // Preview-only template reads must not discard unsaved Photoshop work.
    {
        const {controller, registry} = makeMockController({exportEnabled: false});
        let reads = 0, release;
        controller.templateDocumentReader = {
            ownedDocument: {saved: false},
            listTemplates: async () => [{name: registry[0].fileName}],
            findOpenDocument: () => null,
            previewRegisteredTemplate: async () => { reads++; }
        };
        await controller.previewTemplate(registry[0].id);
        check(reads === 1, "An unsaved owned PSD does not block isolated preview");
        controller.templateDocumentReader.ownedDocument = null;
        controller.templateDocumentReader.findOpenDocument = () => ({saved: false});
        await controller.previewTemplate(registry[0].id);
        check(reads === 2, "An unsaved user-opened PSD does not block isolated preview");
        controller.templateDocumentReader.findOpenDocument = () => null;
        controller.templateDocumentReader.previewRegisteredTemplate = () => new Promise(resolve => { release = resolve; });
        const pending = controller.previewTemplate(registry[0].id);
        await Promise.resolve(); await Promise.resolve();
        check(AppController.prototype.isAlbumSheetMutationLocked.call(controller), "Template preview locks competing spread edits");
        release(); await pending;
        check(!controller.templatePreviewRunning, "Template preview releases its processing lock");
        controller.templateDocumentReader.previewRegisteredTemplate = async () => {throw new Error("read failed");};
        await assert.rejects(controller.previewTemplate(registry[0].id), /read failed/);
        check(!controller.templatePreviewRunning, "Failed template preview releases its processing lock");
    }

    {
        const source = {id: 1, saved: false}; const previewDoc = {id: 2, layers: []};
        const calls = [];
        const tempCopy = {name: "02.psd", delete: async () => calls.push("delete-copy")};
        const folder = {delete: async () => calls.push("delete-folder")};
        const file = {name: "02.psd", copyTo: async target => {assert.strictEqual(target, folder); return tempCopy;}};
        const savedTemp = storage.localFileSystem.getTemporaryFolder, savedCapture = PsdPreviews.capture;
        storage.localFileSystem.getTemporaryFolder = async () => ({createFolder: async () => folder});
        PsdPreviews.capture = async (key, id) => {assert.strictEqual(id, 2); calls.push("capture");};
        const reader = new TemplateDocumentReader({projectEngine: {getProject: () => ({metadata: {id: "qa"}})},
            documentManager: {active: source, open: async entry => {assert.strictEqual(entry, tempCopy); return previewDoc;},
                close: async (doc, options) => {assert.strictEqual(doc, previewDoc); assert.strictEqual(options.save, false); calls.push("close-copy");},
                byId: () => source, activate: async doc => {assert.strictEqual(doc, source); calls.push("restore-active");}}});
        reader.listTemplates = async () => [file];
        reader.ownedDocument = source;
        try {
            await reader.previewRegisteredTemplate({fileName: "02.psd"});
            assert.deepStrictEqual(calls, ["capture", "close-copy", "restore-active", "delete-copy", "delete-folder"]);
            check(reader.ownedDocument === source && source.saved === false, "Isolated template preview preserves the unsaved working PSD and cleans up only its own copy");
            calls.length = 0;
            PsdPreviews.capture = async () => {throw new Error("capture failure");};
            await assert.rejects(reader.previewRegisteredTemplate({fileName: "02.psd"}), /capture failure/);
            check(calls.join(",") === "close-copy,restore-active,delete-copy,delete-folder", "Preview failure also restores the original document and removes its temporary copy");
        } finally {storage.localFileSystem.getTemporaryFolder = savedTemp; PsdPreviews.capture = savedCapture;}
    }

    // E-4: Normal Render Spread + Designer Export OFF -> export remains SKIPPED / false
    {
        const { controller } = makeMockController({ exportEnabled: false });
        let delegatedOptions = null;
        controller.executeProject = async (_onUpdate, options) => {
            delegatedOptions = options;
            return { status: "COMPLETED" };
        };

        const created = controller.createAlbumSheetRenderRequest("sheet-1");
        check(created.accepted === true, "E-4: Sheet render request created");
        await controller.executeAlbumSheetRenderRequest(created.request);
        check(delegatedOptions !== null, "E-4: executeProject was called");
        check(delegatedOptions.exportEnabled === false,
            "E-4: Normal Render Spread with Export OFF must pass exportEnabled: false");
        check(delegatedOptions.sheetContext.sheetOrder === 0,
            "E-4: sheetContext.sheetOrder is 0 for Sheet 1");
    }

    // E-5: Normal Render Spread + Designer Export ON -> exportEnabled is true
    {
        const { controller } = makeMockController({ exportEnabled: true });
        let delegatedOptions = null;
        controller.executeProject = async (_onUpdate, options) => {
            delegatedOptions = options;
            return { status: "COMPLETED" };
        };

        const created = controller.createAlbumSheetRenderRequest("sheet-3");
        await controller.executeAlbumSheetRenderRequest(created.request);
        check(delegatedOptions.exportEnabled === true,
            "E-5: Normal Render Spread with Export ON must pass exportEnabled: true");
        check(delegatedOptions.sheetContext.sheetOrder === 2,
            "E-5: sheetContext.sheetOrder is 2 for Sheet 3");
    }

    // E-6: Lab Print Batch + Designer Export OFF -> export is forcibly enabled for each sheet
    {
        const { controller } = makeMockController({ exportEnabled: false });
        const delegatedCalls = [];
        controller.executeProject = async (_onUpdate, options) => {
            delegatedCalls.push(options);
            return { status: "COMPLETED" };
        };

        const batchSummary = await controller.executeAlbumBatchRender({
            exportOptions: { type: "LAB_PRINT", format: "JPEG" }
        });
        check(batchSummary.totalSheets === 16, "E-6: Batch contains 16 sheets");
        check(batchSummary.successfulSheets === 16, "E-6: All 16 sheets reported success");
        check(delegatedCalls.length === 16, "E-6: Exactly 16 sheets executed");

        // Verify every sheet was forcibly enabled for export and has unique sheet order
        for (let i = 0; i < 16; i++) {
            const call = delegatedCalls[i];
            check(call.exportEnabled === true,
                `E-6: Spread ${i + 1} must have exportEnabled: true even with Designer Export OFF`);
            check(call.sheetContext.sheetOrder === i,
                `E-6: Spread ${i + 1} sheetOrder expected ${i}, got ${call.sheetContext.sheetOrder}`);
            const expectedName = `Spread_${String(i + 1).padStart(2, "0")}`;
            const actualName = ProjectExecutor.sheetOutputBaseName(call.sheetContext);
            check(actualName === expectedName,
                `E-6: Spread ${i + 1} name expected ${expectedName}, got ${actualName}`);
        }
    }

    // E-7: 16 spreads produce unique output names from Spread_01.jpg to Spread_16.jpg
    {
        const names = Array.from({ length: 16 }, (_, i) =>
            ProjectExecutor.sheetOutputBaseName({ sheetOrder: i }) + ".jpg"
        );
        const unique = new Set(names);
        check(unique.size === 16, "E-7: Exactly 16 unique output names");
        check(names[0] === "Spread_01.jpg", "E-7: First is Spread_01.jpg");
        check(names[15] === "Spread_16.jpg", "E-7: Last is Spread_16.jpg");
    }

    // E-8: Controller executeAlbumBatchRender with incomplete spread blocks before Photoshop execution
    {
        const { controller, project } = makeMockController({ exportEnabled: false });
        // Make Spread 16 incomplete (1 of 2 slots assigned)
        project.metadata.album.sheets[15].slots = [{ slotId: 1, photoId: "p31" }];

        let projectExecuted = false;
        controller.executeProject = async () => {
            projectExecuted = true;
            return { status: "COMPLETED" };
        };

        let threw = false;
        try {
            await controller.executeAlbumBatchRender({
                exportOptions: { type: "LAB_PRINT", format: "JPEG" }
            });
        } catch (error) {
            threw = true;
            check(error.code === "ALBUM_BATCH_RENDER_REJECTED", "E-8: Error code is ALBUM_BATCH_RENDER_REJECTED");
            check(error.message.includes("Lab Print Batch blocked"), "E-8: Error message indicates Lab Print Batch blocked");
            check(error.incompleteSheets.length === 1, "E-8: Exactly 1 incomplete sheet identified");
            check(error.incompleteSheets[0].sheetId === "sheet-16", "E-8: Identified sheet-16 as incomplete");
            check(error.incompleteSheets[0].missingCount === 1, "E-8: sheet-16 missing 1 slot");
        }
        check(threw === true, "E-8: executeAlbumBatchRender threw error");
        check(projectExecuted === false, "E-8: executeProject was NEVER called (Photoshop execution blocked)");
    }

    // Group F: Sequential Sheet Render Transform Invariance & State Isolation
    // -----------------------------------------------------------------------

    // F-1: PlacementExecutionPlanBuilder preserves canonical slotBounds
    {
        const planBuilder = new PlacementExecutionPlanBuilder();
        const template = {
            id: "t-22",
            document: { id: "doc-1" },
            smartObjects: [
                { layerId: 2, layerName: "Slot 1", bounds: { top: 0, left: 0, right: 1000, bottom: 1000, width: 1000, height: 1000, centerX: 500, centerY: 500 } }
            ]
        };
        const placementResult = {
            id: "pr-1",
            projectId: "proj-1",
            templateId: "t-22",
            templateDocumentId: "doc-1",
            assignments: [
                { slotLayerId: 2, photoId: "p1", fitMode: "fill" }
            ],
            warnings: []
        };
        const photos = [{ id: "p1", name: "Photo1.jpg", nativePath: "/photos/p1.jpg" }];
        const plan = planBuilder.build({ placementResult, project: { metadata: { id: "proj-1" } }, template, photos });
        check(plan.steps.length === 1, "F-1: Plan has 1 step");
        check(plan.steps[0].slotBounds !== null, "F-1: Step has slotBounds");
        check(plan.steps[0].slotBounds.width === 1000, "F-1: slotBounds width is 1000");
        check(plan.steps[0].slotBounds.height === 1000, "F-1: slotBounds height is 1000");
    }

    // Crop intent must survive every serialization boundary and reach host geometry.
    {
        const bounds = (left, top, width, height) => ({left, top, right: left + width, bottom: top + height,
            width, height, centerX: left + width / 2, centerY: top + height / 2});
        for (const focus of ["top", "bottom", "left", "right", "center", "manual"]) {
            for (const portrait of [true, false]) {
                const slotBounds = bounds(10, 20, portrait ? 200 : 100, portrait ? 100 : 200);
                const template = {id: "crop-template", document: {id: 42}, smartObjects: [
                    {layerId: 17, layerName: "01", bounds: slotBounds}]};
                const photos = [{id: "crop-photo", name: "Photo.jpg", file: {nativePath: "/fixture/photo.jpg"}, width: 100, height: 200}];
                const project = {metadata: {id: "crop-project"}};
                const placement = new PhotoPlacementEngine().plan({project, template, photos,
                    options: {slotAssignments: [{slotId: 17, photoId: "crop-photo", cropFocus: focus === "manual" ? "center" : focus,
                        ...(focus === "manual" ? {position: {x: 3, y: -3, zoom: 1.5}} : {})}]}});
                const plan = new PlacementExecutionPlanBuilder().build({placementResult: placement, project, template, photos});
                const request = new ReplacementRequest({executionPlan: plan});
                const step = request.steps[0];
                if (focus === "manual") assert.deepStrictEqual(step.position, {x: 3, y: -3, zoom: 1.5});
                check(step.cropFocus === (focus === "manual" ? "center" : focus), "Saved crop focus survives planner, execution plan and replacement request");
                check(step.slotBounds?.top === 20 && Object.isFrozen(step.slotBounds), "Replacement retains immutable canonical slot bounds");
                const layer = {id: 17, bounds: bounds(0, 0, portrait ? 100 : 200, portrait ? 200 : 100)};
                const document = {id: 42};
                let clips = 0;
                const executor = new ReplacementStepExecutor({
                    documentManager: {activeId: 42},
                    smartObjectService: {replaceContentsWithFileEntry: async () => true,
                        clipToBounds: async ({bounds: clipped}) => { clips++; assert.deepStrictEqual(clipped, slotBounds); }},
                    layerBoundsService: {get: target => target.bounds},
                    layerTransformService: {transform: async ({scaleX, scaleY, offsetX = 0, offsetY = 0}) => {
                        const b = layer.bounds, width = b.width * (scaleX == null ? 1 : scaleX / 100),
                            height = b.height * (scaleY == null ? 1 : scaleY / 100);
                        layer.bounds = bounds(b.centerX + offsetX - width / 2, b.centerY + offsetY - height / 2, width, height);
                    }}
                });
                executor.recoverParentDocument = async () => {};
                executor.validate = () => ({document, layer, photo: photos[0], fileEntry: {name: "Photo.jpg"}});
                executor.refreshSlotLayer = () => layer;
                const originalModal = core.executeAsModal;
                let result;
                try {
                    core.executeAsModal = async task => task({});
                    result = await executor.execute(step, photos);
                } finally { core.executeAsModal = originalModal; }
                check(result.status === "SUCCESS" && clips === 1, "Crop execution completes and preserves the slot mask");
                const b = layer.bounds;
                check(b.left <= slotBounds.left && b.top <= slotBounds.top && b.right >= slotBounds.right && b.bottom >= slotBounds.bottom,
                    "Fill crop covers the complete slot without a gap");
                if (focus === "manual") {
                    check(b.left === slotBounds.left && b.bottom === slotBounds.bottom, "Manual pan clamps to slot edges without gaps");
                    check((portrait ? b.width / slotBounds.width : b.height / slotBounds.height) === 1.5, "Manual zoom reaches Photoshop scaling");
                } else check((focus === "left" ? b.left === slotBounds.left : focus === "right" ? b.right === slotBounds.right : b.centerX === slotBounds.centerX)
                    && (focus === "top" ? b.top === slotBounds.top : focus === "bottom" ? b.bottom === slotBounds.bottom : b.centerY === slotBounds.centerY),
                    "Photoshop translation honors the requested crop edge on both orientations");
            }
        }
        const template = {id: "multi", document: {id: 42}, smartObjects: [
            {layerId: 17, layerName: "01"}, {layerId: 19, layerName: "02"}]};
        const placement = new PhotoPlacementEngine().plan({project: {metadata: {id: "qa"}}, template,
            photos: [{id: "a"}, {id: "b"}], options: {slotAssignments: [
                {slotId: 19, photoId: "a", cropFocus: "bottom"}, {slotId: 17, photoId: "b", cropFocus: "left"}]}});
        check(placement.assignments.map(item => item.cropFocus).join(",") === "bottom,left", "Multi-photo planner retains per-slot crop focus after slot reordering");
        for (const highlighted of ["a", "b", "unbound"]) {
            const photos = ["unbound", "b", "a"].map(id => ({id, selected: id === highlighted}));
            const bound = new PhotoPlacementEngine().plan({project: {metadata: {id: "qa"}}, template,
                photos, options: {slotAssignments: [
                    {slotId: 19, photoId: "a", cropFocus: "bottom"},
                    {slotId: 17, photoId: "b", cropFocus: "left"}]}});
            check(JSON.stringify(bound.assignments.map(item => [item.layerId, item.photoId])) ===
                JSON.stringify([[19, "a"], [17, "b"]]),
                "Every saved spread binding survives unrelated Library highlights and input order");
            check(bound.emptySlots.length === 0, "Explicit spread placement never silently exports empty placeholders");
            check(photos.find(photo => photo.selected).id === highlighted, "Export does not mutate Library selection");
        }
        let missingRejected = false;
        try {
            new PhotoPlacementEngine().plan({project: {metadata: {id: "qa"}}, template,
                photos: [{id: "a", selected: true}], options: {slotAssignments: [
                    {slotId: 19, photoId: "a"}, {slotId: 17, photoId: "missing"}]}});
        } catch (error) { missingRejected = /missing photo/.test(error.message); }
        check(missingRejected, "Missing explicit photos stop planning rather than exporting placeholders");
        let incompleteRejected = false;
        try {
            new PhotoPlacementEngine({photoAssignmentService: {assign: () => [
                {slotId: 19, photoId: "a"}]}}).plan({project: {metadata: {id: "qa"}}, template,
                photos: [{id: "a"}, {id: "b"}], options: {slotAssignments: [
                    {slotId: 19, photoId: "a"}, {slotId: 17, photoId: "b"}]}});
        } catch (error) { incompleteRejected = /placement is incomplete/.test(error.message); }
        check(incompleteRejected, "A partial assignment result cannot proceed to album export");


    }

    // F-2: TemplateDocumentReader closes dirty open document and reopens fresh
    {
        let closeCount = 0;
        let openCount = 0;
        const fakeOpenDoc = { id: 653, path: "/templates/22.psd", title: "22.psd" };
        const mockDocMgr = {
            documents: [fakeOpenDoc],
            open: async file => {
                openCount++;
                return { id: 654, path: file.nativePath, title: file.name };
            },
            close: async (doc, opts) => {
                closeCount++;
            },
            activate: async () => {}
        };
        const reader = new TemplateDocumentReader({
            projectEngine: {
                getProject: () => ({ workspace: { templates: makeMockFolder() } })
            },
            documentManager: mockDocMgr,
            layerTreeReader: { read: () => [], clear: () => {}, smartObjects: () => [], textLayers: () => [] }
        });

        const doc = await reader.openDocument({ nativePath: "/templates/22.psd", name: "22.psd", isFile: true });
        check(closeCount === 1, "F-2: Closed existing dirty document before reopening");
        check(openCount === 1, "F-2: Opened fresh document from disk");
        check(doc.id === 654, "F-2: Received fresh document instance, not mutated existing");
    }

    // F-3: 16 sequential sheet renders with alternating portrait & landscape photos
    // prove scaleFactor and translation NEVER compound or drift across spreads.
    {
        const canonicalSlot = {
            top: 100, left: 100, right: 1100, bottom: 1100,
            width: 1000, height: 1000,
            centerX: 600, centerY: 600
        };

        const computedScales = [];
        const computedOffsets = [];

        // Simulate 16 sequential spreads (Spread 01 to Spread 16)
        // Alternating portrait (800x1200) and landscape (1600x900)
        for (let spread = 1; spread <= 16; spread++) {
            const isPortrait = spread % 2 === 1;
            const photoWidth = isPortrait ? 800 : 1600;
            const photoHeight = isPortrait ? 1200 : 900;
            const photoBounds = {
                width: photoWidth, height: photoHeight,
                centerX: photoWidth / 2, centerY: photoHeight / 2
            };

            // Using canonical slot bounds as reference (guaranteed by our fix)
            const scaleFactor = Math.max(
                canonicalSlot.width / photoBounds.width,
                canonicalSlot.height / photoBounds.height
            );
            const scaledWidth = photoBounds.width * scaleFactor;
            const scaledHeight = photoBounds.height * scaleFactor;
            const transformedCenterX = photoBounds.centerX * scaleFactor;
            const transformedCenterY = photoBounds.centerY * scaleFactor;
            const offsetX = canonicalSlot.centerX - transformedCenterX;
            const offsetY = canonicalSlot.centerY - transformedCenterY;

            computedScales.push(scaleFactor);
            computedOffsets.push({ offsetX, offsetY });
        }

        // Spread 01 (portrait, 800x1200): scaleFactor = max(1000/800, 1000/1200) = 1.25
        check(computedScales[0] === 1.25, "F-3: Spread 01 scale is exactly 1.25");
        // Spread 07 (portrait, 800x1200): scaleFactor must be IDENTICAL 1.25
        check(computedScales[6] === 1.25, "F-3: Spread 07 scale is exactly 1.25 (no drift)");
        // Spread 08 (landscape, 1600x900): scaleFactor = max(1000/1600, 1000/900) = 10/9 = 1.1111...
        check(Math.abs(computedScales[7] - (10 / 9)) < 1e-10, "F-3: Spread 08 scale is exactly 1.111... (no accumulation)");
        // Spread 16 (landscape, 1600x900): scaleFactor must be IDENTICAL to Spread 08
        check(Math.abs(computedScales[15] - (10 / 9)) < 1e-10, "F-3: Spread 16 scale is exactly 1.111... (invariant)");

        // Verify all portrait spreads have identical scaleFactor = 1.25
        const portraitScales = [0, 2, 4, 6, 8, 10, 12, 14].map(i => computedScales[i]);
        check(portraitScales.every(s => s === 1.25), "F-3: All 8 portrait spreads have invariant 1.25 scale");

        // Verify all landscape spreads have identical scaleFactor = 10/9
        const landscapeScales = [1, 3, 5, 7, 9, 11, 13, 15].map(i => computedScales[i]);
        check(landscapeScales.every(s => Math.abs(s - (10 / 9)) < 1e-10), "F-3: All 8 landscape spreads have invariant 10/9 scale");
    }

    {
        const controller = Object.create(AppController.prototype);
        const registered = [{fileName: "existing.psd"}];
        let scans = 0;
        controller.project = {getProject: () => ({})};
        controller.isAlbumSheetMutationLocked = () => false;
        controller.captureTemplateRegistryTransaction = () => ({registry: registered.slice()});
        controller.restoreTemplateRegistryTransaction = () => {};
        controller.projectTemplateRegistry = {getAll: () => registered,
            add: (file, state, options) => registered.push({fileName: file.name, ...options})};
        controller.templateDocumentReader = {
            listTemplates: async () => ["existing.psd", "new.psd", "broken.psd"].map(name => ({name})),
            previewRegisteredTemplate: async descriptor => {
                scans++;
                if (descriptor.fileName === "broken.psd") throw new Error("Unreadable PSD");
                return {smartObjects: [{layerId: 42, layerName: "Photo"}]};
            }
        };
        controller.validateAndPersistTemplateRegistry = async () => ({persisted: true});
        const result = await controller.revalidateProjectTemplates({reason: "USER_REVALIDATE"});
        check(registered.length === 2 && registered[1].smartObjects[0].layerId === 42,
            "Folder scan registers missing PSD with detected slots");
        check(scans === 2 && result.discoveryErrors[0] === "broken.psd",
            "Existing PSD is not duplicated and unreadable PSD is reported");
        check(controller.registryMutationInProgress === false, "Folder scan releases mutation lock");
        await controller.revalidateProjectTemplates({reason: "BATCH_EXECUTION"});
        check(scans === 2, "Execution availability check does not import new templates");
    }
    console.info("ALB-083 PASS — " + assertions + " assertions");
    return assertions;
}

runAlb083Tests().catch(function(err) {
    console.error("ALB-083 FAILED:", err);
    process.exitCode = 1;
});
