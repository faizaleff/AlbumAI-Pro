export function isImage(file) {

    return (
        file.isFile &&
        /\.(jpg|jpeg|png)$/i.test(file.name)
    );

}

export function extension(name) {

    const i = name.lastIndexOf(".");

    return i === -1
        ? ""
        : name.substring(i + 1).toLowerCase();

}