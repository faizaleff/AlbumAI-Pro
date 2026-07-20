const EVENTS = Object.freeze({

    APP_INITIALIZED: "app:initialized",
    APP_SHUTDOWN: "app:shutdown",

    WORKSPACE_INITIALIZED: "workspace:initialized",
    WORKSPACE_ACTIVATED: "workspace:activated",
    WORKSPACE_DISPOSED: "workspace:disposed",

    SESSION_STARTED: "session:started",
    SESSION_COMPLETED: "session:completed",
    SESSION_CANCELLED: "session:cancelled",
    SESSION_FAILED: "session:failed",

    PROJECT_OPENED: "project:opened",
    PROJECT_CLOSED: "project:closed",

    TEMPLATE_LOADED: "template:loaded",
    TEMPLATE_UNLOADED: "template:unloaded",

    JOB_CREATED: "job:created",
    JOB_STARTED: "job:started",
    JOB_COMPLETED: "job:completed",
    JOB_FAILED: "job:failed",

    QUEUE_UPDATED: "queue:updated",

    GENERATION_STARTED: "generation:started",
    GENERATION_PROGRESS: "generation:progress",
    GENERATION_COMPLETED: "generation:completed",
    GENERATION_FAILED: "generation:failed",

    EXPORT_STARTED: "export:started",
    EXPORT_COMPLETED: "export:completed",

    DOCUMENT_OPENED: "document:opened",
    DOCUMENT_SAVED: "document:saved",
    DOCUMENT_CLOSED: "document:closed",

    NOTIFICATION: "notification",

    ERROR: "error"

});

export default EVENTS;