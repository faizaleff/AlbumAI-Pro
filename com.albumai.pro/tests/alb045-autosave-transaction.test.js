import assert from "assert";
import TemplateAutoSaveService, { AutoSaveMode } from "../src/services/TemplateAutoSaveService";
import AutoSaveResult, { AutoSaveStatus } from "../src/services/AutoSaveResult";
import OutputTransactionFileAdapter from "../src/project/OutputTransactionFileAdapter";
import { OutputTransactionState as State } from "../src/project/OutputTransactionState";

function test(name, callback) { return Promise.resolve().then(callback).then(() => console.info(`PASS ALB-045 Slice 3: ${name}`)); }
function bytes(...value) { return new Uint8Array(value).buffer; }

function outputFs(options = {}) {
    const entries = new Map();
    const renameCalls = [];
    const make = (name, content = bytes()) => {
        const entry = { name, isFile: true, content,
            get size() { return this.content.byteLength; },
            async delete() {
                if (options.failDelete === true ||
                    (typeof options.failDelete === "function" && options.failDelete(this))) {
                    throw new Error("delete");
                }
                entries.delete(this.name);
            },
            async moveTo(folder, value) { return folder.renameEntry(this, value.newName, value); }
        };
        entries.set(name, entry); return entry;
    };
    const processed = {
        isFolder: true, name: "Processed",
        async getEntries() { return [...entries.values()]; },
        async getEntry(name) { if (!entries.has(name)) throw new Error("missing"); return entries.get(name); },
        async createFile(name) { if (entries.has(name) || options.failCreate) throw new Error("create"); return make(name); },
        async renameEntry(entry, name, renameOptions = {}) {
            renameCalls.push({ from: entry.name, to: name, overwrite: renameOptions.overwrite });
            if (options.failRename && options.failRename(entry, name)) throw new Error("rename");
            entries.delete(entry.name); entries.delete(name); entry.name = name; entries.set(name, entry);
        }
    };
    const output = { isFolder: true, async getEntries() { return [processed]; } };
    return { output, processed, entries, make, renameCalls };
}

function setup(options = {}) {
    const fs = outputFs(options);
    const document = { id: 7, title: "Template.psd" };
    const saves = [];
    const controller = options.controller || { isCancellationRequested: () => false };
    const manager = {
        activeId: 7,
        byId: id => id === 7 ? document : null,
        async activate() {},
        async save(target, entry = null) {
            saves.push(entry?.name || "OVERWRITE");
            if (options.hostFailure) throw new Error("host");
            if (entry) {
                entry.content = options.invalidPsd ? bytes(0, 1) : bytes(0x38, 0x42, 0x50, 0x53, 1);
                options.afterHostSave?.();
            }
        }
    };
    const service = new TemplateAutoSaveService({
        documentManager: manager,
        fileAdapterFactory: ({ folder }) => new OutputTransactionFileAdapter({ folder, readBinary: entry => entry.content }),
        afterOverwriteOriginalHostCommit: options.afterOverwriteOriginalHostCommit || null,
        transactionId: () => "test"
    });
    const request = {
        project: { workspace: { output: fs.output } },
        template: { id: "template", document, name: "Template.psd", filePath: "/private/template.psd" },
        descriptor: { name: "Final Album.psd" },
        documentContext: { documentId: 7 },
        executionSummary: { status: "COMPLETED", completedSteps: 1, failedSteps: 0 },
        enabled: true,
        mode: options.mode || AutoSaveMode.SAVE_COPY,
        cancellationController: controller
    };
    return { fs, saves, service, request };
}

async function run() {
    await test("Save Copy writes Photoshop only to staging then commits a PSD", async () => {
        const state = setup(); const result = await state.service.save(state.request);
        assert.strictEqual(result.status, AutoSaveStatus.SAVED);
        assert.strictEqual(result.outputPath, "Final Album.psd");
        assert.strictEqual(result.outputTransaction.commitState, State.COMMITTED);
        assert(state.saves[0].startsWith("._albumai-stage-"));
        assert.strictEqual(state.saves.includes("Final Album.psd"), false);
        assert(state.fs.entries.has("Final Album.psd"));
        assert.strictEqual(state.fs.renameCalls.some(call => call.to === "Final Album.psd" && call.overwrite === true), false);
    });

    await test("Save Copy preserves an existing final through backup-first promotion", async () => {
        const state = setup(); state.fs.make("Final Album.psd", bytes(0x38, 0x42, 0x50, 0x53, 9));
        const result = await state.service.save(state.request);
        assert.strictEqual(result.status, AutoSaveStatus.SAVED);
        assert.strictEqual(result.outputTransaction.commitState, State.COMMITTED);
        assert.strictEqual([...state.fs.entries.keys()].some(name => name.startsWith("._albumai-backup")), false);
    });

    await test("host failure, staging verification failure, and preservation failure never save to final", async () => {
        const host = setup({ hostFailure: true }); const hostResult = await host.service.save(host.request);
        assert.strictEqual(hostResult.status, AutoSaveStatus.FAILED);
        assert.strictEqual(hostResult.outputTransaction.commitState, State.CLEANED);
        const invalid = setup({ invalidPsd: true }); const invalidResult = await invalid.service.save(invalid.request);
        assert.strictEqual(invalidResult.status, AutoSaveStatus.FAILED);
        assert.strictEqual(invalidResult.outputTransaction.commitState, State.CLEANED);
        const preserve = setup({ failRename: (entry, name) => entry.name === "Final Album.psd" && name.startsWith("._albumai-backup") });
        preserve.fs.make("Final Album.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const preserveResult = await preserve.service.save(preserve.request);
        assert.strictEqual(preserveResult.status, AutoSaveStatus.FAILED);
        assert(preserve.fs.entries.has("Final Album.psd"));
    });

    await test("promotion rollback, final verification rollback, cleanup failure, and commit uncertainty retain structured state", async () => {
        const rollback = setup({ failRename: (entry, name) => entry.name.startsWith("._albumai-stage") && name === "Final Album.psd" });
        rollback.fs.make("Final Album.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const rollbackResult = await rollback.service.save(rollback.request);
        assert.strictEqual(rollbackResult.outputTransaction.commitState, State.CLEANED);
        assert(rollback.fs.entries.has("Final Album.psd"));
        const rollbackUnknown = setup({ failRename: (entry, name) => name === "Final Album.psd" && (entry.name.startsWith("._albumai-stage") || entry.name.startsWith("._albumai-backup")) });
        rollbackUnknown.fs.make("Final Album.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const rollbackUnknownResult = await rollbackUnknown.service.save(rollbackUnknown.request);
        assert.strictEqual(rollbackUnknownResult.outputTransaction.commitState, State.COMMIT_UNKNOWN);
        const finalVerification = setup(); finalVerification.fs.make("Final Album.psd", bytes(0x38, 0x42, 0x50, 0x53));
        let reads = 0;
        finalVerification.service.fileAdapterFactory = ({ folder }) => new OutputTransactionFileAdapter({
            folder,
            readBinary: entry => (++reads === 2 ? bytes(0, 1) : entry.content)
        });
        const finalVerificationResult = await finalVerification.service.save(finalVerification.request);
        assert.strictEqual(finalVerificationResult.outputTransaction.commitState, State.CLEANED);
        const cleanup = setup({ hostFailure: true, failDelete: true }); const cleanupResult = await cleanup.service.save(cleanup.request);
        assert.strictEqual(cleanupResult.outputTransaction.commitState, State.CLEANUP_FAILED);
        const backupCleanup = setup({ failDelete: entry => entry.name.startsWith("._albumai-backup") });
        backupCleanup.fs.make("Final Album.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const backupCleanupResult = await backupCleanup.service.save(backupCleanup.request);
        assert.strictEqual(backupCleanupResult.outputTransaction.commitState, State.COMMITTED);
        assert.strictEqual(backupCleanupResult.outputTransaction.remediationRequired, true);
    });

    await test("cancellation is effective before staging, after staging cleanup, during save, and after commit", async () => {
        const before = setup({ controller: { isCancellationRequested: () => true } });
        const beforeResult = await before.service.save(before.request);
        assert.strictEqual(beforeResult.status, AutoSaveStatus.SKIPPED);
        assert.strictEqual(before.saves.length, 0);
        let checks = 0;
        const afterStaging = setup({ controller: { isCancellationRequested: () => (++checks >= 2) } });
        const afterStagingResult = await afterStaging.service.save(afterStaging.request);
        assert.strictEqual(afterStagingResult.outputTransaction.commitState, State.CLEANED);
        assert.strictEqual(afterStaging.saves.length, 0);
        let during = false;
        const duringSave = setup({ controller: { isCancellationRequested: () => during }, afterHostSave: () => { during = true; } });
        const duringResult = await duringSave.service.save(duringSave.request);
        assert.strictEqual(duringResult.status, AutoSaveStatus.SKIPPED);
        assert.strictEqual(duringResult.outputTransaction.commitState, State.CLEANED);
        assert.strictEqual(duringResult.outputTransaction.cancellationState, "EFFECTIVE_AFTER_CLEANUP");
    });

    await test("OVERWRITE_ORIGINAL remains direct, committed, and non-transactional", async () => {
        const state = setup({ mode: AutoSaveMode.OVERWRITE_ORIGINAL }); const result = await state.service.save(state.request);
        assert.strictEqual(result.status, AutoSaveStatus.SAVED);
        assert.deepStrictEqual(state.saves, ["OVERWRITE"]);
        assert.strictEqual(result.outputTransaction.overwriteOriginal, true);
        assert.strictEqual(result.outputTransaction.reasonCode, "OVERWRITE_ORIGINAL_COMMITTED");
    });

    await test("OVERWRITE_ORIGINAL post-commit gate observes cancellation without weakening commit", async () => {
        let cancelled = false;
        let hookCalls = 0;
        const state = setup({
            mode: AutoSaveMode.OVERWRITE_ORIGINAL,
            controller: { isCancellationRequested: () => cancelled },
            afterOverwriteOriginalHostCommit: async ({ isCancellationRequested }) => {
                hookCalls += 1;
                assert.strictEqual(isCancellationRequested(), false);
                cancelled = true;
            }
        });
        const result = await state.service.save(state.request);
        assert.deepStrictEqual(state.saves, ["OVERWRITE"]);
        assert.strictEqual(hookCalls, 1);
        assert.strictEqual(result.status, AutoSaveStatus.SAVED);
        assert.strictEqual(result.outputTransaction.commitState, State.COMMITTED);
        assert.strictEqual(result.outputTransaction.cancellationState, "EFFECTIVE_AFTER_COMMIT");
        assert.strictEqual(result.outputTransaction.reasonCode, "OVERWRITE_ORIGINAL_COMMITTED");
        assert.strictEqual(result.outputTransaction.retryDisposition, "SKIP_DEFAULT");
    });

    await test("OVERWRITE_ORIGINAL pre-write cancellation never enters the runtime gate", async () => {
        let hookCalls = 0;
        const state = setup({
            mode: AutoSaveMode.OVERWRITE_ORIGINAL,
            controller: { isCancellationRequested: () => true },
            afterOverwriteOriginalHostCommit: async () => { hookCalls += 1; }
        });
        const result = await state.service.save(state.request);
        assert.deepStrictEqual(state.saves, []);
        assert.strictEqual(hookCalls, 0);
        assert.strictEqual(result.outputTransaction.commitState, State.NOT_STARTED);
        assert.strictEqual(result.outputTransaction.reasonCode, "CANCELLED_BEFORE_WRITE");
    });

    await test("OVERWRITE_ORIGINAL diagnostic gate failure cannot hide a committed host save", async () => {
        const state = setup({
            mode: AutoSaveMode.OVERWRITE_ORIGINAL,
            afterOverwriteOriginalHostCommit: async () => { throw new Error("diagnostic failure"); }
        });
        const result = await state.service.save(state.request);
        assert.deepStrictEqual(state.saves, ["OVERWRITE"]);
        assert.strictEqual(result.status, AutoSaveStatus.SAVED);
        assert.strictEqual(result.outputTransaction.commitState, State.COMMITTED);
        assert.strictEqual(result.outputTransaction.cancellationState, "NONE");
    });

    await test("legacy AutoSaveResult fields remain available with a safe transaction fragment", () => {
        const result = new AutoSaveResult({ status: AutoSaveStatus.SAVED, outputPath: "final.psd", outputTransaction: { commitState: "COMMITTED" } });
        assert.strictEqual(result.status, AutoSaveStatus.SAVED);
        assert.strictEqual(result.outputPath, "final.psd");
        assert.strictEqual(result.outputTransaction.commitState, "COMMITTED");
        assert.strictEqual(JSON.stringify(result.outputTransaction).includes("nativePath"), false);
    });
    console.info("ALB-045 Slice 3 transactional Auto Save tests complete.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
