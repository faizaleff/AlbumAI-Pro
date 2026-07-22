import React from "react";

export default function PreviewPanel({ photo, executionDetails }) {

    return (

        <div
            style={{
                flex: 1,
                background: "#2b2b2b",
                borderLeft: "1px solid #444",
                padding: 20,
                color: "#fff",
                minHeight: 0,
                overflowY: "auto",
                overflowX: "hidden"
            }}
        >

            <h2 style={{ marginTop: 0 }}>
                Preview
            </h2>

            {!photo && (

                <div
                    style={{
                        height: "100%",
                        minHeight: 160,
                        display: "flex",
                        justifyContent: "center",
                        alignItems: "center",
                        color: "#888",
                        fontSize: 18
                    }}
                >
                    Select a photo
                </div>

            )}

            {photo && (

                <>

                    <div
                        style={{
                            width: "100%",
                            height: 420,
                            background: "#1f1f1f",
                            border: "1px solid #444",
                            borderRadius: 10,
                            overflow: "hidden",
                            display: "flex",
                            justifyContent: "center",
                            alignItems: "center"
                        }}
                    >

                        {photo.preview ? (

                            <img
                                src={photo.preview}
                                alt={photo.name}
                                style={{
                                    maxWidth: "100%",
                                    maxHeight: "100%",
                                    objectFit: "contain"
                                }}
                            />

                        ) : photo.thumbnail ? (

                            <img
                                src={photo.thumbnail}
                                alt={photo.name}
                                style={{
                                    maxWidth: "100%",
                                    maxHeight: "100%",
                                    objectFit: "contain"
                                }}
                            />

                        ) : photo.loading ? (

                            <div
                                style={{
                                    color: "#aaa",
                                    fontSize: 16
                                }}
                            >
                                Loading...
                            </div>

                        ) : (

                            <div
                                style={{
                                    color: "#777",
                                    fontSize: 90
                                }}
                            >
                                📷
                            </div>

                        )}

                    </div>

                    <div style={{ marginTop: 20 }}>

                        <div style={{ marginBottom: 12 }}>
                            <strong>Name</strong>
                            <br />
                            {photo.name}
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <strong>Size</strong>
                            <br />
                            {photo.file?.size
                                ? `${(photo.file.size / 1024 / 1024).toFixed(2)} MB`
                                : "-"}
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <strong>Type</strong>
                            <br />
                            {photo.file?.type || "-"}
                        </div>

                        <div style={{ marginBottom: 12 }}>
                            <strong>Status</strong>
                            <br />
                            {photo.loaded ? "Ready" : "Loading"}
                        </div>

                    </div>

                </>

            )}

            {executionDetails}

        </div>

    );

}
