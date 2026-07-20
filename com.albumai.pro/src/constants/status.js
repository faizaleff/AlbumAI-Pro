const STATUS = Object.freeze({

    IDLE: "idle",

    INITIALIZING: "initializing",

    READY: "ready",

    QUEUED: "queued",

    RUNNING: "running",

    PAUSED: "paused",

    CANCELLING: "cancelling",

    CANCELLED: "cancelled",

    COMPLETED: "completed",

    FAILED: "failed",

    RECOVERING: "recovering",

    EXPORTING: "exporting",

    SAVING: "saving",

    CLOSED: "closed"

});

export default STATUS;