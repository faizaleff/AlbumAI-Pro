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
    const visiblePhotos = queryResult.photos;
    const filtersActive = hasActivePhotoBrowserFilters(preferences);

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
                </div>
                <div className="photo-browser-toolbar-group photo-browser-query-group">
                <label className="photo-browser-filter-label" htmlFor="photo-browser-search">
                    Search
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
                        placeholder="Filename"
                        aria-label="Search photos by filename"
                    />
                </label>
                <label className="photo-browser-filter-label" htmlFor="photo-browser-type">
                    Type
                    <UxpDropdown
                        id="photo-browser-type"
                        value={preferences.types[0] || ""}
                        options={[
                            { value: "", label: "All" },
                            ...queryResult.facets.types.map(type => ({
                                value: type,
                                label: type.toUpperCase()
                            }))
                        ]}
                        onValueChange={type => updatePreferences({
                            types: type ? [type] : []
                        })}
                        className="photo-browser-filter-select photo-browser-control"
                        ariaLabel="Filter photos by file type"
                    />
                </label>
                <label className="photo-browser-filter-label" htmlFor="photo-browser-orientation">
                    Orientation
                    <UxpDropdown
                        id="photo-browser-orientation"
                        value={preferences.orientations[0] || ""}
                        options={[
                            { value: "", label: "All" },
                            ...queryResult.facets.orientations.map(
                                orientation => ({
                                    value: orientation,
                                    label: orientation.charAt(0).toUpperCase()
                                        + orientation.slice(1)
                                })
                            )
                        ]}
                        onValueChange={orientation => updatePreferences({
                            orientations: orientation ? [orientation] : []
                        })}
                        className="photo-browser-filter-select photo-browser-control"
                        ariaLabel="Filter photos by orientation"
                    />
                </label>
                <label className="photo-browser-filter-label" htmlFor="photo-browser-date">
                    Date
                    <UxpDropdown
                        id="photo-browser-date"
                        value={preferences.datePreset}
                        options={PHOTO_DATE_FILTER_OPTIONS}
                        onValueChange={datePreset => updatePreferences({
                            datePreset
                        })}
                        className="photo-browser-filter-select photo-browser-control"
                        ariaLabel="Filter photos by date"
                    />
                </label>
                <label className="photo-browser-filter-label" htmlFor="photo-browser-rating">
                    Rating
                    <UxpDropdown
                        id="photo-browser-rating"
                        value={preferences.minimumRating}
                        options={PHOTO_RATING_FILTER_OPTIONS}
                        onValueChange={minimumRating => updatePreferences({
                            minimumRating: Number(minimumRating)
                        })}
                        className="photo-browser-filter-select photo-browser-control"
                        ariaLabel="Filter photos by minimum rating"
                    />
                </label>
                <label className="photo-browser-favorite-filter">
                    <input
                        type="checkbox"
                        checked={preferences.favoritesOnly}
                        onChange={event => updatePreferences({
                            favoritesOnly: event.target.checked
                        })}
                    />
                    Favourites only
                </label>
                <label className="photo-browser-favorite-filter">
                    <input
                        type="checkbox"
                        checked={preferences.duplicatesOnly}
                        disabled={!duplicateReady}
                        onChange={event => updatePreferences({
                            duplicatesOnly: event.target.checked
                        })}
                    />
                    Duplicates only
                </label>
                <button
                    type="button"
                    onClick={analyzeDuplicates}
                    disabled={!folderLoaded || !photos.length || duplicateBusy}
                    className="photo-browser-control"
                    aria-label="Analyze exact duplicate photos"
                    title="Compare same-size candidates using full-content SHA-256"
                >
                    {duplicateBusy
                        ? "Analyzing Duplicates…"
                        : duplicateReady
                            ? "Reanalyze Duplicates"
                            : "Find Duplicates"}
                </button>
                <button
                    type="button"
                    onClick={clearFilters}
                    disabled={!filtersActive}
                    className="photo-browser-control"
                    aria-label="Clear photo filters"
                    title="Clear search and filters"
                >
                    Clear Filters
                </button>
                </div>
                <div className="photo-browser-toolbar-group photo-browser-sort-group">
                <label className="photo-browser-sort-label" htmlFor="photo-browser-sort">
                    Sort by
                    <UxpDropdown
                        id="photo-browser-sort"
                        value={preferences.sort.field}
                        options={PHOTO_SORT_OPTIONS}
                        onValueChange={field => updateSort({ field })}
                        className="photo-browser-sort-select photo-browser-control"
                        ariaLabel="Sort photos by"
                        title="Sort photos by"
                    />
                </label>
                <button
                    type="button"
                    onClick={() => updateSort({ direction: preferences.sort.direction === "asc" ? "desc" : "asc" })}
                    title={`Sort ${preferences.sort.direction === "asc" ? "ascending" : "descending"}`}
                    aria-label="Toggle sort direction"
                    className="photo-browser-control photo-browser-direction-button"
                >
                    {preferences.sort.direction === "asc" ? "↑ Asc" : "↓ Desc"}
                </button>
                </div>
                <div className="photo-browser-toolbar-group photo-browser-selection-group">
                {!photos.length && (
                    <button
                        type="button"
                        onClick={onOpenFolder}
                        disabled={isLoading}
                        className="photo-browser-control photo-browser-open-folder-control"
                        title="Choose a photo folder"
                        aria-label="Open photo folder"
                    >
                        {isLoading ? "Opening Folder…" : "Open Photo Folder"}
                    </button>
                )}
                <button
                    type="button"
                    onClick={onRefresh}
                    disabled={!folderLoaded || isLoading}
                    aria-disabled={!folderLoaded || isLoading}
                    className="photo-browser-control"
                    title={folderLoaded
                        ? "Refresh photo folder"
                        : "Open a photo folder before refreshing"}
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
                    title={canChangePhotoFolder
                        ? "Choose a different photo folder"
                        : "Open a photo folder before changing it"}
                    aria-label="Change photo folder"
                >
                    {photoFolderChange?.busy
                        ? "Changing Folder…"
                        : "Change Photo Folder"}
                </button>
                <button
                    type="button"
                    onClick={() => {
                        selectAllBrowserPhotos();
                    }}
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
                    Clear Selection
                </button>
                </div>
            </div>

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
                {(photos.length > 0 || duplicateError) && (
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
                        : preferences.sort.field === "modified"
                            ? "Date Modified"
                            : preferences.sort.field === "taken"
                                ? "Date Taken"
                                : preferences.sort.field === "created"
                                    ? "Date Created"
                                    : preferences.sort.field === "rating"
                                        ? "Rating"
                                    : "File Size"}{" "}
                    {preferences.sort.direction === "asc" ? "↑" : "↓"}
                </span>
            </div>
        </section>
    );

}

export default React.memo(PhotoBrowserSection);
