// @maintained-by-ai
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Display-only ephemeral toast state (benign UI category — auto-hide timer
 * touches NOTHING but the local display flag; never game state, see
 * AGENTS.md "No Game Timers"). Extracted from Map.jsx to keep the Map body
 * under the max-statements cap; the hex lane keeps its own HexMap-owned
 * showMapToast slot.
 *
 * Returns { message, show } — message renders null-when-idle (e.g. via
 * MapNoticeToast.jsx), show(message) displays + (re)arms the auto-hide.
 */
function useEphemeralToast(duration = 2500) {
    const [message, setMessage] = useState(null);
    const toastTimerRef = useRef(null);

    const show = useCallback((text) => {
        clearTimeout(toastTimerRef.current);
        setMessage(text);
        // toast auto-hide (display only, no game state)
        toastTimerRef.current = setTimeout(() => setMessage(null), duration);
    }, [duration]);

    useEffect(() => () => clearTimeout(toastTimerRef.current), []);

    return { message, show };
}

export default useEphemeralToast;
