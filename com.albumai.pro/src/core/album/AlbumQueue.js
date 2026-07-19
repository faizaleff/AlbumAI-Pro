// src/core/album/AlbumQueue.js

class AlbumQueue {

    constructor() {

        this.jobs = [];

        this.running = false;

    }

    /**
     * Add a job.
     */
    add(job) {

        this.jobs.push(job);

        return job;

    }

    /**
     * Add multiple jobs.
     */
    addMany(jobs = []) {

        this.jobs.push(...jobs);

    }

    /**
     * Remove a job.
     */
    remove(id) {

        this.jobs = this.jobs.filter(
            job => job.id !== id
        );

    }

    /**
     * Get job.
     */
    get(id) {

        return this.jobs.find(
            job => job.id === id
        );

    }

    /**
     * Next pending job.
     */
    next() {

        return this.jobs.find(
            job => job.isPending()
        );

    }

    /**
     * Queue statistics.
     */
    stats() {

        return {

            total: this.jobs.length,

            pending:
                this.jobs.filter(j => j.isPending()).length,

            running:
                this.jobs.filter(j => j.isRunning()).length,

            completed:
                this.jobs.filter(j => j.isCompleted()).length,

            failed:
                this.jobs.filter(j => j.isFailed()).length

        };

    }

    /**
     * Clear queue.
     */
    clear() {

        this.jobs = [];

    }

    /**
     * All jobs.
     */
    all() {

        return [...this.jobs];

    }

    /**
     * Queue size.
     */
    size() {

        return this.jobs.length;

    }

}

export default AlbumQueue;