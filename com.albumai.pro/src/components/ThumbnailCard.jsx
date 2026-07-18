import React from "react";

export default function ThumbnailCard({
    photo,
    onClick
}) {

    const selected = photo.selected === true;

    return (

        <div
            onClick={(e) => onClick(photo, e)}
            style={{
                width: "100%",
                height: "100%",
                cursor: "pointer",
                userSelect: "none",
                overflow: "hidden",
                borderRadius: 8,
                background: "#3a3a3a",
                border: selected
                    ? "2px solid #3B82F6"
                    : "2px solid #444",
                boxShadow: selected
                    ? "0 0 10px rgba(59,130,246,.45)"
                    : "none",
                transition: "all .12s ease"
            }}
        >

            <div
                style={{
                    position: "relative",
                    height: 110,
                    background: "#262626",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center"
                }}
            >

                {photo.thumbnail ? (

                    <img
                        src={photo.thumbnail}
                        alt={photo.name}
                        draggable={false}
                        style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            pointerEvents: "none"
                        }}
                    />

                ) : photo.loading ? (

                    <div
                        style={{
                            color: "#888",
                            fontSize: 12
                        }}
                    >
                        Loading...
                    </div>

                ) : (

                    <div
                        style={{
                            fontSize: 42,
                            color: "#666"
                        }}
                    >
                        📷
                    </div>

                )}

                {selected && (

                    <div
                        style={{
                            position: "absolute",
                            top: 6,
                            right: 6,
                            width: 22,
                            height: 22,
                            borderRadius: "50%",
                            background: "#3B82F6",
                            color: "#fff",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center",
                            fontSize: 13,
                            fontWeight: "bold"
                        }}
                    >
                        ✓
                    </div>

                )}

            </div>

            <div
                style={{
                    padding: 8
                }}
            >

                <div
                    style={{
                        fontSize: 11,
                        color: "#fff",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap"
                    }}
                >
                    {photo.name}
                </div>

                <div
                    style={{
                        marginTop: 4,
                        fontSize: 10,
                        color: "#888"
                    }}
                >
                    {photo.favorite ? "❤️ Favorite" : ""}
                </div>

            </div>

        </div>

    );

}