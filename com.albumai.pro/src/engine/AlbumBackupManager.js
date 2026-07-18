class AlbumBackupManager {

    constructor() {

        this.backups = [];

        this.maxBackups = 50;

    }

    create(project, name = null) {

        if (!project)
            throw new Error("Project is required.");

        const backup = {

            id: crypto.randomUUID(),

            name: name || `Backup ${this.backups.length + 1}`,

            created: new Date(),

            size: JSON.stringify(project).length,

            project: structuredClone(project)

        };

        this.backups.push(backup);

        if (this.backups.length > this.maxBackups)
            this.backups.shift();

        return backup;

    }

    restore(id) {

        const backup = this.get(id);

        if (!backup)
            return null;

        return structuredClone(backup.project);

    }

    latest() {

        if (!this.backups.length)
            return null;

        return structuredClone(

            this.backups[
                this.backups.length - 1
            ].project

        );

    }

    get(id) {

        return this.backups.find(

            backup => backup.id === id

        ) || null;

    }

    list() {

        return this.backups.map(backup => ({

            id: backup.id,

            name: backup.name,

            created: backup.created,

            size: backup.size

        }));

    }

    rename(id, name) {

        const backup = this.get(id);

        if (!backup)
            return false;

        backup.name = name;

        return true;

    }

    delete(id) {

        this.backups = this.backups.filter(

            backup => backup.id !== id

        );

    }

    clear() {

        this.backups = [];

    }

    count() {

        return this.backups.length;

    }

    exists(id) {

        return this.get(id) !== null;

    }

    export(id) {

        const backup = this.get(id);

        if (!backup)
            return null;

        return JSON.stringify(

            backup.project,

            null,

            2

        );

    }

    import(data, name = "Imported Backup") {

        const project =

            typeof data === "string"

                ? JSON.parse(data)

                : structuredClone(data);

        return this.create(project, name);

    }

}

export default new AlbumBackupManager();