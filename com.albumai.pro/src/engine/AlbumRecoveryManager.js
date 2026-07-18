class AlbumRecoveryManager {

    constructor() {

        this.snapshots = [];

        this.maxSnapshots = 20;

    }

    create(project) {

        if (!project)
            throw new Error("Project is required.");

        const snapshot = {

            id: crypto.randomUUID(),

            timestamp: new Date(),

            project: structuredClone(project)

        };

        this.snapshots.push(snapshot);

        if (this.snapshots.length > this.maxSnapshots)
            this.snapshots.shift();

        return snapshot;

    }

    recover(id) {

        const snapshot = this.snapshots.find(

            item => item.id === id

        );

        if (!snapshot)
            return null;

        return structuredClone(snapshot.project);

    }

    latest() {

        if (!this.snapshots.length)
            return null;

        return structuredClone(

            this.snapshots[
                this.snapshots.length - 1
            ].project

        );

    }

    list() {

        return this.snapshots.map(item => ({

            id: item.id,

            timestamp: item.timestamp

        }));

    }

    remove(id) {

        this.snapshots = this.snapshots.filter(

            item => item.id !== id

        );

    }

    clear() {

        this.snapshots = [];

    }

    hasRecovery() {

        return this.snapshots.length > 0;

    }

    count() {

        return this.snapshots.length;

    }

    prune(maxAgeHours = 24) {

        const cutoff =
            Date.now() -
            maxAgeHours * 60 * 60 * 1000;

        this.snapshots = this.snapshots.filter(

            item =>

                item.timestamp.getTime() >= cutoff

        );

    }

}

export default new AlbumRecoveryManager();