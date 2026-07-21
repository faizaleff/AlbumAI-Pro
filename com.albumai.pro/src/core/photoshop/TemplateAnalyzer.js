import DocumentScanner from "./DocumentScanner";
import Logger from "./Logger";

export default class TemplateAnalyzer {

    constructor({

        scanner = new DocumentScanner()

    } = {}) {

        this.scanner = scanner;

    }

    async analyze(document) {

        const model = await this.scanner.scan(document);

        return {

            document: model.document,

            placeholders: this.findPhotoPlaceholders(model),

            textPlaceholders: this.findTextPlaceholders(model),

            smartObjects: model.smartObjects,

            sheets: this.findSheets(model),

            cover: this.findCover(model),

            statistics: this.statistics(model)

        };

    }

    findPhotoPlaceholders(model) {

        return model.smartObjects.map(layer => ({

            id: layer.id,

            name: layer.name,

            parentId: layer.parentId,

            type: "photo"

        }));

    }

    findTextPlaceholders(model) {

        const pattern = /\{(.*?)\}/g;

        const placeholders = [];

        for (const layer of model.textLayers) {

            const matches =

                layer.name.match(pattern);

            if (!matches) {

                continue;

            }

            placeholders.push({

                id: layer.id,

                name: layer.name,

                tokens: matches.map(token =>

                    token.replace(/[{}]/g, "")

                )

            });

        }

        return placeholders;

    }

    findSheets(model) {

        return model.groups.filter(group =>

            /^sheet/i.test(group.name)

        );

    }

    findCover(model) {

        return model.groups.find(group =>

            /cover/i.test(group.name)

        ) || null;

    }

    statistics(model) {

        return {

            layers: model.layers.length,

            groups: model.groups.length,

            smartObjects:

                model.smartObjects.length,

            textLayers:

                model.textLayers.length,

            hidden:

                model.hiddenLayers.length,

            locked:

                model.lockedLayers.length

        };

    }

}