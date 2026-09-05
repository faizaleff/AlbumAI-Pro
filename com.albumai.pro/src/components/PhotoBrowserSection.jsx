import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import ThumbnailGrid from "./ThumbnailGrid";
import UxpDropdown from "./UxpDropdown";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import PhotoImage from "./PhotoImage";
import PhotoLibraryHistory, {
    PhotoLibraryHistoryKind
} from "../services/PhotoLibraryHistory";
// Retained in the canonical bundle for legacy project compatibility. The
// production Library no longer renders this former KEEP-oriented modal.
import PhotoComparisonModal from "./PhotoComparisonModal";
import {
    createPhotoDecisionLookup,
    hasActivePhotoBrowserFilters,
    normalizePhotoDecisions,
    normalizePhotoBrowserPreferences,
    normalizePhotoEventChapters,
    photoDecisionKey,
    queryPhotoBrowser,
    updatePhotoDecision
} from "../services/PhotoBrowserModel";
import {
    normalizePhotoDuplicateEvidence,
    PhotoDuplicateStatus
} from "../services/PhotoDuplicateModel";
import {
    selectAllBrowserPhotos,
    setCanonicalBrowserPhotos
} from "../services/PhotoBrowserSelection";
import App from "../app/AppController";
import {
    canStartPhotoFolderChange
} from "./photoFolderChangeMessages";
import {
    CullingFilterMode,
    CullingStatus,
    filterPhotosByCulling,
    summarizeCulling
} from "../services/PhotoCullingService";
import {
    createPhotoGroupingRevision,
    createCameraIdentityLookup,
    detectCameras,
    getCameraKey,
    groupPhotosByEvent
} from "../services/PhotoGroupingEngine";

const PHOTO_DATE_FILTER_OPTIONS = Object.freeze([
    Object.freeze({ value: "any", label: "Any" }),
    Object.freeze({ value: "today", label: "Today" }),
    Object.freeze({ value: "last7", label: "Last 7 days" }),
    Object.freeze({ value: "last30", label: "Last 30 days" }),
    Object.freeze({ value: "thisYear", label: "This year" })
]);

const PHOTO_RATING_COMPARISON_OPTIONS = Object.freeze([
    Object.freeze({ value: "exact", label: "=" }),
    Object.freeze({ value: "atLeast", label: "≥" }),
    Object.freeze({ value: "atMost", label: "≤" })
]);

const PHOTO_SORT_OPTIONS = Object.freeze([
    Object.freeze({ value: "sort:name", label: "Sort · Name" }),
    Object.freeze({ value: "sort:created", label: "Sort · Date Created" }),
    Object.freeze({ value: "sort:taken", label: "Sort · Capture Time" }),
    Object.freeze({ value: "sort:rating", label: "Sort · Rating" }),
    Object.freeze({ value: "sort:camera", label: "Sort · Camera" }),
    Object.freeze({ value: "sort:event", label: "Sort · Event" }),
    Object.freeze({ value: "sort:type", label: "Sort · Photo Type" }),
    Object.freeze({ value: "group:none", label: "Group · None" }),
    Object.freeze({ value: "group:event", label: "Group · Events" }),
    Object.freeze({ value: "group:camera", label: "Group · Cameras" }),
    Object.freeze({ value: "group:rating", label: "Group · Ratings" }),
    Object.freeze({ value: "group:favorite", label: "Group · Favorites" }),
    Object.freeze({ value: "group:review", label: "Group · Included / Rejected" }),
    Object.freeze({ value: "group:type", label: "Group · Photo Type" })
]);

function formatPhotoBytes(photo) {
    const bytes = Number(photo?.size || photo?.file?.size || 0);
    if (!bytes) return "Unavailable";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function formatPhotoDate(value) {
    if (!value) return "Unavailable";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "Unavailable" : date.toLocaleString();
}

function PhotoBrowserSection({
    photos,
    onPhotoClick,
    projectId,
    focusedPhotoId = null,
    onFocusPhoto,
    folderLoaded = false,
    folderMessage = null,
    onOpenFolder,
    onRefresh,
    onChangePhotoFolder,
    isLoading = false,
    loadingPhotoCount = 0,
    photoFolderChange = null
}) {

    const canChangePhotoFolder = canStartPhotoFolderChange({
        projectId,
        folderLoaded,
        isLoading,
        photoFolderChange
    });

    const [viewMode, setViewMode] = useState("icons");
    const [groupMode, setGroupMode] = useState("none");
    const [selectedCount, setSelectedCount] = useState(
        () => App.selection.selectedIds().size
    );
    const [selectedPhotoIds, setSelectedPhotoIds] = useState(
        () => new Set(App.selection.selectedIds())
    );
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewScale, setPreviewScale] = useState(1);
    const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
    const [burstReviewGroupId, setBurstReviewGroupId] = useState(null);
    const [burstReviewIndex, setBurstReviewIndex] = useState(0);
    const [burstDraftIds, setBurstDraftIds] = useState(new Set());
    const [burstReviewBusy, setBurstReviewBusy] = useState(false);
    const [inspectorFileOpen, setInspectorFileOpen] = useState(true);
    const previewStageRef = useRef(null);
    const selectedPhotoIdsRef = useRef(selectedPhotoIds);
    const previewPhotoIndexRef = useRef(0);
    const libraryHistoryRef = useRef(new PhotoLibraryHistory());
    const previewOpenOnSpaceRef = useRef(false);
    const previewPanRef = useRef(null);

    const selectedPhotoIdListFromState = useCallback(() => {
        const order = photos;
        return order
            .map(photo => photo?.id)
            .filter(id => selectedPhotoIdsRef.current.has(id));
    }, [photos]);

    const pushUndoState = useCallback(() => {
        const state = selectedPhotoIdListFromState();
        libraryHistoryRef.current.push(
            PhotoLibraryHistoryKind.SELECTION,
            state,
            {
                equals: (left, right) => left.length === right.length &&
                    left.every((id, index) => id === right[index])
            }
        );
    }, [selectedPhotoIdListFromState]);

    const applySelectedIds = useCallback(targetIds => {
        const photoById = new Map(
            photos.map(photo => [photo?.id, photo]).filter(([id]) => id)
        );
        App.selection.replace(targetIds, targetIds[0]);
        // Maintain deterministic focus after undo/redo.
        if (targetIds.length) {
            const first = photoById.get(targetIds[0]);
            if (first?.id) onFocusPhoto?.(first.id);
        }
    }, [photos, onFocusPhoto]);

    const readSavedPreferences = () => {
        const metadata = App.project.getProject()?.metadata || {};
        const saved = metadata.photoBrowserPreferences;
        const legacySort = metadata.photoBrowserSort;
        return normalizePhotoBrowserPreferences({
            ...saved,
            sort: saved?.sort || legacySort
        });
    };
    const [preferences, setPreferences] = useState(readSavedPreferences);
    const [decisions, setDecisions] = useState(
        () => normalizePhotoDecisions(App.getPhotoDecisions())
    );
    const [eventChapters, setEventChapters] = useState(
        () => normalizePhotoEventChapters(App.getPhotoEventChapters(), photos)
    );
    const [decisionError, setDecisionError] = useState(null);
    const [duplicateEvidence, setDuplicateEvidence] = useState(
        () => normalizePhotoDuplicateEvidence(
            App.getPhotoDuplicateEvidence()
        )
    );
    const [duplicateBusy, setDuplicateBusy] = useState(false);
    const [duplicateError, setDuplicateError] = useState(null);
    const [cullingFilter, setCullingFilter] = useState(CullingFilterMode.ALL);
    const [selectedEventIds, setSelectedEventIds] = useState(new Set());
    const [selectedChapterIds, setSelectedChapterIds] = useState(new Set());
    const [selectedCameraKeys, setSelectedCameraKeys] = useState(new Set());
    const [selectedPhotoKindKeys, setSelectedPhotoKindKeys] = useState(new Set());
    const [contextMenu, setContextMenu] = useState(null);
    const decisionRevision = useRef(0);

    const handleContextMenu = useCallback((event, photo) => {
        if (!photo) return;
        if (!App.selection.isSelected(photo)) {
            App.selection.select(photo);
            onFocusPhoto?.(photo.id);
        }
        setContextMenu({
            x: event.clientX || 120,
            y: event.clientY || 120,
            photo
        });
    }, [onFocusPhoto]);

    // Metadata is filled in-place after the first render. A stable array
    // reference alone therefore cannot invalidate temporal/camera grouping.
    const photoGroupingRevision = createPhotoGroupingRevision(photos);
    const smartEvents = useMemo(() => {
        if (!photos || photos.length === 0) return [];
        return groupPhotosByEvent(photos);
    }, [photoGroupingRevision, photos]);

    const detectedCameras = useMemo(() => {
        if (!photos || photos.length === 0) return [];
        return detectCameras(photos);
    }, [photoGroupingRevision, photos]);
    const cameraIdentityForPhoto = useMemo(
        () => createCameraIdentityLookup(photos),
        [photoGroupingRevision, photos]
    );
    const burstGroups = useMemo(
        () => (App.getPhotoBursts?.() || []).filter(group =>
            group.count >= 2
        ),
        [photoGroupingRevision, photos]
    );
    const burstPhotoIds = useMemo(() => new Set(
        burstGroups.flatMap(group => group.photoIds)
    ), [burstGroups]);
    const photoKindForPhoto = useCallback(photo =>
        burstPhotoIds.has(photo?.id) ? "burst" : "single",
    [burstPhotoIds]);
    const photoKindFacets = useMemo(() => {
        const singles = photos.filter(photo => photoKindForPhoto(photo) === "single").length;
        const burstFrames = photos.length - singles;
        return [
            { key: "single", label: "Single Photos", count: singles },
            { key: "burst", label: "Burst Frames", count: burstFrames }
        ].filter(item => item.count > 0);
    }, [photoKindForPhoto, photos]);
    const burstReviews = useMemo(
        () => App.getPhotoBurstReviews?.() || { items: [] },
        [decisions, photoGroupingRevision, photos]
    );
    const reviewedBurstIds = useMemo(
        () => new Set(burstReviews.items
            .filter(item => item.reviewed)
            .map(item => item.groupId)),
        [burstReviews]
    );
    const burstsNeedingReview = burstGroups.filter(
        group => !reviewedBurstIds.has(group.groupId)
    ).length;
    const activeBurstGroup = useMemo(
        () => burstGroups.find(group => group.groupId === burstReviewGroupId) || null,
        [burstGroups, burstReviewGroupId]
    );
    const activeBurstPhotos = useMemo(() => {
        if (!activeBurstGroup) return [];
        const byId = new Map(photos.map(photo => [photo.id, photo]));
        return activeBurstGroup.photoIds.map(id => byId.get(id)).filter(Boolean);
    }, [activeBurstGroup, photos]);
    const activeBurstPhoto = activeBurstPhotos[burstReviewIndex] || null;
    const focusedPhoto = useMemo(
        () => photos.find(photo => photo.id === focusedPhotoId) || null,
        [focusedPhotoId, photos]
    );

    const queryResult = useMemo(
        () => queryPhotoBrowser(photos, preferences, {
            decisions,
            duplicateEvidence
        }),
        [decisions, duplicateEvidence, photos, preferences]
    );
    const decisionForPhoto = useMemo(
        () => createPhotoDecisionLookup(decisions),
        [decisions]
    );
    const culledPhotos = useMemo(
        () => filterPhotosByCulling(queryResult.photos, cullingFilter, decisionForPhoto),
        [queryResult.photos, cullingFilter, decisionForPhoto]
    );
    const visiblePhotos = useMemo(() => {
        let result = culledPhotos;
        if (selectedEventIds.size) {
            const allowed = new Set(smartEvents
                .filter(event => selectedEventIds.has(event.eventId))
                .flatMap(event => event.photoIds));
            result = result.filter(photo => allowed.has(photo.id));
        }
        if (selectedCameraKeys.size) {
            result = result.filter(photo =>
                selectedCameraKeys.has(getCameraKey(photo))
            );
        }
        if (selectedChapterIds.size) {
            const allowedKeys = new Set(eventChapters.items
                .filter(chapter => selectedChapterIds.has(chapter.chapterId))
                .flatMap(chapter => chapter.photoKeys));
            result = result.filter(photo => allowedKeys.has(photoDecisionKey(photo)));
        }
        if (selectedPhotoKindKeys.size) {
            result = result.filter(photo =>
                selectedPhotoKindKeys.has(photoKindForPhoto(photo))
            );
        }
        if (preferences.sort.field === "type") {
            const direction = preferences.sort.direction === "desc" ? -1 : 1;
            result = result.slice().sort((left, right) => direction *
                photoKindForPhoto(left).localeCompare(photoKindForPhoto(right))
            );
        }
        if (groupMode !== "none") {
            const eventByPhoto = new Map(smartEvents.flatMap(event =>
                event.photoIds.map(id => [id, event.label])
            ));
            const groupValue = photo => {
                if (groupMode === "event") return eventByPhoto.get(photo.id) || "";
                if (groupMode === "camera") return cameraIdentityForPhoto(photo)?.tag || "";
                if (groupMode === "rating") return String(decisionForPhoto(photo).rating || 0);
                if (groupMode === "favorite") return decisionForPhoto(photo).favorite ? "0" : "1";
                if (groupMode === "review") return decisionForPhoto(photo).culling === CullingStatus.REJECT ? "1" : "0";
                if (groupMode === "type") return photoKindForPhoto(photo);
                return "";
            };
            result = result.slice().sort((left, right) =>
                groupValue(left).localeCompare(groupValue(right), undefined, { numeric: true })
            );
        }
        return result;
    }, [cameraIdentityForPhoto, culledPhotos, decisionForPhoto, eventChapters, groupMode, photoKindForPhoto, preferences.sort.direction, preferences.sort.field, selectedCameraKeys, selectedChapterIds, selectedEventIds, selectedPhotoKindKeys, smartEvents]);
    const groupLabelForPhoto = useCallback(photo => {
        if (!photo || groupMode === "none") return "";
        if (groupMode === "event") {
            return smartEvents.find(event => event.photoIds.includes(photo.id))?.label || "Unassigned";
        }
        if (groupMode === "camera") return cameraIdentityForPhoto(photo)?.tag || "Unknown camera";
        if (groupMode === "rating") return decisionForPhoto(photo).rating
            ? `${decisionForPhoto(photo).rating}★`
            : "Unrated";
        if (groupMode === "favorite") return decisionForPhoto(photo).favorite ? "Favorites" : "Not favorite";
        if (groupMode === "review") return decisionForPhoto(photo).culling === CullingStatus.REJECT ? "Rejected" : "Included";
        if (groupMode === "type") return photoKindForPhoto(photo) === "burst"
            ? "Burst Frames"
            : "Single Photos";
        return "";
    }, [cameraIdentityForPhoto, decisionForPhoto, groupMode, photoKindForPhoto, smartEvents]);
    const eventLabelForPhoto = useCallback(photo => {
        const photoKey = photoDecisionKey(photo);
        const chapter = eventChapters.items.find(item =>
            item.photoKeys.includes(photoKey)
        );
        if (chapter) return chapter.name;
        return smartEvents.find(event => event.photoIds.includes(photo?.id))?.label || "";
    }, [eventChapters, smartEvents]);

    const filtersActive = hasActivePhotoBrowserFilters(preferences) ||
        cullingFilter !== CullingFilterMode.ALL ||
        selectedEventIds.size > 0 ||
        selectedChapterIds.size > 0 ||
        selectedCameraKeys.size > 0 ||
        selectedPhotoKindKeys.size > 0;

    const cullingSummary = useMemo(
        () => summarizeCulling(photos, decisionForPhoto, App.getPhotoBursts ? App.getPhotoBursts() : []),
        [photos, decisionForPhoto]
    );
    const selectedPhotos = useMemo(() => photos.filter(photo => selectedPhotoIds.has(photo?.id)),
        [photos, selectedPhotoIds]
    );
    const previewPhotos = useMemo(() => selectedPhotoIds.size
        ? visiblePhotos.filter(photo => selectedPhotoIds.has(photo?.id))
        : visiblePhotos,
    [selectedPhotoIds, visiblePhotos]);
    const previewPhoto = previewPhotos[previewIndex] || null;
    const selectedPreviewPhoto = selectedPhotos[0] ||
        previewPhotos.find(photo => photo?.id === focusedPhotoId) ||
        previewPhotos[0] ||
        null;
    const clampPreviewScale = useCallback(value => {
        return Math.max(0.25, Math.min(4, value));
    }, []);

    const closePreview = useCallback(() => {
        setIsPreviewOpen(false);
        previewOpenOnSpaceRef.current = false;
        previewPhotoIndexRef.current = 0;
        setPreviewScale(1);
        setPreviewOffset({ x: 0, y: 0 });
    }, []);

    const openSelectedPreview = useCallback(targetPhoto => {
        if (!previewPhotos.length) return;
        const targetId = targetPhoto?.id;
        const index = targetId
            ? previewPhotos.findIndex(photo => photo?.id === targetId)
            : 0;
        const normalized = index >= 0 ? index : 0;
        setPreviewIndex(normalized);
        previewPhotoIndexRef.current = normalized;
        setPreviewScale(1);
        setPreviewOffset({ x: 0, y: 0 });
        setIsPreviewOpen(true);
    }, [previewPhotos]);

    const setPreviewPhoto = useCallback((nextIndex) => {
        if (!previewPhotos.length) {
            closePreview();
            return;
        }
        const normalized = (nextIndex + previewPhotos.length) % previewPhotos.length;
        const next = normalized < 0
            ? previewPhotos.length - 1
            : normalized;
        setPreviewIndex(next);
        previewPhotoIndexRef.current = next;
        const photo = previewPhotos[next];
        if (photo?.id) {
            onFocusPhoto?.(photo.id);
        }
    }, [closePreview, onFocusPhoto, previewPhotos]);

    const movePreviewBy = useCallback(step => {
        setPreviewPhoto((previewPhotoIndexRef.current + step) % previewPhotos.length);
    }, [previewPhotos.length, setPreviewPhoto]);

    const previewSelectedSet = useCallback(() => {
        if (selectedPreviewPhoto?.id) {
            openSelectedPreview(selectedPreviewPhoto);
        }
    }, [openSelectedPreview, selectedPreviewPhoto]);

    const fitPreview = useCallback(() => {
        setPreviewScale(1);
        setPreviewOffset({ x: 0, y: 0 });
    }, []);

    const changePreviewScale = useCallback(delta => {
        setPreviewScale(previous => {
            const next = clampPreviewScale(previous + delta);
            if (next === 1) setPreviewOffset({ x: 0, y: 0 });
            return next;
        });
    }, [clampPreviewScale]);

    const togglePreviewScale = useCallback(() => {
        setPreviewScale(previous => {
            if (previous > 1) {
                setPreviewOffset({ x: 0, y: 0 });
                return 1;
            }
            return 2;
        });
    }, []);

    const previewDetails = useMemo(() => {
        if (!previewPhoto) return [];
        const fileSize = Number(previewPhoto.size || previewPhoto.file?.size || 0);
        const dimension = previewPhoto.width > 0 && previewPhoto.height > 0
            ? `${previewPhoto.width} × ${previewPhoto.height}`
            : null;
        const shotDate = previewPhoto.modified || previewPhoto.created;
        const camera = previewPhoto.camera?.model ||
            previewPhoto.model ||
            previewPhoto.cameraModel ||
            previewPhoto.camera ||
            null;
        const cameraIdentity = cameraIdentityForPhoto(previewPhoto);
        const rating = decisionForPhoto(previewPhoto).rating || 0;
        return [
            `File: ${previewPhoto.name || "Unknown"}`,
            shotDate ? `Date: ${new Date(shotDate).toLocaleString()}` : null,
            dimension ? `Dimensions: ${dimension}` : null,
            fileSize > 0
                ? `Size: ${Math.round(fileSize / 1024).toLocaleString()} KB`
                : null,
            `Event: ${eventLabelForPhoto(previewPhoto) || "Unassigned"}`,
            `Camera: ${cameraIdentity?.tag || "—"}${camera ? ` · ${camera}` : ""}`,
            `Rating: ${"★".repeat(rating)}${"☆".repeat(5 - rating)}`
        ].filter(Boolean);
    }, [cameraIdentityForPhoto, decisionForPhoto, eventLabelForPhoto, previewPhoto]);

    const handlePreviewWheel = useCallback(event => {
        if ((!isPreviewOpen || !previewPhoto) && !activeBurstPhoto) return;
        event.preventDefault();
        const delta = event.deltaY > 0 ? -0.12 : 0.12;
        const bounds = previewStageRef.current?.getBoundingClientRect?.();
        setPreviewScale(previous => {
            const next = clampPreviewScale(previous + delta);
            if (next === previous) return previous;
            if (next === 1) {
                setPreviewOffset({ x: 0, y: 0 });
                return next;
            }
            if (bounds && previous > 0) {
                const pointerX = event.clientX - bounds.left - bounds.width / 2;
                const pointerY = event.clientY - bounds.top - bounds.height / 2;
                const ratio = next / previous;
                setPreviewOffset(current => ({
                    x: pointerX - (pointerX - current.x) * ratio,
                    y: pointerY - (pointerY - current.y) * ratio
                }));
            }
            return next;
        });
    }, [activeBurstPhoto, clampPreviewScale, isPreviewOpen, previewPhoto]);

    const handlePreviewMouseDown = useCallback(event => {
        if (
            event.button !== 0 ||
            (!isPreviewOpen && !activeBurstGroup) ||
            previewScale <= 1
        ) return;
        event.preventDefault();
        previewPanRef.current = {
            dragging: true,
            startX: event.clientX,
            startY: event.clientY,
            originX: previewOffset.x,
            originY: previewOffset.y
        };
    }, [activeBurstGroup, isPreviewOpen, previewOffset.x, previewOffset.y, previewScale]);

    const handlePreviewMouseMove = useCallback(event => {
        if (!previewPanRef.current?.dragging) return;
        const drag = previewPanRef.current;
        setPreviewOffset({
            x: drag.originX + (event.clientX - drag.startX),
            y: drag.originY + (event.clientY - drag.startY)
        });
    }, []);

    const handlePreviewMouseUp = useCallback(() => {
        if (previewPanRef.current?.dragging) {
            previewPanRef.current.dragging = false;
        }
    }, []);

    useEffect(() => {
        if (!isPreviewOpen && !activeBurstGroup) {
            previewPanRef.current = null;
            return undefined;
        }
        window.addEventListener("mousemove", handlePreviewMouseMove);
        window.addEventListener("mouseup", handlePreviewMouseUp);
        return () => {
            window.removeEventListener("mousemove", handlePreviewMouseMove);
            window.removeEventListener("mouseup", handlePreviewMouseUp);
            if (previewPanRef.current) {
                previewPanRef.current.dragging = false;
            }
        };
    }, [activeBurstGroup, handlePreviewMouseMove, handlePreviewMouseUp, isPreviewOpen]);

    useEffect(() => {
        if (isPreviewOpen && !previewPhoto) {
            closePreview();
        }
    }, [closePreview, isPreviewOpen, previewPhoto]);

    useEffect(() => {
        if (!isPreviewOpen) return;
        if (!selectedPhotoIds.size) return;
        if (!selectedPhotoIds.has(previewPhoto?.id)) {
            openSelectedPreview(selectedPhotos[0] || previewPhoto);
        }
    }, [isPreviewOpen, openSelectedPreview, previewPhoto, selectedPhotos, selectedPhotoIds]);

    useEffect(() => {
        setPreferences(readSavedPreferences());
        setDecisions(normalizePhotoDecisions(App.getPhotoDecisions()));
        setEventChapters(normalizePhotoEventChapters(
            App.getPhotoEventChapters(),
            photos
        ));
        setDecisionError(null);
        setDuplicateEvidence(normalizePhotoDuplicateEvidence(
            App.getPhotoDuplicateEvidence()
        ));
        setDuplicateBusy(false);
        setDuplicateError(null);
        setSelectedEventIds(new Set());
        setSelectedChapterIds(new Set());
        setSelectedCameraKeys(new Set());
        setSelectedPhotoKindKeys(new Set());
        decisionRevision.current += 1;
    }, [projectId]);

    useEffect(() => {
        setDecisions(normalizePhotoDecisions(App.getPhotoDecisions()));
        setEventChapters(normalizePhotoEventChapters(
            App.getPhotoEventChapters(),
            photos
        ));
        setDuplicateEvidence(normalizePhotoDuplicateEvidence(
            App.getPhotoDuplicateEvidence()
        ));
    }, [photos]);

    const persistPreferences = useCallback(value => {
        App.saveProject(
            { photoBrowserPreferences: value },
            { reason: "PHOTO_BROWSER_PREFERENCES" }
        ).catch(error => console.warn(
            "Photo browser preference persistence:",
            error
        ));
    }, []);

    const updatePreferences = useCallback((next, { persist = true } = {}) => {
        setPreferences(previous => {
            const values = typeof next === "function"
                ? next(previous)
                : { ...previous, ...next };
            const resolved = normalizePhotoBrowserPreferences(values);
            if (JSON.stringify(resolved) === JSON.stringify(previous)) {
                return previous;
            }
            if (persist) persistPreferences(resolved);
            return resolved;
        });
    }, [persistPreferences]);

    const updateSort = useCallback(next => {
        updatePreferences(previous => ({
            ...previous,
            sort: { ...previous.sort, ...next }
        }));
    }, [updatePreferences]);

    const changeListSort = useCallback(field => {
        updatePreferences(previous => ({
            ...previous,
            sort: {
                field,
                direction: previous.sort.field === field && previous.sort.direction === "asc"
                    ? "desc"
                    : "asc"
            }
        }));
    }, [updatePreferences]);

    const clearFilters = useCallback(() => {
        setSelectedEventIds(new Set());
        setSelectedChapterIds(new Set());
        setSelectedCameraKeys(new Set());
        setSelectedPhotoKindKeys(new Set());
        setCullingFilter(CullingFilterMode.ALL);
        updatePreferences(previous => ({ sort: previous.sort }));
    }, [updatePreferences]);

    const toggleFacet = useCallback((setter, value, event) => {
        setter(previous => {
            const additive = event?.ctrlKey || event?.metaKey;
            if (!additive) {
                return previous.size === 1 && previous.has(value)
                    ? new Set()
                    : new Set([value]);
            }
            const next = new Set(previous);
            if (next.has(value)) next.delete(value);
            else next.add(value);
            return next;
        });
    }, []);

    const changePhotoDecision = useCallback((photo, changes) => {
        const revision = ++decisionRevision.current;
        setDecisionError(null);
        setDecisions(previous => updatePhotoDecision(
            previous,
            photo,
            changes
        ));
        App.updatePhotoDecision(photo, changes)
            .then(persisted => {
                if (decisionRevision.current === revision) {
                    setDecisions(normalizePhotoDecisions(persisted));
                }
            })
            .catch(error => {
                if (decisionRevision.current === revision) {
                    setDecisions(normalizePhotoDecisions(
                        App.getPhotoDecisions()
                    ));
                    setDecisionError(
                        "Rating or favourite could not be saved."
                    );
                }
                console.warn("Photo decision persistence:", error);
            });
    }, []);

    const pushDecisionUndo = useCallback(() => {
        libraryHistoryRef.current.push(
            PhotoLibraryHistoryKind.DECISION,
            decisions
        );
    }, [decisions]);

    const openBurstReview = useCallback(group => {
        const targetGroup = group || burstGroups.find(
            candidate => !reviewedBurstIds.has(candidate.groupId)
        ) || burstGroups[0];
        if (!targetGroup) return;
        const existing = burstReviews.items.find(item => item.groupId === targetGroup.groupId);
        const byId = new Map(photos.map(photo => [photo.id, photo]));
        const selectedKeys = new Set(existing?.selectedPhotoKeys || []);
        const selectedIds = targetGroup.photoIds.filter(id =>
            selectedKeys.has(photoDecisionKey(byId.get(id)))
        );
        setBurstDraftIds(new Set(selectedIds.length
            ? selectedIds
            : [targetGroup.bestPhotoId]));
        setBurstReviewIndex(Math.max(0, targetGroup.photoIds.indexOf(targetGroup.bestPhotoId)));
        setPreviewScale(1);
        setPreviewOffset({ x: 0, y: 0 });
        setBurstReviewGroupId(targetGroup.groupId);
    }, [burstGroups, burstReviews, photos, reviewedBurstIds]);

    const closeBurstReview = useCallback(() => {
        setBurstReviewGroupId(null);
        setPreviewScale(1);
        setPreviewOffset({ x: 0, y: 0 });
        previewPanRef.current = null;
    }, []);

    const toggleBurstDraft = useCallback(photo => {
        if (!photo?.id) return;
        setBurstDraftIds(previous => {
            const next = new Set(previous);
            if (next.has(photo.id)) {
                if (next.size > 1) next.delete(photo.id);
            } else {
                next.add(photo.id);
            }
            return next;
        });
    }, []);

    const applyActiveBurstReview = useCallback(async () => {
        if (!activeBurstGroup || !burstDraftIds.size) return;
        setBurstReviewBusy(true);
        try {
            const selected = activeBurstPhotos.filter(photo =>
                burstDraftIds.has(photo.id)
            );
            const result = await App.applyPhotoBurstReview(
                activeBurstGroup.groupId,
                selected
            );
            setDecisions(normalizePhotoDecisions(result.decisions));
            closeBurstReview();
        } catch (error) {
            setDecisionError("Burst review could not be saved.");
        } finally {
            setBurstReviewBusy(false);
        }
    }, [activeBurstGroup, activeBurstPhotos, burstDraftIds, closeBurstReview]);

    const analyzeDuplicates = useCallback(() => {
        if (duplicateBusy || !folderLoaded || !photos.length) return;
        setDuplicateBusy(true);
        setDuplicateError(null);
        App.analyzePhotoDuplicates()
            .then(evidence => {
                const normalized = normalizePhotoDuplicateEvidence(evidence);
                setDuplicateEvidence(normalized);
                if (normalized.status === PhotoDuplicateStatus.STALE) {
                    setDuplicateError(
                        "The photo folder changed. Run duplicate analysis again."
                    );
                }
            })
            .catch(error => {
                setDuplicateEvidence(normalizePhotoDuplicateEvidence(
                    App.getPhotoDuplicateEvidence()
                ));
                setDuplicateError("Duplicate analysis could not be saved.");
                console.warn("Photo duplicate analysis:", error);
            })
            .finally(() => setDuplicateBusy(false));
    }, [duplicateBusy, folderLoaded, photos.length]);

    const applyDecisionToSelected = useCallback((changes) => {
        if (!selectedPhotos.length) return;
        pushDecisionUndo();
        selectedPhotos.forEach(photo => {
            changePhotoDecision(photo, changes);
        });
    }, [changePhotoDecision, pushDecisionUndo, selectedPhotos]);

    const setSelectedRating = useCallback(rating => {
        const nextRating = rating > 0 && selectedPhotos.every(
            photo => decisionForPhoto(photo).rating === rating
        ) ? 0 : rating;
        applyDecisionToSelected({ rating: nextRating });
    }, [applyDecisionToSelected, decisionForPhoto, selectedPhotos]);

    const setSelectedFavorite = useCallback(() => {
        const shouldFavorite = selectedPhotos.some(
            photo => decisionForPhoto(photo)?.favorite !== true
        );
        applyDecisionToSelected({ favorite: shouldFavorite });
    }, [applyDecisionToSelected, selectedPhotos, decisionForPhoto]);

    const rejectSelected = useCallback(() => {
        const shouldReject = selectedPhotos.some(
            photo => decisionForPhoto(photo)?.culling !== CullingStatus.REJECT
        );
        applyDecisionToSelected({
            culling: shouldReject
                ? CullingStatus.REJECT
                : CullingStatus.UNRATED
        });
    }, [applyDecisionToSelected, decisionForPhoto, selectedPhotos]);

    const changeTargetDecision = useCallback((photo, changes) => {
        if (photo?.id && selectedPhotoIdsRef.current.has(photo.id)) {
            applyDecisionToSelected(changes);
            return;
        }
        pushDecisionUndo();
        changePhotoDecision(photo, changes);
    }, [applyDecisionToSelected, changePhotoDecision, pushDecisionUndo]);

    const changePreviewDecision = useCallback(changes => {
        if (!previewPhoto) return;
        pushDecisionUndo();
        changePhotoDecision(previewPhoto, changes);
    }, [changePhotoDecision, previewPhoto, pushDecisionUndo]);

    const pushEventUndo = useCallback(() => {
        libraryHistoryRef.current.push(
            PhotoLibraryHistoryKind.EVENT,
            eventChapters
        );
    }, [eventChapters]);

    const moveSelectedToNewEvent = useCallback(() => {
        if (!selectedPhotos.length) return;
        pushEventUndo();
        App.createPhotoEventChapter(selectedPhotos)
            .then(setEventChapters)
            .catch(error => console.warn(
                "Move selected photos to event chapter:",
                error
            ));
    }, [pushEventUndo, selectedPhotos]);

    const moveSelectedToEvent = useCallback(chapterId => {
        if (!chapterId || !selectedPhotos.length) return;
        if (chapterId === "new") {
            moveSelectedToNewEvent();
            return;
        }
        if (chapterId === "unassigned") {
            pushEventUndo();
            App.removePhotosFromEventChapters(selectedPhotos)
                .then(setEventChapters)
                .catch(error => console.warn("Remove photos from event:", error));
            return;
        }
        pushEventUndo();
        App.assignPhotosToEventChapter(chapterId, selectedPhotos)
            .then(setEventChapters)
            .catch(error => console.warn("Move photos to event:", error));
    }, [moveSelectedToNewEvent, pushEventUndo, selectedPhotos]);

    const handleEventDrop = useCallback((event, chapterId) => {
        event.preventDefault();
        const photoId = event.dataTransfer?.getData("text/plain");
        const draggedPhoto = photos.find(photo => String(photo?.id) === String(photoId));
        if (!draggedPhoto) return;
        const targets = selectedPhotoIdsRef.current.has(draggedPhoto.id)
            ? selectedPhotos
            : [draggedPhoto];
        if (!targets.length) return;
        pushEventUndo();
        App.assignPhotosToEventChapter(chapterId, targets)
            .then(setEventChapters)
            .catch(error => console.warn("Drop photos on event:", error));
    }, [photos, pushEventUndo, selectedPhotos]);

    const selectAllPhotos = useCallback(() => {
        pushUndoState();
        selectAllBrowserPhotos();
    }, [pushUndoState]);

    const clearSelected = useCallback(() => {
        if (!selectedPhotoIds.size) return;
        pushUndoState();
        App.selection.clear();
    }, [pushUndoState, selectedPhotoIds.size]);

    const handlePhotoGridInteraction = useCallback((photo, event) => {
        if (!photo?.id) return;

        pushUndoState();
        App.selection.handleClick(photo, event);
        onFocusPhoto?.(photo.id);
        onPhotoClick?.(photo);
    }, [onFocusPhoto, onPhotoClick, pushUndoState]);

    const duplicateReady =
        duplicateEvidence.status === PhotoDuplicateStatus.COMPLETE ||
        duplicateEvidence.status === PhotoDuplicateStatus.PARTIAL;
    const duplicateNameByKey = new Map(photos.map(photo => [
        photoDecisionKey(photo),
        photo?.name
    ]));
    const duplicateGroupPreview = duplicateEvidence.groups
        .slice(0, 3)
        .map((group, index) => {
            const names = group.members.slice(0, 2)
                .map(member => duplicateNameByKey.get(member.photoKey))
                .filter(Boolean);
            const remaining = Math.max(0, group.members.length - names.length);
            return `Group ${index + 1}: ${names.join(", ")}${remaining ? ` +${remaining}` : ""}`;
        })
        .filter(label => !label.endsWith(": "))
        .join(" · ");
    const duplicateSummary = duplicateReady
        ? `${duplicateEvidence.groups.length} ${duplicateEvidence.groups.length === 1 ? "group" : "groups"} · ${duplicateEvidence.duplicatePhotos} duplicate ${duplicateEvidence.duplicatePhotos === 1 ? "photo" : "photos"} · ${duplicateEvidence.potentialSavingsBytes.toLocaleString()} bytes recoverable${duplicateEvidence.failures.length ? ` · ${duplicateEvidence.failures.length} unreadable or changed` : ""}${duplicateGroupPreview ? ` · ${duplicateGroupPreview}` : ""}`
        : duplicateEvidence.status === PhotoDuplicateStatus.STALE
            ? "Duplicate analysis is stale. Run it again."
            : "Duplicate analysis has not been run.";

    useEffect(() => {
        if (duplicateReady || !preferences.duplicatesOnly) return;
        updatePreferences({ duplicatesOnly: false });
    }, [
        duplicateReady,
        preferences.duplicatesOnly,
        updatePreferences
    ]);

    const switchView = useCallback(nextMode => {
        setViewMode(previous => {
            if (previous === nextMode) return previous;

            PhotoBrowserPerformance.beginViewSwitch(
                previous,
                nextMode
            );
            return nextMode;
        });
    }, []);

    useEffect(() => {
        PhotoBrowserPerformance.completeViewSwitch(viewMode);
        PhotoBrowserPerformance.trace("BROWSER_VIEW_MODE", { viewMode });
    }, [viewMode]);

    useEffect(() => {
        App.selection.setOrderedPhotos(visiblePhotos);
        setCanonicalBrowserPhotos(visiblePhotos);
    }, [visiblePhotos]);

    useEffect(() => {
        if (focusedPhotoId && !visiblePhotos.some(
            photo => photo?.id === focusedPhotoId
        )) {
            onFocusPhoto?.(null);
        }
    }, [focusedPhotoId, onFocusPhoto, visiblePhotos]);

    const focusPhoto = useCallback(photo => {
        if (!photo?.id) return;
        onFocusPhoto?.(photo.id);
    }, [onFocusPhoto]);

    useEffect(() => App.selection.subscribe(selectedIds => {
        const snapshot = new Set(selectedIds);
        setSelectedPhotoIds(snapshot);
        selectedPhotoIdsRef.current = snapshot;
        setSelectedCount(snapshot.size);
    }), []);

    const currentHistorySnapshot = useCallback(kind => {
        if (kind === PhotoLibraryHistoryKind.SELECTION) {
            return selectedPhotoIdListFromState();
        }
        if (kind === PhotoLibraryHistoryKind.DECISION) return decisions;
        if (kind === PhotoLibraryHistoryKind.EVENT) return eventChapters;
        return null;
    }, [decisions, eventChapters, selectedPhotoIdListFromState]);

    const applyHistoryEntry = useCallback((entry, direction) => {
        if (!entry) return;
        if (entry.kind === PhotoLibraryHistoryKind.SELECTION) {
            applySelectedIds(entry.snapshot || []);
            return;
        }
        if (entry.kind === PhotoLibraryHistoryKind.DECISION) {
            setDecisions(entry.snapshot);
            App.savePhotoDecisions(
                entry.snapshot,
                direction === "undo" ? "PHOTO_LIBRARY_UNDO" : "PHOTO_LIBRARY_REDO"
            ).catch(() => {
                setDecisions(normalizePhotoDecisions(App.getPhotoDecisions()));
            });
            return;
        }
        if (entry.kind === PhotoLibraryHistoryKind.EVENT) {
            setEventChapters(entry.snapshot);
            App.savePhotoEventChapters(
                entry.snapshot,
                direction === "undo"
                    ? "PHOTO_LIBRARY_EVENT_UNDO"
                    : "PHOTO_LIBRARY_EVENT_REDO"
            ).catch(() => setEventChapters(normalizePhotoEventChapters(
                App.getPhotoEventChapters(), photos
            )));
        }
    }, [applySelectedIds, photos]);

    const handleUndoSelection = useCallback(() => {
        applyHistoryEntry(
            libraryHistoryRef.current.undo(currentHistorySnapshot),
            "undo"
        );
    }, [applyHistoryEntry, currentHistorySnapshot]);

    const handleRedoSelection = useCallback(() => {
        applyHistoryEntry(
            libraryHistoryRef.current.redo(currentHistorySnapshot),
            "redo"
        );
    }, [applyHistoryEntry, currentHistorySnapshot]);

    const resolveRatingShortcut = eventKey => {
        if (eventKey === "0") return 0;
        if (eventKey === "1") return 1;
        if (eventKey === "2") return 2;
        if (eventKey === "3") return 3;
        if (eventKey === "4") return 4;
        if (eventKey === "5") return 5;
        return null;
    };

    const performSelectionMove = useCallback((next, useRange, toggleFocused = false) => {
        if (!next) return;
        pushUndoState();
        if (useRange) {
            App.selection.range(next, { additive: toggleFocused });
        } else if (toggleFocused) {
            App.selection.toggle(next);
        } else {
            App.selection.select(next);
        }
    }, [pushUndoState]);

    useEffect(() => {
        const handleKeyDown = event => {
            const target = event.target?.closest
                ? event.target
                : event.target?.parentElement;
            const isEditable = !!target?.closest?.(
                "input, textarea, select, [contenteditable]"
            );
            const key = event.key;
            const lowerKey = key?.toLowerCase();
            const command = event.ctrlKey || event.metaKey;
            const isSelectAll =
                command && (lowerKey === "a" || event.code === "KeyA");
            const isUndo =
                command && (lowerKey === "z" || event.code === "KeyZ");
            const isRedo =
                command && (lowerKey === "y" ||
                    (event.shiftKey && (lowerKey === "z" || event.code === "KeyZ")));
            const isDeselectAll =
                command && (lowerKey === "d" || event.code === "KeyD");

            if (isEditable) return;

            if (activeBurstGroup) {
                if (lowerKey === "escape") {
                    event.preventDefault();
                    closeBurstReview();
                } else if (event.key === "ArrowLeft") {
                    event.preventDefault();
                    setBurstReviewIndex(previous => Math.max(0, previous - 1));
                } else if (event.key === "ArrowRight") {
                    event.preventDefault();
                    setBurstReviewIndex(previous => Math.min(
                        activeBurstPhotos.length - 1,
                        previous + 1
                    ));
                } else if (event.key === "Enter") {
                    event.preventDefault();
                    toggleBurstDraft(activeBurstPhoto);
                }
                return;
            }

            const hasPreview = isPreviewOpen && !!previewPhoto;
            if (hasPreview) {
                if (lowerKey === "escape") {
                    event.preventDefault();
                    closePreview();
                    return;
                }
                if (lowerKey === " " || lowerKey === "spacebar") {
                    event.preventDefault();
                    return;
                }
                if (lowerKey === "r") {
                    event.preventDefault();
                    changePreviewDecision({
                        culling: decisionForPhoto(previewPhoto)?.culling === CullingStatus.REJECT
                            ? CullingStatus.UNRATED
                            : CullingStatus.REJECT
                    });
                    return;
                }
                if (lowerKey === "f") {
                    event.preventDefault();
                    changePreviewDecision({
                        favorite: !decisionForPhoto(previewPhoto)?.favorite
                    });
                    return;
                }

                const shortcutRating = resolveRatingShortcut(lowerKey);
                if (shortcutRating != null) {
                    event.preventDefault();
                    changePreviewDecision({
                        rating: shortcutRating > 0 &&
                            decisionForPhoto(previewPhoto)?.rating === shortcutRating
                            ? 0
                            : shortcutRating
                    });
                    return;
                }

                switch (event.key) {
                    case "ArrowLeft":
                    case "ArrowUp": {
                        event.preventDefault();
                        movePreviewBy(-1);
                        return;
                    }
                    case "ArrowRight":
                    case "ArrowDown": {
                        event.preventDefault();
                        movePreviewBy(1);
                        return;
                    }
                    case "Home":
                        event.preventDefault();
                        setPreviewPhoto(0);
                        return;
                    case "End":
                        event.preventDefault();
                        setPreviewPhoto(previewPhotos.length - 1);
                        return;
                    default:
                        return;
                }
            }

            if (isSelectAll && visiblePhotos.length) {
                event.preventDefault();
                selectAllPhotos();
                return;
            }

            if (isUndo) {
                event.preventDefault();
                handleUndoSelection();
                return;
            }

            if (isRedo) {
                event.preventDefault();
                handleRedoSelection();
                return;
            }

            if (isDeselectAll) {
                event.preventDefault();
                clearSelected();
                return;
            }

            if (lowerKey === "escape") {
                event.preventDefault();
                clearSelected();
                return;
            }

            if (lowerKey === " " || lowerKey === "spacebar") {
                if (!previewPhotos.length) return;
                event.preventDefault();
                previewOpenOnSpaceRef.current = true;
                previewSelectedSet();
                return;
            }

            if (lowerKey === "v") {
                event.preventDefault();
                openBurstReview();
                return;
            }

            const shortcutRating = resolveRatingShortcut(lowerKey);
            if (shortcutRating != null) {
                event.preventDefault();
                setSelectedRating(shortcutRating);
                return;
            }

            if (lowerKey === "r") {
                event.preventDefault();
                rejectSelected();
                return;
            }

            if (lowerKey === "f") {
                event.preventDefault();
                setSelectedFavorite();
                return;
            }

            const index = Math.max(0, visiblePhotos.findIndex(
                photo => photo?.id === focusedPhotoId
            ));
            const pageSize = 10;

            switch (event.key) {
                case "ArrowLeft":
                case "ArrowUp": {
                    event.preventDefault();
                    const next = visiblePhotos[Math.max(0, index - 1)];
                    if (next) performSelectionMove(next, event.shiftKey, command);
                    focusPhoto(next);
                    return;
                }
                case "ArrowRight":
                case "ArrowDown": {
                    event.preventDefault();
                    const next = visiblePhotos[Math.min(
                        visiblePhotos.length - 1,
                        index + 1
                    )];
                    if (next) performSelectionMove(next, event.shiftKey, command);
                    focusPhoto(next);
                    return;
                }
                case "Home":
                    event.preventDefault();
                    performSelectionMove(visiblePhotos[0], event.shiftKey);
                    focusPhoto(visiblePhotos[0]);
                    return;
                case "End":
                    event.preventDefault();
                    performSelectionMove(
                        visiblePhotos[visiblePhotos.length - 1],
                        event.shiftKey
                    );
                    focusPhoto(visiblePhotos[visiblePhotos.length - 1]);
                    return;
                case "PageUp": {
                    event.preventDefault();
                    const pageUp = visiblePhotos[Math.max(0, index - pageSize)];
                    performSelectionMove(pageUp, event.shiftKey);
                    focusPhoto(pageUp);
                    return;
                }
                case "PageDown": {
                    event.preventDefault();
                    const pageDown = visiblePhotos[Math.min(
                        visiblePhotos.length - 1,
                        index + pageSize
                    )];
                    performSelectionMove(pageDown, event.shiftKey);
                    focusPhoto(pageDown);
                    return;
                }
                case "Enter":
                    event.preventDefault();
                    previewSelectedSet();
                    return;
                default:
                    return;
            }
        };

        const handleKeyUp = event => {
            const key = event.key?.toLowerCase();
            if (key === " " || key === "spacebar") {
                if (previewOpenOnSpaceRef.current) {
                    event.preventDefault();
                    closePreview();
                }
            }
        };

        // UXP routes panel key events through the document focus path; window
        // listeners can miss Cmd/Ctrl+A before it bubbles. Capture preserves
        // the focused browser/control while intercepting the host shortcut.
        document.addEventListener("keydown", handleKeyDown, true);
        document.addEventListener("keyup", handleKeyUp, true);
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            document.removeEventListener("keyup", handleKeyUp, true);
        };
    }, [
        clearSelected,
        activeBurstGroup,
        activeBurstPhoto,
        activeBurstPhotos.length,
        closeBurstReview,
        changePreviewDecision,
        closePreview,
        focusedPhotoId,
        focusPhoto,
        handleRedoSelection,
        handleUndoSelection,
        movePreviewBy,
        performSelectionMove,
        previewOpenOnSpaceRef,
        previewPhoto,
        decisionForPhoto,
        previewPhotos.length,
        setPreviewPhoto,
        isPreviewOpen,
        openBurstReview,
        previewSelectedSet,
        rejectSelected,
        selectAllPhotos,
        selectedPhotos.length,
        setSelectedFavorite,
        setSelectedRating,
        toggleBurstDraft,
        visiblePhotos
    ]);

    return (
        <section className="photo-browser-shell" aria-label="Photo browser">
            {/* Primary Action Bar (Row 1) */}
            <div className="photo-browser-toolbar" role="toolbar" aria-label="Primary photo controls">
                {/* 1. View / Source Group */}
                <div className="photo-browser-toolbar-group photo-browser-view-group" aria-label="View and source options">
                    {[
                        ["icons", "▦", "Icons"],
                        ["list", "☷", "List"]
                    ].map(([mode, icon, label]) => (
                        <button
                            key={mode}
                            type="button"
                            onClick={() => switchView(mode)}
                            aria-pressed={viewMode === mode}
                            aria-label={`Show photos in ${label.toLowerCase()} view`}
                            title={`${label} view`}
                            className={`photo-browser-control photo-browser-view-button${viewMode === mode ? " is-active" : ""}`}
                        >
                            <span className="photo-browser-control-icon" aria-hidden="true">{icon}</span>
                            {label}
                        </button>
                    ))}
                </div>

                {/* 2. Discovery Group */}
                <div className="photo-browser-toolbar-group photo-browser-search-group" aria-label="Search">
                    <input
                        id="photo-browser-search"
                        type="search"
                        value={preferences.search}
                        onChange={event => updatePreferences(
                            { search: event.target.value },
                            { persist: false }
                        )}
                        onBlur={() => persistPreferences(preferences)}
                        onKeyDown={event => {
                            if (event.key === "Enter") {
                                persistPreferences(preferences);
                                event.currentTarget.blur?.();
                            }
                        }}
                        className="photo-browser-search-input photo-browser-control"
                        placeholder="🔍 Search filename…"
                        aria-label="Search photos by filename"
                    />
                </div>

                {/* 3. Sort & Selection Group */}
                <div className="photo-browser-toolbar-group photo-browser-sort-group" aria-label="Sort and selection">
                    <UxpDropdown
                        id="photo-browser-sort"
                        value={groupMode === "none"
                            ? `sort:${preferences.sort.field}`
                            : `group:${groupMode}`}
                        options={PHOTO_SORT_OPTIONS}
                        onValueChange={value => {
                            const [kind, field] = String(value).split(":");
                            if (kind === "sort") {
                                setGroupMode("none");
                                updateSort({ field });
                            } else {
                                setGroupMode(field || "none");
                            }
                        }}
                        className="photo-browser-sort-select photo-browser-control"
                        ariaLabel="Sort and group photos"
                        title="Sort and group photos"
                    />
                    <button
                        type="button"
                        onClick={() => updateSort({ direction: preferences.sort.direction === "asc" ? "desc" : "asc" })}
                        title={`Sort ${preferences.sort.direction === "asc" ? "ascending" : "descending"}`}
                        aria-label="Toggle sort direction"
                        className="photo-browser-control photo-browser-direction-button"
                    >
                        {preferences.sort.direction === "asc" ? "↑" : "↓"}
                    </button>
                    <button
                        type="button"
                        onClick={selectAllPhotos}
                        disabled={!visiblePhotos.length}
                        className="photo-browser-control"
                        title="Select all photos"
                        aria-label="Select all photos"
                    >
                        Select All
                    </button>
                    <button
                        type="button"
                        onClick={clearSelected}
                        disabled={!selectedCount}
                        className="photo-browser-control"
                        title="Deselect all photos"
                        aria-label="Deselect all photos"
                    >
                        Deselect
                    </button>
                </div>
                <div className="photo-browser-toolbar-group photo-browser-selected-actions-group">
                    <button
                        type="button"
                        onClick={previewSelectedSet}
                        disabled={!previewPhotos.length}
                        className="photo-browser-control"
                        title={selectedPhotos.length ? "Preview selected photos" : "Preview visible photos"}
                        aria-label={selectedPhotos.length ? "Preview selected photos" : "Preview visible photos"}
                    >
                        Preview
                    </button>
                    {[1, 2, 3, 4, 5].map(rating => (
                        <button
                            key={rating}
                            type="button"
                            onClick={() => setSelectedRating(rating)}
                            disabled={!selectedPhotos.length}
                            className="photo-browser-control photo-browser-rating-action"
                            title={`Assign ${rating}-star rating`}
                            aria-label={`Assign ${rating}-star rating`}
                        >
                            {rating}★
                        </button>
                    ))}
                    <button
                        type="button"
                        onClick={() => setSelectedRating(0)}
                        disabled={!selectedPhotos.length}
                        className="photo-browser-control"
                        title="Clear rating"
                        aria-label="Clear rating"
                    >
                        Unrate
                    </button>
                    <button
                        type="button"
                        onClick={setSelectedFavorite}
                        disabled={!selectedPhotos.length}
                        className="photo-browser-control"
                        title="Toggle favourite"
                        aria-label="Toggle favourite"
                    >
                        ❤
                    </button>
                    <button
                        type="button"
                        onClick={rejectSelected}
                        disabled={!selectedPhotos.length}
                        className="photo-browser-control"
                        title="Toggle rejected state for selected photos"
                        aria-label="Reject or unreject selected photos"
                    >
                        Reject
                    </button>
                    <button
                        type="button"
                        onClick={moveSelectedToNewEvent}
                        disabled={!selectedPhotos.length}
                        className="photo-browser-control"
                        title="Create a new event from selected photos"
                        aria-label="Create new event from selected photos"
                    >
                        New Event
                    </button>
                    <UxpDropdown
                        value=""
                        options={[
                            { value: "", label: "Move to Event…" },
                            ...eventChapters.items.map(chapter => ({
                                value: chapter.chapterId,
                                label: `${chapter.name} (${chapter.photoKeys.length})`
                            })),
                            { value: "unassigned", label: "Remove from Event" }
                        ]}
                        onValueChange={moveSelectedToEvent}
                        disabled={!selectedPhotos.length || !eventChapters.items.length}
                        className="photo-browser-control"
                        ariaLabel="Move selected photos to an existing event"
                    />
                </div>
            </div>

            {/* Workflow & Filter Toolbar (Row 2) */}
            {photos.length > 0 && (
                <div className="photo-culling-toolbar" role="toolbar" aria-label="Workflow and filter controls">
                    {/* 1. Culling Workflow Group */}
                    <div className="photo-culling-pills" aria-label="Culling workflow">
                        <span className="culling-label">Review:</span>
                        <button
                            type="button"
                            className={`culling-pill${cullingFilter === CullingFilterMode.ALL ? " active" : ""}`}
                            onClick={() => setCullingFilter(CullingFilterMode.ALL)}
                        >
                            All ({cullingSummary.total})
                        </button>
                        <button
                            type="button"
                            className={`culling-pill included-pill${cullingFilter === CullingFilterMode.INCLUDED ? " active" : ""}`}
                            onClick={() => setCullingFilter(CullingFilterMode.INCLUDED)}
                        >
                            Included ({cullingSummary.included})
                        </button>
                        <button
                            type="button"
                            className={`culling-pill reject-pill${cullingFilter === CullingFilterMode.REJECTED ? " active" : ""}`}
                            onClick={() => setCullingFilter(CullingFilterMode.REJECTED)}
                        >
                            ✕ Rejected ({cullingSummary.rejected})
                        </button>
                        <button
                            type="button"
                            className="photo-browser-control culling-action-btn"
                            onClick={() => openBurstReview()}
                            disabled={!burstGroups.length}
                            title="Review burst groups with AI best picks"
                        >
                            Burst Review ({burstsNeedingReview} remaining · {burstGroups.length} total)
                        </button>
                    </div>

                    {/* 2. Metadata & Decision Filters Group */}
                    <div className="photo-filter-inline-group" aria-label="Metadata and decision filters">
                        <UxpDropdown
                            id="photo-browser-type"
                            value={preferences.types[0] || ""}
                            options={[
                                { value: "", label: "File: All" },
                                ...queryResult.facets.types.map(type => ({
                                    value: type,
                                    label: `File: ${type.toUpperCase()}`
                                }))
                            ]}
                            onValueChange={type => updatePreferences({
                                types: type ? [type] : []
                            })}
                            className="photo-browser-filter-select photo-browser-control"
                            ariaLabel="Filter photos by file format"
                        />
                        <div className="photo-rating-filter" role="group" aria-label="Rating filter">
                            <UxpDropdown
                                id="photo-browser-rating-comparison"
                                value={PHOTO_RATING_COMPARISON_OPTIONS.some(option => option.value === preferences.ratingFilter.mode)
                                    ? preferences.ratingFilter.mode
                                    : "exact"}
                                options={PHOTO_RATING_COMPARISON_OPTIONS}
                                onValueChange={mode => updatePreferences({
                                    ratingFilter: {
                                        mode,
                                        value: preferences.ratingFilter.value || 1
                                    }
                                })}
                                className="photo-rating-comparison photo-browser-control"
                                ariaLabel="Rating comparison"
                            />
                            <button
                                type="button"
                                className={`photo-rating-unrated${preferences.ratingFilter.mode === "unrated" ? " is-active" : ""}`}
                                onClick={() => updatePreferences({
                                    ratingFilter: preferences.ratingFilter.mode === "unrated"
                                        ? { mode: "any", value: 0 }
                                        : { mode: "unrated", value: 0 }
                                })}
                                aria-pressed={preferences.ratingFilter.mode === "unrated"}
                                title="Show unrated photos"
                            >
                                Unrated
                            </button>
                            <div className="photo-rating-stars" aria-label="Choose rating value">
                                {[1, 2, 3, 4, 5].map(rating => {
                                    const hasRatingFilter = ["exact", "atLeast", "atMost"].includes(preferences.ratingFilter.mode);
                                    const isFilled = hasRatingFilter && rating <= preferences.ratingFilter.value;
                                    const isCurrent = hasRatingFilter && rating === preferences.ratingFilter.value;
                                    return (
                                        <button
                                            key={rating}
                                            type="button"
                                            className={isFilled ? "is-filled" : ""}
                                            onClick={() => updatePreferences({
                                                ratingFilter: isCurrent
                                                    ? { mode: "any", value: 0 }
                                                    : {
                                                        mode: hasRatingFilter
                                                            ? preferences.ratingFilter.mode
                                                            : "exact",
                                                        value: rating
                                                    }
                                            })}
                                            aria-pressed={isCurrent}
                                            aria-label={`Filter by ${rating} star rating`}
                                            title="Click the active star again to clear"
                                        >
                                            ★
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <UxpDropdown
                            id="photo-browser-orientation"
                            value={preferences.orientations[0] || ""}
                            options={[
                                { value: "", label: "Orientation: All" },
                                ...queryResult.facets.orientations.map(orientation => ({
                                    value: orientation,
                                    label: `Orientation: ${orientation.charAt(0).toUpperCase() + orientation.slice(1)}`
                                }))
                            ]}
                            onValueChange={orientation => updatePreferences({
                                orientations: orientation ? [orientation] : []
                            })}
                            className="photo-browser-filter-select photo-browser-control"
                            ariaLabel="Filter photos by orientation"
                        />
                        {duplicateReady && (
                            <label
                                className="photo-browser-favorite-filter"
                                style={{ marginLeft: 4 }}
                                title="Show only duplicate photos"
                            >
                                <input
                                    type="checkbox"
                                    checked={preferences.duplicatesOnly}
                                    onChange={event => updatePreferences({
                                        duplicatesOnly: event.target.checked
                                    })}
                                />
                                ⊕ Dups only
                            </label>
                        )}
                        <button
                            type="button"
                            onClick={analyzeDuplicates}
                            disabled={!folderLoaded || !photos.length || duplicateBusy}
                            className="photo-browser-control"
                            aria-label="Analyze exact duplicate photos"
                            title="Compare same-size candidates using full-content SHA-256"
                            style={{ fontSize: 10, padding: "3px 6px", minHeight: 24 }}
                        >
                            {duplicateBusy
                                ? "Analyzing…"
                                : duplicateReady
                                    ? "Reanalyze Dups"
                                    : "Find Dups"}
                        </button>
                        {filtersActive && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="photo-browser-control photo-browser-clear-btn"
                                aria-label="Reset photo filters"
                                title="Reset active search and filters"
                                style={{ background: "#4a2020", borderColor: "#7a3030", color: "#ffaaaa", fontSize: 10, padding: "3px 6px", minHeight: 24 }}
                            >
                                ✕ Reset Filters
                            </button>
                        )}
                    </div>
                </div>
            )}

            <div className="photo-library-source-actions" role="toolbar" aria-label="Library source actions">
                <button
                    type="button"
                    className="photo-browser-control photo-browser-primary-button"
                    onClick={onOpenFolder}
                    disabled={isLoading}
                >
                    Add Folder
                </button>
                <button
                    type="button"
                    className="photo-browser-control"
                    onClick={onChangePhotoFolder}
                    disabled={!canChangePhotoFolder}
                >
                    Change Folder
                </button>
                <button
                    type="button"
                    className="photo-browser-control"
                    onClick={onRefresh}
                    disabled={!folderLoaded || isLoading}
                >
                    Refresh
                </button>
            </div>

            <div className="photo-library-workspace">
                <aside className="photo-library-sidebar" aria-label="Library filters">
                    <section>
                        <h3>Quick Filters</h3>
                        <button
                            type="button"
                            className={`photo-facet-button${preferences.favoritesOnly ? " is-active" : ""}`}
                            onClick={() => updatePreferences({ favoritesOnly: !preferences.favoritesOnly })}
                        >
                            Favorites
                        </button>
                    </section>
                    <section>
                        <h3>Photo Type</h3>
                        <button
                            type="button"
                            className={`photo-facet-button${!selectedPhotoKindKeys.size ? " is-active" : ""}`}
                            onClick={() => setSelectedPhotoKindKeys(new Set())}
                        >
                            <span>All Photo Types</span><small>{photos.length}</small>
                        </button>
                        {photoKindFacets.map(kind => (
                            <button
                                key={kind.key}
                                type="button"
                                className={`photo-facet-button${selectedPhotoKindKeys.has(kind.key) ? " is-active" : ""}`}
                                onClick={event => toggleFacet(setSelectedPhotoKindKeys, kind.key, event)}
                            >
                                <span>{kind.label}</span>
                                <small>{kind.count}</small>
                            </button>
                        ))}
                    </section>
                    <section>
                        <h3>Events</h3>
                        <button type="button" className={`photo-facet-button${!selectedEventIds.size ? " is-active" : ""}`} onClick={() => setSelectedEventIds(new Set())}>All Events</button>
                        {smartEvents.map(event => (
                            <button
                                key={event.eventId}
                                type="button"
                                className={`photo-facet-button${selectedEventIds.has(event.eventId) ? " is-active" : ""}`}
                                onClick={click => toggleFacet(setSelectedEventIds, event.eventId, click)}
                            >
                                <span>{event.label}</span><small>{event.count}</small>
                            </button>
                        ))}
                        {eventChapters.items.map(chapter => (
                            <button
                                type="button"
                                className={`photo-event-chapter-row${selectedChapterIds.has(chapter.chapterId) ? " is-active" : ""}`}
                                key={chapter.chapterId}
                                onClick={event => toggleFacet(setSelectedChapterIds, chapter.chapterId, event)}
                                onDragOver={event => {
                                    event.preventDefault();
                                    if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
                                }}
                                onDrop={event => handleEventDrop(event, chapter.chapterId)}
                                title="Filter this event or drop selected photos here"
                            >
                                <span>{chapter.name}</span>
                                <small>{chapter.photoKeys.length}</small>
                            </button>
                        ))}
                    </section>
                    <section>
                        <h3>Cameras</h3>
                        <button type="button" className={`photo-facet-button${!selectedCameraKeys.size ? " is-active" : ""}`} onClick={() => setSelectedCameraKeys(new Set())}>All Cameras</button>
                        {detectedCameras.map(camera => {
                            const sample = photos.find(photo => getCameraKey(photo) === camera.cameraKey);
                            const identity = cameraIdentityForPhoto(sample);
                            return (
                                <button
                                    key={camera.cameraKey}
                                    type="button"
                                    className={`photo-facet-button${selectedCameraKeys.has(camera.cameraKey) ? " is-active" : ""}`}
                                    onClick={click => toggleFacet(setSelectedCameraKeys, camera.cameraKey, click)}
                                >
                                    <span style={{ color: identity?.color }}>{identity?.tag || "C"}</span>
                                    <span>{camera.label}</span><small>{camera.photoCount}</small>
                                </button>
                            );
                        })}
                    </section>
                    {filtersActive && <button type="button" className="photo-browser-control" onClick={clearFilters}>Reset All Filters</button>}
                </aside>
                <div className="photo-browser-content">
                {photoFolderChange?.message && !isLoading && (
                    <div className="photo-folder-change-message" role="status" aria-live="polite">
                        {photoFolderChange.message}
                    </div>
                )}
                {decisionError && (
                    <div className="photo-decision-error" role="alert">
                        {decisionError}
                    </div>
                )}
                {(duplicateReady || duplicateError || duplicateEvidence.status === PhotoDuplicateStatus.STALE) && (
                    <div
                        className={`photo-duplicate-summary${duplicateError ? " has-error" : ""}`}
                        role={duplicateError ? "alert" : "status"}
                        aria-live="polite"
                    >
                        {duplicateError || duplicateSummary}
                    </div>
                )}
                {isLoading ? (
                    <div className="photo-browser-state photo-browser-loading-state" role="status" aria-live="polite">
                        <div className="photo-browser-spinner" aria-hidden="true" />
                        <h2>Loading Photos...</h2>
                        <p>{loadingPhotoCount} {loadingPhotoCount === 1 ? "photo" : "photos"} found</p>
                    </div>
                ) : !photos.length ? (
                    <div className="photo-browser-state" role="status">
                        <div className="photo-browser-empty-icon" aria-hidden="true">📁</div>
                        <h2>Open a Photo Folder</h2>
                        <p>Choose a folder containing your album photographs.</p>
                        {folderMessage && (
                            <p className="photo-browser-folder-message">
                                {folderMessage}
                            </p>
                        )}
                        <button
                            type="button"
                            onClick={onOpenFolder}
                            disabled={isLoading}
                            className="photo-browser-control photo-browser-primary-button"
                            title="Open a photo folder"
                            aria-label="Open photo folder"
                        >
                            Open Folder
                        </button>
                    </div>
                ) : !visiblePhotos.length ? (
                    <div className="photo-browser-state" role="status">
                        <div className="photo-browser-empty-icon" aria-hidden="true">⌕</div>
                        <h2>No Matching Photos</h2>
                        <p>Try a different filename, type, orientation, date, rating, or duplicate filter.</p>
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="photo-browser-control photo-browser-primary-button"
                        >
                            Clear Filters
                        </button>
                    </div>
                ) : (
                    <ThumbnailGrid
                        photos={visiblePhotos}
                        onPhotoClick={onPhotoClick}
                        onContextMenu={handleContextMenu}
                        onPhotoInteraction={handlePhotoGridInteraction}
                        focusedPhotoId={focusedPhotoId}
                        onFocusPhoto={focusPhoto}
                        viewMode={viewMode}
                        decisionForPhoto={decisionForPhoto}
                        cameraIdentityForPhoto={cameraIdentityForPhoto}
                        groupLabelForPhoto={groupLabelForPhoto}
                        eventLabelForPhoto={eventLabelForPhoto}
                        sort={preferences.sort}
                        thumbnailSize={preferences.thumbnailSize}
                        onSortChange={changeListSort}
                        onPhotoDecisionChange={changeTargetDecision}
                    />
                )}
                </div>
                <aside className="photo-library-inspector" aria-label="Photo inspector">
                    <h3>Inspector</h3>
                    {focusedPhoto ? (
                        <>
                            <div className="photo-inspector-preview"><PhotoImage photo={focusedPhoto} profile="thumbnail" priority={1} role="browser" alt={focusedPhoto.name} /></div>
                            <div className="photo-inspector-summary">
                                <strong>{focusedPhoto.name}</strong>
                                <span>
                                    <b style={{ color: cameraIdentityForPhoto(focusedPhoto)?.color }}>
                                        {cameraIdentityForPhoto(focusedPhoto)?.tag || "—"}
                                    </b>
                                    {" · "}{eventLabelForPhoto(focusedPhoto) || "Unassigned event"}
                                </span>
                                <span>{"★".repeat(decisionForPhoto(focusedPhoto).rating || 0)}{"☆".repeat(5 - (decisionForPhoto(focusedPhoto).rating || 0))} · {decisionForPhoto(focusedPhoto).favorite ? "Favorite" : "Not favorite"}</span>
                                <span>{decisionForPhoto(focusedPhoto).culling === CullingStatus.REJECT ? "Rejected" : "Included"}</span>
                            </div>
                            <button
                                type="button"
                                className="photo-inspector-disclosure"
                                onClick={() => setInspectorFileOpen(value => !value)}
                                aria-expanded={inspectorFileOpen}
                            >
                                <span>File Properties</span>
                                <span>{inspectorFileOpen ? "−" : "+"}</span>
                            </button>
                            {inspectorFileOpen && (
                                <div className="photo-inspector-properties">
                                    <span><b>Type</b>{(focusedPhoto.extension || focusedPhoto.name?.split(".").pop() || "Unknown").toUpperCase()}</span>
                                    <span><b>Dimensions</b>{focusedPhoto.width && focusedPhoto.height ? `${focusedPhoto.width} × ${focusedPhoto.height}` : "Unavailable"}</span>
                                    <span><b>File size</b>{formatPhotoBytes(focusedPhoto)}</span>
                                    <span><b>Created</b>{formatPhotoDate(focusedPhoto.created)}</span>
                                    <span><b>Capture time</b>{formatPhotoDate(focusedPhoto.dateTaken || focusedPhoto.metadata?.dateTaken)}</span>
                                    <span><b>Camera</b>{focusedPhoto.cameraModel || focusedPhoto.metadata?.cameraModel || "Unknown"}</span>
                                </div>
                            )}
                        </>
                    ) : <span>Select a photo to inspect it.</span>}
                </aside>
            </div>

            {isPreviewOpen && previewPhoto && (
                <div
                    className="photo-preview-backdrop"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) {
                            closePreview();
                        }
                    }}
                >
                    <section
                        className="photo-preview-dialog"
                        role="dialog"
                        aria-label="Photo preview"
                        aria-modal="true"
                        onMouseDown={event => event.stopPropagation()}
                    >
                        <div className="photo-preview-header">
                            <strong>
                                {previewIndex + 1} / {previewPhotos.length}
                            </strong>
                            <button
                                type="button"
                                className="photo-browser-control photo-browser-preview-close"
                                onClick={closePreview}
                                aria-label="Close preview"
                                title="Close preview"
                            >
                                Close
                            </button>
                        </div>
                        <div
                            className="photo-preview-stage"
                            ref={previewStageRef}
                            onWheel={handlePreviewWheel}
                            onMouseDown={handlePreviewMouseDown}
                            onDoubleClick={togglePreviewScale}
                        >
                            <PhotoImage
                                photo={previewPhoto}
                                profile="preview"
                                priority={1}
                                role="browser"
                                onImageLoad={() => {
                                    PhotoBrowserPerformance.recordRender("PhotoPreview");
                                }}
                                alt={previewPhoto.name || "Photo preview"}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    pointerEvents: "none",
                                    transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale})`,
                                    transformOrigin: "center center"
                                }}
                            />
                        </div>
                        <div className="photo-preview-details">
                            <span>
                                {previewDetails[0]}
                            </span>
                            {previewDetails.slice(1).map(detail => (
                                <span key={detail}>{detail}</span>
                            ))}
                            <div className="photo-preview-actions">
                                <button type="button" onClick={() => movePreviewBy(-1)}>Previous</button>
                                {[1, 2, 3, 4, 5].map(rating => (
                                    <button
                                        key={rating}
                                        type="button"
                                        onClick={() => changePreviewDecision({
                                            rating: decisionForPhoto(previewPhoto).rating === rating
                                                ? 0
                                                : rating
                                        })}
                                        aria-pressed={decisionForPhoto(previewPhoto).rating === rating}
                                    >
                                        {rating}★
                                    </button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => changePreviewDecision({
                                        favorite: !decisionForPhoto(previewPhoto).favorite
                                    })}
                                >
                                    {decisionForPhoto(previewPhoto).favorite ? "♥ Favorite" : "♡ Favorite"}
                                </button>
                                <button type="button" onClick={() => movePreviewBy(1)}>Next</button>
                            </div>
                        </div>
                    </section>
                </div>
            )}

            {activeBurstGroup && activeBurstPhoto && (
                <div
                    className="photo-preview-backdrop"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) closeBurstReview();
                    }}
                >
                    <section className="photo-preview-dialog photo-burst-review" role="dialog" aria-modal="true" aria-label="Burst Review">
                        <div className="photo-preview-header">
                            <strong>Burst Review · {burstReviewIndex + 1}/{activeBurstPhotos.length}</strong>
                            <span>{reviewedBurstIds.has(activeBurstGroup.groupId) ? "Reviewed" : "Needs review"}</span>
                            <span>{burstDraftIds.size} selected</span>
                            <button type="button" onClick={closeBurstReview}>Close</button>
                        </div>
                        <div
                            className="photo-preview-stage"
                            ref={previewStageRef}
                            onWheel={handlePreviewWheel}
                            onMouseDown={handlePreviewMouseDown}
                            onDoubleClick={togglePreviewScale}
                        >
                            <PhotoImage
                                photo={activeBurstPhoto}
                                profile="preview"
                                priority={1}
                                role="browser"
                                alt={activeBurstPhoto.name || "Burst frame"}
                                style={{
                                    width: "100%",
                                    height: "100%",
                                    objectFit: "contain",
                                    pointerEvents: "none",
                                    transform: `translate(${previewOffset.x}px, ${previewOffset.y}px) scale(${previewScale})`,
                                    transformOrigin: "center center"
                                }}
                            />
                        </div>
                        <div className="photo-preview-details photo-burst-details">
                            <span>{activeBurstPhoto.name}</span>
                            <span>
                                <strong style={{ color: cameraIdentityForPhoto(activeBurstPhoto)?.color }}>
                                    {cameraIdentityForPhoto(activeBurstPhoto)?.tag || "—"}
                                </strong>
                                {" · "}{activeBurstPhoto.cameraModel || activeBurstPhoto.metadata?.cameraModel || "Unknown camera"}
                            </span>
                            <span>{activeBurstPhoto.width && activeBurstPhoto.height ? `${activeBurstPhoto.width} × ${activeBurstPhoto.height}` : "Dimensions unavailable"}</span>
                            <span>
                                Rating: {"★".repeat(decisionForPhoto(activeBurstPhoto).rating || 0)}{"☆".repeat(5 - (decisionForPhoto(activeBurstPhoto).rating || 0))}
                            </span>
                            <span>{previewScale.toFixed(2)}× · wheel to zoom · drag to pan</span>
                            <div className="photo-preview-zoom-controls" role="toolbar" aria-label="Burst preview navigation and zoom">
                                <button type="button" onClick={() => setBurstReviewIndex(previous => Math.max(0, previous - 1))} disabled={burstReviewIndex === 0}>Previous</button>
                                <button type="button" onClick={() => changePreviewScale(-0.25)} disabled={previewScale <= 0.25}>−</button>
                                <button type="button" onClick={fitPreview}>Fit</button>
                                <button type="button" onClick={() => changePreviewScale(0.25)} disabled={previewScale >= 4}>+</button>
                                <button type="button" onClick={() => setBurstReviewIndex(previous => Math.min(activeBurstPhotos.length - 1, previous + 1))} disabled={burstReviewIndex >= activeBurstPhotos.length - 1}>Next</button>
                            </div>
                        </div>
                        <div className="photo-burst-strip" role="listbox" aria-label="Burst frames">
                            {activeBurstPhotos.map((photo, index) => (
                                <div
                                    key={photo.id}
                                    className={`photo-burst-frame${index === burstReviewIndex ? " is-active" : ""}${burstDraftIds.has(photo.id) ? " is-picked" : ""}`}
                                    onClick={() => setBurstReviewIndex(index)}
                                    onDoubleClick={() => toggleBurstDraft(photo)}
                                    onKeyDown={event => {
                                        if (event.key === "Enter") {
                                            event.preventDefault();
                                            setBurstReviewIndex(index);
                                        }
                                        if (event.key === " ") {
                                            event.preventDefault();
                                            setBurstReviewIndex(index);
                                            toggleBurstDraft(photo);
                                        }
                                    }}
                                    role="option"
                                    tabIndex={0}
                                    aria-selected={burstDraftIds.has(photo.id)}
                                >
                                    <PhotoImage photo={photo} profile="thumbnail" priority={1} role="browser" alt={photo.name} />
                                    <span>{burstDraftIds.has(photo.id) ? "Selected" : "Reject"}</span>
                                </div>
                            ))}
                        </div>
                        <div className="photo-burst-actions">
                            <button
                                type="button"
                                onClick={() => setBurstDraftIds(new Set([activeBurstGroup.bestPhotoId]))}
                            >
                                Reset to AI Pick
                            </button>
                            <button type="button" onClick={() => toggleBurstDraft(activeBurstPhoto)}>
                                {burstDraftIds.has(activeBurstPhoto.id) ? "Remove Pick" : "Add Pick"}
                            </button>
                            <button type="button" className="photo-browser-primary-button" onClick={applyActiveBurstReview} disabled={burstReviewBusy}>
                                {burstReviewBusy ? "Applying…" : "Apply Review"}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            {photoFolderChange?.prepared && (
                <div className="photo-folder-change-backdrop" role="presentation">
                    <section
                        className="photo-folder-change-dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="change-photo-folder-title"
                    >
                        <h2 id="change-photo-folder-title">Change Photo Folder?</h2>
                        <p><strong>{photoFolderChange.prepared.folderName || "Selected folder"}</strong> contains {photoFolderChange.prepared.counts?.browserRenderableImages || 0} supported {photoFolderChange.prepared.counts?.browserRenderableImages === 1 ? "photo" : "photos"}.</p>
                        {(photoFolderChange.prepared.counts?.unsupportedRecognizedImages || 0) > 0 && (
                            <p>{photoFolderChange.prepared.counts.unsupportedRecognizedImages} recognized {photoFolderChange.prepared.counts.unsupportedRecognizedImages === 1 ? "image is" : "images are"} unsupported and will not be added.</p>
                        )}
                        <p>Changing folders reconciles the current photo selection with the new folder.</p>
                        {photoFolderChange.prepared.recoveryDecisionRequired && (
                            <label className="photo-folder-change-recovery">
                                <input
                                    type="checkbox"
                                    checked={photoFolderChange.clearRecovery}
                                    onChange={event => photoFolderChange.onRecoveryAcceptance(event.target.checked)}
                                    disabled={photoFolderChange.busy}
                                />
                                I understand that changing folders clears the saved batch recovery state.
                            </label>
                        )}
                        {photoFolderChange.error && (
                            <p className="photo-folder-change-error" role="alert">{photoFolderChange.error}</p>
                        )}
                        <div className="photo-folder-change-actions">
                            <button type="button" onClick={photoFolderChange.onCancel} disabled={photoFolderChange.busy}>Cancel</button>
                            <button
                                type="button"
                                className="photo-browser-primary-button"
                                onClick={photoFolderChange.onConfirm}
                                disabled={photoFolderChange.busy || (photoFolderChange.prepared.recoveryDecisionRequired && !photoFolderChange.clearRecovery)}
                            >
                                {photoFolderChange.busy ? "Changing…" : "Change Folder"}
                            </button>
                        </div>
                    </section>
                </div>
            )}

            <div className="photo-browser-statusbar" role="status" aria-label="Photo browser status">
                <span><strong>Results:</strong> {queryResult.counts.matched}/{queryResult.counts.total}</span>
                <span><strong>Selected:</strong> {selectedCount}</span>
                <span><strong>View:</strong> {viewMode === "icons" ? "Icons" : "List"}</span>
                <span>
                    <strong>Sort:</strong>{" "}
                    {preferences.sort.field === "name"
                        ? "Name"
                        : preferences.sort.field === "quality"
                            ? "Quality (AI)"
                            : preferences.sort.field === "modified"
                                ? "Date Modified"
                                : preferences.sort.field === "taken"
                                    ? "Date Taken"
                                    : preferences.sort.field === "created"
                                        ? "Date Created"
                                        : preferences.sort.field === "rating"
                                            ? "Rating"
                                            : preferences.sort.field === "size"
                                                ? "File Size"
                                                : preferences.sort.field}{" "}
                    {preferences.sort.direction === "asc" ? "↑" : "↓"}
                </span>
                {viewMode === "icons" && (
                    <span className="photo-thumbnail-size-control" aria-label="Thumbnail size">
                        <strong>Thumbnails:</strong>
                        <button
                            type="button"
                            onClick={() => updatePreferences({
                                thumbnailSize: Math.max(84, preferences.thumbnailSize - 20)
                            })}
                            disabled={preferences.thumbnailSize <= 84}
                            aria-label="Smaller thumbnails"
                            title="Smaller thumbnails"
                        >−</button>
                        <span>{preferences.thumbnailSize}px</span>
                        <button
                            type="button"
                            onClick={() => updatePreferences({
                                thumbnailSize: Math.min(144, preferences.thumbnailSize + 20)
                            })}
                            disabled={preferences.thumbnailSize >= 144}
                            aria-label="Larger thumbnails"
                            title="Larger thumbnails"
                        >+</button>
                    </span>
                )}
            </div>

            {contextMenu && (
                <div
                    className="photo-context-backdrop"
                    onClick={() => setContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                >
                    <div
                        className="photo-context-menu"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: "absolute",
                            top: Math.max(10, Math.min(contextMenu.y, 400)),
                            left: Math.max(10, Math.min(contextMenu.x, 350))
                        }}
                    >
                        <strong>{selectedCount} selected</strong>
                        <button
                            type="button"
                            onClick={() => {
                                moveSelectedToNewEvent();
                                setContextMenu(null);
                            }}
                        >
                            Move to New Event
                        </button>
                    </div>
                </div>
            )}

        </section>
    );

}

export default React.memo(PhotoBrowserSection);
