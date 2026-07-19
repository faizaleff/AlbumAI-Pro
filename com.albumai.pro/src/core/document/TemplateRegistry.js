// src/core/document/TemplateRegistry.js

class TemplateRegistry {

    constructor() {
        this.templates = new Map();
        this.activeTemplateId = null;
    }

    /**
     * Register a template.
     * @param {Object} template
     */
    register(template) {

        if (!template)
            throw new Error("Template is required.");

        if (template.id === undefined || template.id === null)
            throw new Error("Template must have an id.");

        this.templates.set(template.id, template);

        if (!this.activeTemplateId)
            this.activeTemplateId = template.id;

        return template;

    }

    /**
     * Update an existing template.
     */
    update(id, updates = {}) {

        const template = this.get(id);

        if (!template)
            return null;

        Object.assign(template, updates);

        return template;

    }

    /**
     * Remove template.
     */
    unregister(id) {

        if (!this.templates.has(id))
            return false;

        this.templates.delete(id);

        if (this.activeTemplateId === id) {

            const first = this.all()[0];

            this.activeTemplateId =
                first ? first.id : null;

        }

        return true;

    }

    /**
     * Get template.
     */
    get(id) {

        return this.templates.get(id) || null;

    }

    /**
     * Get template by name.
     */
    byName(name) {

        return this.all().find(
            t => t.name === name
        ) || null;

    }

    /**
     * Get all templates.
     */
    all() {

        return [...this.templates.values()];

    }

    /**
     * Template count.
     */
    count() {

        return this.templates.size;

    }

    /**
     * Check if registered.
     */
    has(id) {

        return this.templates.has(id);

    }

    /**
     * Active template.
     */
    active() {

        return this.get(this.activeTemplateId);

    }

    /**
     * Set active template.
     */
    setActive(id) {

        if (!this.has(id))
            throw new Error(
                "Template not registered."
            );

        this.activeTemplateId = id;

        return this.active();

    }

    /**
     * Clear registry.
     */
    clear() {

        this.templates.clear();
        this.activeTemplateId = null;

    }

}

export default new TemplateRegistry();