import { OutputReasonCode } from "./OutputTransactionState";

export const OutputVerificationLevel = Object.freeze({
    EXISTS_ONLY: "EXISTS_ONLY",
    SIZE_VERIFIED: "SIZE_VERIFIED",
    HEADER_VERIFIED: "HEADER_VERIFIED"
});

export const OutputVerificationFormat = Object.freeze({
    PSD: "PSD",
    JPEG: "JPEG"
});

function signatureMatches(bytes, format) {
    if (!bytes || bytes.length < 2) return false;
    if (format === OutputVerificationFormat.PSD) {
        return bytes.length >= 4 && bytes[0] === 0x38 && bytes[1] === 0x42 &&
            bytes[2] === 0x50 && bytes[3] === 0x53;
    }
    return bytes[0] === 0xff && bytes[1] === 0xd8;
}

export async function verifyOutputEntry(adapter, entry, { format } = {}) {
    const inspected = adapter.inspectEntry(entry);
    if (!inspected.exists || !inspected.isFile) {
        return Object.freeze({ valid: false, level: OutputVerificationLevel.EXISTS_ONLY, reasonCode: OutputReasonCode.STAGING_MISSING });
    }
    if (inspected.size != null && inspected.size <= 0) {
        return Object.freeze({ valid: false, level: OutputVerificationLevel.SIZE_VERIFIED, reasonCode: OutputReasonCode.STAGING_EMPTY });
    }
    let level = inspected.size != null
        ? OutputVerificationLevel.SIZE_VERIFIED
        : OutputVerificationLevel.EXISTS_ONLY;
    if (!adapter.readBinary) return Object.freeze({ valid: true, level, reasonCode: null });
    try {
        const bytes = await adapter.readHeader(entry);
        if (!bytes) {
            return Object.freeze({ valid: false, level, reasonCode: OutputReasonCode.STAGING_READ_FAILED });
        }
        if (!signatureMatches(bytes, format)) {
            return Object.freeze({ valid: false, level, reasonCode: OutputReasonCode.COMMIT_VERIFICATION_FAILED });
        }
        level = OutputVerificationLevel.HEADER_VERIFIED;
        return Object.freeze({ valid: true, level, reasonCode: null });
    } catch (_) {
        return Object.freeze({ valid: false, level, reasonCode: OutputReasonCode.STAGING_READ_FAILED });
    }
}
