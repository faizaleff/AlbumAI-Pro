import { OutputPromotionStrategy, planOutputPromotion } from "./OutputPromotionPolicy";

function toBytes(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    return null;
}

/**
 * Narrow boundary for UXP FileSystemEntry operations. Host entries never leave
 * this adapter in a serialized result; callers use them only within a live
 * transaction.
 */
export default class OutputTransactionFileAdapter {
    constructor({ folder, readBinary = null, provenSafeReplace = false } = {}) {
        if (!folder) throw new Error("An output folder is required.");
        this.folder = folder;
        this.readBinary = typeof readBinary === "function" ? readBinary : null;
        // API presence is not proof of atomic replacement. This can only be
        // enabled by a later explicit, fixture-backed host characterization.
        this.provenSafeReplace = provenSafeReplace === true;
    }

    async listChildren() {
        if (typeof this.folder.getEntries !== "function") return [];
        return this.folder.getEntries();
    }

    async findEntry(name) {
        if (typeof this.folder.getEntry === "function") {
            try {
                return await this.folder.getEntry(name);
            } catch (_) {
                // A successful full listing can confirm absence after a
                // getEntry miss; an inaccessible listing remains unknown.
                return (await this.listChildren()).find(entry => entry?.name === name) || null;
            }
        }
        return (await this.listChildren()).find(entry => entry?.name === name) || null;
    }

    async createFile(name) {
        if (typeof this.folder.createFile !== "function") {
            throw new Error("Output staging is unsupported by this filesystem.");
        }
        return this.folder.createFile(name, { overwrite: false });
    }

    inspectEntry(entry) {
        if (!entry) return Object.freeze({ exists: false, isFile: false, size: null });
        let isFile = false;
        let size = null;
        try { isFile = entry.isFile !== false; } catch (_) {}
        try { size = Number.isFinite(entry.size) ? entry.size : null; } catch (_) {}
        return Object.freeze({ exists: true, isFile, size });
    }

    async readHeader(entry) {
        if (!this.readBinary || !entry) return null;
        const value = await this.readBinary(entry);
        return toBytes(value);
    }

    async deleteEntry(entry) {
        if (!entry || typeof entry.delete !== "function") {
            throw new Error("Output cleanup is unsupported by this filesystem.");
        }
        await entry.delete();
    }

    async promoteEntry(entry, name, { overwrite = false } = {}) {
        if (typeof this.folder.renameEntry === "function") {
            await this.folder.renameEntry(entry, name, { overwrite });
            return;
        }
        if (typeof entry?.moveTo === "function") {
            await entry.moveTo(this.folder, { newName: name, overwrite });
            return;
        }
        throw new Error("Same-folder output promotion is unsupported by this filesystem.");
    }

    capabilityReport(sampleEntry = null) {
        const entry = sampleEntry || null;
        const canRenameSameFolder = typeof this.folder.renameEntry === "function";
        const canMoveSameFolder = typeof entry?.moveTo === "function";
        const canInspectSize = entry != null && "size" in entry;
        const canDelete = typeof entry?.delete === "function";
        const report = Object.freeze({
            canRenameSameFolder,
            canMoveSameFolder,
            canReplaceExisting: this.provenSafeReplace && (canRenameSameFolder || canMoveSameFolder),
            canReadBinary: Boolean(this.readBinary),
            canInspectSize,
            canDelete
        });
        return Object.freeze({
            ...report,
            promotionStrategy: planOutputPromotion({ finalExists: false, capabilities: report }).strategy
        });
    }
}
