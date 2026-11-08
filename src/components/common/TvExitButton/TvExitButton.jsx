// @maintained-by-ai
// Persistent corner escape for per-client TV presentation mode (QA backlog
// 2026-11-08). While the TV pref (localStorage `initiative-tv`) is ON, a cold
// tab restores tracker-TV and the SidebarShell fully unmounts the nav — a GM
// on a shared machine could previously only escape by finding the in-tracker
// `.tv-toggle-button`. This button mounts at app level (App.jsx), OUTSIDE the
// view outlet, and renders on EVERY view while the pref is ON. Clicking it
// exits through the shared tvModeStore seam — persist OFF + leave fullscreen
// — behaviorally identical to the in-tracker toggle's OFF face; a mounted
// useTvPresentation observes the pref flip and restores the sidebar, layout
// and zoom itself. Re-arms automatically when TV is switched ON again.
// Per-browser UI display pref only (same lane as the theme toggle) — never
// game state, no timers.
import { useSyncExternalStore } from 'react';
import { subscribeTvPref, getTvPref, exitTvPresentation } from '../../../services/ui/tvModeStore.js';
import './TvExitButton.css';

export default function TvExitButton() {
    const tvPref = useSyncExternalStore(subscribeTvPref, getTvPref);
    if (!tvPref) return null;
    return (
        <button
            type="button"
            className="tv-exit-button"
            onClick={exitTvPresentation}
            aria-label="Exit TV mode"
            title="Exit TV presentation mode"
        >
            <i className="fa-solid fa-display" aria-hidden="true"></i> Exit TV mode
        </button>
    );
}
