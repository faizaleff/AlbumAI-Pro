import React, { useEffect, useLayoutEffect, useRef, useState } from "react";

export function libraryToolbarLayout(width) {
    if (width >= 580) return "wide";
    if (width >= 320) return "compact";
    return "narrow";
}

export function libraryMenuPosition(toolbar, anchor, optionCount, viewportHeight) {
    const width = Math.min(236, Math.max(0, toolbar.width - 16));
    const height = optionCount * 30 + 40;
    const left = Math.max(8, Math.min(anchor.left - toolbar.left, toolbar.width - width - 8));
    const below = anchor.bottom + 4;
    const top = below + height <= viewportHeight || anchor.top < height + 8
        ? below - toolbar.top
        : anchor.top - toolbar.top - height - 4;
    return { left, top, width };
}

export function libraryToolbarIcon(label, value) {
    return label === "View" ? (value === "list" ? "List" : "Grid") : label;
}

export function ToolbarIcon({ kind }) {
    // UXP does not reliably inherit paint from the root SVG. Set it on every
    // primitive so open paths cannot disappear and circles cannot become dots.
    const paint = { fill: "none", stroke: "#f4f6fa", strokeWidth: 1.5 };
    return (
        <svg className="library-toolbar-icon" width="16" height="16" viewBox="0 0 16 16"
            aria-hidden="true">
            {kind === "Grid" ? <>
                <rect {...paint} x="1.5" y="1.5" width="5" height="5" rx="1" />
                <rect {...paint} x="9.5" y="1.5" width="5" height="5" rx="1" />
                <rect {...paint} x="1.5" y="9.5" width="5" height="5" rx="1" />
                <rect {...paint} x="9.5" y="9.5" width="5" height="5" rx="1" />
            </> : kind === "List" ? <path {...paint} d="M1 3h2m3 0h9M1 8h2m3 0h9M1 13h2m3 0h9" />
                : kind === "Search" ? <><circle {...paint} cx="6.5" cy="6.5" r="4.5" /><path {...paint} d="M10 10l4 4" /></>
                : kind === "Sort" ? <path {...paint} d="M2 3h12M2 8h9M2 13h6" /> : <>
                <path {...paint} d="M1 1.5h14M1 8.5h14" />
                <rect {...paint} x="2" y="4" width="4" height="2" />
                <rect {...paint} x="10" y="4" width="4" height="2" />
                <rect {...paint} x="2" y="11" width="4" height="2" />
                <rect {...paint} x="10" y="11" width="4" height="2" />
            </>}
        </svg>
    );
}

// These menus deliberately use ordinary UXP elements: the menu width must be
// independent of the compact trigger, unlike a native sp-picker popup.
export default function LibraryToolbar({
    search, onSearchChange, onSearchCommit, controls,
    direction, onToggleDirection, filters, filter, onFilterChange
}) {
    const rootRef = useRef(null);
    const triggerRefs = useRef({});
    const itemRefs = useRef([]);
    const widthRef = useRef(0);
    const [layout, setLayout] = useState("compact");
    const [menu, setMenu] = useState(null);
    const activeControl = controls.find(control => control.id === menu?.id);

    useLayoutEffect(() => {
        const measure = () => {
            const width = Math.round(rootRef.current?.getBoundingClientRect?.().width || 0);
            if (!width || width === widthRef.current) return;
            widthRef.current = width;
            setLayout(libraryToolbarLayout(width));
            setMenu(null);
        };
        measure();
        const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
        if (observer && rootRef.current) observer.observe(rootRef.current);
        window.addEventListener("resize", measure);
        // Photoshop can resize docked panels without a browser resize event.
        const timer = observer ? null : setInterval(measure, 250);
        const initialRetry = setTimeout(measure, 80);
        return () => {
            observer?.disconnect();
            window.removeEventListener("resize", measure);
            if (timer !== null) clearInterval(timer);
            clearTimeout(initialRetry);
        };
    }, []);

    useEffect(() => {
        if (!menu) return undefined;
        const dismissOutside = event => {
            if (!event.target.closest?.(".library-toolbar-select, .library-toolbar-menu")) setMenu(null);
        };
        document.addEventListener("mousedown", dismissOutside, true);
        return () => document.removeEventListener("mousedown", dismissOutside, true);
    }, [menu?.id]);

    useEffect(() => {
        if (menu) itemRefs.current[menu.index]?.focus?.();
    }, [menu?.id, menu?.index]);

    const closeMenu = (restoreFocus = false) => {
        if (restoreFocus) triggerRefs.current[menu?.id]?.focus?.();
        setMenu(null);
    };

    const openMenu = control => {
        if (menu?.id === control.id) { closeMenu(); return; }
        const toolbar = rootRef.current.getBoundingClientRect();
        const anchor = triggerRefs.current[control.id].getBoundingClientRect();
        const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || toolbar.bottom + 240;
        setMenu({
            id: control.id,
            index: Math.max(0, control.options.findIndex(option => option.value === control.value)),
            position: libraryMenuPosition(toolbar, anchor, control.options.length, viewportHeight)
        });
    };

    const chooseOption = option => {
        activeControl.onChange(option.value);
        closeMenu(true);
    };

    const handleMenuKey = event => {
        if (!menu || !activeControl) return;
        const count = activeControl.options.length;
        if (event.key === "Escape") { event.preventDefault(); closeMenu(true); }
        else if (event.key === "Tab") closeMenu();
        else if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            const index = event.key === "Home" ? 0 : event.key === "End" ? count - 1
                : (menu.index + (event.key === "ArrowDown" ? 1 : -1) + count) % count;
            setMenu(Object.assign({}, menu, { index }));
        } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            chooseOption(activeControl.options[menu.index]);
        }
        event.stopPropagation();
    };

    return (
        <div ref={rootRef} className={`library-toolbar library-toolbar--${layout}`}
            role="toolbar" aria-label="Primary photo controls" onKeyDown={handleMenuKey}>
            <div className="library-toolbar-search">
                <ToolbarIcon kind="Search" />
                <input id="photo-browser-search" type="text" value={search}
                    placeholder="Search filename…" aria-label="Search photos by filename"
                    onChange={event => onSearchChange(event.target.value)}
                    onBlur={onSearchCommit}
                    onKeyDown={event => {
                        if (event.key === "Enter") event.currentTarget.blur?.();
                        if (event.key === "Escape") closeMenu();
                    }} />
            </div>
            <div className="library-toolbar-selectors">
                {controls.map(control => {
                    const selected = control.options.find(option => option.value === control.value) || control.options[0];
                    return (
                        <div key={control.id} id={control.id} role="button" tabIndex={0}
                            ref={element => { triggerRefs.current[control.id] = element; }}
                            className={`library-toolbar-select${menu?.id === control.id ? " is-open" : ""}`}
                            title={`${control.label} by ${selected.label}`}
                            aria-label={`${control.label} by ${selected.label}`}
                            aria-haspopup="menu" aria-expanded={menu?.id === control.id}
                            aria-controls={menu?.id === control.id ? "library-toolbar-options" : undefined}
                            onClick={() => openMenu(control)}
                            onKeyDown={event => {
                                if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
                                    event.preventDefault(); event.stopPropagation(); openMenu(control);
                                }
                            }}>
                            <ToolbarIcon kind={libraryToolbarIcon(control.label, control.value)} />
                        </div>
                    );
                })}
                <button type="button" className="library-toolbar-direction"
                    title={`Sort ${direction === "asc" ? "ascending" : "descending"}`}
                    aria-label={`Sort ${direction === "asc" ? "ascending" : "descending"}; toggle direction`}
                    onClick={onToggleDirection}>{direction === "asc" ? "↑" : "↓"}</button>
            </div>
            <div className="library-toolbar-filters" role="group" aria-label="Culling workflow">
                {filters.map(option => (
                    <button key={option.value} type="button"
                        className={`library-toolbar-filter${filter === option.value ? " is-active" : ""}`}
                        aria-pressed={filter === option.value} title={option.title}
                        onClick={() => onFilterChange(option.value)}>{option.label}</button>
                ))}
            </div>
            {menu && activeControl && (
                <div id="library-toolbar-options" className="library-toolbar-menu" role="menu"
                    aria-label={`${activeControl.label} options`} style={menu.position}>
                    <div className="library-toolbar-menu-heading" role="presentation">
                        {activeControl.label === "View" ? "View as" : `${activeControl.label} items by`}
                    </div>
                    {activeControl.options.map((option, index) => (
                        <div key={option.value} role="menuitemradio"
                            ref={element => { itemRefs.current[index] = element; }}
                            tabIndex={menu.index === index ? 0 : -1}
                            aria-checked={option.value === activeControl.value}
                            className={`library-toolbar-option${menu.index === index ? " is-focused" : ""}`}
                            onClick={() => chooseOption(option)}>
                            <span className="library-toolbar-option-check" aria-hidden="true">
                                {option.value === activeControl.value ? "✓" : ""}
                            </span>
                            {activeControl.label === "View" && <ToolbarIcon kind={libraryToolbarIcon("View", option.value)} />}
                            <span className="library-toolbar-option-label">{option.label}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
