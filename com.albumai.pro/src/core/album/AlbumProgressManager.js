import AlbumEventBus from "./AlbumEventBus";

export default class AlbumProgressManager {

    constructor({

        eventBus = new AlbumEventBus()

    } = {}) {

        this.eventBus = eventBus;

        this.reset();

    }

    reset() {

        this.progress = {

            stage: "idle",

            current: 0,

            total: 0,

            percent: 0,

            eta: null,

            startedAt: null,

            updatedAt: null,

            completed: false,

            cancelled: false

        };

    }

    start(total = 0, stage = "starting") {

        this.progress = {

            stage,

            current: 0,

            total,

            percent: 0,

            eta: null,

            startedAt: Date.now(),

            updatedAt: Date.now(),

            completed: false,

            cancelled: false

        };

        this.emit();

    }

    update(current, stage = null) {

        if (stage) {

            this.progress.stage = stage;

        }

        this.progress.current = current;

        this.progress.updatedAt = Date.now();

        this.progress.percent =

            this.progress.total > 0

                ? Math.min(

                    100,

                    Math.round(

                        (current /

                            this.progress.total) *

                            100

                    )

                )

                : 0;

        this.progress.eta =

            this.calculateETA();

        this.emit();

    }

    increment(step = 1) {

        this.update(

            this.progress.current + step

        );

    }

    complete() {

        this.progress.completed = true;

        this.progress.percent = 100;

        this.progress.stage = "completed";

        this.progress.updatedAt = Date.now();

        this.emit();

    }

    cancel() {

        this.progress.cancelled = true;

        this.progress.stage = "cancelled";

        this.progress.updatedAt = Date.now();

        this.emit();

    }

    calculateETA() {

        if (

            !this.progress.startedAt ||

            this.progress.current === 0

        ) {

            return null;

        }

        const elapsed =

            Date.now() -

            this.progress.startedAt;

        const average =

            elapsed /

            this.progress.current;

        const remaining =

            this.progress.total -

            this.progress.current;

        return Math.round(

            average * remaining

        );

    }

    getProgress() {

        return {

            ...this.progress

        };

    }

    emit() {

        this.eventBus.emit(

            "progress:update",

            this.getProgress()

        );

    }

}