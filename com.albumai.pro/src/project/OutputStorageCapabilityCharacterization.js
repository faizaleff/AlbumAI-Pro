import OutputTransactionFileAdapter from "./OutputTransactionFileAdapter";
import { OutputPromotionStrategy } from "./OutputPromotionPolicy";

const DESTINATION_BEHAVIOR = Object.freeze({
    NOT_SUPPORTED: "NOT_SUPPORTED", FAILED: "FAILED", REPLACED: "REPLACED", AMBIGUOUS: "AMBIGUOUS"
});
const HANDLE_BEHAVIOR = Object.freeze({
    SAME_AS_LOOKUP: "SAME_AS_LOOKUP", DIFFERENT_OBJECT: "DIFFERENT_OBJECT", UNREADABLE: "UNREADABLE", NOT_SUPPORTED: "NOT_SUPPORTED"
});

function safeId(value) {
    return String(value || `capability-${Date.now()}`)
        .replace(/[^A-Za-z0-9-]/g, "-").slice(0, 48) || "capability";
}

export function capabilityFolderName(id) {
    return `._albumai-alb045-capability-${safeId(id)}`;
}

export function normalizeBinaryReadType(value) {
    if (value instanceof ArrayBuffer) return "ARRAY_BUFFER";
    if (ArrayBuffer.isView(value)) return "TYPED_ARRAY";
    return value == null ? "UNSUPPORTED" : "UNKNOWN";
}

export function recommendedPromotionStrategy(report = {}) {
    if (report.canReplaceExistingProven) return OutputPromotionStrategy.PROMOTE_DIRECT;
    if (report.canRenameSameFolder || report.canMoveSameFolder) {
        return OutputPromotionStrategy.PRESERVE_THEN_PROMOTE;
    }
    return OutputPromotionStrategy.RETAIN_STAGING_AND_BLOCK;
}

function emptyReport() {
    return {
        canRenameSameFolder: false,
        canMoveSameFolder: false,
        renameDestinationExistsBehavior: DESTINATION_BEHAVIOR.NOT_SUPPORTED,
        moveDestinationExistsBehavior: DESTINATION_BEHAVIOR.NOT_SUPPORTED,
        staleHandleAfterRename: HANDLE_BEHAVIOR.NOT_SUPPORTED,
        staleHandleAfterMove: HANDLE_BEHAVIOR.NOT_SUPPORTED,
        staleHandleAfterDelete: HANDLE_BEHAVIOR.NOT_SUPPORTED,
        canInspectSize: false,
        sizeRefreshReliable: false,
        canReadBinary: false,
        binaryReadType: "UNSUPPORTED",
        boundedHeaderReadSupported: false,
        psdSignatureReadable: false,
        jpegSoiReadable: false,
        canReplaceExistingProven: false,
        cleanupSucceeded: false,
        cleanupFailed: false
    };
}

async function handleBehavior(adapter, handle, name) {
    try {
        const resolved = await adapter.findEntry(name);
        if (!resolved) return HANDLE_BEHAVIOR.UNREADABLE;
        return resolved === handle ? HANDLE_BEHAVIOR.SAME_AS_LOOKUP : HANDLE_BEHAVIOR.DIFFERENT_OBJECT;
    } catch (_) { return HANDLE_BEHAVIOR.UNREADABLE; }
}

async function destinationBehavior(adapter, source, destinationName) {
    try {
        await adapter.promoteEntry(source, destinationName, { overwrite: true });
        return DESTINATION_BEHAVIOR.REPLACED;
    } catch (_) { return DESTINATION_BEHAVIOR.FAILED; }
}

async function deleteBehavior(adapter, entry, name) {
    try {
        await adapter.deleteEntry(entry);
        return await handleBehavior(adapter, entry, name);
    } catch (_) { return HANDLE_BEHAVIOR.UNREADABLE; }
}

async function cleanupFolder(folder) {
    let failed = false;
    try {
        const entries = typeof folder.getEntries === "function" ? await folder.getEntries() : [];
        for (const entry of entries) {
            if (typeof entry?.delete !== "function") { failed = true; continue; }
            try { await entry.delete(); } catch (_) { failed = true; }
        }
        if (!failed && typeof folder.delete === "function") await folder.delete();
        else if (typeof folder.delete !== "function") failed = true;
    } catch (_) { failed = true; }
    return !failed;
}

/**
 * Runs only against a newly-created AlbumAI-owned disposable folder supplied
 * by an explicit developer action. It does not inspect project output folders.
 */
export async function characterizeOutputStorage({
    parentFolder,
    transactionId,
    binaryReader = null,
    boundedHeaderReadSupported = false
} = {}) {
    const report = emptyReport();
    if (!parentFolder || typeof parentFolder.createFolder !== "function") {
        return Object.freeze({ ...report, recommendedPromotionStrategy: recommendedPromotionStrategy(report) });
    }
    let folder = null;
    try {
        folder = await parentFolder.createFolder(capabilityFolderName(transactionId));
        const adapter = new OutputTransactionFileAdapter({ folder, readBinary: binaryReader });
        const renameSource = await adapter.createFile("rename-source.txt");
        await renameSource.write?.("rename-source");
        const beforeRename = await adapter.findEntry("rename-source.txt");
        if (beforeRename) {
            try {
                await adapter.promoteEntry(renameSource, "rename-target.txt", { overwrite: false });
                report.canRenameSameFolder = typeof folder.renameEntry === "function";
                report.staleHandleAfterRename = await handleBehavior(adapter, renameSource, "rename-target.txt");
            } catch (_) { report.staleHandleAfterRename = HANDLE_BEHAVIOR.UNREADABLE; }
        }

        const moveSource = await adapter.createFile("move-source.txt");
        await moveSource.write?.("move-source");
        if (typeof moveSource.moveTo === "function") {
            try {
                // Bypass renameEntry when possible so the operation itself is characterized.
                await moveSource.moveTo(folder, { newName: "move-target.txt", overwrite: false });
                report.canMoveSameFolder = true;
                report.staleHandleAfterMove = await handleBehavior(adapter, moveSource, "move-target.txt");
            } catch (_) { report.staleHandleAfterMove = HANDLE_BEHAVIOR.UNREADABLE; }
        }

        const renameExistingSource = await adapter.createFile("rename-existing-source.txt");
        const renameExistingDestination = await adapter.createFile("rename-existing-destination.txt");
        await renameExistingSource.write?.("source"); await renameExistingDestination.write?.("destination");
        if (typeof folder.renameEntry === "function") {
            report.renameDestinationExistsBehavior = await destinationBehavior(adapter, renameExistingSource, "rename-existing-destination.txt");
        }

        const moveExistingSource = await adapter.createFile("move-existing-source.txt");
        const moveExistingDestination = await adapter.createFile("move-existing-destination.txt");
        await moveExistingSource.write?.("source"); await moveExistingDestination.write?.("destination");
        if (typeof moveExistingSource.moveTo === "function") {
            try {
                await moveExistingSource.moveTo(folder, { newName: "move-existing-destination.txt", overwrite: true });
                report.moveDestinationExistsBehavior = DESTINATION_BEHAVIOR.REPLACED;
            } catch (_) { report.moveDestinationExistsBehavior = DESTINATION_BEHAVIOR.FAILED; }
        }

        const sizeEntry = await adapter.createFile("metadata.txt");
        const beforeSize = adapter.inspectEntry(sizeEntry).size;
        await sizeEntry.write?.("albumai-capability");
        const afterSize = adapter.inspectEntry(sizeEntry).size;
        const refreshedSize = adapter.inspectEntry(await adapter.findEntry("metadata.txt")).size;
        report.canInspectSize = beforeSize != null || afterSize != null || refreshedSize != null;
        report.sizeRefreshReliable = Number.isFinite(afterSize) && afterSize > 0 && refreshedSize === afterSize;

        const binaryEntry = await adapter.createFile("headers.bin");
        await binaryEntry.write?.(new Uint8Array([0x38, 0x42, 0x50, 0x53, 0xff, 0xd8]));
        if (binaryReader) {
            try {
                const binary = await binaryReader(binaryEntry);
                const type = normalizeBinaryReadType(binary);
                report.binaryReadType = type;
                report.canReadBinary = type === "ARRAY_BUFFER" || type === "TYPED_ARRAY";
                const bytes = type === "ARRAY_BUFFER" ? new Uint8Array(binary) :
                    (type === "TYPED_ARRAY" ? new Uint8Array(binary.buffer, binary.byteOffset, binary.byteLength) : null);
                report.psdSignatureReadable = Boolean(bytes?.[0] === 0x38 && bytes?.[1] === 0x42 && bytes?.[2] === 0x50 && bytes?.[3] === 0x53);
                // A separate JPEG sample keeps this check format-specific.
                const jpegEntry = await adapter.createFile("jpeg-header.bin");
                await jpegEntry.write?.(new Uint8Array([0xff, 0xd8, 0x00]));
                const jpeg = await binaryReader(jpegEntry);
                const jpegBytes = jpeg instanceof ArrayBuffer ? new Uint8Array(jpeg) :
                    (ArrayBuffer.isView(jpeg) ? new Uint8Array(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength) : null);
                report.jpegSoiReadable = Boolean(jpegBytes?.[0] === 0xff && jpegBytes?.[1] === 0xd8);
                report.boundedHeaderReadSupported = report.canReadBinary && boundedHeaderReadSupported === true;
            } catch (_) { report.binaryReadType = "UNSUPPORTED"; }
        }

        const deleteEntry = await adapter.createFile("delete-target.txt");
        await deleteEntry.write?.("delete");
        report.staleHandleAfterDelete = await deleteBehavior(adapter, deleteEntry, "delete-target.txt");
    } catch (_) {
        // Partial reports are intentionally conservative and safe to display.
    } finally {
        const cleaned = folder ? await cleanupFolder(folder) : false;
        report.cleanupSucceeded = cleaned;
        report.cleanupFailed = !cleaned;
    }
    report.canReplaceExistingProven = false;
    return Object.freeze({ ...report, recommendedPromotionStrategy: recommendedPromotionStrategy(report) });
}

export { DESTINATION_BEHAVIOR, HANDLE_BEHAVIOR };
