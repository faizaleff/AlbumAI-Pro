class AlbumHistoryManager {

    constructor(limit = 200) {

        this.limit = limit;

        this.history = [];

        this.position = -1;

    }

    save(state) {

        if (!state)
            return;

        if (this.position < this.history.length - 1) {

            this.history = this.history.slice(
                0,
                this.position + 1
            );

        }

        this.history.push(this.clone(state));

        if (this.history.length > this.limit) {

            this.history.shift();

        } else {

            this.position++;

        }

    }

    undo() {

        if (!this.canUndo())
            return null;

        this.position--;

        return this.clone(

            this.history[this.position]

        );

    }

    redo() {

        if (!this.canRedo())
            return null;

        this.position++;

        return this.clone(

            this.history[this.position]

        );

    }

    current() {

        if (this.position < 0)
            return null;

        return this.clone(

            this.history[this.position]

        );

    }

    first() {

        if (!this.history.length)
            return null;

        return this.clone(

            this.history[0]

        );

    }

    last() {

        if (!this.history.length)
            return null;

        return this.clone(

            this.history[
                this.history.length - 1
            ]

        );

    }

    canUndo() {

        return this.position > 0;

    }

    canRedo() {

        return this.position < this.history.length - 1;

    }

    clear() {

        this.history = [];

        this.position = -1;

    }

    size() {

        return this.history.length;

    }

    clone(state) {

        return structuredClone(state);

    }

}

export default new AlbumHistoryManager();