const THEME = Object.freeze({

    LIGHT: {

        name: "light",

        background: "#ffffff",

        surface: "#f5f5f5",

        primary: "#0d6efd",

        secondary: "#6c757d",

        success: "#198754",

        warning: "#ffc107",

        danger: "#dc3545",

        text: "#212529",

        textSecondary: "#6c757d",

        border: "#dee2e6"

    },

    DARK: {

        name: "dark",

        background: "#1e1e1e",

        surface: "#2b2b2b",

        primary: "#4da3ff",

        secondary: "#8a8a8a",

        success: "#3fb950",

        warning: "#d29922",

        danger: "#f85149",

        text: "#f5f5f5",

        textSecondary: "#b3b3b3",

        border: "#444444"

    }

});

export const DEFAULT_THEME = "dark";

export function getTheme(name = DEFAULT_THEME) {

    return THEME[name.toUpperCase()] ||

        THEME.DARK;

}

export default THEME;