"use strict";

// Use the exact helper shipped with the installed Babel compiler once, instead
// of emitting a private copy in every transformed module. Keep spec semantics
// (symbols, descriptors, getters, __proto__) and the existing UXP syntax target.
module.exports = function shareObjectSpreadHelper({ types }) {
    return {
        pre(file) {
            let reference;
            file.set("helperGenerator", name => {
                if (name !== "objectSpread2") return undefined;
                if (!reference) {
                    reference = file.scope.generateUidIdentifier(name);
                    file.path.unshiftContainer("body", types.importDeclaration(
                        [types.importDefaultSpecifier(reference)],
                        types.stringLiteral(require.resolve("@babel/helpers/lib/helpers/objectSpread2.js"))
                    ));
                }
                return types.cloneNode(reference);
            });
        }
    };
};
