import assert from "assert";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
    CullingStatus,
    CullingFilterMode,
    normalizeCullingStatus,
    autoPickBurstBest,
    filterPhotosByCulling,
    summarizeCulling
} from "../src/services/PhotoCullingService";
import {
    normalizePhotoDecisions,
    updatePhotoDecision,
    createPhotoDecisionLookup,
    photoDecisionKey
} from "../src/services/PhotoBrowserModel";
import PhotoComparisonModal from "../src/components/PhotoComparisonModal";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export async function runAlb072Tests() {
    console.info("Starting ALB-072 Photo Culling & Comparison tests...");

    // Test 1: normalizeCullingStatus
    {
        check(normalizeCullingStatus("KEEP") === CullingStatus.KEEP, "KEEP is valid");
        check(normalizeCullingStatus("keep") === CullingStatus.KEEP, "lowercase keep normalizes");
        check(normalizeCullingStatus("REJECT") === CullingStatus.REJECT, "REJECT is valid");
        check(normalizeCullingStatus("reject") === CullingStatus.REJECT, "lowercase reject normalizes");
        check(normalizeCullingStatus("UNRATED") === CullingStatus.UNRATED, "UNRATED is valid");
        check(normalizeCullingStatus("invalid") === CullingStatus.UNRATED, "invalid string falls back to UNRATED");
        check(normalizeCullingStatus(null) === CullingStatus.UNRATED, "null falls back to UNRATED");
        check(normalizeCullingStatus(123) === CullingStatus.UNRATED, "number falls back to UNRATED");
    }

    // Test 2: PhotoBrowserModel culling persistence & normalization
    {
        const photo1 = { id: "p1", name: "Photo1.jpg", file: { nativePath: "/photos/p1.jpg" } };
        const photo2 = { id: "p2", name: "Photo2.jpg", file: { nativePath: "/photos/p2.jpg" } };

        let decisions = normalizePhotoDecisions({});
        check(decisions.items.length === 0, "Initial decisions empty");

        // Update photo 1 to KEEP
        decisions = updatePhotoDecision(decisions, photo1, { culling: CullingStatus.KEEP });
        check(decisions.items.length === 1, "Photo 1 decision saved");
        
        let lookup = createPhotoDecisionLookup(decisions);
        check(lookup(photo1).culling === CullingStatus.KEEP, "Photo 1 is KEEP");
        check(normalizeCullingStatus(lookup(photo2).culling) === CullingStatus.UNRATED, "Photo 2 is default UNRATED");

        // Update photo 2 to REJECT
        decisions = updatePhotoDecision(decisions, photo2, { culling: CullingStatus.REJECT });
        check(decisions.items.length === 2, "Photo 2 decision saved");
        
        lookup = createPhotoDecisionLookup(decisions);
        check(lookup(photo2).culling === CullingStatus.REJECT, "Photo 2 is REJECT");

        // Reset photo 1 to UNRATED without rating/favorite -> should delete entry
        decisions = updatePhotoDecision(decisions, photo1, { culling: CullingStatus.UNRATED });
        check(decisions.items.length === 1, "Photo 1 unrated decision removed from storage");
        
        lookup = createPhotoDecisionLookup(decisions);
        check(normalizeCullingStatus(lookup(photo1).culling) === CullingStatus.UNRATED, "Photo 1 is UNRATED");
    }

    // Test 3: autoPickBurstBest
    {
        const photos = [
            { id: "p1", name: "Burst1_A.jpg", qualityScore: 0.4 },
            { id: "p2", name: "Burst1_B.jpg", qualityScore: 0.9 }, // Best in Burst 1
            { id: "p3", name: "Burst1_C.jpg", qualityScore: 0.6 },
            { id: "p4", name: "Standalone.jpg", qualityScore: 0.8 },
            { id: "p5", name: "Burst2_A.jpg", qualityScore: 0.7 }, // Best in Burst 2
            { id: "p6", name: "Burst2_B.jpg", qualityScore: 0.3 }
        ];

        const bursts = [
            {
                groupId: "burst-1",
                photoIds: ["p1", "p2", "p3"],
                bestPhotoId: "p2",
                count: 3
            },
            {
                groupId: "burst-2",
                photoIds: ["p5", "p6"],
                bestPhotoId: "p5",
                count: 2
            }
        ];

        let decisions = normalizePhotoDecisions({});
        decisions = autoPickBurstBest(photos, bursts, decisions, updatePhotoDecision);

        const lookup = createPhotoDecisionLookup(decisions);
        check(lookup(photos[0]).culling === CullingStatus.REJECT, "Burst 1 photo 1 is REJECT");
        check(lookup(photos[1]).culling === CullingStatus.KEEP, "Burst 1 photo 2 (best) is KEEP");
        check(lookup(photos[2]).culling === CullingStatus.REJECT, "Burst 1 photo 3 is REJECT");
        check(normalizeCullingStatus(lookup(photos[3]).culling) === CullingStatus.UNRATED, "Standalone photo is untouched UNRATED");
        check(lookup(photos[4]).culling === CullingStatus.KEEP, "Burst 2 photo 5 (best) is KEEP");
        check(lookup(photos[5]).culling === CullingStatus.REJECT, "Burst 2 photo 6 is REJECT");
    }

    // Test 4: filterPhotosByCulling
    {
        const photos = [
            { id: "p1", name: "p1.jpg" },
            { id: "p2", name: "p2.jpg" },
            { id: "p3", name: "p3.jpg" },
            { id: "p4", name: "p4.jpg" }
        ];

        let decisions = normalizePhotoDecisions({});
        decisions = updatePhotoDecision(decisions, photos[0], { culling: CullingStatus.KEEP });
        decisions = updatePhotoDecision(decisions, photos[1], { culling: CullingStatus.KEEP });
        decisions = updatePhotoDecision(decisions, photos[2], { culling: CullingStatus.REJECT });

        const lookup = createPhotoDecisionLookup(decisions);

        const all = filterPhotosByCulling(photos, CullingFilterMode.ALL, lookup);
        check(all.length === 4, `ALL filter returns 4 photos (got ${all.length})`);

        const kept = filterPhotosByCulling(photos, CullingFilterMode.KEPT, lookup);
        check(kept.length === 2, `KEPT filter returns 2 photos (got ${kept.length})`);
        check(kept[0].id === "p1" && kept[1].id === "p2", "KEPT returns correct photos");

        const rejected = filterPhotosByCulling(photos, CullingFilterMode.REJECTED, lookup);
        check(rejected.length === 1, `REJECTED filter returns 1 photo (got ${rejected.length})`);
        check(rejected[0].id === "p3", "REJECTED returns p3");

        const unrated = filterPhotosByCulling(photos, CullingFilterMode.UNRATED, lookup);
        check(unrated.length === 1, `UNRATED filter returns 1 photo (got ${unrated.length})`);
        check(unrated[0].id === "p4", "UNRATED returns p4");
    }

    // Test 5: summarizeCulling
    {
        const photos = [
            { id: "p1" }, { id: "p2" }, { id: "p3" }, { id: "p4" }, { id: "p5" }
        ];
        let decisions = normalizePhotoDecisions({});
        decisions = updatePhotoDecision(decisions, photos[0], { culling: CullingStatus.KEEP });
        decisions = updatePhotoDecision(decisions, photos[1], { culling: CullingStatus.KEEP });
        decisions = updatePhotoDecision(decisions, photos[2], { culling: CullingStatus.REJECT });

        const bursts = [{ groupId: "b1", bestPhotoId: "p2" }];
        const summary = summarizeCulling(photos, createPhotoDecisionLookup(decisions), bursts);

        check(summary.total === 5, `Total count is 5 (got ${summary.total})`);
        check(summary.kept === 2, `Kept count is 2 (got ${summary.kept})`);
        check(summary.rejected === 1, `Rejected count is 1 (got ${summary.rejected})`);
        check(summary.unrated === 2, `Unrated count is 2 (got ${summary.unrated})`);
        check(summary.ready === false, "Cull is incomplete while photos remain unrated");
        check(summary.burstCount === 1, "Burst count is 1");
        check(summary.burstBestCount === 1, "Burst best count is 1");

        decisions = updatePhotoDecision(decisions, photos[3], { culling: CullingStatus.REJECT });
        decisions = updatePhotoDecision(decisions, photos[4], { culling: CullingStatus.KEEP });
        const complete = summarizeCulling(photos, createPhotoDecisionLookup(decisions));
        check(complete.ready === true, "Cull completes after every photo is decided and at least one is kept");

        const allRejected = photos.reduce(
            (current, photo) => updatePhotoDecision(current, photo, { culling: CullingStatus.REJECT }),
            normalizePhotoDecisions({})
        );
        check(summarizeCulling(photos, createPhotoDecisionLookup(allRejected)).ready === false, "Cull cannot complete when every photo is rejected");
    }

    // Test 6: PhotoComparisonModal rendering
    {
        const photoA = {
            id: "pA",
            name: "Comparison_Left.jpg",
            width: 4000,
            height: 3000,
            qualityScore: 0.85,
            aiAnalysis: {
                aggregate: { rankScore: 0.85 },
                signals: [
                    { signalId: "sharpness_v1", score: 0.88 },
                    { signalId: "exposure_v1", score: 0.90 },
                    { signalId: "contrast_v1", score: 0.75 }
                ]
            }
        };

        const photoB = {
            id: "pB",
            name: "Comparison_Right.jpg",
            width: 4000,
            height: 3000,
            qualityScore: 0.65,
            aiAnalysis: {
                aggregate: { rankScore: 0.65 },
                signals: [
                    { signalId: "sharpness_v1", score: 0.60 },
                    { signalId: "exposure_v1", score: 0.70 },
                    { signalId: "contrast_v1", score: 0.65 }
                ]
            }
        };

        const html = ReactDOMServer.renderToStaticMarkup(
            <PhotoComparisonModal
                photoA={photoA}
                photoB={photoB}
                onClose={() => {}}
                onPickKeep={() => {}}
            />
        );

        check(typeof html === "string" && html.length > 0, "Comparison modal rendered to HTML");
        check(html.includes("Side-by-Side Comparison"), "Contains modal title");
        check(html.includes("Comparison_Left.jpg"), "Contains photo A name");
        check(html.includes("Comparison_Right.jpg"), "Contains photo B name");
        check(html.includes("Sharpness"), "Contains Sharpness metric");
        check(html.includes("Exposure"), "Contains Exposure metric");
        check(html.includes("Keep This Photo"), "Contains Keep button");
    }

    console.info(`PASS ALB-072: All assertions passed (${assertions} assertions).`);
}

runAlb072Tests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
