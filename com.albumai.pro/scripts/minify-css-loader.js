"use strict";

const PUNCTUATION = new Set(["{", "}", ":", ";", ",", ">", "+", "~"]);

function minifyCss(source) {
    const input = String(source || "");
    let output = "";
    let quote = null;
    let escaped = false;
    let pendingWhitespace = false;

    for (let index = 0; index < input.length; index += 1) {
        const character = input[index];
        const next = input[index + 1];

        if (quote) {
            output += character;
            if (escaped) escaped = false;
            else if (character === "\\") escaped = true;
            else if (character === quote) quote = null;
            continue;
        }

        if (character === '"' || character === "'") {
            if (pendingWhitespace && output && !PUNCTUATION.has(output.at(-1))) output += " ";
            pendingWhitespace = false;
            quote = character;
            output += character;
            continue;
        }

        if (character === "/" && next === "*") {
            const end = input.indexOf("*/", index + 2);
            index = end === -1 ? input.length : end + 1;
            continue;
        }

        if (/\s/.test(character)) {
            pendingWhitespace = true;
            continue;
        }

        if (PUNCTUATION.has(character)) {
            pendingWhitespace = false;
            if (character === "}" && output.endsWith(";")) output = output.slice(0, -1);
            output += character;
            continue;
        }

        if (pendingWhitespace && output && !PUNCTUATION.has(output.at(-1))) output += " ";
        pendingWhitespace = false;
        output += character;
    }

    return output.trim();
}

function minifyCssLoader(source) {
    return minifyCss(source);
}

minifyCssLoader.minifyCss = minifyCss;

module.exports = minifyCssLoader;
