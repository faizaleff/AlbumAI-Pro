// src/core/photoshop/Logger.js

class Logger {
    constructor() {
        this.enabled = true;
        this.debugEnabled = true;
    }

    enable() {
        this.enabled = true;
    }

    disable() {
        this.enabled = false;
    }

    enableDebug() {
        this.debugEnabled = true;
    }

    disableDebug() {
        this.debugEnabled = false;
    }

    timestamp() {
        return new Date().toISOString();
    }

    format(level, message) {
        return `[${this.timestamp()}] [${level}] ${message}`;
    }

    info(message, ...args) {
        if (!this.enabled) return;
        console.log(this.format("INFO", message), ...args);
    }

    warn(message, ...args) {
        if (!this.enabled) return;
        console.warn(this.format("WARN", message), ...args);
    }

    error(message, ...args) {
        if (!this.enabled) return;
        console.error(this.format("ERROR", message), ...args);
    }

    debug(message, ...args) {
        if (!this.enabled || !this.debugEnabled) return;
        console.debug(this.format("DEBUG", message), ...args);
    }

    group(title) {
        if (!this.enabled) return;
        console.group(title);
    }

    groupEnd() {
        if (!this.enabled) return;
        console.groupEnd();
    }

    time(label) {
        if (!this.enabled) return;
        console.time(label);
    }

    timeEnd(label) {
        if (!this.enabled) return;
        console.timeEnd(label);
    }

    separator() {
        if (!this.enabled) return;
        console.log("------------------------------------------------------------");
    }
}

const logger = new Logger();

export default logger;