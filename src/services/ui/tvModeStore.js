// @maintained-by-ai
// Per-client TV-mode broadcast (display state only — never game state, and
// never shared over SSE). The Initiative tracker's TV presentation lives in
// useTvPresentation, but the app shell (App.jsx) needs to know about it too so
// it can hide the fixed left sidebar and reclaim its 180px gutter for the
// card carousel on the TV. A module store (read with useSyncExternalStore)
// bridges the two without lifting TV state all the way up the tree.
//
// Lifecycle: useTvPresentation publishes on mount/toggle and clears on
// unmount, so the sidebar only disappears while a TV-mode tracker is on
// screen — every other view keeps navigation available.

let tvModeActive = false
const listeners = new Set()

export function setTvModeActive(active) {
    if (tvModeActive === active) return
    tvModeActive = active
    for (const listener of listeners) listener()
}

export function subscribeTvModeActive(listener) {
    listeners.add(listener)
    return () => listeners.delete(listener)
}

export function getTvModeActive() {
    return tvModeActive
}
