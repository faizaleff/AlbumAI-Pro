export function unique(array = []) {

    return [...new Set(array)];

}

export function chunk(array = [], size = 1) {

    if (size <= 0) {
        return [];
    }

    const result = [];

    for (let i = 0; i < array.length; i += size) {

        result.push(

            array.slice(i, i + size)

        );

    }

    return result;

}

export function flatten(array = []) {

    return array.flat(Infinity);

}

export function groupBy(array = [], key) {

    return array.reduce((groups, item) => {

        const value =

            typeof key === "function"

                ? key(item)

                : item[key];

        if (!groups[value]) {

            groups[value] = [];

        }

        groups[value].push(item);

        return groups;

    }, {});

}

export function sortBy(array = [], key) {

    return [...array].sort((a, b) => {

        const left =

            typeof key === "function"

                ? key(a)

                : a[key];

        const right =

            typeof key === "function"

                ? key(b)

                : b[key];

        if (left < right) return -1;

        if (left > right) return 1;

        return 0;

    });

}

export function remove(array = [], predicate) {

    return array.filter(item =>

        !predicate(item)

    );

}

export function last(array = []) {

    return array[array.length - 1];

}