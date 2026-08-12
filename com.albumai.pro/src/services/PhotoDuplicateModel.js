import { photoDecisionKey } from "./PhotoBrowserModel";

export const PHOTO_DUPLICATE_EVIDENCE_SCHEMA = 1;

export const PhotoDuplicateStatus = Object.freeze({
    NOT_STARTED: "NOT_STARTED",
    COMPLETE: "COMPLETE",
    PARTIAL: "PARTIAL",
    STALE: "STALE"
});

const MAX_PHOTOS = 20000;
const MAX_GROUPS = 10000;
const MAX_FAILURES = 1000;
const VALID_STATUSES = new Set(Object.values(PhotoDuplicateStatus));
const VALID_FAILURE_REASONS = new Set([
    "CHANGED_DURING_ANALYSIS",
    "INVALID_BINARY",
    "READ_FAILED"
]);
const SHA256_CONSTANTS = [];
const SHA256_INITIAL = [];
for (let candidate = 2; SHA256_CONSTANTS.length < 64; candidate++) {
    let prime = true;
    for (let divisor = 2; divisor * divisor <= candidate; divisor++) {
        if (candidate % divisor === 0) {
            prime = false;
            break;
        }
    }
    if (!prime) continue;
    if (SHA256_INITIAL.length < 8) {
        SHA256_INITIAL.push(
            (Math.sqrt(candidate) % 1) * 0x100000000 >>> 0
        );
    }
    SHA256_CONSTANTS.push(
        (Math.cbrt(candidate) % 1) * 0x100000000 >>> 0
    );
}

function boundedInteger(value, maximum = Number.MAX_SAFE_INTEGER) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.min(maximum, Math.floor(number));
}

function timestampValue(value) {
    if (value instanceof Date) return value.getTime();
    if (typeof value === "number") return boundedInteger(value);
    if (!value) return 0;
    return boundedInteger(new Date(value).getTime());
}

function fnv1a(value, seed) {
    let hash = seed >>> 0;
    for (let index = 0; index < value.length; index++) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(16).padStart(8, "0");
}

function opaqueKey(prefix, value) {
    return `${prefix}-${fnv1a(value, 0x811c9dc5)}${fnv1a(
        value,
        0x9e3779b9
    )}`;
}

function photoSize(photo) {
    return boundedInteger(photo?.fileSize || photo?.file?.size);
}

export function photoDuplicateRevisionKey(photo) {
    const photoKey = photoDecisionKey(photo);
    if (!photoKey) return null;
    const modified = timestampValue(
        photo?.modified || photo?.file?.modified || photo?.file?.lastModified
    );
    return opaqueKey("r1", `${photoKey}|${photoSize(photo)}|${modified}`);
}

export function photoDuplicateLibraryKey(photos = []) {
    const revisions = (Array.isArray(photos) ? photos : [])
        .slice(0, MAX_PHOTOS)
        .map(photoDuplicateRevisionKey)
        .filter(Boolean)
        .sort();
    return opaqueKey("l1", revisions.join("|"));
}

function bytesFrom(value) {
    if (value instanceof ArrayBuffer) return new Uint8Array(value);
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    return null;
}

function rotateRight(value, count) {
    return (value >>> count) | (value << (32 - count));
}

function processSha256Block(view, offset, hash, words) {
    for (let index = 0; index < 16; index++) {
        words[index] = view.getUint32(offset + index * 4, false);
    }
    for (let index = 16; index < 64; index++) {
        const left = words[index - 15];
        const right = words[index - 2];
        const sigma0 = rotateRight(left, 7) ^
            rotateRight(left, 18) ^ (left >>> 3);
        const sigma1 = rotateRight(right, 17) ^
            rotateRight(right, 19) ^ (right >>> 10);
        words[index] = (
            words[index - 16] + sigma0 + words[index - 7] + sigma1
        ) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index++) {
        const sigma1 = rotateRight(e, 6) ^
            rotateRight(e, 11) ^ rotateRight(e, 25);
        const choice = (e & f) ^ (~e & g);
        const first = (
            h + sigma1 + choice + SHA256_CONSTANTS[index] + words[index]
        ) >>> 0;
        const sigma0 = rotateRight(a, 2) ^
            rotateRight(a, 13) ^ rotateRight(a, 22);
        const majority = (a & b) ^ (a & c) ^ (b & c);
        const second = (sigma0 + majority) >>> 0;
        h = g;
        g = f;
        f = e;
        e = (d + first) >>> 0;
        d = c;
        c = b;
        b = a;
        a = (first + second) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
}

export function sha256Fingerprint(value) {
    const bytes = bytesFrom(value);
    if (!bytes) return null;

    const bitLength = bytes.length * 8;
    const hash = Array.from(SHA256_INITIAL);
    const words = new Uint32Array(64);

    const completeLength = Math.floor(bytes.length / 64) * 64;
    const inputView = new DataView(
        bytes.buffer,
        bytes.byteOffset,
        bytes.byteLength
    );
    for (let offset = 0; offset < completeLength; offset += 64) {
        processSha256Block(inputView, offset, hash, words);
    }

    const remainder = bytes.length - completeLength;
    const tailLength = remainder < 56 ? 64 : 128;
    const tail = new Uint8Array(tailLength);
    tail.set(bytes.subarray(completeLength));
    tail[remainder] = 0x80;
    const tailView = new DataView(tail.buffer);
    tailView.setUint32(
        tailLength - 8,
        Math.floor(bitLength / 0x100000000),
        false
    );
    tailView.setUint32(tailLength - 4, bitLength >>> 0, false);
    for (let offset = 0; offset < tailLength; offset += 64) {
        processSha256Block(tailView, offset, hash, words);
    }

    return hash.map(word => word.toString(16).padStart(8, "0")).join("");
}

function normalizedMember(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!/^p1-[0-9a-f]{16}$/.test(value.photoKey || "")) return null;
    if (!/^r1-[0-9a-f]{16}$/.test(value.revisionKey || "")) return null;
    return Object.freeze({
        photoKey: value.photoKey,
        revisionKey: value.revisionKey
    });
}

function normalizedGroup(value, maximumMembers = MAX_PHOTOS) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!/^d1-[0-9a-f]{16}$/.test(value.groupId || "")) return null;
    const membersByKey = new Map();
    const candidates = Array.isArray(value.members)
        ? value.members.slice(0, maximumMembers)
        : [];
    for (const candidate of candidates) {
        const member = normalizedMember(candidate);
        if (member) membersByKey.set(member.photoKey, member);
    }
    const members = [...membersByKey.values()].sort((left, right) =>
        left.photoKey.localeCompare(right.photoKey)
    );
    if (members.length < 2) return null;
    const byteSize = boundedInteger(value.byteSize);
    if (!byteSize) return null;
    return Object.freeze({
        groupId: value.groupId,
        evidence: "SHA256",
        byteSize,
        potentialSavingsBytes: boundedInteger(
            byteSize * (members.length - 1)
        ),
        members: Object.freeze(members)
    });
}

function normalizedFailure(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    if (!/^p1-[0-9a-f]{16}$/.test(value.photoKey || "")) return null;
    if (!/^r1-[0-9a-f]{16}$/.test(value.revisionKey || "")) return null;
    if (!VALID_FAILURE_REASONS.has(value.reason)) return null;
    return Object.freeze({
        photoKey: value.photoKey,
        revisionKey: value.revisionKey,
        reason: value.reason
    });
}

export function normalizePhotoDuplicateEvidence(value = {}) {
    const source = value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
    const groups = [];
    let memberBudget = MAX_PHOTOS;
    for (const candidate of (Array.isArray(source.groups)
        ? source.groups
        : []).slice(0, MAX_GROUPS)) {
        const group = normalizedGroup(candidate, memberBudget);
        if (group) {
            groups.push(group);
            memberBudget -= group.members.length;
        }
        if (memberBudget < 2) break;
    }
    groups.sort((left, right) => left.groupId.localeCompare(right.groupId));
    const failures = (Array.isArray(source.failures) ? source.failures : [])
        .slice(0, MAX_FAILURES)
        .map(normalizedFailure)
        .filter(Boolean)
        .sort((left, right) => left.photoKey.localeCompare(right.photoKey));
    const duplicatePhotos = groups.reduce(
        (total, group) => total + group.members.length,
        0
    );
    const potentialSavingsBytes = boundedInteger(groups.reduce(
        (total, group) => total + group.potentialSavingsBytes,
        0
    ));
    let status = VALID_STATUSES.has(source.status)
        ? source.status
        : PhotoDuplicateStatus.NOT_STARTED;
    const libraryKey = /^l1-[0-9a-f]{16}$/.test(source.libraryKey || "")
        ? source.libraryKey
        : null;
    if (
        !libraryKey &&
        (
            status === PhotoDuplicateStatus.COMPLETE ||
            status === PhotoDuplicateStatus.PARTIAL
        )
    ) {
        status = PhotoDuplicateStatus.STALE;
    }
    return Object.freeze({
        schemaVersion: PHOTO_DUPLICATE_EVIDENCE_SCHEMA,
        status,
        libraryKey,
        candidatePhotos: boundedInteger(source.candidatePhotos, MAX_PHOTOS),
        fingerprintedPhotos: boundedInteger(
            source.fingerprintedPhotos,
            MAX_PHOTOS
        ),
        duplicatePhotos,
        potentialSavingsBytes,
        groups: Object.freeze(groups),
        failures: Object.freeze(failures)
    });
}

export function reconcilePhotoDuplicateEvidence(value, photos = []) {
    const evidence = normalizePhotoDuplicateEvidence(value);
    if (evidence.status === PhotoDuplicateStatus.NOT_STARTED) return evidence;
    if (evidence.libraryKey !== photoDuplicateLibraryKey(photos)) {
        return normalizePhotoDuplicateEvidence({
            status: PhotoDuplicateStatus.STALE
        });
    }
    const revisions = new Map((Array.isArray(photos) ? photos : [])
        .slice(0, MAX_PHOTOS)
        .map(photo => [photoDecisionKey(photo), photoDuplicateRevisionKey(photo)])
        .filter(([photoKey, revisionKey]) => photoKey && revisionKey));
    const members = evidence.groups.flatMap(group => group.members)
        .concat(evidence.failures);
    if (members.some(member =>
        revisions.get(member.photoKey) !== member.revisionKey
    )) {
        return normalizePhotoDuplicateEvidence({
            status: PhotoDuplicateStatus.STALE
        });
    }
    return evidence;
}

export async function analyzeExactPhotoDuplicates(photos = [], {
    readBinary,
    isCurrent = () => true
} = {}) {
    if (typeof readBinary !== "function") {
        throw new TypeError("Duplicate analysis requires a binary reader.");
    }
    const source = (Array.isArray(photos) ? photos : [])
        .slice(0, MAX_PHOTOS)
        .map(photo => ({
            photo,
            photoKey: photoDecisionKey(photo),
            revisionKey: photoDuplicateRevisionKey(photo),
            byteSize: photoSize(photo)
        }))
        .filter(item => item.photoKey && item.revisionKey && item.byteSize > 0);
    const bySize = new Map();
    for (const item of source) {
        if (!bySize.has(item.byteSize)) bySize.set(item.byteSize, []);
        bySize.get(item.byteSize).push(item);
    }
    const candidates = [...bySize.values()]
        .filter(items => items.length > 1)
        .flat()
        .sort((left, right) => left.photoKey.localeCompare(right.photoKey));
    const byFingerprint = new Map();
    const failures = [];
    let fingerprintedPhotos = 0;

    for (const candidate of candidates) {
        if (!isCurrent()) {
            return normalizePhotoDuplicateEvidence({
                status: PhotoDuplicateStatus.STALE
            });
        }
        let binary;
        try {
            binary = await readBinary(candidate.photo);
        } catch (_) {
            failures.push({ ...candidate, reason: "READ_FAILED" });
            continue;
        }
        if (!isCurrent()) {
            return normalizePhotoDuplicateEvidence({
                status: PhotoDuplicateStatus.STALE
            });
        }
        const bytes = bytesFrom(binary);
        if (!bytes) {
            failures.push({ ...candidate, reason: "INVALID_BINARY" });
            continue;
        }
        if (bytes.byteLength !== candidate.byteSize) {
            failures.push({
                ...candidate,
                reason: "CHANGED_DURING_ANALYSIS"
            });
            continue;
        }
        if (photoDuplicateRevisionKey(candidate.photo) !== candidate.revisionKey) {
            failures.push({
                ...candidate,
                reason: "CHANGED_DURING_ANALYSIS"
            });
            continue;
        }
        const fingerprint = sha256Fingerprint(bytes);
        fingerprintedPhotos++;
        const key = `${candidate.byteSize}:${fingerprint}`;
        if (!byFingerprint.has(key)) byFingerprint.set(key, []);
        byFingerprint.get(key).push(candidate);
    }

    const groups = [...byFingerprint.entries()]
        .filter(([, items]) => items.length > 1)
        .map(([key, items]) => {
            const fingerprint = key.slice(key.indexOf(":") + 1);
            return {
                groupId: opaqueKey("d1", fingerprint),
                evidence: "SHA256",
                byteSize: items[0].byteSize,
                members: items.map(({ photoKey, revisionKey }) => ({
                    photoKey,
                    revisionKey
                }))
            };
        });
    return normalizePhotoDuplicateEvidence({
        status: failures.length
            ? PhotoDuplicateStatus.PARTIAL
            : PhotoDuplicateStatus.COMPLETE,
        candidatePhotos: candidates.length,
        fingerprintedPhotos,
        libraryKey: photoDuplicateLibraryKey(photos),
        groups,
        failures: failures.map(({ photoKey, revisionKey, reason }) => ({
            photoKey,
            revisionKey,
            reason
        }))
    });
}
