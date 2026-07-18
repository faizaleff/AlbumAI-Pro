class AlbumSaveManager {

    async save(project) {

        if (!project)
            throw new Error("Project is required.");

        const data = this.serialize(project);

        project.markSaved?.();

        return data;

    }

    async load(data) {

        if (!data)
            throw new Error("Project data is required.");

        return this.deserialize(data);

    }

    async autosave(project) {

        return this.save(project);

    }

    serialize(project) {

        if (typeof project.toJSON === "function")
            return JSON.stringify(project.toJSON(), null, 2);

        return JSON.stringify(project, null, 2);

    }

    deserialize(data) {

        return typeof data === "string"
            ? JSON.parse(data)
            : structuredClone(data);

    }

    export(project) {

        return this.serialize(project);

    }

    import(data) {

        return this.deserialize(data);

    }

    backup(project) {

        return {

            timestamp: new Date(),

            data: this.serialize(project)

        };

    }

    restore(backup) {

        if (!backup?.data)
            throw new Error("Invalid backup.");

        return this.deserialize(backup.data);

    }

    validate(data) {

        try {

            const project = this.deserialize(data);

            return !!project;

        }

        catch {

            return false;

        }

    }

}

export default new AlbumSaveManager();