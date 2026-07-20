export function clone(object) {

    if (object === null || object === undefined) {
        return object;
    }

    return JSON.parse(
        JSON.stringify(object)
    );

}

export function merge(target = {}, source = {}) {

    const result = clone(target);

    Object.keys(source).forEach(key => {

        const value = source[key];

        if (

            value &&
            typeof value === "object" &&
            !Array.isArray(value)

        ) {

            result[key] = merge(

                result[key] || {},

                value

            );

        } else {

            result[key] = value;

        }

    });

    return result;

}

export function isEmpty(object) {

    if (!object) {
        return true;
    }

    return Object.keys(object).length === 0;

}

export function pick(object = {}, keys = []) {

    return keys.reduce((result, key) => {

        if (key in object) {

            result[key] = object[key];

        }

        return result;

    }, {});

}

export function omit(object = {}, keys = []) {

    const result = { ...object };

    keys.forEach(key => {

        delete result[key];

    });

    return result;

}