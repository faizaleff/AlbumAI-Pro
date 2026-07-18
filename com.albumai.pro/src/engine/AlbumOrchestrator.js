import AlbumPipeline from "./AlbumPipeline";
import AlbumPerformanceMonitor from "./AlbumPerformanceMonitor";
import AlbumEventBus from "./AlbumEventBus";

class AlbumOrchestrator {

    constructor() {

        this.pipeline = new AlbumPipeline();

        this.monitor = new AlbumPerformanceMonitor();

        this.events = AlbumEventBus;

    }

    use(name, handler) {

        this.pipeline.use(name, handler);

        return this;

    }

    async run(context = {}) {

        this.events.emit("orchestrator:start", context);

        this.monitor.start("pipeline");

        try {

            const result =
                await this.pipeline.execute(context);

            this.monitor.end("pipeline");

            this.events.emit(
                "orchestrator:success",
                result
            );

            return result;

        }

        catch (error) {

            this.monitor.end("pipeline");

            this.events.emit(
                "orchestrator:error",
                error
            );

            throw error;

        }

    }

    async runStep(name, context = {}) {

        this.events.emit(
            "step:start",
            name
        );

        this.monitor.start(name);

        try {

            const result =
                await this.pipeline.executeStep(
                    name,
                    context
                );

            this.monitor.end(name);

            this.events.emit(
                "step:success",
                name,
                result
            );

            return result;

        }

        catch (error) {

            this.monitor.end(name);

            this.events.emit(
                "step:error",
                name,
                error
            );

            throw error;

        }

    }

    reset() {

        this.pipeline.clear();

        this.monitor.reset();

    }

    statistics() {

        return {

            pipeline: this.pipeline.list(),

            performance: this.monitor.summary()

        };

    }

}

export default new AlbumOrchestrator();