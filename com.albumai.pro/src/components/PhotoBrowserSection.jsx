import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";
import { createPortal } from "react-dom";

import ThumbnailGrid from "./ThumbnailGrid";
import ThumbnailZoom from "./ThumbnailZoom";
import {bindLibraryScrollbarVisibility} from "./LibraryScrollbars";
import {focusWithoutMovingLibrary, suspendLibraryReviewScrollbars} from "./PopupScrollbars";
import UxpDropdown from "./UxpDropdown";
import LibraryToolbar, {ToolbarIcon} from "./LibraryToolbar";
import SidebarButton from "./SidebarButton";
import EventManager from "./EventManager";
import AutoEventsDialog from "./AutoEventsDialog";
import {applyPhotoEventProposals} from "../services/PhotoAutoEvents";
import PhotoContextMenu from "./PhotoContextMenu";
import { bindLibraryDrag, libraryDragPhotos } from "./LibraryDrag";
import ThumbnailService from "../services/ThumbnailService";
import { eventWorkspace, editEvent } from "../services/EventWorkspace";
import { blocksPhotoReviewKeys, photoReviewKey, bindPhotoReviewKeys, bindPhotoReviewPointerFocus } from "./PhotoReviewKeyboard";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import PhotoImage from "./PhotoImage";
import PhotoReviewPreview from "./PhotoReviewPreview";
import useReviewRendering from "./useReviewRendering";
import { reviewPointer, zoomPreviewAt, reviewZoomStep, previewSessionPhotos, reviewPreviewGate, previewGeometry, previewImagePlacement, clampPreviewPan } from "./PhotoPreviewModel";
import PhotoLibraryHistory, {
    PhotoLibraryHistoryKind
} from "../services/PhotoLibraryHistory";
// Retained in the canonical bundle for legacy project compatibility. The
// production Library no longer renders this former KEEP-oriented modal.
import PhotoComparisonModal from "./PhotoComparisonModal";
import {
    clearPhotoBrowserFilters,
    visibleLibraryFocus,
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
    Object.freeze({ value: "name", label: "Name" }),
    Object.freeze({ value: "created", label: "Date Created" }),
    Object.freeze({ value: "taken", label: "Capture Time" }),
    Object.freeze({ value: "rating", label: "Rating" }),
    Object.freeze({ value: "camera", label: "Camera" }),
    Object.freeze({ value: "event", label: "Event" }),
    Object.freeze({ value: "type", label: "Photo Type" })
]);

const PHOTO_GROUP_OPTIONS = Object.freeze([
    Object.freeze({ value: "none", label: "None" }),
    Object.freeze({ value: "event", label: "Events" }),
    Object.freeze({ value: "camera", label: "Cameras" }),
    Object.freeze({ value: "rating", label: "Ratings" }),
    Object.freeze({ value: "favorite", label: "Favorites" }),
    Object.freeze({ value: "review", label: "Included / Rejected" }),
    Object.freeze({ value: "type", label: "Photo Type" })
]);

const PHOTO_VIEW_OPTIONS = Object.freeze([
    Object.freeze({ value: "icons", label: "Grid" }),
    Object.freeze({ value: "list", label: "List" })
]);

function formatPhotoBytes(photo) {
    const bytes = Number(photo?.fileSize || photo?.size || photo?.file?.size || photo?.metadata?.size || 0);
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
    onHistoryControlsChange,
    isLoading = false,
    loadingPhotoCount = 0,
    photoFolderChange = null
}) {

    const reconnectingPhotoFolder = !folderLoaded && Boolean(folderMessage);
    const canChangePhotoFolder = canStartPhotoFolderChange({
        projectId,
        folderLoaded,
        hasFolderReference: reconnectingPhotoFolder,
        isLoading,
        photoFolderChange
    });
    const openOrReconnectFolder = reconnectingPhotoFolder
        ? onChangePhotoFolder
        : onOpenFolder;

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
    const [previewSession, setPreviewSession] = useState(null);
    const [previewScale, setPreviewScale] = useState(1);
    const [previewOffset, setPreviewOffset] = useState({ x: 0, y: 0 });
    const [burstReviewGroupId, setBurstReviewGroupId] = useState(null);
    const [burstReviewIndex, setBurstReviewIndex] = useState(0);
    const [burstDraftIds, setBurstDraftIds] = useState(new Set());
    const [burstReviewBusy, setBurstReviewBusy] = useState(false);
    const [inspectorFileOpen, setInspectorFileOpen] = useState(true);
    const [inspectorTab, setInspectorTab] = useState("preview");
    const [inspectorInfoTab, setInspectorInfoTab] = useState("metadata");
    const [collapsedLibrarySections, setCollapsedLibrarySections] = useState(new Set());
    const [historyRevision, setHistoryRevision] = useState(0);
    const previewStageRef = useRef(null);
    const selectedPhotoIdsRef = useRef(selectedPhotoIds);
    const previewPhotoIndexRef = useRef(0);
    const libraryHistoryRef = useRef(new PhotoLibraryHistory());
    const previewPanRef = useRef(null);

    const selectedPhotoIdListFromState = useCallback(() => {
        const order = photos;
        return order
            .map(photo => photo?.id)
            .filter(id => selectedPhotoIdsRef.current.has(id));
    }, [photos]);

    const pushUndoState = useCallback(() => {
        const state = selectedPhotoIdListFromState();
        const changed = libraryHistoryRef.current.push(
            PhotoLibraryHistoryKind.SELECTION,
            state,
            {
                equals: (left, right) => left.length === right.length &&
                    left.every((id, index) => id === right[index])
            }
        );
        if (changed) setHistoryRevision(revision => revision + 1);
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
    const [savedEvents, setEventChapters] = useState(
        () => normalizePhotoEventChapters(App.getPhotoEventChapters(), photos)
    );
    const [autoEventsOpen, setAutoEventsOpen] = useState(false);
    useEffect(() => {setAutoEventsOpen(false);}, [projectId]);
    const [manageEvents, setManageEvents] = useState(false);
    const eventSaving = useRef(false);
    const eventEditing = useRef(false);
    const newEventPhotos = useRef([]);
    const onEventEditingChange = useCallback(active => { eventEditing.current = active; }, []);
    const [eventBusy, setEventBusy] = useState(false);
    const libraryDragRoot = useRef(null);
    const libraryDragOptions = useRef(null);
    useLayoutEffect(() => bindLibraryScrollbarVisibility(libraryDragRoot.current), [projectId]);
    const [eventNotice, setEventNotice] = useState("");
    useEffect(() => {
        if (!eventNotice) return;
        const timer = setTimeout(() => setEventNotice(""), 5000);
        return () => clearTimeout(timer);
    }, [eventNotice]);
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
    const [inspectorCollapsed, setInspectorCollapsed] = useState(false);
    const [showShortcuts, setShowShortcuts] = useState(false);
    const [contextMenu, setContextMenu] = useState(null);
    const contextMenuRef = useRef(null);
    useLayoutEffect(() => {
        if (!contextMenu) return;
        focusWithoutMovingLibrary(contextMenuRef.current);
        return () => focusWithoutMovingLibrary(libraryDragRoot.current?.querySelector(".photo-browser-viewport"));
    }, [!!contextMenu]);
    useLayoutEffect(() => setContextMenu(null), [projectId, photos]);
    const decisionRevision = useRef(0);

    const handleContextMenu = useCallback((event, photo) => {
        if (eventEditing.current || eventSaving.current) return;
        event.preventDefault(); event.stopPropagation();
        if (photo && !App.selection.isSelected(photo)) {
            App.selection.select(photo);
        }
        if (photo) onFocusPhoto?.(photo.id);
        const bounds = document.body.getBoundingClientRect();
        const menuHeight = Math.min(300, Math.max(60, bounds.height - 20));
        setContextMenu({
            x: Math.max(bounds.left + 10, Math.min(event.clientX || 120, bounds.right - 246)),
            y: Math.max(bounds.top + 10, Math.min(event.clientY || 120, bounds.bottom - menuHeight - 10)),
            maxHeight: menuHeight,
            photo,
            kind: photo ? "photos" : "background",
            photos: photo ? libraryDragPhotos(photos, App.selection.selectedIds(), photo.id) : []
        });
    }, [onFocusPhoto, photos]);

    // Metadata is filled in-place after the first render. A stable array
    // reference alone therefore cannot invalidate temporal/camera grouping.
    const photoGroupingRevision = createPhotoGroupingRevision(photos);
    const automaticEvents = useMemo(() => {
        if (!photos || photos.length === 0) return [];
        return groupPhotosByEvent(photos);
    }, [photoGroupingRevision, photos]);
    const eventChapters = useMemo(() => eventWorkspace(savedEvents, photos, automaticEvents), [savedEvents, photos, automaticEvents]);
    const smartEvents = useMemo(() => eventChapters.items.filter(item => item.photoKeys.length).map(item => ({
        eventId: item.chapterId, label: item.name, count: item.photoKeys.length,
        photoIds: photos.filter(photo => item.photoKeys.includes(photoDecisionKey(photo))).map(photo => photo.id)
    })), [eventChapters, photos]);
    const eventsReady = photos.every(photo => !/^(jpg|jpeg)$/i.test(photo.extension) ||
        (photo.metadataLoaded && photo.cameraMetadataLoaded) || photo.metadataReadFailed);

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
    const decisionForPhoto = useMemo(
        () => createPhotoDecisionLookup(decisions),
        [decisions]
    );
    const photoKindForPhoto = useCallback(photo =>
        decisionForPhoto(photo).collage ? "collage" : burstPhotoIds.has(photo?.id) ? "burst" : "single",
    [burstPhotoIds, decisionForPhoto]);
    const photoKindFacets = useMemo(() => {
        const singles = photos.filter(photo => photoKindForPhoto(photo) === "single").length;
        const burstFrames = photos.filter(photo => photoKindForPhoto(photo) === "burst").length;
        const collages = photos.length - singles - burstFrames;
        return [
            { key: "single", label: "Single Photos", count: singles },
            { key: "burst", label: "Burst Frames", count: burstFrames },
            { key: "collage", label: "Collages", count: collages }
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
        if (groupMode === "type") return photoKindForPhoto(photo) === "collage" ? "Collages" : photoKindForPhoto(photo) === "burst"
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
    const ratingFilterActive = preferences.ratingFilter.mode !== "any";
    const ratingFilterSummary = preferences.ratingFilter.mode === "unrated"
        ? "Unrated"
        : ratingFilterActive
            ? `${preferences.ratingFilter.mode === "atLeast"
                ? "At least"
                : preferences.ratingFilter.mode === "atMost"
                    ? "At most"
                    : "Exact"} ${preferences.ratingFilter.value || 1} star${preferences.ratingFilter.value === 1 ? "" : "s"}`
            : "Any rating";

    const cullingSummary = useMemo(
        () => summarizeCulling(photos, decisionForPhoto, App.getPhotoBursts ? App.getPhotoBursts() : []),
        [photos, decisionForPhoto]
    );
    const selectedPhotos = useMemo(() => photos.filter(photo => selectedPhotoIds.has(photo?.id)),
        [photos, selectedPhotoIds]
    );
    const selectedCommonRating = useMemo(() => {
        if (!selectedPhotos.length) return 0;
        const rating = decisionForPhoto(selectedPhotos[0]).rating || 0;
        return selectedPhotos.every(photo =>
            (decisionForPhoto(photo).rating || 0) === rating
        ) ? rating : 0;
    }, [decisionForPhoto, selectedPhotos]);
    const selectedAllFavorite = selectedPhotos.length > 0 && selectedPhotos.every(
        photo => decisionForPhoto(photo).favorite
    );
    const selectedAllRejected = selectedPhotos.length > 0 && selectedPhotos.every(
        photo => decisionForPhoto(photo).culling === CullingStatus.REJECT
    );
    const previewCandidates = useMemo(() => previewSessionPhotos(visiblePhotos, selectedPhotoIds),
        [selectedPhotoIds, visiblePhotos]);
    const previewPhotos = previewSession?.photos || previewCandidates;
    const previewPhoto = previewPhotos[previewIndex] || null;
    const selectedPreviewPhoto = selectedPhotos[0] ||
        previewPhotos.find(photo => photo?.id === focusedPhotoId) ||
        previewPhotos[0] ||
        null;

    const closePreview = useCallback(() => {
        setIsPreviewOpen(false);
        setPreviewSession(null);
        previewPhotoIndexRef.current = 0;
        setPreviewScale(1);
        setPreviewOffset({ x: 0, y: 0 });
    }, []);

    const openSelectedPreview = useCallback(targetPhoto => {
        if (!previewCandidates.length || !reviewPreviewGate.acquire()) return;
        setPreviewSession({ photos: previewCandidates, selectionOnly: selectedPhotoIds.size > 1 });
        const targetId = targetPhoto?.id;
        const index = targetId
            ? previewCandidates.findIndex(photo => photo?.id === targetId)
            : 0;
        const normalized = index >= 0 ? index : 0;
        setPreviewIndex(normalized);
        previewPhotoIndexRef.current = normalized;
        setIsPreviewOpen(true);
    }, [previewCandidates, selectedPhotoIds]);

    const setPreviewPhoto = useCallback((nextIndex) => {
        if (!previewPhotos.length) {
            closePreview();
            return;
        }
        const next = ((nextIndex % previewPhotos.length) + previewPhotos.length) % previewPhotos.length;
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

    const [burstStage, setBurstStage] = useState({ width: 1, height: 1 });
    const burstGeometry = previewGeometry(activeBurstPhoto, burstStage.width, burstStage.height);
    const burstProfile = useReviewRendering(activeBurstPhoto, burstGeometry, previewScale);
    const fitPreview = useCallback(() => {
        setPreviewScale(1);
        setPreviewOffset({ x: 0, y: 0 });
        previewPanRef.current = null;
    }, []);
    useLayoutEffect(() => {
        if (!activeBurstPhoto) return;
        fitPreview();
        const measure = () => {
            const rect = previewStageRef.current?.getBoundingClientRect();
            if (rect) setBurstStage({ width: rect.width, height: rect.height });
        };
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [activeBurstPhoto?.id, fitPreview]);
    const changePreviewScale = (delta, anchor) => {
        const next = zoomPreviewAt({ scale: previewScale, offset: previewOffset,
            geometry: burstGeometry, stage: burstStage }, reviewZoomStep(previewScale, delta), anchor);
        setPreviewScale(next.scale);
        setPreviewOffset(next.offset);
    };
    const togglePreviewScale = fitPreview;
    const handlePreviewWheel = event => {
        event.preventDefault();
        if (event.deltaY) changePreviewScale(event.deltaY > 0 ? -0.12 : 0.12,
            reviewPointer(event, previewStageRef.current.getBoundingClientRect()));
    };
    const handlePreviewMouseDown = event => {
        if (event.button !== 0 || previewScale <= 1) return;
        event.preventDefault();
        previewPanRef.current = { x: event.clientX, y: event.clientY, offset: previewOffset };
    };
    useEffect(() => {
        if (!activeBurstPhoto) return;
        let frame;
        const move = event => {
            const drag = previewPanRef.current;
            if (!drag) return;
            const offset = clampPreviewPan({
                x: drag.offset.x + event.clientX - drag.x,
                y: drag.offset.y + event.clientY - drag.y
            }, burstGeometry, previewScale, burstStage);
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => setPreviewOffset(offset));
        };
        const stop = () => { previewPanRef.current = null; };
        window.addEventListener("mousemove", move);
        window.addEventListener("mouseup", stop);
        return () => {
            cancelAnimationFrame(frame);
            window.removeEventListener("mousemove", move);
            window.removeEventListener("mouseup", stop);
        };
    }, [activeBurstPhoto?.id, previewScale, burstStage]);

    useEffect(() => {
        if (isPreviewOpen && !previewPhoto) {
            closePreview();
        }
    }, [closePreview, isPreviewOpen, previewPhoto]);

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
        updatePreferences(previous => clearPhotoBrowserFilters(previous));
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

    const toggleLibrarySection = useCallback(section => {
        setCollapsedLibrarySections(previous => {
            const next = new Set(previous);
            if (next.has(section)) next.delete(section);
            else next.add(section);
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
                        "Photo changes could not be saved."
                    );
                }
                console.warn("Photo decision persistence:", error);
            });
    }, []);

    const pushDecisionUndo = useCallback(() => {
        const changed = libraryHistoryRef.current.push(
            PhotoLibraryHistoryKind.DECISION,
            decisions
        );
        if (changed) setHistoryRevision(revision => revision + 1);
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
            : targetGroup.hasQualityEvidence ? [targetGroup.bestPhotoId] : []));
        setBurstReviewIndex(Math.max(0, targetGroup.photoIds.indexOf(targetGroup.bestPhotoId)));
        setPreviewScale(1);
        setPreviewOffset({ x: 0, y: 0 });
        setBurstReviewGroupId(targetGroup.groupId);
    }, [burstGroups, burstReviews, photos, reviewedBurstIds]);

    useLayoutEffect(() => {
        if (!burstReviewGroupId) return;
        const restoreScrollbars = suspendLibraryReviewScrollbars();
        document.body.classList.add("review-open");
        const dialog = previewStageRef.current.closest('[role="dialog"]');
        focusWithoutMovingLibrary(dialog);
        const release = bindPhotoReviewPointerFocus(dialog);
        return () => {
            release(); restoreScrollbars(); document.body.classList.remove("review-open");
            focusWithoutMovingLibrary(libraryDragRoot.current?.querySelector(".photo-browser-viewport"));
        };
    }, [burstReviewGroupId]);

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
        const changed = libraryHistoryRef.current.push(
            PhotoLibraryHistoryKind.EVENT,
            eventChapters
        );
        if (changed) setHistoryRevision(revision => revision + 1);
    }, [eventChapters]);

    const saveEventEdit = async (action, id, name, targets = selectedPhotos) => {
        if (!eventsReady || eventSaving.current) throw new Error("Events are still loading or saving.");
        eventSaving.current = true;
        setEventBusy(true);
        try {
            const next = editEvent(eventChapters, action, id, targets.map(photoDecisionKey), name || "New event");
            const saved = await App.savePhotoEventChapters(next, "PHOTO_EVENT_EDIT");
            pushEventUndo(); setEventChapters(saved);
            if (action === "move" || action === "new") {
                const destination = action === "new" ? name : saved.items.find(item => item.chapterId === id)?.name;
                setEventNotice(`${targets.length} photo${targets.length === 1 ? "" : "s"} moved to ${destination || "event"}. Undo is available above.`);
            }
            setSelectedChapterIds(new Set()); setSelectedEventIds(new Set());
        } finally { eventSaving.current = false; setEventBusy(false); }
    };

    const moveSelectedToNewEvent = useCallback((targets = selectedPhotos) => {
        const captured = Array.isArray(targets) ? targets : selectedPhotos;
        if (!captured.length) return;
        newEventPhotos.current = [...captured];
        setManageEvents(true);
    }, [selectedPhotos]);

    const eventFailed = () => setDecisionError("Event move failed. Please retry.");
    const moveSelectedToEvent = useCallback(chapterId => {
        if (!chapterId || !selectedPhotos.length) return;
        if (chapterId === "new") {
            moveSelectedToNewEvent();
            return;
        }
        if (chapterId === "unassigned") {
            saveEventEdit("restore")
                .catch(eventFailed);
            return;
        }
        saveEventEdit("move", chapterId)
            .catch(eventFailed);
    }, [moveSelectedToNewEvent, eventChapters, eventsReady, selectedPhotos]);

    const handleEventDrop = useCallback((event, chapterId) => {
        event.preventDefault();
        const photoId = event.dataTransfer?.getData("text/plain");
        const draggedPhoto = photos.find(photo => String(photo?.id) === String(photoId));
        if (!draggedPhoto) return;
        const targets = selectedPhotoIdsRef.current.has(draggedPhoto.id)
            ? selectedPhotos
            : [draggedPhoto];
        if (!targets.length) return;
        saveEventEdit("move", chapterId, "", targets)
            .catch(eventFailed);
    }, [photos, eventChapters, eventsReady, selectedPhotos]);

    libraryDragOptions.current = {
        enabled: () => eventsReady && !eventSaving.current && !eventEditing.current && !manageEvents && !contextMenu && !isPreviewOpen && !activeBurstGroup,
        photos: id => libraryDragPhotos(photos, App.selection.selectedIds(), id),
        commit: (drag, target) => {
            if (drag.kind === "photos" && target.id === "new-event") {
                moveSelectedToNewEvent(drag.photos);
                return false; // Naming is pending; do not show a successful move yet.
            }
            // Membership uses the selection captured at lift, even if focus changes.
            if (!eventChapters.items.some(item => item.chapterId === target.id) ||
                (drag.kind === "photos" && drag.photos.some(photo => !photos.includes(photo)))) {
                throw new Error("The drag source is no longer in this Library.");
            }
            return drag.kind === "event"
                ? saveEventEdit(target.mode, drag.id, target.id)
                : saveEventEdit("move", target.id, "", drag.photos);
        },
        retainSource: source => ThumbnailService.retainSource(source),
        releaseSource: source => ThumbnailService.releaseSource(source),
        onError: eventFailed
    };
    useLayoutEffect(() => bindLibraryDrag(libraryDragRoot.current, {
        enabled: () => libraryDragOptions.current.enabled(),
        photos: id => libraryDragOptions.current.photos(id),
        commit: (drag, target) => libraryDragOptions.current.commit(drag, target),
        retainSource: source => libraryDragOptions.current.retainSource(source),
        releaseSource: source => libraryDragOptions.current.releaseSource(source),
        onError: error => libraryDragOptions.current.onError(error)
    }), [projectId, photos]);

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

    const libraryControls = [
        { id: "photo-browser-view", label:"View", value:viewMode, options:PHOTO_VIEW_OPTIONS, onChange:switchView},
        { id: "photo-browser-sort", label:"Sort", value:preferences.sort.field, options:PHOTO_SORT_OPTIONS, onChange:field => updateSort({field})},
        { id: "photo-browser-group", label:"Group", value:groupMode, options:PHOTO_GROUP_OPTIONS, onChange:value => setGroupMode(value || "none")}
    ];

    useEffect(() => {
        PhotoBrowserPerformance.completeViewSwitch(viewMode);
        PhotoBrowserPerformance.trace("BROWSER_VIEW_MODE", { viewMode });
    }, [viewMode]);

    useEffect(() => {
        App.selection.setOrderedPhotos(visiblePhotos);
        setCanonicalBrowserPhotos(visiblePhotos);
    }, [visiblePhotos]);

    useEffect(() => {
        const next = visibleLibraryFocus(visiblePhotos, focusedPhotoId, selectedPhotoIds);
        if (next !== focusedPhotoId) onFocusPhoto?.(next);
    }, [focusedPhotoId, onFocusPhoto, visiblePhotos, selectedPhotoIds]);

    const focusPhoto = useCallback(photo => {
        if (!photo?.id) return;
        onFocusPhoto?.(photo.id);
    }, [onFocusPhoto]);
    const photoNavigationRef = useRef(null);

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
        setHistoryRevision(revision => revision + 1);
    }, [applyHistoryEntry, currentHistorySnapshot]);

    const handleRedoSelection = useCallback(() => {
        applyHistoryEntry(
            libraryHistoryRef.current.redo(currentHistorySnapshot),
            "redo"
        );
        setHistoryRevision(revision => revision + 1);
    }, [applyHistoryEntry, currentHistorySnapshot]);

    useEffect(() => {
        if (typeof onHistoryControlsChange !== "function") return undefined;
        onHistoryControlsChange({
            undo: handleUndoSelection,
            redo: handleRedoSelection,
            canUndo: libraryHistoryRef.current.undoStack.length > 0,
            canRedo: libraryHistoryRef.current.redoStack.length > 0
        });
        return () => onHistoryControlsChange(null);
    }, [handleRedoSelection, handleUndoSelection, historyRevision, onHistoryControlsChange]);

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

    useLayoutEffect(() => {
        const handleKeyDown = event => {
            if (contextMenu) {
                if (eventEditing.current) return;
                if (photoReviewKey(event) === "Escape") {
                    event.preventDefault(); event.stopPropagation(); setContextMenu(null);
                }
                return;
            }
            if (eventEditing.current || manageEvents || reviewPreviewGate.isActive() || (!activeBurstGroup && event.defaultPrevented) || event.isComposing) return;
            const isEditable = blocksPhotoReviewKeys(event.target);
            const key = photoReviewKey(event);
            const lowerKey = key?.toLowerCase();
            const command = event.ctrlKey || event.metaKey;
            const isSelectAll =
                command && (lowerKey === "a" || event.code === "KeyA");
            const isUndo =
                command && !event.shiftKey && (lowerKey === "z" || event.code === "KeyZ");
            const isRedo =
                command && (lowerKey === "y" ||
                    (event.shiftKey && (lowerKey === "z" || event.code === "KeyZ")));
            const isDeselectAll =
                command && (lowerKey === "d" || event.code === "KeyD");

            if (isEditable && !activeBurstGroup) return;
            // Modified letters belong to the host (e.g. Cmd+R), not decisions.
            if (event.altKey || (command && !isSelectAll && !isUndo && !isRedo && !isDeselectAll)) return;
            if (event.repeat && (lowerKey === " " || lowerKey === "r" || lowerKey === "f" || /^[0-5]$/.test(lowerKey))) return;

            if (activeBurstGroup) {
                event.stopPropagation();
                if (lowerKey === "escape" || lowerKey === " ") {
                    event.preventDefault();
                    closeBurstReview();
                } else if (key === "ArrowLeft" || key === "ArrowUp") {
                    event.preventDefault();
                    setBurstReviewIndex(previous => Math.max(0, previous - 1));
                } else if (key === "ArrowRight" || key === "ArrowDown") {
                    event.preventDefault();
                    setBurstReviewIndex(previous => Math.min(
                        activeBurstPhotos.length - 1,
                        previous + 1
                    ));
                } else if (key === "Enter") {
                    event.preventDefault();
                    toggleBurstDraft(activeBurstPhoto);
                }
                return;
            }

            const hasPreview = isPreviewOpen && !!previewPhoto;
            if (hasPreview) {
                // The preview owns its shortcuts and button focus.
                return;
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
                event.stopPropagation();
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

            switch (key) {
                case "ArrowLeft":
                case "ArrowUp":
                case "ArrowRight":
                case "ArrowDown": {
                    event.preventDefault();
                    const next = photoNavigationRef.current?.(focusedPhotoId, key);
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

        // UXP routes panel key events through the document focus path; window
        // listeners can miss Cmd/Ctrl+A before it bubbles. Capture preserves
        // the focused browser/control while intercepting the host shortcut.
        return bindPhotoReviewKeys(handleKeyDown);
    }, [
        contextMenu,
        manageEvents,
        clearSelected,
        activeBurstGroup,
        activeBurstPhoto,
        activeBurstPhotos.length,
        closeBurstReview,
        focusedPhotoId,
        focusPhoto,
        handleRedoSelection,
        handleUndoSelection,
        performSelectionMove,
        previewPhoto,
        decisionForPhoto,
        previewPhotos.length,
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
        <section ref={libraryDragRoot} className="photo-browser-shell" aria-label="Photo browser">
            <nav className="photo-workflow-tabs" aria-label="Photos workflow">
                <button type="button" className="is-active" aria-current="page">Library</button>
                <button type="button" disabled title="Complete Library review before sequencing">Sequence <span>⌾</span></button>
                <button type="button" disabled title="Complete Sequence before album selection">Album Selects <span>⌾</span></button>
            </nav>

            <div className={`photo-library-workspace${inspectorCollapsed ? " is-inspector-collapsed" : ""}`}>
                <aside className="photo-library-sidebar" aria-label="Library filters">
                    <div className="photo-library-sidebar-title">
                        <strong>Library</strong>
                        <span>{photos.length}</span>
                    </div>
                    <div className="photo-library-source-actions" role="toolbar" aria-label="Library source actions">
                        <span className="photo-library-action-label">Library Source</span>
                        <SidebarButton
                            className="photo-browser-control photo-browser-primary-button"
                            onClick={openOrReconnectFolder}
                            disabled={isLoading}
                        >
                            <span className="sidebar-folder-icon" aria-hidden="true">+</span><span>{reconnectingPhotoFolder ? "Reconnect Folder" : "Add Folder"}</span>
                        </SidebarButton>
                        <div className="photo-library-source-secondary">
                            <SidebarButton
                                className="photo-browser-control"
                                onClick={onChangePhotoFolder}
                                disabled={!canChangePhotoFolder}
                            >
                                <span className="sidebar-folder-icon" /><span>Change Folder</span>
                            </SidebarButton>
                            <SidebarButton
                                className="photo-browser-control photo-library-refresh-button"
                                onClick={onRefresh}
                                disabled={!folderLoaded || isLoading}
                                title="Refresh photo folder"
                                aria-label="Refresh photo folder"
                            >
                                ↻
                            </SidebarButton>
                        </div>
                    </div>
                    <section className="photo-library-sidebar-section photo-library-quick-filters">
                        <h3>Quick Filter</h3>
                        <SidebarButton
                            className={`photo-facet-button${preferences.favoritesOnly ? " is-active" : ""}`}
                            aria-pressed={preferences.favoritesOnly}
                            onClick={() => updatePreferences({ favoritesOnly: !preferences.favoritesOnly })}
                        >
                            <span className="sidebar-heart" aria-hidden="true">♡</span><span>Favorites</span>
                            <small>{photos.filter(photo => decisionForPhoto(photo).favorite).length}</small>
                        </SidebarButton>
                    </section>
                    <section
                        className={`photo-library-sidebar-section photo-library-review-filters${collapsedLibrarySections.has("review") ? " is-collapsed" : ""}`}
                        aria-label="Metadata and decision filters"
                    >
                        <SidebarButton
                            className="photo-library-facet-heading"
                            onClick={() => toggleLibrarySection("review")}
                            aria-expanded={!collapsedLibrarySections.has("review")}
                        >
                            <span>Review Filters</span>
                            <span aria-hidden="true">{collapsedLibrarySections.has("review") ? "+" : "−"}</span>
                        </SidebarButton>
                        <div className="photo-library-facet-list">
                            <div className="photo-review-filter-summary">
                                <span><small>Showing</small><strong>{ratingFilterSummary}</strong></span>
                                <SidebarButton
                                    disabled={!ratingFilterActive}
                                    onClick={() => updatePreferences({ ratingFilter: { mode: "any", value: 0 } })}
                                >
                                    Reset
                                </SidebarButton>
                            </div>
                            <span className="photo-rating-caption">Rating</span>
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
                                <div className="photo-rating-stars" aria-label="Choose rating value">
                                    {[1, 2, 3, 4, 5].map(rating => {
                                        const hasRatingFilter = ["exact", "atLeast", "atMost"].includes(preferences.ratingFilter.mode);
                                        const isFilled = hasRatingFilter && rating <= preferences.ratingFilter.value;
                                        const isCurrent = hasRatingFilter && rating === preferences.ratingFilter.value;
                                        return (
                                            <SidebarButton
                                                key={rating}
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
                                                {isFilled ? "★" : "☆"}
                                            </SidebarButton>
                                        );
                                    })}
                                </div>
                            </div>
                            <SidebarButton
                                className={`photo-rating-unrated${preferences.ratingFilter.mode === "unrated" ? " is-active" : ""}`}
                                onClick={() => updatePreferences({
                                    ratingFilter: preferences.ratingFilter.mode === "unrated"
                                        ? { mode: "any", value: 0 }
                                        : { mode: "unrated", value: 0 }
                                })}
                                aria-pressed={preferences.ratingFilter.mode === "unrated"}
                                title="Show unrated photos"
                            >
                                <span>Unrated</span>
                                <small>{photos.filter(photo => (decisionForPhoto(photo).rating || 0) === 0).length}</small>
                            </SidebarButton>
                        </div>
                    </section>
                    <section className={`photo-library-sidebar-section photo-library-photo-types${collapsedLibrarySections.has("types") ? " is-collapsed" : ""}`}>
                        <SidebarButton
                            className="photo-library-facet-heading"
                            onClick={() => toggleLibrarySection("types")}
                            aria-expanded={!collapsedLibrarySections.has("types")}
                        >
                            <span>Photo Type</span>
                            <span aria-hidden="true">{collapsedLibrarySections.has("types") ? "+" : "−"}</span>
                        </SidebarButton>
                        <div className="photo-library-facet-list">
                        <SidebarButton
                            className={`photo-facet-button${!selectedPhotoKindKeys.size ? " is-active" : ""}`}
                            onClick={() => setSelectedPhotoKindKeys(new Set())}
                        >
                            <span>All Photo Types</span><small>{photos.length}</small>
                        </SidebarButton>
                        {photoKindFacets.map(kind => (
                            <SidebarButton
                                key={kind.key}
                                className={`photo-facet-button${selectedPhotoKindKeys.has(kind.key) ? " is-active" : ""}`}
                                onClick={event => toggleFacet(setSelectedPhotoKindKeys, kind.key, event)}
                            >
                                <span>{kind.label}</span>
                                <small>{kind.count}</small>
                            </SidebarButton>
                        ))}
                        {burstGroups.length > 0 && (
                            <div className="photo-library-burst-summary" aria-label="Burst Review groups">
                                <div className="photo-library-burst-heading">
                                    <strong>Burst Review</strong>
                                    <small>{burstGroups.length} group{burstGroups.length === 1 ? "" : "s"} · {burstsNeedingReview} to review</small>
                                </div>
                                {burstGroups.map((group, index) => {
                                    const review = burstReviews.items.find(item => item.groupId === group.groupId);
                                    const reviewed = reviewedBurstIds.has(group.groupId);
                                    const selectedPicks = review?.selectedPhotoKeys?.length || (group.hasQualityEvidence ? 1 : 0);
                                    return (
                                        <SidebarButton
                                            key={group.groupId}
                                            className={`photo-library-burst-row${reviewed ? " is-reviewed" : ""}`}
                                            onClick={() => openBurstReview(group)}
                                            title={`Open burst group ${index + 1}`}
                                        >
                                            <span>
                                                <strong>B{index + 1} · Burst group</strong>
                                                <small>{reviewed ? "● Reviewed" : "● Needs review"}</small>
                                            </span>
                                            <em>{selectedPicks} selected / {group.count}</em>
                                        </SidebarButton>
                                    );
                                })}
                            </div>
                        )}
                        </div>
                    </section>
                    <section className={`photo-library-sidebar-section photo-library-events${collapsedLibrarySections.has("events") ? " is-collapsed" : ""}`}>
                        <div className="photo-library-section-heading">
                            <SidebarButton
                                className="photo-library-facet-heading"
                                onClick={() => toggleLibrarySection("events")}
                                aria-expanded={!collapsedLibrarySections.has("events")}
                            >
                                <span>Events</span>
                                <span aria-hidden="true">{collapsedLibrarySections.has("events") ? "+" : "−"}</span>
                            </SidebarButton>
                        </div>
                        <div className="photo-library-facet-list">
                        <SidebarButton className={`photo-facet-button${!selectedEventIds.size && !selectedChapterIds.size ? " is-active" : ""}`} onClick={() => {setSelectedEventIds(new Set()); setSelectedChapterIds(new Set());}}>
                            <span>All photos</span><small>{photos.length}</small>
                        </SidebarButton>
                        <SidebarButton className="photo-library-inline-action" disabled={!eventsReady || eventBusy || !photos.length} onClick={() => {eventEditing.current = true; setAutoEventsOpen(true);}}>✦ Auto Events</SidebarButton>
                        {!eventsReady && <small>Reading event metadata…</small>}
                        {eventsReady && photos.some(photo => photo.metadataReadFailed) && <small>Some photos have unavailable metadata; their groups may need review.</small>}
                        <EventManager items={eventChapters.items.filter(item => item.photoKeys.length)}
                            selected={selectedChapterIds} onSelect={(id, event) => toggleFacet(setSelectedChapterIds, id, event)}
                            onDrop={handleEventDrop} ready={eventsReady && !eventBusy} creating={manageEvents}
                            onEditingChange={onEventEditingChange}
                            onEdit={(action, id, name) => saveEventEdit(action, id, name, action === "new" ? newEventPhotos.current : selectedPhotos)}
                            onClose={() => { setManageEvents(false); newEventPhotos.current = []; }} />
                        <SidebarButton
                            className="photo-library-inline-action"
                            data-library-event="new-event" data-event-name="New event"
                            data-drop-ready={eventsReady && !eventBusy && !manageEvents ? "true" : "false"}
                            onClick={moveSelectedToNewEvent}
                            disabled={!selectedPhotos.length || !eventsReady || eventBusy}
                            title="Create an event from the selected photos"
                        >
                            + New event
                        </SidebarButton>
                        </div>
                    </section>
                    <section className={`photo-library-sidebar-section photo-library-cameras${collapsedLibrarySections.has("cameras") ? " is-collapsed" : ""}`}>
                        <SidebarButton
                            className="photo-library-facet-heading"
                            onClick={() => toggleLibrarySection("cameras")}
                            aria-expanded={!collapsedLibrarySections.has("cameras")}
                        >
                            <span>Cameras</span>
                            <span aria-hidden="true">{collapsedLibrarySections.has("cameras") ? "+" : "−"}</span>
                        </SidebarButton>
                        <div className="photo-library-facet-list">
                        <SidebarButton className={`photo-facet-button${!selectedCameraKeys.size ? " is-active" : ""}`} onClick={() => setSelectedCameraKeys(new Set())}>
                            <span>All Cameras</span><small>{photos.length}</small>
                        </SidebarButton>
                        {detectedCameras.map(camera => {
                            const sample = photos.find(photo => getCameraKey(photo) === camera.cameraKey);
                            const identity = cameraIdentityForPhoto(sample);
                            return (
                                <SidebarButton
                                    key={camera.cameraKey}
                                    className={`photo-facet-button${selectedCameraKeys.has(camera.cameraKey) ? " is-active" : ""}`}
                                    onClick={click => toggleFacet(setSelectedCameraKeys, camera.cameraKey, click)}
                                >
                                    <span style={{ color: identity?.color }}>{identity?.tag || "C"}</span>
                                    <span>{camera.label}</span><small>{camera.photoCount}</small>
                                </SidebarButton>
                            );
                        })}
                        </div>
                    </section>
                    <SidebarButton
                        className="photo-browser-control photo-library-reset-filters"
                        onClick={clearFilters}
                        disabled={!filtersActive}
                    >
                        Clear filters
                    </SidebarButton>
                </aside>
                <section className="photo-library-center" aria-label="Photo browser">
                    <header className="photo-library-review-header">
                        <h2>Photos</h2>
                        <div className="library-header-actions">
                            <SidebarButton aria-pressed={showShortcuts} onClick={() => setShowShortcuts(value => !value)} title="Keyboard shortcuts">? Shortcuts</SidebarButton>
                            <SidebarButton aria-expanded={!inspectorCollapsed} onClick={() => setInspectorCollapsed(value => !value)}>{inspectorCollapsed ? "Show preview" : "Hide preview"}</SidebarButton>
                        </div>
                    </header>
                    {showShortcuts && <div className="library-shortcut-help" role="note">Arrow keys: navigate · Space: preview · 0–5: rating · F: favorite · R: reject · Esc: close</div>}

                    {eventNotice && <div className="library-shortcut-help" role="status">{eventNotice}</div>}
                    {filtersActive && <div className="library-filter-chips" aria-label="Active filters">
                        {preferences.search && <SidebarButton onClick={() => updatePreferences({search: ""})}>Search: {preferences.search} ×</SidebarButton>}
                        {preferences.ratingFilter.mode !== "any" && <SidebarButton onClick={() => updatePreferences({minimumRating: 0, ratingFilter: {mode: "any", value: 0}})}>Rating ×</SidebarButton>}
                        {preferences.types.length > 0 && <SidebarButton onClick={() => updatePreferences({types: []})}>File type ×</SidebarButton>}
                        {preferences.orientations.length > 0 && <SidebarButton onClick={() => updatePreferences({orientations: []})}>Orientation ×</SidebarButton>}
                        {preferences.datePreset !== "any" && <SidebarButton onClick={() => updatePreferences({datePreset: "any"})}>Date ×</SidebarButton>}
                        {preferences.duplicatesOnly && <SidebarButton onClick={() => updatePreferences({duplicatesOnly: false})}>Duplicates ×</SidebarButton>}
                        {preferences.favoritesOnly && <SidebarButton onClick={() => updatePreferences({favoritesOnly: false})}>Favorites ×</SidebarButton>}
                        {selectedCameraKeys.size > 0 && <SidebarButton onClick={() => setSelectedCameraKeys(new Set())}>Cameras ({selectedCameraKeys.size}) ×</SidebarButton>}
                        {(selectedEventIds.size > 0 || selectedChapterIds.size > 0) && <SidebarButton onClick={() => {setSelectedEventIds(new Set()); setSelectedChapterIds(new Set());}}>Events ×</SidebarButton>}
                        {selectedPhotoKindKeys.size > 0 && <SidebarButton onClick={() => setSelectedPhotoKindKeys(new Set())}>Photo type ×</SidebarButton>}
                        {cullingFilter !== CullingFilterMode.ALL && <SidebarButton onClick={() => setCullingFilter(CullingFilterMode.ALL)}>Review filter ×</SidebarButton>}
                        <SidebarButton onClick={clearFilters}>Clear filters</SidebarButton>
                    </div>}
                    <LibraryToolbar
                        search={preferences.search}
                        onSearchChange={search => updatePreferences({ search }, { persist: false })}
                        onSearchCommit={() => persistPreferences(preferences)}
                        controls={libraryControls}
                        direction={preferences.sort.direction}
                        onToggleDirection={() => updateSort({ direction: preferences.sort.direction === "asc" ? "desc" : "asc" })}
                        filter={cullingFilter}
                        onFilterChange={setCullingFilter}
                        filters={[
                            { value: CullingFilterMode.ALL, label: "All", title: `${cullingSummary.total} photos` },
                            { value: CullingFilterMode.INCLUDED, label: "Included", title: `${cullingSummary.included} included photos` },
                            { value: CullingFilterMode.REJECTED, label: "Rejected", title: `${cullingSummary.rejected} rejected photos` }
                        ]}
                    />

                    <div className={`photo-browser-content photo-browser-content--${viewMode}`}>
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
                {(duplicateError || duplicateEvidence.status === PhotoDuplicateStatus.STALE) && (
                    <div
                        className={`photo-duplicate-summary${duplicateError ? " has-error" : ""}`}
                        role={duplicateError ? "alert" : "status"}
                        aria-live="polite"
                    >
                        {duplicateError || "Duplicate analysis is stale. Run it again."}
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
                            onClick={openOrReconnectFolder}
                            disabled={isLoading}
                            className="photo-browser-control photo-browser-primary-button"
                            title={reconnectingPhotoFolder ? "Reconnect the photo folder" : "Open a photo folder"}
                            aria-label={reconnectingPhotoFolder ? "Reconnect photo folder" : "Open photo folder"}
                        >
                            {reconnectingPhotoFolder ? "Reconnect Folder" : "Open Folder"}
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
                        onPhotoPreview={openSelectedPreview}
                        photos={visiblePhotos}
                        onPhotoClick={onPhotoClick}
                        onContextMenu={handleContextMenu}
                        onPhotoInteraction={handlePhotoGridInteraction}
                        focusedPhotoId={focusedPhotoId}
                        onFocusPhoto={focusPhoto}
                        navigationRef={photoNavigationRef}
                        viewMode={viewMode}
                        decisionForPhoto={decisionForPhoto}
                        cameraIdentityForPhoto={cameraIdentityForPhoto}
                        groupMode={groupMode}
                        groupLabelForPhoto={groupLabelForPhoto}
                        eventLabelForPhoto={eventLabelForPhoto}
                        sort={preferences.sort}
                        thumbnailSize={preferences.thumbnailSize}
                        onSortChange={changeListSort}
                        onPhotoDecisionChange={changeTargetDecision}
                    />
                )}
                    </div>
                    <div className="photo-browser-statusbar" role="status" aria-label="Photo browser status">
                        <span><strong>Results</strong> {visiblePhotos.length} / {photos.length}</span>
                        <span><strong>Selected</strong> {selectedCount}</span>
                        <span><strong>View</strong> {viewMode === "icons" ? "Grid" : "List"}</span>
                        <span>
                            <strong>Sort</strong>{" "}
                            {preferences.sort.field === "name"
                                ? "Name"
                                : preferences.sort.field === "quality"
                                    ? "Quality (AI)"
                                    : preferences.sort.field === "modified"
                                        ? "Date Modified"
                                        : preferences.sort.field === "taken"
                                            ? "Capture Time"
                                            : preferences.sort.field === "created"
                                                ? "Date Created"
                                                : preferences.sort.field === "rating"
                                                    ? "Rating"
                                                    : preferences.sort.field === "size"
                                                        ? "File Size"
                                                        : preferences.sort.field}{" "}
                            {preferences.sort.direction === "asc" ? "↑" : "↓"}
                        </span>
                        <span><strong>Group</strong> {groupMode === "none" ? "None" : groupMode}</span>
                        <div className="photo-browser-status-actions photo-thumbnail-size-control" role="toolbar" aria-label="Thumbnail size and view">
                            <ThumbnailZoom viewMode={viewMode} size={preferences.thumbnailSize}
                                onChange={(next, persist) => {
                                    switchView(next.viewMode);
                                    if (next.viewMode === "icons") updatePreferences({thumbnailSize:next.thumbnailSize}, {persist});
                                }} />
                            <SidebarButton className={`photo-footer-view${viewMode === "icons" ? " is-active" : ""}`} title="Grid view" aria-label="Grid view" aria-pressed={viewMode === "icons"} onClick={() => switchView("icons")}><ToolbarIcon kind="Grid" /></SidebarButton>
                            <SidebarButton className={`photo-footer-view${viewMode === "list" ? " is-active" : ""}`} title="List view" aria-label="List view" aria-pressed={viewMode === "list"} onClick={() => switchView("list")}><ToolbarIcon kind="List" /></SidebarButton>
                        </div>
                    </div>
                </section>
                <aside className="photo-library-inspector" aria-label="Photo inspector">
                    <div className="photo-inspector-tabs" role="tablist" aria-label="Inspector sections">
                        <button type="button" role="tab" aria-selected={inspectorTab === "preview"} onClick={() => setInspectorTab("preview")}>Preview</button>
                        <button type="button" role="tab" aria-selected={inspectorTab === "actions"} onClick={() => setInspectorTab("actions")}>Quick Actions</button>
                    </div>

                    {inspectorTab === "preview" ? (
                        focusedPhoto ? (
                            <>
                                <div className="photo-inspector-preview"><PhotoImage key={focusedPhoto.id} photo={focusedPhoto} profile="preview" initialProfile="thumbnail" requestDelay={180} priority={0} role="preview" alt={focusedPhoto.name} /></div>
                                <div className="photo-inspector-summary">
                                    <strong>{focusedPhoto.name}</strong>
                                    <span>
                                        {eventLabelForPhoto(focusedPhoto) || "Unassigned event"}{" · "}
                                        <b style={{ color: cameraIdentityForPhoto(focusedPhoto)?.color }}>
                                            {cameraIdentityForPhoto(focusedPhoto)?.tag || "—"}
                                        </b>
                                        {" · "}{decisionForPhoto(focusedPhoto).rating || 0}★
                                    </span>
                                </div>
                            </>
                        ) : (
                            <div className="photo-inspector-empty">
                                <span aria-hidden="true">▧</span>
                                <strong>Select a photo</strong>
                                <small>Preview and metadata will appear here.</small>
                            </div>
                        )
                    ) : (
                        <section className="photo-inspector-actions" aria-label="Selected photo actions">
                            <h3>{selectedCount ? `${selectedCount} selected` : "Select photos to edit"}</h3>
                            <button
                                type="button"
                                className="photo-browser-control photo-inspector-preview-button"
                                onClick={previewSelectedSet}
                                disabled={!previewPhotos.length}
                                title="Preview selected photos (Space)"
                            >
                                Preview <span>Space</span>
                            </button>
                            <div className="photo-inspector-rating-actions" role="group" aria-label="Rate selected photos">
                                {[1, 2, 3, 4, 5].map(rating => (
                                    <button
                                        key={rating}
                                        type="button"
                                        onClick={() => setSelectedRating(rating)}
                                        disabled={!selectedPhotos.length}
                                        className={selectedCommonRating === rating ? "is-active" : ""}
                                        title={`${rating} star${rating === 1 ? "" : "s"}`}
                                        aria-label={`Assign ${rating}-star rating`}
                                        aria-pressed={selectedCommonRating === rating}
                                    >★</button>
                                ))}
                                <button
                                    type="button"
                                    onClick={() => setSelectedRating(0)}
                                    disabled={!selectedPhotos.length}
                                    title="Clear rating"
                                    aria-label="Clear rating"
                                >×</button>
                            </div>
                            <div className="photo-inspector-decision-actions">
                                <button type="button" className={selectedAllFavorite ? "is-active" : ""} onClick={setSelectedFavorite} disabled={!selectedPhotos.length}>{selectedAllFavorite ? "♥ Favorite" : "♡ Favorite"}</button>
                                <button type="button" className={selectedAllRejected ? "is-rejected" : ""} onClick={rejectSelected} disabled={!selectedPhotos.length}>{selectedAllRejected ? "↶ Unreject" : "⊘ Reject"}</button>
                            </div>
                            <UxpDropdown
                                value=""
                                options={[
                                    { value: "", label: "Move to Event…" },
                                    { value: "new", label: "+ New Event" },
                                    ...eventChapters.items.filter(chapter => chapter.photoKeys.length).map(chapter => ({
                                        value: chapter.chapterId,
                                        label: `${chapter.name} (${chapter.photoKeys.length})`
                                    })),
                                    { value: "unassigned", label: "Remove from Event" }
                                ]}
                                onValueChange={moveSelectedToEvent}
                                disabled={!selectedPhotos.length}
                                className="photo-browser-control photo-inspector-event-select"
                                ariaLabel="Move selected photos to an event"
                            />
                        </section>
                    )}

                    {focusedPhoto && (
                        <>
                            <div className="photo-inspector-info-tabs" role="tablist" aria-label="Photo information">
                                <button type="button" role="tab" aria-selected={inspectorInfoTab === "metadata"} onClick={() => setInspectorInfoTab("metadata")}>Metadata</button>
                                <button type="button" role="tab" aria-selected={inspectorInfoTab === "keywords"} onClick={() => setInspectorInfoTab("keywords")}>Tags</button>
                            </div>
                            {inspectorInfoTab === "metadata" ? (
                                <div className="photo-inspector-metadata-grid">
                                    <span><small>Capture</small><strong>{formatPhotoDate(focusedPhoto.dateTaken || focusedPhoto.metadata?.dateTaken)}</strong></span>
                                    <span><small>Camera</small><strong style={{ color: cameraIdentityForPhoto(focusedPhoto)?.color }}>{cameraIdentityForPhoto(focusedPhoto)?.tag || "—"} · {focusedPhoto.cameraModel || focusedPhoto.metadata?.cameraModel || "Unknown"}</strong></span>
                                    <span><small>Dimensions</small><strong>{focusedPhoto.width && focusedPhoto.height ? `${focusedPhoto.width} × ${focusedPhoto.height}` : "Unavailable"}</strong></span>
                                    <span><small>File</small><strong>{formatPhotoBytes(focusedPhoto)}</strong></span>
                                </div>
                            ) : (
                                <div className="photo-inspector-keywords">
                                    <span>{eventLabelForPhoto(focusedPhoto) || "Unassigned event"}</span>
                                    <span>{decisionForPhoto(focusedPhoto).favorite ? "Favorite" : "No favorite tag"}</span>
                                    <span>{decisionForPhoto(focusedPhoto).culling === CullingStatus.REJECT ? "Rejected" : "Included"}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                className="photo-inspector-disclosure"
                                onClick={() => setInspectorFileOpen(value => !value)}
                                aria-expanded={inspectorFileOpen}
                            >
                                <span>{inspectorFileOpen ? "⌄" : "›"} File Properties</span>
                            </button>
                            {inspectorFileOpen && (
                                <div className="photo-inspector-properties">
                                    <span><b>Filename</b>{focusedPhoto.name}</span>
                                    <span><b>Document type</b>{(focusedPhoto.extension || focusedPhoto.name?.split(".").pop() || "Unknown").toUpperCase()} image</span>
                                    <span><b>Date created</b>{formatPhotoDate(focusedPhoto.created)}</span>
                                    <span><b>File size</b>{formatPhotoBytes(focusedPhoto)}</span>
                                    <span><b>Dimensions</b>{focusedPhoto.width && focusedPhoto.height ? `${focusedPhoto.width} × ${focusedPhoto.height}` : "Unavailable"}</span>
                                </div>
                            )}

                        </>
                    )}
                </aside>
            </div>

            {autoEventsOpen && <AutoEventsDialog photos={photos}
                onClose={() => {eventEditing.current = false; setAutoEventsOpen(false);}}
                onApply={async (proposal, approved) => {
                    if (eventSaving.current || !eventsReady) throw new Error("Events are busy. Please retry.");
                    const next = applyPhotoEventProposals(eventChapters, photos, proposal, approved);
                    eventSaving.current = true; setEventBusy(true);
                    try {
                        const saved = await App.savePhotoEventChapters(next, "PHOTO_AUTO_EVENTS_APPLY");
                        pushEventUndo(); setEventChapters(saved);
                        setSelectedChapterIds(new Set()); setSelectedEventIds(new Set());
                        setEventNotice(`${approved.length} suggested events applied. Undo is available above.`);
                    } finally {eventSaving.current = false; setEventBusy(false);}
                }} />}

            {isPreviewOpen && previewPhoto && (
                <PhotoReviewPreview photo={previewPhoto} photos={previewPhotos} index={previewIndex}
                    count={previewPhotos.length} selectionOnly={previewSession?.selectionOnly}
                    selected={selectedPhotoIds.has(previewPhoto.id)}
                    decision={decisionForPhoto(previewPhoto)}
                    camera={cameraIdentityForPhoto(previewPhoto)}
                    eventLabel={eventLabelForPhoto(previewPhoto)}
                    onChangeDecision={changePreviewDecision} onClose={closePreview}
                    onNavigate={step => step === "first" ? setPreviewPhoto(0)
                        : step === "last" ? setPreviewPhoto(previewPhotos.length - 1)
                            : movePreviewBy(step)} />
            )}

            {activeBurstGroup && activeBurstPhoto && createPortal(
                <div
                    className="review-overlay is-presented"
                    role="presentation"
                    onMouseDown={event => {
                        if (event.target === event.currentTarget) closeBurstReview();
                    }}
                >
                    <section className="photo-preview-dialog photo-burst-review" role="dialog" tabIndex={-1} aria-modal="true" aria-label="Burst Review">
                        <div className="photo-preview-header">
                            <strong>Burst Review · {burstReviewIndex + 1}/{activeBurstPhotos.length}</strong>
                            <span>{reviewedBurstIds.has(activeBurstGroup.groupId) ? "Reviewed" : "Needs review"}</span>
                            <span>{burstDraftIds.size} selected</span>
                            <button onClick={closeBurstReview}>Close</button>
                        </div>
                        <div
                            className="photo-preview-stage"
                            ref={previewStageRef}
                            onWheel={handlePreviewWheel}
                            onMouseDown={handlePreviewMouseDown}
                            onDoubleClick={togglePreviewScale}
                        >
                            <PhotoImage
                                key={activeBurstPhoto.id}
                                photo={activeBurstPhoto}
                                profile={burstProfile}
                                initialProfile="preview" requestDelay={80}
                                priority={0}
                                alt={activeBurstPhoto.name || "Burst frame"}
                                style={{ position: "absolute", ...previewImagePlacement(burstGeometry, previewScale, previewOffset, burstStage) }}
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
                                <button onClick={() => setBurstReviewIndex(previous => Math.max(0, previous - 1))} disabled={burstReviewIndex === 0}>Previous</button>
                                <button onClick={() => changePreviewScale(-0.25)} disabled={previewScale <= 0.25}>−</button>
                                <button onClick={fitPreview}>Fit</button>
                                <button onClick={() => changePreviewScale(0.25)} disabled={previewScale >= 4}>+</button>
                                <button onClick={() => setBurstReviewIndex(previous => Math.min(activeBurstPhotos.length - 1, previous + 1))} disabled={burstReviewIndex >= activeBurstPhotos.length - 1}>Next</button>
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
                                    <PhotoImage photo={photo} priority={1} alt={photo.name} />
                                    <span>{burstDraftIds.has(photo.id) ? "Pick" : "Not picked"}</span>
                                </div>
                            ))}
                        </div>
                        <div className="photo-burst-actions">
                            <button
                                disabled={!activeBurstGroup.hasQualityEvidence}
                                onClick={() => setBurstDraftIds(new Set([activeBurstGroup.bestPhotoId]))}
                            >
                                {activeBurstGroup.hasQualityEvidence ? "Use top score" : "Choose your picks"}
                            </button>
                            <button onClick={() => toggleBurstDraft(activeBurstPhoto)}>
                                {burstDraftIds.has(activeBurstPhoto.id) ? "Remove Pick" : "Add Pick"}
                            </button>
                            <button className="photo-browser-primary-button" onClick={applyActiveBurstReview} disabled={burstReviewBusy || !burstDraftIds.size}>
                                {burstReviewBusy ? "Applying…" : "Keep picks · reject others"}
                            </button>
                        </div>
                    </section>
                </div>, document.body
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

            {contextMenu && <PhotoContextMenu menu={contextMenu} menuRef={contextMenuRef} controls={libraryControls}
                events={eventChapters.items.filter(item => item.photoKeys.length)} ready={eventsReady && !eventBusy}
                decisionForPhoto={decisionForPhoto} onClose={() => setContextMenu(null)}
                onMove={id => saveEventEdit("move", id, "", contextMenu.photos).catch(eventFailed)}
                onEditingChange={onEventEditingChange}
                onNew={name => saveEventEdit("new", "", name, contextMenu.photos)}
                onDecision={changes => {
                    pushDecisionUndo();
                    contextMenu.photos.forEach(photo => changePhotoDecision(photo, changes));
                }} />}


        </section>
    );

}

export default React.memo(PhotoBrowserSection);
