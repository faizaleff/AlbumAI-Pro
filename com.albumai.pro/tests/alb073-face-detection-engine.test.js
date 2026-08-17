import assert from "assert";
import React from "react";
import ReactDOMServer from "react-dom/server";
import {
    isSkinColor,
    detectFaces,
    computeOptimalCropFocus
} from "../src/services/PhotoFaceDetectionEngine";
import {
    generateAutoFlowSpreads,
    AutoFlowStrategy
} from "../src/services/PhotoAutoFlowEngine";
import SpreadCanvas from "../src/components/SpreadCanvas";

let assertions = 0;

function check(condition, message) {
    assertions += 1;
    if (!condition) {
        throw new Error(message || "Assertion failed");
    }
}

export async function runAlb073Tests() {
    console.info("Starting ALB-073 Face Detection & Facial Horizon Centering tests...");

    // Test 1: isSkinColor chrominance classification
    {
        // Typical skin tones
        check(isSkinColor(215, 165, 130) === true, "Skin tone 1 is classified as skin");
        check(isSkinColor(180, 130, 100) === true, "Skin tone 2 is classified as skin");
        check(isSkinColor(140, 95, 75) === true, "Skin tone 3 is classified as skin");

        // Non-skin colors
        check(isSkinColor(0, 0, 0) === false, "Black is not skin");
        check(isSkinColor(255, 255, 255) === false, "White is not skin");
        check(isSkinColor(20, 200, 20) === false, "Green is not skin");
        check(isSkinColor(20, 20, 220) === false, "Blue is not skin");
        check(isSkinColor(100, 100, 100) === false, "Gray is not skin");
    }

    // Test 2: detectFaces on synthetic pixel buffer
    {
        const emptyResult = detectFaces(null, 0, 0);
        check(emptyResult.faceCount === 0, "Empty buffer returns 0 faces");
        check(emptyResult.primaryFace === null, "Primary face is null for empty buffer");

        // Create 64x64 RGBA buffer with a centered skin rectangle (representing a face)
        const width = 64;
        const height = 64;
        const rgba = new Uint8Array(width * height * 4);

        // Fill background with dark gray (non-skin)
        for (let i = 0; i < rgba.length; i += 4) {
            rgba[i] = 40;
            rgba[i + 1] = 40;
            rgba[i + 2] = 40;
            rgba[i + 3] = 255;
        }

        // Draw skin patch between y: 16..36, x: 20..44 (top-middle)
        for (let y = 16; y <= 36; y++) {
            for (let x = 20; x <= 44; x++) {
                const idx = (y * width + x) * 4;
                rgba[idx] = 215;     // R
                rgba[idx + 1] = 165; // G
                rgba[idx + 2] = 130; // B
                rgba[idx + 3] = 255; // A
            }
        }

        const detected = detectFaces(rgba, width, height);
        check(detected.faceCount >= 1, "Detected skin cluster face candidate");
        check(detected.primaryFace !== null, "Primary face object is populated");
        check(detected.primaryFace.centerY < 0.6, "Face is in upper half of image");
        check(detected.primaryFace.confidence > 0.5, "Confidence score is high");
    }

    // Test 3: computeOptimalCropFocus without faces
    {
        // Portrait photo without faces -> defaults to top
        const portraitFocus = computeOptimalCropFocus([], 3000, 4500);
        check(portraitFocus.cropFocus === "top", "Portrait photo defaults to top focus");
        check(portraitFocus.hasFaces === false, "hasFaces is false");

        // Landscape photo without faces -> defaults to center
        const landscapeFocus = computeOptimalCropFocus([], 4500, 3000);
        check(landscapeFocus.cropFocus === "center", "Landscape photo defaults to center focus");
    }

    // Test 4: computeOptimalCropFocus with faces
    {
        // Face in top portion
        const topFace = [{ x: 0.35, y: 0.10, width: 0.3, height: 0.3, centerX: 0.5, centerY: 0.25, confidence: 0.9 }];
        const topFocus = computeOptimalCropFocus(topFace, 4000, 3000);
        check(topFocus.cropFocus === "top", "Top face resolves to cropFocus 'top'");
        check(topFocus.hasFaces === true, "hasFaces is true");
        check(topFocus.focalY === 0.25, "focalY is 0.25");

        // Face in bottom portion
        const bottomFace = [{ x: 0.35, y: 0.65, width: 0.3, height: 0.3, centerX: 0.5, centerY: 0.80, confidence: 0.9 }];
        const bottomFocus = computeOptimalCropFocus(bottomFace, 4000, 3000);
        check(bottomFocus.cropFocus === "bottom", "Bottom face resolves to cropFocus 'bottom'");

        // Face on left portion
        const leftFace = [{ x: 0.05, y: 0.35, width: 0.25, height: 0.25, centerX: 0.175, centerY: 0.475, confidence: 0.9 }];
        const leftFocus = computeOptimalCropFocus(leftFace, 4000, 3000);
        check(leftFocus.cropFocus === "left", "Left face resolves to cropFocus 'left'");

        // Face on right portion
        const rightFace = [{ x: 0.70, y: 0.35, width: 0.25, height: 0.25, centerX: 0.825, centerY: 0.475, confidence: 0.9 }];
        const rightFocus = computeOptimalCropFocus(rightFace, 4000, 3000);
        check(rightFocus.cropFocus === "right", "Right face resolves to cropFocus 'right'");

        // Centered face
        const centerFace = [{ x: 0.35, y: 0.35, width: 0.3, height: 0.3, centerX: 0.5, centerY: 0.5, confidence: 0.9 }];
        const centerFocus = computeOptimalCropFocus(centerFace, 4000, 3000);
        check(centerFocus.cropFocus === "center", "Centered face resolves to cropFocus 'center'");
    }

    // Test 5: PhotoAutoFlowEngine Face-Aware Crop Focus Assignment
    {
        const photos = [
            {
                id: "p-face-left",
                name: "LeftSubject.jpg",
                width: 4000,
                height: 3000,
                faces: [{ x: 0.05, y: 0.35, width: 0.25, height: 0.25, centerX: 0.175, centerY: 0.475, confidence: 0.95 }]
            },
            {
                id: "p-face-top",
                name: "TopSubject.jpg",
                width: 4000,
                height: 3000,
                faces: [{ x: 0.35, y: 0.10, width: 0.3, height: 0.3, centerX: 0.5, centerY: 0.25, confidence: 0.95 }]
            }
        ];

        const templates = [
            { id: "t1", name: "2-Up", smartObjects: [{ layerId: 101 }, { layerId: 102 }] }
        ];

        const autoFlowResult = generateAutoFlowSpreads({
            photos,
            templates,
            options: { strategy: AutoFlowStrategy.BALANCED, maxPhotosPerSpread: 2 }
        });

        check(autoFlowResult.success === true, "Auto flow succeeded");
        check(autoFlowResult.sheets.length === 1, "Generated 1 sheet");
        const slots = autoFlowResult.sheets[0].slots;
        check(slots.length === 2, "Generated 2 slot assignments");

        const leftSlot = slots.find(s => s.photoId === "p-face-left");
        const topSlot = slots.find(s => s.photoId === "p-face-top");
        check(leftSlot && leftSlot.cropFocus === "left", "Left face photo assigned 'left' crop focus in auto-flow");
        check(topSlot && topSlot.cropFocus === "top", "Top face photo assigned 'top' crop focus in auto-flow");
    }

    // Test 6: SpreadCanvas Rendering with Face Badge
    {
        const assignedPhoto = {
            id: "p1",
            name: "BrideGroom.jpg",
            faces: [
                { x: 0.3, y: 0.2, width: 0.2, height: 0.2 },
                { x: 0.5, y: 0.2, width: 0.2, height: 0.2 }
            ]
        };

        const sheet = {
            id: "sheet-1",
            templateId: "t1",
            label: "Portraits",
            slots: [{ slotId: 1, photoId: "p1", cropFocus: "top" }]
        };

        const template = {
            id: "t1",
            name: "1-Up",
            smartObjects: [{ layerId: 1, layerName: "Main Portrait" }]
        };

        const html = ReactDOMServer.renderToStaticMarkup(
            <SpreadCanvas
                sheet={sheet}
                template={template}
                photos={[assignedPhoto]}
            />
        );

        check(typeof html === "string" && html.length > 0, "SpreadCanvas rendered to HTML");
        check(html.includes("👤 2"), "Contains face count badge indicator '👤 2'");
        check(html.includes("spread-slot-face-badge"), "Contains face badge CSS class");
    }

    console.info(`PASS ALB-073: All assertions passed (${assertions} assertions).`);
}

runAlb073Tests().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
