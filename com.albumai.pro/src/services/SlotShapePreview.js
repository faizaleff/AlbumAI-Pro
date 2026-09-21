import { previewPixelBlob } from "../utils/PreviewPixels";

// Imaging may trim a layer or choose a pyramid level. Sample in document
// coordinates rather than stretching the trimmed alpha across the whole slot.
export function samplePreviewPixel(image, bytes, x, y, fallback = 0, channel = 0) {
    const b = image.sourceBounds, scale = 2 ** (image.level || 0);
    const px = x / scale, py = y / scale;
    if (!b || px < b.left || py < b.top || px >= b.right || py >= b.bottom) return fallback;
    const data = image.imageData;
    const ix = Math.min(data.width - 1, Math.floor((px - b.left) * data.width / (b.right - b.left)));
    const iy = Math.min(data.height - 1, Math.floor((py - b.top) * data.height / (b.bottom - b.top)));
    return bytes[(iy * data.width + ix) * data.components + channel];
}

export function slotShapeCover(mask, maskBytes, background, backgroundBytes, bounds, width, height, alphaChannel, foreground = []) {
    const rgba = new Uint8Array(width * height * 4);
    let shaped = false;
    for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
        const dx = bounds.left + (x + .5) * (bounds.right - bounds.left) / width;
        const dy = bounds.top + (y + .5) * (bounds.bottom - bounds.top) / height;
        const alpha = samplePreviewPixel(mask, maskBytes, dx, dy, 0, alphaChannel);
        if (alpha < 255) shaped = true;
        const offset = (y * width + x) * 4;
        const front = [0, 0, 0]; let frontAlpha = 0;
        // Bottom-to-top, with premultiplied colour; preserve text/decorations
        // above the photo instead of painting a rectangular draft over them.
        for (const item of foreground) {
            const a = item.image.imageData.components === 4
                ? samplePreviewPixel(item.image, item.bytes, dx, dy, 0, 3) / 255
                : (samplePreviewPixel(item.image, item.bytes, dx, dy, -1, 0) >= 0 ? 1 : 0);
            for (let c = 0; c < 3; c++) front[c] = samplePreviewPixel(item.image, item.bytes, dx, dy, 0, c) * a + front[c] * (1 - a);
            frontAlpha = a + frontAlpha * (1 - a);
        }
        const maskAlpha = alpha / 255, coverAlpha = 1 - maskAlpha + maskAlpha * frontAlpha;
        for (let c = 0; c < 3; c++) rgba[offset + c] = coverAlpha ? Math.round(
            (samplePreviewPixel(background, backgroundBytes, dx, dy, 255, c) * (1 - maskAlpha) + maskAlpha * front[c]) / coverAlpha) : 0;
        rgba[offset + 3] = Math.round(255 * coverAlpha);
        if (frontAlpha) shaped = true;
    }
    return shaped ? rgba : null;
}

// This fixed cover restores the background outside the brush, including its
// fractional edge. Moving/zooming the photo underneath requires no Photoshop job.
export async function captureSlotShape(api, actions, doc, step, cancelled) {
    let mask, background, layer; const foreground = [];
    const find = layers => {
        for (const item of layers || []) {
            if (item.id === step.slotLayerId) return item;
            const nested = find(item.layers); if (nested) return nested;
        }
    };
    layer = find(doc.layers);
    if (!layer || !step.slotBounds) return null;
    const bounds = step.slotBounds;
    const width = Math.max(1, Math.min(700, Math.round(bounds.right - bounds.left)));
    const height = Math.max(1, Math.round(width * (bounds.bottom - bounds.top) / (bounds.right - bounds.left)));
    const options = {documentID: doc.id, layerID: layer.id, sourceBounds: bounds, targetSize: {width}};
    try {
        const [descriptor] = await actions.batchPlay([{_obj: "get", _target: [{_ref: "layer", _id: layer.id}, {_ref: "document", _id: doc.id}]}], {});
        let alphaChannel = 0;
        if (descriptor?.hasUserMask) {
            mask = await api.getLayerMask({...options, kind: "user"});
        } else {
            mask = await api.getPixels({...options, colorSpace: "RGB", componentSize: 8, applyAlpha: false});
            if (mask.imageData.components !== 4) return null;
            alphaChannel = 3;
        }
        const maskBytes = await mask.imageData.getData({chunky: true});
        // An opaque rectangle needs no cover, avoiding additional composite reads.
        let transparent = false;
        for (let i = alphaChannel; i < maskBytes.length; i += mask.imageData.components) if (maskBytes[i] < 255) { transparent = true; break; }
        const mb = mask.sourceBounds, scale = 2 ** (mask.level || 0);
        const above = [];
        const collect = layers => {
            for (const item of layers || []) {
                if (item.id === layer.id) return true;
                if (item.layers?.length) { if (collect(item.layers)) return true; }
                else if (item.visible) above.push(item);
            }
            return false;
        };
        collect(doc.layers);
        if (!transparent && !above.length && mb && mb.left * scale <= bounds.left && mb.top * scale <= bounds.top && mb.right * scale >= bounds.right && mb.bottom * scale >= bounds.bottom) return null;
        for (const item of above.reverse()) {
            const b = item.bounds;
            if (b && (Number(b.right) <= bounds.left || Number(b.left) >= bounds.right || Number(b.bottom) <= bounds.top || Number(b.top) >= bounds.bottom)) continue;
            const image = await api.getPixels({...options, layerID: item.id, colorSpace: "RGB", colorProfile: "sRGB IEC61966-2.1", componentSize: 8, applyAlpha: false});
            const entry = {image}; foreground.push(entry);
            entry.bytes = await image.imageData.getData({chunky: true});
        }
        if (cancelled()) throw new Error("Preview interrupted");
        const fillOpacity = layer.fillOpacity;
        const visible = layer.visible;
        // Fill hides the photo but keeps its drop shadow and other layer effects.
        const useFill = Number.isFinite(fillOpacity);
        if (useFill) layer.fillOpacity = 0; else layer.visible = false;
        try {
            background = await api.getPixels({documentID: doc.id, sourceBounds: bounds, targetSize: {width}, colorSpace: "RGB", colorProfile: "sRGB IEC61966-2.1", componentSize: 8, applyAlpha: true});
        } finally { if (useFill) layer.fillOpacity = fillOpacity; else layer.visible = visible; }
        const data = slotShapeCover(mask, maskBytes, background, await background.imageData.getData({chunky: true}), bounds, width, height, alphaChannel, foreground);
        if (!data) return null;
        const blob = await previewPixelBlob(data, width, height, () => { if (cancelled()) throw new Error("Preview interrupted"); });
        return URL.createObjectURL(blob);
    } finally {
        mask?.imageData?.dispose(); background?.imageData?.dispose();
        foreground.forEach(item => item.image.imageData.dispose());
    }
}
