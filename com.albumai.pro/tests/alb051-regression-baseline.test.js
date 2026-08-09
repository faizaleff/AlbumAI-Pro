import assert from "assert";
import React from "react";
import ReactDOMServer from "react-dom/server";
import { entrypoints } from "uxp";

import "../src/index.jsx";
import { PanelController } from "../src/controllers/PanelController";
import { AlbumBrowser } from "../src/panels/AlbumBrowser.jsx.jsx";
import BatchProgressPanel from "../src/components/BatchProgressPanel";
import PhotoBrowserSection from "../src/components/PhotoBrowserSection";
import PhotoImage from "../src/components/PhotoImage";
import PreviewPanel from "../src/components/PreviewPanel";
import SelectionCount from "../src/components/SelectionCount";
import TemplateDocumentPanel from "../src/components/TemplateDocumentPanel";
import ThumbnailCard from "../src/components/ThumbnailCard";
import ThumbnailGrid from "../src/components/ThumbnailGrid";
import LibraryEngine from "../src/core/LibraryEngine";
import ProjectEngine from "../src/core/ProjectEngine";
import SelectionEngine from "../src/core/SelectionEngine";
import TemplateLayerTreeReader from "../src/services/TemplateLayerTreeReader";
import TemplateDocumentReader from "../src/services/TemplateDocumentReader";
import ProjectService from "../src/services/ProjectService";
import AtomicJsonFileWriter from "../src/services/AtomicJsonFileWriter";
import PhotoPlacementEngine from "../src/placement/PhotoPlacementEngine";
import ReplacementBatchExecutor from "../src/placement/ReplacementBatchExecutor";
import BatchExecutionService from "../src/project/BatchExecutionService";
import BatchCancellationController from "../src/project/BatchCancellationController";
import ProjectExecutor from "../src/project/ProjectExecutor";

let count = 0;
async function test(name, callback) {
    await callback();
    count += 1;
    console.info(`PASS ALB-051: ${name}`);
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
        if (this.entries.has(name)) throw new Error(`Entry exists: ${name}`);
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
        if (this.failNextRenameTo === name) {
            this.failNextRenameTo = null;
            throw new Error(`Injected rename failure: ${name}`);
        }
        if (this.entries.has(name) && !overwrite) throw new Error(`Entry exists: ${name}`);
        this.entries.delete(source.name);
        source.name = name;
        source.nativePath = `${this.nativePath}/${name}`;
        this.entries.set(name, source);
    }
}

function rootFolder(name = "Projects") {
    return new MemoryEntry(name, null, { folder: true });
}

function recentProjects() {
    return { items: [], add(folder) { this.items.unshift(folder); }, getAll() { return this.items.slice(); } };
}

function render(element) {
    return ReactDOMServer.renderToStaticMarkup(element);
}

async function run() {
    await test("canonical startup registers one command, plugin lifecycle, and albumai panel", async () => {
        const setup = entrypoints.lastSetup;
        assert(setup);
        assert.deepStrictEqual(Object.keys(setup.commands), ["selectAllPhotos"]);
        assert.deepStrictEqual(Object.keys(setup.panels), ["albumai"]);
        assert.strictEqual(typeof setup.plugin.create, "function");
        assert.strictEqual(typeof setup.plugin.destroy, "function");
    });

    await test("panel controller preserves menu identity and dispatches the selected handler", async () => {
        let invoked = 0;
        const panel = new PanelController(() => React.createElement("div"), {
            id: "test-panel",
            menuItems: [{ id: "reload", label: "Reload", oninvoke: () => { invoked += 1; } }]
        });
        assert.deepStrictEqual(panel.menuItems.map(item => item.id), ["reload"]);
        panel.invokeMenu("missing");
        panel.invokeMenu("reload");
        assert.strictEqual(invoked, 1);
    });

    await test("active UI/component modules render deterministic empty and terminal states", async () => {
        const library = new LibraryEngine();
        const selection = new SelectionEngine(library);
        const emptyBrowser = render(React.createElement(PhotoBrowserSection, {
            photos: [], folderLoaded: false, isLoading: false
        }));
        const preview = render(React.createElement(PreviewPanel, { photos: [], selection }));
        const countMarkup = render(React.createElement(SelectionCount, { selection }));
        const grid = render(React.createElement(ThumbnailGrid, { photos: [] }));
        const image = render(React.createElement(PhotoImage, {
            photo: { id: "p1", name: "one.jpg" }, fallback: "Unavailable"
        }));
        const card = render(React.createElement(ThumbnailCard, {
            photo: { id: "p1", name: "one.jpg", extension: "JPG" }, onClick() {}
        }));
        const templatePanel = render(React.createElement(TemplateDocumentPanel, {}));
        const album = render(React.createElement(AlbumBrowser));
        const progress = render(React.createElement(BatchProgressPanel, {
            summary: {
                status: "COMPLETED",
                totalTemplates: 2,
                completedTemplates: 2,
                successfulTemplates: 2,
                failedTemplates: 0,
                skippedTemplates: 0
            }
        }));
        assert(emptyBrowser.includes("Photo browser"));
        assert(preview.includes("Select a photo"));
        assert.strictEqual(countMarkup, "0");
        assert(grid.includes("data-photo-browser-viewport=\"true\""));
        assert(image.includes("Unavailable"));
        assert(card.includes("one.jpg"));
        assert(templatePanel.length > 0);
        assert(album.includes("Create Project"));
        assert(progress.includes("Project Completed"));
    });

    await test("project create, save, close, and reopen preserve workspace metadata", async () => {
        const parent = rootFolder();
        const engine = new ProjectEngine();
        const service = new ProjectService({ projectEngine: engine, recentProjects: recentProjects() });
        const created = await service.createProject({ name: "Wedding", parentFolder: parent, metadata: { photoCount: 3 } });
        assert.strictEqual(created.metadata.name, "Wedding");
        assert(created.workspace.templates?.isFolder);
        assert(created.workspace.cache.thumbnails?.isFolder);
        await service.saveProject({ photoCount: 4 }, { reason: "ALB_051_TEST" });
        const projectFolder = created.folder;
        service.closeProject();
        assert.strictEqual(engine.getProject(), null);
        const reopened = await service.openProject(projectFolder);
        assert.strictEqual(reopened.metadata.photoCount, 4);
        assert.strictEqual(reopened.metadata.schemaVersion, 1);
    });

    await test("photo selection preserves browser order across select, range, toggle, and retain", async () => {
        const library = new LibraryEngine();
        const photos = ["a", "b", "c", "d"].map(id => ({ id, name: `${id}.jpg` }));
        library.load(photos);
        const selection = new SelectionEngine(library);
        selection.setOrderedPhotos([photos[2], photos[0], photos[1], photos[3]]);
        selection.select(photos[2]);
        selection.range(photos[1]);
        assert.deepStrictEqual(selection.getSelected().map(photo => photo.id), ["a", "b", "c"]);
        selection.toggle(photos[0]);
        assert.deepStrictEqual([...selection.selectedIds()].sort(), ["b", "c"]);
        selection.retainAvailable([photos[1]]);
        assert.deepStrictEqual([...selection.selectedIds()], ["b"]);
    });

    await test("template analysis normalizes layer, smart-object, and text identity", async () => {
        const layers = [
            { id: 10, name: "Group", kind: "group", visible: true, locked: false, bounds: null, children: [] },
            { id: 20, parentId: 10, name: "Slot", kind: "smartObject", visible: true, locked: false, bounds: { left: 0, top: 0, right: 100, bottom: 50 }, children: [] },
            { id: 30, parentId: 10, name: "Caption", kind: "textLayer", visible: true, locked: false, bounds: null, children: [], photoshopLayer: { textItem: { contents: "Hello" } } }
        ];
        const byId = new Map(layers.map(layer => [layer.id, layer]));
        const layerManager = {
            documentId: null,
            scan(document) { this.documentId = document.id; },
            hierarchy: () => [layers[0]],
            smartObjects: () => [layers[1]],
            all: () => layers,
            byId: id => byId.get(id),
            clear() {}
        };
        layers[0].children = [layers[1], layers[2]];
        const reader = new TemplateLayerTreeReader({ layerManager });
        const tree = reader.read({ id: 77 });
        assert.strictEqual(tree[0].children[0].documentId, 77);
        assert.strictEqual(reader.smartObjects()[0].parentGroupName, "Group");
        assert.strictEqual(reader.textLayers()[0].textContent, "Hello");
    });

    await test("invalid, out-of-project, and unreadable PSD inputs fail without retaining documents", async () => {
        const psd = { name: "valid.psd", nativePath: "/Templates/valid.psd", isFile: true };
        const templates = { async getEntries() { return [psd]; } };
        const projectEngine = { getProject: () => ({ workspace: { templates } }) };
        const documents = [];
        let closes = 0;
        const documentManager = {
            get documents() { return documents; },
            async open() { throw new Error("Unreadable PSD"); },
            async activate() {},
            async close(document) { closes += 1; documents.splice(documents.indexOf(document), 1); }
        };
        const reader = new TemplateDocumentReader({ projectEngine, documentManager });
        await assert.rejects(() => reader.read({ name: "bad.txt", isFile: true }), /must be in/);
        await assert.rejects(() => reader.read(psd), /Unreadable PSD/);
        assert.strictEqual(reader.ownedDocument, null);
        assert.strictEqual(documents.length, 0);
        assert.strictEqual(closes, 0);
    });

    await test("placement and replacement retain deterministic order and progress", async () => {
        const project = { metadata: { id: "project-1" } };
        const photos = [
            { id: "p1", name: "portrait.jpg", width: 100, height: 200, aspectRatio: 0.5, orientation: "portrait", selected: true, file: { name: "portrait.jpg" } },
            { id: "p2", name: "landscape.jpg", width: 200, height: 100, aspectRatio: 2, orientation: "landscape", selected: true, file: { name: "landscape.jpg" } }
        ];
        const template = {
            id: "template-1", document: { id: 9 }, layerTree: [],
            smartObjects: [
                { layerId: 1, layerName: "First", bounds: { left: 0, top: 0, right: 100, bottom: 200 } },
                { layerId: 2, layerName: "Second", bounds: { left: 0, top: 0, right: 200, bottom: 100 } }
            ]
        };
        const placement = new PhotoPlacementEngine().plan({ project, photos, template });
        assert.deepStrictEqual(placement.assignments.map(item => item.photoId), ["p1", "p2"]);
        const progress = [];
        const executor = new ReplacementBatchExecutor({
            replacementStepExecutor: { async execute(step) { return { status: "SUCCESS", step }; } }
        });
        const result = await executor.execute({
            id: "request-1", templateId: "template-1",
            steps: placement.assignments.map((item, index) => ({ stepNumber: index + 1, slotLayerId: item.layerId, photoId: item.photoId }))
        }, { photos, onProgress: value => progress.push(value) });
        assert.strictEqual(result.status, "COMPLETED");
        assert.strictEqual(result.completedSteps, 2);
        assert.strictEqual(progress.at(-1).percentComplete, 100);
    });

    await test("duplicate batch execution is rejected and cancellation retains a safe boundary", async () => {
        const service = new BatchExecutionService();
        let release;
        const gate = new Promise(resolve => { release = resolve; });
        const queue = { total: 1, descriptorAt: () => ({ id: "one", name: "One.psd" }) };
        const first = service.execute({ queue, executeTemplate: async () => { await gate; return { status: "COMPLETED" }; } });
        await assert.rejects(
            () => service.execute({ queue, executeTemplate: async () => ({ status: "COMPLETED" }) }),
            /already running/
        );
        release();
        assert.strictEqual((await first).status, "COMPLETED");

        const cancellation = new BatchCancellationController();
        cancellation.requestCancel();
        cancellation.captureProgress(42);
        const cancelled = await service.execute({ queue, cancellationController: cancellation, executeTemplate: async () => ({ status: "COMPLETED" }) });
        assert.strictEqual(cancelled.status, "CANCELLED");
        assert.strictEqual(cancelled.retainedProgressPercent, 42);
    });

    await test("project executor releases a template after terminal failure", async () => {
        let releases = 0;
        const executor = new ProjectExecutor({
            templateRegistry: { register() {}, getAll: () => [] },
            photoPlacementEngine: { plan() { throw new Error("Invalid template"); } },
            placementExecutionPlanBuilder: { build() {} },
            replacementBatchExecutor: { execute() {} }
        });
        const template = { id: "t1", name: "One.psd", document: { id: 1 }, smartObjects: [{ layerId: 1 }] };
        const result = await executor.execute({
            project: { metadata: { id: "project" } },
            photos: [{ id: "p1", selected: true }],
            templates: [template],
            resolveTemplate: async () => template,
            releaseTemplate: async () => { releases += 1; }
        });
        assert.strictEqual(result.status, "FAILED");
        assert.strictEqual(releases, 1);
    });

    await test("atomic JSON swap failure rolls back the last verified project", async () => {
        const folder = rootFolder("Atomic");
        const first = JSON.stringify({ version: 1 });
        const second = JSON.stringify({ version: 2 });
        await AtomicJsonFileWriter.write({ folder, fileName: "project.json", serialized: first, reason: "BASELINE" });
        folder.failNextRenameTo = "project.json";
        await assert.rejects(
            () => AtomicJsonFileWriter.write({ folder, fileName: "project.json", serialized: second, reason: "INJECTED_FAILURE" }),
            /Injected rename failure/
        );
        assert.strictEqual(await (await folder.getEntry("project.json")).read(), first);
        assert.deepStrictEqual(JSON.parse(await (await folder.getEntry("project.json.bak")).read()), { version: 1 });
    });

    console.info(`ALB-051 regression baseline complete: ${count} assertions.`);
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
