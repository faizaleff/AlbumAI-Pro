import Logger from "../photoshop/Logger";

export default class AlbumWorkflowHistory {

    constructor(limit = 1000) {

        this.limit = limit;

        this.records = [];

    }

    add(record = {}) {

        const entry = {

            id: crypto.randomUUID(),

            timestamp: new Date(),

            ...record

        };

        this.records.unshift(entry);

        if (

            this.records.length > this.limit

        ) {

            this.records.length = this.limit;

        }

        Logger.info(

            `Workflow history recorded: ${entry.id}`

        );

        return entry;

    }

    all() {

        return [...this.records];

    }

    latest() {

        return this.records[0] || null;

    }

    find(id) {

        return (

            this.records.find(

                record => record.id === id

            ) || null

        );

    }

    filter(callback) {

        return this.records.filter(callback);

    }

    remove(id) {

        const index = this.records.findIndex(

            record => record.id === id

        );

        if (index === -1) {

            return false;

        }

        this.records.splice(index, 1);

        return true;

    }

    clear() {

        this.records = [];

        Logger.info(

            "Workflow history cleared."

        );

    }

    size() {

        return this.records.length;

    }

    isEmpty() {

        return this.records.length === 0;

    }

    export() {

        return [...this.records];

    }

}