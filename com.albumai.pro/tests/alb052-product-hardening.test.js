import assert from "assert";
import fs from "fs";
import path from "path";

import { AppController } from "../src/app/AppController";
import BatchRecoverySnapshot from "../src/project/BatchRecoverySnapshot";
import ProjectEngine from "../src/core/ProjectEngine";
import ProjectService from "../src/services/ProjectService";
import TemplateDocumentReader from "../src/services/TemplateDocumentReader";
import TemplateAutoSaveService, { AutoSaveMode } from "../src/services/TemplateAutoSaveService";
import TemplateExportService, { ExportFormat } from "../src/services/TemplateExportService";
import { AutoSaveStatus } from "../src/services/AutoSaveResult";

let count = 0;
async function test(name, callback) {
    await callback();
    count += 1;
    console.info(`PASS ALB-052: ${name}`);
}

class MemoryEntry {
    constructor(name, parent, { folder = false, content = "" } = {}) {
        this.name = name;
        this.parent = parent;
        this.isFolder = folder;
        this.isFile = !folder;
        this.nativePath = `${parent?.nativePath || ""}/${name}`;
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
        if (this.entries.has(name) && !overwrite) throw new Error(`Entry exists: ${name}`);
        const entry = new MemoryEntry(name, this);
        this.entries.set(name, entry);
        return entry;
    }
    async renameEntry(source, name, { overwrite = false } = {}) {
        if (this.entries.has(name) && !overwrite) throw new Error(`Entry exists: ${name}`);
        this.entries.delete(source.name);
        source.name = name;
        source.nativePath = `${this.nativePath}/${name}`;
        this.entries.set(name, source);
    }
}

function folder(name = "Project") {
    return new MemoryEntry(name, null, { folder: true });
}

function metadata(overrides = {}) {
    return {
        id: "project-1",
        name: "Wedding",
        schemaVersion: 1,
        createdAt: "2026-08-09T00:00:00.000Z",
        updatedAt: "2026-08-09T00:00:00.000Z",
        ...overrides
    };
}

function projectService() {
    return new ProjectService({
        projectEngine: new ProjectEngine(),
        recentProjects: { add() {}, getAll: () => [] }
    });
}

async function run() {
    await test("project schema rejects malformed objects and preserves newer schemas", async () => {
        const service = projectService();
        assert.throws(
            () => service.validateMetadata({ schemaVersion: 1, name: "Missing id" }),
            error => error.code === "PROJECT_METADATA_INVALID" && error.diagnostic.field === "id"
        );
        assert.throws(
            () => service.validateMetadata(metadata({ schemaVersion: 2 })),
            error => error.code === "PROJECT_SCHEMA_INCOMPATIBLE" && error.diagnostic.schemaVersion === 2
        );

        const engine = new ProjectEngine();
        const root = folder();
        engine.open(root, metadata(), { projectFile: null });
        const saving = new ProjectService({
            projectEngine: engine,
            recentProjects: { add() {}, getAll: () => [] }
        });
        await assert.rejects(
            () => saving.saveProject({ batchRecovery: "invalid" }),
            error => error.code === "PROJECT_METADATA_INVALID" && error.diagnostic.field === "batchRecovery"
        );
        assert.strictEqual(engine.getProject().metadata.batchRecovery, undefined);
    });

    await test("invalid primary project metadata restores only a valid schema backup", async () => {
        const root = folder();
        const primary = new MemoryEntry("project.json", root, { content: JSON.stringify({ schemaVersion: 1, name: "Missing id" }) });
        const backup = new MemoryEntry("project.json.bak", root, { content: JSON.stringify(metadata({ name: "Recovered" })) });
        root.entries.set(primary.name, primary);
        root.entries.set(backup.name, backup);
        const recovered = await projectService().readMetadata(primary, root);
        assert.strictEqual(recovered.name, "Recovered");
        assert.deepStrictEqual(JSON.parse((await root.getEntry("project.json")).content), recovered);
        assert.deepStrictEqual(JSON.parse((await root.getEntry("project.json.bak")).content), recovered);
    });

    await test("newer primary project schema never rolls back to an older backup", async () => {
        const root = folder();
        const primary = new MemoryEntry("project.json", root, { content: JSON.stringify(metadata({ schemaVersion: 9 })) });
        const backup = new MemoryEntry("project.json.bak", root, { content: JSON.stringify(metadata()) });
        root.entries.set(primary.name, primary);
        root.entries.set(backup.name, backup);
        await assert.rejects(
            () => projectService().readMetadata(primary, root),
            error => error.code === "PROJECT_SCHEMA_INCOMPATIBLE"
        );
        assert.strictEqual(JSON.parse(primary.content).schemaVersion, 9);
    });

    await test("malformed recovery data fails closed with actionable diagnostics", async () => {
        const malformed = {
            schemaVersion: 3,
            projectId: "project-1",
            registryVersion: "",
            queueOrder: "not-an-array",
            pendingTemplateIds: ["one", "one"],
            photoCursor: -1
        };
        const validation = BatchRecoverySnapshot.validatePersisted(malformed);
        assert.strictEqual(validation.status, "INVALID");
        assert(validation.reasons.some(reason => reason.includes("queueOrder")));
        assert(validation.reasons.some(reason => reason.includes("duplicate")));

        const controller = Object.create(AppController.prototype);
        controller.project = { getProject: () => ({ metadata: { id: "project-1" } }) };
        controller.loadRecovery(malformed);
        const state = controller.getBatchRecoveryState();
        assert.strictEqual(state.available, false);
        assert.strictEqual(state.classification, "INVALID");
        assert.strictEqual(state.diagnostics.status, "INVALID");
    });

    await test("structural PSD read failure closes and releases the owned document", async () => {
        const psd = { name: "broken.psd", nativePath: "/Templates/broken.psd", isFile: true };
        const documents = [];
        let closes = 0;
        const manager = {
            get documents() { return documents; },
            async open() { const document = { id: 7, title: psd.name, path: psd.nativePath, layers: [] }; documents.push(document); return document; },
            async activate() {},
            async close(document) { closes += 1; documents.splice(documents.indexOf(document), 1); }
        };
        const layerReader = { read() { throw new Error("Invalid PSD structure"); }, clear() {}, smartObjects: () => [], textLayers: () => [] };
        const reader = new TemplateDocumentReader({
            projectEngine: { getProject: () => ({ workspace: { templates: { getEntries: async () => [psd] } } }) },
            documentManager: manager,
            layerTreeReader: layerReader
        });
        await assert.rejects(() => reader.read(psd), /Invalid PSD structure/);
        assert.strictEqual(closes, 1);
        assert.strictEqual(documents.length, 0);
        assert.strictEqual(reader.ownedDocument, null);
    });

    await test("failed PSD cleanup retains the owned reference and reports manual remediation", async () => {
        const psd = { name: "broken.psd", nativePath: "/Templates/broken.psd", isFile: true };
        const document = { id: 8, title: psd.name, path: psd.nativePath, layers: [] };
        const documents = [];
        const reader = new TemplateDocumentReader({
            projectEngine: { getProject: () => ({ workspace: { templates: { getEntries: async () => [psd] } } }) },
            documentManager: {
                get documents() { return documents; },
                async open() { documents.push(document); return document; },
                async activate() {},
                async close() { throw new Error("Host close failed"); }
            },
            layerTreeReader: { read() { throw new Error("Invalid PSD structure"); }, clear() {}, smartObjects: () => [], textLayers: () => [] }
        });
        await assert.rejects(
            () => reader.read(psd),
            error => error.code === "TEMPLATE_READ_CLEANUP_FAILED" && /manually/.test(error.message)
        );
        assert.strictEqual(reader.ownedDocument, document);
    });

    await test("duplicate Auto Save calls share one in-flight host write", async () => {
        let writes = 0;
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const document = { id: 10, title: "template.psd" };
        const service = new TemplateAutoSaveService({
            documentManager: {
                byId: () => document,
                activate: async () => {},
                get activeId() { return document.id; },
                async save() { writes += 1; await gate; }
            }
        });
        const options = {
            template: { id: "t1", document: { id: 10 }, filePath: "template.psd" },
            executionSummary: { status: "COMPLETED", completedSteps: 1, failedSteps: 0 },
            enabled: true,
            mode: AutoSaveMode.OVERWRITE_ORIGINAL
        };
        const first = service.save(options);
        const second = service.save(options);
        release();
        const [left, right] = await Promise.all([first, second]);
        assert.strictEqual(writes, 1);
        assert.strictEqual(left, right);
        assert.strictEqual(left.status, AutoSaveStatus.SAVED);
        assert.strictEqual(service.inFlight.size, 0);
    });

    await test("duplicate export calls share one in-flight output transaction", async () => {
        let transactions = 0;
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const exportFolder = { isFolder: true, getEntries: async () => [] };
        const output = { isFolder: true, getEntries: async () => [], createFolder: async () => exportFolder };
        const document = { id: 11, title: "template.psd" };
        const service = new TemplateExportService({
            documentManager: { byId: () => document, activate: async () => {}, get activeId() { return document.id; } },
            transactionRunner: async () => {
                transactions += 1;
                await gate;
                return { status: "COMPLETED", commitState: "COMMITTED" };
            }
        });
        const options = {
            project: { workspace: { output } },
            template: { id: "t1", document: { id: 11 }, filePath: "template.psd" },
            autoSaveResult: { status: AutoSaveStatus.SAVED },
            enabled: true,
            format: ExportFormat.JPEG
        };
        const first = service.export(options);
        const second = service.export(options);
        release();
        const [left, right] = await Promise.all([first, second]);
        assert.strictEqual(transactions, 1);
        assert.strictEqual(left, right);
        assert.strictEqual(left.status, "SUCCESS");
        assert.strictEqual(service.inFlight.size, 0);
    });

    await test("operator UI blocks duplicate project actions and explains invalid recovery", async () => {
        const openFolder = fs.readFileSync(path.join(process.cwd(), "src/components/OpenFolder.jsx"), "utf8");
        const templatePanel = fs.readFileSync(path.join(process.cwd(), "src/components/TemplateDocumentPanel.jsx"), "utf8");
        assert(openFolder.includes("projectActionBusyRef.current"));
        assert(openFolder.includes("hasProject || Boolean(projectAction)"));
        assert(openFolder.includes("!hasProject || Boolean(projectAction)"));
        assert(templatePanel.includes('["STALE", "INCOMPATIBLE", "INVALID"]'));
        assert(templatePanel.includes("Automatic resume and retry are blocked"));
    });

    console.info(`ALB-052 product hardening complete: ${count} scenarios passed.`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
