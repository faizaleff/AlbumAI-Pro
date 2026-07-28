import React, {
    useCallback,
    useLayoutEffect,
    useRef,
    useState
} from "react";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";
import BrowserDecodeScheduler from "../services/BrowserDecodeScheduler";
import normalizeImageSource from "../services/normalizeImageSource";
import { ALBUMAI_BUILD_ID } from "../config/buildIdentity";
import {
    BROWSER_THUMBNAIL_MODE,
    isBrowserOriginalFallbackEnabled
} from "../config/browserImagePolicy";

console.log("PHOTOIMAGE_BUILD_ID", ALBUMAI_BUILD_ID);
console.log("BROWSER_THUMBNAIL_MODE", BROWSER_THUMBNAIL_MODE);

const detailedBrowserPhotoIds = new Set();
const MAX_DETAILED_BROWSER_PHOTOS = 5;
let nextRequestId = 1;
let browserSuccessesAggregated = 0;

function getFileEntryImageUrl(fileEntry) {

    const entryUrl = fileEntry?.url;
    const value = typeof entryUrl === "string"
        ? entryUrl
        : typeof entryUrl?.href === "string"
            ? entryUrl.href
            : typeof entryUrl?.toString === "function"
                ? entryUrl.toString()
                : "";
    const source = typeof value === "string"
        ? value.trim()
        : "";
    if (!source || source === "[object Object]") {
        throw new TypeError(
            "UXP FileEntry did not provide an image URL"
        );
    }
    return source;

}

function invalidateImagePaint(node, requestId) {

    if (!node) return;
    node.setAttribute("data-image-ready", requestId || "ready");
    node.style.opacity = "1";
    node.style.transform = "translateZ(0)";
    // UXP can defer panel image paint until a host resize. Reading layout and
    // clearing the temporary transform schedules paint without moving panels.
    node.getBoundingClientRect?.();
    requestAnimationFrame(() => {
        if (!node?.isConnected) return;
        node.style.transform = "";
        node.style.opacity = "1";
    });

}

function clearImageNodeSource(node) {

    if (!node) return;
    try {
        node.src = "";
        node.removeAttribute?.("src");
        node.removeAttribute?.("data-image-request");
        node.removeAttribute?.("data-image-ready");
    } catch (_) {
        // The node may already be detached by UXP.
    }

}

function sourceScheme(source) {

    if (typeof source !== "string") return null;
    const match = /^([a-z][a-z0-9+.-]*):/i.exec(source);
    return match ? match[1].toLowerCase() : "relative";

}

function shouldTraceDetails(role, photoId) {

    if (role !== "browser") return true;
    if (detailedBrowserPhotoIds.has(photoId)) return true;
    if (
        photoId &&
        detailedBrowserPhotoIds.size < MAX_DETAILED_BROWSER_PHOTOS
    ) {
        detailedBrowserPhotoIds.add(photoId);
        return true;
    }
    return false;

}

function sourceDetails({
    photoId,
    requestId,
    mounted,
    imgRefReady,
    source,
    sourceOrigin,
    role,
    viewMode,
    error = null
}) {

    return {
        buildId: ALBUMAI_BUILD_ID,
        photoId,
        requestId,
        mounted,
        imgRefReady,
        sourceType: source == null ? String(source) : typeof source,
        sourceScheme: sourceScheme(source),
        sourceLength: typeof source === "string" ? source.length : 0,
        sourceOrigin,
        activeDecodeCount: BrowserDecodeScheduler.activeCount,
        role,
        viewMode: viewMode || null,
        errorType: error?.name || error?.type || null,
        errorMessage: error?.message || null
    };

}

/** Render a persistent img node using an explicit FileEntry/source contract. */
function PhotoImage({
    photoId,
    fileEntry = null,
    cachedSource = null,
    role = "browser",
    viewMode = null,
    retryGeneration = null,
    cacheKey = null,
    visible = false,
    alt = "",
    style,
    fallback = null,
    onImageLoad,
    onImageError
}) {

    PhotoBrowserPerformance.recordRender("PhotoImage");

    const [failedCachedSource, setFailedCachedSource] = useState(null);
    const [failedFileEntry, setFailedFileEntry] = useState(null);
    const [imageStatus, setImageStatus] = useState("loading");
    const traceDetails = shouldTraceDetails(role, photoId);

    const cachedCandidate =
        cachedSource !== failedCachedSource ? cachedSource : null;
    const fileFailed = failedFileEntry === fileEntry;
    const browserOriginalFallbackEnabled =
        role === "browser" &&
        visible === true &&
        isBrowserOriginalFallbackEnabled();
    const browserSourceOutsideVisibleWindow =
        role === "browser" && !browserOriginalFallbackEnabled;
    const fileCandidate = fileFailed ? null : fileEntry;
    const normalized = normalizeImageSource({
        cachedSource: cachedCandidate,
        fileEntry: browserSourceOutsideVisibleWindow
            ? null
            : fileCandidate
    });
    const normalizedSource = normalized.source;
    const sourceOrigin = normalized.sourceOrigin;
    const isBrowserFileFallback =
        role === "browser" && (
            sourceOrigin === "FILE_ENTRY_URL" ||
            sourceOrigin === "FILE_ENTRY"
        );
    const sourceIdentity = [
        photoId || "none",
        sourceOrigin,
        sourceOrigin === "CACHE"
            ? normalizedSource
            : fileEntry?.name || "none",
        retryGeneration ?? "none"
    ].join(":");

    const imageRef = useRef(null);
    const mountedRef = useRef(false);
    const mountedAtRef = useRef(PhotoBrowserPerformance.timestamp());
    const activeRequestRef = useRef(null);
    const onImageLoadRef = useRef(onImageLoad);
    const onImageErrorRef = useRef(onImageError);
    const diagnosticRef = useRef({
        photoId,
        role,
        viewMode,
        traceDetails
    });
    onImageLoadRef.current = onImageLoad;
    onImageErrorRef.current = onImageError;
    diagnosticRef.current = { photoId, role, viewMode, traceDetails };

    const handleImgRef = useCallback(node => {

        imageRef.current = node;
        const current = diagnosticRef.current;
        if (current.traceDetails) {
            PhotoBrowserPerformance.trace(
                node ? "IMG_NODE_ATTACHED" : "IMG_NODE_DETACHED",
                {
                    buildId: ALBUMAI_BUILD_ID,
                    photoId: current.photoId,
                    requestId: null,
                    mounted: mountedRef.current,
                    imgRefReady: !!node,
                    sourceType: null,
                    sourceScheme: null,
                    sourceLength: 0,
                    sourceOrigin: "NONE",
                    activeDecodeCount:
                        BrowserDecodeScheduler.activeCount,
                    role: current.role,
                    viewMode: current.viewMode || null
                }
            );
        }

    }, []);

    useLayoutEffect(() => {

        mountedRef.current = true;
        mountedAtRef.current = PhotoBrowserPerformance.timestamp();
        PhotoBrowserPerformance.photoImageMounted(role);
        if (role === "browser") {
            PhotoBrowserPerformance.trace("BROWSER_IMAGE_COUNT", {
                buildId: ALBUMAI_BUILD_ID,
                count:
                    PhotoBrowserPerformance.mountedBrowserImages
            });
        }

        return () => {
            mountedRef.current = false;
            PhotoBrowserPerformance.photoImageUnmounted(role);
            if (role === "browser") {
                PhotoBrowserPerformance.trace("BROWSER_IMAGE_COUNT", {
                    buildId: ALBUMAI_BUILD_ID,
                    count:
                        PhotoBrowserPerformance.mountedBrowserImages
                });
            }
        };

    }, [role]);

    useLayoutEffect(() => {

        const imgNode = imageRef.current;
        const inputDetails = {
            buildId: ALBUMAI_BUILD_ID,
            photoId,
            role,
            hasImgNode: !!imgNode,
            hasFileEntry: !!fileEntry,
            fileEntryConstructor:
                fileEntry?.constructor?.name || null,
            fileEntryIsFile: fileEntry?.isFile === true,
            cachedSourceType:
                cachedSource == null
                    ? String(cachedSource)
                    : typeof cachedSource,
            mountedRefValue: mountedRef.current,
            retryGeneration
        };
        if (traceDetails) {
            PhotoBrowserPerformance.trace(
                "PHOTOIMAGE_SOURCE_INPUT",
                inputDetails
            );
        }

        const blocked = reason => {
            if (!traceDetails && reason === "MISSING_IMG_NODE") return;
            PhotoBrowserPerformance.trace(
                "PHOTOIMAGE_SOURCE_BLOCKED",
                {
                    ...inputDetails,
                    reason
                }
            );
        };

        if (!imgNode) {
            blocked("MISSING_IMG_NODE");
            return undefined;
        }
        if (!photoId) {
            blocked("MISSING_PHOTO_ID");
            return undefined;
        }

        if (traceDetails) {
            PhotoBrowserPerformance.trace(
                "PHOTOIMAGE_SOURCE_NORMALIZED",
                sourceDetails({
                    photoId,
                    requestId: null,
                    mounted: mountedRef.current,
                    imgRefReady: true,
                    source: normalizedSource,
                    sourceOrigin,
                    role,
                    viewMode
                })
            );
        }

        const cachedSourceInvalid =
            cachedSource != null &&
            (
                typeof cachedSource !== "string" ||
                cachedSource.trim().length === 0
            );
        if (!normalizedSource) {
            if (cachedSourceInvalid) {
                blocked("INVALID_CACHED_SOURCE");
            } else if (!fileEntry) {
                blocked("MISSING_FILE_ENTRY");
            } else if (
                role === "browser" &&
                !browserOriginalFallbackEnabled
            ) {
                blocked("BROWSER_THUMBNAIL_PRODUCER_UNAVAILABLE");
            } else if (sourceOrigin === "NONE") {
                blocked("MISSING_FILE_URL");
            } else {
                blocked("INVALID_CACHED_SOURCE");
            }
            clearImageNodeSource(imgNode);
            setImageStatus("placeholder");
            return undefined;
        }

        setImageStatus("loading");
        if (traceDetails) {
            PhotoBrowserPerformance.trace(
                "IMG_REF_READY",
                sourceDetails({
                    photoId,
                    requestId: null,
                    mounted: mountedRef.current,
                    imgRefReady: true,
                    source: normalizedSource,
                    sourceOrigin,
                    role,
                    viewMode
                })
            );
        }

        const requestId = `${photoId}-${nextRequestId++}`;
        const request = {
            requestId,
            photoId,
            sourceIdentity,
            node: imgNode,
            schedulerFinish: null,
            temporaryUrl: null,
            releaseTemporaryUrl: null,
            sourceAssigned: false,
            settled: false
        };
        activeRequestRef.current = request;

        const details = error => sourceDetails({
            photoId,
            requestId,
            mounted: mountedRef.current,
            imgRefReady: imageRef.current === imgNode,
            source: normalizedSource,
            sourceOrigin,
            role,
            viewMode,
            error
        });

        const isCurrent = () =>
            imageRef.current === imgNode &&
            activeRequestRef.current === request &&
            request.photoId === photoId &&
            request.sourceIdentity === sourceIdentity;

        const logBlockedRequest = reason => {
            PhotoBrowserPerformance.trace(
                "PHOTOIMAGE_SOURCE_BLOCKED",
                {
                    ...inputDetails,
                    requestId,
                    reason
                }
            );
        };

        const markSourceFailure = () => {
            if (
                sourceOrigin === "FILE_ENTRY_URL" ||
                sourceOrigin === "FILE_ENTRY"
            ) {
                if (mountedRef.current) setFailedFileEntry(fileEntry);
            } else if (sourceOrigin === "CACHE" && mountedRef.current) {
                setFailedCachedSource(cachedSource);
            }
        };

        const releaseTemporaryUrl = () => {
            if (!request.temporaryUrl) return;
            PhotoBrowserPerformance.releaseObjectUrl(
                request.temporaryUrl
            );
            request.temporaryUrl = null;
        };
        request.releaseTemporaryUrl = releaseTemporaryUrl;

        const assignSource = async schedulerFinish => {
            request.schedulerFinish = schedulerFinish || null;
            if (!isCurrent()) {
                logBlockedRequest(
                    mountedRef.current
                        ? "STALE_REQUEST"
                        : "COMPONENT_UNMOUNTED"
                );
                request.schedulerFinish?.();
                request.schedulerFinish = null;
                return;
            }
            try {
                let assignableSource = normalizedSource;
                if (
                    sourceOrigin === "FILE_ENTRY" &&
                    role === "browser"
                ) {
                    assignableSource =
                        getFileEntryImageUrl(fileEntry);
                    if (assignableSource.startsWith("blob:")) {
                        request.temporaryUrl =
                            PhotoBrowserPerformance.trackObjectUrl(
                                assignableSource
                            );
                    }
                }
                imgNode.setAttribute(
                    "data-image-request",
                    requestId
                );
                // The persistent UXP img node can emit an error while a
                // scheduler request is still queued and has no src. Mark the
                // request first so only errors from this assignment settle it.
                request.sourceAssigned = true;
                imgNode.src = assignableSource;
                imgNode.getBoundingClientRect?.();
                if (traceDetails) {
                    PhotoBrowserPerformance.trace(
                        "IMG_SRC_ASSIGNED",
                        sourceDetails({
                            photoId,
                            requestId,
                            mounted: mountedRef.current,
                            imgRefReady:
                                imageRef.current === imgNode,
                            source: assignableSource,
                            sourceOrigin,
                            role,
                            viewMode
                        })
                    );
                }
                if (typeof imgNode.decode === "function") {
                    imgNode.decode().then(() => {
                        if (!isCurrent() || request.settled) return;
                        handleLoad({
                            currentTarget: imgNode,
                            type: "decode"
                        });
                    }).catch(() => {
                        // Native error/timeout remains authoritative.
                    });
                }
            } catch (error) {
                PhotoBrowserPerformance.trace(
                    isBrowserFileFallback
                        ? "BROWSER_FILE_FALLBACK_ERROR"
                        : role === "preview"
                            ? "PREVIEW_IMAGE_ERROR"
                            : "IMAGE_SOURCE_ERROR",
                    details(error)
                );
                request.settled = true;
                releaseTemporaryUrl();
                request.schedulerFinish?.();
                request.schedulerFinish = null;
                markSourceFailure();
                if (mountedRef.current) setImageStatus("error");
                onImageErrorRef.current?.(error);
            }
        };

        if (isBrowserFileFallback && traceDetails) {
            PhotoBrowserPerformance.trace(
                "BROWSER_FILE_FALLBACK_BEGIN",
                details()
            );
        }

        if (isBrowserFileFallback) {
            BrowserDecodeScheduler.request(requestId, assignSource, {
                timeoutMs: 15000,
                onTimeout: () => {
                    if (!isCurrent() || request.settled) return;
                    request.settled = true;
                    PhotoBrowserPerformance.trace(
                        "BROWSER_FILE_FALLBACK_TIMEOUT",
                        details({
                            name: "TimeoutError",
                            message:
                                "Image load did not settle within 15000ms"
                        })
                    );
                    clearImageNodeSource(imgNode);
                    releaseTemporaryUrl();
                    markSourceFailure();
                    if (mountedRef.current) setImageStatus("error");
                    onImageErrorRef.current?.();
                },
                onCancel: () => {
                    releaseTemporaryUrl();
                    if (traceDetails) {
                        PhotoBrowserPerformance.trace(
                            "BROWSER_FILE_FALLBACK_CANCELLED",
                            details({
                                name: "AbortError",
                                message:
                                    "Mounted image request was cancelled"
                            })
                        );
                    }
                }
            });
        } else {
            assignSource(null);
        }

        return () => {
            request.settled = true;
            if (imageRef.current === imgNode) {
                clearImageNodeSource(imgNode);
            }
            if (isBrowserFileFallback) {
                BrowserDecodeScheduler.cancel(requestId);
            }
            request.schedulerFinish?.();
            request.schedulerFinish = null;
            releaseTemporaryUrl();
            if (activeRequestRef.current === request) {
                activeRequestRef.current = null;
            }
            if (traceDetails) {
                PhotoBrowserPerformance.trace("THUMB_SOURCE_CLEARED", {
                    buildId: ALBUMAI_BUILD_ID,
                    photoId,
                    cacheKey,
                    generation: retryGeneration,
                    viewMode,
                    visible
                });
            }
        };

    }, [
        photoId,
        cachedSource,
        fileEntry,
        role,
        retryGeneration,
        cacheKey,
        normalizedSource,
        sourceIdentity,
        sourceOrigin,
        traceDetails,
        viewMode,
        visible,
        browserOriginalFallbackEnabled
    ]);

    const handleLoad = event => {
        const request = activeRequestRef.current;
        if (
            !request ||
            request.settled ||
            !request.sourceAssigned ||
            !mountedRef.current ||
            imageRef.current !== event.currentTarget ||
            request.photoId !== photoId ||
            request.sourceIdentity !== sourceIdentity
        ) return;

        const details = sourceDetails({
            photoId,
            requestId: request.requestId,
            mounted: true,
            imgRefReady: true,
            source: normalizedSource,
            sourceOrigin,
            role,
            viewMode
        });

        request.settled = true;
        setImageStatus("loaded");
        invalidateImagePaint(
            event.currentTarget,
            request.requestId
        );

        if (isBrowserFileFallback && traceDetails) {
            PhotoBrowserPerformance.trace(
                "BROWSER_FILE_FALLBACK_LOAD",
                details
            );
            PhotoBrowserPerformance.trace(
                "BROWSER_FILE_FALLBACK_ASSIGNED",
                details
            );
        } else if (role === "preview") {
            PhotoBrowserPerformance.trace("PREVIEW_IMAGE_LOAD", details);
        } else if (role === "browser" && !traceDetails) {
            browserSuccessesAggregated++;
            if (browserSuccessesAggregated % 25 === 0) {
                PhotoBrowserPerformance.trace(
                    "BROWSER_IMAGE_SUCCESS_AGGREGATE",
                    {
                        buildId: ALBUMAI_BUILD_ID,
                        successes: browserSuccessesAggregated
                    }
                );
            }
        }

        if (role === "browser") {
            PhotoBrowserPerformance.browserImageVisible(
                photoId,
                PhotoBrowserPerformance.timestamp() -
                    mountedAtRef.current
            );
        }
        request.schedulerFinish?.();
        request.schedulerFinish = null;
        onImageLoadRef.current?.(event);
    };

    const handleError = event => {
        const request = activeRequestRef.current;
        if (
            request &&
            !request.settled &&
            !request.sourceAssigned
        ) {
            if (traceDetails) {
                PhotoBrowserPerformance.trace(
                    "IMAGE_ERROR_BEFORE_SOURCE_IGNORED",
                    {
                        buildId: ALBUMAI_BUILD_ID,
                        photoId,
                        requestId: request.requestId,
                        mounted: mountedRef.current,
                        role,
                        viewMode
                    }
                );
            }
            return;
        }
        if (
            !request ||
            request.settled ||
            !mountedRef.current ||
            imageRef.current !== event.currentTarget ||
            request.photoId !== photoId ||
            request.sourceIdentity !== sourceIdentity
        ) return;

        const error = event?.error || {
            name: event?.type || "error",
            message: "HTMLImageElement rejected the assigned source"
        };
        const details = sourceDetails({
            photoId,
            requestId: request.requestId,
            mounted: true,
            imgRefReady: true,
            source: normalizedSource,
            sourceOrigin,
            role,
            viewMode,
            error
        });
        request.settled = true;
        setImageStatus("error");

        PhotoBrowserPerformance.trace(
            isBrowserFileFallback
                ? "BROWSER_FILE_FALLBACK_ERROR"
                : role === "preview"
                    ? "PREVIEW_IMAGE_ERROR"
                    : "IMAGE_SOURCE_ERROR",
            details
        );
        if (request.temporaryUrl) {
            PhotoBrowserPerformance.releaseObjectUrl(
                request.temporaryUrl
            );
            request.temporaryUrl = null;
        }
        request.schedulerFinish?.();
        request.schedulerFinish = null;

        if (
            sourceOrigin === "FILE_ENTRY_URL" ||
            sourceOrigin === "FILE_ENTRY"
        ) {
            setFailedFileEntry(fileEntry);
        } else if (sourceOrigin === "CACHE") {
            setFailedCachedSource(cachedSource);
        }
        onImageErrorRef.current?.(event);
    };

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
            <img
                ref={handleImgRef}
                alt={alt}
                draggable={false}
                onLoad={handleLoad}
                onError={handleError}
                style={{
                    ...style,
                    opacity: imageStatus === "loaded" ? 1 : 0
                }}
            />
            {imageStatus !== "loaded" && (
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
                    {fallback}
                </div>
            )}
        </div>
    );
}

export default React.memo(
    PhotoImage,
    (previous, next) =>
        previous.photoId === next.photoId &&
        previous.fileEntry === next.fileEntry &&
        previous.cachedSource === next.cachedSource &&
        previous.role === next.role &&
        previous.viewMode === next.viewMode &&
        previous.retryGeneration === next.retryGeneration &&
        previous.cacheKey === next.cacheKey &&
        previous.visible === next.visible &&
        previous.alt === next.alt
);
