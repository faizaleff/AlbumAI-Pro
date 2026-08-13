import assert from "assert";

import ProjectEngine from "../src/core/ProjectEngine";
import {
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

        const originalCreateFile = root.createFile.bind(root);
        root.createFile = async (name, options) => {
            const entry = await originalCreateFile(name, options);
            if (name === "project.json.tmp") {
                entry.write = async () => { throw new Error("write rejected"); };
            }
            return entry;
        };

        const rejected = await projectService.saveAlbumSheetMutation(
            persisted.history,
            {
                intent: AlbumSheetMutationIntent.ADD,
                sheet: { id: "body", templateId: "template-cover" }
            },
            { templateIds: ["template-cover"] }
        );
        assert.strictEqual(rejected.accepted, false);
        assert.deepStrictEqual(rejected.history, persisted.history);
        assert.deepStrictEqual(
            projectEngine.getProject().metadata.album,
            persisted.history.present
        );
    });

    console.info(`ALB-080 Slice 1: PASS (${assertions} assertions)`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
