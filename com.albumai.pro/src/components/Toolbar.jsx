import React from "react";

export default function Toolbar({
    onOpen,
    onRefresh,
    onSelectAll,
    onClearSelection,
    photoCount = 0,
    selectedCount = 0
}) {
    const buttonStyle = {
        padding: "8px 14px",
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
                gap: 12,
                marginBottom: 15
            }}
        >
            <div
                style={{
                    display: "flex",
                    gap: 10,
                    flexWrap: "wrap"
                }}
            >
                <button style={buttonStyle} onClick={onOpen}>
                    📂 Open
                </button>

                <button style={buttonStyle} onClick={onRefresh}>
                    🔄 Refresh
                </button>

                <button style={buttonStyle} onClick={onSelectAll}>
                    ☑ Select All
                </button>

                <button style={buttonStyle} onClick={onClearSelection}>
                    ✖ Clear
                </button>
            </div>

            <div
                style={{
                    color: "#bbb",
                    fontSize: 13,
                    display: "flex",
                    gap: 20
                }}
            >
                <span>Photos: {photoCount}</span>
                <span>Selected: {selectedCount}</span>
            </div>
        </div>
    );
}