import React, {
    useCallback,
    useEffect,
    useRef,
    useState
} from "react";

import ThumbnailCard from "./ThumbnailCard";
import PhotoImage from "./PhotoImage";
import App from "../app/AppController";
import RefreshService from "../services/RefreshService";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

const ICON_WIDTH = 104;
const ICON_HEIGHT = 122;
const LIST_ROW_HEIGHT = 38;
const LIST_IMAGE_STYLE = {
    width: "100%",
    height: "100%",
    objectFit: "cover",
    display: "block",
    pointerEvents: "none"
};

function usePhotoItemState(photo) {

    const [state, setState] = useState(() => ({
        selected: App.selection.isSelected(photo?.id),
        thumbnailRevision: photo?.thumbnail || null,
        loading: photo?.loading === true
    }));

    useEffect(() => {

        setState({
            selected: App.selection.isSelected(photo?.id),
            thumbnailRevision: photo?.thumbnail || null,
            loading: photo?.loading === true
        });

        const unsubscribeSelection =
            App.selection.subscribe((selectedIds, changedIds) => {
                if (!changedIds.has(photo?.id)) return;

                setState(previous => ({
                    ...previous,
                    selected: selectedIds.has(photo.id)
                }));
            });

        const unsubscribeRefresh =
            RefreshService.subscribe(scope => {
                if (
                    scope !== "thumbnails" &&
                    scope !== "all"
                ) return;

                setState(previous => {
                    const thumbnailRevision =
                        photo?.thumbnail || null;
                    const loading = photo?.loading === true;

                    if (
                        previous.thumbnailRevision ===
                            thumbnailRevision &&
                        previous.loading === loading
                    ) {
                        return previous;
                    }

                    return {
                        ...previous,
                        thumbnailRevision,
                        loading
                    };
                });
            });

        return () => {
            unsubscribeSelection();
            unsubscribeRefresh();
        };

    }, [photo]);

    return state;

}

const IconsPhotoItem = React.memo(function IconsPhotoItem({
    photo,
    onPhotoClick
}) {

    PhotoBrowserPerformance.recordRender("IconsPhotoItem");
    const state = usePhotoItemState(photo);

    return (
        <div
            style={{
                flex: `0 0 ${ICON_WIDTH}px`,
                width: ICON_WIDTH,
                height: ICON_HEIGHT
            }}
        >
            <ThumbnailCard
                photo={photo}
                onClick={onPhotoClick}
                compact
                thumbnailRevision={state.thumbnailRevision}
                loading={state.loading}
                selected={state.selected}
            />
        </div>
    );

});

const ListPhotoRow = React.memo(function ListPhotoRow({
    photo,
    onPhotoClick
}) {

    PhotoBrowserPerformance.recordRender("ListPhotoRow");
    const state = usePhotoItemState(photo);
    const handleClick = useCallback(
        event => onPhotoClick(photo, event),
        [photo, onPhotoClick]
    );

    return (
        <div
            onClick={handleClick}
            style={{
                height: LIST_ROW_HEIGHT,
                display: "flex",
                gap: 8,
                alignItems: "center",
                padding: "0 8px",
                boxSizing: "border-box",
                cursor: "pointer",
                borderBottom: "1px solid #414141",
                background: state.selected
                    ? "#334868"
                    : "#292929",
                color: "#fff"
            }}
        >
            <div style={{ flex: "0 0 30px", width: 30, height: 30, background: "#1f1f1f", overflow: "hidden" }}>
                <PhotoImage
                    photo={photo}
                    sourceRevision={state.thumbnailRevision}
                    loadingRevision={state.loading}
                    allowFileFallback={false}
                    onImageLoad={() =>
                        PhotoBrowserPerformance.thumbnailVisible(
                            photo.id
                        )
                    }
                    fallback={<div style={{ color: "#777", fontSize: 9, textAlign: "center", lineHeight: "30px" }}>—</div>}
                    style={LIST_IMAGE_STYLE}
                />
            </div>
            <div style={{ flex: "1 1 auto", minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: 12 }}>{photo.name}</div>
            <div style={{ flex: "0 0 42px", color: "#aaa", fontSize: 11, textTransform: "uppercase" }}>{photo.extension || "—"}</div>
            <div style={{ flex: "0 0 16px", width: 16, height: 16, borderRadius: 8, background: state.selected ? "#3B82F6" : "#555", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10 }}>{state.selected ? "✓" : ""}</div>
        </div>
    );

});

const IconsPhotoView = React.memo(function IconsPhotoView({
    photos,
    onPhotoClick
}) {

    PhotoBrowserPerformance.recordRender("IconsPhotoView");

    return (
        <div
            style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                alignItems: "flex-start",
                padding: 6,
                boxSizing: "border-box"
            }}
        >
            {photos.map((photo, index) => (
                <IconsPhotoItem
                    key={photo.id || photo.name || index}
                    photo={photo}
                    onPhotoClick={onPhotoClick}
                />
            ))}
        </div>
    );

});

const ListPhotoView = React.memo(function ListPhotoView({
    photos,
    onPhotoClick
}) {

    PhotoBrowserPerformance.recordRender("ListPhotoView");

    return (
        <div>
            {photos.map((photo, index) => (
                <ListPhotoRow
                    key={photo.id || photo.name || index}
                    photo={photo}
                    onPhotoClick={onPhotoClick}
                />
            ))}
        </div>
    );

});

function ThumbnailGrid({
    photos = [],
    onPhotoClick,
    viewMode = "icons"
}) {

    PhotoBrowserPerformance.recordRender("ThumbnailGrid");
    const viewportRef = useRef(null);
    const lastVisibleUpdate = useRef(0);
    const [mountedViews, setMountedViews] = useState(
        () => new Set([viewMode])
    );

    useEffect(() => {
        setMountedViews(previous => {
            if (previous.has(viewMode)) return previous;
            const next = new Set(previous);
            next.add(viewMode);
            return next;
        });
    }, [viewMode]);

    const handlePhotoClick = useCallback((photo, event) => {
        App.selection.handleClick(photo, event);
        onPhotoClick?.(photo);
    }, [onPhotoClick]);

    const updateVisiblePhotos = useCallback(event => {

        const viewport = event?.currentTarget ||
            viewportRef.current;

        if (!viewport || !photos.length) return;

        const timestamp = Date.now();

        if (timestamp - lastVisibleUpdate.current < 75) {
            return;
        }

        lastVisibleUpdate.current = timestamp;

        let start;
        let count;

        if (viewMode === "list") {
            start = Math.floor(
                viewport.scrollTop / LIST_ROW_HEIGHT
            );
            count = Math.ceil(
                viewport.clientHeight / LIST_ROW_HEIGHT
            ) + 4;
        } else {
            const columns = Math.max(
                1,
                Math.floor(viewport.clientWidth / (ICON_WIDTH + 8))
            );
            const firstRow = Math.floor(
                viewport.scrollTop / (ICON_HEIGHT + 8)
            );
            const rows = Math.ceil(
                viewport.clientHeight / (ICON_HEIGHT + 8)
            ) + 2;
            start = firstRow * columns;
            count = rows * columns;
        }

        App.setVisiblePhotoThumbnails(
            photos.slice(start, start + count)
        );

    }, [photos, viewMode]);

    useEffect(() => {
        updateVisiblePhotos();
    }, [updateVisiblePhotos]);

    const iconsMounted =
        mountedViews.has("icons") || viewMode === "icons";
    const listMounted =
        mountedViews.has("list") || viewMode === "list";

    return (
        <div
            ref={viewportRef}
            onScroll={updateVisiblePhotos}
            className="photo-browser-viewport"
            data-photo-browser-viewport="true"
            style={{
                flex: "1 1 auto",
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden",
                background: "#2f2f2f"
            }}
        >
            {!photos.length ? (
                <div style={{ minHeight: 100, display: "flex", justifyContent: "center", alignItems: "center", color: "#999" }}>No photos loaded.</div>
            ) : (
                <>
                    {iconsMounted && (
                        <div style={{ display: viewMode === "icons" ? "block" : "none" }}>
                            <IconsPhotoView
                                photos={photos}
                                onPhotoClick={handlePhotoClick}
                            />
                        </div>
                    )}
                    {listMounted && (
                        <div style={{ display: viewMode === "list" ? "block" : "none" }}>
                            <ListPhotoView
                                photos={photos}
                                onPhotoClick={handlePhotoClick}
                            />
                        </div>
                    )}
                </>
            )}
        </div>
    );

}

export default React.memo(ThumbnailGrid);
