import { useEffect, useLayoutEffect, useState } from "react";
import { previewResolution } from "./PhotoPreviewModel";
import SoftwareJpegRenderer from "../services/SoftwareJpegRenderer";
import ThumbnailService from "../services/ThumbnailService";

// Both review surfaces share foreground priority, decoded-pixel retention and
// debounced quality upgrades. Panning and zoom-out never request smaller rasters.
export default function useReviewRendering(photo, geometry, scale) {
    const active = !!photo;
    const id = photo?.id;
    const initial = Math.min(1536, geometry.nativeEdge);
    const [resolution, setResolution] = useState(null);
    useLayoutEffect(() => {
        if (!active) return;
        const release = SoftwareJpegRenderer.retainPreviewDecoded();
        const resume = ThumbnailService.holdBackgroundRefinements();
        return () => {
            release();
            resume();
            ThumbnailService.clearReviewPreviews({ keepSmall: true });
        };
    }, [active]);
    useEffect(() => {
        if (active) ThumbnailService.cancelReviewRequests(photo);
        setResolution(null);
    }, [id]);
    useEffect(() => {
        if (!active) return;
        const timer = setTimeout(() => setResolution(previous => ({ id,
            edge: Math.max(previous?.id === id ? previous.edge : initial,
                previewResolution(geometry, scale, window.devicePixelRatio || 1))
        })), 200);
        return () => clearTimeout(timer);
    }, [id, scale, geometry.width, geometry.height, geometry.nativeEdge]);
    return `review-${resolution && resolution.id === id ? resolution.edge : initial}`;
}
