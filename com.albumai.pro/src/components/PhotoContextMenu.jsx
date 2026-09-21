import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import EventNameEditor from "./EventNameEditor";
import { CullingStatus } from "../services/PhotoCullingService";

export function contextReviewState(photos, decisionForPhoto) {
    const values = photos.map(decisionForPhoto);
    return {
        favorite: values.every(value => value.favorite === true),
        rejected: values.every(value => value.culling === CullingStatus.REJECT),
        rating: values.every(value => value.rating === values[0]?.rating) ? values[0]?.rating || 0 : null
    };
}

export function eventFlyoutPosition(menu, bounds, count) {
    const width = Math.min(220, bounds.width - 20);
    const height = Math.min(280, 52 + count * 34, bounds.height - 20);
    const right = menu.right - 2;
    return { left: Math.max(bounds.left + 10, right + width <= bounds.right - 10 ? right : menu.left - width + 2),
        top: Math.max(bounds.top + 10, Math.min(menu.top, bounds.bottom - height - 10)), width, maxHeight: height };
}

function ContextActionIcon({kind, filled = false}) {
    const color = kind === "star" ? "#e8c366" : "#dce4ed";
    const paint = {fill:filled ? color : "none", stroke:color, strokeWidth:1.35, strokeLinejoin:"round", strokeLinecap:"round"};
    return <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
        {kind === "star" ? <path {...paint} d="M8 1.5l2 4.1 4.5.6-3.3 3.2.8 4.6L8 11.8 4 14l.8-4.6L1.5 6.2 6 5.6z" />
            : kind === "heart" ? <path {...paint} d="M8 13.5L2.4 8A3.5 3.5 0 0 1 8 3.8 3.5 3.5 0 0 1 13.6 8z" />
            : kind === "reject" ? <><circle {...paint} cx="8" cy="8" r="5.5" /><path {...paint} d="M4 12l8-8" /></>
            : <path {...paint} d="M2 8h11M9 4l4 4-4 4" />}
    </svg>;
}

// Ordinary elements avoid UXP native button rings; share the toolbar menu rows.
export const ContextMenuRow = React.forwardRef(function ContextMenuRow({children, disabled, onClick, ...props}, ref) {
    return <div {...props} ref={ref} className="library-toolbar-option" role={props.role || "menuitem"}
        tabIndex={disabled ? -1 : 0} aria-disabled={!!disabled}
        onClick={event => { if (!disabled) onClick?.(event); }}
        onKeyDown={event => {
            if (["Enter", " "].includes(event.key)) { event.preventDefault(); if (!disabled) onClick?.(event); }
            props.onKeyDown?.(event);
        }}>{children}</div>;
});

export default function PhotoContextMenu({ menu, menuRef, events, controls = [], ready, decisionForPhoto, onClose, onMove, onNew, onDecision, onEditingChange }) {
    const [creating, setCreating] = useState(false);
    const [flyout, setFlyout] = useState(null);
    const [hoverRating, setHoverRating] = useState(null);
    const moveButton = useRef(null);
    const review = contextReviewState(menu.photos, decisionForPhoto);
    const allCollages = menu.photos.length > 0 && menu.photos.every(photo => decisionForPhoto(photo).collage === true);
    const open = (event, id, count) => {
        if (!ready) return;
        setFlyout({id, position:eventFlyoutPosition(event.currentTarget.getBoundingClientRect(), document.body.getBoundingClientRect(), count)});
    };
    const openEvents = event => open(event, "events", events.length);
    const active = controls.find(control => control.id === flyout?.id);
    const act = changes => { onDecision(changes); onClose(); };
    const panelClass = "library-toolbar-menu photo-context-menu";
    return createPortal(<div className="photo-context-backdrop" onClick={onClose}
        onMouseMove={event => { if (event.target === event.currentTarget) setFlyout(null); }}
        onContextMenu={event => { event.preventDefault(); onClose(); }}>
        <div ref={menuRef} tabIndex={1} role="menu" aria-label={menu.kind === "background" ? "Library options" : "Photo actions"} className={panelClass}
            onClick={event => event.stopPropagation()}
            style={{position:"absolute", top:menu.y, left:menu.x, width:220, maxHeight:menu.maxHeight, overflowY:"auto"}}>
            {menu.kind === "background" ? controls.map(control => <ContextMenuRow key={control.id} disabled={!ready}
                aria-haspopup="menu" aria-expanded={flyout?.id === control.id}
                onMouseEnter={event => open(event, control.id, control.options.length)}
                onFocus={event => open(event, control.id, control.options.length)}
                onClick={event => open(event, control.id, control.options.length)}>{control.label}<span className="photo-context-arrow">›</span></ContextMenuRow>) : <>
                <ContextMenuRow ref={moveButton} aria-haspopup="menu" aria-expanded={flyout?.id === "events"} disabled={!ready}
                    onMouseEnter={openEvents} onFocus={openEvents} onClick={openEvents}
                    onKeyDown={event => { if (event.key === "ArrowRight") { event.preventDefault(); openEvents(event); } }}><span className="photo-context-symbol"><ContextActionIcon kind="move" /></span>Move to<span className="photo-context-arrow">›</span></ContextMenuRow>
                <div className="photo-context-separator" role="separator" />
                <div className="photo-context-review" onMouseEnter={() => setFlyout(null)}>
                    <div className="photo-context-rating" role="group" aria-label="Rating" onMouseLeave={() => setHoverRating(null)}>
                        {[1, 2, 3, 4, 5].map(rating => <div key={rating} role="button" tabIndex={ready ? 0 : -1}
                            className="photo-context-star" aria-disabled={!ready}
                            aria-label={`${rating} star${rating === 1 ? "" : "s"}; select again to clear`}
                            aria-pressed={review.rating === rating} onMouseEnter={() => setHoverRating(rating)}
                            onClick={() => { if (ready) act({rating:review.rating === rating ? 0 : rating}); }}
                            onKeyDown={event => { if (ready && ["Enter", " "].includes(event.key)) { event.preventDefault(); act({rating:review.rating === rating ? 0 : rating}); } }}>
                            <ContextActionIcon kind="star" filled={rating <= (hoverRating ?? review.rating ?? 0)} />
                        </div>)}
                    </div>
                    <div className="photo-context-separator" role="separator" />
                    <ContextMenuRow disabled={!ready} onClick={() => act({favorite:!review.favorite})}>
                        <span className="photo-context-symbol"><ContextActionIcon kind="heart" filled={review.favorite} /></span>{review.favorite ? "Remove favorite" : "Favorite"}
                    </ContextMenuRow>
                    <ContextMenuRow disabled={!ready} onClick={() => act({culling:review.rejected ? CullingStatus.UNRATED : CullingStatus.REJECT})}>
                        <span className="photo-context-symbol"><ContextActionIcon kind="reject" /></span>{review.rejected ? "Unreject" : "Reject"}
                    </ContextMenuRow>
                    <div className="photo-context-separator" role="separator" />
                    <ContextMenuRow disabled={!ready} onClick={() => act({collage:!allCollages})}>
                        {allCollages ? "Remove collage label" : "Mark as collage"}
                    </ContextMenuRow>
                </div>
            </>}
        </div>
        {flyout && <div className={`${panelClass} photo-context-flyout`} role="menu" aria-label={active ? `${active.label} options` : "Move to event"}
            onClick={event => event.stopPropagation()}
            onKeyDown={event => { if (event.key === "ArrowLeft") { event.preventDefault(); moveButton.current?.focus(); setFlyout(null); } }}
            style={{position:"absolute", ...flyout.position, ...(creating ? {maxHeight:Math.max(80, Math.min(300, document.body.getBoundingClientRect().bottom-flyout.position.top-10))} : {}), overflowY:"auto"}}>
            {active ? active.options.map(option => <ContextMenuRow key={option.value} role="menuitemradio" aria-checked={active.value === option.value}
                onClick={() => { active.onChange(option.value); onClose(); }}>
                <span className="library-toolbar-option-check" aria-hidden="true">{active.value === option.value ? "✓" : ""}</span><span className="library-toolbar-option-label">{option.label}</span>
            </ContextMenuRow>) : <>
                {events.map(item => <ContextMenuRow key={item.chapterId} disabled={!ready}
                    onClick={() => { onMove(item.chapterId); onClose(); }}><span className="library-toolbar-option-label">{item.name}</span></ContextMenuRow>)}
                {creating ? <EventNameEditor inline compact creating onEditingChange={onEditingChange}
                    onCancel={() => setCreating(false)} onSave={async name => { await onNew(name); onClose(); }} />
                    : <ContextMenuRow disabled={!ready} onClick={() => setCreating(true)}>+ New event</ContextMenuRow>}
            </>}
        </div>}
    </div>, document.body);
}
