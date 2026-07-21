import Logger from "../photoshop/Logger";
import FileSystemService from "../files/FileSystemService";

export default class AlbumRecoveryManager {

    constructor({

        fileSystem = new FileSystemService()

    } = {}) {

        this.fileSystem = fileSystem;

        this.recovery = null;

    }

    create(session) {

        this.recovery = {

            id: crypto.randomUUID(),

            timestamp: new Date().toISOString(),

            session,

            status: "created"

        };

        return this.recovery;

    }

    async save(folder) {

        if (!this.recovery) {

            throw new Error(
                "Recovery data not found."
            );

        }

        try {

            const file = await this.fileSystem.createFile(

                folder,

                "album.recovery.json"

            );

            await file.write(

                JSON.stringify(

                    this.recovery,

                    null,

                    2

                )

            );

            Logger.info(
                "Recovery checkpoint saved."
            );

            return file;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async load(file) {

        try {

            const content = await file.read();

            this.recovery = JSON.parse(content);

            return this.recovery;

        }

        catch (error) {

            Logger.error(error);

            throw error;

        }

    }

    async restore(file) {

        const recovery = await this.load(file);

        recovery.status = "restored";

        recovery.restoredAt =

            new Date().toISOString();

        return recovery;

    }

    clear() {

        this.recovery = null;

    }

    hasRecovery() {

        return this.recovery !== null;

    }

    getRecovery() {

        return this.recovery;

    }

    update(values = {}) {

        if (!this.recovery) {

            throw new Error(
                "Recovery data not found."
            );

        }

        Object.assign(

            this.recovery,

            values,

            {

                updatedAt:
                    new Date().toISOString()

            }

        );

        return this.recovery;

    }

    markCompleted() {

        if (!this.recovery) {

            return;

        }

        this.recovery.status = "completed";

        this.recovery.completedAt =

            new Date().toISOString();

    }

}