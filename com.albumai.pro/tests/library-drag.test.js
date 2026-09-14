import assert from "assert";
import { bindLibraryDrag, libraryDragPhotos } from "../src/components/LibraryDrag";
import { bindEventEditorLock } from "../src/components/EventManager";
import { editEvent } from "../src/services/EventWorkspace";

// The production controller runs against a small DOM and deterministic clock.
// No native drag, CSS transitions, requestAnimationFrame or image decoder exists here.
class Node {
    constructor(tag = "div", className = "", rect = [0, 0, 0, 0]) {
        Object.assign(this, { tag, className, rect, children: [], attributes: {}, style: {}, listeners: new Map(), scrollTop: 0 });
        this.classList = {
            add: name => { if (!this.matches(`.${name}`)) this.className += ` ${name}`; },
            remove: name => { this.className = this.className.split(" ").filter(item => item !== name).join(" "); }
        };
    }
    appendChild(node) { this.children.push(node); node.parent = this; return node; }
    remove() { this.parent.children = this.parent.children.filter(node => node !== this); }
    setAttribute(key, value) { this.attributes[key] = value; }
    getAttribute(key) { return this.attributes[key] ?? null; }
    removeAttribute(key) { delete this.attributes[key]; }
    getBoundingClientRect() {
        const [left, top, width, height] = this.rect;
        return { left, top, width, height, right: left + width, bottom: top + height };
    }
    matches(selector) {
        return selector.split(",").some(part => {
            part = part.trim();
            if (part[0] === ".") return this.className.split(" ").includes(part.slice(1));
            if (part[0] === "[") {
                const [, key, value] = part.match(/^\[([^=\]]+)(?:="([^"]+)")?\]$/);
                return value === undefined ? key in this.attributes : this.attributes[key] === value;
            }
            return this.tag === part;
        });
    }
    closest(selector) { return this.matches(selector) ? this : this.parent?.closest(selector); }
    contains(node) { return node === this || this.children.some(child => child.contains(node)); }
    querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0]; }
    addEventListener(type, listener) { this.listeners.set(type, listener); }
    removeEventListener(type, listener) { assert.equal(this.listeners.get(type), listener); this.listeners.delete(type); }
    emit(type, target, x = 10, y = 65, extra = {}) {
        const event = { target, clientX: x, clientY: y, button: 0, buttons: 1,
            preventDefault() { this.defaultPrevented = true; }, stopPropagation() { this.stopped = true; }, ...extra };
        this.listeners.get(type)?.(event); return event;
    }
}

function fixture(commit) {
    const doc = new Node(), host = new Node();
    const body = new Node("body", "", [0, 0, 800, 500]); doc.body = body;
    doc.createElement = tag => new Node(tag);
    const root = body.appendChild(new Node());
    const sidebar = root.appendChild(new Node("aside", "photo-library-sidebar", [0, 0, 190, 300]));
    const rows = [0, 1, 2].map(index => {
        const row = sidebar.appendChild(new Node("div", "photo-event-drag-row", [0, 50 + index * 60, 180, 40]));
        row.setAttribute("data-library-event", `event-${index}`);
        row.setAttribute("data-drop-ready", "true"); row.setAttribute("data-event-name", `Event ${index}`);
        const handle = row.appendChild(new Node()); handle.setAttribute("data-event-handle", "true");
        return row;
    });
    const photos = [0, 1, 2, 3].map(id => ({ id: String(id), thumbnail: `blob:${id}` }));
    const media = photos.map(photo => {
        const node = root.appendChild(new Node()); node.setAttribute("data-pid", photo.id);
        const box = node.appendChild(new Node("div", "photo-thumbnail-media"));
        const img = box.appendChild(new Node("img")); img.setAttribute("src", photo.thumbnail);
        return box;
    });
    let enabled = true, time = 0, nextTimer = 0;
    const pending = new Map(), retained = [], released = [], commits = [], errors = [];
    const selection = new Set(["0", "1", "2", "3"]);
    const dispose = bindLibraryDrag(root, {
        enabled: () => enabled,
        photos: id => libraryDragPhotos(photos, selection, id),
        retainSource: source => retained.push(source), releaseSource: source => released.push(source),
        commit: (drag, target) => { commits.push({ drag, target }); return commit?.(drag, target); },
        onError: error => errors.push(error)
    }, { doc, host, clock: () => time,
        later: (fn, delay) => { const id = ++nextTimer; pending.set(id, { at: time + delay, fn }); return id; },
        cancelTimer: id => pending.delete(id) });
    const advance = ms => {
        const end = time + ms;
        while (true) {
            const next = [...pending].sort((a, b) => a[1].at - b[1].at)[0];
            if (!next || next[1].at > end) break;
            time = next[1].at; pending.delete(next[0]); next[1].fn();
        }
        time = end;
    };
    return { doc, host, root, body, sidebar, rows, media, photos, selection, retained, released, commits, errors, pending,
        advance, dispose, disable: () => { enabled = false; }, ghost: () => body.querySelector(".library-drag-ghost") };
}
const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };

export async function checkLibraryDrag() {
    const lockedDocument = new Node();
    const outside = new Node();
    const editor = new Node("div", "photo-event-editor");
    const input = editor.appendChild(new Node("input"));
    let focused = 0;
    const unlock = bindEventEditorLock(lockedDocument, () => focused++);
    for (const type of ["click", "mousedown", "mouseup", "keydown", "contextmenu", "drop", "focusin"]) {
        assert(lockedDocument.emit(type, outside).defaultPrevented, `${type} cannot escape event editing`);
        assert(!lockedDocument.emit(type, input).defaultPrevented, "editor remains usable");
    }
    assert.equal(focused, 7);
    for (const type of ["mousemove", "mouseover", "pointermove", "pointerover", "wheel"]) {
        assert(lockedDocument.emit(type, outside, 0, 0, {type}).defaultPrevented, `${type} cannot reach background controls`);
        assert(!lockedDocument.emit(type, input, 0, 0, {type}).defaultPrevented);
    }
    assert.equal(focused, 7, "background hover does not keep refocusing the input");
    unlock(); assert.equal(lockedDocument.listeners.size, 0);

    // A native drop and mouseup must commit the original selection exactly once.
    const native = fixture();
    native.root.emit("mousedown", native.media[0], 250, 70); native.advance(160);
    assert(native.root.emit("click", native.media[0]).defaultPrevented);
    assert(native.root.emit("click", native.media[0]).defaultPrevented);
    native.selection.clear();
    native.root.emit("drop", native.rows[0], 90, 70);
    native.doc.emit("mouseup", native.rows[0], 90, 70); await settle();
    assert.equal(native.commits.length, 1);
    assert.equal(native.commits[0].drag.photos.length, 4); native.dispose();

    const draft = fixture(() => false);
    draft.rows[0].setAttribute("data-library-event", "new-event");
    draft.root.emit("mousedown", draft.media[0], 250, 70); draft.advance(160);
    draft.doc.emit("mouseup", draft.rows[0], 90, 70); await settle();
    assert.equal(draft.commits[0].drag.photos.length, 4);
    assert.equal(draft.commits[0].target.id, "new-event");
    assert(!draft.ghost(), "naming releases the ghost without claiming a completed move");
    assert(!draft.rows[0].getAttribute("data-drag-over")); draft.dispose();

    // Quick clicks still select/preview normally. Hold lifts a bounded stack.
    const state = fixture();
    state.root.emit("mousedown", state.media[0], 250, 70); state.doc.emit("mouseup", state.media[0], 250, 70);
    assert(!state.root.emit("click", state.media[0]).defaultPrevented);
    assert(!state.ghost());
    state.root.emit("mousedown", state.media[0], 250, 70); state.advance(160);
    assert.equal(state.ghost().querySelectorAll(".library-drag-card").length, 3);
    assert.equal(state.retained.length, 3); assert.equal(state.pending.size, 1);
    const width = parseFloat(state.ghost().style.width); state.advance(70);
    assert(parseFloat(state.ghost().style.width) > width, "lift uses real intermediate frames");
    state.selection.clear(); // The drop must still include the original four photos.
    state.doc.emit("mousemove", state.media[0], 90, 120); state.advance(160);
    assert.equal(state.rows[1].getAttribute("data-drag-over"), "photos");
    assert(parseFloat(state.rows[1].style.left) < 0);
    state.doc.emit("mouseup", state.rows[1], 90, 120); await settle();
    assert.equal(state.commits.length, 1); assert.equal(state.commits[0].drag.photos.length, 4);
    assert.equal(state.rows[1].getAttribute("data-drag-over"), "added");
    state.advance(90); assert(parseFloat(state.ghost().style.opacity) < 1);
    state.advance(100); assert(!state.ghost()); assert.deepStrictEqual(state.released, state.retained);
    assert(!state.rows[1].getAttribute("data-drag-over")); assert.equal(state.pending.size, 0);
    assert(state.root.emit("click", state.media[0]).defaultPrevented, "drop click cannot collapse the selection");
    state.dispose(); assert.equal(state.doc.listeners.size, 0); assert.equal(state.root.listeners.size, 0);

    // Dragging an unselected frame carries only that photo; Escape/blur/outside cancel.
    for (const reason of ["Escape", "blur", "outside", "lost-mouseup", "disabled", "unmount"]) {
        const s = fixture(); s.selection.delete("3");
        s.root.emit("mousedown", s.media[3], 250, 70); s.doc.emit("mousemove", s.media[3], 270, 70);
        assert.equal(s.ghost().querySelectorAll(".library-drag-card").length, 1);
        if (reason === "Escape") s.doc.emit("keydown", s.media[3], 0, 0, { key: "Escape" });
        if (reason === "blur") s.host.emit("blur", s.media[3]);
        if (reason === "outside") s.doc.emit("mouseup", s.media[3], 500, 400);
        if (reason === "lost-mouseup") s.doc.emit("mousemove", s.media[3], 80, 70, { buttons: 0 });
        if (reason === "disabled") { s.disable(); s.doc.emit("mouseup", s.rows[0], 80, 70); }
        if (reason === "unmount") s.dispose();
        await settle(); assert(!s.ghost(), reason); assert.equal(s.commits.length, 0, reason);
        assert.deepStrictEqual(s.retained, s.released); assert.equal(s.pending.size, 0);
        if (reason !== "unmount") s.dispose();
    }

    // Real event operation: lower/upper row halves reorder; dropping on self is inert.
    for (const [y, order] of [[172, [1, 0, 2]], [208, [1, 2, 0]], [65, [0, 1, 2]]]) {
        let value = { items: [0, 1, 2].map(id => ({ chapterId: `chapter-${id + 1}`, name: String(id), photoKeys: [`p1-${String(id).padStart(16, "0")}`] })) };
        const s = fixture((drag, target) => {
            value = editEvent(value, target.mode, `chapter-${Number(drag.id.slice(6)) + 1}`, [], `chapter-${Number(target.id.slice(6)) + 1}`);
        });
        for (const row of s.rows) {
            row.style = new Proxy(row.style, {set(object, key, value) {
                assert(!["marginTop", "marginBottom", "height", "borderWidth"].includes(key), "hover must preserve sidebar layout and scroll extent");
                object[key] = value; return true;
            }});
        }
        s.root.emit("mousedown", s.rows[0].children[0]); s.advance(160);
        s.doc.emit("mousemove", s.rows[2], 80, y); s.advance(160);
        assert.strictEqual(s.ghost().querySelector(".library-drag-label").textContent, "Event 0", "reordering shows the event, not directional commentary");
        s.doc.emit("mouseup", s.rows[2], 80, y); await settle();
        assert.deepStrictEqual(value.items.map(item => Number(item.name)), order);
        s.dispose();
    }
    const failed = fixture(() => Promise.reject(new Error("Disk full")));
    failed.root.emit("mousedown", failed.media[0], 250, 70); failed.advance(160);
    failed.doc.emit("mouseup", failed.rows[0], 90, 70); await settle();
    assert.equal(failed.errors.length, 1); assert(!failed.ghost());
    assert(!failed.rows[0].getAttribute("data-drag-over")); failed.dispose();

    let finish;
    const saving = fixture(() => new Promise(resolve => { finish = resolve; }));
    saving.root.emit("mousedown", saving.media[0], 250, 70); saving.advance(160);
    saving.doc.emit("mouseup", saving.rows[0], 90, 70); await settle();
    saving.doc.emit("mouseup", saving.rows[0], 90, 70); assert.equal(saving.commits.length, 1);
    saving.dispose(); finish(); await settle(); assert(!saving.ghost()); assert.equal(saving.pending.size, 0);

    const scroll = fixture();
    scroll.root.emit("mousedown", scroll.media[0], 250, 70); scroll.advance(160);
    scroll.doc.emit("mousemove", scroll.sidebar, 80, 290); scroll.advance(64);
    assert(scroll.sidebar.scrollTop > 0); scroll.dispose();

    const disabled = fixture(); disabled.rows[0].setAttribute("data-drop-ready", "false");
    disabled.root.emit("mousedown", disabled.media[0], 250, 70); disabled.advance(160);
    disabled.doc.emit("mouseup", disabled.rows[0], 90, 70); await settle();
    assert.equal(disabled.commits.length, 0); disabled.dispose();

    const late = fixture();
    late.root.emit("mousedown", late.media[0], 250, 70, { buttons: undefined, button: undefined });
    late.doc.emit("mousemove", late.rows[0], 90, 70, { buttons: undefined });
    assert(late.ghost(), "hosts without button state still support movement");
    late.doc.emit("mouseup", late.rows[0], 90, 70); late.dispose(); await settle();
    assert.equal(late.commits.length, 0, "teardown before the save task prevents a stale write");
}
