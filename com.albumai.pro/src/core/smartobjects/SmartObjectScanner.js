// src/core/smartobjects/SmartObjectScanner.js

class SmartObjectScanner {

    /**
     * Scan normalized layer nodes for Smart Objects.
     * @param {Array} nodes
     * @returns {Array}
     */
    scan(nodes = []) {

        return nodes.filter(
            node => node.kind === "smartObject"
        );

    }

    /**
     * Count Smart Objects.
     */
    count(nodes = []) {

        return this.scan(nodes).length;

    }

    /**
     * Group Smart Objects by parent.
     */
    groupByParent(nodes = []) {

        const groups = new Map();

        for (const smartObject of this.scan(nodes)) {

            const key = smartObject.parentId;

            if (!groups.has(key)) {

                groups.set(key, []);

            }

            groups.get(key).push(smartObject);

        }

        return groups;

    }

    /**
     * Find Smart Objects matching a predicate.
     */
    where(nodes = [], predicate) {

        return this.scan(nodes).filter(predicate);

    }

}

export default SmartObjectScanner;