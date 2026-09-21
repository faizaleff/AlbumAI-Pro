import React from "react";

// UXP native buttons flatten nested labels/counts instead of laying them out.
export default function SidebarButton({ children, disabled, onClick, ...props }) {
    return <div {...props} role="button" tabIndex={disabled ? -1 : 1}
        aria-disabled={!!disabled} onClick={event => { if (!disabled) onClick(event); }}
        onKeyDown={event => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                event.stopPropagation();
                if (!disabled && !event.repeat) onClick(event);
            }
        }}>{children}</div>;
}
