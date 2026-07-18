class PSDTemplate {

    constructor(data = {}) {

        this.id = data.id || "";

        this.name = data.name || "";

        this.category = data.category || "Wedding";

        this.size = data.size || {

            width: 0,

            height: 0,

            dpi: 300

        };

        this.bleed = data.bleed || 3;

        this.safeArea = data.safeArea || 10;

        this.background = data.background || null;

        this.layouts = data.layouts || [];

    }

    addLayout(layout) {

        this.layouts.push(layout);

    }

    removeLayout(layoutId) {

        this.layouts = this.layouts.filter(

            layout => layout.id !== layoutId

        );

    }

    getLayout(layoutId) {

        return this.layouts.find(

            layout => layout.id === layoutId

        );

    }

    getLayoutCount() {

        return this.layouts.length;

    }

    validate() {

        if (!this.name)
            return false;

        if (!this.size.width)
            return false;

        if (!this.size.height)
            return false;

        if (!Array.isArray(this.layouts))
            return false;

        return true;

    }

    clone() {

        return new PSDTemplate(

            JSON.parse(JSON.stringify(this))

        );

    }

    toJSON() {

        return {

            id: this.id,

            name: this.name,

            category: this.category,

            size: this.size,

            bleed: this.bleed,

            safeArea: this.safeArea,

            background: this.background,

            layouts: this.layouts

        };

    }

    static fromJSON(data) {

        return new PSDTemplate(data);

    }

}

export default PSDTemplate;