import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from "react";

import ThumbnailCard from "./ThumbnailCard";
import UxpDropdown from "./UxpDropdown";
import PhotoImage from "./PhotoImage";
import App from "../app/AppController";
import RefreshService from "../services/RefreshService";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import ImageSourceCapabilityService
    from "../services/ImageSourceCapabilityService";

const LIST_RATING_OPTIONS = Object.freeze(
    [0, 1, 2, 3, 4, 5].map(rating => Object.freeze({
        value: rating,
        label: rating ? `${rating}★` : "—"
    }))
);

const ICON_WIDTH = 104;
const ICON_HEIGHT = 122;
const ICON_GAP = 8;
const ICON_PADDING = 6;
const ICON_OVERSCAN_ROWS = 1;
const LIST_ROW_HEIGHT = 38;
const LIST_OVERSCAN_ROWS = 2;
const LIST_IMAGE_STYLE = {
    width: "100%", height: "100%", objectFit: "cover",
    display: "block", pointerEvents: "none"
};

function formatListDate(value) {
    const date = value ? new Date(value) : null;
    return date && !Number.isNaN(date.getTime())
        ? date.toLocaleDateString()
        : "—";
}

function usePhotoItemState(photo) {
    const mountedRef = useRef(false);
    const photoIdRef = useRef(photo?.id || null);
    const [state, setState] = useState(() => ({
        selected: App.selection.isSelected(photo?.id),
        thumbnailRevision: photo?.thumbnail || null,
        loading: photo?.loading === true
    }));

    useEffect(() => {
        const photoId = photo?.id || null;
        mountedRef.current = true;
        photoIdRef.current = photoId;
        const canUpdate = () =>
            mountedRef.current && photoIdRef.current === photoId;
        if (canUpdate()) {
            setState({ selected: App.selection.isSelected(photoId), thumbnailRevision: photo?.thumbnail || null, loading: photo?.loading === true });
        }
        const unsubscribeSelection = App.selection.subscribe((selectedIds, changedIds) => {
            if (!changedIds.has(photoId)) return;
            if (!canUpdate()) return;
            setState(previous => ({ ...previous, selected: selectedIds.has(photo.id) }));
        });
        const unsubscribeRefresh = RefreshService.subscribe(scope => {
            if (scope !== "thumbnails" && scope !== "all") return;
            if (!canUpdate()) return;
            setState(previous => {
                const thumbnailRevision = photo?.thumbnail || null;
                const loading = photo?.loading === true;
                return previous.thumbnailRevision === thumbnailRevision && previous.loading === loading
                    ? previous : { ...previous, thumbnailRevision, loading };
            });
        });
        return () => {
            mountedRef.current = false;
            unsubscribeSelection();
            unsubscribeRefresh();
        };
    }, [photo]);
    return state;
}

const IconsPhotoItem = React.memo(function IconsPhotoItem({ photo, onPhotoClick, onContextMenu, style, focused, viewMode, visible, decision, cameraIdentity, onPhotoDecisionChange }) {
    PhotoBrowserPerformance.recordRender("IconsPhotoItem");
    const state = usePhotoItemState(photo);
    return <div className={`photo-grid-item${focused ? " is-focused" : ""}`} style={style}><ThumbnailCard photo={photo} onClick={onPhotoClick} onContextMenu={onContextMenu} compact thumbnailRevision={state.thumbnailRevision} loading={state.loading} selected={state.selected} viewMode={viewMode} visible={visible} decision={decision} cameraIdentity={cameraIdentity} onDecisionChange={onPhotoDecisionChange} /></div>;
});

const ListPhotoRow = React.memo(function ListPhotoRow({ photo, onPhotoClick, onContextMenu, style, focused, viewMode, visible, decision, cameraIdentity, eventLabel, onPhotoDecisionChange }) {
    PhotoBrowserPerformance.recordRender("ListPhotoRow");
    const state = usePhotoItemState(photo);
    const handleClick = useCallback(event => onPhotoClick(photo, event), [photo, onPhotoClick]);
    const handleContextMenu = useCallback(event => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(event, photo);
    }, [photo, onContextMenu]);
    return <div onClick={handleClick} onContextMenu={handleContextMenu} role="option" aria-selected={state.selected} title={photo.name} className={`photo-list-row${state.selected ? " is-selected" : ""}${focused ? " is-focused" : ""}`} style={{ ...style, display: "flex", gap: 8, alignItems: "center", padding: "0 8px", boxSizing: "border-box", cursor: "pointer", color: "#fff" }}>
        <div style={{ flex: "0 0 30px", width: 30, height: 30, background: "#1f1f1f", overflow: "hidden" }}><PhotoImage photo={photo} profile="thumbnail" priority={visible ? 1 : 2} role="browser" onImageLoad={() => PhotoBrowserPerformance.thumbnailVisible(photo.id)} fallback={status => <div style={{ color: "#777", fontSize: 13, textAlign: "center", lineHeight: "30px" }}>{status === "loading" ? "…" : "▧"}</div>} style={LIST_IMAGE_STYLE} /></div>
        <div style={{ flex: "1 1 auto", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 12 }}>{photo.name}</div>
        <div className="photo-list-date">{formatListDate(photo.created || photo.modified)}</div>
        <div style={{ flex: "0 0 42px", color: "#aaa", fontSize: 11, textTransform: "uppercase" }}>{photo.extension || "—"}</div>
        <span className="photo-camera-tag" style={{ borderColor: cameraIdentity?.color, color: cameraIdentity?.color }}>
            {cameraIdentity?.tag || "—"}
        </span>
        <div className="photo-list-event" title={eventLabel || "Unassigned"}>{eventLabel || "Unassigned"}</div>
        <UxpDropdown
            className="photo-list-rating"
            value={decision.rating}
            options={LIST_RATING_OPTIONS}
            onValueChange={rating => {
                onPhotoDecisionChange?.(photo, {
                    rating: Number(rating)
                });
            }}
            ariaLabel={`Rate ${photo.name}`}
            stopPropagation
        />
        <button
            type="button"
            className={`photo-list-favorite${decision.favorite ? " is-favorite" : ""}`}
            onClick={event => {
                event.stopPropagation();
                onPhotoDecisionChange?.(photo, {
                    favorite: !decision.favorite
                });
            }}
            aria-pressed={decision.favorite}
            aria-label={`${decision.favorite ? "Remove" : "Add"} ${photo.name} ${decision.favorite ? "from" : "to"} favourites`}
        >
            {decision.favorite ? "♥" : "♡"}
        </button>
        <button
            type="button"
            className={`photo-list-reject${decision.culling === "REJECT" ? " is-rejected" : ""}`}
            onClick={event => {
                event.stopPropagation();
                onPhotoDecisionChange?.(photo, {
                    culling: decision.culling === "REJECT" ? "UNRATED" : "REJECT"
                });
            }}
            aria-label={decision.culling === "REJECT" ? `Unreject ${photo.name}` : `Reject ${photo.name}`}
        >
            {decision.culling === "REJECT" ? "↶" : "⊘"}
        </button>
    </div>;
});

function equalWindow(left, right) {
    return left.start === right.start &&
        left.end === right.end &&
        left.columns === right.columns &&
        left.totalHeight === right.totalHeight &&
        left.visibleStart === right.visibleStart &&
        left.visibleEnd === right.visibleEnd;
}

function iconDimensions(requestedWidth = ICON_WIDTH) {
    const width = Math.max(84, Math.min(144, Number(requestedWidth) || ICON_WIDTH));
    const height = width + (ICON_HEIGHT - ICON_WIDTH);
    return { width, height, rowHeight: height + ICON_GAP };
}

function bootstrapWindow(photos, viewMode, reducedProfiles, thumbnailSize) {
    const isList = viewMode === "list";
    const dimensions = iconDimensions(thumbnailSize);
    const overscanRows = reducedProfiles
        ? isList ? LIST_OVERSCAN_ROWS : ICON_OVERSCAN_ROWS
        : 0;
    const end = Math.min(
        photos.length,
        overscanRows + 1
    );

    return {
        start: 0,
        end,
        columns: 1,
        totalHeight: photos.length * (
            isList ? LIST_ROW_HEIGHT : dimensions.rowHeight
        ),
        visibleStart: 0,
        visibleEnd: Math.min(photos.length, 1)
    };
}

export function calculatePhotoBrowserWindow({
    photoCount,
    viewMode,
    reducedProfiles,
    viewportWidth,
    viewportHeight,
    scrollTop: requestedScrollTop,
    thumbnailSize = ICON_WIDTH
}) {
    const dimensions = iconDimensions(thumbnailSize);
    const count = Math.max(0, Number(photoCount) || 0);
    let columns = 1;
    let totalHeight = 0;
    let visibleStart = 0;
    let visibleEnd = 0;
    let start = 0;
    let end = 0;
    let scrollTop = Math.max(0, Number(requestedScrollTop) || 0);
    if (viewMode === "list") {
        totalHeight = count * LIST_ROW_HEIGHT;
        scrollTop = Math.min(
            scrollTop,
            Math.max(0, totalHeight - viewportHeight)
        );
        visibleStart = Math.floor(scrollTop / LIST_ROW_HEIGHT);
        visibleEnd = Math.min(
            count,
            Math.ceil((scrollTop + viewportHeight) / LIST_ROW_HEIGHT)
        );
        const overscan = reducedProfiles ? LIST_OVERSCAN_ROWS : 0;
        start = Math.max(0, visibleStart - overscan);
        end = Math.min(count, visibleEnd + overscan);
    } else {
        columns = Math.max(1, Math.floor(
            (viewportWidth - ICON_PADDING * 2 + ICON_GAP) /
            (dimensions.width + ICON_GAP)
        ));
        const rowCount = Math.ceil(count / columns);
        totalHeight = rowCount
            ? ICON_PADDING * 2 + rowCount * dimensions.height +
                Math.max(0, rowCount - 1) * ICON_GAP
            : 0;
        scrollTop = Math.min(
            scrollTop,
            Math.max(0, totalHeight - viewportHeight)
        );
        const firstRow = Math.floor(
            Math.max(0, scrollTop - ICON_PADDING) / dimensions.rowHeight
        );
        const visibleRows = Math.max(
            1,
            Math.ceil(viewportHeight / dimensions.rowHeight) +
                (reducedProfiles ? 1 : 0)
        );
        visibleStart = Math.min(count, firstRow * columns);
        visibleEnd = Math.min(count, (firstRow + visibleRows) * columns);
        const overscan = reducedProfiles ? ICON_OVERSCAN_ROWS : 0;
        start = Math.max(0, (firstRow - overscan) * columns);
        end = Math.min(
            count,
            (firstRow + visibleRows + overscan) * columns
        );
    }
    return Object.freeze({
        start,
        end,
        columns,
        totalHeight,
        visibleStart,
        visibleEnd,
        scrollTop
    });
}

function ThumbnailGrid({
    photos = [],
    onPhotoClick,
    onContextMenu,
    onPhotoInteraction,
    viewMode = "icons",
    focusedPhotoId = null,
    onFocusPhoto,
    decisionForPhoto = () => ({ rating: 0, favorite: false }),
    cameraIdentityForPhoto = () => null,
    groupLabelForPhoto = () => "",
    eventLabelForPhoto = () => "",
    sort = { field: "name", direction: "asc" },
    thumbnailSize = ICON_WIDTH,
    onSortChange,
    onPhotoDecisionChange
}) {
    PhotoBrowserPerformance.recordRender("ThumbnailGrid");
    const viewportRef = useRef(null);
    const frameRef = useRef(null);
    const initialRenderAt = useRef(PhotoBrowserPerformance.timestamp());
    const pendingScrollAt = useRef(null);
    const scrollMeasurementRequested = useRef(false);
    const layoutRef = useRef({ width: null, height: null });
    const windowRef = useRef({ start: 0, end: 0, columns: 1, totalHeight: 0, visibleStart: 0, visibleEnd: 0 });
    const [windowState, setWindowState] = useState(windowRef.current);
    const reducedProfiles =
        ImageSourceCapabilityService.supportsReducedProfiles(photos);
    const dimensions = iconDimensions(thumbnailSize);
    // UXP can publish photos before the viewport has a measurable size.
    // Bootstrap a bounded window for both views so neither Icons nor List can
    // render a transient empty browser before the layout pass replaces it.
    const renderWindow = photos.length > 0 &&
        windowState.end === windowState.start
        ? bootstrapWindow(photos, viewMode, reducedProfiles, thumbnailSize)
        : windowState;

    const handlePhotoClick = useCallback((photo, event) => {
        if (typeof onPhotoInteraction === "function") {
            onPhotoInteraction(photo, event);
            return;
        }
        onPhotoClick?.(photo);
        onFocusPhoto?.(photo?.id);
    }, [onFocusPhoto, onPhotoClick, onPhotoInteraction]);

    const calculateWindow = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return false;
        const viewportWidth = viewport.clientWidth;
        const viewportHeight = viewport.clientHeight;
        if (!viewportWidth || !viewportHeight) return false;
        const calculated = calculatePhotoBrowserWindow({
            photoCount: photos.length,
            viewMode,
            reducedProfiles,
            viewportWidth,
            viewportHeight,
            scrollTop: viewport.scrollTop,
            thumbnailSize
        });
        const {
            start,
            end,
            columns,
            totalHeight,
            visibleStart,
            visibleEnd,
            scrollTop
        } = calculated;
        // A view switch can reduce the scrollable height. Apply the clamped
        // position before rendering so virtual indices always address photos.
        if (viewport.scrollTop !== scrollTop) viewport.scrollTop = scrollTop;
        layoutRef.current = {
            width: viewportWidth,
            height: viewportHeight
        };
        const next = { start, end, columns, totalHeight, visibleStart, visibleEnd };
        const visible = photos.slice(visibleStart, visibleEnd);
        const overscan = photos.slice(start, visibleStart).concat(photos.slice(visibleEnd, end));
        App.setVisiblePhotoThumbnails({ visible, overscan });
        const changed = !equalWindow(windowRef.current, next);
        if (changed) {
            windowRef.current = next;
            setWindowState(next);
        }
        return changed;
    }, [photos, reducedProfiles, thumbnailSize, viewMode]);

    const scheduleWindow = useCallback(event => {
        if (event) scrollMeasurementRequested.current = true;
        if (frameRef.current != null) return;
        frameRef.current = requestAnimationFrame(() => {
            frameRef.current = null;
            pendingScrollAt.current =
                scrollMeasurementRequested.current
                    ? PhotoBrowserPerformance.timestamp()
                    : null;
            scrollMeasurementRequested.current = false;
            const changed = calculateWindow();
            if (!changed) pendingScrollAt.current = null;
        });
    }, [calculateWindow]);

    const handleResize = useCallback(entries => {
        const entry = entries?.[0];
        const width = Math.round(entry?.contentRect?.width ??
            viewportRef.current?.clientWidth ?? 0);
        const height = Math.round(entry?.contentRect?.height ??
            viewportRef.current?.clientHeight ?? 0);
        const previous = layoutRef.current;

        if (width === previous.width && height === previous.height) return;

        calculateWindow();
    }, [calculateWindow]);

    // Scroll events can be queued while Photoshop is showing the folder
    // picker or while a refreshed photo array is being published. They do not
    // belong to the next layout generation. Reset the timing boundary before
    // measuring the new photo set/view so diagnostics cannot report modal
    // wait time as scroll-render latency.
    useLayoutEffect(() => {
        pendingScrollAt.current = null;
        scrollMeasurementRequested.current = false;
        initialRenderAt.current =
            PhotoBrowserPerformance.timestamp();
    }, [photos, thumbnailSize, viewMode]);

    // The initial window used to depend solely on requestAnimationFrame or a
    // ResizeObserver notification. In Photoshop UXP neither is guaranteed to
    // fire after this viewport is first attached, leaving the initial 0..0
    // range in place. Calculate once in the layout pass; the existing async
    // observers continue to own all later resize and scroll updates.
    useLayoutEffect(() => {
        calculateWindow();
    }, [calculateWindow]);

    useEffect(() => {
        scheduleWindow();
        const retryTimer = setTimeout(
            () => calculateWindow(),
            0
        );
        window.addEventListener("resize", scheduleWindow);
        const resizeObserver = typeof ResizeObserver === "undefined"
            ? null
            : new ResizeObserver(handleResize);
        if (resizeObserver && viewportRef.current) {
            resizeObserver.observe(viewportRef.current);
        }
        return () => {
            window.removeEventListener("resize", scheduleWindow);
            resizeObserver?.disconnect();
            clearTimeout(retryTimer);
            pendingScrollAt.current = null;
            scrollMeasurementRequested.current = false;
            if (frameRef.current != null) cancelAnimationFrame(frameRef.current);
        };
    }, [calculateWindow, handleResize, scheduleWindow]);

    useEffect(() => {
        const scrollRenderMs = pendingScrollAt.current == null ? null : PhotoBrowserPerformance.timestamp() - pendingScrollAt.current;
        const initialRenderMs = initialRenderAt.current == null ? null : PhotoBrowserPerformance.timestamp() - initialRenderAt.current;
        const renderWindow = windowState;
        PhotoBrowserPerformance.recordVirtualization({ visibleItems: renderWindow.visibleEnd - renderWindow.visibleStart, renderedItems: renderWindow.end - renderWindow.start, overscanItems: (renderWindow.end - renderWindow.start) - (renderWindow.visibleEnd - renderWindow.visibleStart), scrollRenderMs, initialRenderMs, viewMode });
        pendingScrollAt.current = null;
        initialRenderAt.current = null;
    }, [windowState, viewMode]);

    useEffect(() => {
        const renderWindow = windowState;
        PhotoBrowserPerformance.browserCards({
            visible: renderWindow.visibleEnd - renderWindow.visibleStart,
            mounted: renderWindow.end - renderWindow.start,
            viewMode
        });
    }, [windowState, viewMode]);

    const items = [];
    const activeGroupLabel = groupLabelForPhoto(
        photos[renderWindow.visibleStart] || photos[0]
    );
    for (let index = renderWindow.start; index < renderWindow.end; index++) {
        const photo = photos[index];
        if (!photo) continue;
        const key = photo.id || photo.name || index;
        const decision = decisionForPhoto(photo);
        const cameraIdentity = cameraIdentityForPhoto(photo);
        if (viewMode === "list") {
            items.push(<ListPhotoRow key={key} photo={photo} onPhotoClick={handlePhotoClick} onContextMenu={onContextMenu} focused={photo.id === focusedPhotoId} viewMode={viewMode} visible={index >= renderWindow.visibleStart && index < renderWindow.visibleEnd} decision={decision} cameraIdentity={cameraIdentity} eventLabel={eventLabelForPhoto(photo)} onPhotoDecisionChange={onPhotoDecisionChange} style={{ position: "absolute", top: index * LIST_ROW_HEIGHT, left: 0, right: 0, height: LIST_ROW_HEIGHT }} />);
        } else {
            const row = Math.floor(index / renderWindow.columns);
            const column = index % renderWindow.columns;
            items.push(<IconsPhotoItem key={key} photo={photo} onPhotoClick={handlePhotoClick} onContextMenu={onContextMenu} focused={photo.id === focusedPhotoId} viewMode={viewMode} visible={index >= renderWindow.visibleStart && index < renderWindow.visibleEnd} decision={decision} cameraIdentity={cameraIdentity} onPhotoDecisionChange={onPhotoDecisionChange} style={{ position: "absolute", left: ICON_PADDING + column * (dimensions.width + ICON_GAP), top: ICON_PADDING + row * dimensions.rowHeight, width: dimensions.width, height: dimensions.height }} />);
        }
    }

    return <div className="photo-grid-shell">
        {activeGroupLabel && (
            <div className="photo-grid-group-header" role="status">
                {activeGroupLabel}
            </div>
        )}
        {viewMode === "list" && (
            <div className="photo-list-header" role="row">
                <span className="photo-list-header-thumb">Preview</span>
                {[
                    ["name", "Name", "photo-list-header-name"],
                    ["created", "Date Created", "photo-list-header-date"],
                    ["type", "Type", "photo-list-header-type"],
                    ["camera", "Camera", "photo-list-header-camera"],
                    ["event", "Keywords / Event", "photo-list-header-event"],
                    ["rating", "Rating", "photo-list-header-rating"]
                ].map(([field, label, className]) => (
                    <button
                        key={field}
                        type="button"
                        className={`${className}${sort.field === field ? " is-active" : ""}`}
                        onClick={() => onSortChange?.(field)}
                        aria-label={`Sort by ${label}`}
                        title={`Sort by ${label}`}
                    >
                        {label}{sort.field === field ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                ))}
                <span className="photo-list-header-action">Fav</span>
                <span className="photo-list-header-action">Reject</span>
            </div>
        )}
        <div ref={viewportRef} onScroll={scheduleWindow} className="photo-browser-viewport" data-photo-browser-viewport="true" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", background: "#2f2f2f" }}>
            {!photos.length ? <div style={{ minHeight: 100, display: "flex", justifyContent: "center", alignItems: "center", color: "#999" }}>No photos loaded.</div> : <div style={{ position: "relative", height: renderWindow.totalHeight, minHeight: "100%" }}>{items}</div>}
        </div>
    </div>;
}

export default React.memo(ThumbnailGrid);
