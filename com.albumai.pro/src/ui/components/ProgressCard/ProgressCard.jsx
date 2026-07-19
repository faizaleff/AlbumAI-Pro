// src/ui/components/ProgressCard/ProgressCard.jsx

import React from "react";

export default function ProgressCard({

    progress

}) {

    if (!progress)
        return null;

    const {

        stage,

        current,

        total,

        percentage,

        message,

        elapsed

    } = progress;

    return (

        <div className="progress-card">

            <h3>

                Album Generation Progress

            </h3>

            <div>

                <strong>

                    {stage}

                </strong>

            </div>

            <div>

                {message}

            </div>

            <progress

                max={100}

                value={percentage}

            />

            <div>

                {percentage}%

            </div>

            <div>

                {current} / {total}

            </div>

            <div>

                Elapsed : {elapsed}s

            </div>

        </div>

    );

}