import React, {
    useCallback,
    useEffect,
    useState
} from "react";

import ThumbnailGrid from "./ThumbnailGrid";
import PhotoBrowserPerformance from "../services/PhotoBrowserPerformance";

function PhotoBrowserSection({
    photos,
    onPhotoClick
}) {

    const [viewMode, setViewMode] = useState("icons");

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
    }, [viewMode]);

    return (
        <>
            <div
                className="fixed-view-toolbar"
                style={{
                    flex: "0 0 auto",
                    display: "flex",
                    gap: 6,
                    marginBottom: 8
                }}
            >
                {[
                    ["icons", "Icons"],
                    ["list", "List"]
                ].map(([mode, label]) => (
                    <button
                        key={mode}
                        type="button"
                        onClick={() => switchView(mode)}
                        aria-pressed={viewMode === mode}
                        style={{
                            fontWeight:
                                viewMode === mode ? 700 : 400,
                            color: "#fff",
                            background:
                                viewMode === mode
                                    ? "#17355d"
                                    : "transparent",
                            backgroundColor:
                                viewMode === mode
                                    ? "#17355d"
                                    : "transparent",
                            border:
                                viewMode === mode
                                    ? "2px solid #3B82F6"
                                    : "2px solid #b5b5b5",
                            borderRadius: 16,
                            padding: "4px 14px",
                            outline: "none"
                        }}
                    >
                        {label}
                    </button>
                ))}
            </div>

            <ThumbnailGrid
                photos={photos}
                onPhotoClick={onPhotoClick}
                viewMode={viewMode}
            />
        </>
    );

}

export default React.memo(PhotoBrowserSection);
