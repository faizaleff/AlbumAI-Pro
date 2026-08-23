const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const PHOTO_AI_CANDIDATE_EVIDENCE_SCHEMA = 1;
const REQUIRED_ARTIFACT_KINDS = Object.freeze([
    "MODEL",
    "RUNTIME",
    "GLUE",
    "NOTICES"
]);

const PhotoAiCandidateEvidenceError = Object.freeze({
    UNKNOWN_SCHEMA: "UNKNOWN_SCHEMA",
    MANIFEST_INVALID: "MANIFEST_INVALID",
    ARTIFACT_INVENTORY_INVALID: "ARTIFACT_INVENTORY_INVALID",
    ARTIFACT_FILE_INVALID: "ARTIFACT_FILE_INVALID",
    ARTIFACT_CHANGED_DURING_VERIFICATION:
        "ARTIFACT_CHANGED_DURING_VERIFICATION",
    OUTPUT_WRITE_FAILED: "OUTPUT_WRITE_FAILED"
});

class CandidateEvidenceError extends Error {
    constructor(code) {
        super(code);
        this.name = "CandidateEvidenceError";
        this.code = code;
    }
}

function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

function boundedIdentifier(value, maximumLength = 120) {
    return typeof value === "string" &&
        value.length > 0 &&
        value.length <= maximumLength &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
        ? value
        : null;
}

function safeHttpsUrl(value) {
    if (typeof value !== "string" || value.length > 512) return null;
    try {
        const parsed = new URL(value);
        return parsed.protocol === "https:" &&
            !parsed.username &&
            !parsed.password &&
            !parsed.search &&
            !parsed.hash
            ? parsed.toString()
            : null;
    } catch (_error) {
        return null;
    }
}

function calendarDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return null;
    }
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
        ? value
        : null;
}

function normalizeLicense(value) {
    const source = objectValue(value);
    const licenseId = boundedIdentifier(source.licenseId);
    const sourceUrl = safeHttpsUrl(source.sourceUrl);
    return licenseId && sourceUrl ? { licenseId, sourceUrl } : null;
}

function normalizeManifest(value) {
    const source = objectValue(value);
    if (source.schemaVersion !== PHOTO_AI_CANDIDATE_EVIDENCE_SCHEMA) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.UNKNOWN_SCHEMA
        );
    }
    const candidate = objectValue(source.candidate);
    const candidateId = boundedIdentifier(candidate.candidateId, 80);
    const modelVersion = boundedIdentifier(candidate.modelVersion, 80);
    const sourceUrl = safeHttpsUrl(candidate.sourceUrl);
    const licensing = objectValue(source.licensing);
    const disclosure = objectValue(licensing.trainingDataDisclosure);
    const review = objectValue(source.review);
    const obligations = Array.isArray(licensing.obligations) &&
        licensing.obligations.length <= 16
        ? licensing.obligations.map(item => boundedIdentifier(item, 80))
        : null;
    const normalized = {
        candidate: {
            candidateId,
            modelVersion,
            providerKind: candidate.providerKind === "LOCAL_WASM"
                ? candidate.providerKind
                : null,
            sourceUrl
        },
        licensing: {
            weights: normalizeLicense(licensing.weights),
            code: normalizeLicense(licensing.code),
            trainingDataDisclosure: {
                status: ["DISCLOSED", "NOT_DISCLOSED"].includes(
                    disclosure.status
                )
                    ? disclosure.status
                    : null,
                sourceUrl: safeHttpsUrl(disclosure.sourceUrl)
            },
            commercialUseAllowed: licensing.commercialUseAllowed,
            redistributionAllowed: licensing.redistributionAllowed,
            researchOnly: licensing.researchOnly,
            fieldOfUseRestriction: licensing.fieldOfUseRestriction,
            obligations: obligations && obligations.every(Boolean)
                ? [...new Set(obligations)].sort()
                : null
        },
        review: {
            decision: ["APPROVED", "PENDING", "REJECTED"]
                .includes(review.decision)
                ? review.decision
                : null,
            reviewId: boundedIdentifier(review.reviewId),
            reviewerRole: boundedIdentifier(review.reviewerRole, 80),
            reviewedAt: calendarDate(review.reviewedAt),
            noticesComplete: review.noticesComplete,
            obligationsAccepted: review.obligationsAccepted
        }
    };
    const complete = normalized.candidate.candidateId &&
        normalized.candidate.modelVersion &&
        normalized.candidate.providerKind &&
        normalized.candidate.sourceUrl &&
        normalized.licensing.weights &&
        normalized.licensing.code &&
        normalized.licensing.trainingDataDisclosure.status &&
        (normalized.licensing.trainingDataDisclosure.status === "NOT_DISCLOSED" ||
            normalized.licensing.trainingDataDisclosure.sourceUrl) &&
        typeof normalized.licensing.commercialUseAllowed === "boolean" &&
        typeof normalized.licensing.redistributionAllowed === "boolean" &&
        typeof normalized.licensing.researchOnly === "boolean" &&
        typeof normalized.licensing.fieldOfUseRestriction === "boolean" &&
        normalized.licensing.obligations &&
        normalized.review.decision &&
        normalized.review.reviewId &&
        normalized.review.reviewerRole &&
        normalized.review.reviewedAt &&
        typeof normalized.review.noticesComplete === "boolean" &&
        typeof normalized.review.obligationsAccepted === "boolean";
    if (!complete) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.MANIFEST_INVALID
        );
    }
    return normalized;
}

function normalizeArtifactDefinitions(value) {
    if (!Array.isArray(value) || value.length !== REQUIRED_ARTIFACT_KINDS.length) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.ARTIFACT_INVENTORY_INVALID
        );
    }
    const byKind = new Map();
    for (const entry of value) {
        const source = objectValue(entry);
        const kind = REQUIRED_ARTIFACT_KINDS.includes(source.kind)
            ? source.kind
            : null;
        const artifactId = boundedIdentifier(source.artifactId, 80);
        const sourceUrl = safeHttpsUrl(source.sourceUrl);
        if (!kind || byKind.has(kind) || !artifactId || !sourceUrl ||
            typeof source.filePath !== "string" || !source.filePath) {
            throw new CandidateEvidenceError(
                PhotoAiCandidateEvidenceError.ARTIFACT_INVENTORY_INVALID
            );
        }
        byKind.set(kind, {
            kind,
            artifactId,
            sourceUrl,
            filePath: path.resolve(source.filePath)
        });
    }
    if (REQUIRED_ARTIFACT_KINDS.some(kind => !byKind.has(kind))) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.ARTIFACT_INVENTORY_INVALID
        );
    }
    return REQUIRED_ARTIFACT_KINDS.map(kind => byKind.get(kind));
}

function sameFileIdentity(before, after) {
    return before.dev === after.dev &&
        before.ino === after.ino &&
        before.size === after.size &&
        before.mtimeMs === after.mtimeMs;
}

async function inspectArtifactFile(filePath) {
    let before;
    try {
        before = await fs.promises.lstat(filePath);
    } catch (_error) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.ARTIFACT_FILE_INVALID
        );
    }
    if (!before.isFile() || before.isSymbolicLink()) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.ARTIFACT_FILE_INVALID
        );
    }
    const hash = crypto.createHash("sha256");
    try {
        await new Promise((resolve, reject) => {
            const stream = fs.createReadStream(filePath);
            stream.on("data", chunk => hash.update(chunk));
            stream.on("error", reject);
            stream.on("end", resolve);
        });
    } catch (_error) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.ARTIFACT_FILE_INVALID
        );
    }
    let after;
    try {
        after = await fs.promises.lstat(filePath);
    } catch (_error) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.ARTIFACT_CHANGED_DURING_VERIFICATION
        );
    }
    if (!sameFileIdentity(before, after)) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.ARTIFACT_CHANGED_DURING_VERIFICATION
        );
    }
    return Object.freeze({
        digest: `sha256:${hash.digest("hex")}`,
        bytes: before.size
    });
}

async function buildPhotoAiCandidateEvidence(value, options = {}) {
    const source = objectValue(value);
    const normalized = normalizeManifest(source);
    const definitions = normalizeArtifactDefinitions(source.artifacts);
    const inspect = options.inspectArtifact || inspectArtifactFile;
    const artifacts = [];
    for (const definition of definitions) {
        let evidence;
        try {
            evidence = await inspect(definition.filePath, definition.kind);
        } catch (error) {
            if (error instanceof CandidateEvidenceError) throw error;
            throw new CandidateEvidenceError(
                PhotoAiCandidateEvidenceError.ARTIFACT_FILE_INVALID
            );
        }
        if (!evidence || !Number.isSafeInteger(evidence.bytes) ||
            evidence.bytes < 0 ||
            !/^sha256:[a-f0-9]{64}$/.test(evidence.digest || "")) {
            throw new CandidateEvidenceError(
                PhotoAiCandidateEvidenceError.ARTIFACT_FILE_INVALID
            );
        }
        artifacts.push(Object.freeze({
            kind: definition.kind,
            artifactId: definition.artifactId,
            sourceUrl: definition.sourceUrl,
            digest: evidence.digest,
            bytes: evidence.bytes
        }));
    }
    const modelDigest = artifacts.find(({ kind }) => kind === "MODEL").digest;
    return Object.freeze({
        schemaVersion: PHOTO_AI_CANDIDATE_EVIDENCE_SCHEMA,
        verification: Object.freeze({
            status: "VERIFIED_FROM_LOCAL_FILES",
            algorithm: "SHA-256",
            artifactCount: artifacts.length
        }),
        candidateInventory: Object.freeze({
            schemaVersion: 1,
            candidate: Object.freeze({
                ...normalized.candidate,
                modelDigest
            }),
            artifacts: Object.freeze(artifacts),
            licensing: Object.freeze(normalized.licensing),
            review: Object.freeze(normalized.review)
        })
    });
}

async function writeEvidenceFile(outputPath, evidence) {
    const absoluteOutput = path.resolve(outputPath);
    const outputDirectory = path.dirname(absoluteOutput);
    const temporaryPath = path.join(
        outputDirectory,
        `.${path.basename(absoluteOutput)}.${process.pid}.tmp`
    );
    try {
        await fs.promises.writeFile(
            temporaryPath,
            `${JSON.stringify(evidence, null, 2)}\n`,
            { encoding: "utf8", flag: "wx", mode: 0o600 }
        );
        await fs.promises.link(temporaryPath, absoluteOutput);
        await fs.promises.rm(temporaryPath, { force: true });
    } catch (_error) {
        await fs.promises.rm(temporaryPath, { force: true }).catch(() => {});
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.OUTPUT_WRITE_FAILED
        );
    }
}

async function runCli(argv = process.argv.slice(2)) {
    if (argv.length !== 2) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.MANIFEST_INVALID
        );
    }
    let manifest;
    try {
        manifest = JSON.parse(await fs.promises.readFile(argv[0], "utf8"));
    } catch (_error) {
        throw new CandidateEvidenceError(
            PhotoAiCandidateEvidenceError.MANIFEST_INVALID
        );
    }
    const evidence = await buildPhotoAiCandidateEvidence(manifest);
    await writeEvidenceFile(argv[1], evidence);
    process.stdout.write("Photo AI candidate evidence: VERIFIED\n");
}

module.exports = {
    CandidateEvidenceError,
    PHOTO_AI_CANDIDATE_EVIDENCE_SCHEMA,
    PhotoAiCandidateEvidenceError,
    buildPhotoAiCandidateEvidence,
    inspectArtifactFile,
    runCli,
    writeEvidenceFile
};

if (require.main === module) {
    runCli().catch(error => {
        const code = error instanceof CandidateEvidenceError
            ? error.code
            : PhotoAiCandidateEvidenceError.MANIFEST_INVALID;
        process.stderr.write(`Photo AI candidate evidence: ${code}\n`);
        process.exitCode = 1;
    });
}
