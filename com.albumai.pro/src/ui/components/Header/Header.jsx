// src/ui/components/Header/Header.jsx

import React from "react";

export default function Header() {

    return (

        <header className="album-header">

            <div className="album-header__left">

                <h1>

                    AlbumAI Pro

                </h1>

                <p>

                    AI Powered Wedding Album Generator

                </p>

            </div>

            <div className="album-header__right">

                <span className="version">

                    Version 1.0.0

                </span>

            </div>

        </header>

    );

}