import AlbumEventBus from "./AlbumEventBus";
import AlbumCommandManager from "./AlbumCommandManager";
import AlbumPluginManager from "./AlbumPluginManager";
import AlbumStateManager from "./AlbumStateManager";
import AlbumCacheManager from "./AlbumCacheManager";
import AlbumMemoryManager from "./AlbumMemoryManager";
import AlbumPerformanceMonitor from "./AlbumPerformanceMonitor";
import AlbumTaskScheduler from "./AlbumTaskScheduler";
import AlbumWorkerPool from "./AlbumWorkerPool";
import AlbumOrchestrator from "./AlbumOrchestrator";

class AlbumBootstrap {

    constructor() {

        this.initialized = false;

    }

    async initialize() {

        if (this.initialized)
            return;

        await AlbumWorkerPool.start();

        AlbumEventBus.emit("album:init");

        this.initialized = true;

    }

    async shutdown() {

        if (!this.initialized)
            return;

        await AlbumWorkerPool.stop();

        AlbumTaskScheduler.clear();

        AlbumCacheManager.clear();

        AlbumMemoryManager.clear();

        AlbumPluginManager.clear();

        AlbumCommandManager.clear();

        AlbumOrchestrator.reset();

        AlbumEventBus.clear();

        this.initialized = false;

    }

    isInitialized() {

        return this.initialized;

    }

    services() {

        return {

            events: AlbumEventBus,

            commands: AlbumCommandManager,

            plugins: AlbumPluginManager,

            state: AlbumStateManager,

            cache: AlbumCacheManager,

            memory: AlbumMemoryManager,

            performance: AlbumPerformanceMonitor,

            scheduler: AlbumTaskScheduler,

            workers: AlbumWorkerPool,

            orchestrator: AlbumOrchestrator

        };

    }

    health() {

        return {

            initialized: this.initialized,

            cache: AlbumCacheManager.statistics(),

            memory: AlbumMemoryManager.statistics(),

            workers: AlbumWorkerPool.statistics(),

            scheduler: {

                pending: AlbumTaskScheduler.pending(),

                active: AlbumTaskScheduler.active(),

                paused: AlbumTaskScheduler.isPaused()

            },

            performance: AlbumPerformanceMonitor.summary()

        };

    }

}

export default new AlbumBootstrap();