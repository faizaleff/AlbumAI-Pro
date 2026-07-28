import ExecutionPlan from "./ExecutionPlan";

export default class PlacementExecutionPlanBuilder {

    build({ placementResult, project, template, photos = [] } = {}) {

        this.requirePlacementResult(placementResult);
        this.validateContext(placementResult, project, template);

        const photoById = new Map(
            (Array.isArray(photos) ? photos : [])
                .filter(photo => photo?.id != null)
                .map(photo => [photo.id, photo])
        );
        const slotById = new Map(
            (Array.isArray(template.smartObjects) ? template.smartObjects : [])
                .filter(slot => slot?.layerId != null)
                .map(slot => [slot.layerId, slot])
        );
        const assignments = Array.isArray(placementResult.assignments)
            ? placementResult.assignments
            : [];
        const seenSlots = new Set();
        const seenPhotos = new Set();
        const warnings = Array.isArray(placementResult.warnings)
            ? placementResult.warnings.map(warning => ({ ...warning }))
            : [];
        const allowReuse = placementResult.options?.allowReuse === true;
        const orderedAssignments = assignments
            .map((assignment, slotOrder) => ({ assignment, slotOrder }))
            .sort((left, right) => this.compareAssignments(left, right));
        const steps = orderedAssignments.map(({ assignment }, index) => {

            const slotLayerId = assignment?.slotLayerId ?? assignment?.layerId;
            const photoId = assignment?.photoId;

            if (slotLayerId == null || !slotById.has(slotLayerId)) {
                throw new Error("Placement assignment references an invalid slotLayerId.");
            }

            if (seenSlots.has(slotLayerId)) {
                throw new Error("Placement plan contains duplicate slot assignments.");
            }

            if (photoId == null || !photoById.has(photoId)) {
                throw new Error("Placement assignment references a missing photo.");
            }

            if (!allowReuse && seenPhotos.has(photoId)) {
                throw new Error("Placement plan reuses a photo without reuse enabled.");
            }

            seenSlots.add(slotLayerId);
            seenPhotos.add(photoId);

            const slot = slotById.get(slotLayerId);
            const photo = photoById.get(photoId);
            const photoFileReference = this.photoFileReference(photo);

            if (photoFileReference == null) {
                warnings.push({
                    type: "MISSING_PHOTO_FILE_REFERENCE",
                    photoId,
                    message: "Photo has no serializable file reference."
                });
            }

            return {
                order: index + 1,
                documentId: template.document.id,
                slotLayerId,
                slotName: slot.layerName || assignment.layerName || "",
                photoId,
                photoName: photo.name || assignment.photoName || "",
                photoFileReference,
                fitMode: assignment.fitMode || "fill",
                score: Number.isFinite(assignment.score) ? assignment.score : null,
                reasons: this.reasons(assignment)
            };

        });

        const createdAt = new Date().toISOString();

        return new ExecutionPlan({
            id: this.id(placementResult, createdAt),
            projectId: placementResult.projectId,
            templateId: placementResult.templateId,
            templateDocumentId: placementResult.templateDocumentId,
            steps,
            warnings,
            statistics: {
                readySteps: steps.length,
                warningCount: warnings.length,
                reusedPhotos: this.reusedPhotoCount(steps)
            },
            createdAt
        });

    }

    validateContext(placementResult, project, template) {

        if (!project) throw new Error("An active project is required.");
        if (!template) throw new Error("A current template is required.");

        const projectId = project.metadata?.id ?? project.metadata?.name ?? null;
        const templateDocumentId = template.document?.id ?? null;

        if (placementResult.projectId !== projectId) {
            throw new Error("Placement plan does not match the active project.");
        }

        if (placementResult.templateId !== template.id) {
            throw new Error("Placement plan does not match the current template.");
        }

        if (placementResult.templateDocumentId !== templateDocumentId) {
            throw new Error("Placement plan does not match the current template document.");
        }

    }

    requirePlacementResult(placementResult) {

        if (!placementResult) {
            throw new Error("A placement plan is required.");
        }

    }

    compareAssignments(left, right) {

        if (left.slotOrder !== right.slotOrder) {
            return left.slotOrder - right.slotOrder;
        }

        const leftLayerId = left.assignment?.slotLayerId ?? left.assignment?.layerId;
        const rightLayerId = right.assignment?.slotLayerId ?? right.assignment?.layerId;

        return String(leftLayerId).localeCompare(String(rightLayerId), undefined, {
            numeric: true,
            sensitivity: "base"
        });

    }

    photoFileReference(photo) {

        return photo?.file?.nativePath || photo?.file?.name || null;

    }

    reasons(assignment) {

        if (Array.isArray(assignment.reasons)) {
            return assignment.reasons.filter(reason =>
                typeof reason === "string"
            );
        }

        if (
            assignment.slotOrientation === assignment.photoOrientation &&
            assignment.slotOrientation !== "unknown"
        ) {
            return ["ORIENTATION_MATCH"];
        }

        if (
            assignment.slotOrientation !== "unknown" &&
            assignment.photoOrientation !== "unknown"
        ) {
            return ["ORIENTATION_FALLBACK"];
        }

        return ["ORIENTATION_UNKNOWN"];

    }

    reusedPhotoCount(steps) {

        return steps.length - new Set(steps.map(step => step.photoId)).size;

    }

    id(placementResult, createdAt) {

        return [
            "execution-plan",
            placementResult.templateId,
            placementResult.templateDocumentId,
            createdAt
        ].join(":");

    }

}
