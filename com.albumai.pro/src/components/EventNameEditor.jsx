import React, {useLayoutEffect, useRef, useState} from "react";
import {createPortal} from "react-dom";
import SidebarButton from "./SidebarButton";
import {focusWithoutMovingLibrary} from "./PopupScrollbars";

export function bindEventEditorLock(doc, focus) {
    const guard = event => {
        if (event.target.closest?.(".photo-event-editor")) return;
        event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.();
        if (!["mousemove", "mouseover", "pointermove", "pointerover", "wheel"].includes(event.type)) focus();
    };
    const types = ["mousedown", "mouseup", "click", "dblclick", "contextmenu", "keydown", "dragstart", "drop", "focusin", "mousemove", "mouseover", "pointermove", "pointerover", "wheel"];
    types.forEach(type => doc.addEventListener(type, guard, true));
    return () => types.forEach(type => doc.removeEventListener(type, guard, true));
}

export default function EventNameEditor({initialName = "", creating = false, position, inline = false, compact = false, onSave, onCancel, onEditingChange}) {
    const [name, setName] = useState(initialName);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const input = useRef(null), saving = useRef(false), panel = useRef(null);
    const [hole, setHole] = useState(null);
    useLayoutEffect(() => {
        if (inline) panel.current?.scrollIntoView?.({block:"nearest"});
        onEditingChange?.(true);
        const unlock = bindEventEditorLock(document, () => focusWithoutMovingLibrary(input.current));
        focusWithoutMovingLibrary(input.current); input.current?.select?.();
        return () => { unlock(); onEditingChange?.(false); };
    }, [onEditingChange, inline]);
    useLayoutEffect(() => {
        if (!inline) return;
        let previous = "";
        const measure = () => {
            const rect = panel.current?.getBoundingClientRect();
            if (!rect?.width || !rect.height) return;
            const next = {left:rect.left, top:rect.top, right:rect.right, bottom:rect.bottom};
            const key = JSON.stringify(next);
            if (key !== previous) { previous = key; setHole(next); }
        };
        measure();
        const timer = setInterval(measure, 100);
        return () => clearInterval(timer);
    }, [inline]);
    const cancel = () => { if (!saving.current) onCancel(); };
    const save = async () => {
        if (saving.current || !name.trim()) return;
        saving.current = true; setBusy(true); setError("");
        try { await onSave(name.trim()); }
        catch (_) { setError("Could not save. Please retry."); }
        finally { saving.current = false; setBusy(false); }
    };
    const editor = (
        <section ref={panel} className={`photo-event-editor photo-event-name-dialog${inline ? " is-inline" : ""}${compact ? " is-compact" : ""}`} role="dialog" aria-modal="true"
            aria-label={creating ? "New event" : "Rename event"} style={!inline && position ? {position:"absolute", left:position.x, top:position.y} : undefined}
            onKeyDown={event => {
                event.stopPropagation();
                if (event.key === "Escape") {event.preventDefault(); cancel();}
                if (event.key === "Enter" && event.target === input.current && !event.repeat && !event.isComposing) {event.preventDefault(); save();}
                if (event.key === "Tab") {
                    const nodes = Array.from(panel.current.querySelectorAll('input, [role="button"]')).filter(node => !node.disabled && node.getAttribute("aria-disabled") !== "true");
                    if (!nodes.length) {event.preventDefault(); return;}
                    const next = (nodes.indexOf(event.target) + (event.shiftKey ? -1 : 1) + nodes.length) % nodes.length;
                    event.preventDefault(); focusWithoutMovingLibrary(nodes[next]);
                }
            }}>
            {!compact && <strong>{creating ? "New event" : "Rename event"}</strong>}
            <input id="photo-event-name" ref={input} aria-label="Event name" disabled={busy} value={name} placeholder="Enter event name" onChange={event => setName(event.target.value)} />
            {error && <small role="alert">{error}</small>}
            <div className="photo-event-name-actions">
                <SidebarButton disabled={busy} onClick={cancel}>Cancel</SidebarButton>
                <SidebarButton className="is-primary" disabled={busy || !name.trim()} onClick={save}>{busy ? "Saving…" : "Save"}</SidebarButton>
            </div>
        </section>
    );
    if (!inline) return createPortal(<div className="photo-event-editor-overlay">{editor}</div>, document.body);
    return <>{editor}{hole && createPortal(<div className="photo-event-edit-masks" aria-hidden="true">
        <div style={{top:0, left:0, right:0, height:Math.max(0,hole.top)}} />
        <div style={{top:hole.bottom, left:0, right:0, bottom:0}} />
        <div style={{top:hole.top, left:0, width:Math.max(0,hole.left), height:hole.bottom-hole.top}} />
        <div style={{top:hole.top, left:hole.right, right:0, height:hole.bottom-hole.top}} />
    </div>, document.body)}</>;
}
