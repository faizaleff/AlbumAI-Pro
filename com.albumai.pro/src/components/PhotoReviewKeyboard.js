import {focusWithoutMovingLibrary} from "./PopupScrollbars";
export function photoReviewKey(event) {
    const aliases = {
        Left: "ArrowLeft", Right: "ArrowRight", Up: "ArrowUp", Down: "ArrowDown",
        Space: " ", Spacebar: " ", Esc: "Escape"
    };
    const key = event.key;
    if (key && key !== "Unidentified") return aliases[key] || key;
    if (/^(Digit|Numpad)[0-5]$/.test(event.code || "")) return event.code.slice(-1);
    if (/^Key[A-Z]$/.test(event.code || "")) return event.code.slice(-1).toLowerCase();
    return aliases[event.code] || event.code || ({ 27: "Escape", 32: " " })[event.keyCode] || "";
}

// UXP may route native-control keys to either root. Handle one event only once.
export function bindPhotoReviewKeys(handler, roots = [window, document]) {
    const seen = new WeakSet();
    const receive = event => {
        if (seen.has(event)) return;
        seen.add(event);
        handler(event);
    };
    roots.forEach(root => root.addEventListener("keydown", receive, true));
    return () => roots.forEach(root => root.removeEventListener("keydown", receive, true));
}

export function blocksPhotoReviewKeys(target) {
    const element = target?.closest ? target : target?.parentElement;
    return !!element?.closest?.(
        'input, textarea, select, sp-textfield, sp-textarea, sp-picker, [contenteditable="true"], [contenteditable=""], [role="textbox"], [role="slider"], .library-toolbar, .photo-library-sidebar'
    );
}

export function focusPhotoReviewViewport(viewport) {
    focusWithoutMovingLibrary(viewport);
}

// Native UXP pointer actions can clear activeElement without a focusin event.
// Reclaim the dialog after the host's default action and React's control update.
// Only pointer interactions in this preview qualify; never poll/steal app focus.
export function bindPhotoReviewPointerFocus(dialog, root = document) {
    let timer, dragging = false, active = true;
    const focus = () => { if (active) focusPhotoReviewViewport(dialog); };
    const restore = () => {
        focus();
        clearTimeout(timer);
        timer = setTimeout(focus, 0);
    };
    const down = () => { dragging = true; restore(); };
    const up = () => { if (dragging) { dragging = false; restore(); } };
    const bindings = [[dialog, "mousedown", down], [dialog, "click", restore],
        [dialog, "wheel", restore], [root, "mouseup", up]];
    bindings.forEach(([target, name, handler]) => target.addEventListener(name, handler, true));
    return () => {
        active = false;
        clearTimeout(timer);
        bindings.forEach(([target, name, handler]) => target.removeEventListener(name, handler, true));
    };
}

export function photoNavigationEntry(entries, focusedId, key, viewMode) {
    if (!entries.length) return null;
    const index = entries.findIndex(entry => entry.photo.id === focusedId);
    if (index < 0) return entries[0];
    const current = entries[index];
    const backwards = key === "ArrowLeft" || key === "ArrowUp";
    if (viewMode === "list" || key === "ArrowLeft" || key === "ArrowRight") {
        return entries[Math.max(0, Math.min(entries.length - 1, index + (backwards ? -1 : 1)))];
    }
    // Use rendered row coordinates: group headers and partial rows break a
    // simple index +/- columns calculation at group boundaries.
    const candidates = entries.filter(entry => backwards ? entry.top < current.top : entry.top > current.top);
    if (!candidates.length) return current;
    const rowTop = candidates.reduce((top, entry) => backwards
        ? Math.max(top, entry.top) : Math.min(top, entry.top), candidates[0].top);
    return candidates.filter(entry => entry.top === rowTop).reduce((nearest, entry) =>
        Math.abs(entry.left - current.left) < Math.abs(nearest.left - current.left) ? entry : nearest
    );
}
