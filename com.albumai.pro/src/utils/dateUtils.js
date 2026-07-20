export function now() {

    return new Date();

}

export function timestamp() {

    return Date.now();

}

export function iso(date = new Date()) {

    return date.toISOString();

}

export function format(date = new Date()) {

    const value =

        date instanceof Date

            ? date

            : new Date(date);

    const year = value.getFullYear();

    const month = String(

        value.getMonth() + 1

    ).padStart(2, "0");

    const day = String(

        value.getDate()

    ).padStart(2, "0");

    const hour = String(

        value.getHours()

    ).padStart(2, "0");

    const minute = String(

        value.getMinutes()

    ).padStart(2, "0");

    const second = String(

        value.getSeconds()

    ).padStart(2, "0");

    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;

}

export function elapsed(start, end = Date.now()) {

    const startTime =

        start instanceof Date

            ? start.getTime()

            : start;

    const endTime =

        end instanceof Date

            ? end.getTime()

            : end;

    return endTime - startTime;

}

export function seconds(milliseconds) {

    return Math.floor(

        milliseconds / 1000

    );

}

export function minutes(milliseconds) {

    return Math.floor(

        milliseconds / 60000

    );

}

export function hours(milliseconds) {

    return Math.floor(

        milliseconds / 3600000

    );

}