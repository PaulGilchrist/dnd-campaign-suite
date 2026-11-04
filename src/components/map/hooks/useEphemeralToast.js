// @maintained-by-ai
import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Display-only ephemeral toast state (benign UI category — auto-hide timer
 * touches NOTHING but the local display flag; never game state, see
 * AGENTS.md "No Game Timers"). Extracted from Map.jsx to keep the Map body
 * under the max-statements cap; the hex lane keeps its own HexMap-owned
 * showMapToast slot.
 *
 * Returns { message, sticky, show, dismiss } — message renders null-when-idle
 * (e.g. via MapNoticeToast.jsx). show(text) displays + (re)arms the auto-hide
 * after `duration` ms. show(text, { sticky: true }) displays a notice that
 * NEVER auto-hides (backlog 2026-11-03: OA enforcement advisories stayed on
 * the board's permanent log but the toast died at 4s mid-drag — sticky lanes
 * carry a visible dismiss control and clear via dismiss()). A later non-sticky
 * show() replaces the sticky notice and re-arms its timer (single slot).
 */
function useEphemeralToast(duration = 2500) {
    const [notice, setNotice] = useState(null); // { text, sticky } | null
    const toastTimerRef = useRef(null);

    const show = useCallback((text, options) => {
        clearTimeout(toastTimerRef.current);
        const sticky = options?.sticky === true;
        setNotice({ text, sticky });
        // toast auto-hide (display only, no game state); sticky notices
        // wait for an explicit dismiss() instead — never a game timer.
        if (!sticky) {
            toastTimerRef.current = setTimeout(() => setNotice(null), duration);
        }
    }, [duration]);

    const dismiss = useCallback(() => {
        clearTimeout(toastTimerRef.current);
        setNotice(null);
    }, []);

    useEffect(() => () => clearTimeout(toastTimerRef.current), []);

    return {
        message: notice ? notice.text : null,
        sticky: notice ? notice.sticky : false,
        show,
        dismiss,
    };
}

export default useEphemeralToast;
