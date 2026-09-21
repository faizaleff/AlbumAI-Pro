// A review session keeps its order even when a rating/reject changes a filter.
export function reviewZoomStep(scale, delta) {
    return Math.max(0.25, Math.min(4, scale + delta));
}

export function reviewPointer(event, rect) {
    return {
        x: (event.clientX ?? rect.left + rect.width / 2) - rect.left - rect.width / 2,
        y: (event.clientY ?? rect.top + rect.height / 2) - rect.top - rect.height / 2
    };
}

export function previewPanelSize(width, height) {
    return { width: Math.max(1, Math.min(1120, (width || 1160) - 48)),
        height: Math.max(1, Math.min(720, (height || 768) - 48)) };
}

export function previewSessionPhotos(visiblePhotos, selectedIds) {
    return selectedIds.size > 1
        ? visiblePhotos.filter(photo => selectedIds.has(photo.id))
        : visiblePhotos.slice();
}

export function previewGeometry(photo, stageWidth, stageHeight) {
    const width = Number(photo?.width) || 1920;
    const height = Number(photo?.height) || 1080;
    const fit = Math.min(1, Math.max(1, stageWidth) / width,
        Math.max(1, stageHeight) / height);
    return { width: width * fit, height: height * fit,
        fit, minScale: Math.min(1, 0.25 / fit), maxScale: 1 / fit, nativeEdge: Math.max(width, height) };
}

export function previewClickScale(step, geometry) {
    return [0.25 / geometry.fit, 0.5 / geometry.fit, geometry.maxScale, 1][step % 4];
}

// Anchor coordinates are relative to the center of the fixed viewport.
export function zoomPreviewAt(state, next, anchor = { x: 0, y: 0 }, base = state) {
    const scale = Math.max(state.geometry.minScale, Math.min(state.geometry.maxScale, next));
    const ratio = scale / base.scale;
    return { scale, offset: clampPreviewPan({
        x: anchor.x - (anchor.x - base.offset.x) * ratio,
        y: anchor.y - (anchor.y - base.offset.y) * ratio
    }, state.geometry, scale, state.stage) };
}

export function createPreviewGate() {
    let busy = false;
    return {
        isActive: () => busy,
        acquire() {
            if (busy) return false;
            busy = true;
            return true;
        },
        release() { busy = false; }
    };
}
export const reviewPreviewGate = createPreviewGate();

// A wheel stream includes trackpad inertia. Latch navigation until it ends.
export function createPreviewWheel() {
    let last = -Infinity, x = 0, y = 0, used = false;
    return (event, state, anchor, now = Date.now()) => {
        if (now - last > 250) { x = 0; y = 0; used = false; }
        last = now;
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? state.stage.height : 1;
        const dx = (event.deltaX || 0) * unit, dy = (event.deltaY || 0) * unit;
        if (event.ctrlKey || event.metaKey) {
            used = true;
            return zoomPreviewAt(state, state.scale * Math.exp(-dy / 240), anchor);
        }
        if (state.scale > 1.001) {
            used = true;
            return { scale: state.scale, offset: clampPreviewPan({
                x: state.offset.x + dx, y: state.offset.y - dy
            }, state.geometry, state.scale, state.stage) };
        }
        if (Math.abs(state.scale - 1) > 0.001) return null;
        x += dx; y += dy;
        if (!used && Math.abs(x) >= 70 && Math.abs(x) > Math.abs(y) * 1.8) {
            used = true;
            return { navigate: Math.sign(x) };
        }
        return null;
    };
}

export function previewResolution(geometry, scale, density = 1) {
    const required = Math.ceil(Math.max(geometry.width, geometry.height) * scale * Math.min(2, Math.max(1, density)));
    // HD first; intermediate levels avoid rendering the original until needed.
    const level = [1536, 3072, 6144, 12288].find(edge => edge >= required);
    if (required >= geometry.nativeEdge) return geometry.nativeEdge;
    // Do not round an intermediate zoom up to the full-size original.
    return Math.min(geometry.nativeEdge,
        level < geometry.nativeEdge ? level : Math.max(1536, required));
}

export function clampPreviewPan(offset, geometry, scale, stage) {
    const x = Math.max(0, (geometry.width * scale - stage.width) / 2);
    const y = Math.max(0, (geometry.height * scale - stage.height) / 2);
    return { x: Math.max(-x, Math.min(x, offset.x)) || 0,
        y: Math.max(-y, Math.min(y, offset.y)) || 0 };
}

export function dragPreviewScale(start, dx, dy, maximum, minimum = 1) {
    return Math.max(minimum, Math.min(maximum, start * Math.exp((dx - dy) / 240)));
}

export function previewImagePlacement(geometry, scale, offset, stage) {
    const boundedScale = Math.max(geometry.minScale, Math.min(geometry.maxScale, scale));
    const pan = clampPreviewPan(offset, geometry, boundedScale, stage);
    const width = geometry.width * boundedScale;
    const height = geometry.height * boundedScale;
    return { width, height, left: (stage.width - width) / 2 + pan.x,
        top: (stage.height - height) / 2 + pan.y };
}

export function previewFilmstripWindow(count, index, width, scroll) {
    const capacity = Math.max(1, Math.floor(width / 70));
    if (scroll != null) {
        const offset = Math.max(0, Math.min(Math.max(0, count * 70 - width), scroll));
        const start = Math.floor(offset / 70);
        return { start, end: Math.min(count, start + Math.ceil(width / 70) + 1),
            offset, left: start * 70 - offset };
    }
    const start = Math.floor(index / capacity) * capacity;
    return { start, end: Math.min(count, start + capacity), capacity };
}
