import assert from "assert";
import OutputTransactionFileAdapter from "../src/project/OutputTransactionFileAdapter";
import { outputBackupName, outputStagingName, createUniqueStaging } from "../src/project/OutputStaging";
import { OutputVerificationFormat, OutputVerificationLevel, verifyOutputEntry } from "../src/project/OutputVerification";
import { OutputPromotionStrategy, planOutputPromotion, runOutputPromotionTransaction } from "../src/project/OutputPromotionPolicy";
import { OutputCancellationState as Cancellation, OutputKind, OutputReasonCode as Reason, OutputTransactionState as State } from "../src/project/OutputTransactionState";

function test(name, callback) {
    return Promise.resolve().then(callback).then(() => console.info(`PASS ALB-045 Slice 2: ${name}`));
}

function bytes(...value) { return new Uint8Array(value).buffer; }

function filesystem({ failCreate = false, failPromote = false, failDelete = false } = {}) {
    const entries = new Map();
    const make = (name, content = bytes()) => {
        const entry = {
            name, isFile: true, content,
            get size() { return this.content.byteLength; },
            async delete() {
                if (failDelete) throw new Error("delete");
                entries.delete(this.name);
            },
            async moveTo(folder, { newName }) { return folder.renameEntry(this, newName); }
        };
        entries.set(name, entry);
        return entry;
    };
    const folder = {
        async getEntries() { return [...entries.values()]; },
        async getEntry(name) {
            const entry = entries.get(name);
            if (!entry) throw new Error("missing");
            return entry;
        },
        async createFile(name) {
            if (failCreate || entries.has(name)) throw new Error("create");
            return make(name);
        },
        async renameEntry(entry, name) {
            if (failPromote === true || (typeof failPromote === "function" && failPromote(entry, name))) throw new Error("rename");
            entries.delete(entry.name);
            entry.name = name;
            entries.set(name, entry);
        }
    };
    return { folder, entries, make };
}

function adapter(fs, options = {}) {
    return new OutputTransactionFileAdapter({
        folder: fs.folder,
        readBinary: entry => entry.content,
        ...options
    });
}

async function run() {
    await test("capability report separates API availability from proven replacement", async () => {
        const fs = filesystem(); const entry = fs.make("final.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const report = adapter(fs).capabilityReport(entry);
        assert.strictEqual(report.canRenameSameFolder, true);
        assert.strictEqual(report.canMoveSameFolder, true);
        assert.strictEqual(report.canReadBinary, true);
        assert.strictEqual(report.canInspectSize, true);
        assert.strictEqual(report.canDelete, true);
        assert.strictEqual(report.canReplaceExisting, false);
    });

    await test("staging names are bounded, hidden, deterministic, and preserve extension", async () => {
        const name = outputStagingName({ finalName: "wedding.final.psd", transactionId: "abc def", attempt: 2 });
        assert.strictEqual(name, "._albumai-stage-abc-def-2.psd");
        assert(outputBackupName({ finalName: "out.jpg", transactionId: "id" }).endsWith(".jpg"));
        assert(outputStagingName({ finalName: `${"x".repeat(500)}.jpeg`, transactionId: "id" }).length <= 180);
    });

    await test("staging collision retries and exhaustion are bounded", async () => {
        const fs = filesystem(); const fileAdapter = adapter(fs);
        fs.make(outputStagingName({ finalName: "out.psd", transactionId: "id", attempt: 1 }));
        const staged = await createUniqueStaging(fileAdapter, { finalName: "out.psd", transactionId: "id", maxAttempts: 2 });
        assert.strictEqual(staged.attempt, 2);
        fs.make(outputStagingName({ finalName: "out.psd", transactionId: "id", attempt: 2 }));
        const exhausted = await createUniqueStaging(fileAdapter, { finalName: "out.psd", transactionId: "id", maxAttempts: 2 });
        assert.strictEqual(exhausted.exhausted, true);
    });

    await test("PSD verification supports exists-only, size, and header levels", async () => {
        const fs = filesystem(); const entry = fs.make("out.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const existsOnly = await verifyOutputEntry({ inspectEntry: () => ({ exists: true, isFile: true, size: null }) }, entry, { format: OutputVerificationFormat.PSD });
        const size = await verifyOutputEntry({ inspectEntry: () => ({ exists: true, isFile: true, size: 4 }) }, entry, { format: OutputVerificationFormat.PSD });
        const header = await verifyOutputEntry(adapter(fs), entry, { format: OutputVerificationFormat.PSD });
        assert.strictEqual(existsOnly.level, OutputVerificationLevel.EXISTS_ONLY);
        assert.strictEqual(size.level, OutputVerificationLevel.SIZE_VERIFIED);
        assert.strictEqual(header.level, OutputVerificationLevel.HEADER_VERIFIED);
    });

    await test("JPEG verification recognizes SOI and fails missing/empty safely", async () => {
        const fs = filesystem(); const entry = fs.make("out.jpg", bytes(0xff, 0xd8, 0x00));
        const header = await verifyOutputEntry(adapter(fs), entry, { format: OutputVerificationFormat.JPEG });
        const missing = await verifyOutputEntry(adapter(fs), null, { format: OutputVerificationFormat.JPEG });
        fs.make("empty.jpg", bytes());
        const empty = await verifyOutputEntry(adapter(fs), await adapter(fs).findEntry("empty.jpg"), { format: OutputVerificationFormat.JPEG });
        assert.strictEqual(header.level, OutputVerificationLevel.HEADER_VERIFIED);
        assert.strictEqual(missing.reasonCode, Reason.STAGING_MISSING);
        assert.strictEqual(empty.reasonCode, Reason.STAGING_EMPTY);
    });

    await test("promotion planning selects direct, backup, or fail-closed strategies", async () => {
        assert.strictEqual(planOutputPromotion({ finalExists: false, capabilities: { canRenameSameFolder: true } }).strategy, OutputPromotionStrategy.PROMOTE_DIRECT);
        assert.strictEqual(planOutputPromotion({ finalExists: true, capabilities: { canRenameSameFolder: true } }).strategy, OutputPromotionStrategy.PRESERVE_THEN_PROMOTE);
        assert.strictEqual(planOutputPromotion({ finalExists: true, capabilities: { canRenameSameFolder: true, canReplaceExisting: true } }).strategy, OutputPromotionStrategy.PROMOTE_DIRECT);
        assert.strictEqual(planOutputPromotion({ finalExists: true, capabilities: {} }).strategy, OutputPromotionStrategy.RETAIN_STAGING_AND_BLOCK);
    });

    await test("an inaccessible final lookup is never treated as absent", async () => {
        const fs = filesystem();
        let listings = 0;
        fs.folder.getEntries = async () => {
            listings += 1;
            if (listings > 1) throw new Error("access");
            return [...fs.entries.values()];
        };
        const result = await runOutputPromotionTransaction({ adapter: adapter(fs), finalName: "final.psd", transactionId: "lookup", writeStaging: () => {}, verify: async () => ({ valid: true }) });
        assert.strictEqual(result.commitState, State.COMMIT_UNKNOWN);
    });

    const psdVerify = (fileAdapter, entry) => verifyOutputEntry(fileAdapter, entry, { format: OutputVerificationFormat.PSD });
    const writePsd = entry => { entry.content = bytes(0x38, 0x42, 0x50, 0x53, 0x01); };

    await test("no-existing-final promotes verified staging directly", async () => {
        const fs = filesystem(); const result = await runOutputPromotionTransaction({ adapter: adapter(fs), finalName: "final.psd", displayName: "final.psd", outputKind: OutputKind.AUTO_SAVE_PSD_COPY, transactionId: "one", writeStaging: writePsd, verify: psdVerify });
        assert.strictEqual(result.commitState, State.COMMITTED);
        assert(fs.entries.has("final.psd"));
        assert.strictEqual([...fs.entries.keys()].some(name => name.startsWith("._albumai")), false);
    });

    await test("backup-first promotion replaces an existing final only after preservation", async () => {
        const fs = filesystem(); fs.make("final.psd", bytes(0x38, 0x42, 0x50, 0x53, 0x09));
        const result = await runOutputPromotionTransaction({ adapter: adapter(fs), finalName: "final.psd", displayName: "final.psd", outputKind: OutputKind.AUTO_SAVE_PSD_COPY, transactionId: "two", writeStaging: writePsd, verify: psdVerify });
        assert.strictEqual(result.commitState, State.COMMITTED);
        assert.strictEqual(fs.entries.get("final.psd").content.byteLength, 5);
        assert.strictEqual([...fs.entries.keys()].some(name => name.startsWith("._albumai-backup")), false);
    });

    await test("host/promotion failure preserves prior final and cleans staging", async () => {
        const hostFs = filesystem(); hostFs.make("final.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const host = await runOutputPromotionTransaction({ adapter: adapter(hostFs), finalName: "final.psd", transactionId: "host", writeStaging: () => { throw new Error("host"); }, verify: psdVerify });
        assert.strictEqual(host.reasonCode, Reason.HOST_WRITE_FAILED);
        assert(hostFs.entries.has("final.psd"));
        const promotionFs = filesystem({ failPromote: (entry, name) => entry.name.startsWith("._albumai-stage") && name === "final.psd" });
        promotionFs.make("final.psd", bytes(0x38, 0x42, 0x50, 0x53));
        const promotion = await runOutputPromotionTransaction({ adapter: adapter(promotionFs), finalName: "final.psd", transactionId: "promotion", writeStaging: writePsd, verify: psdVerify });
        assert.strictEqual(promotion.reasonCode, Reason.PROMOTION_FAILED);
        assert(promotionFs.entries.has("final.psd"));
    });

    await test("cleanup failure, final verification failure, rollback failure, and unsupported promotion fail safely", async () => {
        const cleanupFs = filesystem({ failDelete: true });
        const cleanup = await runOutputPromotionTransaction({ adapter: adapter(cleanupFs), finalName: "final.psd", transactionId: "cleanup", writeStaging: () => { throw new Error("host"); }, verify: psdVerify });
        assert.strictEqual(cleanup.commitState, State.CLEANUP_FAILED);
        const verifyFs = filesystem(); verifyFs.make("final.psd", bytes(0x38, 0x42, 0x50, 0x53)); let calls = 0;
        const failedFinal = await runOutputPromotionTransaction({ adapter: adapter(verifyFs), finalName: "final.psd", transactionId: "verify", writeStaging: writePsd, verify: async (a, e) => (++calls > 1 ? { valid: false } : psdVerify(a, e)) });
        assert.strictEqual(failedFinal.commitState, State.COMMIT_UNKNOWN);
        const rollbackFs = filesystem({ failPromote: (entry, name) => entry.name.startsWith("._albumai-backup") && name === "final.psd" });
        rollbackFs.make("final.psd", bytes(0x38, 0x42, 0x50, 0x53)); let rollbackCalls = 0;
        const rollback = await runOutputPromotionTransaction({ adapter: adapter(rollbackFs), finalName: "final.psd", transactionId: "rollback", writeStaging: writePsd, verify: async (a, e) => (++rollbackCalls > 1 ? { valid: false } : psdVerify(a, e)) });
        assert.strictEqual(rollback.commitState, State.COMMIT_UNKNOWN);
        const noPromotion = { findEntry: async () => null, createFile: async () => ({ name: "stage", isFile: true, size: 4 }), inspectEntry: () => ({ exists: true, isFile: true, size: 4 }), capabilityReport: () => ({}) };
        const blocked = await runOutputPromotionTransaction({ adapter: noPromotion, finalName: "final.psd", transactionId: "blocked", verify: async () => ({ valid: true }) });
        assert.strictEqual(blocked.commitState, State.COMMIT_UNKNOWN);
    });

    await test("cancellation after host write cleans staging before verification", async () => {
        const fsState = filesystem();
        let cancel = false;
        let verificationCalls = 0;

        const result = await runOutputPromotionTransaction({
            adapter: adapter(fsState),
            finalName: "final.psd",
            transactionId: "cancel-after-host-write",
            writeStaging: entry => {
                writePsd(entry);
                cancel = true;
            },
            verify: async (...args) => {
                verificationCalls += 1;
                return psdVerify(...args);
            },
            isCancellationRequested: () => cancel
        });

        assert.strictEqual(result.commitState, State.CLEANED);
        assert.strictEqual(result.cancellationState, Cancellation.EFFECTIVE_AFTER_CLEANUP);
        assert.strictEqual(result.reasonCode, Reason.CANCELLED_BEFORE_WRITE);
        assert.strictEqual(verificationCalls, 0);
        assert.strictEqual(fsState.entries.has("final.psd"), false);
        assert.strictEqual([...fsState.entries.keys()].some(name => name.startsWith("._albumai")), false);
    });

    await test("cancellation after verification cleans staging before promotion", async () => {
        const fsState = filesystem();
        let cancel = false;
        let verificationCalls = 0;

        const result = await runOutputPromotionTransaction({
            adapter: adapter(fsState),
            finalName: "final.psd",
            transactionId: "cancel-after-verification",
            writeStaging: writePsd,
            verify: async (...args) => {
                verificationCalls += 1;
                const verified = await psdVerify(...args);
                cancel = true;
                return verified;
            },
            isCancellationRequested: () => cancel
        });

        assert.strictEqual(result.commitState, State.CLEANED);
        assert.strictEqual(
            result.cancellationState,
            Cancellation.EFFECTIVE_AFTER_CLEANUP
        );
        assert.strictEqual(result.reasonCode, Reason.CANCELLED_BEFORE_WRITE);
        assert.strictEqual(verificationCalls, 1);
        assert.strictEqual(fsState.entries.has("final.psd"), false);
        assert.strictEqual(
            [...fsState.entries.keys()].some(name =>
                name.startsWith("._albumai")
            ),
            false
        );
    });

    console.info("ALB-045 Slice 2 filesystem tests complete.");
}

run().catch(error => { console.error(error); process.exitCode = 1; });
