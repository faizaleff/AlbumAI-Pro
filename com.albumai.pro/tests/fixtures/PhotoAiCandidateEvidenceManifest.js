import {
    completePhotoAiCandidateInventory
} from "./PhotoAiCandidateFixture";

export function completePhotoAiCandidateEvidenceManifest(filePaths) {
    const inventory = completePhotoAiCandidateInventory();
    return {
        schemaVersion: 1,
        candidate: {
            candidateId: inventory.candidate.candidateId,
            modelVersion: inventory.candidate.modelVersion,
            providerKind: inventory.candidate.providerKind,
            sourceUrl: inventory.candidate.sourceUrl
        },
        artifacts: inventory.artifacts.map(artifact => ({
            kind: artifact.kind,
            artifactId: artifact.artifactId,
            sourceUrl: artifact.sourceUrl,
            filePath: filePaths[artifact.kind]
        })),
        licensing: inventory.licensing,
        review: inventory.review
    };
}
