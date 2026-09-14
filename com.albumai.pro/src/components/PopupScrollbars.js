const reviewScrollSizes = new WeakMap();
export function libraryScrollSize(node, dimension) {
    return reviewScrollSizes.get(node)?.[dimension] ?? node?.[dimension] ?? 0;
}

// Some UXP focus paths ignore preventScroll. Preserve the Library's existing
// positions around focus without changing overflow, scrollbar widths or layout.
export function focusWithoutMovingLibrary(target, root = typeof document === "undefined" ? null : document.body) {
    if (!target) return;
    const nodes = root ? [root, ...Array.from(root.querySelectorAll(
        ".photo-library-sidebar, .photo-library-inspector, .photo-browser-viewport, .photo-list-metadata-scroll, .photo-list-header-scroll"
    ))] : [];
    const positions = nodes.map(node => ({node, top:node.scrollTop, left:node.scrollLeft}));
    target.focus?.({preventScroll:true});
    positions.forEach(({node, top, left}) => {
        if (node.scrollTop !== top) node.scrollTop = top;
        if (node.scrollLeft !== left) node.scrollLeft = left;
    });
}

// Native UXP scrollbars can repaint over a DOM portal after a button click.
// Suspend their scroll surfaces for the entire review session, compensating for
// the removed gutters so the virtual grid keeps exactly the same content width.
// Restore overflow before positions on close; never repeat this on Next/zoom.
export function suspendLibraryReviewScrollbars(root = document.body) {
    const nodes = Array.from(root.querySelectorAll(
        ".photo-library-sidebar, .photo-library-inspector, .photo-browser-viewport, .photo-list-metadata-scroller"
    ));
    const saved = nodes.map(node => {
        const style = node.style;
        const computed = typeof getComputedStyle === "function" ? getComputedStyle(node) : style;
        const snapshot = {node, top:node.scrollTop, left:node.scrollLeft,
            overflowX:style.overflowX, overflowY:style.overflowY,
            paddingRight:style.paddingRight, paddingBottom:style.paddingBottom};
        const width = node.clientWidth, height = node.clientHeight;
        reviewScrollSizes.set(node, {clientWidth: width, clientHeight: height});
        style.overflowX = "hidden"; style.overflowY = "hidden";
        const right = Math.max(0, node.clientWidth - width);
        const bottom = Math.max(0, node.clientHeight - height);
        if (right) style.paddingRight = `${(parseFloat(computed.paddingRight) || 0) + right}px`;
        if (bottom) style.paddingBottom = `${(parseFloat(computed.paddingBottom) || 0) + bottom}px`;
        node.scrollTop = snapshot.top; node.scrollLeft = snapshot.left;
        return snapshot;
    });
    let released = false;
    return () => {
        if (released) return;
        released = true;
        saved.forEach(({node, overflowX, overflowY, paddingRight, paddingBottom}) => {
            reviewScrollSizes.delete(node);
            Object.assign(node.style, {overflowX, overflowY, paddingRight, paddingBottom});
        });
        saved.forEach(({node, top, left}) => {node.scrollTop = top; node.scrollLeft = left;});
    };
}
