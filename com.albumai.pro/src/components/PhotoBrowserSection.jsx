import React, {
    useCallback,
    useEffect,
    useMemo,
    useState
} from "react";

import ThumbnailGrid from "./ThumbnailGrid";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import {
    selectAllBrowserPhotos,
    setCanonicalBrowserPhotos
} from "../services/BrowserSelectionCommands";
import App from "../app/AppController";

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

    const [viewMode, setViewMode] = useState("icons");
    const [selectedCount, setSelectedCount] = useState(
        () => App.selection.selectedIds().size
    );
    const readSavedSort = () => {
        const saved = App.project.getProject()?.metadata?.photoBrowserSort;
        return {
            field: ["modified", "taken"].includes(saved?.field)
                ? saved.field
                : "name",
            direction: saved?.direction === "desc" ? "desc" : "asc"
        };
    };
    const [sort, setSort] = useState(readSavedSort);

    const sortedPhotos = useMemo(() => {

        const dateValue = (photo, taken = false) => {
            const value = taken
                ? photo?.dateTaken || photo?.exif?.dateTaken
                : photo?.modified || photo?.file?.modified;
            const milliseconds = value instanceof Date
                ? value.getTime()
                : new Date(value || 0).getTime();
            return Number.isFinite(milliseconds) && milliseconds > 0
                ? milliseconds
                : null;
        };
        const name = photo => String(photo?.name || "");
        const ordered = [...photos];

        ordered.sort((left, right) => {
            if (sort.field === "name") {
                const comparison = name(left).localeCompare(name(right), undefined, {
                    numeric: true,
                    sensitivity: "base"
                });
                return sort.direction === "desc" ? -comparison : comparison;
            }

            const leftDate = dateValue(left, sort.field === "taken");
            const rightDate = dateValue(right, sort.field === "taken");
            if (leftDate == null && rightDate == null) return name(left).localeCompare(name(right));
            if (leftDate == null) return 1;
            if (rightDate == null) return -1;
            const comparison = leftDate - rightDate;
            return sort.direction === "desc" ? -comparison : comparison;
        });

        return ordered;

    }, [photos, sort]);

    useEffect(() => {
        setSort(readSavedSort());
    }, [projectId]);

    const updateSort = useCallback(next => {
        setSort(previous => {
            const resolved = { ...previous, ...next };
            if (
                resolved.field === previous.field &&
                resolved.direction === previous.direction
            ) return previous;

            App.saveProject(
                { photoBrowserSort: resolved },
                { reason: "PHOTO_BROWSER_SORT" }
            ).catch(error => console.warn("Photo browser sort persistence:", error));
            return resolved;
        });
    }, []);

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
        App.selection.setOrderedPhotos(sortedPhotos);
        setCanonicalBrowserPhotos(sortedPhotos);
    }, [sortedPhotos]);

    useEffect(() => {
        if (focusedPhotoId && !sortedPhotos.some(
            photo => photo?.id === focusedPhotoId
        )) {
            onFocusPhoto?.(null);
        }
    }, [focusedPhotoId, onFocusPhoto, sortedPhotos]);

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

            if (isSelectAll && sortedPhotos.length) {
                event.preventDefault();
                // Keep select-all aligned with the canonical browser order,
                // including a sort change that has not yet reached its effect.
                PhotoBrowserPerformance.trace(
                    "BROWSER_SELECT_ALL_SHORTCUT",
                    { photos: sortedPhotos.length }
                );
                selectAllBrowserPhotos();
                PhotoBrowserPerformance.trace(
                    "BROWSER_SELECTION_OPERATION",
                    {
                        operation: "selectAll",
                        selected: sortedPhotos.length
                    }
                );
            } else if (event.key === "Escape") {
                App.selection.clear();
            } else if (sortedPhotos.length) {
                const currentIndex = Math.max(0, sortedPhotos.findIndex(
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
                            sortedPhotos.length - 1,
                            currentIndex + 1
                        );
                        break;
                    case "Home":
                        nextIndex = 0;
                        break;
                    case "End":
                        nextIndex = sortedPhotos.length - 1;
                        break;
                    case "PageUp":
                        nextIndex = Math.max(0, currentIndex - pageSize);
                        break;
                    case "PageDown":
                        nextIndex = Math.min(
                            sortedPhotos.length - 1,
                            currentIndex + pageSize
                        );
                        break;
                    case " ":
                    case "Spacebar": {
                        const focused = sortedPhotos[currentIndex];
                        if (focused) {
                            event.preventDefault();
                            App.selection.toggle(focused);
                            focusPhoto(focused);
                        }
                        return;
                    }
                    case "Enter":
                        if (sortedPhotos[currentIndex]) {
                            event.preventDefault();
                            focusPhoto(sortedPhotos[currentIndex]);
                        }
                        return;
                    default:
                        return;
                }

                const next = sortedPhotos[nextIndex];
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
    }, [focusPhoto, focusedPhotoId, sortedPhotos]);

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
                <div className="photo-browser-toolbar-group photo-browser-sort-group">
                <label className="photo-browser-sort-label" htmlFor="photo-browser-sort">
                    Sort by
                    <select
                        id="photo-browser-sort"
                        value={sort.field}
                        onChange={event => updateSort({ field: event.target.value })}
                        className="photo-browser-sort-select photo-browser-control"
                        aria-label="Sort photos by"
                        title="Sort photos by"
                    >
                        <option value="name">Name</option>
                        <option value="modified">Date Modified</option>
                        <option value="taken">Date Taken</option>
                    </select>
                </label>
                <button
                    type="button"
                    onClick={() => updateSort({ direction: sort.direction === "asc" ? "desc" : "asc" })}
                    title={sort.field === "name"
                        ? sort.direction === "asc" ? "Name A–Z" : "Name Z–A"
                        : `${sort.field === "taken" ? "Date Taken" : "Date Modified"}: ${sort.direction === "asc" ? "Oldest to Newest" : "Newest to Oldest"}`}
                    aria-label="Toggle sort direction"
                    className="photo-browser-control photo-browser-direction-button"
                >
                    {sort.direction === "asc" ? "↑ Asc" : "↓ Desc"}
                </button>
                </div>
                <div className="photo-browser-toolbar-group photo-browser-selection-group">
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
                    disabled={!projectId || isLoading || photoFolderChange?.busy || photoFolderChange?.prepared}
                    aria-disabled={!projectId || isLoading || photoFolderChange?.busy || photoFolderChange?.prepared}
                    className="photo-browser-control"
                    title="Choose a different photo folder"
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
                    disabled={!sortedPhotos.length}
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
                {isLoading ? (
                    <div className="photo-browser-state photo-browser-loading-state" role="status" aria-live="polite">
                        <div className="photo-browser-spinner" aria-hidden="true" />
                        <h2>Loading Photos...</h2>
                        <p>{loadingPhotoCount} {loadingPhotoCount === 1 ? "photo" : "photos"} found</p>
                    </div>
                ) : !sortedPhotos.length ? (
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
                ) : (
                    <ThumbnailGrid
                        photos={sortedPhotos}
                        onPhotoClick={onPhotoClick}
                        focusedPhotoId={focusedPhotoId}
                        onFocusPhoto={focusPhoto}
                        viewMode={viewMode}
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
                <span><strong>Photos:</strong> {sortedPhotos.length}</span>
                <span><strong>Selected:</strong> {selectedCount}</span>
                <span><strong>View:</strong> {viewMode === "icons" ? "Icons" : "List"}</span>
                <span>
                    <strong>Sort:</strong>{" "}
                    {sort.field === "name" ? "Name" : sort.field === "modified" ? "Date Modified" : "Date Taken"}{" "}
                    {sort.direction === "asc" ? "↑" : "↓"}
                </span>
            </div>
        </section>
    );

}

export default React.memo(PhotoBrowserSection);
