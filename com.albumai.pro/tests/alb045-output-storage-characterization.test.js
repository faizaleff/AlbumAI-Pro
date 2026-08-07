import assert from "assert";
import {
    capabilityFolderName,
    characterizeOutputStorage,
    normalizeBinaryReadType,
    recommendedPromotionStrategy
} from "../src/project/OutputStorageCapabilityCharacterization";
import { OutputPromotionStrategy } from "../src/project/OutputPromotionPolicy";

function test(name, callback) { return Promise.resolve().then(callback).then(() => console.info(`PASS ALB-045 Slice 2.5: ${name}`)); }

function fixture({ failDelete = false, renameExistingFails = false } = {}) {
    const folders = new Map();
    const parent = {
        async createFolder(name) {
            const entries = new Map();
            const make = (entryName) => {
                const entry = {
                    name: entryName, isFile: true, content: new Uint8Array().buffer,
                    get size() { return this.content.byteLength; },
                    async write(value) {
                        if (typeof value === "string") this.content = new TextEncoder().encode(value).buffer;
                        else this.content = value instanceof Uint8Array ? value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength) : value;
                    },
                    async delete() { if (failDelete) throw new Error("delete"); entries.delete(this.name); },
                    async moveTo(folder, options) { return folder.renameEntry(this, options.newName, options); }
                };
                entries.set(entryName, entry); return entry;
            };
            const folder = {
                async getEntries() { return [...entries.values()]; },
                async getEntry(entryName) { if (!entries.has(entryName)) throw new Error("missing"); return entries.get(entryName); },
                async createFile(entryName) { if (entries.has(entryName)) throw new Error("exists"); return make(entryName); },
                async renameEntry(entry, entryName) {
                    if (renameExistingFails && entries.has(entryName)) throw new Error("exists");
                    entries.delete(entry.name); entries.delete(entryName); entry.name = entryName; entries.set(entryName, entry);
                },
                async delete() { if (entries.size || failDelete) throw new Error("folder delete"); folders.delete(name); }
            };
            folders.set(name, folder); return folder;
        }
    };
    return { parent, folders };
}

async function run() {
    await test("safe capability folder names and binary type normalization are deterministic", () => {
        assert.strictEqual(capabilityFolderName("a b"), ". _invalid".replace(". _invalid", "._albumai-alb045-capability-a-b"));
        assert.strictEqual(normalizeBinaryReadType(new ArrayBuffer(1)), "ARRAY_BUFFER");
        assert.strictEqual(normalizeBinaryReadType(new Uint8Array(1)), "TYPED_ARRAY");
        assert.strictEqual(normalizeBinaryReadType("text"), "UNKNOWN");
        assert.strictEqual(normalizeBinaryReadType(null), "UNSUPPORTED");
    });

    await test("full disposable characterization returns every safe report field", async () => {
        const fs = fixture();
        const report = await characterizeOutputStorage({ parentFolder: fs.parent, transactionId: "test id", binaryReader: entry => entry.content });
        assert.deepStrictEqual(Object.keys(report).sort(), [
            "binaryReadType", "boundedHeaderReadSupported", "canInspectSize", "canMoveSameFolder", "canReadBinary", "canRenameSameFolder", "canReplaceExistingProven", "cleanupFailed", "cleanupSucceeded", "jpegSoiReadable", "moveDestinationExistsBehavior", "psdSignatureReadable", "recommendedPromotionStrategy", "renameDestinationExistsBehavior", "sizeRefreshReliable", "staleHandleAfterDelete", "staleHandleAfterMove", "staleHandleAfterRename"
        ]);
        assert.strictEqual(report.canRenameSameFolder, true);
        assert.strictEqual(report.canMoveSameFolder, true);
        assert.strictEqual(report.canReadBinary, true);
        assert.strictEqual(report.binaryReadType, "ARRAY_BUFFER");
        assert.strictEqual(report.sizeRefreshReliable, true);
        assert.strictEqual(report.psdSignatureReadable, true);
        assert.strictEqual(report.jpegSoiReadable, true);
        assert.strictEqual(report.canReplaceExistingProven, false);
        assert.strictEqual(report.recommendedPromotionStrategy, OutputPromotionStrategy.PRESERVE_THEN_PROMOTE);
        assert.strictEqual(report.cleanupSucceeded, true);
        assert.strictEqual(JSON.stringify(report).includes("Error"), false);
    });

    await test("destination failures and cleanup failures are safely classified", async () => {
        const fs = fixture({ renameExistingFails: true, failDelete: true });
        const report = await characterizeOutputStorage({ parentFolder: fs.parent, transactionId: "failure" });
        assert.strictEqual(report.renameDestinationExistsBehavior, "FAILED");
        assert.strictEqual(report.moveDestinationExistsBehavior, "FAILED");
        assert.strictEqual(report.cleanupFailed, true);
        assert.strictEqual(report.canReplaceExistingProven, false);
    });

    await test("recommendation fails closed without same-folder promotion", () => {
        assert.strictEqual(recommendedPromotionStrategy({}), OutputPromotionStrategy.RETAIN_STAGING_AND_BLOCK);
        assert.strictEqual(recommendedPromotionStrategy({ canMoveSameFolder: true }), OutputPromotionStrategy.PRESERVE_THEN_PROMOTE);
        assert.strictEqual(recommendedPromotionStrategy({ canReplaceExistingProven: true }), OutputPromotionStrategy.PROMOTE_DIRECT);
    });

    console.info("ALB-045 Slice 2.5 capability characterization tests complete.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
