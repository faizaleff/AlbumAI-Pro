export function readCurrentRecoveryState(getBatchRecoveryState) {

    return getBatchRecoveryState?.() || {
        available: false,
        classification: "NONE",
        snapshot: null
    };

}

export function recoveryPanelStateKey(state) {

    return [
        Boolean(state?.available),
        state?.classification || "NONE",
        state?.snapshot || null
    ];

}
