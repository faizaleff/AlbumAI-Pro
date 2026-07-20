export function getExtension(fileName = "") {

    const index = fileName.lastIndexOf(".");

    if (index === -1) {
        return "";
    }

    return fileName
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

export function isImage(fileName = "") {

    return [

        "jpg",

        "jpeg",

        "png",

        "tif",

        "tiff",

        "webp",

        "psd"

    ].includes(

        getExtension(fileName)

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