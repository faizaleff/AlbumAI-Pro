/**
 * Minimal Buffer surface required by jpeg-js in AlbumAI's browser/UXP build.
 * The renderer always decodes to typed arrays and publishes encoded bytes to a
 * Blob, so a Node Buffer polyfill is unnecessary in the production bundle.
 */
export const Buffer = Object.freeze({
    alloc(size) {
        return new Uint8Array(size);
    },

    from(value) {
        if (value instanceof ArrayBuffer) {
            return new Uint8Array(value.slice(0));
        }

        if (ArrayBuffer.isView(value)) {
            return new Uint8Array(
                value.buffer.slice(
                    value.byteOffset,
                    value.byteOffset + value.byteLength
                )
            );
        }

        return new Uint8Array(value);
    }
});
