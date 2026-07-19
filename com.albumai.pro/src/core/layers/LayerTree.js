// src/core/layers/LayerTree.js

class LayerTree {

    /**
     * Build a hierarchical tree from flat nodes.
     * @param {Array} nodes
     * @returns {Array}
     */
    build(nodes = []) {

        const map = new Map();
        const roots = [];

        // Clone nodes so the original cache isn't mutated
        for (const node of nodes) {

            map.set(node.id, {
                ...node,
                children: []
            });

        }

        for (const node of map.values()) {

            if (node.parentId == null) {

                roots.push(node);
                continue;

            }

            const parent = map.get(node.parentId);

            if (parent) {

                parent.children.push(node);

            } else {

                roots.push(node);

            }

        }

        return roots;

    }

    /**
     * Flatten hierarchy.
     */
    flatten(tree = []) {

        const result = [];

        const walk = nodes => {

            for (const node of nodes) {

                result.push(node);

                if (node.children.length) {

                    walk(node.children);

                }

            }

        };

        walk(tree);

        return result;

    }

    /**
     * Maximum hierarchy depth.
     */
    depth(tree = []) {

        let max = 0;

        const walk = (nodes, level) => {

            max = Math.max(max, level);

            for (const node of nodes) {

                if (node.children.length) {

                    walk(node.children, level + 1);

                }

            }

        };

        walk(tree, 1);

        return max;

    }

    /**
     * Find node.
     */
    find(tree, id) {

        for (const node of tree) {

            if (node.id === id)
                return node;

            const found =
                this.find(node.children, id);

            if (found)
                return found;

        }

        return null;

    }

    /**
     * Breadcrumb path.
     */
    path(tree, id) {

        const result = [];

        const walk = (nodes) => {

            for (const node of nodes) {

                result.push(node);

                if (node.id === id)
                    return true;

                if (walk(node.children))
                    return true;

                result.pop();

            }

            return false;

        };

        walk(tree);

        return result;

    }

    /**
     * Extract subtree.
     */
    subtree(tree, id) {

        return this.find(tree, id);

    }

    /**
     * DFS iterator.
     */
    *dfs(tree = []) {

        for (const node of tree) {

            yield node;

            yield* this.dfs(node.children);

        }

    }

    /**
     * BFS iterator.
     */
    *bfs(tree = []) {

        const queue = [...tree];

        while (queue.length) {

            const node = queue.shift();

            yield node;

            queue.push(...node.children);

        }

    }

}

export default LayerTree;