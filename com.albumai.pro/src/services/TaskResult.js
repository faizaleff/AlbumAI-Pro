// src/services/TaskResult.js

class TaskResult {

    constructor({

        success = true,
        task = "",
        message = "",
        data = null,
        error = null,
        warnings = [],
        duration = 0

    } = {}) {

        this.success = success;

        this.task = task;

        this.message = message;

        this.data = data;

        this.error = error;

        this.warnings = warnings;

        this.duration = duration;

        this.timestamp = Date.now();

    }

    static success({

        task = "",
        message = "",
        data = null,
        warnings = [],
        duration = 0

    } = {}) {

        return new TaskResult({

            success: true,

            task,

            message,

            data,

            warnings,

            duration

        });

    }

    static failure({

        task = "",
        message = "",
        error = null,
        data = null,
        duration = 0

    } = {}) {

        return new TaskResult({

            success: false,

            task,

            message,

            error,

            data,

            duration

        });

    }

    get failed() {

        return !this.success;

    }

}

export default TaskResult;