import React, {
    useEffect,
    useLayoutEffect,
    useRef,
    useState
} from "react";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import ThumbnailService, {
    getThumbnailCacheKey
} from "../services/ThumbnailService";

/**
 * Resolve an image once per file/profile identity and retain the previous
 * successfully loaded source until a replacement fires onload.
 */
function PhotoImage({
    photo,
    profile = "thumbnail",
    priority,
    role = "browser",
    alt = "",
    style,
    fallback = null,
    onImageLoad,
    onImageError
}) {

    const cacheKey = getThumbnailCacheKey(photo, profile);
    const [displayedSource, setDisplayedSource] = useState(
        () => ThumbnailService.getCachedThumbnail(photo, { profile })
    );
    const [pendingSource, setPendingSource] = useState(null);
    const [status, setStatus] = useState(
        () => displayedSource ? "loaded" : "loading"
    );
    const requestRef = useRef(0);
    const invariantRef = useRef(null);

    useEffect(() => {
        PhotoBrowserPerformance.photoImageMounted(role);
        return () => {
            if (invariantRef.current) {
                PhotoBrowserPerformance.verifyBrowserDocumentInvariant(
                    invariantRef.current,
                    role
                );
                invariantRef.current = null;
            }
            PhotoBrowserPerformance.photoImageUnmounted(role);
        };
    }, [role]);

    useLayoutEffect(() => {
        const sources = new Set(
            [displayedSource, pendingSource?.source].filter(Boolean)
        );
        for (const source of sources) {
            ThumbnailService.retainSource(source);
        }
        return () => {
            for (const source of sources) {
                ThumbnailService.releaseSource(source);
            }
        };
    }, [displayedSource, pendingSource]);

    useEffect(() => {
        const requestId = ++requestRef.current;
        const workspaceGeneration =
            ThumbnailService.getWorkspaceGeneration();
        let active = true;
        setPendingSource(previous =>
            previous?.cacheKey === cacheKey ? previous : null
        );

        if (invariantRef.current) {
            PhotoBrowserPerformance.verifyBrowserDocumentInvariant(
                invariantRef.current,
                role
            );
        }
        invariantRef.current =
            PhotoBrowserPerformance.beginBrowserDocumentInvariant();

        const cached = ThumbnailService.getCachedThumbnail(photo, {
            profile
        });
        const request = cached
            ? Promise.resolve(cached)
            : ThumbnailService.getSource(photo, {
                profile,
                priority,
                workspaceGeneration
            });

        if (!displayedSource) setStatus("loading");
        request.then(source => {
            if (!active || requestId !== requestRef.current) return;
            if (
                !ThumbnailService.isWorkspaceGenerationCurrent(
                    workspaceGeneration
                )
            ) return;
            if (!source) {
                if (!displayedSource) setStatus("error");
                PhotoBrowserPerformance.verifyBrowserDocumentInvariant(
                    invariantRef.current,
                    role
                );
                invariantRef.current = null;
                onImageError?.(null);
                return;
            }
            if (source === displayedSource) {
                setStatus("loaded");
                PhotoBrowserPerformance.verifyBrowserDocumentInvariant(
                    invariantRef.current,
                    role
                );
                invariantRef.current = null;
                return;
            }
            setPendingSource({ source, cacheKey });
        });

        return () => {
            active = false;
        };
    }, [cacheKey, priority, profile, role]);

    const completeInvariant = () => {
        PhotoBrowserPerformance.verifyBrowserDocumentInvariant(
            invariantRef.current,
            role
        );
        invariantRef.current = null;
    };

    const handlePendingLoad = event => {
        const source = pendingSource?.source;
        if (!source || pendingSource.cacheKey !== cacheKey) return;
        setDisplayedSource(source);
        setPendingSource(null);
        setStatus("loaded");
        completeInvariant();
        ThumbnailService.markLoadState(photo, "loaded", profile);
        onImageLoad?.(event);
    };

    const handlePendingError = event => {
        if (pendingSource?.cacheKey !== cacheKey) return;
        setPendingSource(null);
        if (!displayedSource) setStatus("error");
        completeInvariant();
        ThumbnailService.rejectSource(
            photo,
            profile,
            pendingSource.source,
            event?.error?.name || event?.type || "ImageElementError"
        );
        onImageError?.(event);
    };

    // Fire onImageLoad once when displayedSource is first set from cache (i.e. no pending
    // decode was in flight). When a pending image is decoded, handlePendingLoad fires
    // onImageLoad directly. The displayed <img> tag has no onLoad to prevent double-firing.
    const prevDisplayedSourceRef = React.useRef(null);
    useEffect(() => {
        if (displayedSource && displayedSource !== prevDisplayedSourceRef.current) {
            prevDisplayedSourceRef.current = displayedSource;
            // Only call onImageLoad here if the source came from cache (no pending swap).
            // If a pending swap just completed, handlePendingLoad already called it.
            if (!pendingSource) {
                onImageLoad?.();
            }
        }
    }, [displayedSource, pendingSource, onImageLoad]);

    return (
        <div
            className="photo-image-container"
            style={{
                position: "relative",
                width: "100%",
                height: "100%",
                minWidth: 0,
                minHeight: 0,
                overflow: "hidden"
            }}
        >
            {displayedSource && (
                <img
                    src={displayedSource}
                    alt={alt}
                    draggable={false}
                    style={style}
                />
            )}
            {pendingSource?.cacheKey === cacheKey && (
                <img
                    key={`${cacheKey}:pending`}
                    src={pendingSource.source}
                    alt=""
                    draggable={false}
                    onLoad={handlePendingLoad}
                    onError={handlePendingError}
                    style={{
                        ...style,
                        position: "absolute",
                        inset: 0,
                        opacity: 0,
                        pointerEvents: "none"
                    }}
                />
            )}
            {!displayedSource && status !== "loaded" && (
                <div
                    className="photo-image-placeholder-overlay"
                    style={{
                        position: "absolute",
                        inset: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center"
                    }}
                >
                    {typeof fallback === "function"
                        ? fallback(status)
                        : fallback}
                </div>
            )}
        </div>
    );

}

export default React.memo(PhotoImage);
