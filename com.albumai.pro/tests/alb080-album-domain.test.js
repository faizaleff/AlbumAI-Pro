import assert from "assert";

import { AppController } from "../src/app/AppController";
import ProjectEngine from "../src/core/ProjectEngine";
import {
    ALBUM_SCHEMA_VERSION,
    AlbumSheetMutationIntent,
    AlbumSheetMutationReason,
    AlbumSheetReason,
    AlbumSheetTemplateReason,
    AlbumSheetTemplateState,
    applyAlbumSheetHistoryMutation,
    applyAlbumSheetMutation,
    createAlbumSheetHistory,
    createEmptyAlbum,
    inspectAlbum,
    redoAlbumSheetHistory,
    resolveAlbumSheetTemplates,
    undoAlbumSheetHistory
} from "../src/project/AlbumSheetSchema";
import {
    AlbumSheetRenderReason,
    createAlbumSheetRenderRequest,
    validateAlbumSheetRenderRequest
} from "../src/project/AlbumSheetRenderBridge";
import ProjectService, {
    PROJECT_SCHEMA_VERSION
} from "../src/services/ProjectService";
import { Buffer as JpegBuffer } from "../src/utils/JpegBuffer";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-080 Slice 1: ${name}`);
}

class MemoryEntry {
    constructor(name, parent, { folder = false, content = "" } = {}) {
        this.name = name;
        this.parent = parent;
        this.isFolder = folder;
        this.isFile = !folder;
        this.content = content;
        this.entries = folder ? new Map() : null;
    }

    async read() { return this.content; }
    async write(value) { this.content = String(value); }
    async delete() { this.parent?.entries.delete(this.name); }
    async getEntries() { return [...this.entries.values()]; }
    async getEntry(name) {
        const entry = this.entries.get(name);
        if (!entry) throw new Error(`Missing entry: ${name}`);
        return entry;
    }
    async createFolder(name) {
        const entry = new MemoryEntry(name, this, { folder: true });
        this.entries.set(name, entry);
        return entry;
    }
    async createFile(name, { overwrite = false } = {}) {
        if (this.entries.has(name) && !overwrite) {
            throw new Error(`Entry exists: ${name}`);
        }
        const entry = new MemoryEntry(name, this);
        this.entries.set(name, entry);
        return entry;
    }
    async renameEntry(source, name, { overwrite = false } = {}) {
        if (this.entries.has(name) && !overwrite) {
            throw new Error(`Entry exists: ${name}`);
        }
        this.entries.delete(source.name);
        source.name = name;
        this.entries.set(name, source);
    }
}

function projectMetadata(overrides = {}) {
    return {
        id: "project-080",
        name: "Album domain fixture",
        schemaVersion: 1,
        createdAt: "2026-08-13T00:00:00.000Z",
        updatedAt: "2026-08-13T00:00:00.000Z",
        templateRegistry: [],
        photoCount: 2,
        ...overrides
    };
}

function service() {
    return new ProjectService({
        projectEngine: new ProjectEngine(),
        recentProjects: { add() {}, getAll: () => [] }
    });
}

async function run() {
    await test("defines a frozen empty Album with ordered sheets", () => {
        const album = createEmptyAlbum();
        assert.deepStrictEqual(album, { schemaVersion: 1, sheets: [] });
        assert(Object.isFrozen(album));
        assert(Object.isFrozen(album.sheets));
    });

    await test("provides the bounded JPEG byte Buffer surface", () => {
        const allocated = JpegBuffer.alloc(3);
        allocated[0] = 4;
        const copied = JpegBuffer.from(allocated);
        assert(copied instanceof Uint8Array);
        assert.deepStrictEqual([...copied], [4, 0, 0]);
        allocated[0] = 9;
        assert.strictEqual(copied[0], 4);
        assert.deepStrictEqual([...JpegBuffer.from([1, 2])], [1, 2]);
    });

    await test("accepts only bounded public-safe Sheet descriptors", () => {
        const inspected = inspectAlbum({
            schemaVersion: 1,
            sheets: [
                { id: "cover_1", templateId: "template-cover", label: "Cover" },
                { id: "spread_2", templateId: "template-spread" }
            ]
        });
        assert.strictEqual(inspected.valid, true);
        assert.deepStrictEqual(inspected.album.sheets.map(sheet => sheet.id), [
            "cover_1", "spread_2"
        ]);
        assert(Object.isFrozen(inspected.album.sheets[0]));
    });

    await test("fails closed for duplicate identifiers and unsupported Sheet data", () => {
        const duplicate = inspectAlbum({
            schemaVersion: 1,
            sheets: [
                { id: "same", templateId: "template-a" },
                { id: "same", templateId: "template-b" }
            ]
        });
        assert.deepStrictEqual(duplicate.reasonCodes, [
            AlbumSheetReason.DUPLICATE_SHEET_ID
        ]);

        const hostReference = inspectAlbum({
            schemaVersion: 1,
            sheets: [{
                id: "cover",
                templateId: "template-a",
                photoshopDocument: { id: 42 }
            }]
        });
        assert.deepStrictEqual(hostReference.reasonCodes, [
            AlbumSheetReason.UNSUPPORTED_SHEET_FIELD
        ]);
    });

    await test("migrates a valid v1 project atomically to an empty v2 Album", async () => {
        const root = new MemoryEntry("Project", null, { folder: true });
        const projectFile = new MemoryEntry("project.json", root, {
            content: JSON.stringify(projectMetadata())
        });
        root.entries.set(projectFile.name, projectFile);

        const migrated = await service().readMetadata(projectFile, root);
        const persisted = JSON.parse(
            (await root.getEntry("project.json")).content
        );

        assert.strictEqual(PROJECT_SCHEMA_VERSION, 2);
        assert.strictEqual(migrated.schemaVersion, 2);
        assert.strictEqual(migrated.photoCount, 2);
        assert.deepStrictEqual(migrated.album, createEmptyAlbum());
        assert.deepStrictEqual(persisted, migrated);
        assert.strictEqual(
            JSON.parse((await root.getEntry("project.json.bak")).content).schemaVersion,
            1
        );
    });

    await test("rejects malformed v2 Album metadata without a silent fallback", () => {
        assert.throws(
            () => service().migrateMetadata(projectMetadata({
                schemaVersion: 2,
                album: { schemaVersion: 1, sheets: [{ id: "bad path", templateId: "ok" }] }
            })),
            error => error.code === "PROJECT_METADATA_INVALID" &&
                error.diagnostic.field === "album" &&
                error.diagnostic.reasonCodes.includes(
                    AlbumSheetReason.INVALID_SHEET_ID
                )
        );
    });

    await test("resolves Sheet compatibility by stable Template IDs, not order", () => {
        const compatibility = resolveAlbumSheetTemplates({
            schemaVersion: 1,
            sheets: [
                { id: "front", templateId: "template-front" },
                { id: "body", templateId: "template-body" },
                { id: "lost", templateId: "template-removed" }
            ]
        }, [
            { id: "template-body", registrationOrder: 0, validationState: "READY", validationSchemaVersion: 1 },
            { id: "template-front", registrationOrder: 1, validationState: "MISSING", validationSchemaVersion: 1 },
            { id: "template-stale", registrationOrder: 2, validationState: "READY", validationSchemaVersion: 0 }
        ]);
        assert.strictEqual(compatibility.status, AlbumSheetTemplateState.TEMPLATE_BLOCKED);
        assert.deepStrictEqual(compatibility.sheets.map(sheet => sheet.state), [
            AlbumSheetTemplateState.TEMPLATE_BLOCKED,
            AlbumSheetTemplateState.READY,
            AlbumSheetTemplateState.MISSING_TEMPLATE
        ]);
        assert.strictEqual(
            compatibility.sheets[0].reasonCode,
            AlbumSheetTemplateReason.TEMPLATE_VALIDATION_BLOCKED
        );
        assert.strictEqual(compatibility.sheets[1].templateRegistrationOrder, 0);

        const stale = resolveAlbumSheetTemplates({
            schemaVersion: 1,
            sheets: [{ id: "stale", templateId: "template-stale" }]
        }, [{
            id: "template-stale",
            registrationOrder: 0,
            validationState: "READY",
            validationSchemaVersion: 0
        }]);
        assert.strictEqual(stale.sheets[0].state, AlbumSheetTemplateState.STALE_TEMPLATE);
    });

    await test("applies only detached canonical Sheet mutations", () => {
        const initial = inspectAlbum({
            schemaVersion: 1,
            sheets: [{ id: "cover", templateId: "template-cover" }]
        }).album;
        const options = { templateIds: ["template-cover", "template-body"] };

        const added = applyAlbumSheetMutation(initial, {
            intent: AlbumSheetMutationIntent.ADD,
            sheet: { id: "body", templateId: "template-body", label: "Body" }
        }, options);
        assert.strictEqual(added.accepted, true);
        assert.deepStrictEqual(added.album.sheets.map(sheet => sheet.id), ["cover", "body"]);
        assert.deepStrictEqual(initial.sheets.map(sheet => sheet.id), ["cover"]);

        const duplicated = applyAlbumSheetMutation(added.album, {
            intent: AlbumSheetMutationIntent.DUPLICATE,
            sheetId: "body",
            newSheetId: "body-copy"
        }, options);
        const renamed = applyAlbumSheetMutation(duplicated.album, {
            intent: AlbumSheetMutationIntent.RENAME,
            sheetId: "body-copy",
            label: "Body copy"
        }, options);
        const moved = applyAlbumSheetMutation(renamed.album, {
            intent: AlbumSheetMutationIntent.MOVE,
            sheetId: "body-copy",
            targetIndex: 0
        }, options);
        const removed = applyAlbumSheetMutation(moved.album, {
            intent: AlbumSheetMutationIntent.REMOVE,
            sheetId: "body"
        }, options);
        assert.deepStrictEqual(removed.album.sheets.map(sheet => sheet.id), ["body-copy", "cover"]);
        assert.strictEqual(removed.album.sheets[0].label, "Body copy");

        const restored = applyAlbumSheetMutation(removed.album, {
            intent: AlbumSheetMutationIntent.RESTORE,
            album: initial
        }, options);
        assert.deepStrictEqual(restored.album, initial);
        assert.strictEqual(applyAlbumSheetMutation(initial, {
            intent: AlbumSheetMutationIntent.ADD,
            sheet: { id: "unregistered", templateId: "template-missing" }
        }, options).reasonCodes[0], AlbumSheetMutationReason.TEMPLATE_NOT_REGISTERED);
    });

    await test("keeps bounded detached Sheet history without recording rejected or no-op commands", () => {
        const options = { templateIds: ["template-a"] };
        let history = createAlbumSheetHistory(createEmptyAlbum());

        const rejected = applyAlbumSheetHistoryMutation(history, {
            intent: AlbumSheetMutationIntent.REMOVE,
            sheetId: "missing"
        }, options);
        assert.strictEqual(rejected.history, history);

        const added = applyAlbumSheetHistoryMutation(history, {
            intent: AlbumSheetMutationIntent.ADD,
            sheet: { id: "sheet-0", templateId: "template-a" }
        }, options);
        history = added.history;
        const unchanged = applyAlbumSheetHistoryMutation(history, {
            intent: AlbumSheetMutationIntent.MOVE,
            sheetId: "sheet-0",
            targetIndex: 0
        }, options);
        assert.strictEqual(unchanged.history, history);

        for (let index = 1; index <= 21; index += 1) {
            history = applyAlbumSheetHistoryMutation(history, {
                intent: AlbumSheetMutationIntent.ADD,
                sheet: { id: `sheet-${index}`, templateId: "template-a" }
            }, options).history;
        }
        assert.strictEqual(history.past.length, 20);
        const undone = undoAlbumSheetHistory(history);
        const redone = redoAlbumSheetHistory(undone.history);
        assert.strictEqual(undone.changed, true);
        assert.strictEqual(redone.history.present.sheets.length, 22);
        assert(Object.isFrozen(redone.history));
    });

    await test("persists an accepted Sheet mutation before publishing project metadata", async () => {
        const root = new MemoryEntry("Project", null, { folder: true });
        const projectFile = new MemoryEntry("project.json", root, {
            content: JSON.stringify(projectMetadata({
                schemaVersion: 2,
                album: createEmptyAlbum()
            }))
        });
        root.entries.set(projectFile.name, projectFile);

        const projectEngine = new ProjectEngine();
        const projectService = new ProjectService({
            projectEngine,
            recentProjects: { add() {}, getAll: () => [] }
        });
        projectEngine.open(root, JSON.parse(projectFile.content), { projectFile });
        const history = createAlbumSheetHistory(createEmptyAlbum());

        const persisted = await projectService.saveAlbumSheetMutation(history, {
            intent: AlbumSheetMutationIntent.ADD,
            sheet: { id: "cover", templateId: "template-cover" }
        }, { templateIds: ["template-cover"] });
        assert.strictEqual(persisted.accepted, true);
        assert.deepStrictEqual(
            projectEngine.getProject().metadata.album,
            persisted.history.present
        );

        const undone = undoAlbumSheetHistory(persisted.history);
        const undoSaved = await projectService.saveAlbumSheetHistory(
            persisted.history,
            undone.history
        );
        assert.strictEqual(undoSaved.accepted, true);
        assert.deepStrictEqual(projectEngine.getProject().metadata.album, createEmptyAlbum());

        const redone = redoAlbumSheetHistory(undoSaved.history);
        const redoSaved = await projectService.saveAlbumSheetHistory(
            undoSaved.history,
            redone.history
        );
        assert.strictEqual(redoSaved.accepted, true);
        assert.deepStrictEqual(
            projectEngine.getProject().metadata.album,
            redoSaved.history.present
        );

        const originalCreateFile = root.createFile.bind(root);
        root.createFile = async (name, options) => {
            const entry = await originalCreateFile(name, options);
            if (name === "project.json.tmp") {
                entry.write = async () => { throw new Error("write rejected"); };
            }
            return entry;
        };

        const rejected = await projectService.saveAlbumSheetMutation(
            redoSaved.history,
            {
                intent: AlbumSheetMutationIntent.ADD,
                sheet: { id: "body", templateId: "template-cover" }
            },
            { templateIds: ["template-cover"] }
        );
        assert.strictEqual(rejected.accepted, false);
        assert.deepStrictEqual(rejected.history, redoSaved.history);
        assert.deepStrictEqual(
            projectEngine.getProject().metadata.album,
            redoSaved.history.present
        );
    });

    await test("blocks every Sheet mutation at an active batch boundary", async () => {
        const controller = Object.create(AppController.prototype);
        controller.projectBatchRunning = true;
        controller.currentProjectExecutionSummary = null;
        assert.strictEqual(controller.isAlbumSheetMutationLocked(), true);
        await assert.rejects(
            () => controller.saveAlbumSheetMutation({}, {}),
            /project batch is running/
        );

        controller.projectBatchRunning = false;
        controller.currentProjectExecutionSummary = {
            batchProgress: { lifecycle: "CANCELLING" }
        };
        assert.strictEqual(controller.isAlbumSheetMutationLocked(), true);
    });

    await test("builds a frozen detached Sheet render request in browser selection order", () => {
        const album = {
            schemaVersion: 1,
            sheets: [{ id: "cover", templateId: "template-cover", label: "Cover" }]
        };
        const registry = [{
            id: "template-cover",
            name: "cover.psd",
            fileReference: "cover.psd",
            registrationOrder: 3,
            validationState: "READY",
            validationReason: "READY",
            validationSchemaVersion: 1
        }];
        const result = createAlbumSheetRenderRequest({
            projectId: "project-080",
            album,
            registry,
            sheetId: "cover",
            selectedPhotoIds: ["photo-2", "photo-1"]
        });

        assert.strictEqual(result.accepted, true);
        assert.deepStrictEqual(result.request.selectedPhotoIds, ["photo-2", "photo-1"]);
        assert.strictEqual(result.request.template.id, "template-cover");
        assert.strictEqual(Object.hasOwn(result.request.template, "fileReference"), false);
        assert(Object.isFrozen(result.request));
        assert(Object.isFrozen(result.request.selectedPhotoIds));
    });

    await test("accepts opaque file-backed Photo IDs while rejecting malformed values", () => {
        const context = {
            projectId: "project-080",
            album: { schemaVersion: 1, sheets: [{ id: "cover", templateId: "template-cover" }] },
            registry: [{ id: "template-cover", registrationOrder: 0, validationState: "READY", validationSchemaVersion: 1 }],
            sheetId: "cover"
        };
        const accepted = createAlbumSheetRenderRequest({
            ...context,
            selectedPhotoIds: ["IMG_5895.jpg", "photo:album/IMG_5918.jpg"]
        });
        assert.strictEqual(accepted.accepted, true);
        assert.deepStrictEqual(accepted.request.selectedPhotoIds, [
            "IMG_5895.jpg", "photo:album/IMG_5918.jpg"
        ]);

        const rejected = createAlbumSheetRenderRequest({
            ...context,
            selectedPhotoIds: ["IMG_5895.jpg", "invalid\nphoto"]
        });
        assert.deepStrictEqual(rejected.reasonCodes, [
            AlbumSheetRenderReason.INVALID_SELECTED_PHOTOS
        ]);
    });

    await test("fails closed for non-renderable Sheets and invalid browser selections", () => {
        const album = { schemaVersion: 1, sheets: [{ id: "cover", templateId: "missing" }] };
        const missing = createAlbumSheetRenderRequest({
            projectId: "project-080",
            album,
            registry: [],
            sheetId: "cover",
            selectedPhotoIds: ["photo-1"]
        });
        assert.strictEqual(missing.accepted, false);
        assert(missing.reasonCodes.includes(AlbumSheetRenderReason.SHEET_NOT_RENDERABLE));

        const selection = createAlbumSheetRenderRequest({
            projectId: "project-080",
            album: { schemaVersion: 1, sheets: [{ id: "cover", templateId: "template-cover" }] },
            registry: [{ id: "template-cover", registrationOrder: 0, validationState: "READY", validationSchemaVersion: 1 }],
            sheetId: "cover",
            selectedPhotoIds: []
        });
        assert.deepStrictEqual(selection.reasonCodes, [AlbumSheetRenderReason.NO_SELECTED_PHOTOS]);
    });

    await test("rejects a stale Sheet render request before execution", () => {
        const context = {
            projectId: "project-080",
            album: { schemaVersion: 1, sheets: [{ id: "cover", templateId: "template-cover", label: "Cover" }] },
            registry: [{
                id: "template-cover",
                registrationOrder: 0,
                validationState: "READY",
                validationReason: "READY",
                validationSchemaVersion: 1
            }],
            selectedPhotoIds: ["photo-1", "photo-2"]
        };
        const request = createAlbumSheetRenderRequest({ ...context, sheetId: "cover" }).request;

        const registryStale = validateAlbumSheetRenderRequest(request, {
            ...context,
            registry: [{ ...context.registry[0], registrationOrder: 1 }]
        });
        assert.deepStrictEqual(registryStale.reasonCodes, [
            AlbumSheetRenderReason.TEMPLATE_REGISTRY_STALE
        ]);

        const selectionStale = validateAlbumSheetRenderRequest(request, {
            ...context,
            selectedPhotoIds: ["photo-2", "photo-1"]
        });
        assert.deepStrictEqual(selectionStale.reasonCodes, [
            AlbumSheetRenderReason.PHOTO_SELECTION_STALE
        ]);

        const sheetStale = validateAlbumSheetRenderRequest(request, {
            ...context,
            album: { schemaVersion: 1, sheets: [{ id: "cover", templateId: "template-cover", label: "Updated" }] }
        });
        assert.deepStrictEqual(sheetStale.reasonCodes, [
            AlbumSheetRenderReason.SHEET_STALE
        ]);
    });

    await test("delegates a current Sheet render through the existing project batch owner", async () => {
        const registry = [{
            id: "template-cover",
            registrationOrder: 0,
            validationState: "READY",
            validationReason: "READY",
            validationSchemaVersion: 1
        }];
        const project = {
            metadata: {
                id: "project-080",
                album: { schemaVersion: 1, sheets: [{ id: "cover", templateId: "template-cover" }] }
            }
        };
        const controller = Object.create(AppController.prototype);
        controller.projectBatchRunning = false;
        controller.currentProjectExecutionSummary = null;
        controller.currentAlbumSheetRenderRequest = null;
        controller.project = { getProject: () => project };
        controller.projectTemplateRegistry = { getAll: () => registry };
        controller.photoWorkspace = {
            getPhotos: () => [{ id: "photo-2", selected: true }, { id: "photo-1", selected: true }]
        };
        controller.revalidateProjectTemplates = async () => ({
            persisted: true,
            reason: "ALBUM_SHEET_RENDER_PREFLIGHT",
            blocking: 0
        });
        let delegated = null;
        controller.executeProject = async (_onUpdate, options) => {
            delegated = options;
            return { status: "COMPLETED" };
        };

        const created = controller.createAlbumSheetRenderRequest("cover");
        assert.strictEqual(created.accepted, true);
        const result = await controller.executeAlbumSheetRenderRequest();
        assert.strictEqual(result.status, "COMPLETED");
        assert.deepStrictEqual(delegated.templates, registry);
        assert.deepStrictEqual(delegated.selectedPhotoIds, ["photo-2", "photo-1"]);
        assert.strictEqual(delegated.runMode, "ALBUM_SHEET_RENDER");
    });

    await test("renders a persisted sheet with valid slot assignments when library selection is empty", async () => {
        const registry = [{
            id: "template-22",
            registrationOrder: 0,
            validationState: "READY",
            validationReason: "READY",
            validationSchemaVersion: 1
        }];
        const project = {
            metadata: {
                id: "project-rec004",
                album: {
                    schemaVersion: 1,
                    sheets: [{
                        id: "Spread_1",
                        templateId: "template-22",
                        slots: [
                            { slotId: "slot-1", photoId: "IMG_5733.jpg" },
                            { slotId: "slot-2", photoId: "IMG_5734.jpg" },
                            { slotId: "slot-3", photoId: "IMG_5735.jpg" }
                        ]
                    }]
                }
            }
        };
        const controller = Object.create(AppController.prototype);
        controller.projectBatchRunning = false;
        controller.currentProjectExecutionSummary = null;
        controller.currentAlbumSheetRenderRequest = null;
        controller.project = { getProject: () => project };
        controller.projectTemplateRegistry = { getAll: () => registry };
        // Empty library selection (no photos selected)
        controller.photoWorkspace = {
            getPhotos: () => [
                { id: "IMG_5733.jpg", selected: false },
                { id: "IMG_5734.jpg", selected: false },
                { id: "IMG_5735.jpg", selected: false }
            ]
        };
        controller.selectedPhotoIds = () => [];
        controller.revalidateProjectTemplates = async () => ({
            persisted: true,
            reason: "ALBUM_SHEET_RENDER_PREFLIGHT",
            blocking: 0
        });
        let delegated = null;
        controller.executeProject = async (_onUpdate, options) => {
            delegated = options;
            return { status: "COMPLETED" };
        };

        const created = controller.createAlbumSheetRenderRequest("Spread_1");
        assert.strictEqual(created.accepted, true);
        assert.deepStrictEqual(created.request.selectedPhotoIds, ["IMG_5733.jpg", "IMG_5734.jpg", "IMG_5735.jpg"]);

        const result = await controller.executeAlbumSheetRenderRequest(created.request);
        assert.strictEqual(result.status, "COMPLETED");
        assert.deepStrictEqual(delegated.selectedPhotoIds, ["IMG_5733.jpg", "IMG_5734.jpg", "IMG_5735.jpg"]);
        assert.strictEqual(delegated.runMode, "ALBUM_SHEET_RENDER");
    });

    await test("fails safely when referenced slot photos cannot be resolved in photo library", async () => {
        const controller = new AppController();
        controller.project = { metadata: { id: "p1" }, getProject: () => ({ metadata: { id: "p1" } }) };
        controller.photoWorkspace = {
            getPhotos: () => [
                { id: "other-photo.jpg", selected: false }
            ]
        };

        let threw = false;
        try {
            await controller.executeProject(null, {
                templates: [{ id: "t1" }],
                selectedPhotoIds: ["missing-photo-1.jpg", "missing-photo-2.jpg"],
                runMode: "ALBUM_SHEET_RENDER"
            });
        } catch (error) {
            threw = true;
            assert.strictEqual(error.code, "MISSING_REFERENCED_PHOTOS");
        }
        assert(threw, "expected missing referenced photos error");
    });

    await test("uses a one-Sheet queue and detached browser selection in recovery", async () => {
        const controller = Object.create(AppController.prototype);
        controller.photoWorkspace = { getPhotos: () => [{ id: "different", selected: true }] };
        controller.registryRecoveryVersion = () => "registry-version";
        controller.logOutputRecoverySummary = () => {};
        controller.persistRecoverySnapshot = async () => {};
        controller.batchRecoverySnapshot = null;
        controller.batchRecoveryClassification = "STALE";

        await controller.beginRecoverySnapshot({
            projectId: "project-080",
            templates: [{ id: "template-cover", name: "cover.psd", fileReference: "cover.psd" }],
            registryTemplates: [
                { id: "template-cover", name: "cover.psd", fileReference: "cover.psd", registrationOrder: 0 },
                { id: "template-body", name: "body.psd", fileReference: "body.psd", registrationOrder: 1 }
            ],
            previous: null,
            runMode: "ALBUM_SHEET_RENDER",
            startedAt: "2026-08-15T00:00:00.000Z",
            selectedPhotoIds: ["photo-2", "photo-1"]
        });

        assert.deepStrictEqual(controller.batchRecoverySnapshot.queueOrder, ["template-cover"]);
        assert.deepStrictEqual(controller.batchRecoverySnapshot.selectedPhotoOrder, ["photo-2", "photo-1"]);
    });

    await test("restores photos, templates, sheets, and slot assignments on project reopen", async () => {
        const root = new MemoryEntry("ProjectFolder", null, { folder: true });
        const controller = new AppController();
        controller.projectService.localFileSystem = {
            async getFolder() { return root; }
        };

        const initialAlbum = {
            schemaVersion: ALBUM_SCHEMA_VERSION,
            sheets: [
                {
                    id: "Spread_A1",
                    templateId: "template-01",
                    label: "Spread A1",
                    slots: []
                },
                {
                    id: "Spread_B1",
                    templateId: "template-02",
                    label: "Spread B1",
                    slots: []
                },
                { id: "Spread_A2", templateId: "template-01", label: "Spread A2", slots: [] },
                { id: "Spread_B2", templateId: "template-02", label: "Spread B2", slots: [] }
            ]
        };

        const createdProject = await controller.projectService.createProject({
            name: "REC004-E2E-ALBUM",
            parentFolder: root
        });

        await createdProject.workspace.templates.createFile("01.psd");
        await createdProject.workspace.templates.createFile("02.psd");

        await controller.saveProject({
            photoSource: { name: "Wedding_Photos", token: "token-wedding" },
            photoCount: 31,
            photoDecisions: {
                "IMG_5733.jpg": { status: "keep", rating: 5 },
                "IMG_5734.jpg": { status: "keep", rating: 4 }
            },
            templateRegistry: [
                {
                    id: "template-01",
                    name: "01.psd",
                    fileReference: "01.psd",
                    fileName: "01.psd",
                    registrationOrder: 0,
                    validationState: "READY",
                    smartObjects: [{ layerId: 2 }, { layerId: 4 }]
                },
                {
                    id: "template-02",
                    name: "02.psd",
                    fileReference: "02.psd",
                    fileName: "02.psd",
                    registrationOrder: 1,
                    validationState: "READY",
                    smartObjects: [{ layerId: 2 }]
                }
            ],
            album: initialAlbum
        }, { reason: "TEST_INITIAL_SAVE" });

        let history = createAlbumSheetHistory(initialAlbum);
        for (const mutation of [
            { sheetId: "Spread_A1", slotId: 2 },
            { sheetId: "Spread_A1", slotId: 4 },
            { sheetId: "Spread_B1", slotId: 2 }
        ]) {
            const saved = await controller.saveAlbumSheetMutation(history, {
                intent: AlbumSheetMutationIntent.ASSIGN_SLOT,
                photoId: "IMG_5733.jpg",
                ...mutation
            });
            assert.strictEqual(saved.accepted, true, `${mutation.sheetId} slot ${mutation.slotId} saved`);
            history = saved.history;
        }

        controller.templateDocumentReader.listTemplates = async () => [
            { name: "01.psd", isFile: true },
            { name: "02.psd", isFile: true }
        ];

        let hydratedPhotos = null;
        controller.photoWorkspace.resolveSourceFolder = async () => ({ name: "Wedding_Photos" });
        controller.photoWorkspace.importPhotos = async (folder) => {
            hydratedPhotos = [
                { id: "IMG_5733.jpg", name: "IMG_5733.jpg", culling: { status: "keep" }, rating: 5 },
                { id: "IMG_5734.jpg", name: "IMG_5734.jpg", culling: { status: "keep" }, rating: 4 }
            ];
            controller.library.load(hydratedPhotos);
            return hydratedPhotos;
        };

        await controller.closeProject();

        const reopened = await controller.openProject(createdProject.folder);
        assert(reopened, "project reopened");
        assert.strictEqual(reopened.metadata.name, "REC004-E2E-ALBUM", "name check");
        assert.deepStrictEqual(
            reopened.metadata.album.sheets.map(sheet => sheet.templateId),
            ["template-01", "template-02", "template-01", "template-02"],
            "A-B-A-B template mapping check"
        );
        assert.deepStrictEqual(
            reopened.metadata.album.sheets[0].slots.map(slot => [slot.slotId, slot.photoId]),
            [[2, "IMG_5733.jpg"], [4, "IMG_5733.jpg"]],
            "01.psd slot 2 and slot 4 assignments persist"
        );
        assert.deepStrictEqual(
            reopened.metadata.album.sheets[1].slots.map(slot => [slot.slotId, slot.photoId]),
            [[2, "IMG_5733.jpg"]],
            "02.psd slot 2 assignment persists"
        );
        assert.strictEqual(controller.getRegisteredProjectTemplates().length, 2, "templates count check");
        assert.strictEqual(controller.getRegisteredProjectTemplates()[0].name, "01.psd", "template 01 name check");
        assert.strictEqual(controller.getRegisteredProjectTemplates()[1].name, "02.psd", "template 02 name check");
        assert.strictEqual(controller.getPhotos().length, 2, "photos count check");
        assert.strictEqual(controller.getPhotos()[0].id, "IMG_5733.jpg", "photo ID check");
    });

    await test("SmartObjectService rejects empty or failed batchPlay execution results", async () => {
        const uxp = await import("uxp");
        const originalLfs = uxp.storage.localFileSystem;
        uxp.storage.localFileSystem = {
            ...originalLfs,
            createSessionToken: async () => "session-token-123"
        };

        try {
            const SmartObjectService = (await import("../src/core/album/SmartObjectService")).default;
            const service = new SmartObjectService({
                batchPlay: {
                    execute: async () => []
                }
            });

            let threwEmpty = false;
            try {
                await service.replaceContentsWithFileEntry({
                    layer: { id: 2 },
                    fileEntry: { name: "test.jpg" }
                });
            } catch (e) {
                threwEmpty = true;
                assert(e.message.includes("returned no results"), "empty results rejected");
            }
            assert(threwEmpty, "expected empty results error");

            let capturedDescriptors = null;
            const validBatchPlayService = new SmartObjectService({
                batchPlay: {
                    command: async () => ({ smartObject: { fileReference: "ZSA00166.jpg" } }),
                    execute: async (desc) => {
                        capturedDescriptors = desc;
                        return [{ _obj: "select" }, { _obj: "placedLayerReplaceContents", _isCommand: true }];
                    }
                }
            });

            const success = await validBatchPlayService.replaceContentsWithFileEntry({
                layer: { id: 2 },
                fileEntry: { name: "ZSA00166.jpg" }
            });
            assert.strictEqual(success, true, "successful replacement returns true");
            assert(Array.isArray(capturedDescriptors), "descriptors were sent");
            const selectDesc = capturedDescriptors.find(d => d._obj === "select");
            assert(selectDesc != null, "select descriptor found");
            assert.deepStrictEqual(selectDesc._target, [{ _ref: "layer", _id: 2 }], "select targets layer by ID");
            const replaceDesc = capturedDescriptors.find(d => d._obj === "placedLayerReplaceContents");
            assert(replaceDesc != null, "placedLayerReplaceContents descriptor found");
            assert.deepStrictEqual(replaceDesc._target, [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }], "targets active layer via targetEnum");
            assert.strictEqual(replaceDesc._options?.dialogOptions, "dontDisplay", "dialogOptions is dontDisplay");

            // Test false-success detection: when post-replacement file reference did not update
            let callCount = 0;
            const unchangedRefService = new SmartObjectService({
                batchPlay: {
                    command: async () => {
                        callCount++;
                        // Always returns the original template photo reference
                        return { smartObject: { fileReference: "ZWK02241.jpg" } };
                    },
                    execute: async () => [{ _obj: "select" }, { _obj: "placedLayerReplaceContents" }]
                }
            });

            let detectedFalseSuccess = false;
            try {
                await unchangedRefService.replaceContentsWithFileEntry({
                    layer: { id: 2 },
                    fileEntry: { name: "ZSA00166.jpg" }
                });
            } catch (e) {
                detectedFalseSuccess = true;
                assert(e.message.includes("did not update layer contents"), "detects unchanged smart object content");
            }
            assert(detectedFalseSuccess, "expected false success detection error");
        } finally {
            uxp.storage.localFileSystem = originalLfs;
        }
    });

    await test("ReplacementStepExecutor returns FAILED status and error details on smart object failure", async () => {
        const ReplacementStepExecutor = (await import("../src/placement/ReplacementStepExecutor")).default;
        const executor = new ReplacementStepExecutor({
            documentManager: {
                activeId: 653,
                active: { id: 653 },
                byId: () => ({ id: 653 })
            },
            layerManager: {
                scan: () => {},
                byId: () => ({ id: 2, kind: "smartObject" })
            },
            smartObjectService: {
                replaceContentsWithFileEntry: async () => {
                    throw new Error("Photoshop command rejected");
                }
            },
            layerBoundsService: {
                get: () => ({ width: 1000, height: 1000, centerX: 500, centerY: 500 })
            }
        });

        const step = {
            stepNumber: 1,
            requestId: "req-1",
            expectedDocumentId: 653,
            slotLayerId: 2,
            photoId: "p1",
            photoFileReference: "p1.jpg",
            expectedLayerType: "smartObject"
        };
        const photos = [
            { id: "p1", name: "p1.jpg", file: { name: "p1.jpg", nativePath: "p1.jpg" } }
        ];

        const result = await executor.execute(step, photos);
        assert.strictEqual(result.status, "FAILED", "status must be FAILED");
        assert(result.failedSteps.length > 0, "failedSteps must be populated");
        assert.strictEqual(result.completedSteps.length, 0, "completedSteps must be empty");
    });

    await test("ProjectExecutor.isTemplateSuccessful handles skipped outputs vs replacement failures correctly", async () => {
        const ProjectExecutor = (await import("../src/project/ProjectExecutor")).default;
        const executor = new ProjectExecutor({
            templateRegistry: { getAll: () => [] },
            photoPlacementEngine: {},
            placementExecutionPlanBuilder: {},
            replacementBatchExecutor: {}
        });

        const baseContext = {
            placementResult: { assignments: [{ slotLayerId: 2, photoId: "p1" }] },
            executionPlan: { steps: [{ slotLayerId: 2, photoId: "p1" }] },
            request: { steps: [{ slotLayerId: 2, photoId: "p1" }] },
            executionSummary: { status: "COMPLETED", completedSteps: 1, failedSteps: 0 }
        };

        // 1. Replacements completed + Auto Save disabled + Export disabled -> SUCCESS
        const allDisabled = executor.isTemplateSuccessful({
            ...baseContext,
            autoSaveEnabled: false,
            autoSaveResult: { status: "SKIPPED" },
            exportEnabled: false,
            exportResult: { status: "SKIPPED" }
        });
        assert.strictEqual(allDisabled, true, "template is successful when replacements complete and outputs are disabled");

        // 2. Replacements completed + Auto Save disabled + Export SKIPPED -> SUCCESS
        const exportSkipped = executor.isTemplateSuccessful({
            ...baseContext,
            autoSaveEnabled: false,
            autoSaveResult: { status: "SKIPPED" },
            exportEnabled: true,
            exportResult: { status: "SKIPPED" }
        });
        assert.strictEqual(exportSkipped, true, "template is successful when export is skipped");

        // 3. Replacements completed + Auto Save SAVED + Export SUCCESS -> SUCCESS
        const allSuccess = executor.isTemplateSuccessful({
            ...baseContext,
            autoSaveEnabled: true,
            autoSaveResult: { status: "SAVED" },
            exportEnabled: true,
            exportResult: { status: "SUCCESS" }
        });
        assert.strictEqual(allSuccess, true, "template is successful when outputs succeed");

        // 4. Replacement failed -> FAILED
        const replaceFailed = executor.isTemplateSuccessful({
            ...baseContext,
            executionSummary: { status: "FAILED", completedSteps: 0, failedSteps: 1 },
            autoSaveEnabled: false,
            autoSaveResult: { status: "SKIPPED" },
            exportEnabled: false,
            exportResult: { status: "SKIPPED" }
        });
        assert.strictEqual(replaceFailed, false, "template fails when replacement fails");

        // 5. Auto Save failed -> FAILED
        const autoSaveFailed = executor.isTemplateSuccessful({
            ...baseContext,
            autoSaveEnabled: true,
            autoSaveResult: { status: "FAILED" },
            exportEnabled: false,
            exportResult: { status: "SKIPPED" }
        });
        assert.strictEqual(autoSaveFailed, false, "template fails when enabled Auto Save fails");

        // 6. Export failed -> FAILED
        const exportFailed = executor.isTemplateSuccessful({
            ...baseContext,
            autoSaveEnabled: false,
            autoSaveResult: { status: "SKIPPED" },
            exportEnabled: true,
            exportResult: { status: "FAILED" }
        });
        assert.strictEqual(exportFailed, false, "template fails when enabled Export fails");
    });

    console.info(`ALB-080 Slice 1: PASS (${assertions} assertions)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
