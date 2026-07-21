import React, { useEffect, useState } from "react";

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
                </div>

            )}

        </section>

    );

}
