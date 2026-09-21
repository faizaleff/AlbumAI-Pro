// UXP does not reliably provide native drag images or CSS animation. Keep this
// gesture local to the Library and animate numeric geometry on a short timer.
// The controller owns only feedback; the caller owns membership and persistence.
export function libraryDragPhotos(photos, selectedIds, id) {
    const photo = photos.find(item => String(item.id) === String(id));
    return !photo ? [] : selectedIds.has(photo.id)
        ? photos.filter(item => selectedIds.has(item.id)) : [photo];
}

const inside = (point, rect) => rect.width > 0 && rect.height > 0 &&
    point.x >= rect.left && point.x <= rect.right &&
    point.y >= rect.top && point.y <= rect.bottom;
const ease = value => 1 - Math.pow(1 - Math.min(1, Math.max(0, value)), 3);
const stop = event => { event.preventDefault(); event.stopPropagation(); event.stopImmediatePropagation?.(); };

export function bindLibraryDrag(root, options, {
    doc = document, host = window, clock = Date.now,
    later = setTimeout, cancelTimer = clearTimeout
} = {}) {
    let gesture = null, timer = null, hold = null, suppressClick = false;
    let disposed = false;
    const resetTarget = target => {
        if (!target) return;
        target.node.removeAttribute("data-drag-over");
        target.node.style.left = "";
    };
    const clear = () => {
        cancelTimer(timer); cancelTimer(hold); timer = hold = null;
        const previous = gesture;
        gesture = null;
        if (!previous) return;
        resetTarget(previous.target);
        previous.nodes?.forEach(node => node.classList.remove("is-library-drag-source"));
        previous.sources?.forEach(source => options.releaseSource(source));
        previous.ghost?.remove();
        root.classList.remove("is-library-dragging");
    };
    const targets = () => Array.from(root.querySelectorAll("[data-library-event]"));
    const findTarget = state => {
        const sidebar = root.querySelector(".photo-library-sidebar");
        if (!sidebar || !inside(state.point, sidebar.getBoundingClientRect())) return null;
        for (const node of targets()) {
            const id = node.getAttribute("data-library-event");
            const rect = node.getBoundingClientRect();
            if (node.getAttribute("data-drop-ready") !== "true" || !inside(state.point, rect)) continue;
            if (state.kind === "event" && (state.id === id || id === "new-event")) continue;
            return { node, id, mode: state.kind === "photos" ? "photos"
                : state.point.y > rect.top + rect.height / 2 ? "after" : "before" };
        }
        return null;
    };
    const tick = () => {
        const state = gesture;
        if (!state?.ghost) return;
        const elapsed = clock() - state.started;
        if (state.phase === "dragging") {
            // Scroll the actual sidebar, including when the pointer is held at an edge.
            const sidebar = root.querySelector(".photo-library-sidebar");
            const rect = sidebar?.getBoundingClientRect();
            if (rect && inside(state.point, rect)) {
                const step = state.point.y < rect.top + 26 ? -7 : state.point.y > rect.bottom - 26 ? 7 : 0;
                if (step) sidebar.scrollTop += step;
            }
            const target = findTarget(state);
            if (target?.id !== state.target?.id || target?.mode !== state.target?.mode) {
                resetTarget(state.target); state.target = target; state.targetAt = clock();
            }
            if (target) {
                target.node.setAttribute("data-drag-over", target.mode);
                const progress = ease((clock() - state.targetAt) / 130);
                target.node.style.left = `${-3 * progress}px`;
                // Reorder markers must not change row height or sidebar scroll extent.
            }
            state.label.textContent = state.kind === "event" ? state.title
                : target ? `+ Move ${state.photos.length} here` : state.title;
        }
        const progress = state.phase === "landing" ? ease(elapsed / 180) : 0;
        const lift = ease(elapsed / 140);
        const width = state.kind === "event" ? 170 : 100;
        const height = state.kind === "event" ? 36 : 80;
        const body = doc.body.getBoundingClientRect();
        const x = Math.max(body.left, Math.min(state.point.x + 14, body.right - width - 16));
        const y = Math.max(body.top, Math.min(state.point.y - 12 - lift * 5, body.bottom - height - 24));
        Object.assign(state.ghost.style, {
            left: `${x + ((state.destination?.x ?? x) - x) * progress}px`,
            top: `${y + ((state.destination?.y ?? y) - y) * progress}px`,
            width: `${width * (0.94 + 0.06 * lift) * (1 - 0.65 * progress)}px`,
            height: `${height * (1 - 0.65 * progress)}px`,
            opacity: String(1 - progress)
        });
        state.cards.forEach((card, index) => Object.assign(card.style, {
            left: `${index * (12 - 7 * lift)}px`, top: `${index * (10 - 6 * lift)}px`
        }));
        if (state.phase === "landing" && elapsed >= 180) { clear(); return; }
        timer = later(tick, 16);
    };
    const activate = () => {
        const state = gesture;
        if (!state || state.ghost) return;
        cancelTimer(hold);
        suppressClick = true;
        state.phase = "dragging"; state.started = clock();
        state.cards = []; state.sources = [];
        state.nodes = state.kind === "event" ? [state.node]
            : Array.from(root.querySelectorAll("[data-pid]")).filter(node => state.photos.some(photo => String(photo.id) === node.getAttribute("data-pid")));
        state.nodes.forEach(node => node.classList.add("is-library-drag-source"));
        root.classList.add("is-library-dragging");
        const ghost = doc.createElement("div");
        ghost.className = `library-drag-ghost is-${state.kind}`;
        ghost.setAttribute("aria-hidden", "true");
        state.ghost = ghost;
        if (state.kind === "photos") {
            // Reuse at most three loaded thumbnails; never request a decode for dragging.
            const samples = [state.photos.find(photo => String(photo.id) === state.id), ...state.photos.filter(photo => String(photo.id) !== state.id)].slice(0, 3);
            samples.reverse().forEach(photo => {
                const card = doc.createElement("div"); card.className = "library-drag-card";
                const node = state.nodes.find(item => item.getAttribute("data-pid") === String(photo.id));
                const source = node?.querySelector("img")?.getAttribute("src") || photo.thumbnail;
                if (source) {
                    options.retainSource(source); state.sources.push(source);
                    const img = doc.createElement("img"); img.setAttribute("src", source); card.appendChild(img);
                }
                ghost.appendChild(card); state.cards.unshift(card);
            });
        }
        const label = doc.createElement("div"); label.className = "library-drag-label";
        label.textContent = state.title; state.label = label; ghost.appendChild(label);
        doc.body.appendChild(ghost);
        tick();
    };
    const down = event => {
        if (gesture?.phase === "saving") return;
        clear(); suppressClick = false;
        if ((event.button != null && event.button !== 0) || !options.enabled() || event.target.closest?.('input, button, select, [contenteditable="true"]')) return;
        const handle = event.target.closest?.("[data-event-handle]");
        const node = handle?.closest("[data-library-event]") || event.target.closest?.("[data-pid]");
        if (!node || !root.contains(node)) return;
        if (!handle && (!event.target.closest?.(".photo-thumbnail-media, .photo-list-thumbnail") || event.target.closest?.('[role="button"]'))) return;
        if (handle && node.getAttribute("data-drop-ready") !== "true") return;
        const id = node.getAttribute(handle ? "data-library-event" : "data-pid");
        const photos = handle ? [] : options.photos(id);
        if (!handle && !photos.length) return;
        gesture = { id, photos, node, kind: handle ? "event" : "photos", phase: "armed", sawButtons: event.buttons > 0,
            point: { x: event.clientX, y: event.clientY }, start: { x: event.clientX, y: event.clientY },
            title: handle ? node.getAttribute("data-event-name") : `${photos.length} photo${photos.length === 1 ? "" : "s"}` };
        if (handle) stop(event);
        hold = later(activate, 160);
    };
    const move = event => {
        const state = gesture;
        if (!state || !["armed", "dragging"].includes(state.phase)) return;
        // A lost mouseup must not leave a lifted item attached to the cursor.
        if (state.sawButtons && event.buttons === 0) { clear(); return; }
        if (event.buttons > 0) state.sawButtons = true;
        state.point = { x: event.clientX, y: event.clientY };
        if (Math.hypot(state.point.x - state.start.x, state.point.y - state.start.y) >= 5) activate();
        if (state.ghost) stop(event);
    };
    const up = event => {
        const state = gesture;
        if (!state || state.phase === "saving" || state.phase === "landing") return;
        if (!state.ghost) { clear(); return; }
        stop(event);
        state.point = { x: event.clientX, y: event.clientY };
        const target = findTarget(state);
        if (!target || !options.enabled()) { clear(); return; }
        resetTarget(state.target); state.target = target;
        state.phase = "saving";
        if (state.kind === "photos") state.label.textContent = "Saving…";
        Promise.resolve().then(() => {
            if (disposed || gesture !== state) return;
            return options.commit(state, target);
        }).then(result => {
            if (disposed || gesture !== state) return;
            if (result === false) { clear(); return; }
            // Locate by stable ID again: saving may have reordered or replaced rows.
            const node = targets().find(item => item.getAttribute("data-library-event") === target.id);
            const rect = node?.getBoundingClientRect();
            state.destination = rect ? { x: rect.left + rect.width / 2, y: rect.top } : null;
            state.phase = "landing"; state.started = clock();
            state.label.textContent = state.kind === "event" ? state.title : "Added";
            if (node) { state.target = { node }; node.setAttribute("data-drag-over", "added"); }
        }).catch(error => {
            if (disposed || gesture !== state) return;
            clear(); options.onError(error);
        });
    };
    const key = event => {
        if (!gesture) return;
        if (event.key === "Escape" || event.key === "Esc" || event.keyCode === 27) {
            stop(event);
            if (gesture.phase !== "saving") clear();
        } else if (gesture.ghost) stop(event);
    };
    const click = event => { if (suppressClick) { stop(event); if (!gesture) suppressClick = false; } };
    const nativeDrag = event => { if (gesture) { stop(event); activate(); } };
    const blur = () => { if (gesture?.phase !== "saving") clear(); };
    const bindings = [[root, "mousedown", down], [doc, "mousemove", move], [doc, "mouseup", up],
        [doc, "keydown", key], [root, "click", click], [root, "dragstart", nativeDrag], [root, "drop", event => { if (gesture) { stop(event); up(event); } }], [host, "blur", blur]];
    bindings.forEach(([node, type, listener]) => node.addEventListener(type, listener, true));
    return () => {
        disposed = true; clear();
        bindings.forEach(([node, type, listener]) => node.removeEventListener(type, listener, true));
    };
}
