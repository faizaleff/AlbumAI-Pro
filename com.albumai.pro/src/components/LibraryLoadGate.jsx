import React, { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

export function libraryLoadProgress(status = {}, opening = false) {
    const active = opening || ["reading", "grouping", "preparing", "error"].includes(status.phase);
    const percent = status.phase === "ready" && !opening ? 100
        : status.total ? Math.min(99, Math.floor(status.completed / status.total * 99)) : 0;
    return { active, percent, blocking: !!opening && active };
}

// Hide native text widgets too: UXP may paint them above a normal overlay.
export function blockLibraryDuringLoad(root, dialog, doc = document, host = window) {
    const visibility = root.style.visibility;
    root.style.visibility = "hidden";
    root.setAttribute("aria-busy", "true");
    const block = event => {
        if (dialog.contains(event.target)) return;
        event.preventDefault(); event.stopImmediatePropagation();
    };
    const roots = [host, doc];
    roots.forEach(node => ["keydown","mousedown","click","wheel"].forEach(type => node.addEventListener(type, block, true)));
    dialog.focus();
    return () => {
        roots.forEach(node => ["keydown","mousedown","click","wheel"].forEach(type => node.removeEventListener(type, block, true)));
        root.style.visibility = visibility;
        root.removeAttribute("aria-busy");
        root.querySelector(".photo-browser-viewport")?.focus();
    };
}

export default function LibraryLoadGate({ status = {}, opening, rootRef, onRetry }) {
    const { active, percent, blocking } = libraryLoadProgress(status, opening);
    const [finishing, setFinishing] = useState(active);
    const dialog = useRef(null);
    const visible = active || finishing;
    useLayoutEffect(() => {
        if (active) { setFinishing(true); return; }
        // Show 100% only after the final sidebar render has committed.
        const timer = setTimeout(() => setFinishing(false), 100);
        return () => clearTimeout(timer);
    }, [active, status.generation]);
    useLayoutEffect(() => {
        // Only the short file-opening phase is modal. Metadata and previews
        // continue in the background so large projects remain usable.
        if (visible && blocking) return blockLibraryDuringLoad(rootRef.current, dialog.current);
    }, [visible, blocking]);
    if (!visible) return null;
    if (!blocking) return createPortal(<section className={`library-load-status${status.phase === "error" ? " is-error" : ""}`}
        role="status" aria-live="polite" aria-label="Background project preparation">
        <div className="library-load-status-copy">
            <strong>{status.phase === "error" ? "Background loading paused" : percent === 100 ? "Project ready" : "Loading in background"}</strong>
            <span>{status.message || (status.phase === "error" ? "Some photo details could not be read."
                : percent === 100 ? "Visible previews load as you browse."
                : status.phase === "grouping" ? "Finishing photo groups…"
                : status.total ? `Reading photo details · ${status.completed} / ${status.total}` : "Preparing photos…")}</span>
        </div>
        <div className="library-load-status-progress">
            <div className="library-load-track" role="progressbar" aria-label="Background project preparation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div style={{ width: `${percent}%` }} />
            </div>
            <span>{percent}%</span>
        </div>
        {status.phase === "error" && <button onClick={onRetry}>Retry</button>}
    </section>, document.body);
    return createPortal(<div className="library-load-overlay">
        <section ref={dialog} className="library-load-dialog" tabIndex={1} role="dialog" aria-modal="true" aria-label="Preparing Library">
            <strong>{status.phase === "error" ? "Library preparation interrupted" : percent === 100 ? "Library ready" : "Preparing Library"}</strong>
            <p>{status.message || (status.phase === "error" ? "Please retry to finish reading the photo metadata."
                : percent === 100 ? "Photos, cameras and groups are ready."
                : status.phase === "grouping" ? "Finishing camera and event groups…"
                : status.total ? `Reading photo metadata · ${status.completed} / ${status.total}` : "Loading project and photos…")}</p>
            <div className="library-load-track" role="progressbar" aria-label="Library preparation" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}>
                <div style={{ width: `${percent}%` }} />
            </div>
            <div className="library-load-percent">{percent}%</div>
            {status.phase === "error" && <button onClick={onRetry}>Retry</button>}
        </section>
    </div>, document.body);
}
