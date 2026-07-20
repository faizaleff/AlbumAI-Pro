import Logger from "../core/photoshop/Logger";

export default class AlbumTemplateService {

    constructor({

        templateRegistry,

        templateCacheService,

        templateService

    }) {

        this.templateRegistry =
            templateRegistry;

        this.templateCacheService =
            templateCacheService;

        this.templateService =
            templateService;

    }

    async load(template) {

        const id =
            template.id ??
            template.name;

        if (

            this.templateCacheService.has(id)

        ) {

            Logger.info(

                `Template Loaded From Cache : ${id}`

            );

            return this.templateCacheService.get(id);

        }

        const document =
            await this.templateService.load(
                template.file ?? template
            );

        this.templateCacheService.add(

            id,

            document

        );

        this.templateRegistry.register({

            ...template,

            id

        });

        return document;

    }

    async unload(id, save = false) {

        const document =
            this.templateCacheService.get(id);

        if (document) {

            await this.templateService.close(

                document,

                save

            );

        }

        this.templateCacheService.remove(id);

        this.templateRegistry.unregister(id);

    }

    get(id) {

        return this.templateCacheService.get(id);

    }

    getTemplates() {

        return this.templateRegistry.getAll();

    }

    clear() {

        this.templateCacheService.clear();

        this.templateRegistry.clear();

    }

}