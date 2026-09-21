// Observe native scrolling solely to style its thumb. Never consume a gesture,
// change overflow, write scrollTop or replace the host's scrollbars.
export function bindLibraryScrollbarVisibility(root, {later = setTimeout, cancel = clearTimeout} = {}) {
    const pending = new Map();
    const reveal = event => {
        const node = event.target.closest?.(".photo-library-sidebar, .photo-browser-viewport, .photo-library-inspector");
        if (!node || !root.contains(node)) return;
        node.classList.add("is-scroll-active");
        cancel(pending.get(node));
        pending.set(node, later(() => {
            node.classList.remove("is-scroll-active"); pending.delete(node);
        }, 500));
    };
    root.addEventListener("scroll", reveal, true);
    root.addEventListener("wheel", reveal, {capture:true, passive:true});
    return () => {
        root.removeEventListener("scroll", reveal, true);
        root.removeEventListener("wheel", reveal, true);
        pending.forEach((timer, node) => {cancel(timer); node.classList.remove("is-scroll-active");});
        pending.clear();
    };
}
