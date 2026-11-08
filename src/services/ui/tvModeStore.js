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
//
// Second slot: the persisted TV *preference* (localStorage `initiative-tv`).
// The active flag above clears when the tracker unmounts, but the pref keeps
// re-arming TV on every return to Initiative — so the app-level
// TvExitButton watches THIS slot and stays visible on every view while the
// pref is ON, guaranteeing a cold tab that lands in tracker-TV (sidebar
// unmounted) always has an escape. exitTvPresentation() is the single exit
// seam shared by that button and (behaviorally) the in-tracker toggle's OFF
// face: persist OFF + leave fullscreen; the mounted hook observes the pref
// flip and restores the presentation itself.

const TV_PREF_KEY = 'initiative-tv'

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

// ── Persisted pref slot ── a pure facade over the localStorage pref (no
// cached memory copy), so a snapshot read can never disagree with the
// persisted value: a cold tab restoring TV, a raw test seed, and an in-app
// toggle all resolve identically. Listeners fire on real flips only.
const prefListeners = new Set()

function readStoredTvPref() {
    try { return localStorage.getItem(TV_PREF_KEY) === '1' } catch { return false }
}

export function getTvPref() {
    return readStoredTvPref()
}

export function subscribeTvPref(listener) {
    prefListeners.add(listener)
    return () => prefListeners.delete(listener)
}

/** Persist the per-client TV pref (localStorage `initiative-tv`) and wake the
 *  app-level listeners (TvExitButton, a mounted useTvPresentation). */
export function saveTvPref(on) {
    const before = readStoredTvPref()
    try { localStorage.setItem(TV_PREF_KEY, on ? '1' : '0') } catch { /* ignore */ }
    if (readStoredTvPref() !== before) {
        for (const listener of prefListeners) listener()
    }
}

/** Shared OFF exit: persist pref OFF + leave fullscreen (no-op when not in
 *  it). A mounted tracker hook observes the pref flip and restores its own
 *  presentation; off the tracker the pref/OFF state are all there is. */
export function exitTvPresentation() {
    saveTvPref(false)
    if (document.fullscreenElement) {
        const exit = document.exitFullscreen?.()
        if (exit && exit.catch) exit.catch(() => {})
    }
}
