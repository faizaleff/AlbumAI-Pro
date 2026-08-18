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
    createPhotoDecisionLookup,
    hasActivePhotoBrowserFilters,
    normalizePhotoDecisions,
    normalizePhotoBrowserPreferences,
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
    Object.freeze({ value: "name", label: "Name" }),
    Object.freeze({ value: "quality", label: "Quality (AI)" }),
    Object.freeze({ value: "modified", label: "Date Modified" }),
    Object.freeze({ value: "taken", label: "Date Taken" }),
    Object.freeze({ value: "created", label: "Date Created" }),
    Object.freeze({ value: "rating", label: "Rating" }),
    Object.freeze({ value: "size", label: "File Size" })
]);

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
    const [comparingPair, setComparingPair] = useState(null);
    const [cullingBusy, setCullingBusy] = useState(false);
    const decisionRevision = useRef(0);
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
    const visiblePhotos = culledPhotos;
    const filtersActive = hasActivePhotoBrowserFilters(preferences) || cullingFilter !== CullingFilterMode.ALL;

    const cullingSummary = useMemo(
        () => summarizeCulling(photos, decisionForPhoto, App.getPhotoBursts ? App.getPhotoBursts() : []),
        [photos, decisionForPhoto]
    );

    useEffect(() => {
        setPreferences(readSavedPreferences());
        setDecisions(normalizePhotoDecisions(App.getPhotoDecisions()));
        setDecisionError(null);
        setDuplicateEvidence(normalizePhotoDuplicateEvidence(
            App.getPhotoDuplicateEvidence()
        ));
        setDuplicateBusy(false);
        setDuplicateError(null);
        decisionRevision.current += 1;
    }, [projectId]);

    useEffect(() => {
        setDecisions(normalizePhotoDecisions(App.getPhotoDecisions()));
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

    const clearFilters = useCallback(() => {
        updatePreferences(previous => ({ sort: previous.sort }));
    }, [updatePreferences]);

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
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [focusedPhotoId, photos, changePhotoDecision]);

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
            <div className="photo-browser-toolbar" role="toolbar" aria-label="Photo browser controls">
                <div className="photo-browser-toolbar-group photo-browser-view-group" aria-label="View options">
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

                <div className="photo-browser-toolbar-group photo-browser-search-group" style={{ flex: "1 1 140px" }}>
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
                        style={{ width: "100%" }}
                    />
                </div>

                <div className="photo-browser-toolbar-group photo-browser-sort-group">
                    <UxpDropdown
                        id="photo-browser-sort"
                        value={preferences.sort.field}
                        options={PHOTO_SORT_OPTIONS}
                        onValueChange={field => updateSort({ field })}
                        className="photo-browser-sort-select photo-browser-control"
                        ariaLabel="Sort photos by"
                        title="Sort photos by"
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
                        title="Clear photo selection"
                        aria-label="Clear photo selection"
                    >
                        Clear
                    </button>
                </div>
            </div>

            {/* Smart Secondary Filter & Culling Bar (Row 2) */}
            {photos.length > 0 && (
                <div className="photo-culling-toolbar">
                    <div className="photo-culling-pills">
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

                    <div className="photo-filter-inline-group" style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
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
                                aria-label="Clear photo filters"
                                title="Clear search and filters"
                                style={{ background: "#4a2020", borderColor: "#7a3030", color: "#ffaaaa", fontSize: 10, padding: "3px 6px", minHeight: 24 }}
                            >
                                ✕ Clear
                            </button>
                        )}
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
                        focusedPhotoId={focusedPhotoId}
                        onFocusPhoto={focusPhoto}
                        viewMode={viewMode}
                        decisionForPhoto={decisionForPhoto}
                        onPhotoDecisionChange={changePhotoDecision}
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
