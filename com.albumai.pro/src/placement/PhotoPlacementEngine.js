import BalancedOrientationStrategy from "./BalancedOrientationStrategy";
import PlacementResult from "./PlacementResult";
import PhotoAssignmentService from "./PhotoAssignmentService";
import Logger from "../core/photoshop/Logger";

export default class PhotoPlacementEngine {

    constructor({
        strategy = new BalancedOrientationStrategy(),
        photoAssignmentService = new PhotoAssignmentService()
    } = {}) {

        this.strategy = strategy;
        this.photoAssignmentService = photoAssignmentService;

    }

    plan({ project, photos = [], template, options = {} } = {}) {

        this.requireProject(project);
        this.requireTemplate(template);

        const inputPhotos = Array.isArray(photos) ? photos : [];
        const placementOptions = options && typeof options === "object"
            ? options
            : {};
        const warnings = this.templateWarnings(template);
        const selectedPhotos = inputPhotos.filter(photo => photo?.selected);
        const isMultiPhoto = selectedPhotos.length > 1 || inputPhotos.length > 1;
        let slots = isMultiPhoto
            ? this.assignmentSlots(template)
            : this.slots(template, warnings);

        if (!slots.length) {
            slots = this.assignmentSlots(template);
        }

        Logger.info(
            `Placement planner: photos=${inputPhotos.length}, selected photos=${selectedPhotos.length}, smart object slots=${slots.length}.`
        );

        if (!slots.length) {
            throw new Error("No valid Smart Object slots remain.");
        }

        const candidates = this.photos(inputPhotos, warnings);

        if (!candidates.length) {
            throw new Error("No eligible photos remain.");
        }

        const allowReuse = placementOptions.allowReuse === true;
        const usedPhotoIds = new Set();
        let assignments = [];
        let emptySlots = [];

        if (isMultiPhoto) {
            const photoCount = candidates.length;
            if (photoCount > slots.length) {
                warnings.push({
                    type: "EXCESS_SELECTED_PHOTOS",
                    message: `Using ${slots.length} selected photos for ${slots.length} Smart Object slots; ${photoCount - slots.length} selected photos were not assigned.`,
                    selectedPhotos: photoCount,
                    availableSlots: slots.length
                });
            }
            Logger.info("Placement planner: sequential multi-photo assignment.");
            const assignmentList = this.photoAssignmentService.assign({
                photos: candidates,
                slots,
                templateId: template.id
            });
            Logger.info(
                `Placement planner: PhotoAssignmentService assignments=${assignmentList.length}.`
            );
            const candidateById = new Map(candidates.map(photo => [photo.id, photo]));
            const slotById = new Map(slots.map(slot => [slot.layerId, slot]));

            assignments = assignmentList.map(assignment => {
                const photo = candidateById.get(assignment.photoId);
                const slot = slotById.get(assignment.slotId);

                return {
                    layerId: assignment.slotId,
                    layerName: assignment.slotName,
                    parentGroupId: slot?.parentGroupId ?? null,
                    photoId: assignment.photoId,
                    photoName: photo?.name || "",
                    fitMode: assignment.fitMode,
                    score: null,
                    slotOrientation: slot?.orientation ?? "unknown",
                    photoOrientation: photo?.orientation ?? "unknown",
                    aspectRatioDistance: null
                };
            });
            const assignedSlotIds = new Set(assignments.map(item => item.layerId));
            const assignedPhotoIds = new Set(assignments.map(item => item.photoId));

            emptySlots = slots
                .filter(slot => !assignedSlotIds.has(slot.layerId))
                .map(slot => ({
                    layerId: slot.layerId,
                    layerName: slot.layerName,
                    reason: "NO_SELECTED_PHOTO"
                }));
            candidates.forEach(photo => usedPhotoIds.add(photo.id));

            const unassignedPhotos = candidates
                .filter(photo => !assignedPhotoIds.has(photo.id))
                .map(photo => this.photoReference(photo));

            Logger.info(
                `Placement planner: PlacementResult assignments=${assignments.length}.`
            );

            return this.result({
                project,
                template,
                assignments,
                emptySlots,
                unassignedPhotos,
                warnings,
                slots,
                candidates,
                allowReuse
            });
        }

        Logger.info("Placement planner: geometry-scoring fallback.");

        for (const slot of slots) {

            const eligible = candidates
                .filter(photo => allowReuse || !usedPhotoIds.has(photo.id))
                .map(photo => ({
                    photo,
                    score: this.strategy.score(
                        slot,
                        photo,
                        usedPhotoIds.has(photo.id)
                    )
                }))
                .sort((left, right) => this.compareCandidates(left, right));
            const match = eligible[0];

            if (!match) {
                emptySlots.push({
                    layerId: slot.layerId,
                    layerName: slot.layerName,
                    reason: "NO_ELIGIBLE_PHOTO"
                });
                continue;
            }

            usedPhotoIds.add(match.photo.id);
            assignments.push({
                layerId: slot.layerId,
                layerName: slot.layerName,
                parentGroupId: slot.parentGroupId,
                photoId: match.photo.id,
                photoName: match.photo.name,
                score: match.score,
                slotOrientation: slot.orientation,
                photoOrientation: match.photo.orientation,
                aspectRatioDistance: this.strategy.aspectDistance(
                    slot.aspectRatio,
                    match.photo.aspectRatio
                )
            });

        }

        const unassignedPhotos = candidates
            .filter(photo => !usedPhotoIds.has(photo.id))
            .map(photo => this.photoReference(photo));

        Logger.info(
            `Placement planner: PlacementResult assignments=${assignments.length}.`
        );

        return this.result({
            project,
            template,
            assignments,
            emptySlots,
            unassignedPhotos,
            warnings,
            slots,
            candidates,
            allowReuse
        });

    }

    result({
        project,
        template,
        assignments,
        emptySlots,
        unassignedPhotos,
        warnings,
        slots,
        candidates,
        allowReuse
    }) {

        return new PlacementResult({
            projectId: project.metadata?.id ?? project.metadata?.name ?? null,
            templateId: template.id,
            templateDocumentId: template.document?.id ?? null,
            assignments,
            emptySlots,
            unassignedPhotos,
            warnings,
            statistics: {
                totalSlots: slots.length,
                totalEligiblePhotos: candidates.length,
                assignedSlots: assignments.length,
                emptySlots: emptySlots.length,
                unassignedPhotos: unassignedPhotos.length,
                reusedPhotos: this.reusedCount(assignments),
                portraitAssignments: this.orientationCount(assignments, "portrait"),
                landscapeAssignments: this.orientationCount(assignments, "landscape"),
                squareAssignments: this.orientationCount(assignments, "square"),
                orientationMatches: assignments.filter(item =>
                    item.slotOrientation === item.photoOrientation &&
                    item.slotOrientation !== "unknown"
                ).length
            },
            options: { allowReuse }
        });

    }

    slots(template, warnings) {

        const treeOrder = this.treeOrder(template.layerTree);
        const validSlots = [];

        const smartObjects = Array.isArray(template.smartObjects)
            ? template.smartObjects
            : [];

        for (const smartObject of smartObjects) {
            const slot = this.slot(smartObject, treeOrder.get(smartObject.layerId));

            if (!slot) {
                warnings.push({
                    type: "INVALID_SLOT",
                    layerId: smartObject?.layerId ?? null,
                    message: "Smart Object slot has invalid identity or bounds."
                });
                continue;
            }

            validSlots.push(slot);
        }

        return validSlots.sort((left, right) => this.compareSlots(left, right));

    }

    assignmentSlots(template) {

        const treeOrder = this.treeOrder(template.layerTree);

        return (Array.isArray(template.smartObjects) ? template.smartObjects : [])
            .filter(slot => slot?.layerId != null)
            .map(slot => ({
                layerId: slot.layerId,
                layerName: slot.layerName || "",
                parentGroupId: slot.parentGroupId ?? null,
                sourceOrder: treeOrder.get(slot.layerId) ?? Number.MAX_SAFE_INTEGER,
                sequence: this.sequence(slot.layerName)
            }))
            .sort((left, right) => this.compareSlots(left, right));

    }

    slot(smartObject, treeIndex) {

        const bounds = smartObject?.bounds;
        const left = Number(bounds?.left);
        const top = Number(bounds?.top);
        const right = Number(bounds?.right);
        const bottom = Number(bounds?.bottom);

        if (
            smartObject?.layerId == null ||
            ![left, top, right, bottom].every(Number.isFinite) ||
            right <= left ||
            bottom <= top
        ) {
            return null;
        }

        const width = right - left;
        const height = bottom - top;

        return {
            layerId: smartObject.layerId,
            layerName: smartObject.layerName || "",
            parentGroupId: smartObject.parentGroupId ?? null,
            sourceOrder: treeIndex ?? Number.MAX_SAFE_INTEGER,
            sequence: this.sequence(smartObject.layerName),
            orientation: this.strategy.classify(width, height),
            aspectRatio: width / height
        };

    }

    photos(photos, warnings) {

        const source = photos.some(photo => photo?.selected)
            ? photos.filter(photo => photo?.selected)
            : photos;

        return source.reduce((result, photo, sourceOrder) => {

            if (photo?.id == null) {
                warnings.push({
                    type: "INVALID_PHOTO",
                    photoId: null,
                    message: "Photo has no stable identity."
                });
                return result;
            }

            const width = Number(photo.width);
            const height = Number(photo.height);

            result.push({
                id: photo.id,
                name: photo.name || "",
                sourceOrder,
                orientation: this.strategy.classify(width, height),
                aspectRatio: this.strategy.validDimension(width) &&
                    this.strategy.validDimension(height)
                    ? width / height
                    : null
            });

            return result;

        }, []);

    }

    treeOrder(layerTree = []) {

        const order = new Map();
        let index = 0;

        const visit = layers => {
            for (const layer of layers || []) {
                order.set(layer.layerId ?? layer.id, index++);
                visit(layer.children);
            }
        };

        visit(layerTree);

        return order;

    }

    compareSlots(left, right) {

        if (left.sequence != null && right.sequence != null && left.sequence !== right.sequence) {
            return left.sequence - right.sequence;
        }

        if (left.sequence != null && right.sequence == null) return -1;
        if (left.sequence == null && right.sequence != null) return 1;
        if (left.sourceOrder !== right.sourceOrder) return left.sourceOrder - right.sourceOrder;

        return String(left.layerId).localeCompare(String(right.layerId), undefined, {
            numeric: true,
            sensitivity: "base"
        });

    }

    compareCandidates(left, right) {

        if (left.score !== right.score) return right.score - left.score;
        if (left.photo.sourceOrder !== right.photo.sourceOrder) {
            return left.photo.sourceOrder - right.photo.sourceOrder;
        }

        return String(left.photo.id).localeCompare(String(right.photo.id), undefined, {
            numeric: true,
            sensitivity: "base"
        });

    }

    sequence(layerName) {

        const match = String(layerName || "").match(/\d+/);

        return match ? Number(match[0]) : null;

    }

    templateWarnings(template) {

        const hasCompleteIdentity = template?.document?.id != null &&
            Array.isArray(template.smartObjects) &&
            template.smartObjects.length > 0 &&
            template.smartObjects.every(slot => slot?.layerId != null);

        if (template.validationState === "WARNING" ||
            (template.validationState === "UNKNOWN" && !hasCompleteIdentity)) {
            return [{
                type: "TEMPLATE_VALIDATION_STATE",
                state: template.validationState,
                message: "Template placement is proceeding without a valid-state guarantee."
            }];
        }

        return [];

    }

    requireProject(project) {

        if (!project) throw new Error("An active project is required.");

    }

    requireTemplate(template) {

        if (!template) throw new Error("A template is required.");
        if (template.validationState === "INVALID") {
            throw new Error("Template state is INVALID.");
        }

    }

    photoReference(photo) {

        return {
            photoId: photo.id,
            photoName: photo.name,
            orientation: photo.orientation
        };

    }

    reusedCount(assignments) {

        return assignments.length - new Set(
            assignments.map(item => item.photoId)
        ).size;

    }

    orientationCount(assignments, orientation) {

        return assignments.filter(item =>
            item.photoOrientation === orientation
        ).length;

    }

}
