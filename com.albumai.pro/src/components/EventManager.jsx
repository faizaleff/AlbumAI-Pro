import React, { useState, useRef, useLayoutEffect } from "react";
import SidebarButton from "./SidebarButton";

import EventNameEditor, {bindEventEditorLock} from "./EventNameEditor";
export {bindEventEditorLock} from "./EventNameEditor";

export function EventDescription({text}) {
    const [expanded, setExpanded] = useState(false);
    const long = text.length > 80;
    const summary = long ? `${text.slice(0,77).replace(/\s+\S*$/, "")}…` : text;
    return <div className="photo-event-description-area">
        <p className={`photo-event-description${expanded ? "" : " is-collapsed"}`}>{expanded ? text : summary}</p>
        {long && <SidebarButton className="photo-event-description-toggle" aria-expanded={expanded}
            onClick={() => setExpanded(value => !value)}>{expanded ? "Less" : "More"}</SidebarButton>}
    </div>;
}

// Inline editing keeps the event list and photo selection visible.
export default function EventManager({items, selected, onSelect, onDrop, ready, creating, onClose, onEdit, onEditingChange}) {
    const [editing, setEditing] = useState("");
    const [name, setName] = useState("");
    const [remove, setRemove] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const saving = useRef(false);
    const input = useRef(null);
    useLayoutEffect(() => {
        if (!remove) return;
        onEditingChange?.(true);
        const unlock = bindEventEditorLock(document, () => input.current?.focus());
        return () => {
            unlock();
            onEditingChange?.(false);
        };
    }, [remove, onEditingChange]);
    useLayoutEffect(() => {
        if (creating) { setEditing(""); setRemove(""); setName(""); setError(""); }
    }, [creating]);
    useLayoutEffect(() => {
        if (creating || editing) { input.current?.focus(); input.current?.select?.(); }
    }, [creating, editing]);
    const close = () => { if (!saving.current) { setEditing(""); setRemove(""); setName(""); onClose(); } };
    const rename = item => {
        if (!ready || busy) return;
        onClose(); setRemove(""); setEditing(item.chapterId); setName(item.name); setError("");
    };
    const run = async (action, id, value) => {
        if (!ready || saving.current) return;
        saving.current = true; setBusy(true); setError("");
        try { await onEdit(action, id, value); setEditing(""); setRemove(""); setName(""); onClose(); }
        catch (_) { setError("Could not save event. Please retry."); }
        finally { saving.current = false; setBusy(false); }
    };
    const editor = id => <EventNameEditor inline creating={!id} initialName={id ? name : ""}
        onEditingChange={onEditingChange} onCancel={close}
        onSave={async value => { await onEdit(id ? "rename" : "new", id, value); setEditing(""); setName(""); onClose(); }} />;
    return <div>
        {items.map(item => <div key={item.chapterId}>
            <div className="photo-event-drag-row" data-library-event={item.chapterId} data-event-name={item.name}
                data-drop-ready={ready && !busy && !editing && !creating && !remove ? "true" : "false"}>
                <div className="photo-event-drag-handle" data-event-handle="true" role="button" tabIndex={ready && !busy ? 1 : -1}
                    aria-disabled={!ready || busy} aria-label={`Reorder ${item.name}`}
                    onClick={event => {event.preventDefault(); event.stopPropagation();}}
                    onKeyDown={event => {
                        event.stopPropagation();
                        if (ready && !busy && !editing && !creating && !event.repeat && ["ArrowUp", "ArrowDown"].includes(event.key)) {
                            event.preventDefault(); run(event.key === "ArrowUp" ? "up" : "down", item.chapterId);
                        }
                    }}><svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                        <path d="M3 4 H11 M3 7 H11 M3 10 H11" fill="none" stroke="#bacce2" strokeWidth="1" />
                    </svg></div>
                <SidebarButton className={`photo-event-chapter-row${selected.has(item.chapterId) ? " is-active" : ""}`}
                    style={{flex:1, minWidth:0}} disabled={!ready || busy}
                    onDragOver={event => {event.preventDefault(); if(event.dataTransfer) event.dataTransfer.dropEffect="move";}}
                    onDrop={event => {
                        event.preventDefault();
                        if (!ready || busy || saving.current || editing || creating || remove) return;
                        const value = event.dataTransfer?.getData("text/plain") || "";
                        if (value.startsWith("event:")) {
                            const rect = event.currentTarget.getBoundingClientRect();
                            run(event.clientY > rect.top + rect.height / 2 ? "after" : "before", value.slice(6), item.chapterId);
                        }
                        else onDrop(event, item.chapterId);
                    }}
                    onClick={event => onSelect(item.chapterId, event)}
                    onDoubleClick={() => rename(item)}
                    >
                    <span title={item.name}>{item.name.replace(/^(Event \d+) \(.*\)$/, "$1")}</span><small>{item.photoKeys.length}</small>
                </SidebarButton>
                <SidebarButton className="photo-event-row-action" disabled={!ready || busy} aria-label={`Rename ${item.name}`} title="Rename event"
                    onClick={() => rename(item)}>✎</SidebarButton>
                <SidebarButton className="photo-event-row-action" disabled={!ready || busy} aria-label={`Remove ${item.name}`} title="Remove event, not photos"
                    onClick={() => {onClose(); setEditing(""); setRemove(remove === item.chapterId ? "" : item.chapterId);}}>−</SidebarButton>
            </div>
            {selected.has(item.chapterId) && item.description && <EventDescription key={item.description} text={item.description}/>}
            {editing === item.chapterId && !creating && editor(item.chapterId)}
            {remove === item.chapterId && <div className="photo-event-editor">
                <small>{item.originKeys ? "Move photos to Unassigned?" : "Restore photos to original events?"}</small>
                <button disabled={busy} onClick={() => run("delete", item.chapterId)}>Remove</button>
                <button onClick={() => setRemove("")}>Cancel</button>
            </div>}
        </div>)}
        {creating && editor("")}
        {error && <small role="alert">{error}</small>}
    </div>;
}
