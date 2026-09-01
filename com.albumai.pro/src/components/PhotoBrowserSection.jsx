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
    movePhotoEventChapter,
    renamePhotoEventChapter,
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
    applyCameraClockCorrections,
    detectCameras,
    groupPhotosByEvent,
    normalizeCameraClockOffsets,
    updateCameraClockOffset
} from "../services/PhotoGroupingEngine";
import PhotoComparisonModal from "./PhotoComparisonModal";

const PHOTO_DATE_FILTER_OPTIONS = Object.freeze([
    Object.freeze({ value: "any", label: "Any" }),
    Object.freeze({ value: "today", label: "Today" }),
    Object.freeze({ value: "last7", label: "Last 7 days" }),
    Object.freeze({ value: "last30", label: "Last 30 days" }),
    Object.freeze({ value: "thisYear", label: "This year" })
]);

const PHOTO_RATING_FILTER_OPTIONS = Object.freeze([
    Object.freeze({ value: 0, label: "Any" }),
    Object.freeze({ value: 1, label: "1+ stars" }),
    Object.freeze({ value: 2, label: "2+ stars" }),
    Object.freeze({ value: 3, label: "3+ stars" }),
    Object.freeze({ value: 4, label: "4+ stars" }),
    Object.freeze({ value: 5, label: "5 stars" })
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
    const [duplicateBusy, setDuplicateBusy] = useState(false);
    const [duplicateError, setDuplicateError] = useState(null);
    const [cullingFilter, setCullingFilter] = useState(CullingFilterMode.ALL);
    const [selectedEventId, setSelectedEventId] = useState("");
    const [comparingPair, setComparingPair] = useState(null);
    const [cullingBusy, setCullingBusy] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const [secondaryFiltersOpen, setSecondaryFiltersOpen] = useState(false);
    const decisionRevision = useRef(0);

    const handleContextMenu = useCallback((event, photo) => {
        if (!photo) return;
        setContextMenu({
            x: event.clientX || 120,
            y: event.clientY || 120,
            photo
        });
    }, []);

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
    const culledPhotos = useMemo(
        () => filterPhotosByCulling(orderedQueryPhotos, cullingFilter, decisionForPhoto),
        [orderedQueryPhotos, cullingFilter, decisionForPhoto]
    );
    const visiblePhotos = useMemo(() => {
        if (!selectedEventId) return culledPhotos;
        const targetEvent = visibleEvents.find(e => e.eventId === selectedEventId);
        if (!targetEvent) return culledPhotos;
        const allowed = new Set(targetEvent.photoIds);
        return culledPhotos.filter(p => allowed.has(p.id));
    }, [culledPhotos, selectedEventId, visibleEvents]);

    const filtersActive = hasActivePhotoBrowserFilters(preferences) || cullingFilter !== CullingFilterMode.ALL || Boolean(selectedEventId);
    const secondaryFilterCount = useMemo(() => [
        preferences.types.length > 0,
        preferences.minimumRating > 0,
        preferences.orientations.length > 0,
        preferences.favoritesOnly,
        preferences.duplicatesOnly
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
        if (filtersActive) {
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
    }, [filtersActive, persistStoryOrder, preferences, queryResult.photos, storyOrder]);

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
        if (filtersActive) {
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
        if (filtersActive) {
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
            if (key === "k") {
                changePhotoDecision(focused, { culling: CullingStatus.KEEP });
            } else if (key === "x") {
                changePhotoDecision(focused, { culling: CullingStatus.REJECT });
            } else if (key === "u") {
                changePhotoDecision(focused, { culling: CullingStatus.UNRATED });
            } else if (key === "f" || key === "l") {
                const currentFav = Boolean(decisions?.[photoDecisionKey(focused)]?.favorite);
                changePhotoDecision(focused, { favorite: !currentFav });
            } else if (["0", "1", "2", "3", "4", "5"].includes(e.key)) {
                changePhotoDecision(focused, { rating: Number(e.key) });
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [focusedPhotoId, photos, changePhotoDecision, decisions]);

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
                            App.selection.toggle(focused);
                            focusPhoto(focused);
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
                    else App.selection.select(next);
                    focusPhoto(next);
                }
            }
        };
        // UXP routes panel key events through the document focus path; window
        // listeners can miss Cmd/Ctrl+A before it bubbles. Capture preserves
        // the focused browser/control while intercepting the host shortcut.
        document.addEventListener("keydown", handleKeyDown, true);
        return () => document.removeEventListener(
            "keydown",
            handleKeyDown,
            true
        );
    }, [focusPhoto, focusedPhotoId, visiblePhotos]);

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
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={!folderLoaded || isLoading}
                        aria-disabled={!folderLoaded || isLoading}
                        className="photo-browser-control"
                        title={folderLoaded ? "Refresh photo folder" : "Open a photo folder before refreshing"}
                        aria-label="Refresh photo folder"
                    >
                        <span className="photo-browser-control-icon" aria-hidden="true">↻</span>
                        Refresh
                    </button>
                    <button
                        type="button"
                        onClick={onChangePhotoFolder}
                        disabled={!canChangePhotoFolder}
                        aria-disabled={!canChangePhotoFolder}
                        className="photo-browser-control"
                        title={canChangePhotoFolder ? "Choose a different photo folder" : "Open a photo folder before changing it"}
                        aria-label="Change photo folder"
                    >
                        {photoFolderChange?.busy ? "Changing…" : "📁 Change Folder"}
                    </button>
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
                    <button
                        type="button"
                        onClick={() => selectAllBrowserPhotos()}
                        disabled={!visiblePhotos.length}
                        className="photo-browser-control"
                        title="Select all photos"
                        aria-label="Select all photos"
                    >
                        Select All
                    </button>
                    <button
                        type="button"
                        onClick={() => App.selection.clear()}
                        disabled={!selectedCount}
                        className="photo-browser-control"
                        title="Deselect all photos"
                        aria-label="Deselect all photos"
                    >
                        Deselect
                    </button>
                </div>
            </div>

            {photos.length > 0 && cameraTimesOpen && (
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

            {photos.length > 0 && eventChaptersOpen && (
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
            {photos.length > 0 && visibleEvents.length > 0 && (
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

            {/* Workflow & Filter Toolbar (Row 2) */}
            {photos.length > 0 && (
                <div className="photo-culling-toolbar" role="toolbar" aria-label="Workflow and filter controls">
                    {/* 1. Culling Workflow Group */}
                    <div className="photo-culling-pills" aria-label="Culling workflow">
                        <span className="culling-label">Culling:</span>
                        <button
                            type="button"
                            className={`culling-pill${cullingFilter === CullingFilterMode.ALL ? " active" : ""}`}
                            onClick={() => setCullingFilter(CullingFilterMode.ALL)}
                        >
                            All ({cullingSummary.total})
                        </button>
                        <button
                            type="button"
                            className={`culling-pill keep-pill${cullingFilter === CullingFilterMode.KEPT ? " active" : ""}`}
                            onClick={() => setCullingFilter(CullingFilterMode.KEPT)}
                        >
                            ✓ Kept ({cullingSummary.kept})
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
                            className={`culling-pill unrated-pill${cullingFilter === CullingFilterMode.UNRATED ? " active" : ""}`}
                            onClick={() => setCullingFilter(CullingFilterMode.UNRATED)}
                        >
                            ? Unrated ({cullingSummary.unrated})
                        </button>
                        <button
                            type="button"
                            className="photo-browser-control culling-action-btn"
                            onClick={handleAutoPickBurstBest}
                            disabled={cullingBusy || !cullingSummary.burstCount}
                            title="Auto-pick highest quality photo in each burst sequence"
                        >
                            {cullingBusy ? "Auto-picking…" : "⚡ Auto-Pick"}
                        </button>
                        <button
                            type="button"
                            className="photo-browser-control culling-action-btn"
                            onClick={startComparison}
                            disabled={selectedCount !== 2}
                            title="Compare 2 selected photos side by side"
                        >
                            🔍 Compare (2)
                        </button>
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

            {photos.length > 0 && secondaryFiltersOpen && (
                <div
                    id="photo-browser-secondary-filters"
                    className="photo-filter-panel"
                    aria-label="Metadata and decision filters"
                >
                    <div className="photo-filter-inline-group">
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
                        <UxpDropdown
                            id="photo-browser-rating"
                            value={preferences.minimumRating}
                            options={PHOTO_RATING_FILTER_OPTIONS.map(opt => ({
                                value: opt.value,
                                label: opt.value === 0 ? "Rating: Any" : `Rating: ${opt.label}`
                            }))}
                            onValueChange={minimumRating => updatePreferences({
                                minimumRating: Number(minimumRating)
                            })}
                            className="photo-browser-filter-select photo-browser-control"
                            ariaLabel="Filter photos by minimum rating"
                        />
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
                        <label className="photo-browser-favorite-filter" style={{ marginLeft: 4 }}>
                            <input
                                type="checkbox"
                                checked={preferences.favoritesOnly}
                                onChange={event => updatePreferences({
                                    favoritesOnly: event.target.checked
                                })}
                            />
                            ♥ Fav
                        </label>
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

            {photos.length > 0 && preferences.sort.field === "manual" && (
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
                        focusedPhotoId={focusedPhotoId}
                        onFocusPhoto={focusPhoto}
                        viewMode={viewMode}
                        decisionForPhoto={decisionForPhoto}
                        onPhotoDecisionChange={changePhotoDecision}
                        manualOrderEnabled={!filtersActive}
                        onReorderPhoto={handleManualReorder}
                    />
                )}
            </div>

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

            {/* Right-Click Context Menu */}
            {contextMenu && (
                <div
                    className="photo-context-backdrop"
                    onClick={() => setContextMenu(null)}
                    onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
                    style={{
                        position: "fixed",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        zIndex: 9999
                    }}
                >
                    <div
                        className="photo-context-menu"
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: "absolute",
                            top: Math.max(10, Math.min(contextMenu.y, 400)),
                            left: Math.max(10, Math.min(contextMenu.x, 350)),
                            background: "#161b22",
                            border: "1px solid #30363d",
                            borderRadius: 8,
                            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(0, 210, 255, 0.3)",
                            padding: "6px 0",
                            minWidth: 180,
                            color: "#e6edf3",
                            fontSize: 11,
                            zIndex: 10000
                        }}
                    >
                        <div style={{ padding: "4px 12px 6px", fontSize: 10, color: "#8b949e", borderBottom: "1px solid #21262d", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {contextMenu.photo.name}
                        </div>

                        {/* Star Ratings */}
                        <div style={{ padding: "4px 12px 2px", fontSize: 9, color: "#58a6ff", fontWeight: 700, textTransform: "uppercase" }}>
                            ⭐ Star Rating
                        </div>
                        {[5, 4, 3, 2, 1].map(stars => (
                            <div
                                key={stars}
                                onClick={() => {
                                    changePhotoDecision(contextMenu.photo, { rating: stars });
                                    setContextMenu(null);
                                }}
                                style={{
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    padding: "4px 12px",
                                    cursor: "pointer",
                                    color: (decisions?.[photoDecisionKey(contextMenu.photo)]?.rating === stars) ? "#ffd700" : "#c9d1d9"
                                }}
                            >
                                <span>{"★".repeat(stars)} {stars} {stars === 1 ? "Star" : "Stars"}</span>
                                <span style={{ fontSize: 9, color: "#6e7681" }}>({stars})</span>
                            </div>
                        ))}
                        <div
                            onClick={() => {
                                changePhotoDecision(contextMenu.photo, { rating: 0 });
                                setContextMenu(null);
                            }}
                            style={{ padding: "4px 12px", cursor: "pointer", color: "#8b949e", fontSize: 10 }}
                        >
                            ⊘ Clear Rating (0)
                        </div>

                        <div style={{ height: 1, background: "#21262d", margin: "3px 0" }} />

                        {/* Favorite */}
                        <div
                            onClick={() => {
                                const currentFav = Boolean(decisions?.[photoDecisionKey(contextMenu.photo)]?.favorite);
                                changePhotoDecision(contextMenu.photo, { favorite: !currentFav });
                                setContextMenu(null);
                            }}
                            style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "4px 12px",
                                cursor: "pointer",
                                color: Boolean(decisions?.[photoDecisionKey(contextMenu.photo)]?.favorite) ? "#ff4d4f" : "#c9d1d9"
                            }}
                        >
                            <span>{Boolean(decisions?.[photoDecisionKey(contextMenu.photo)]?.favorite) ? "💔 Remove Favorite" : "♥ Mark Favorite"}</span>
                            <span style={{ fontSize: 9, color: "#6e7681" }}>(F)</span>
                        </div>

                        <div style={{ height: 1, background: "#21262d", margin: "3px 0" }} />

                        {/* Culling Actions */}
                        <div
                            onClick={() => {
                                changePhotoDecision(contextMenu.photo, { culling: CullingStatus.KEEP });
                                setContextMenu(null);
                            }}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px", cursor: "pointer", color: "#3fb950" }}
                        >
                            <span>✓ Mark KEEP</span>
                            <span style={{ fontSize: 9, color: "#6e7681" }}>(K)</span>
                        </div>
                        <div
                            onClick={() => {
                                changePhotoDecision(contextMenu.photo, { culling: CullingStatus.REJECT });
                                setContextMenu(null);
                            }}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px", cursor: "pointer", color: "#f85149" }}
                        >
                            <span>✕ Mark REJECT</span>
                            <span style={{ fontSize: 9, color: "#6e7681" }}>(X)</span>
                        </div>
                        <div
                            onClick={() => {
                                changePhotoDecision(contextMenu.photo, { culling: CullingStatus.UNRATED });
                                setContextMenu(null);
                            }}
                            style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 12px", cursor: "pointer", color: "#8b949e" }}
                        >
                            <span>? Mark UNRATED</span>
                            <span style={{ fontSize: 9, color: "#6e7681" }}>(U)</span>
                        </div>
                    </div>
                </div>
            )}

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
