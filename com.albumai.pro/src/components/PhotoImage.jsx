import React, { useEffect, useRef, useState } from "react";
import resolvePhotoDisplaySource from "./resolvePhotoDisplaySource";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

/** Renders an AlbumAI photo with the UXP File fallback used by Preview. */
function PhotoImage({
    photo,
    alt = "",
    style,
    fallback = null,
    onImageLoad,
    allowFileFallback = true,
    sourceRevision,
    loadingRevision
}) {

    PhotoBrowserPerformance.recordRender("PhotoImage");
    const source = resolvePhotoDisplaySource(photo);
    const imageRef = useRef(null);
    const [failedSource, setFailedSource] = useState(null);
    const [failedFileKey, setFailedFileKey] = useState(null);
    const imageKey = `${photo?.id || "none"}:${source || "none"}`;
    const sourceFailed = !!source && failedSource === source;
    const useFileFallback = allowFileFallback &&
        (!source || sourceFailed) &&
        !!photo?.file &&
        failedFileKey !== imageKey;
    const imageInput = source && !sourceFailed
        ? source
        : useFileFallback
            ? photo.file
            : null;

    useEffect(() => {

        if (imageRef.current && imageInput) {
            imageRef.current.src = imageInput;
        }

    }, [imageInput, imageKey]);

    if (!imageInput) {
        return fallback;
    }

    return (
        <img
            ref={imageRef}
            key={`${imageKey}:${useFileFallback ? "file" : "source"}`}
            alt={alt}
            draggable={false}
            onLoad={event => {
                if (!useFileFallback) {
                    setFailedSource(null);
                }
                onImageLoad?.(event);
            }}
            onError={() => {
                if (useFileFallback) {
                    setFailedFileKey(imageKey);
                } else {
                    setFailedSource(source);
                }
            }}
            style={style}
        />
    );
}

export default React.memo(
    PhotoImage,
    (previous, next) =>
        previous.photo?.id === next.photo?.id &&
        previous.alt === next.alt &&
        previous.allowFileFallback ===
            next.allowFileFallback &&
        previous.sourceRevision === next.sourceRevision &&
        previous.loadingRevision === next.loadingRevision
);
