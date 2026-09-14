import {libraryScrollSize} from "./PopupScrollbars";
import React, {
    useCallback,
    useEffect,
    useLayoutEffect,
    useMemo,
    useRef,
    useState
} from "react";

import ThumbnailCard, {
    activateDecisionControl,
    RejectDecisionIcon,
    StarRatingIcon
} from "./ThumbnailCard";
import PhotoImage from "./PhotoImage";
import { focusPhotoReviewViewport, photoNavigationEntry } from "./PhotoReviewKeyboard";
import App from "../app/AppController";
import RefreshService from "../services/RefreshService";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import ImageSourceCapabilityService
    from "../services/ImageSourceCapabilityService";

const ICON_WIDTH = 104;
const ICON_HEIGHT = 156;
const ICON_GAP = 12;
const ICON_PADDING = 12;
const ICON_OVERSCAN_ROWS = 2;
const LIST_ROW_HEIGHT = 52;
const LIST_ROW_GAP = 6;
const LIST_OVERSCAN_ROWS = 3;
const LIST_NAME_COLUMN_DEFAULT = 260;
const LIST_METADATA_TRACK_WIDTH = 238;
const LIST_REVIEW_ZONE_WIDTH = 286;
const LIST_NAME_COLUMN_MIN = 220;
const LIST_NAME_COLUMN_MAX = 720;
const GROUP_HEADER_HEIGHT = 30;
const GROUP_SECTION_GAP = 8;
const LIST_IMAGE_STYLE = {
    width: "100%", height: "100%", objectFit: "cover",
    display: "block", pointerEvents: "none"
};

function formatListDate(value) {
    const date = value ? new Date(value) : null;
    if (!date || Number.isNaN(date.getTime())) return "—";
    const months = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ];
    return `${months[date.getMonth()]} ${String(date.getDate()).padStart(2, "0")}, ${date.getFullYear()}`;
}

function formatListSize(photo) {
    const bytes = Number(
        photo?.fileSize || photo?.size || photo?.file?.size || 0
    );
    if (!Number.isFinite(bytes) || bytes <= 0) return "—";
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function boundedListNameColumnWidth(value) {
    return Math.max(
        LIST_NAME_COLUMN_MIN,
        Math.min(LIST_NAME_COLUMN_MAX, Math.round(Number(value) || 0))
    );
}

export function buildPhotoBrowserGroups(
    photos = [],
    groupLabelForPhoto = () => "",
    groupMode = "none"
) {
    if (groupMode === "none") return [];
    const groups = [];
    const byLabel = new Map();
    for (const photo of photos) {
        const label = String(groupLabelForPhoto(photo) || "Unassigned");
        let group = byLabel.get(label);
        if (!group) {
            group = {
                key: `${groupMode}:${label}`,
                label,
                photos: []
            };
            byLabel.set(label, group);
            groups.push(group);
        }
        group.photos.push(photo);
    }
    return groups;
}

export function calculateGroupedPhotoBrowserWindow({
    groups = [],
    collapsedGroupKeys = new Set(),
    viewMode,
    reducedProfiles,
    viewportWidth,
    viewportHeight,
    scrollTop: requestedScrollTop,
    thumbnailSize = ICON_WIDTH
}) {
    const dimensions = iconDimensions(thumbnailSize);
    const isList = viewMode === "list";
    const columns = isList ? 1 : Math.max(1, Math.floor(
        (viewportWidth - ICON_PADDING * 2 + ICON_GAP) /
        (dimensions.width + ICON_GAP)
    ));
    const allEntries = [];
    let top = 0;

    groups.forEach(group => {
        const collapsed = collapsedGroupKeys.has(group.key);
        allEntries.push({
            type: "group",
            key: `group:${group.key}`,
            groupKey: group.key,
            label: group.label,
            count: group.photos.length,
            collapsed,
            top,
            height: GROUP_HEADER_HEIGHT
        });
        top += GROUP_HEADER_HEIGHT;
        if (collapsed) {
            top += GROUP_SECTION_GAP;
            return;
        }

        if (isList) {
            group.photos.forEach(photo => {
                allEntries.push({
                    type: "photo",
                    key: `photo:${photo.id || photo.name}`,
                    photo,
                    top,
                    height: LIST_ROW_HEIGHT,
                    left: 0
                });
                top += LIST_ROW_HEIGHT;
            });
        } else {
            const firstPhotoTop = top + ICON_PADDING;
            group.photos.forEach((photo, index) => {
                const row = Math.floor(index / columns);
                const column = index % columns;
                allEntries.push({
                    type: "photo",
                    key: `photo:${photo.id || photo.name}`,
                    photo,
                    top: firstPhotoTop + row * dimensions.rowHeight,
                    height: dimensions.height,
                    left: ICON_PADDING + column *
                        (dimensions.width + ICON_GAP)
                });
            });
            const rows = Math.ceil(group.photos.length / columns);
            top += ICON_PADDING * 2 + (rows
                ? rows * dimensions.height + Math.max(0, rows - 1) * ICON_GAP
                : 0);
        }
        top += GROUP_SECTION_GAP;
    });

    const totalHeight = Math.max(0, top - (groups.length ? GROUP_SECTION_GAP : 0));
    const scrollTop = Math.min(
        Math.max(0, Number(requestedScrollTop) || 0),
        Math.max(0, totalHeight - viewportHeight)
    );
    const overscan = reducedProfiles
        ? (isList ? LIST_OVERSCAN_ROWS * LIST_ROW_HEIGHT
            : ICON_OVERSCAN_ROWS * dimensions.rowHeight)
        : 0;
    const renderStart = Math.max(0, scrollTop - overscan);
    const renderEnd = scrollTop + viewportHeight + overscan;
    const visibleEnd = scrollTop + viewportHeight;
    const entries = allEntries.filter(entry =>
        entry.top + entry.height >= renderStart && entry.top <= renderEnd
    ).map(entry => Object.assign({}, entry, {
        visible: entry.top + entry.height >= scrollTop &&
            entry.top <= visibleEnd
    }));
    const renderedPhotos = entries.filter(entry => entry.type === "photo");
    const visiblePhotos = renderedPhotos
        .filter(entry => entry.visible)
        .map(entry => entry.photo);
    const overscanPhotos = renderedPhotos
        .filter(entry => !entry.visible)
        .map(entry => entry.photo);

    return Object.freeze({
        start: 0,
        end: renderedPhotos.length,
        columns,
        totalHeight,
        visibleStart: 0,
        visibleEnd: visiblePhotos.length,
        scrollTop,
        entries,
        allEntries,
        visiblePhotos,
        overscanPhotos,
        layoutKey: [
            columns,
            totalHeight,
            ...entries.map(entry => `${entry.key}@${entry.top}`)
        ].join("|")
    });
}

function listResizePointerX(event) {
    for (const value of [event?.clientX, event?.pageX, event?.screenX]) {
        const coordinate = Number(value);
        if (Number.isFinite(coordinate) && coordinate !== 0) return coordinate;
    }
    return 0;
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
            setState(previous => Object.assign({}, previous, { selected: selectedIds.has(photo.id) }));
        });
        const unsubscribeRefresh = RefreshService.subscribe(scope => {
            if (scope !== "thumbnails" && scope !== "all") return;
            if (!canUpdate()) return;
            setState(previous => {
                const thumbnailRevision = photo?.thumbnail || null;
                const loading = photo?.loading === true;
                return previous.thumbnailRevision === thumbnailRevision && previous.loading === loading
                    ? previous : Object.assign({}, previous, { thumbnailRevision, loading });
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

const IconsPhotoItem = React.memo(function IconsPhotoItem({ photo, onPhotoClick, onContextMenu, style, focused, viewMode, visible, decision, cameraIdentity, eventLabel, onPhotoDecisionChange }) {
    PhotoBrowserPerformance.recordRender("IconsPhotoItem");
    const state = usePhotoItemState(photo);
    return <div data-pid={photo.id} className={`photo-grid-item${focused ? " is-focused" : ""}`} style={style}><ThumbnailCard photo={photo} onClick={onPhotoClick} onContextMenu={onContextMenu} compact thumbnailRevision={state.thumbnailRevision} loading={state.loading} selected={state.selected} viewMode={viewMode} visible={visible} decision={decision} cameraIdentity={cameraIdentity} eventLabel={eventLabel} onDecisionChange={onPhotoDecisionChange} /></div>;
});

const ListPhotoRow = React.memo(function ListPhotoRow({ photo, onPhotoClick, onContextMenu, style, focused, viewMode, visible, decision, cameraIdentity, eventLabel, nameColumnWidth, metadataScrollLeft, onPhotoDecisionChange }) {
    PhotoBrowserPerformance.recordRender("ListPhotoRow");
    const state = usePhotoItemState(photo);
    const [hoverRating, setHoverRating] = useState(0);
    const rejected = decision?.culling?.toLowerCase() === "reject";
    const displayedRating = hoverRating || decision.rating || 0;
    const handleClick = useCallback(event => onPhotoClick(photo, event), [photo, onPhotoClick]);
    const handleContextMenu = useCallback(event => {
        event.preventDefault();
        event.stopPropagation();
        onContextMenu?.(event, photo);
    }, [photo, onContextMenu]);
    return <div data-pid={photo.id} onClick={handleClick} onContextMenu={handleContextMenu} role="option" aria-selected={state.selected} className={`photo-list-row${state.selected ? " is-selected" : ""}${focused ? " is-focused" : ""}${rejected ? " is-rejected" : ""}`} style={style}>
        <div
            className="photo-list-identity"
            style={nameColumnWidth == null ? undefined : {
                flex: `0 0 ${nameColumnWidth}px`,
                width: nameColumnWidth,
                minWidth: nameColumnWidth
            }}
        >
            <div className="photo-list-thumbnail">
                <PhotoImage photo={photo} profile="thumbnail" priority={visible ? 1 : 2} role="browser" onImageLoad={() => PhotoBrowserPerformance.thumbnailVisible(photo.id)} fallback={status => <div className="photo-list-thumbnail-fallback">{status === "loading" ? "…" : "▧"}</div>} style={LIST_IMAGE_STYLE} />
                {rejected && (
                    <span className="photo-list-rejected-dim" aria-hidden="true" />
                )}
            </div>
            <div className="photo-list-name">{photo.name}</div>
            <div className="photo-list-review-actions" aria-label={`Review ${photo.name}`}>
                <span
                    role="button"
                    tabIndex={-1}
                    className={`photo-list-favorite${decision.favorite ? " is-favorite" : ""}`}
                    onClick={event => {
                        event.stopPropagation();
                        onPhotoDecisionChange?.(photo, {
                            favorite: !decision.favorite
                        });
                    }}
                    onKeyDown={event => activateDecisionControl(event, keyEvent => {
                        keyEvent.stopPropagation();
                        onPhotoDecisionChange?.(photo, {
                            favorite: !decision.favorite
                        });
                    })}
                    aria-pressed={decision.favorite}
                    aria-label={`${decision.favorite ? "Remove" : "Add"} ${photo.name} ${decision.favorite ? "from" : "to"} favourites`}
                >
                    {decision.favorite ? "♥" : "♡"}
                </span>
                <span
                    role="button"
                    tabIndex={-1}
                    className={`photo-list-reject${rejected ? " is-rejected" : ""}`}
                    onClick={event => {
                        event.stopPropagation();
                        onPhotoDecisionChange?.(photo, {
                            culling: rejected ? "UNRATED" : "REJECT"
                        });
                    }}
                    onKeyDown={event => activateDecisionControl(event, keyEvent => {
                        keyEvent.stopPropagation();
                        onPhotoDecisionChange?.(photo, {
                            culling: rejected ? "UNRATED" : "REJECT"
                        });
                    })}
                    aria-label={rejected ? `Unreject ${photo.name}` : `Reject ${photo.name}`}
                >
                    <RejectDecisionIcon />
                </span>
            </div>
        </div>
        <div className="photo-list-metadata-window">
            <div
                className="photo-list-metadata-track"
                style={{ left: -metadataScrollLeft }}
            >
                <div className="photo-list-date">{formatListDate(photo.created || photo.modified)}</div>
                <div className="photo-list-size">{formatListSize(photo)}</div>
                <div className="photo-list-type">{photo.extension || "—"}</div>
            </div>
        </div>
        <div className="photo-list-review-zone">
            <div className="photo-list-rating-cell">
                <div
                    className="photo-list-rating"
                    role="group"
                    aria-label={`Rate ${photo.name}`}
                    onMouseLeave={() => setHoverRating(0)}
                >
                    {[1, 2, 3, 4, 5].map(rating => (
                        <span
                            key={rating}
                            role="button"
                            tabIndex={-1}
                            className={rating <= displayedRating ? "is-filled" : ""}
                            aria-pressed={rating === (decision.rating || 0)}
                            onMouseEnter={() => setHoverRating(rating)}
                            onClick={event => {
                                event.stopPropagation();
                                onPhotoDecisionChange?.(photo, {
                                    rating: decision.rating === rating ? 0 : rating
                                });
                            }}
                            onKeyDown={event => activateDecisionControl(event, keyEvent => {
                                keyEvent.stopPropagation();
                                onPhotoDecisionChange?.(photo, {
                                    rating: decision.rating === rating ? 0 : rating
                                });
                            })}
                            aria-label={`${rating} star${rating === 1 ? "" : "s"}`}
                        >
                            <StarRatingIcon filled={rating <= displayedRating} />
                        </span>
                    ))}
                </div>
            </div>
            <div className="photo-list-camera-cell">
                <span
                    className="photo-camera-tag photo-camera-tag-list"
                    style={{ borderColor: cameraIdentity?.color, color: cameraIdentity?.color }}
                    aria-label={`Camera ${cameraIdentity?.tag || "unassigned"}`}
                >
                    {cameraIdentity?.tag || "—"}
                </span>
            </div>
            <div className="photo-list-event" title={eventLabel || "Unassigned"}>{eventLabel || "Unassigned"}</div>
        </div>
    </div>;
});

function equalWindow(left, right) {
    return left.start === right.start &&
        left.end === right.end &&
        left.columns === right.columns &&
        left.totalHeight === right.totalHeight &&
        left.visibleStart === right.visibleStart &&
        left.visibleEnd === right.visibleEnd &&
        (left.layoutKey || "") === (right.layoutKey || "");
}

function iconDimensions(requestedWidth = ICON_WIDTH) {
    const width = Math.max(124, Math.min(172, Number(requestedWidth) || ICON_WIDTH));
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
    onPhotoPreview,
    viewMode = "icons",
    focusedPhotoId = null,
    onFocusPhoto,
    navigationRef,
    decisionForPhoto = () => ({ rating: 0, favorite: false }),
    cameraIdentityForPhoto = () => null,
    groupMode = "none",
    groupLabelForPhoto = () => "",
    eventLabelForPhoto = () => "",
    sort = { field: "name", direction: "asc" },
    thumbnailSize = ICON_WIDTH,
    onSortChange,
    onPhotoDecisionChange
}) {
    PhotoBrowserPerformance.recordRender("ThumbnailGrid");
    const viewportRef = useRef(null);
    const metadataScrollerRef = useRef(null);
    const listNameHeaderRef = useRef(null);
    const listNameResizeRef = useRef(null);
    const frameRef = useRef(null);
    const initialRenderAt = useRef(PhotoBrowserPerformance.timestamp());
    const pendingScrollAt = useRef(null);
    const scrollMeasurementRequested = useRef(false);
    const layoutRef = useRef({ width: null, height: null });
    const windowRef = useRef({ start: 0, end: 0, columns: 1, totalHeight: 0, visibleStart: 0, visibleEnd: 0, entries: null, layoutKey: "" });
    const [windowState, setWindowState] = useState(windowRef.current);
    const [listNameColumnWidth, setListNameColumnWidth] = useState(null);
    const [metadataScrollLeft, setMetadataScrollLeft] = useState(0);
    const [collapsedGroupKeys, setCollapsedGroupKeys] = useState(() => new Set());
    const reducedProfiles =
        ImageSourceCapabilityService.supportsReducedProfiles(photos);
    const dimensions = iconDimensions(thumbnailSize);
    const effectiveListNameColumnWidth = listNameColumnWidth ??
        LIST_NAME_COLUMN_DEFAULT;
    const groupingEnabled = groupMode !== "none";
    const photoGroups = useMemo(() => buildPhotoBrowserGroups(
        photos,
        groupLabelForPhoto,
        groupMode
    ), [groupLabelForPhoto, groupMode, photos]);
    // UXP can publish photos before the viewport has a measurable size.
    // Bootstrap a bounded window for both views so neither Icons nor List can
    // render a transient empty browser before the layout pass replaces it.
    const renderWindow = photos.length > 0 &&
        windowState.end === windowState.start
        ? (groupingEnabled
            ? calculateGroupedPhotoBrowserWindow({
                groups: photoGroups,
                collapsedGroupKeys,
                viewMode,
                reducedProfiles,
                viewportWidth: 800,
                viewportHeight: 240,
                scrollTop: 0,
                thumbnailSize
            })
            : bootstrapWindow(photos, viewMode, reducedProfiles, thumbnailSize))
        : windowState;

    const toggleGroup = useCallback(groupKey => {
        setCollapsedGroupKeys(previous => {
            const next = new Set(previous);
            if (next.has(groupKey)) next.delete(groupKey);
            else next.add(groupKey);
            return next;
        });
    }, []);

    useEffect(() => {
        setCollapsedGroupKeys(new Set());
    }, [groupMode]);

    const handlePhotoClick = useCallback((photo, event) => {
        focusPhotoReviewViewport(viewportRef.current);
        if (typeof onPhotoInteraction === "function") {
            onPhotoInteraction(photo, event);
            return;
        }
        onPhotoClick?.(photo);
        onFocusPhoto?.(photo?.id);
    }, [onFocusPhoto, onPhotoClick, onPhotoInteraction]);

    const beginListNameResize = useCallback(event => {
        event.preventDefault();
        event.stopPropagation();
        const measuredWidth = listNameColumnWidth ??
            listNameHeaderRef.current?.getBoundingClientRect?.().width ??
            LIST_NAME_COLUMN_MIN;
        listNameResizeRef.current = {
            startX: listResizePointerX(event),
            startWidth: boundedListNameColumnWidth(measuredWidth)
        };
    }, [listNameColumnWidth]);

    const continueListNameResize = useCallback(event => {
        const resize = listNameResizeRef.current;
        if (!resize) return;
        const pointerX = listResizePointerX(event);
        if (!pointerX || !resize.startX) return;
        event.preventDefault();
        setListNameColumnWidth(boundedListNameColumnWidth(
            resize.startWidth + (pointerX - resize.startX)
        ));
    }, []);

    const endListNameResize = useCallback(() => {
        listNameResizeRef.current = null;
    }, []);

    const resizeListNameWithKeyboard = useCallback(event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        event.stopPropagation();
        const measuredWidth = listNameColumnWidth ??
            listNameHeaderRef.current?.getBoundingClientRect?.().width ??
            LIST_NAME_COLUMN_MIN;
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        setListNameColumnWidth(boundedListNameColumnWidth(
            measuredWidth + direction * 12
        ));
    }, [listNameColumnWidth]);

    useEffect(() => {
        const handleMouseMove = event => {
            const resize = listNameResizeRef.current;
            if (!resize) return;
            const pointerX = listResizePointerX(event);
            if (!pointerX || !resize.startX) return;
            setListNameColumnWidth(boundedListNameColumnWidth(
                resize.startWidth + (pointerX - resize.startX)
            ));
        };
        const handleMouseUp = () => {
            listNameResizeRef.current = null;
        };
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, []);

    const calculateWindow = useCallback(() => {
        const viewport = viewportRef.current;
        if (!viewport) return false;
        const viewportWidth = libraryScrollSize(viewport, "clientWidth");
        const viewportHeight = libraryScrollSize(viewport, "clientHeight");
        if (!viewportWidth || !viewportHeight) return false;
        const calculated = groupingEnabled
            ? calculateGroupedPhotoBrowserWindow({
                groups: photoGroups,
                collapsedGroupKeys,
                viewMode,
                reducedProfiles,
                viewportWidth,
                viewportHeight,
                scrollTop: viewport.scrollTop,
                thumbnailSize
            })
            : calculatePhotoBrowserWindow({
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
        const next = groupingEnabled
            ? calculated
            : { start, end, columns, totalHeight, visibleStart, visibleEnd };
        const visible = groupingEnabled
            ? calculated.visiblePhotos
            : photos.slice(visibleStart, visibleEnd);
        const overscan = groupingEnabled
            ? calculated.overscanPhotos
            : photos.slice(start, visibleStart).concat(photos.slice(visibleEnd, end));
        App.setVisiblePhotoThumbnails({ visible, overscan });
        const changed = !equalWindow(windowRef.current, next);
        if (changed) {
            windowRef.current = next;
            setWindowState(next);
        }
        return changed;
    }, [collapsedGroupKeys, groupingEnabled, photoGroups, photos, reducedProfiles, thumbnailSize, viewMode]);

    useLayoutEffect(() => {
        if (!navigationRef) return undefined;
        navigationRef.current = (focusedId, key) => {
            const viewport = viewportRef.current;
            if (!viewport) return null;
            const columns = viewMode === "list" ? 1 : Math.max(1, Math.floor(
                (libraryScrollSize(viewport, "clientWidth") - ICON_PADDING * 2 + ICON_GAP) / (dimensions.width + ICON_GAP)
            ));
            const entries = groupingEnabled
                ? calculateGroupedPhotoBrowserWindow({ groups: photoGroups, collapsedGroupKeys, viewMode,
                    reducedProfiles, viewportWidth: libraryScrollSize(viewport, "clientWidth"), viewportHeight: libraryScrollSize(viewport, "clientHeight"),
                    scrollTop: viewport.scrollTop, thumbnailSize }).allEntries.filter(entry => entry.type === "photo")
                : photos.map((photo, index) => ({ photo,
                    top: viewMode === "list" ? index * LIST_ROW_HEIGHT : ICON_PADDING + Math.floor(index / columns) * dimensions.rowHeight,
                    left: (index % columns) * (dimensions.width + ICON_GAP),
                    height: viewMode === "list" ? LIST_ROW_HEIGHT : dimensions.height
                }));
            const next = photoNavigationEntry(entries, focusedId, key, viewMode);
            if (!next) return null;
            if (next.top < viewport.scrollTop) viewport.scrollTop = next.top;
            else if (next.top + next.height > viewport.scrollTop + libraryScrollSize(viewport, "clientHeight")) {
                viewport.scrollTop = next.top + next.height - libraryScrollSize(viewport, "clientHeight");
            }
            calculateWindow();
            return next.photo;
        };
        return () => { navigationRef.current = null; };
    }, [navigationRef, calculateWindow, collapsedGroupKeys, groupingEnabled, photoGroups, photos,
        reducedProfiles, thumbnailSize, viewMode, dimensions.width, dimensions.height, dimensions.rowHeight]);

    const scheduleWindow = useCallback(event => {
        // Photoshop UXP can defer or drop requestAnimationFrame callbacks
        // while a panel is scrolling. Measure interaction-driven changes
        // synchronously so the next virtual window and its thumbnails are
        // available before the host paints the newly exposed area.
        if (event) {
            pendingScrollAt.current = PhotoBrowserPerformance.timestamp();
            scrollMeasurementRequested.current = false;
            const changed = calculateWindow();
            if (!changed) pendingScrollAt.current = null;
            return;
        }
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
            libraryScrollSize(viewportRef.current, "clientWidth"));
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
        const retryTimers = [0, 80, 240].map(delay => setTimeout(
            () => calculateWindow(),
            delay
        ));
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
            retryTimers.forEach(clearTimeout);
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
    const pushPhotoItem = (photo, key, position, visible) => {
        const decision = decisionForPhoto(photo);
        const cameraIdentity = cameraIdentityForPhoto(photo);
        if (viewMode === "list") {
            items.push(<ListPhotoRow key={key} photo={photo} onPhotoClick={handlePhotoClick} onContextMenu={onContextMenu} focused={photo.id === focusedPhotoId} viewMode={viewMode} visible={visible} decision={decision} cameraIdentity={cameraIdentity} eventLabel={eventLabelForPhoto(photo)} nameColumnWidth={effectiveListNameColumnWidth} metadataScrollLeft={metadataScrollLeft} onPhotoDecisionChange={onPhotoDecisionChange} style={{ position: "absolute", top: position.top + LIST_ROW_GAP / 2, left: 0, right: 0, height: LIST_ROW_HEIGHT - LIST_ROW_GAP }} />);
        } else {
            items.push(<IconsPhotoItem key={key} photo={photo} onPhotoClick={handlePhotoClick} onContextMenu={onContextMenu} focused={photo.id === focusedPhotoId} viewMode={viewMode} visible={visible} decision={decision} cameraIdentity={cameraIdentity} eventLabel={eventLabelForPhoto(photo)} onPhotoDecisionChange={onPhotoDecisionChange} style={{ position: "absolute", left: position.left, top: position.top, width: dimensions.width, height: dimensions.height }} />);
        }
    };

    if (groupingEnabled) {
        (renderWindow.entries || []).forEach(entry => {
            if (entry.type === "group") {
                items.push(
                    <div
                        key={entry.key}
                        className={`photo-browser-group-section-header${entry.collapsed ? " is-collapsed" : ""}`}
                        style={{ top: entry.top, height: entry.height }}
                        onClick={() => toggleGroup(entry.groupKey)}
                        onKeyDown={event => activateDecisionControl(
                            event,
                            () => toggleGroup(entry.groupKey)
                        )}
                        role="button"
                        tabIndex={0}
                        aria-expanded={!entry.collapsed}
                        aria-label={`${entry.collapsed ? "Expand" : "Collapse"} ${entry.label} group`}
                    >
                        <span className="photo-browser-group-section-title">
                            <span className="photo-browser-group-chevron" aria-hidden="true">
                                {entry.collapsed ? "▸" : "▾"}
                            </span>
                            <strong>{entry.label}</strong>
                        </span>
                        <span className="photo-browser-group-section-count">
                            {entry.count} photo{entry.count === 1 ? "" : "s"}
                        </span>
                    </div>
                );
                return;
            }
            pushPhotoItem(
                entry.photo,
                entry.key,
                entry,
                entry.visible
            );
        });
    } else {
        for (let index = renderWindow.start; index < renderWindow.end; index++) {
            const photo = photos[index];
            if (!photo) continue;
            const key = photo.id || photo.name || index;
            if (viewMode === "list") {
                pushPhotoItem(photo, key, {
                    top: index * LIST_ROW_HEIGHT,
                    left: 0
                }, index >= renderWindow.visibleStart && index < renderWindow.visibleEnd);
            } else {
                const row = Math.floor(index / renderWindow.columns);
                const column = index % renderWindow.columns;
                pushPhotoItem(photo, key, {
                    left: ICON_PADDING + column * (dimensions.width + ICON_GAP),
                    top: ICON_PADDING + row * dimensions.rowHeight
                }, index >= renderWindow.visibleStart && index < renderWindow.visibleEnd);
            }
        }
    }

    return <div className="photo-grid-shell">
        {viewMode === "list" && (
            <div
                className="photo-list-header"
                role="row"
                onMouseMove={continueListNameResize}
                onMouseUp={endListNameResize}
            >
                <button
                    type="button"
                    className={`photo-list-header-name${sort.field === "name" ? " is-active" : ""}`}
                    ref={listNameHeaderRef}
                    style={{
                        flex: `0 0 ${effectiveListNameColumnWidth}px`,
                        width: effectiveListNameColumnWidth,
                        minWidth: effectiveListNameColumnWidth
                    }}
                    onClick={() => onSortChange?.("name")}
                    aria-label="Sort by Name"
                    title="Sort by Name"
                >
                    <span className="photo-list-header-label">
                        Name{sort.field === "name" ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
                    </span>
                    <span
                        className="photo-list-name-resizer"
                        role="separator"
                        tabIndex={0}
                        aria-label="Resize Name column"
                        aria-orientation="vertical"
                        aria-valuemin={LIST_NAME_COLUMN_MIN}
                        aria-valuemax={LIST_NAME_COLUMN_MAX}
                        aria-valuenow={Math.round(effectiveListNameColumnWidth)}
                        onMouseDown={beginListNameResize}
                        onKeyDown={resizeListNameWithKeyboard}
                        onClick={event => {
                            event.preventDefault();
                            event.stopPropagation();
                        }}
                    />
                </button>
                <div className="photo-list-header-metadata-window">
                    <div
                        className="photo-list-header-metadata-track"
                        style={{ left: -metadataScrollLeft }}
                    >
                        {[
                        ["created", "Date Created", "photo-list-header-date"],
                        ["size", "Size", "photo-list-header-size"],
                            ["type", "Type", "photo-list-header-type"]
                        ].map(([field, label, className]) => (
                            <button
                                key={field}
                                type="button"
                                className={`${className}${sort.field === field ? " is-active" : ""}`}
                                onClick={() => onSortChange?.(field)}
                                aria-label={`Sort by ${label}`}
                                title={`Sort by ${label}`}
                            >
                                <span className="photo-list-header-label">
                                    {label}{sort.field === field ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="photo-list-header-review-zone">
                    {[
                        ["rating", "Rating", "photo-list-header-rating"],
                        ["camera", "Camera", "photo-list-header-camera"],
                        ["event", "Event", "photo-list-header-event"]
                    ].map(([field, label, className]) => (
                        <button
                            key={field}
                            type="button"
                            className={`${className}${sort.field === field ? " is-active" : ""}`}
                            onClick={() => onSortChange?.(field)}
                            aria-label={`Sort by ${label}`}
                            title={`Sort by ${label}`}
                        >
                            <span className="photo-list-header-label">
                                {label}{sort.field === field ? (sort.direction === "asc" ? " ↑" : " ↓") : ""}
                            </span>
                        </button>
                    ))}
                </div>
            </div>
        )}
        <div ref={viewportRef} tabIndex={1} aria-label="Photo review" onScroll={scheduleWindow}
            onContextMenu={event => {
                if (!event.target.closest?.("[data-pid]")) onContextMenu?.(event, null);
            }}
            onDoubleClick={event => {
                if (event.target.closest?.('button, [role="button"]')) return;
                const id = event.target.closest?.('[data-pid]')?.getAttribute('data-pid');
                const target = photos.find(photo => String(photo.id) === id);
                if (target) { event.preventDefault(); onPhotoPreview?.(target); }
            }}
            className="photo-browser-viewport" data-photo-browser-viewport="true" style={{ flex: "1 1 auto", minHeight: 0, overflowY: "auto", overflowX: "hidden", background: "#20242a" }}>
            {!photos.length ? <div style={{ minHeight: 100, display: "flex", justifyContent: "center", alignItems: "center", color: "#999" }}>No photos loaded.</div> : <div style={{ position: "relative", height: renderWindow.totalHeight, minHeight: "100%", minWidth: "100%" }}>{items}</div>}
        </div>
        {viewMode === "list" && (
            <div className="photo-list-metadata-scroll-row" aria-label="Scroll Date, Size and Type columns">
                <span
                    className="photo-list-metadata-scroll-left-spacer"
                    style={{ flexBasis: effectiveListNameColumnWidth }}
                    aria-hidden="true"
                />
                <div
                    ref={metadataScrollerRef}
                    className="photo-list-metadata-scroller"
                    onScroll={event => setMetadataScrollLeft(
                        Number(event.currentTarget?.scrollLeft) || 0
                    )}
                >
                    <span
                        className="photo-list-metadata-scroll-content"
                        style={{ width: LIST_METADATA_TRACK_WIDTH }}
                        aria-hidden="true"
                    />
                </div>
                <span
                    className="photo-list-metadata-scroll-right-spacer"
                    style={{ flexBasis: LIST_REVIEW_ZONE_WIDTH }}
                    aria-hidden="true"
                />
            </div>
        )}
    </div>;
}

export default React.memo(ThumbnailGrid);
