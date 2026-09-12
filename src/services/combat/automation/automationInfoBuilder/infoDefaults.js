export function withAutoDefaults(auto, defaults) {
    const info = {}
    for (const [key, fallback] of Object.entries(defaults)) {
        info[key] = auto[key] || fallback
    }
    return info
}
