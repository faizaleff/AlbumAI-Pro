const DEFAULT_MAX_ATTEMPTS = 5;
const MAX_NAME_LENGTH = 180;

function extensionOf(name) {
    const value = String(name || "");
    const index = value.lastIndexOf(".");
    return index > 0 ? value.slice(index).replace(/[^.A-Za-z0-9]/g, "") : "";
}

function safeId(value) {
    const normalized = String(value || "transaction")
        .replace(/[^A-Za-z0-9-]/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 48);
    return normalized || "transaction";
}

export function outputStagingName({ finalName, transactionId, attempt = 1 } = {}) {
    const extension = extensionOf(finalName);
    const prefix = `._albumai-stage-${safeId(transactionId)}-${Math.max(1, Number(attempt) || 1)}`;
    return `${prefix.slice(0, MAX_NAME_LENGTH - extension.length)}${extension}`;
}

export function outputBackupName({ finalName, transactionId, attempt = 1 } = {}) {
    const extension = extensionOf(finalName);
    const prefix = `._albumai-backup-${safeId(transactionId)}-${Math.max(1, Number(attempt) || 1)}`;
    return `${prefix.slice(0, MAX_NAME_LENGTH - extension.length)}${extension}`;
}

export async function createUniqueStaging(adapter, options = {}) {
    const maxAttempts = Math.max(1, Math.min(DEFAULT_MAX_ATTEMPTS, Number(options.maxAttempts) || DEFAULT_MAX_ATTEMPTS));
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        const name = outputStagingName({ ...options, attempt });
        try {
            if (await adapter.findEntry(name)) continue;
        } catch (_) {
            return { entry: null, name: "", attempt, exhausted: true };
        }
        try {
            const entry = await adapter.createFile(name);
            return { entry, name, attempt, exhausted: false };
        } catch (_) {
            // A concurrent creator can win between lookup and create. Bounded
            // retry covers that collision without exposing host errors.
        }
    }
    return { entry: null, name: "", attempt: maxAttempts, exhausted: true };
}
