import React, { useEffect, useState } from "react";

function LayerTree({ layers = [], depth = 0 }) {

    return (

        <ul
            style={{
                margin: 0,
                paddingLeft: depth ? 16 : 0,
                listStyle: "none"
            }}
        >

            {layers.map(layer => (
                <li key={layer.id} style={{ marginTop: 4 }}>
                    <span>
                        {layer.children.length ? "Group" : "Layer"}: {layer.name}
                    </span>
                    {layer.children.length > 0 && (
                        <LayerTree
                            layers={layer.children}
                            depth={depth + 1}
                        />
                    )}
                </li>
            ))}

        </ul>

    );

}

function textPreview(text) {

    if (typeof text !== "string") {
        return "—";
    }

    return text.length > 80
        ? `${text.slice(0, 80)}…`
        : text;

}

export default function TemplateDocumentPanel({
    loadTemplates,
    openTemplate
}) {

    const [templates, setTemplates] = useState([]);
    const [selectedName, setSelectedName] = useState("");
    const [document, setDocument] = useState(null);

    useEffect(() => {

        async function load() {

            try {

                const files = await loadTemplates();

                setTemplates(files);
                setSelectedName(files[0]?.name || "");

            }

            catch (_) {

                setTemplates([]);
                setSelectedName("");

            }

        }

        load();

    }, [loadTemplates]);

    async function open() {

        const file = templates.find(
            item => item.name === selectedName
        );

        if (!file) {
            return;
        }

        const result = await openTemplate(file);

        setDocument(result);

    }

    return (

        <section
            style={{
                marginBottom: 15,
                padding: 12,
                background: "#2f2f2f",
                borderRadius: 6
            }}
        >

            <div style={{ display: "flex", gap: 8 }}>

                <select
                    value={selectedName}
                    onChange={event =>
                        setSelectedName(event.target.value)
                    }
                    disabled={!templates.length}
                >

                    {templates.map(file => (
                        <option key={file.name} value={file.name}>
                            {file.name}
                        </option>
                    ))}

                </select>

                <button
                    onClick={open}
                    disabled={!selectedName}
                >
                    Open PSD
                </button>

            </div>

            {document && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div>PSD Name: {document.name}</div>
                    <div>Width × Height: {document.width} × {document.height}</div>
                    <div>Resolution: {document.resolution}</div>
                    <div>Layer Count: {document.layerCount}</div>
                    <div>
                        Smart Objects: {document.smartObjects?.length || 0}
                    </div>
                    {!!document.smartObjects?.length && (
                        <div>
                            Smart Object Names: {document.smartObjects
                                .map(layer => layer.layerName)
                                .join(", ")}
                        </div>
                    )}
                    <div>
                        Text Layers: {document.textLayers?.length || 0}
                    </div>
                    {!!document.textLayers?.length && (
                        <ul style={{ margin: "4px 0 0", paddingLeft: 16 }}>
                            {document.textLayers.map(layer => (
                                <li key={layer.layerId}>
                                    {layer.layerName}: {textPreview(layer.textContent)}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

            )}

            {document?.layerTree && (

                <div style={{ marginTop: 10, fontSize: 12 }}>
                    <LayerTree layers={document.layerTree} />
                </div>

            )}

        </section>

    );

}
