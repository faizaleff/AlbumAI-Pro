class LayoutSerializer {

    serialize(layout) {

        if (!layout)
            throw new Error("Layout is required.");

        return JSON.stringify(layout, null, 2);

    }

    deserialize(data) {

        if (!data)
            throw new Error("Layout data is required.");

        return typeof data === "string"
            ? JSON.parse(data)
            : structuredClone(data);

    }

    clone(layout) {

        return this.deserialize(this.serialize(layout));

    }

    export(layout) {

        return this.serialize(layout);

    }

    import(data) {

        return this.deserialize(data);

    }

    exportCollection(layouts = []) {

        return JSON.stringify(layouts, null, 2);

    }

    importCollection(data) {

        const collection =
            typeof data === "string"
                ? JSON.parse(data)
                : data;

        if (!Array.isArray(collection))
            throw new Error("Invalid layout collection.");

        return collection;
    }

    compress(layout) {

        return JSON.stringify(layout);

    }

    decompress(data) {

        return JSON.parse(data);

    }

}

export default new LayoutSerializer();