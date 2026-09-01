import ReactDOM from "react-dom";

const _id = Symbol("_id");
const _root = Symbol("_root");
const _attachment = Symbol("_attachment");
const _Component = Symbol("_Component");
const _menuItems = Symbol("_menuItems");

export class PanelController {
    
    constructor(Component, { id, menuItems } = {}) {
        this[_id] = null;
        this[_root] = null;
        this[_attachment] = null;
        this[_Component] = null;
        this[_menuItems] = [];

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
        if (!rootNode || typeof rootNode.appendChild !== "function") {
            throw new Error(`Panel ${this[_id] || "unknown"} requires a UXP root node.`);
        }

        if (this[_root]) {
            ReactDOM.unmountComponentAtNode(this[_root]);
            this[_root].remove?.();
        }

        this[_attachment] = rootNode;
        this[_root] = document.createElement("div");
        this[_root].style.height = "100%";
        this[_root].style.width = "100%";
        this[_root].style.overflow = "hidden";
        this[_root].style.padding = "8px";
        this[_root].style.boxSizing = "border-box";

        rootNode.appendChild(this[_root]);
        ReactDOM.render(this[_Component]({panel: this}), this[_root]);

        return this[_root];
    }

    show(rootNode)  {
        const attachment = rootNode || this[_attachment];
        if (!this[_root]) {
            this.create(attachment);
            return;
        }
        if (attachment && this[_root].parentNode !== attachment) {
            attachment.appendChild(this[_root]);
            this[_attachment] = attachment;
        }
    }

    hide(rootNode) {
        this[_attachment] = rootNode || this[_attachment];
    }

    destroy() {
        if (this[_root]) {
            ReactDOM.unmountComponentAtNode(this[_root]);
            this[_root].remove?.();
        }
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
