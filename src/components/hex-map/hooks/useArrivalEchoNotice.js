// @maintained-by-ai
// Shared-adoption arrival notice (backlog JT 2026-11-11: arrival feedback was
// presser-only). The `.travel-toast` used to fire solely from HexMap's
// handleAdvance, so a tab merely WATCHING the same shared trip got zero
// arrival signal — the SSE echo flips travel-mode inactive and the panel
// unmounts with it. This hook watches the same echo lane the panel already
// rides (the synced travel-mode + travel-lastMessage values from
// useTravelManagement) and fires `onArrival` EXACTLY ONCE per trip when a
// trip that was visible on THIS client goes inactive with the arrival
// sentence in lastMessage (travelService-pinned TRIP_ARRIVAL_MESSAGE — the
// discriminator against a remote CANCEL, which nulls the message).
//
// Per-client one-shot, display-only: no change-data key, no localStorage, no
// new SSE connection, no timers of its own (auto-hide rides HexMap's existing
// benign showMapToast window). A post-arrival mount starts with the trip
// flag unset, so the surviving travel-lastMessage byte never re-surfaces the
// notice. Echo-order independent: the mode flip and the message land as two
// SSE rows in either order — the active-mode leg arms the flag and either
// later render may fire. The localArrivalRef lane keeps the presser's own
// experience unchanged: their toast already fired synchronously on the
// completing click, so the echo commit must not re-arm it.
import { useEffect, useRef } from 'react';
import { TRIP_ARRIVAL_MESSAGE } from '../../../services/maps/travelSession.js';

export default function useArrivalEchoNotice({
    isTripVisible, lastMessage, localArrivalRef, onArrival,
}) {
    const tripVisibleRef = useRef(false);
    const firedRef = useRef(false);

    useEffect(() => {
        if (isTripVisible) {
            // A live trip is visible here — arm (and re-arm for a new trip).
            tripVisibleRef.current = true;
            firedRef.current = false;
            return;
        }
        if (tripVisibleRef.current && !firedRef.current && lastMessage === TRIP_ARRIVAL_MESSAGE) {
            firedRef.current = true;
            tripVisibleRef.current = false;
            // Presser already surfaced the toast on their own click — the
            // echo commit is expected, not a second notice.
            if (localArrivalRef?.current) {
                localArrivalRef.current = false;
                return;
            }
            onArrival();
        }
    }, [isTripVisible, lastMessage, localArrivalRef, onArrival]);
}
