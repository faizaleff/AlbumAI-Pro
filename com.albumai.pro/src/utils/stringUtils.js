export function capitalize(value = "") {

    if (!value) {

        return "";

    }

    return value.charAt(0).toUpperCase() +

        value.slice(1);

}

export function camelCase(value = "") {

    return value

        .trim()

        .toLowerCase()

        .replace(/[-_\s]+(.)?/g, (_, character) =>

            character

                ? character.toUpperCase()

                : ""

        );

}

export function pascalCase(value = "") {

    const camel = camelCase(value);

    return capitalize(camel);

}

export function kebabCase(value = "") {

    return value

        .replace(/([a-z])([A-Z])/g, "$1-$2")

        .replace(/[\s_]+/g, "-")

        .toLowerCase();

}

export function snakeCase(value = "") {

    return value

        .replace(/([a-z])([A-Z])/g, "$1_$2")

        .replace(/[\s-]+/g, "_")

        .toLowerCase();

}

export function truncate(

    value = "",

    length = 50,

    suffix = "..."

) {

    if (value.length <= length) {

        return value;

    }

    return value.substring(

        0,

        length - suffix.length

    ) + suffix;

}

export function pad(

    value,

    length,

    character = "0"

) {

    return String(value)

        .padStart(

            length,

            character

        );

}

export function isEmpty(value) {

    return (

        value === undefined ||

        value === null ||

        String(value).trim() === ""

    );

}