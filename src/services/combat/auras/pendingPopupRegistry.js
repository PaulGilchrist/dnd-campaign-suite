const pendingPopupSetters = new Map();

export function registerPendingPopupSetter(promptId, setPopupHtml) {
    pendingPopupSetters.set(promptId, setPopupHtml);
}

export function getPendingPopupSetter(promptId) {
    const setter = pendingPopupSetters.get(promptId);
    if (setter) {
        pendingPopupSetters.delete(promptId);
        return setter;
    }
    return null;
}
