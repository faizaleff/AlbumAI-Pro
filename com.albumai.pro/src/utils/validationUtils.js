export function required(value) {

    return value !== undefined &&
        value !== null &&
        value !== "";

}

export function isString(value) {

    return typeof value === "string";

}

export function isNumber(value) {

    return typeof value === "number" &&
        !Number.isNaN(value);

}

export function isBoolean(value) {

    return typeof value === "boolean";

}

export function isFunction(value) {

    return typeof value === "function";

}

export function isObject(value) {

    return value !== null &&
        typeof value === "object" &&
        !Array.isArray(value);

}

export function isArray(value) {

    return Array.isArray(value);

}

export function isPositive(value) {

    return isNumber(value) &&
        value > 0;

}

export function inRange(

    value,

    min,

    max

) {

    return isNumber(value) &&
        value >= min &&
        value <= max;

}

export function hasKeys(

    object,

    keys = []

) {

    if (!isObject(object)) {

        return false;

    }

    return keys.every(key =>

        Object.prototype.hasOwnProperty.call(

            object,

            key

        )

    );

}

export function validate(

    object,

    schema = {}

) {

    const errors = [];

    Object.entries(schema).forEach(

        ([key, validator]) => {

            if (!validator(object[key])) {

                errors.push(key);

            }

        }

    );

    return {

        valid: errors.length === 0,

        errors

    };

}