function fileName(value) {

    if (typeof value === "string") {
        return value;
    }

    if (typeof value?.name === "string") {
        return value.name;
    }

    return "";

}

export function getExtension(value) {

    const normalizedName = fileName(value);

    const index = normalizedName.lastIndexOf(".");

    if (index === -1) {
        return "";
    }

    return normalizedName
        .substring(index + 1)
        .toLowerCase();

}

export function getFileName(path = "") {

    return path
        .split(/[\\/]/)
        .pop();

}

export function removeExtension(fileName = "") {

    const index = fileName.lastIndexOf(".");

    if (index === -1) {
        return fileName;
    }

    return fileName.substring(0, index);

}

export function isImage(value) {

    return [

        "jpg",

        "jpeg",

        "png",

        "tif",

        "tiff",

        "webp",

        "psd"

    ].includes(

        getExtension(value)

    );

}

export function sortFiles(files = []) {

    return [...files].sort((a, b) =>

        a.name.localeCompare(

            b.name,

            undefined,

            {

                numeric: true,

                sensitivity: "base"

            }

        )

    );

}
