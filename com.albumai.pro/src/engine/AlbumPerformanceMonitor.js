class AlbumPerformanceMonitor {

    constructor() {

        this.metrics = new Map();

        this.active = new Map();

    }

    start(name) {

        this.active.set(name, performance.now());

    }

    end(name) {

        if (!this.active.has(name))
            return 0;

        const duration =
            performance.now() -
            this.active.get(name);

        this.active.delete(name);

        if (!this.metrics.has(name)) {

            this.metrics.set(name, []);

        }

        this.metrics.get(name).push(duration);

        return duration;

    }

    measure(name, fn) {

        this.start(name);

        const result = fn();

        if (result instanceof Promise) {

            return result.finally(() => {

                this.end(name);

            });

        }

        this.end(name);

        return result;

    }

    get(name) {

        return this.metrics.get(name) || [];

    }

    average(name) {

        const values = this.get(name);

        if (!values.length)
            return 0;

        return values.reduce(

            (a, b) => a + b,
            0

        ) / values.length;

    }

    min(name) {

        const values = this.get(name);

        return values.length
            ? Math.min(...values)
            : 0;

    }

    max(name) {

        const values = this.get(name);

        return values.length
            ? Math.max(...values)
            : 0;

    }

    total(name) {

        return this.get(name).reduce(

            (a, b) => a + b,
            0

        );

    }

    summary() {

        const report = {};

        for (const key of this.metrics.keys()) {

            report[key] = {

                runs: this.get(key).length,

                average: this.average(key),

                minimum: this.min(key),

                maximum: this.max(key),

                total: this.total(key)

            };

        }

        return report;

    }

    reset(name = null) {

        if (name) {

            this.metrics.delete(name);

            this.active.delete(name);

            return;

        }

        this.metrics.clear();

        this.active.clear();

    }

}

export default new AlbumPerformanceMonitor();