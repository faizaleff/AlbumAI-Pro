import Logger from "./photoshop/Logger";

export default class PerformanceMonitor {

    constructor() {

        this.timers = new Map();

        this.results = [];

    }

    start(name) {

        this.timers.set(name, performance.now());

    }

    stop(name) {

        if (!this.timers.has(name))
            return null;

        const elapsed =
            performance.now() -
            this.timers.get(name);

        this.results.push({

            name,

            duration: elapsed,

            timestamp: new Date()

        });

        this.timers.delete(name);

        Logger.info(
            `${name}: ${elapsed.toFixed(2)} ms`
        );

        return elapsed;

    }

    measure(name, callback) {

        this.start(name);

        const result = callback();

        if (result instanceof Promise) {

            return result.finally(() => {

                this.stop(name);

            });

        }

        this.stop(name);

        return result;

    }

    get(name) {

        return this.results.filter(

            x => x.name === name

        );

    }

    latest(name) {

        const list = this.get(name);

        return list.length

            ? list[list.length - 1]

            : null;

    }

    average(name) {

        const list = this.get(name);

        if (!list.length)
            return 0;

        return (

            list.reduce(

                (a, b) =>

                    a + b.duration,

                0

            ) / list.length

        );

    }

    clear() {

        this.timers.clear();

        this.results = [];

    }

}