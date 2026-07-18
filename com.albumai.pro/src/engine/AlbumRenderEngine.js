import LayoutEngine from "../layout/LayoutEngine";
import LayoutOptimizer from "../layout/LayoutOptimizer";
import PSDExporter from "../album/PSDExporter";

class AlbumRenderEngine {

    async render(album) {

        if (!album)
            throw new Error("Album is required.");

        const pages = [];

        for (const page of album.pages) {

            const rendered =
                await this.renderPage(page);

            pages.push(rendered);

        }

        return {

            ...album,

            pages

        };

    }

    async renderPage(page) {

        if (!page)
            throw new Error("Page is required.");

        const rendered = structuredClone(page);

        LayoutOptimizer.optimize(rendered);

        return rendered;

    }

    async renderTemplate(layout, photos) {

        const page = LayoutEngine.create(

            layout,

            photos

        );

        return this.renderPage(page);

    }

    async renderAlbum(album) {

        const rendered =

            await this.render(album);

        await PSDExporter.export(rendered);

        return rendered;

    }

    async preview(layout, photos = []) {

        const page =

            await this.renderTemplate(

                layout,

                photos

            );

        return {

            width: page.width,

            height: page.height,

            slots: page.slots,

            photoCount: page.slots.filter(

                s => s.photo

            ).length

        };

    }

    validate(album) {

        if (!album)
            return false;

        if (!album.pages)
            return false;

        return album.pages.every(

            page =>

                page.slots.every(

                    slot => slot.photo

                )

        );

    }

}

export default new AlbumRenderEngine();