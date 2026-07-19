// src/ui/components/StatusCard/StatusCard.jsx

import React from "react";

const STATUS = {

    IDLE: "idle",

    RUNNING: "running",

    SUCCESS: "success",

    WARNING: "warning",

    ERROR: "error"

};

export default function StatusCard({

    status = STATUS.IDLE,

    title,

    message,

    details

}) {

    return (

        <div className={`status-card status-${status}`}>

            <h3>{title}</h3>

            <p>{message}</p>

            {

                details && (

                    <pre>

                        {details}

                    </pre>

                )

            }

        </div>

    );

}

export {

    STATUS

};