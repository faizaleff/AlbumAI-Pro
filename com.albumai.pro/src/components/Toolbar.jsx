import React from "react";

export default function Toolbar({
    onOpen,
    onRefresh,
    onSelectAll,
    onClearSelection,
    projectActive = false,
    photoCount: _photoCount = 0,
    selectedCount: _selectedCount = 0
}) {
    const buttonStyle = {
        minHeight: 34,
        padding: "6px 12px",
        background: "#3a3a3a",
        color: "#fff",
        border: "1px solid #555",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 13
    };

    return (
        <div
            style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                marginBottom: 12
            }}
        >
            <div
                style={{
                    display: "flex",
                    gap: 8,
                    flexWrap: "wrap"
                }}
            >
                <button
                    style={buttonStyle}
                    onClick={onOpen}
                    disabled={!projectActive}
                >
                    📂 Open
                </button>

                <button
                    style={buttonStyle}
                    onClick={onRefresh}
                    disabled={!projectActive}
                >
                    🔄 Refresh
                </button>

                <button style={buttonStyle} onClick={onSelectAll}>
                    ☑ Select All
                </button>

                <button style={buttonStyle} onClick={onClearSelection}>
                    ✖ Clear
                </button>
            </div>
        </div>
    );
}
