import React, { useEffect, useRef, useState } from "react";
import resolvePhotoDisplaySource from "./resolvePhotoDisplaySource";

/** Renders an AlbumAI photo with the UXP File fallback used by Preview. */
export default function PhotoImage({ photo, alt = "", style, fallback = null, onImageLoad }) {

    const source = resolvePhotoDisplaySource(photo);
    const imageRef = useRef(null);
    const [failedSource, setFailedSource] = useState(null);
    const [failedFileKey, setFailedFileKey] = useState(null);
    const imageKey = `${photo?.id || "none"}:${source || "none"}`;
    const sourceFailed = !!source && failedSource === source;
    const useFileFallback = (!source || sourceFailed) &&
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
