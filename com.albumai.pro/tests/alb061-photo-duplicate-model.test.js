import assert from "assert";
import crypto from "crypto";

import PhotoWorkspaceService from "../src/services/PhotoWorkspaceService";
import {
    analyzeExactPhotoDuplicates,
    normalizePhotoDuplicateEvidence,
    PhotoDuplicateStatus,
    reconcilePhotoDuplicateEvidence,
    sha256Fingerprint
} from "../src/services/PhotoDuplicateModel";
import {
    hasActivePhotoBrowserFilters,
    queryPhotoBrowser
} from "../src/services/PhotoBrowserModel";

let assertions = 0;

async function test(name, callback) {
    await callback();
    assertions += 1;
    console.info(`PASS ALB-061 Slice 2: ${name}`);
}

function binary(value) {
    return new Uint8Array([...value].map(character =>
        character.charCodeAt(0)
    ));
}

function photo(name, content, values = {}) {
    return {
        id: `/fixtures/${name}`,
        name,
        fileSize: content.length,
        modified: 100,
        content,
        ...values
    };
}

function workspaceFixture({ deferRead = false } = {}) {
    const photos = [photo("a.jpg", "same"), photo("b.jpg", "same")];
    let metadata = {
        id: "project-one",
        name: "Project One",
        schemaVersion: 1
    };
    let saveFailure = false;
    let readCalls = 0;
    let releaseRead;
    const saved = [];
    const projectEngine = {
        isOpen: () => true,
        getProject: () => ({ metadata }),
        updateMetadata: values => { metadata = { ...values }; }
    };
    const service = new PhotoWorkspaceService({
        library: { getPhotos: () => photos, load: () => {} },
        selection: {},
        projectEngine,
        projectService: {
            saveProject: async (values, options) => {
                metadata = { ...metadata, ...values };
                if (saveFailure) throw new Error("Injected save failure.");
                saved.push({ values, options });
            }
        },
        localFileSystem: {},
        thumbnailService: {},
        thumbnailQueue: {},
        refreshService: { refresh() {} },
        performance: {},
        duplicateSource: {
            readBinary: candidate => {
                readCalls += 1;
                if (!deferRead) return binary(candidate.content);
                return new Promise(resolve => { releaseRead = resolve; });
            }
        }
    });
    return {
        service,
        photos,
        saved,
        metadata: () => metadata,
        setProjectId: id => { metadata = { ...metadata, id }; },
        failSave: value => { saveFailure = value; },
        readCalls: () => readCalls,
        releaseRead: value => releaseRead?.(value)
    };
}

async function run() {
    await test("implements the locked SHA-256 content fingerprint", () => {
        assert.strictEqual(
            sha256Fingerprint(binary("abc")),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert.strictEqual(sha256Fingerprint("abc"), null);
        for (const length of [0, 1, 55, 56, 63, 64, 65, 1000]) {
            const bytes = new Uint8Array(length);
            for (let index = 0; index < length; index++) {
                bytes[index] = index % 251;
            }
            const expected = crypto.createHash("sha256")
                .update(Buffer.from(bytes))
                .digest("hex");
            assert.strictEqual(sha256Fingerprint(bytes), expected);
        }
        const offset = new Uint8Array([9, 97, 98, 99, 9]).subarray(1, 4);
        assert.strictEqual(
            sha256Fingerprint(offset),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
    });

    await test("reads only same-size candidates and groups exact bytes", async () => {
        const photos = [
            photo("a.jpg", "same"),
            photo("b.jpg", "same"),
            photo("c.jpg", "diff"),
            photo("unique.jpg", "longer")
        ];
        const reads = [];
        const evidence = await analyzeExactPhotoDuplicates(photos, {
            readBinary: candidate => {
                reads.push(candidate.name);
                return binary(candidate.content);
            }
        });
        assert.strictEqual(evidence.status, PhotoDuplicateStatus.COMPLETE);
        assert.strictEqual(evidence.candidatePhotos, 3);
        assert.strictEqual(evidence.fingerprintedPhotos, 3);
        assert.strictEqual(evidence.groups.length, 1);
        assert.strictEqual(evidence.groups[0].members.length, 2);
        assert.strictEqual(evidence.potentialSavingsBytes, 4);
        assert.match(evidence.libraryKey, /^l1-[0-9a-f]{16}$/);
        assert(!reads.includes("unique.jpg"));
    });

    await test("does not treat matching metadata as duplicate proof", async () => {
        const evidence = await analyzeExactPhotoDuplicates([
            photo("same-name.jpg", "one!", { id: "/one/same-name.jpg" }),
            photo("same-name.jpg", "two!", { id: "/two/same-name.jpg" })
        ], { readBinary: candidate => binary(candidate.content) });
        assert.strictEqual(evidence.groups.length, 0);
        assert.strictEqual(evidence.fingerprintedPhotos, 2);
    });

    await test("is deterministic across input order", async () => {
        const photos = [
            photo("z.jpg", "same"),
            photo("a.jpg", "same"),
            photo("m.jpg", "same")
        ];
        const options = {
            readBinary: candidate => binary(candidate.content)
        };
        const first = await analyzeExactPhotoDuplicates(photos, options);
        const second = await analyzeExactPhotoDuplicates(
            [...photos].reverse(), options
        );
        assert.deepStrictEqual(first, second);
    });

    await test("fails closed for unreadable and changed candidates", async () => {
        const unreadable = photo("unreadable.jpg", "same");
        const changed = photo("changed.jpg", "same");
        const evidence = await analyzeExactPhotoDuplicates([
            unreadable,
            changed
        ], {
            readBinary: candidate => {
                if (candidate === unreadable) throw new Error("denied");
                return binary("changed-size");
            }
        });
        assert.strictEqual(evidence.status, PhotoDuplicateStatus.PARTIAL);
        assert.strictEqual(evidence.groups.length, 0);
        assert.deepStrictEqual(
            evidence.failures.map(item => item.reason).sort(),
            ["CHANGED_DURING_ANALYSIS", "READ_FAILED"]
        );
    });

    await test("rejects stale work before publication", async () => {
        let current = true;
        const evidence = await analyzeExactPhotoDuplicates([
            photo("a.jpg", "same"),
            photo("b.jpg", "same")
        ], {
            readBinary: candidate => {
                current = false;
                return binary(candidate.content);
            },
            isCurrent: () => current
        });
        assert.deepStrictEqual(evidence, normalizePhotoDuplicateEvidence({
            status: PhotoDuplicateStatus.STALE
        }));
    });

    await test("normalizes malformed persisted evidence without paths", () => {
        const normalized = normalizePhotoDuplicateEvidence({
            status: "COMPLETE",
            candidatePhotos: Infinity,
            groups: [{
                groupId: "invalid-path",
                byteSize: 5,
                members: [{ photoKey: "/secret/a.jpg" }]
            }],
            failures: [{ photoKey: "/secret/b.jpg", reason: "READ_FAILED" }]
        });
        assert.strictEqual(normalized.candidatePhotos, 0);
        assert.deepStrictEqual(normalized.groups, []);
        assert.deepStrictEqual(normalized.failures, []);
        assert(!JSON.stringify(normalized).includes("/secret"));
        assert(Object.isFrozen(normalized));
    });

    await test("bounds persisted duplicate members to the photo ceiling", () => {
        const members = Array.from({ length: 20001 }, (_, index) => ({
            photoKey: `p1-${index.toString(16).padStart(16, "0")}`,
            revisionKey: `r1-${index.toString(16).padStart(16, "0")}`
        }));
        const normalized = normalizePhotoDuplicateEvidence({
            groups: [{
                groupId: "d1-0000000000000001",
                byteSize: Number.MAX_SAFE_INTEGER,
                members
            }]
        });
        assert.strictEqual(normalized.groups[0].members.length, 20000);
        assert.strictEqual(
            normalized.potentialSavingsBytes,
            Number.MAX_SAFE_INTEGER
        );
    });

    await test("reconciles only unchanged opaque member revisions", async () => {
        const photos = [photo("a.jpg", "same"), photo("b.jpg", "same")];
        const evidence = await analyzeExactPhotoDuplicates(photos, {
            readBinary: candidate => binary(candidate.content)
        });
        assert.strictEqual(
            reconcilePhotoDuplicateEvidence(evidence, photos).status,
            PhotoDuplicateStatus.COMPLETE
        );
        const changed = [{ ...photos[0], modified: 200 }, photos[1]];
        const stale = reconcilePhotoDuplicateEvidence(evidence, changed);
        assert.strictEqual(stale.status, PhotoDuplicateStatus.STALE);
        assert.strictEqual(stale.groups.length, 0);
        assert.strictEqual(
            reconcilePhotoDuplicateEvidence(evidence, photos.slice(0, 1)).status,
            PhotoDuplicateStatus.STALE
        );
    });

    await test("persists evidence through the canonical Photo owner", async () => {
        const state = workspaceFixture();
        const evidence = await state.service.analyzePhotoDuplicates();
        assert.strictEqual(evidence.status, PhotoDuplicateStatus.COMPLETE);
        assert.strictEqual(state.saved.length, 1);
        assert.strictEqual(
            state.saved[0].options.reason,
            "PHOTO_DUPLICATE_ANALYSIS"
        );
        assert.deepStrictEqual(
            state.metadata().photoDuplicateEvidence,
            evidence
        );
        assert.deepStrictEqual(
            state.service.getPhotoDuplicateEvidence(),
            evidence
        );
    });

    await test("shares one in-flight analysis for duplicate actions", async () => {
        const state = workspaceFixture({ deferRead: true });
        const first = state.service.analyzePhotoDuplicates();
        const second = state.service.analyzePhotoDuplicates();
        assert.strictEqual(first, second);
        assert.strictEqual(state.readCalls(), 1);
        state.releaseRead(binary("same"));
        await Promise.resolve();
        await Promise.resolve();
        state.releaseRead(binary("same"));
        await Promise.all([first, second]);
        assert.strictEqual(state.saved.length, 1);
    });

    await test("does not publish analysis after project identity changes", async () => {
        const state = workspaceFixture({ deferRead: true });
        const pending = state.service.analyzePhotoDuplicates();
        state.setProjectId("project-two");
        state.releaseRead(binary("same"));
        const evidence = await pending;
        assert.strictEqual(evidence.status, PhotoDuplicateStatus.STALE);
        assert.strictEqual(state.saved.length, 0);
        assert.strictEqual(
            state.service.getPhotoDuplicateEvidence().status,
            PhotoDuplicateStatus.NOT_STARTED
        );
    });

    await test("rolls evidence back after persistence failure", async () => {
        const state = workspaceFixture();
        const previous = state.service.getPhotoDuplicateEvidence();
        state.failSave(true);
        await assert.rejects(
            state.service.analyzePhotoDuplicates(),
            /Injected save failure/
        );
        assert.deepStrictEqual(
            state.service.getPhotoDuplicateEvidence(),
            previous
        );
        assert.deepStrictEqual(
            state.metadata().photoDuplicateEvidence,
            previous
        );
    });

    await test("projects duplicate members through canonical browser filters", async () => {
        const photos = [
            photo("a.jpg", "same"),
            photo("b.jpg", "same"),
            photo("unique.jpg", "longer")
        ];
        const evidence = await analyzeExactPhotoDuplicates(photos, {
            readBinary: candidate => binary(candidate.content)
        });
        const result = queryPhotoBrowser(photos, {
            duplicatesOnly: true,
            search: "b"
        }, { duplicateEvidence: evidence });
        assert.deepStrictEqual(result.photos.map(item => item.name), ["b.jpg"]);
        assert.strictEqual(
            hasActivePhotoBrowserFilters({ duplicatesOnly: true }),
            true
        );
        assert.strictEqual(photos[0].duplicateGroup, undefined);
    });

    console.info(
        `ALB-061 duplicate model tests complete: ${assertions} assertions.`
    );
}

run().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
