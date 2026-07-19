// src/ui/components/ExportOptions/ExportOptions.jsx

import React from "react";

export default function ExportOptions({

    value,

    onChange

}) {

    function update(field, fieldValue) {

        onChange({

            ...value,

            [field]: fieldValue

        });

    }

    return (

        <div className="export-options">

            <h3>

                Export Options

            </h3>

            <label>

                <input

                    type="checkbox"

                    checked={value.psd}

                    onChange={e =>

                        update(

                            "psd",

                            e.target.checked

                        )

                    }

                />

                PSD

            </label>

            <label>

                <input

                    type="checkbox"

                    checked={value.jpg}

                    onChange={e =>

                        update(

                            "jpg",

                            e.target.checked

                        )

                    }

                />

                JPG

            </label>

            <label>

                <input

                    type="checkbox"

                    checked={value.pdf}

                    onChange={e =>

                        update(

                            "pdf",

                            e.target.checked

                        )

                    }

                />

                PDF

            </label>

            <hr />

            <label>

                JPG Quality

            </label>

            <input

                type="range"

                min="1"

                max="12"

                value={value.jpgQuality}

                onChange={e =>

                    update(

                        "jpgQuality",

                        Number(e.target.value)

                    )

                }

            />

            <span>

                {value.jpgQuality}

            </span>

            <label>

                PDF Quality

            </label>

            <select

                value={value.pdfQuality}

                onChange={e =>

                    update(

                        "pdfQuality",

                        e.target.value

                    )

                }

            >

                <option value="high">

                    High

                </option>

                <option value="medium">

                    Medium

                </option>

                <option value="low">

                    Low

                </option>

            </select>

            <label>

                Resolution

            </label>

            <select

                value={value.dpi}

                onChange={e =>

                    update(

                        "dpi",

                        Number(e.target.value)

                    )

                }

            >

                <option value="300">

                    300 DPI

                </option>

                <option value="240">

                    240 DPI

                </option>

                <option value="150">

                    150 DPI

                </option>

            </select>

        </div>

    );

}