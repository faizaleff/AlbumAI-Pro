const LEVELS = Object.freeze({

    DEBUG: "DEBUG",

    INFO: "INFO",

    WARN: "WARN",

    ERROR: "ERROR"

});

class Logger {

    constructor() {

        this.enabled = true;

    }

    enable() {

        this.enabled = true;

    }

    disable() {

        this.enabled = false;

    }

    write(level, ...messages) {

        if (!this.enabled) {
            return;
        }

        console.log(

            `[${level}]`,

            ...messages

        );

    }

    debug(...messages) {

        this.write(

            LEVELS.DEBUG,

            ...messages

        );

    }

    info(...messages) {

        this.write(

            LEVELS.INFO,

            ...messages

        );

    }

    warn(...messages) {

        this.write(

            LEVELS.WARN,

            ...messages

        );

    }

    error(...messages) {

        this.write(

            LEVELS.ERROR,

            ...messages

        );

    }

}

export default new Logger();