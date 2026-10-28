import { useEffect, useRef } from 'react';
import { TOOL_NONE, TOOL_TRAVEL } from '../../../config/outdoorConfig.js';
import { getRuntimeValue } from '../../../hooks/runtime/useRuntimeState.js';
import { getSessionId, getTripOwner } from '../../../services/maps/travelSession.js';

// Shared-trip authority (bug-hex-trip-clobbered-by-second-client): the
// campaign store holds the SAME bytes the server holds (mirrors update
// synchronously at SSE-apply time), so a client whose view of ownership died
// with the last reload — or that never had it — can no longer pass for the
// trip's owner. Reads the live trip mode + its claiming tab and answers
// whether this session may destroy it. Empty campaignName ⇒ no server lane
// wired ⇒ mode null ⇒ every pre-fix pinned contract stands byte-identical.
//
// The read carries THREE states, not two (bug-hex-mount-window-silent-trip-
// cancel): a live mode string (tripLive), the CONFIRMED 'inactive' byte
// (modeConfirmedInactive), or UNKNOWN — a missing/null key. The store returns
// null both before the boot change-data seed lands AND after a null change-
// echo REMOVES the key (post 171a9dcbe); in that window useSyncedState still
// renders its declared default `init.travelMode` (a file-carried live mode),
// so the LOCAL channel reads the trip live while this authority read does
// NOT. UNKNOWN must never be mistaken for a confirmed trip-over: it is not
// authority to destroy a trip, only the explicit 'inactive' byte is. So the
// empty-lane legacy path reports modeConfirmedInactive true (no lane ⇒ the
// pre-fix external-start cancel contract stands), while a wired lane reports
// UNKNOWN as modeConfirmedInactive false.
function readSharedTripAuthority(campaignName, startedHere) {
    if (!campaignName) return { tripLive: false, foreignTrip: false, modeConfirmedInactive: true };
    // 'campaign' is the runtime store's campaign-bucket scope (same one
    // useTravelManagement writes travel-* bytes through).
    const sharedMode = getRuntimeValue('campaign', 'travel-mode');
    const tripLive = typeof sharedMode === 'string' && sharedMode !== 'inactive';
    const modeConfirmedInactive = sharedMode === 'inactive';
    const owner = tripLive ? getTripOwner(campaignName) : '';
    const mine = owner === '' || owner === getSessionId() || startedHere;
    return { tripLive, foreignTrip: tripLive && !mine, modeConfirmedInactive };
}

// Branch 3 (tool unpressed/pressed-away WHILE a trip is live): decide the one
// action for this pass. Order carries the contracts: foreign trip + deliberate
// exit → HOLD the press (leg 2 guard — a raw toggle-off may never cancel
// another tab's journey); confirmed-live trip arrived without ever pressing →
// ADOPT (late-join lane); an UNKNOWN authority read (travel-mode missing —
// boot seed lag or the post-171a9dcbe null-echo key REMOVAL) → ADOPT, NEVER
// cancel (bug-hex-mount-window-silent-trip-cancel: the local useSyncedState
// channel may still render a live init.travelMode while this shared read lags,
// and a stale first-echo pass has no authority to destroy a trip — a confirmed
// cancel needs the explicit 'inactive' byte, a confirmed exit needs a live one);
// only then the pinned legacy CANCEL (deliberate own-trip exit, or the no-lane
// external-start echo); mounted-live churn → mirror the toggle.
function activeTripToolAction({ prevTool, foreignTrip, tripLive, startedHere, resumeSession, modeConfirmedInactive }) {
    if (prevTool === TOOL_TRAVEL && foreignTrip) return 'hold';
    if (prevTool !== TOOL_TRAVEL && tripLive && !startedHere) return 'adopt';
    // UNKNOWN authority (neither a live mode nor the confirmed 'inactive'
    // byte — only reachable on a WIRED lane: the empty-lane path reports
    // modeConfirmedInactive true so the no-lane legacy cancel below stands
    // byte-identical). Neither sighting reached cancel: the fresh-boot reopen
    // (never pressed, own/foreign trip lost to a writeback race) and the
    // first-press-after-boot whose just-claimed trip churned while travel-mode
    // was transiently absent. Both settle by ADOPTING (recover/hold the press)
    // instead of silently destroying the journey.
    if (!tripLive && !modeConfirmedInactive) return 'adopt';
    if (prevTool === TOOL_TRAVEL || !resumeSession) return 'cancel';
    return 'mirror';
}

// Human-readable adopt provenance for the branch-3 adopt lane (kept out of the
// effect so its decision complexity stays in the pure helpers, matching this
// file's readSharedTripAuthority / activeTripToolAction structure). Returns ''
// for the own-trip late-join pass that has always been silent.
function adoptLogMessage(foreignTrip, tripLive) {
    if (foreignTrip) return '[useTravelToolSync] Live shared trip started elsewhere reached this client — adopting it (no cancel)';
    if (!tripLive) return '[useTravelToolSync] Shared travel-mode authority unreadable (boot/SSE hydration) — holding the live trip, not cancelling it';
    return '';
}

// Options object (max-params): hasPersistedWeather (a map file that already
// carries weather — suppresses the first-travel auto-roll) and hasLoadedTrip
// (the loaded map file carried a live trip — this session is resume-aware:
// no-press churns of the trip never cancel it, only leaving the tool does).
// campaignName wires the shared-trip authority lane above.
function useTravelToolSync(tool, travelMgmt, handleGenerateWeather, setTool, { hasPersistedWeather = false, hasLoadedTrip = false, campaignName = '' } = {}) {
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
    // Shared-trip provenance (bug-hex-trip-clobbered-by-second-client): only
    // a press can START a trip, so "my press ran startPlanning this session"
    // is the one ownership signal that survives alongside the shared owner
    // stamp even on lanes that never touch the server (unit harnesses).
    const startedHereRef = useRef(false);

    // Tool pressed while the LOCAL mirror reads inactive: Leg 1 guard — reset
    // planning stands only over a trip this session owns (its own cancel→
    // re-press cycle); over a foreign trip the press ADOPTS it (startPlanning
    // clears travel-destination/-path for every client and is never called).
    // Defined inline (not useCallback) — referenced ONLY by the effect below,
    // which re-runs on every value churn anyway; exhaustive-deps is silenced
    // for the call rather than churning the identity into the deps array.
    function handleToolActivation(foreign) {
        if (foreign) {
            console.info('[useTravelToolSync] Travel press over a shared trip started elsewhere — adopting it, not restarting planning');
            openedLiveRef.current = true;
            setTool(TOOL_TRAVEL);
            return;
        }
        startedHereRef.current = true;
        travelMgmt.startPlanning();
        // Backlog 2026-10-26-C: pressing the travel tool is NOT a weather
        // re-roll. Map-file weather is deliberate GM-authored state — it
        // survives the tool mount untouched. Only a map with NO persisted
        // weather (first travel) auto-rolls; the panel's manual re-roll button
        // and the camp (new-day) seam keep their unconditional rolls.
        if (!hasPersistedWeather) {
            handleGenerateWeather();
        }
    }

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
        const { tripLive, foreignTrip, modeConfirmedInactive } = readSharedTripAuthority(campaignName, startedHereRef.current);

        if (toolJustActivated && travelMgmt.travelMode === 'inactive') {
            handleToolActivation(foreignTrip);
        } else if (travelMgmt.travelMode === 'inactive' && tool === TOOL_TRAVEL) {
            // Domain rule: the travel tool may stay selected only while travel is
            // live — if travel goes inactive mid-selection, force the tool off.
            // Trip over (arrival/cancel) — provenance resets for the next one.
            startedHereRef.current = false;
            setTool(TOOL_NONE);
        } else if (tool !== TOOL_TRAVEL && travelMgmt.isTravelActive) {
            const action = activeTripToolAction({
                prevTool,
                foreignTrip,
                tripLive,
                startedHere: startedHereRef.current,
                resumeSession,
                modeConfirmedInactive,
            });
            if (action === 'hold') {
                // Leg 2 guard: a raw toggle-off may NOT cancel another tab's
                // journey — hold the press so the panel stays mounted; its
                // Cancel button remains the explicit, owner-visible exit.
                console.info('[useTravelToolSync] Leaving the tool over a shared trip started elsewhere — keeping travel live (use the panel Cancel to stop it)');
                setTool(TOOL_TRAVEL);
            } else if (action === 'adopt') {
                // Trip reached this client's branch-3 with the tool unpressed
                // (or its press desynced during mount churn) and NO confirmed
                // authority to destroy it. Two lanes land here:
                //  • Late-join (bug-hex-trip-clobbered-by-second-client): a live
                //    shared trip arrived via SSE while the tool sat unpressed —
                //    ADOPT it (own or foreign alike) rather than the pre-fix
                //    cancelTravel() on arrival that destroyed another tab's run.
                //  • Mount-window UNKNOWN authority (bug-hex-mount-window-
                //    silent-trip-cancel, both sightings): the boot change-data
                //    seed has not landed, or a null change-echo REMOVED the
                //    travel-mode key (post 171a9dcbe), so the shared read can't
                //    CONFIRM a trip-over while useSyncedState still renders a
                //    live init.travelMode (or this tab's just-claimed press).
                //    Adopt and let the authority settle — a confirmed cancel
                //    needs the explicit 'inactive' byte, an UNKNOWN one never
                //    authorises destruction.
                const adoptMessage = adoptLogMessage(foreignTrip, tripLive);
                if (adoptMessage) console.info(adoptMessage);
                openedLiveRef.current = true;
                setTool(TOOL_TRAVEL);
            } else if (action === 'cancel') {
                // Cancel only on a CONFIRMED authority state: deliberate exit of
                // this session's own trip (tool was selected, now deselected) or
                // the pinned no-lane external-start echo. An UNKNOWN hydration
                // read always routed to adopt above; resume sessions are immune.
                travelMgmt.cancelTravel();
            } else {
                // Toggle-mirror on adoption/resume (backlog 2026-10-27-G): the
                // file-trip adoption and reopen-resume lanes activate travel
                // while the tool stays NONE — mirror the panel so tool state is
                // the single source of truth for .active/aria-pressed.
                setTool(TOOL_TRAVEL);
            }
        }
    // handleToolActivation is defined inline per render but read here at call
    // time — the effect already re-runs on every value churn it depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [tool, handleGenerateWeather, travelMgmt, setTool, hasPersistedWeather, hasLoadedTrip, campaignName]);
}

export default useTravelToolSync;
