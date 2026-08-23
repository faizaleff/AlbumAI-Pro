const fs = require("fs");
const path = require("path");

const PHOTO_AI_PRODUCTION_EVIDENCE_PACKET_SCHEMA = 1;
const REQUIRED_HOSTS = Object.freeze(["MACOS", "WINDOWS"]);
const REQUIRED_ARTIFACTS = Object.freeze([
    "MODEL",
    "RUNTIME",
    "GLUE",
    "NOTICES"
]);

const PhotoAiProductionEvidenceError = Object.freeze({
    UNKNOWN_SCHEMA: "UNKNOWN_SCHEMA",
    CANDIDATE_EVIDENCE_INVALID: "CANDIDATE_EVIDENCE_INVALID",
    RUNTIME_COMPATIBILITY_INVALID: "RUNTIME_COMPATIBILITY_INVALID",
    POLICY_MANIFEST_INVALID: "POLICY_MANIFEST_INVALID",
    HOST_RECORD_INVALID: "HOST_RECORD_INVALID",
    HOST_RECORDS_INCOMPLETE: "HOST_RECORDS_INCOMPLETE",
    HOST_RECORD_DUPLICATE: "HOST_RECORD_DUPLICATE",
    EVIDENCE_IDENTITY_MISMATCH: "EVIDENCE_IDENTITY_MISMATCH",
    OUTPUT_WRITE_FAILED: "OUTPUT_WRITE_FAILED"
});

class ProductionEvidenceError extends Error {
    constructor(code) {
        super(code);
        this.name = "ProductionEvidenceError";
        this.code = code;
    }
}

function objectValue(value) {
    return value && typeof value === "object" && !Array.isArray(value)
        ? value
        : {};
}

function exactKeys(value, keys) {
    const actual = Object.keys(objectValue(value)).sort();
    const expected = [...keys].sort();
    return actual.length === expected.length &&
        actual.every((key, index) => key === expected[index]);
}

function boundedIdentifier(value, maximumLength = 120) {
    return typeof value === "string" &&
        value.length > 0 &&
        value.length <= maximumLength &&
        /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
        ? value
        : null;
}

function sha256Digest(value) {
    return typeof value === "string" && /^sha256:[a-f0-9]{64}$/.test(value)
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

function nonNegativeInteger(value) {
    return Number.isSafeInteger(value) && value >= 0 ? value : null;
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
    if (!exactKeys(value, ["licenseId", "sourceUrl"])) return null;
    const source = objectValue(value);
    const licenseId = boundedIdentifier(source.licenseId);
    const sourceUrl = safeHttpsUrl(source.sourceUrl);
    return licenseId && sourceUrl ? { licenseId, sourceUrl } : null;
}

function normalizeCandidateEvidence(value) {
    const source = objectValue(value);
    const verification = objectValue(source.verification);
    const inventory = objectValue(source.candidateInventory);
    if (!exactKeys(source, [
        "schemaVersion", "verification", "candidateInventory"
    ]) || !exactKeys(verification, [
        "status", "algorithm", "artifactCount"
    ]) || source.schemaVersion !== 1 ||
        verification.status !== "VERIFIED_FROM_LOCAL_FILES" ||
        verification.algorithm !== "SHA-256" ||
        verification.artifactCount !== REQUIRED_ARTIFACTS.length ||
        !exactKeys(inventory, [
            "schemaVersion", "candidate", "artifacts", "licensing", "review"
        ]) || inventory.schemaVersion !== 1) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
        );
    }

    const candidate = objectValue(inventory.candidate);
    if (!exactKeys(candidate, [
        "candidateId", "modelVersion", "providerKind", "sourceUrl",
        "modelDigest"
    ])) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
        );
    }
    const normalizedCandidate = {
        candidateId: boundedIdentifier(candidate.candidateId, 80),
        modelVersion: boundedIdentifier(candidate.modelVersion, 80),
        providerKind: candidate.providerKind === "LOCAL_WASM"
            ? candidate.providerKind
            : null,
        sourceUrl: safeHttpsUrl(candidate.sourceUrl),
        modelDigest: sha256Digest(candidate.modelDigest)
    };

    if (!Array.isArray(inventory.artifacts) ||
        inventory.artifacts.length !== REQUIRED_ARTIFACTS.length) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
        );
    }
    const artifactsByKind = new Map();
    for (const value of inventory.artifacts) {
        const artifact = objectValue(value);
        const kind = REQUIRED_ARTIFACTS.includes(artifact.kind)
            ? artifact.kind
            : null;
        if (!exactKeys(artifact, [
            "kind", "artifactId", "sourceUrl", "digest", "bytes"
        ]) || !kind || artifactsByKind.has(kind)) {
            throw new ProductionEvidenceError(
                PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
            );
        }
        const normalized = {
            kind,
            artifactId: boundedIdentifier(artifact.artifactId, 80),
            sourceUrl: safeHttpsUrl(artifact.sourceUrl),
            digest: sha256Digest(artifact.digest),
            bytes: nonNegativeInteger(artifact.bytes)
        };
        if (!normalized.artifactId || !normalized.sourceUrl ||
            !normalized.digest || normalized.bytes === null) {
            throw new ProductionEvidenceError(
                PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
            );
        }
        artifactsByKind.set(kind, normalized);
    }

    const licensing = objectValue(inventory.licensing);
    const disclosure = objectValue(licensing.trainingDataDisclosure);
    if (!exactKeys(licensing, [
        "weights", "code", "trainingDataDisclosure",
        "commercialUseAllowed", "redistributionAllowed", "researchOnly",
        "fieldOfUseRestriction", "obligations"
    ]) || !exactKeys(disclosure, ["status", "sourceUrl"])) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
        );
    }
    const obligations = Array.isArray(licensing.obligations) &&
        licensing.obligations.length <= 16
        ? licensing.obligations.map(value => boundedIdentifier(value, 80))
        : null;
    const normalizedLicensing = {
        weights: normalizeLicense(licensing.weights),
        code: normalizeLicense(licensing.code),
        trainingDataDisclosure: {
            status: ["DISCLOSED", "NOT_DISCLOSED"].includes(disclosure.status)
                ? disclosure.status
                : null,
            sourceUrl: disclosure.status === "NOT_DISCLOSED"
                ? null
                : safeHttpsUrl(disclosure.sourceUrl)
        },
        commercialUseAllowed: licensing.commercialUseAllowed,
        redistributionAllowed: licensing.redistributionAllowed,
        researchOnly: licensing.researchOnly,
        fieldOfUseRestriction: licensing.fieldOfUseRestriction,
        obligations: obligations && obligations.every(Boolean)
            ? [...new Set(obligations)].sort()
            : null
    };

    const review = objectValue(inventory.review);
    if (!exactKeys(review, [
        "decision", "reviewId", "reviewerRole", "reviewedAt",
        "noticesComplete", "obligationsAccepted"
    ])) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
        );
    }
    const normalizedReview = {
        decision: ["APPROVED", "PENDING", "REJECTED"].includes(
            review.decision
        ) ? review.decision : null,
        reviewId: boundedIdentifier(review.reviewId),
        reviewerRole: boundedIdentifier(review.reviewerRole, 80),
        reviewedAt: calendarDate(review.reviewedAt),
        noticesComplete: review.noticesComplete,
        obligationsAccepted: review.obligationsAccepted
    };
    const booleansComplete = [
        normalizedLicensing.commercialUseAllowed,
        normalizedLicensing.redistributionAllowed,
        normalizedLicensing.researchOnly,
        normalizedLicensing.fieldOfUseRestriction,
        normalizedReview.noticesComplete,
        normalizedReview.obligationsAccepted
    ].every(value => typeof value === "boolean");
    if (Object.values(normalizedCandidate).some(value => !value) ||
        !normalizedLicensing.weights || !normalizedLicensing.code ||
        !normalizedLicensing.trainingDataDisclosure.status ||
        (normalizedLicensing.trainingDataDisclosure.status === "DISCLOSED" &&
            !normalizedLicensing.trainingDataDisclosure.sourceUrl) ||
        !normalizedLicensing.obligations ||
        !normalizedReview.decision || !normalizedReview.reviewId ||
        !normalizedReview.reviewerRole || !normalizedReview.reviewedAt ||
        !booleansComplete) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
        );
    }

    const artifacts = REQUIRED_ARTIFACTS.map(kind => artifactsByKind.get(kind));
    if (normalizedCandidate.modelDigest !== artifactsByKind.get("MODEL").digest) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.EVIDENCE_IDENTITY_MISMATCH
        );
    }
    return {
        inventory: {
            schemaVersion: 1,
            candidate: normalizedCandidate,
            artifacts,
            licensing: normalizedLicensing,
            review: normalizedReview
        },
        identity: {
            candidateId: normalizedCandidate.candidateId,
            modelDigest: normalizedCandidate.modelDigest,
            runtimeDigest: artifactsByKind.get("RUNTIME").digest
        }
    };
}

function normalizeCompatibilityHost(value) {
    const source = objectValue(value);
    if (!exactKeys(source, [
        "platform", "tested", "localAssetBytesPassed",
        "moduleConstructorPassed", "instanceConstructorPassed",
        "documentCountUnchanged", "asyncInstantiationRequired",
        "fetchRequired", "workerRequired", "crossOriginIsolationRequired"
    ]) || !REQUIRED_HOSTS.includes(source.platform)) return null;
    const booleanKeys = Object.keys(source).filter(key => key !== "platform");
    if (!booleanKeys.every(key => typeof source[key] === "boolean")) return null;
    return { ...source };
}

function normalizeRuntimeCompatibility(value, identity) {
    const source = objectValue(value);
    const runtime = objectValue(source.runtime);
    if (!exactKeys(source, ["schemaVersion", "runtime", "hosts"]) ||
        source.schemaVersion !== 1 ||
        !exactKeys(runtime, [
            "runtimeId", "runtimeVersion", "runtimeDigest", "loaderKind"
        ]) || !Array.isArray(source.hosts) || source.hosts.length !== 2) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.RUNTIME_COMPATIBILITY_INVALID
        );
    }
    const normalizedRuntime = {
        runtimeId: boundedIdentifier(runtime.runtimeId, 80),
        runtimeVersion: boundedIdentifier(runtime.runtimeVersion, 80),
        runtimeDigest: sha256Digest(runtime.runtimeDigest),
        loaderKind: runtime.loaderKind === "LOCAL_BYTES_SYNC_WASM"
            ? runtime.loaderKind
            : null
    };
    const hosts = source.hosts.map(normalizeCompatibilityHost);
    if (Object.values(normalizedRuntime).some(value => !value) ||
        hosts.some(host => !host) ||
        new Set(hosts.map(host => host.platform)).size !== 2 ||
        REQUIRED_HOSTS.some(platform =>
            !hosts.some(host => host.platform === platform)
        )) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.RUNTIME_COMPATIBILITY_INVALID
        );
    }
    if (normalizedRuntime.runtimeDigest !== identity.runtimeDigest) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.EVIDENCE_IDENTITY_MISMATCH
        );
    }
    return {
        schemaVersion: 1,
        runtime: normalizedRuntime,
        hosts: REQUIRED_HOSTS.map(platform =>
            hosts.find(host => host.platform === platform)
        )
    };
}

function normalizePolicyManifest(value) {
    const source = objectValue(value);
    const concurrency = objectValue(source.concurrency);
    if (!exactKeys(source, [
        "schemaVersion", "privacyBoundaryPassed", "networkRequired",
        "cancellationPassed", "stalePublicationPassed", "concurrency"
    ]) || source.schemaVersion !== 1 ||
        !exactKeys(concurrency, [
            "queueOwner", "maximumActiveProjects", "maximumModelInstances",
            "maximumConcurrentInferences", "maximumQueuedPhotos",
            "duplicateRequestsReuseWork", "cancellationRequired",
            "stalePublicationGuardRequired"
        ])) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.POLICY_MANIFEST_INVALID
        );
    }
    const booleanKeys = [
        "privacyBoundaryPassed", "networkRequired", "cancellationPassed",
        "stalePublicationPassed"
    ];
    const concurrencyBooleans = [
        "duplicateRequestsReuseWork", "cancellationRequired",
        "stalePublicationGuardRequired"
    ];
    const concurrencyIntegers = [
        "maximumActiveProjects", "maximumModelInstances",
        "maximumConcurrentInferences", "maximumQueuedPhotos"
    ];
    if (!booleanKeys.every(key => typeof source[key] === "boolean") ||
        concurrency.queueOwner !== "PhotoWorkspaceService" ||
        !concurrencyBooleans.every(key =>
            typeof concurrency[key] === "boolean"
        ) || !concurrencyIntegers.every(key =>
            nonNegativeInteger(concurrency[key]) !== null
        )) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.POLICY_MANIFEST_INVALID
        );
    }
    return {
        privacyBoundaryPassed: source.privacyBoundaryPassed,
        networkRequired: source.networkRequired,
        cancellationPassed: source.cancellationPassed,
        stalePublicationPassed: source.stalePublicationPassed,
        concurrency: { ...concurrency }
    };
}

function normalizeMetricGroup(value, keys) {
    const source = objectValue(value);
    if (!exactKeys(source, keys)) return null;
    const normalized = {};
    for (const key of keys) {
        const metric = nonNegativeInteger(source[key]);
        if (metric === null) return null;
        normalized[key] = metric;
    }
    return normalized;
}

function normalizeHostRecord(value, identity) {
    const source = objectValue(value);
    if (!exactKeys(source, [
        "schemaVersion", "candidateId", "modelDigest", "runtimeDigest",
        "platform", "executed", "documentCountUnchanged", "timings", "memory"
    ]) || source.schemaVersion !== 1 ||
        !REQUIRED_HOSTS.includes(source.platform) ||
        typeof source.executed !== "boolean" ||
        typeof source.documentCountUnchanged !== "boolean") {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.HOST_RECORD_INVALID
        );
    }
    const timings = normalizeMetricGroup(source.timings, [
        "preprocessingMs", "coldStartMs", "firstInferenceMs",
        "warmInferenceMs", "batch20Ms"
    ]);
    const memory = normalizeMetricGroup(source.memory, [
        "wasmBytes", "hostPeakDeltaBytes", "hostIdleDeltaBytes"
    ]);
    const recordIdentity = {
        candidateId: boundedIdentifier(source.candidateId, 80),
        modelDigest: sha256Digest(source.modelDigest),
        runtimeDigest: sha256Digest(source.runtimeDigest)
    };
    if (!timings || !memory || Object.values(recordIdentity).some(value => !value)) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.HOST_RECORD_INVALID
        );
    }
    if (Object.keys(identity).some(key => identity[key] !== recordIdentity[key])) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.EVIDENCE_IDENTITY_MISMATCH
        );
    }
    return {
        platform: source.platform,
        executed: source.executed,
        documentCountUnchanged: source.documentCountUnchanged,
        timings,
        memory
    };
}

function buildPhotoAiProductionEvidencePacket(value = {}) {
    const source = objectValue(value);
    if (source.schemaVersion !== PHOTO_AI_PRODUCTION_EVIDENCE_PACKET_SCHEMA) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.UNKNOWN_SCHEMA
        );
    }
    const candidate = normalizeCandidateEvidence(source.candidateEvidence);
    const runtimeCompatibility = normalizeRuntimeCompatibility(
        source.runtimeCompatibility,
        candidate.identity
    );
    const policy = normalizePolicyManifest(source.policyManifest);
    if (!Array.isArray(source.hostRecords) || source.hostRecords.length !== 2) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.HOST_RECORDS_INCOMPLETE
        );
    }
    const hosts = source.hostRecords.map(record =>
        normalizeHostRecord(record, candidate.identity)
    );
    if (new Set(hosts.map(host => host.platform)).size !== hosts.length) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.HOST_RECORD_DUPLICATE
        );
    }
    if (REQUIRED_HOSTS.some(platform =>
        !hosts.some(host => host.platform === platform)
    )) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.HOST_RECORDS_INCOMPLETE
        );
    }
    return Object.freeze({
        schemaVersion: PHOTO_AI_PRODUCTION_EVIDENCE_PACKET_SCHEMA,
        verification: Object.freeze({
            status: "VERIFIED_EVIDENCE_PACKET",
            candidateId: candidate.identity.candidateId,
            modelDigest: candidate.identity.modelDigest,
            runtimeDigest: candidate.identity.runtimeDigest,
            platforms: Object.freeze([...REQUIRED_HOSTS])
        }),
        gateInput: Object.freeze({
            schemaVersion: 1,
            candidateInventory: candidate.inventory,
            runtimeCompatibility,
            privacyBoundaryPassed: policy.privacyBoundaryPassed,
            networkRequired: policy.networkRequired,
            cancellationPassed: policy.cancellationPassed,
            stalePublicationPassed: policy.stalePublicationPassed,
            concurrency: policy.concurrency,
            hosts: Object.freeze(REQUIRED_HOSTS.map(platform =>
                hosts.find(host => host.platform === platform)
            ))
        })
    });
}

async function writeNewJson(outputPath, value) {
    try {
        await fs.promises.writeFile(
            path.resolve(outputPath),
            `${JSON.stringify(value, null, 2)}\n`,
            { encoding: "utf8", flag: "wx", mode: 0o600 }
        );
    } catch (_error) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.OUTPUT_WRITE_FAILED
        );
    }
}

async function readJson(filePath, code) {
    try {
        return JSON.parse(await fs.promises.readFile(filePath, "utf8"));
    } catch (_error) {
        throw new ProductionEvidenceError(code);
    }
}

async function runCli(argv = process.argv.slice(2)) {
    if (argv.length !== 6) {
        throw new ProductionEvidenceError(
            PhotoAiProductionEvidenceError.HOST_RECORDS_INCOMPLETE
        );
    }
    const [
        outputPath,
        candidatePath,
        compatibilityPath,
        policyPath,
        macosPath,
        windowsPath
    ] = argv;
    const packet = buildPhotoAiProductionEvidencePacket({
        schemaVersion: 1,
        candidateEvidence: await readJson(
            candidatePath,
            PhotoAiProductionEvidenceError.CANDIDATE_EVIDENCE_INVALID
        ),
        runtimeCompatibility: await readJson(
            compatibilityPath,
            PhotoAiProductionEvidenceError.RUNTIME_COMPATIBILITY_INVALID
        ),
        policyManifest: await readJson(
            policyPath,
            PhotoAiProductionEvidenceError.POLICY_MANIFEST_INVALID
        ),
        hostRecords: await Promise.all([macosPath, windowsPath].map(filePath =>
            readJson(filePath, PhotoAiProductionEvidenceError.HOST_RECORD_INVALID)
        ))
    });
    await writeNewJson(outputPath, packet);
    process.stdout.write("Photo AI production evidence packet: VERIFIED\n");
}

module.exports = {
    PHOTO_AI_PRODUCTION_EVIDENCE_PACKET_SCHEMA,
    PhotoAiProductionEvidenceError,
    ProductionEvidenceError,
    buildPhotoAiProductionEvidencePacket,
    runCli,
    writeNewJson
};

if (require.main === module) {
    runCli().catch(error => {
        const code = error instanceof ProductionEvidenceError
            ? error.code
            : PhotoAiProductionEvidenceError.UNKNOWN_SCHEMA;
        process.stderr.write(`Photo AI production evidence packet: ${code}\n`);
        process.exitCode = 1;
    });
}
