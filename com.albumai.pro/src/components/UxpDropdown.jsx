import React, {
    useEffect,
    useRef
} from "react";

export default function UxpDropdown({
    id,
    value,
    options,
    onValueChange,
    className,
    ariaLabel,
    title,
    disabled = false,
    stopPropagation = false
}) {

    const dropdownRef = useRef(null);
    const normalizedValue = String(value ?? "");
    const matchingIndex = options.findIndex(
        option => String(option.value) === normalizedValue
    );
    const selectedIndex = matchingIndex < 0 ? 0 : matchingIndex;

    useEffect(() => {
        const dropdown = dropdownRef.current;

        if (!dropdown) {
            return undefined;
        }

        dropdown.selectedIndex = selectedIndex;

        const handleChange = event => {
            const index = Number(event?.target?.selectedIndex);
            const selectedOption = options[index];

            if (selectedOption && typeof onValueChange === "function") {
                onValueChange(selectedOption.value);
            }
        };

        const handleClick = event => {
            if (stopPropagation) {
                event.stopPropagation();
            }
        };

        dropdown.addEventListener("change", handleChange);
        dropdown.addEventListener("click", handleClick);

        return () => {
            dropdown.removeEventListener("change", handleChange);
            dropdown.removeEventListener("click", handleClick);
        };
    }, [
        onValueChange,
        options,
        selectedIndex,
        stopPropagation
    ]);

    return (
        <sp-dropdown
            ref={dropdownRef}
            id={id}
            className={className}
            aria-label={ariaLabel}
            title={title}
            disabled={disabled || undefined}
        >
            <sp-menu slot="options">
                {options.map((option, index) => (
                    <sp-menu-item
                        key={String(option.value)}
                        value={String(option.value)}
                        selected={index === selectedIndex || undefined}
                    >
                        {option.label}
                    </sp-menu-item>
                ))}
            </sp-menu>
        </sp-dropdown>
    );

}
