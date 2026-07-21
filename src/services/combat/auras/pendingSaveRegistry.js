const pendingSavePrompts = new Map();

export function registerPendingSavePrompt(promptId, promptData) {
    pendingSavePrompts.set(promptId, promptData);
}

export function getPendingSavePrompt(promptId) {
    const prompt = pendingSavePrompts.get(promptId);
    if (prompt) {
        pendingSavePrompts.delete(promptId);
        return prompt;
    }
    return null;
}
