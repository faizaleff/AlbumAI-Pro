export function clamp(

    value,

    min = 0,

    max = 1

) {

    return Math.min(

        Math.max(value, min),

        max

    );

}

export function lerp(

    start,

    end,

    amount

) {

    return start +

        (end - start) *

        amount;

}

export function round(

    value,

    precision = 0

) {

    const factor =

        10 ** precision;

    return Math.round(

        value * factor

    ) / factor;

}

export function percentage(

    value,

    total

) {

    if (!total) {

        return 0;

    }

    return (

        value / total

    ) * 100;

}

export function random(

    min = 0,

    max = 1

) {

    return Math.random() *

        (max - min) +

        min;

}

export function randomInt(

    min,

    max

) {

    return Math.floor(

        random(

            min,

            max + 1

        )

    );

}

export function average(

    values = []

) {

    if (!values.length) {

        return 0;

    }

    return values.reduce(

        (sum, value) =>

            sum + value,

        0

    ) / values.length;

}

export function sum(

    values = []

) {

    return values.reduce(

        (total, value) =>

            total + value,

        0

    );

}