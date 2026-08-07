import assert from "assert";
import TemplateExportService, { ExportFormat } from "../src/services/TemplateExportService";
import { AutoSaveStatus } from "../src/services/AutoSaveResult";
import { ExportStatus } from "../src/services/ExportResult";
import OutputTransactionFileAdapter from "../src/project/OutputTransactionFileAdapter";
import { OutputTransactionState as State } from "../src/project/OutputTransactionState";

function test(name, callback) { return Promise.resolve().then(callback).then(() => console.info(`PASS ALB-045 Slice 4: ${name}`)); }
function bytes(...value) { return new Uint8Array(value).buffer; }
function fixture(options = {}) {
    const entries = new Map(); const calls = [];
    const make = (name, content = bytes()) => {
        const entry = { name, isFile: true, content, get size() { return this.content.byteLength; },
            async delete() { if (options.failDelete) throw new Error("delete"); entries.delete(this.name); },
            async moveTo(folder, value) { return folder.renameEntry(this, value.newName, value); } };
        entries.set(name, entry); return entry;
    };
    const exportFolder = { name: "Export", isFolder: true,
        async getEntries() { return [...entries.values()]; },
        async getEntry(name) { if (!entries.has(name)) throw new Error("missing"); return entries.get(name); },
        async createFile(name) { if (entries.has(name)) throw new Error("exists"); return make(name); },
        async renameEntry(entry, name, value = {}) {
            calls.push({ from: entry.name, to: name, overwrite: value.overwrite });
            if (options.failRename?.(entry, name)) throw new Error("rename");
            entries.delete(entry.name); entries.delete(name); entry.name = name; entries.set(name, entry);
        }
    };
    const output = { isFolder: true, async getEntries() { return [exportFolder]; } };
    const document = { id: 8, title: "Template.psd" };
    let cancelled = false;
    const manager = {
        activeId: 8, byId: id => id === 8 ? document : null, async activate() {},
        async save(_, entry) { calls.push({ host: "PSD", name: entry?.name }); if (options.hostFailure) throw new Error("host"); entry.content = bytes(0x38, 0x42, 0x50, 0x53); options.afterHost?.(() => { cancelled = true; }); },
        async exportJPEG(_, entry) { calls.push({ host: "JPEG", name: entry?.name }); if (options.hostFailure) throw new Error("host"); entry.content = options.invalid ? bytes(0, 1) : bytes(0xff, 0xd8, 0x00); options.afterHost?.(() => { cancelled = true; }); }
    };
    const service = new TemplateExportService({ documentManager: manager, transactionId: () => "export-test", fileAdapterFactory: ({ folder }) => new OutputTransactionFileAdapter({ folder, readBinary: entry => entry.content }) });
    const request = {
        project: { workspace: { output } }, template: { id: "template", document, name: "Template.psd", filePath: "/private/template.psd" }, descriptor: { name: "Export Name.psd" }, documentContext: { documentId: 8 }, autoSaveResult: { status: AutoSaveStatus.SAVED }, enabled: true,
        cancellationController: { isCancellationRequested: () => cancelled }
    };
    return { entries, calls, make, service, request, setCancelled: value => { cancelled = value; } };
}

async function run() {
    await test("PSD and JPEG host writes target staging only and commit verified finals", async () => {
        const psd = fixture(); const psdResult = await psd.service.export({ ...psd.request, format: ExportFormat.PSD });
        assert.strictEqual(psdResult.status, ExportStatus.SUCCESS); assert.strictEqual(psdResult.outputPath, "Export Name.psd");
        assert(psd.calls.find(call => call.host === "PSD").name.startsWith("._albumai-stage-"));
        assert.strictEqual(psd.calls.some(call => call.to === "Export Name.psd" && call.overwrite === true), false);
        const jpeg = fixture(); const jpegResult = await jpeg.service.export({ ...jpeg.request, format: ExportFormat.JPEG });
        assert.strictEqual(jpegResult.status, ExportStatus.SUCCESS); assert.strictEqual(jpegResult.outputPath, "Export Name.jpg");
        assert(jpeg.calls.find(call => call.host === "JPEG").name.startsWith("._albumai-stage-"));
    });

    await test("existing finals use backup-first promotion for PSD and JPEG", async () => {
        const psd = fixture(); psd.make("Export Name.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const psdResult = await psd.service.export({ ...psd.request, format: ExportFormat.PSD });
        assert.strictEqual(psdResult.outputTransaction.commitState, State.COMMITTED);
        assert.strictEqual([...psd.entries.keys()].some(name => name.startsWith("._albumai-backup")), false);
        const jpeg = fixture(); jpeg.make("Export Name.jpg", bytes(0xff, 0xd8));
        const jpegResult = await jpeg.service.export({ ...jpeg.request, format: ExportFormat.JPEG });
        assert.strictEqual(jpegResult.outputTransaction.commitState, State.COMMITTED);
    });

    await test("host/verification/promotion failures preserve safe transaction state", async () => {
        const host = fixture({ hostFailure: true }); const hostResult = await host.service.export({ ...host.request, format: ExportFormat.JPEG });
        assert.strictEqual(hostResult.status, ExportStatus.FAILED); assert.strictEqual(hostResult.outputTransaction.commitState, State.CLEANED);
        const invalid = fixture({ invalid: true }); const invalidResult = await invalid.service.export({ ...invalid.request, format: ExportFormat.JPEG });
        assert.strictEqual(invalidResult.outputTransaction.commitState, State.CLEANED);
        const rollback = fixture({ failRename: (entry, name) => entry.name.startsWith("._albumai-stage") && name === "Export Name.psd" });
        rollback.make("Export Name.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const rollbackResult = await rollback.service.export({ ...rollback.request, format: ExportFormat.PSD });
        assert.strictEqual(rollbackResult.outputTransaction.commitState, State.CLEANED);
        assert(rollback.entries.has("Export Name.psd"));
    });

    await test("cancellation is safe before staging, after staging, and after commit", async () => {
        const before = fixture(); before.setCancelled(true);
        const beforeResult = await before.service.export({ ...before.request, format: ExportFormat.JPEG });
        assert.strictEqual(beforeResult.status, ExportStatus.SKIPPED); assert.strictEqual(before.calls.some(call => call.host), false);
        let checks = 0; const afterStaging = fixture(); afterStaging.request.cancellationController = { isCancellationRequested: () => (++checks >= 2) };
        const afterStagingResult = await afterStaging.service.export({ ...afterStaging.request, format: ExportFormat.JPEG });
        assert.strictEqual(afterStagingResult.outputTransaction.commitState, State.CLEANED);
        const afterCommit = fixture({ afterHost: callback => callback() });
        const afterCommitResult = await afterCommit.service.export({ ...afterCommit.request, format: ExportFormat.JPEG });
        assert.strictEqual(afterCommitResult.status, ExportStatus.SUCCESS);
        assert.strictEqual(afterCommitResult.outputTransaction.cancellationState, "EFFECTIVE_AFTER_COMMIT");
    });
    console.info("ALB-045 Slice 4 transactional export tests complete.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
