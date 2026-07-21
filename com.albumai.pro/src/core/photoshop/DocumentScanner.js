import Logger from "./Logger";

export default class DocumentScanner {

    constructor() {

        this.reset();

    }

    reset() {

        this.model = {

            document: null,

            layers: [],

            groups: [],

            smartObjects: [],

            textLayers: [],

            artboards: [],

            hiddenLayers: [],

            lockedLayers: []

        };

    }

    async scan(document) {

        if (!document) {

            throw new Error(
                "Document is required."
            );

        }

        this.reset();

        this.model.document = {

            id: document.id,

            name: document.title,

            width: document.width,

            height: document.height,

            resolution: document.resolution

        };

        await this.scanLayers(

            document.layers,

            null

        );

        Logger.info(

            `Scanned ${this.model.layers.length} layers.`

        );

        return this.model;

    }

    async scanLayers(layers, parentId) {

        for (const layer of layers) {

            await this.scanLayer(

                layer,

                parentId

            );

        }

    }

    async scanLayer(layer, parentId) {

        const item = {

            id: layer.id,

            name: layer.name,

            parentId,

            visible: layer.visible,

            locked: layer.locked,

            opacity: layer.opacity,

            blendMode: layer.blendMode,

            kind: layer.kind,

            isGroup: !!layer.layers,

            children: []

        };

        this.model.layers.push(item);

        if (!layer.visible) {

            this.model.hiddenLayers.push(item);

        }

        if (layer.locked) {

            this.model.lockedLayers.push(item);

        }

        if (layer.kind === "smartObject") {

            this.model.smartObjects.push(item);

        }

        if (layer.kind === "textLayer") {

            this.model.textLayers.push(item);

        }

        if (layer.kind === "artboard") {

            this.model.artboards.push(item);

        }

        if (layer.layers) {

            this.model.groups.push(item);

            for (const child of layer.layers) {

                item.children.push(child.id);

                await this.scanLayer(

                    child,

                    layer.id

                );

            }

        }

    }

    getLayers() {

        return this.model.layers;

    }

    getGroups() {

        return this.model.groups;

    }

    getSmartObjects() {

        return this.model.smartObjects;

    }

    getTextLayers() {

        return this.model.textLayers;

    }

    getArtboards() {

        return this.model.artboards;

    }

    getHiddenLayers() {

        return this.model.hiddenLayers;

    }

    getLockedLayers() {

        return this.model.lockedLayers;

    }

}