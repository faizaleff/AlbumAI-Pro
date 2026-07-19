// src/ui/components/TemplatePicker/TemplatePicker.jsx

import React, { useEffect, useState } from "react";

export default function TemplatePicker({

    value,

    services,

    onChange

}) {

    const [templates, setTemplates] = useState([]);

    const [loading, setLoading] = useState(true);

    useEffect(() => {

        async function loadTemplates() {

            try {

                const registry =
                    services.bootstrap.resolve(
                        "templateRegistry"
                    );

                const list =
                    await registry.getAll();

                setTemplates(list);

            }

            catch (error) {

                console.error(error);

            }

            finally {

                setLoading(false);

            }

        }

        loadTemplates();

    }, [services]);

    if (loading) {

        return (

            <div>

                Loading templates...

            </div>

        );

    }

    return (

        <div className="template-picker">

            <h3>

                Album Template

            </h3>

            <select

                value={value?.id ?? ""}

                onChange={event => {

                    const template =

                        templates.find(

                            t =>

                                t.id ===

                                event.target.value

                        );

                    onChange(template);

                }}

            >

                <option value="">

                    Select Template

                </option>

                {

                    templates.map(template => (

                        <option

                            key={template.id}

                            value={template.id}

                        >

                            {template.name}

                        </option>

                    ))

                }

            </select>

            {

                value && (

                    <div className="template-summary">

                        <p>

                            Sheets

                            <strong>

                                {value.sheets}

                            </strong>

                        </p>

                        <p>

                            Placeholders

                            <strong>

                                {value.placeholders}

                            </strong>

                        </p>

                        <p>

                            Size

                            <strong>

                                {value.size}

                            </strong>

                        </p>

                    </div>

                )

            }

        </div>

    );

}