import ReactDOM from "react-dom";

const _id = Symbol("_id");
const _root = Symbol("_root");
const _attachment = Symbol("_attachment");
const _Component = Symbol("_Component");
const _menuItems = Symbol("_menuItems");
const _renderTimer = Symbol("_renderTimer");
const _isRendered = Symbol("_isRendered");

export class PanelController {
    
    constructor(Component, { id, menuItems } = {}) {
        this[_id] = null;
        this[_root] = null;
        this[_attachment] = null;
        this[_Component] = null;
        this[_menuItems] = [];
        this[_renderTimer] = null;
        this[_isRendered] = false;

        this[_Component] = Component;
        this[_id] = id;
        this[_menuItems] = menuItems || [];
        this.menuItems = this[_menuItems].map(menuItem => ({
            id: menuItem.id,
            label: menuItem.label,
            enabled: menuItem.enabled || true,
            checked: menuItem.checked || false
        }));

        [ "create", "show", "hide", "destroy", "invokeMenu" ].forEach(fn => this[fn] = this[fn].bind(this));
    }

    create(rootNode) {
        if (!this[_root]) {
            this[_root] = document.createElement("div");
            this[_root].style.height = "100vh";
            this[_root].style.width = "100%";
            this[_root].style.overflow = "hidden";
            this[_root].style.padding = "8px";
            this[_root].style.boxSizing = "border-box";

        }

        // Manifest v5 supplies the host panel root to create(). Older UXP
        // runtimes attached it during show(), so support both lifecycles.
        if (rootNode && typeof rootNode.appendChild === "function") {
            this[_attachment] = rootNode;
            if (this[_root].parentNode !== rootNode) {
                rootNode.appendChild(this[_root]);
            }
        }

        // UXP v5 panel hooks have a short host timeout. The Album workspace is
        // intentionally substantial, so attach the empty shell synchronously
        // and render React on the next turn instead of blocking panel creation.
        if (!this[_isRendered] && this[_renderTimer] === null) {
            this[_renderTimer] = setTimeout(() => {
                this[_renderTimer] = null;
                if (!this[_root] || this[_isRendered]) return;
                ReactDOM.render(this[_Component]({panel: this}), this[_root]);
                this[_isRendered] = true;
            }, 0);
        }

        return this[_root];
    }

    show(rootNode)  {
        // UXP may pass the DOM root only to create(), then invoke show() with
        // no argument (or a lifecycle event). Keep the latest valid host root
        // across hide/show so reopening never leaves a detached React tree.
        const attachment = rootNode && typeof rootNode.appendChild === "function"
            ? rootNode : this[_attachment];
        if (!this[_root]) this.create(attachment);
        if (attachment) {
            this[_attachment] = attachment;
            if (this[_root].parentNode !== attachment) {
                attachment.appendChild(this[_root]);
            }
        }
    }

    hide(rootNode) {
        const attachment = rootNode && typeof rootNode.removeChild === "function"
            ? rootNode : this[_attachment];
        if (attachment && this[_root] && this[_root].parentNode === attachment) {
            attachment.removeChild(this[_root]);
            // destroy() releases the host; hide() preserves it for show().
            this[_attachment] = attachment;
        }
    }

    destroy() {
        if (this[_renderTimer] !== null) {
            clearTimeout(this[_renderTimer]);
            this[_renderTimer] = null;
        }
        if (this[_root]) {
            if (this[_isRendered]) {
                ReactDOM.unmountComponentAtNode(this[_root]);
            }
            if (this[_root].parentNode) {
                this[_root].parentNode.removeChild(this[_root]);
            }
        }
        this[_isRendered] = false;
        this[_root] = null;
        this[_attachment] = null;
    }

    invokeMenu(id) {
        const menuItem = this[_menuItems].find(c => c.id === id);
        if (menuItem) {
            const handler = menuItem.oninvoke;
            if (handler) {
                handler();
            }
        }
    }
}
