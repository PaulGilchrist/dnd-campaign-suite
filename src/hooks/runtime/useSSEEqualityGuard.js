import { useCallback, useRef } from 'react';

/**
 * WARNING: SSE re-render loop risk
 *
 * When a client sends data to the server (e.g., fetch POST), the server calls publish()
 * which broadcasts to ALL connected clients including the sender.  Without a guard,
 * the echoed-back event triggers the same handler again which may fire another request,
 * creating an infinite re-render loop.
 *
 * This hook wraps a React setState setter with a ref-based deep equality check.
 * It will only call the underlying setter if the new value differs from the current one.
 * Accepts both direct values and functional updates (prev => newValue).
 * Use this for all setters invoked inside SSE event handlers.
 *
 * Usage:
 *   const setOverlaysGuarded = useSSEEqualityGuard(setOverlays);
 *    // ...in SSE handler...
 *   setOverlaysGuarded(computedValue);        // only fires if value changed
 *   setMapDataGuarded(prev => ({ ...prev })); // resolves func, compares result
 */

function valuesEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return a == b;

    if (a instanceof Set && b instanceof Set) {
        if (a.size !== b.size) return false;
        for (const item of a) {
            if (!b.has(item)) return false;
           }
        return true;
       }

    if (typeof a === 'object' && typeof b === 'object') {
        if (Array.isArray(a) !== Array.isArray(b)) return false;
        const keysA = Object.keys(a);
        const keysB = Object.keys(b);
        if (keysA.length !== keysB.length) return false;
        return keysA.every(k => valuesEqual(a[k], b[k]));
       }

    return false;
}

function useSSEEqualityGuard(setter) {
    const currentValueRef = useRef(undefined);

    return useCallback((newVal) => {
        if (typeof newVal === 'function') {
            setter((prev) => {
                const result = newVal(prev);
                if (valuesEqual(currentValueRef.current, result)) {
                    return prev;
                }
                currentValueRef.current = result;
                return result;
            });
        } else {
            if (valuesEqual(currentValueRef.current, newVal)) {
                return;
            }
            currentValueRef.current = newVal;
            setter(newVal);
        }
    }, [setter]);
}

export default useSSEEqualityGuard;
