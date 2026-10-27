import { useEffect, useRef } from 'react';
import { TOOL_NONE, TOOL_TRAVEL } from '../../../config/outdoorConfig.js';

// Options object (max-params): hasPersistedWeather (a map file that already
// carries weather — suppresses the first-travel auto-roll) and hasLoadedTrip
// (the loaded map file carried a live trip — this session is resume-aware:
// no-press churns of the trip never cancel it, only leaving the tool does).
function useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool, { hasPersistedWeather = false, hasLoadedTrip = false } = {}) {
    const toolInitRef = useRef(true);
    const prevToolRef = useRef(tool);
    // Reopen-resume (improve 2026-10-26-D): a trip already live while the
    // tool resets to NONE at mount (mid-trip REOPEN / page reload) is a
    // resume, never a cancel. Post-load re-renders used to re-run branch 3
    // (tool NONE + active trip) and silently kill the reopened trip. The
    // hasLoadedTrip flag extends the same immunity to the map-file adoption
    // activation, which lands one commit after mount (async loader) —
    // per-value SSE echoes keep churning the trip afterwards, so the
    // immunity must be session-sticky, not one-pass.
    const openedLiveRef = useRef(false);

    useEffect(() => {
        if (toolInitRef.current) {
            toolInitRef.current = false;
            prevToolRef.current = tool;
            // Mounting with the travel tool pre-selected is not a resume:
            // leaving the tool then must still cancel.
            openedLiveRef.current = !!travelMgmt.isTravelActive && tool !== TOOL_TRAVEL;
            return;
        }
        const prevTool = prevToolRef.current;
        const toolJustActivated = tool === TOOL_TRAVEL && prevTool !== TOOL_TRAVEL;
        prevToolRef.current = tool;
        // Session gate (improve 2026-10-26-D): this session mounted with a
        // live trip OR loaded a file trip — the branches below split resume
        // behavior from the legacy external-start contract on this ONE flag.
        const resumeSession = openedLiveRef.current || hasLoadedTrip;

        if (toolJustActivated && travelMgmt.travelMode === 'inactive') {
            travelMgmt.startPlanning();
            // Backlog 2026-10-26-C: pressing the travel tool is NOT a weather
            // re-roll. Map-file weather is deliberate GM-authored state — it
            // survives the tool mount untouched. Only a map with NO persisted
            // weather (first travel) auto-rolls; the panel's manual re-roll
            // button and the camp (new-day) seam keep their unconditional
            // rolls. Pure event-gating — no timers, no new state.
            if (!hasPersistedWeather) {
                handleGenerateWeather();
            }
        } else if (travelMgmt.travelMode === 'inactive' && tool === TOOL_TRAVEL) {
            // Domain rule: the travel tool may stay selected only while travel is
            // live — if travel goes inactive mid-selection, force the tool off.
            setTool(TOOL_NONE);
        } else if (tool !== TOOL_TRAVEL && travelMgmt.isTravelActive) {
            if (prevTool === TOOL_TRAVEL || !resumeSession) {
                // Cancel only on deliberate exit (GM deselected the travel tool
                // mid-trip) or on an external (other-tab/SSE) start seen by a
                // session that mounted with no trip AND loaded no file trip
                // (pinned legacy contract). Resume sessions are immune.
                travelMgmt.cancelTravel();
            } else {
                // Toggle-mirror on adoption/resume (backlog 2026-10-27-G): the
                // file-trip adoption and reopen-resume lanes activate travel
                // while the tool stays NONE — the panel mounted but the toolbar
                // Travel toggle rendered inactive/aria-pressed=false. Mirror
                // the panel: auto-press the tool so `tool === TOOL_TRAVEL`
                // stays the SINGLE source of truth for .active/aria-pressed
                // (toolbar unchanged). A later Cancel lands mode=inactive with
                // the tool selected → the force-off branch above clears
                // .active/aria-pressed in the same effect pass.
                setTool(TOOL_TRAVEL);
            }
        }
    }, [tool, handleGenerateWeather, travelMgmt, setTool, hasPersistedWeather, hasLoadedTrip]);
}

export default useTravelToolSync;
