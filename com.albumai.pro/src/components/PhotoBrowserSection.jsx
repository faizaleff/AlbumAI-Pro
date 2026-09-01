import React, {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState
} from "react";

import ThumbnailGrid from "./ThumbnailGrid";
import UxpDropdown from "./UxpDropdown";
import SelectionCount from "./SelectionCount";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import {
    applyPhotoStoryOrder,
    assignPhotosToEventChapter,
    createPhotoDecisionLookup,
    createPhotoEventChapter,
    deleteEmptyPhotoEventChapter,
    findUnassignedPhotoEventChapterPhotos,
    hasActivePhotoBrowserFilters,
    movePhotosInStoryOrder,
    mergePhotoEventChapters,
    normalizePhotoDecisions,
    normalizePhotoBrowserPreferences,
    normalizePhotoEventChapters,
    normalizePhotoStoryOrder,
    photoDecisionKey,
    queryPhotoBrowser,
    removePhotosFromEventChapters,
    summarizePhotoEventChapterReview,
    movePhotoEventChapter,
    renamePhotoEventChapter,
    updatePhotoDecision
} from "../services/PhotoBrowserModel";
import { normalizePhotoDuplicateEvidence } from "../services/PhotoDuplicateModel";
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
    applyCameraClockCorrections,
    detectCameras,
    groupPhotosByEvent,
    normalizeCameraClockOffsets,
    updateCameraClockOffset
} from "../services/PhotoGroupingEngine";
import PhotoComparisonModal from "./PhotoComparisonModal";
import PhotoImage from "./PhotoImage";

const PHOTO_COLOR_LABELS = Object.freeze([
    Object.freeze({ value: 6, label: "Red", color: "#e24e5b" }),
    Object.freeze({ value: 7, label: "Yellow", color: "#e3ae38" }),
    Object.freeze({ value: 8, label: "Green", color: "#31a66f" })
]);

const PHOTO_SORT_OPTIONS = Object.freeze([
    Object.freeze({ value: "manual", label: "Manual Order" }),
    Object.freeze({ value: "name", label: "Name" }),
    Object.freeze({ value: "quality", label: "Quality (AI)" }),
    Object.freeze({ value: "modified", label: "Date Modified" }),
    Object.freeze({ value: "taken", label: "Date Taken" }),
    Object.freeze({ value: "created", label: "Date Created" }),
    Object.freeze({ value: "rating", label: "Rating" }),
    Object.freeze({ value: "size", label: "File Size" })
]);

const MANUAL_UNASSIGNED_EVENT_ID = "manual-unassigned";

function PhotoBrowserSection({
    photos,
    onPhotoClick,
    projectId,
    focusedPhotoId = null,
    onFocusPhoto,
    folderLoaded = false,
    folderMessage = null,
    onOpenFolder,
    onChangePhotoFolder,
    isLoading = false,
    loadingPhotoCount = 0,
    photoFolderChange = null,
    workflowStep = 1,
    onSelectPhotoStage,
    photoStageUnlocked = {},
    photoStageLockedReason = "",
    onContinueToSort,
    onSortStatusChange,
    onContinueToCull,
    onCullStatusChange,
    onContinueToEnhance
}) {

    const canChangePhotoFolder = canStartPhotoFolderChange({
        projectId,
        folderLoaded,
        isLoading,
        photoFolderChange
    });

    const [viewMode, setViewMode] = useState("icons");
    const [selectedCount, setSelectedCount] = useState(
        () => App.selection.selectedIds().size
    );
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
    const readSavedStoryOrder = () => normalizePhotoStoryOrder(
        App.project.getProject()?.metadata?.photoStoryOrder,
        photos
    );
    const [storyOrder, setStoryOrder] = useState(readSavedStoryOrder);
    const [storyOrderHistory, setStoryOrderHistory] = useState(() => ({
        items: [],
        index: -1
    }));
    const [storyOrderError, setStoryOrderError] = useState(null);
    const readSavedCameraClockOffsets = () => normalizeCameraClockOffsets(
        App.project.getProject()?.metadata?.cameraClockOffsets,
        detectCameras(photos)
    );
    const [cameraClockOffsets, setCameraClockOffsets] = useState(
        readSavedCameraClockOffsets
    );
    const [cameraTimesOpen, setCameraTimesOpen] = useState(false);
    const [cameraClockError, setCameraClockError] = useState(null);
    const readSavedEventChapters = () => normalizePhotoEventChapters(
        App.project.getProject()?.metadata?.photoEventChapters,
        photos
    );
    const [eventChapters, setEventChapters] = useState(readSavedEventChapters);
    const [eventChaptersOpen, setEventChaptersOpen] = useState(false);
    const [eventChapterError, setEventChapterError] = useState(null);
    const [decisions, setDecisions] = useState(
        () => normalizePhotoDecisions(App.getPhotoDecisions())
    );
    const [decisionError, setDecisionError] = useState(null);
    const [duplicateEvidence, setDuplicateEvidence] = useState(
        () => normalizePhotoDuplicateEvidence(
            App.getPhotoDuplicateEvidence()
        )
    );
    const [cullingFilter, setCullingFilter] = useState(CullingFilterMode.ALL);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [comparingPair, setComparingPair] = useState(null);
    const [cullingBusy, setCullingBusy] = useState(false);
    const [secondaryFiltersOpen, setSecondaryFiltersOpen] = useState(false);
    const [albumSelectsLocked, setAlbumSelectsLocked] = useState(true);
    const [quickPreviewPhoto, setQuickPreviewPhoto] = useState(null);
    const decisionRevision = useRef(0);

    const detectedCameras = useMemo(() => {
        if (!photos || photos.length === 0) return [];
        return detectCameras(photos);
    }, [photos]);
    const cameraCorrectionByKey = useMemo(() => new Map(
        cameraClockOffsets.items.map(item => [
            item.cameraKey,
            item.correctionMinutes
        ])
    ), [cameraClockOffsets]);

    const correctedPhotos = useMemo(() => applyCameraClockCorrections(
        photos,
        cameraClockOffsets,
        detectedCameras
    ), [cameraClockOffsets, detectedCameras, photos]);

    const smartEvents = useMemo(() => {
        if (!correctedPhotos.length) return [];
        return groupPhotosByEvent(correctedPhotos);
    }, [correctedPhotos]);
    const unassignedEventPhotos = useMemo(
        () => findUnassignedPhotoEventChapterPhotos(
            eventChapters,
            correctedPhotos
        ),
        [correctedPhotos, eventChapters]
    );
    const sortReview = useMemo(
        () => summarizePhotoEventChapterReview(eventChapters, correctedPhotos),
        [correctedPhotos, eventChapters]
    );
    const visibleEvents = useMemo(() => {
        if (!eventChapters.items.length) return smartEvents;
        const photoIdByKey = new Map(correctedPhotos.map(photo => [
            photoDecisionKey(photo),
            photo.id
        ]));
        const manualEvents = eventChapters.items.map(chapter => {
            const photoIds = chapter.photoKeys
                .map(key => photoIdByKey.get(key))
                .filter(Boolean);
            return Object.freeze({
                eventId: chapter.chapterId,
                label: chapter.name,
                photoIds: Object.freeze(photoIds),
                count: photoIds.length,
                manual: true
            });
        });
        return Object.freeze([
            ...manualEvents,
            Object.freeze({
                eventId: MANUAL_UNASSIGNED_EVENT_ID,
                label: "Unassigned",
                photoIds: Object.freeze(unassignedEventPhotos.map(photo => photo.id)),
                count: unassignedEventPhotos.length,
                manual: true,
                unassigned: true
            })
        ]);
    }, [correctedPhotos, eventChapters, smartEvents, unassignedEventPhotos]);

    const queryResult = useMemo(
        () => queryPhotoBrowser(correctedPhotos, preferences, {
            decisions,
            duplicateEvidence
        }),
        [correctedPhotos, decisions, duplicateEvidence, preferences]
    );
    const orderedQueryPhotos = useMemo(
        () => preferences.sort.field === "manual"
            ? applyPhotoStoryOrder(queryResult.photos, storyOrder)
            : queryResult.photos,
        [preferences.sort.field, queryResult.photos, storyOrder]
    );
    const decisionForPhoto = useMemo(
        () => createPhotoDecisionLookup(decisions),
        [decisions]
    );
    const workflowCullingFilter = workflowStep >= 2
        ? CullingFilterMode.KEPT
        : cullingFilter;
    const culledPhotos = useMemo(
        () => filterPhotosByCulling(orderedQueryPhotos, workflowCullingFilter, decisionForPhoto),
        [orderedQueryPhotos, workflowCullingFilter, decisionForPhoto]
    );
    const visiblePhotos = useMemo(() => {
        if (!selectedEventId) return culledPhotos;
        const targetEvent = visibleEvents.find(e => e.eventId === selectedEventId);
        if (!targetEvent) return culledPhotos;
        const allowed = new Set(targetEvent.photoIds);
        return culledPhotos.filter(p => allowed.has(p.id));
    }, [culledPhotos, selectedEventId, visibleEvents]);

    const filtersActive = hasActivePhotoBrowserFilters(preferences) || workflowCullingFilter !== CullingFilterMode.ALL || Boolean(selectedEventId);
    const orderFiltersActive = hasActivePhotoBrowserFilters(preferences) || Boolean(selectedEventId);
    const secondaryFilterCount = useMemo(() => [
        preferences.types.length > 0,
        preferences.ratingFilterActive,
        preferences.colorLabel > 0,
        preferences.orientations.length > 0
    ].filter(Boolean).length, [preferences]);

    const cullingSummary = useMemo(
        () => summarizeCulling(photos, decisionForPhoto, App.getPhotoBursts ? App.getPhotoBursts() : []),
        [photos, decisionForPhoto]
    );

    useEffect(() => {
        if (selectedEventId && !visibleEvents.some(
            event => event.eventId === selectedEventId
        )) {
            setSelectedEventId("");
        }
    }, [selectedEventId, visibleEvents]);

    useEffect(() => {
        onSortStatusChange?.(sortReview);
    }, [onSortStatusChange, sortReview]);

    useEffect(() => {
        onCullStatusChange?.(cullingSummary);
    }, [cullingSummary, onCullStatusChange]);

    useEffect(() => {
        if (workflowStep !== 3) setAlbumSelectsLocked(true);
    }, [workflowStep]);

    useEffect(() => {
        setPreferences(readSavedPreferences());
        setStoryOrder(readSavedStoryOrder());
        setStoryOrderHistory({ items: [], index: -1 });
        setStoryOrderError(null);
        setCameraClockOffsets(readSavedCameraClockOffsets());
        setCameraTimesOpen(false);
        setCameraClockError(null);
        setEventChapters(readSavedEventChapters());
        setEventChaptersOpen(false);
        setEventChapterError(null);
        setDecisions(normalizePhotoDecisions(App.getPhotoDecisions()));
        setDecisionError(null);
        setDuplicateEvidence(normalizePhotoDuplicateEvidence(
            App.getPhotoDuplicateEvidence()
        ));
        setDuplicateBusy(false);
        setDuplicateError(null);
        setSecondaryFiltersOpen(false);
        decisionRevision.current += 1;
    }, [projectId]);

    useEffect(() => {
        setDecisions(normalizePhotoDecisions(App.getPhotoDecisions()));
        setStoryOrder(previous => normalizePhotoStoryOrder(previous, photos));
        setStoryOrderHistory({ items: [], index: -1 });
        setCameraClockOffsets(previous => normalizeCameraClockOffsets(
            previous,
            detectCameras(photos)
        ));
        setEventChapters(previous => normalizePhotoEventChapters(
            previous,
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

    const persistStoryOrder = useCallback((order, nextPreferences) => {
        App.saveProject({
            photoStoryOrder: order,
            photoBrowserPreferences: nextPreferences
        }, { reason: "PHOTO_STORY_ORDER" }).catch(error => {
            setStoryOrderError("Manual photo order could not be saved.");
            console.warn("Photo story order persistence:", error);
        });
    }, []);

    const persistCameraClockOffsets = useCallback(value => {
        App.saveProject({ cameraClockOffsets: value }, {
            reason: "CAMERA_CLOCK_OFFSETS"
        }).catch(error => {
            setCameraClockError("Camera time corrections could not be saved.");
            console.warn("Camera clock correction persistence:", error);
        });
    }, []);

    const persistEventChapters = useCallback(value => {
        App.saveProject({ photoEventChapters: value }, {
            reason: "PHOTO_EVENT_CHAPTERS"
        }).catch(error => {
            setEventChapterError("Event chapters could not be saved.");
            console.warn("Photo event chapter persistence:", error);
        });
    }, []);

    const commitEventChapters = useCallback(value => {
        setEventChapterError(null);
        setEventChapters(value);
        persistEventChapters(value);
    }, [persistEventChapters]);

    const selectedChapterPhotos = useCallback(() => {
        const selectedIds = App.selection.selectedIds();
        return correctedPhotos.filter(photo => selectedIds.has(photo.id));
    }, [correctedPhotos]);

    const handleCreateEventChapter = useCallback(() => {
        const next = createPhotoEventChapter(
            eventChapters,
            selectedChapterPhotos(),
            correctedPhotos
        );
        commitEventChapters(next);
        setSelectedEventId(next.items[next.items.length - 1]?.chapterId || "");
    }, [commitEventChapters, correctedPhotos, eventChapters, selectedChapterPhotos]);

    const handleRenameEventChapter = useCallback((chapterId, name) => {
        commitEventChapters(renamePhotoEventChapter(
            eventChapters,
            chapterId,
            name,
            correctedPhotos
        ));
    }, [commitEventChapters, correctedPhotos, eventChapters]);

    const handleMoveEventChapter = useCallback((chapterId, direction) => {
        commitEventChapters(movePhotoEventChapter(
            eventChapters,
            chapterId,
            direction,
            correctedPhotos
        ));
    }, [commitEventChapters, correctedPhotos, eventChapters]);

    const handleDeleteEventChapter = useCallback(chapterId => {
        const chapter = eventChapters.items.find(
            item => item.chapterId === chapterId
        );
        if (!chapter || chapter.photoKeys.length) return;
        const next = deleteEmptyPhotoEventChapter(
            eventChapters,
            chapterId,
            correctedPhotos
        );
        commitEventChapters(next);
        if (selectedEventId === chapterId) setSelectedEventId("");
    }, [commitEventChapters, correctedPhotos, eventChapters, selectedEventId]);

    const handleMergeEventChapter = useCallback((chapterId, index) => {
        const targetChapterId = eventChapters.items[index - 1]?.chapterId;
        if (!targetChapterId) return;
        commitEventChapters(mergePhotoEventChapters(
            eventChapters,
            chapterId,
            targetChapterId,
            correctedPhotos
        ));
        setSelectedEventId(targetChapterId);
    }, [commitEventChapters, correctedPhotos, eventChapters]);

    const handleAssignEventChapter = useCallback(chapterId => {
        const selected = selectedChapterPhotos();
        if (!selected.length) return;
        commitEventChapters(assignPhotosToEventChapter(
            eventChapters,
            chapterId,
            selected,
            correctedPhotos
        ));
    }, [commitEventChapters, correctedPhotos, eventChapters, selectedChapterPhotos]);

    const handleRemoveEventChapterAssignment = useCallback(() => {
        const selected = selectedChapterPhotos();
        if (!selected.length) return;
        commitEventChapters(removePhotosFromEventChapters(
            eventChapters,
            selected,
            correctedPhotos
        ));
        setSelectedEventId(MANUAL_UNASSIGNED_EVENT_ID);
    }, [commitEventChapters, correctedPhotos, eventChapters, selectedChapterPhotos]);

    const handleReviewUnassigned = useCallback(selectPhotos => {
        setSelectedEventId(MANUAL_UNASSIGNED_EVENT_ID);
        if (!selectPhotos || !unassignedEventPhotos.length) return;
        App.selection.setOrderedPhotos(unassignedEventPhotos);
        setCanonicalBrowserPhotos(unassignedEventPhotos);
        App.selection.selectAll();
    }, [unassignedEventPhotos]);

    const handleCameraCorrection = useCallback((cameraKey, value) => {
        const next = updateCameraClockOffset(
            cameraClockOffsets,
            cameraKey,
            value,
            detectedCameras
        );
        setCameraClockError(null);
        setCameraClockOffsets(next);
        persistCameraClockOffsets(next);
    }, [cameraClockOffsets, detectedCameras, persistCameraClockOffsets]);

    const resetCameraCorrections = useCallback(() => {
        const next = normalizeCameraClockOffsets({}, detectedCameras);
        setCameraClockError(null);
        setCameraClockOffsets(next);
        persistCameraClockOffsets(next);
    }, [detectedCameras, persistCameraClockOffsets]);

    const clearFilters = useCallback(() => {
        setSelectedEventId("");
        setCullingFilter(CullingFilterMode.ALL);
        updatePreferences(previous => ({ sort: previous.sort }));
    }, [updatePreferences]);

    const activateManualOrder = useCallback(() => {
        if (orderFiltersActive) {
            setStoryOrderError("Clear filters before editing the full story order.");
            return;
        }
        setStoryOrderError(null);
        const baseline = storyOrder.items.length
            ? normalizePhotoStoryOrder(storyOrder, queryResult.photos)
            : normalizePhotoStoryOrder({
                items: queryResult.photos.map(photoDecisionKey).filter(Boolean)
            }, queryResult.photos);
        const nextPreferences = normalizePhotoBrowserPreferences({
            ...preferences,
            sort: { field: "manual", direction: "asc" }
        });
        setStoryOrder(baseline);
        setPreferences(nextPreferences);
        persistStoryOrder(baseline, nextPreferences);
    }, [orderFiltersActive, persistStoryOrder, preferences, queryResult.photos, storyOrder]);

    const handleSortFieldChange = useCallback(field => {
        if (field === "manual") activateManualOrder();
        else {
            setStoryOrderError(null);
            updateSort({ field });
        }
    }, [activateManualOrder, updateSort]);

    const commitStoryOrder = (order, nextPreferences = preferences) => {
        setStoryOrderError(null);
        setStoryOrder(order);
        setPreferences(nextPreferences);
        persistStoryOrder(order, nextPreferences);
    };

    const recordStoryOrder = (order, nextPreferences = preferences) => {
        const items = (storyOrderHistory.index < 0
            ? [storyOrder, order]
            : [...storyOrderHistory.items.slice(0, storyOrderHistory.index + 1), order]
        ).slice(-51);
        setStoryOrderHistory({ items, index: items.length - 1 });
        commitStoryOrder(order, nextPreferences);
    };

    const handleManualReorder = (sourcePhoto, targetPhoto) => {
        if (!sourcePhoto || !targetPhoto) return;
        if (orderFiltersActive) {
            setStoryOrderError("Clear filters before editing the full story order.");
            return;
        }
        const baseline = preferences.sort.field === "manual"
            ? applyPhotoStoryOrder(queryResult.photos, storyOrder)
            : queryResult.photos;
        const selectedIds = App.selection.selectedIds();
        const selectedPhotos = baseline.filter(photo => selectedIds.has(photo.id));
        const nextOrder = movePhotosInStoryOrder(
            storyOrder,
            baseline,
            sourcePhoto,
            targetPhoto,
            selectedPhotos
        );
        const nextPreferences = normalizePhotoBrowserPreferences({
            ...preferences,
            sort: { field: "manual", direction: "asc" }
        });
        if (nextOrder.items.join() === storyOrder.items.join()) return;
        recordStoryOrder(nextOrder, nextPreferences);
    };

    const handleStoryOrderTravel = redo => {
        const index = storyOrderHistory.index + (redo ? 1 : -1);
        if (index < 0 || index >= storyOrderHistory.items.length) return;
        setStoryOrderHistory({ ...storyOrderHistory, index });
        commitStoryOrder(storyOrderHistory.items[index]);
    };

    const handleStoryOrderReset = () => {
        if (orderFiltersActive) {
            setStoryOrderError("Clear filters before resetting the full story order.");
            return;
        }
        const dateTakenPreferences = normalizePhotoBrowserPreferences({
            ...preferences,
            sort: { field: "taken", direction: "asc" }
        });
        const baseline = queryPhotoBrowser(correctedPhotos, dateTakenPreferences, {
            decisions,
            duplicateEvidence
        }).photos;
        const nextOrder = normalizePhotoStoryOrder({
            items: baseline.map(photoDecisionKey).filter(Boolean)
        }, baseline);
        if (nextOrder.items.join() === storyOrder.items.join()) return;
        recordStoryOrder(nextOrder);
    };

    const changePhotoDecision = useCallback((photo, changes) => {
        const selectedIds = App.selection.selectedIds();
        const targets = selectedIds.has(photo?.id) && selectedIds.size > 1
            ? photos.filter(item => selectedIds.has(item.id))
            : [photo];
        const revision = ++decisionRevision.current;
        setDecisionError(null);
        setDecisions(previous => targets.reduce(
            (next, item) => updatePhotoDecision(next, item, changes),
            previous
        ));
        Promise.all(targets.map(item => App.updatePhotoDecision(item, changes)))
            .then(() => {
                if (decisionRevision.current === revision) {
                    setDecisions(normalizePhotoDecisions(App.getPhotoDecisions()));
                }
            })
            .catch(error => {
                if (decisionRevision.current === revision) {
                    setDecisions(normalizePhotoDecisions(
                        App.getPhotoDecisions()
                    ));
                    setDecisionError(
                        "Rating, label, or review status could not be saved."
                    );
                }
                console.warn("Photo decision persistence:", error);
            });
    }, [photos]);

    const handleAutoPickBurstBest = async () => {
        setCullingBusy(true);
        try {
            const next = await App.autoPickBurstBest();
            setDecisions(normalizePhotoDecisions(next));
        } catch (error) {
            setDecisionError("Failed to auto-pick burst best photos.");
        } finally {
            setCullingBusy(false);
        }
    };

    const startComparison = () => {
        const selectedIds = Array.from(App.selection.selectedIds());
        const selected = photos.filter(p => selectedIds.includes(p.id));
        if (selected.length >= 2) {
            setComparingPair([selected[0], selected[1]]);
        }
    };

    const handlePickKeepFromComparison = (keepId, rejectId) => {
        const keepPhoto = photos.find(p => p.id === keepId);
        if (keepPhoto) {
            changePhotoDecision(keepPhoto, { culling: CullingStatus.KEEP });
        }
        if (rejectId) {
            const rejectPhoto = photos.find(p => p.id === rejectId);
            if (rejectPhoto) {
                changePhotoDecision(rejectPhoto, { culling: CullingStatus.REJECT });
            }
        }
        setComparingPair(null);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.target && ["input", "textarea", "select"].includes(e.target.tagName?.toLowerCase())) {
                return;
            }
            const focused = photos.find(p => p.id === focusedPhotoId);
            if (!focused) return;
            const key = e.key?.toLowerCase();
            const editable = workflowStep === 1 ||
                (workflowStep === 3 && !albumSelectsLocked);
            if (!editable) return;
            if (key === "k") {
                changePhotoDecision(focused, { culling: CullingStatus.KEEP });
            } else if (key === "r" || key === "x") {
                changePhotoDecision(focused, { culling: CullingStatus.REJECT });
            } else if (key === "u") {
                changePhotoDecision(focused, { culling: CullingStatus.UNRATED });
            } else if (["0", "1", "2", "3", "4", "5"].includes(e.key)) {
                const requested = Number(e.key);
                const current = decisionForPhoto(focused)?.rating || 0;
                changePhotoDecision(focused, {
                    rating: requested === 0 || current === requested ? 0 : requested
                });
            } else if (["6", "7", "8"].includes(e.key)) {
                const current = decisionForPhoto(focused)?.colorLabel || 0;
                const next = current === Number(e.key) ? 0 : Number(e.key);
                changePhotoDecision(focused, { colorLabel: next });
            } else if (e.key === "9") {
                changePhotoDecision(focused, { colorLabel: 0 });
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [albumSelectsLocked, focusedPhotoId, photos, changePhotoDecision, decisionForPhoto, workflowStep]);

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
        setSelectedCount(selectedIds.size);
    }), []);

    useEffect(() => {
        const handleKeyDown = event => {
            const target = event.target?.closest
                ? event.target
                : event.target?.parentElement;
            const isEditable = !!target?.closest?.(
                "input, textarea, select, [contenteditable]"
            );
            const isSelectAll =
                (event.ctrlKey || event.metaKey) &&
                (event.key?.toLowerCase() === "a" ||
                    event.code === "KeyA");

            if (isEditable) return;

            if (isSelectAll && visiblePhotos.length) {
                event.preventDefault();
                // Keep select-all aligned with the canonical browser order,
                // including a sort change that has not yet reached its effect.
                PhotoBrowserPerformance.trace(
                    "BROWSER_SELECT_ALL_SHORTCUT",
                    { photos: visiblePhotos.length }
                );
                selectAllBrowserPhotos();
                PhotoBrowserPerformance.trace(
                    "BROWSER_SELECTION_OPERATION",
                    {
                        operation: "selectAll",
                        selected: visiblePhotos.length
                    }
                );
            } else if (event.key === "Escape") {
                App.selection.clear();
            } else if (visiblePhotos.length) {
                const currentIndex = Math.max(0, visiblePhotos.findIndex(
                    photo => photo?.id === focusedPhotoId
                ));
                const pageSize = 10;
                let nextIndex = null;

                switch (event.key) {
                    case "ArrowLeft":
                    case "ArrowUp":
                        nextIndex = Math.max(0, currentIndex - 1);
                        break;
                    case "ArrowRight":
                    case "ArrowDown":
                        nextIndex = Math.min(
                            visiblePhotos.length - 1,
                            currentIndex + 1
                        );
                        break;
                    case "Home":
                        nextIndex = 0;
                        break;
                    case "End":
                        nextIndex = visiblePhotos.length - 1;
                        break;
                    case "PageUp":
                        nextIndex = Math.max(0, currentIndex - pageSize);
                        break;
                    case "PageDown":
                        nextIndex = Math.min(
                            visiblePhotos.length - 1,
                            currentIndex + pageSize
                        );
                        break;
                    case " ":
                    case "Spacebar": {
                        const focused = visiblePhotos[currentIndex];
                        if (focused) {
                            event.preventDefault();
                            focusPhoto(focused);
                            setQuickPreviewPhoto(focused);
                        }
                        return;
                    }
                    case "Enter":
                        if (visiblePhotos[currentIndex]) {
                            event.preventDefault();
                            focusPhoto(visiblePhotos[currentIndex]);
                        }
                        return;
                    default:
                        return;
                }

                const next = visiblePhotos[nextIndex];
                if (next) {
                    event.preventDefault();
                    if (event.shiftKey) App.selection.range(next);
                    else if (event.ctrlKey || event.metaKey) App.selection.toggle(next);
                    else App.selection.select(next);
                    focusPhoto(next);
                }
            }
        };
        // UXP routes panel key events through the document focus path; window
        // listeners can miss Cmd/Ctrl+A before it bubbles. Capture preserves
        // the focused browser/control while intercepting the host shortcut.
        document.addEventListener("keydown", handleKeyDown, true);
        const handleKeyUp = event => {
            if (event.key === " " || event.key === "Spacebar") {
                setQuickPreviewPhoto(null);
            }
        };
        document.addEventListener("keyup", handleKeyUp, true);
        return () => {
            document.removeEventListener("keydown", handleKeyDown, true);
            document.removeEventListener("keyup", handleKeyUp, true);
        };
    }, [focusPhoto, focusedPhotoId, visiblePhotos]);

    return (
        <section className="photo-browser-shell" aria-label="Photo browser">
            <nav className="photo-stage-switch" role="tablist" aria-label="Photo workflow">
                {[
                    [1, "Library", true],
                    [2, "Sequence", photoStageUnlocked.sort],
                    [3, "Album Selects", photoStageUnlocked.cull]
                ].map(([step, label, unlocked]) => (
                    <button
                        key={step}
                        type="button"
                        role="tab"
                        aria-selected={workflowStep === step}
                        className={workflowStep === step ? "is-active" : ""}
                        disabled={!unlocked}
                        title={!unlocked && step === 3 ? photoStageLockedReason : undefined}
                        onClick={() => onSelectPhotoStage?.(step)}
                    >
                        {label}
                    </button>
                ))}
            </nav>
            <div className="photo-workflow-intro">
                <div>
                    <h2>
                        {workflowStep === 1
                            ? "Review the Library"
                            : workflowStep === 2
                                ? "Build the album sequence"
                                : "Review the final album selects"}
                    </h2>
                </div>
                <div className="photo-workflow-intro-actions">
                    <span>{photos.length} {photos.length === 1 ? "photo" : "photos"} · <SelectionCount selection={App.selection} /> selected</span>
                    {workflowStep === 1 && photos.length > 0 && (
                        <button
                            type="button"
                            className="photo-browser-control photo-browser-primary-button"
                            onClick={onContinueToSort}
                            disabled={!cullingSummary.kept}
                        >
                            Continue to Sequence · {cullingSummary.kept} →
                        </button>
                    )}
                    {workflowStep === 2 && (
                        <span className="photo-workflow-mode-note">
                            <strong>Manual order</strong> · AI-assisted sequence <em>Future</em>
                        </span>
                    )}
                </div>
            </div>

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
                    {workflowStep === 1 && <button
                        type="button"
                        onClick={onChangePhotoFolder}
                        disabled={!canChangePhotoFolder}
                        aria-disabled={!canChangePhotoFolder}
                        className="photo-browser-control"
                        title={canChangePhotoFolder ? "Choose a different photo folder" : "Open a photo folder before changing it"}
                        aria-label="Change photo folder"
                    >
                        {photoFolderChange?.busy ? "Changing…" : "📁 Change Folder"}
                    </button>}
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
                {workflowStep === 2 && <div className="photo-browser-toolbar-group photo-browser-sort-group" aria-label="Sort controls">
                    <UxpDropdown
                        id="photo-browser-sort"
                        value={preferences.sort.field}
                        options={PHOTO_SORT_OPTIONS}
                        onValueChange={handleSortFieldChange}
                        className="photo-browser-sort-select photo-browser-control"
                        ariaLabel="Sort photos by"
                        title="Sort photos by"
                    />
                    <button
                        type="button"
                        onClick={() => updateSort({ direction: preferences.sort.direction === "asc" ? "desc" : "asc" })}
                        disabled={preferences.sort.field === "manual"}
                        title={`Sort ${preferences.sort.direction === "asc" ? "ascending" : "descending"}`}
                        aria-label="Toggle sort direction"
                        className="photo-browser-control photo-browser-direction-button"
                    >
                        {preferences.sort.direction === "asc" ? "↑" : "↓"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setCameraTimesOpen(open => !open)}
                        aria-expanded={cameraTimesOpen}
                        aria-controls="photo-camera-time-panel"
                        className={`photo-browser-control photo-camera-time-button${cameraTimesOpen ? " is-active" : ""}`}
                        title="Correct Date Taken differences between cameras"
                    >
                        🕐 Camera Times{cameraClockOffsets.items.length ? ` (${cameraClockOffsets.items.length})` : ""}
                    </button>
                    <button
                        type="button"
                        onClick={() => setEventChaptersOpen(open => !open)}
                        aria-expanded={eventChaptersOpen}
                        aria-controls="photo-event-chapter-panel"
                        className={`photo-browser-control photo-event-chapter-button${eventChaptersOpen ? " is-active" : ""}`}
                        title="Create and arrange manual event chapters"
                    >
                        🗓 Events{eventChapters.items.length ? ` (${eventChapters.items.length})` : ""}
                    </button>
                </div>}
            </div>

            {photos.length > 0 && workflowStep === 2 && cameraTimesOpen && (
                <div
                    id="photo-camera-time-panel"
                    className="photo-camera-time-panel"
                    aria-label="Camera time corrections"
                >
                    <div className="photo-camera-time-heading">
                        <div>
                            <strong>Align camera clocks</strong>
                            <span>Correction is added to Date Taken. If a camera is 8 minutes slow, enter +8.</span>
                        </div>
                        <button
                            type="button"
                            className="photo-browser-control"
                            onClick={resetCameraCorrections}
                            disabled={!cameraClockOffsets.items.length}
                        >
                            Reset all
                        </button>
                    </div>
                    <div className="photo-camera-time-list">
                        {detectedCameras.map(camera => {
                            const correction = cameraCorrectionByKey.get(
                                camera.cameraKey
                            ) || 0;
                            return (
                                <label
                                    key={camera.cameraKey}
                                    className="photo-camera-time-row"
                                >
                                    <span className="photo-camera-time-identity">
                                        <strong>{camera.label}</strong>
                                        <small>{camera.photoCount} {camera.photoCount === 1 ? "photo" : "photos"}</small>
                                    </span>
                                    <span className="photo-camera-time-input-wrap">
                                        <input
                                            key={`${camera.cameraKey}:${correction}`}
                                            type="number"
                                            defaultValue={correction}
                                            min={-10080}
                                            max={10080}
                                            step={1}
                                            onBlur={event => handleCameraCorrection(
                                                camera.cameraKey,
                                                event.currentTarget.value || 0
                                            )}
                                            onKeyDown={event => {
                                                if (event.key === "Enter") {
                                                    event.currentTarget.blur?.();
                                                }
                                            }}
                                            aria-label={`Time correction in minutes for ${camera.label}`}
                                            className="photo-camera-time-input photo-browser-control"
                                        />
                                        <span>min</span>
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                    <div className="photo-camera-time-note" role="status">
                        Originals are unchanged. Corrections affect Date Taken sorting and event grouping in this project only.
                    </div>
                    {cameraClockError && (
                        <div className="photo-story-order-error" role="alert">
                            {cameraClockError}
                        </div>
                    )}
                </div>
            )}

            {photos.length > 0 && workflowStep === 2 && eventChaptersOpen && (
                <div
                    id="photo-event-chapter-panel"
                    className="photo-event-chapter-panel"
                    aria-label="Manual event chapters"
                >
                    <div className="photo-event-chapter-heading">
                        <div>
                            <strong>Event chapters</strong>
                            <span>Select photos, create a chapter, then rename or arrange it.</span>
                        </div>
                        <button
                            type="button"
                            className="photo-browser-control photo-event-create-button"
                            onClick={handleCreateEventChapter}
                        >
                            + New Event{selectedCount ? ` from ${selectedCount} selected` : ""}
                        </button>
                    </div>
                    {eventChapters.items.length > 0 && (
                        <div className="photo-event-membership-review" role="status">
                            <span>
                                <strong>{photos.length - unassignedEventPhotos.length}</strong> assigned · {" "}
                                <strong>{unassignedEventPhotos.length}</strong> unassigned
                            </span>
                            <div className="photo-event-membership-actions">
                                <button
                                    type="button"
                                    className="photo-browser-control"
                                    onClick={() => handleReviewUnassigned(false)}
                                    disabled={!unassignedEventPhotos.length}
                                >
                                    View Unassigned
                                </button>
                                <button
                                    type="button"
                                    className="photo-browser-control"
                                    onClick={() => handleReviewUnassigned(true)}
                                    disabled={!unassignedEventPhotos.length}
                                >
                                    Select Unassigned
                                </button>
                                <button
                                    type="button"
                                    className="photo-browser-control"
                                    onClick={handleRemoveEventChapterAssignment}
                                    disabled={!selectedCount}
                                    title="Remove the selected photos from their current event"
                                >
                                    Remove selected
                                </button>
                            </div>
                        </div>
                    )}
                    {eventChapters.items.length ? (
                        <div className="photo-event-chapter-list">
                            {eventChapters.items.map((chapter, index) => (
                                <div
                                    key={chapter.chapterId}
                                    className="photo-event-chapter-row"
                                >
                                    <span className="photo-event-chapter-order">{index + 1}</span>
                                    <input
                                        key={`${chapter.chapterId}:${chapter.name}`}
                                        type="text"
                                        defaultValue={chapter.name}
                                        maxLength={80}
                                        aria-label={`Name for event ${index + 1}`}
                                        className="photo-event-chapter-name photo-browser-control"
                                        onBlur={event => handleRenameEventChapter(
                                            chapter.chapterId,
                                            event.currentTarget.value
                                        )}
                                        onKeyDown={event => {
                                            if (event.key === "Enter") {
                                                event.currentTarget.blur?.();
                                            }
                                        }}
                                    />
                                    <span className="photo-event-chapter-count">
                                        {chapter.photoKeys.length} {chapter.photoKeys.length === 1 ? "photo" : "photos"}
                                    </span>
                                    <button
                                        type="button"
                                        className="photo-browser-control"
                                        onClick={() => handleAssignEventChapter(chapter.chapterId)}
                                        disabled={!selectedCount}
                                        title="Move the selected photos into this event"
                                    >
                                        Add selected
                                    </button>
                                    <button
                                        type="button"
                                        className="photo-browser-control photo-event-order-button"
                                        onClick={() => handleMoveEventChapter(chapter.chapterId, "up")}
                                        disabled={index === 0}
                                        aria-label={`Move ${chapter.name} earlier`}
                                        title="Move earlier"
                                    >
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        className="photo-browser-control photo-event-order-button"
                                        onClick={() => handleMoveEventChapter(chapter.chapterId, "down")}
                                        disabled={index === eventChapters.items.length - 1}
                                        aria-label={`Move ${chapter.name} later`}
                                        title="Move later"
                                    >
                                        ↓
                                    </button>
                                    <button
                                        type="button"
                                        className="photo-browser-control"
                                        onClick={() => handleMergeEventChapter(chapter.chapterId, index)}
                                        disabled={index === 0}
                                        title={`Merge ${chapter.name} into the previous event`}
                                    >
                                        Merge ↑
                                    </button>
                                    <button
                                        type="button"
                                        className="photo-browser-control photo-event-delete-button"
                                        onClick={() => handleDeleteEventChapter(chapter.chapterId)}
                                        disabled={chapter.photoKeys.length > 0}
                                        title={chapter.photoKeys.length
                                            ? "Move or remove its photos before deleting this event"
                                            : `Delete empty event ${chapter.name}`}
                                    >
                                        Delete empty
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="photo-event-chapter-empty">
                            Automatic time groups remain active until you create the first manual event.
                        </div>
                    )}
                    <div className="photo-event-chapter-note" role="status">
                        Each photo belongs to at most one manual event. Original files are unchanged.
                    </div>
                    {eventChapterError && (
                        <div className="photo-story-order-error" role="alert">
                            {eventChapterError}
                        </div>
                    )}
                </div>
            )}

            {/* Capture One Style Wedding Event Tabs */}
            {photos.length > 0 && workflowStep >= 2 && visibleEvents.length > 0 && (
                <div className="photo-event-strip">
                    <span className="photo-event-strip-label">
                        <span>🗓</span> Events:
                    </span>
                    <button
                        type="button"
                        className={`culling-pill${!selectedEventId ? " active" : ""}`}
                        onClick={() => setSelectedEventId("")}
                    >
                        All Events ({photos.length})
                    </button>
                    {visibleEvents.map((evt, idx) => (
                        <button
                            key={evt.eventId}
                            type="button"
                            className={`culling-pill${selectedEventId === evt.eventId ? " active" : ""}`}
                            onClick={() => setSelectedEventId(selectedEventId === evt.eventId ? "" : evt.eventId)}
                            title={`${evt.manual ? "Manual event" : `Event ${idx + 1}`}: ${evt.count} photos`}
                        >
                            {evt.unassigned ? "⚠ " : ""}{evt.label} ({evt.count})
                        </button>
                    ))}
                    {detectedCameras.length > 1 && (
                        <span className="photo-event-camera-count">
                            📷 {detectedCameras.length} Cameras
                        </span>
                    )}
                </div>
            )}

            {photos.length > 0 && workflowStep === 2 && (
                <div className={`photo-sort-handoff${sortReview.ready ? " is-ready" : " has-warning"}`} role="status">
                    <span>
                        <strong>{sortReview.ready ? "Sequence ready" : "Sequence incomplete"}</strong> · {sortReview.manual
                            ? sortReview.ready
                                ? `All ${sortReview.assignedCount} photos are assigned across ${sortReview.chapterCount} events.`
                                : `${sortReview.unassignedCount} ${sortReview.unassignedCount === 1 ? "photo is" : "photos are"} still unassigned.`
                            : "Automatic event groups are active; manual chapters are optional."}
                    </span>
                    <button
                        type="button"
                        className="photo-browser-control"
                        onClick={() => {
                            if (sortReview.ready) onContinueToCull?.();
                            else {
                                setEventChaptersOpen(true);
                                handleReviewUnassigned(false);
                            }
                        }}
                    >
                        {sortReview.ready ? "Save as Album Selects →" : "Review Unassigned"}
                    </button>
                </div>
            )}

            {photos.length > 0 && workflowStep === 3 && (
                <div className={`photo-sort-handoff${cullingSummary.ready ? " is-ready" : " has-warning"}`} role="status">
                    <span>
                        <strong>Album Selects {albumSelectsLocked ? "locked" : "unlocked"}</strong> · {cullingSummary.kept
                            ? `${cullingSummary.kept} selected photos in the saved album sequence.`
                            : "Return to Library and keep at least one photo."}
                    </span>
                    <button
                        type="button"
                        className="photo-browser-control"
                        onClick={() => setAlbumSelectsLocked(locked => !locked)}
                    >
                        {albumSelectsLocked ? "Unlock Review" : "Lock Review"}
                    </button>
                    <button
                        type="button"
                        className="photo-browser-control"
                        onClick={() => {
                            if (cullingSummary.kept) onContinueToEnhance?.();
                        }}
                    >
                        {cullingSummary.kept ? "Continue to Enhance →" : "No Album Selects"}
                    </button>
                </div>
            )}

            {/* Workflow & Filter Toolbar (Row 2) */}
            {photos.length > 0 && workflowStep === 1 && (
                <div className="photo-culling-toolbar" role="toolbar" aria-label="Workflow and filter controls">
                    {/* 1. Culling Workflow Group */}
                    <div className="photo-culling-pills" aria-label="Culling workflow">
                        <UxpDropdown
                            id="photo-cull-status"
                            value={cullingFilter}
                            options={[
                                { value: CullingFilterMode.ALL, label: `All · ${cullingSummary.total}` },
                                { value: CullingFilterMode.UNRATED, label: `To review · ${cullingSummary.unrated}` },
                                { value: CullingFilterMode.KEPT, label: `Kept · ${cullingSummary.kept}` },
                                { value: CullingFilterMode.REJECTED, label: `Rejected · ${cullingSummary.rejected}` }
                            ]}
                            onValueChange={setCullingFilter}
                            className="photo-browser-control photo-cull-status-select"
                            ariaLabel="Show culling status"
                        />
                    </div>

                    {/* 2. Secondary Metadata & Decision Filters */}
                    <div className="photo-filter-disclosure">
                        <button
                            type="button"
                            className={`photo-browser-control photo-filter-disclosure-button${secondaryFiltersOpen ? " is-active" : ""}`}
                            onClick={() => setSecondaryFiltersOpen(open => !open)}
                            aria-expanded={secondaryFiltersOpen}
                            aria-controls="photo-browser-secondary-filters"
                        >
                            Filters{secondaryFilterCount ? ` (${secondaryFilterCount})` : ""}
                            <span aria-hidden="true">{secondaryFiltersOpen ? "▴" : "▾"}</span>
                        </button>
                        {filtersActive && !secondaryFiltersOpen && (
                            <button
                                type="button"
                                onClick={clearFilters}
                                className="photo-browser-control photo-browser-clear-btn"
                                aria-label="Reset photo filters"
                                title="Reset active search and filters"
                            >
                                Reset
                            </button>
                        )}
                    </div>
                </div>
            )}

            {photos.length > 0 && workflowStep === 1 && secondaryFiltersOpen && (
                <div
                    id="photo-browser-secondary-filters"
                    className="photo-filter-panel"
                    aria-label="Metadata and decision filters"
                >
                    <div className="photo-filter-inline-group">
                        <button
                            type="button"
                            onClick={startComparison}
                            disabled={selectedCount !== 2}
                            className="photo-browser-control"
                        >
                            Compare selected
                        </button>
                        <button
                            type="button"
                            onClick={handleAutoPickBurstBest}
                            disabled={cullingBusy || !cullingSummary.burstCount}
                            className="photo-browser-control"
                        >
                            {cullingBusy ? "Auto-picking…" : "Auto-pick bursts"}
                        </button>
                        <UxpDropdown
                            id="photo-browser-type"
                            value={preferences.types[0] || ""}
                            options={[
                                { value: "", label: "Type: All" },
                                ...queryResult.facets.types.map(type => ({
                                    value: type,
                                    label: `Type: ${type.toUpperCase()}`
                                }))
                            ]}
                            onValueChange={type => updatePreferences({
                                types: type ? [type] : []
                            })}
                            className="photo-browser-filter-select photo-browser-control"
                            ariaLabel="Filter photos by file type"
                        />
                        <div className="photo-rating-label-filter" aria-label="Filter by rating and color label">
                            <div className="photo-rating-filter-row">
                                {[{ value: "exact", label: "=" }, { value: "above", label: "≥" }, { value: "below", label: "≤" }].map(mode => (
                                    <button
                                        key={mode.value}
                                        type="button"
                                        className={`photo-rating-filter-button${preferences.ratingFilterActive && preferences.ratingComparison === mode.value ? " is-active" : ""}`}
                                        aria-pressed={preferences.ratingFilterActive && preferences.ratingComparison === mode.value}
                                        onClick={() => updatePreferences({
                                            ratingFilterActive: !(preferences.ratingFilterActive && preferences.ratingComparison === mode.value),
                                            ratingComparison: mode.value
                                        })}
                                        title={mode.value === "exact" ? "Exact rating" : mode.value === "above" ? "Rating and above" : "Rating and below"}
                                    >
                                        {mode.label}
                                    </button>
                                ))}
                                <span className="photo-rating-filter-divider" />
                                {[0, 1, 2, 3, 4, 5].map(value => (
                                    <button
                                        key={value}
                                        type="button"
                                        className={`photo-rating-filter-button is-star${preferences.ratingFilterActive && preferences.ratingValue === value ? " is-active" : ""}`}
                                        aria-pressed={preferences.ratingFilterActive && preferences.ratingValue === value}
                                        onClick={() => updatePreferences({
                                            ratingFilterActive: !(preferences.ratingFilterActive && preferences.ratingValue === value),
                                            ratingValue: value
                                        })}
                                        title={value === 0 ? "Unrated photos (0)" : `${value}-star photos (${value})`}
                                    >
                                        {value === 0 ? "Unrated" : `${value}★`}
                                    </button>
                                ))}
                            </div>
                            <div className="photo-color-filter-row">
                                <button
                                    type="button"
                                    className={`photo-color-filter-button${!preferences.colorLabel ? " is-active" : ""}`}
                                    aria-pressed={!preferences.colorLabel}
                                    onClick={() => updatePreferences({ colorLabel: 0 })}
                                    title="No color filter"
                                >
                                    None
                                </button>
                                {PHOTO_COLOR_LABELS.map(label => (
                                    <button
                                        key={label.value}
                                        type="button"
                                        className={`photo-color-filter-button${preferences.colorLabel === label.value ? " is-active" : ""}`}
                                        aria-pressed={preferences.colorLabel === label.value}
                                        onClick={() => updatePreferences({
                                            colorLabel: preferences.colorLabel === label.value ? 0 : label.value
                                        })}
                                        title={`${label.label} label (${label.value})`}
                                    >
                                        <span style={{ background: label.color }} />
                                        {label.value}
                                    </button>
                                ))}
                            </div>
                        </div>
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

            {photos.length > 0 && workflowStep === 2 && preferences.sort.field === "manual" && (
                <div className="photo-manual-order-banner" role="status">
                    <span>
                        <strong>Manual Order</strong> · {selectedCount > 1
                            ? `Drag any selected photo to move all ${selectedCount} together.`
                            : "Drag a photo onto another photo to move it."}
                    </span>
                    <div className="photo-manual-order-actions">
                        {[
                            ["Undo", () => handleStoryOrderTravel(false), storyOrderHistory.index <= 0],
                            ["Redo", () => handleStoryOrderTravel(true), storyOrderHistory.index >= storyOrderHistory.items.length - 1],
                            ["Reset", handleStoryOrderReset, false],
                            ["Use Date Taken", () => handleSortFieldChange("taken"), false]
                        ].map(([label, action, disabled]) => (
                            <button
                                key={label}
                                type="button"
                                className="photo-browser-control"
                                onClick={action}
                                disabled={disabled}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            )}

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
                {storyOrderError && (
                    <div className="photo-story-order-error" role="alert">
                        {storyOrderError}
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
                        <p>Try a different filename, type, rating, label, or selection filter.</p>
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
                        focusedPhotoId={focusedPhotoId}
                        onFocusPhoto={focusPhoto}
                        viewMode={viewMode}
                        decisionForPhoto={decisionForPhoto}
                        onPhotoDecisionChange={changePhotoDecision}
                        decisionControlsVisible={workflowStep === 1 || (workflowStep === 3 && !albumSelectsLocked)}
                        manualOrderEnabled={workflowStep === 2 && !orderFiltersActive}
                        onReorderPhoto={handleManualReorder}
                    />
                )}
            </div>

            {quickPreviewPhoto && (
                <div className="photo-quick-preview-backdrop" role="dialog" aria-label={`Preview ${quickPreviewPhoto.name}`}>
                    <div className="photo-quick-preview-card">
                        <div className="photo-quick-preview-image">
                            <PhotoImage
                                photo={quickPreviewPhoto}
                                profile="preview"
                                priority={0}
                                role="preview"
                                alt={quickPreviewPhoto.name}
                                style={{ width: "100%", height: "100%", objectFit: "contain" }}
                            />
                        </div>
                        <div className="photo-quick-preview-meta">
                            <strong>{quickPreviewPhoto.name}</strong>
                            <span>Release Spacebar to close</span>
                        </div>
                    </div>
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
                        : preferences.sort.field === "manual"
                            ? "Manual Order"
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
            </div>

            {comparingPair && (
                <PhotoComparisonModal
                    photoA={comparingPair[0]}
                    photoB={comparingPair[1]}
                    onClose={() => setComparingPair(null)}
                    onPickKeep={handlePickKeepFromComparison}
                />
            )}
        </section>
    );

}

export default React.memo(PhotoBrowserSection);
