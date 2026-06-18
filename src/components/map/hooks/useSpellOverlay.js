import { useState, useCallback, useRef } from 'react';
import useSSEEqualityGuard from '../../../hooks/runtime/useSSEEqualityGuard.js';

/**
 * WARNING: SSE re-render loop risk
 * All setters in handleSSEEvent must use equality guards to prevent loops when
 * an echoed-back event triggers the same handler.  See useSSEEqualityGuard.
 */
const SSE_EVENT_KEY_PREFIX = 'spell-overlay-';
const UPDATE_DEBOUNCE_MS = 150;

function useSpellOverlay(campaignName, _mapName) {
    const [overlays, setOverlays] = useState([]);
    const setOverlaysG = useSSEEqualityGuard(setOverlays);
    const [pendingOverlay, setPendingOverlay] = useState(null);
    const debounceTimerRef = useRef(null);
    const pendingRef = useRef(null);
    const campaignRef = useRef(campaignName);
    campaignRef.current = campaignName;

    const sendAction = useCallback(async (action, data = {}) => {
        try {
            await fetch(`/spell-overlay?campaign=${encodeURIComponent(campaignName)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, ...data }),
            });
        } catch (err) {
            console.error('Spell overlay API error:', err);
        }
    }, [campaignName]);

    const addOverlay = useCallback((overlay) => {
        setOverlays(prev => [...prev, overlay]);
        sendAction('add', { overlays: [overlay] });
    }, [sendAction]);

    const updateOverlay = useCallback((overlay) => {
        setOverlays(prev => prev.map(o => o.id === overlay.id ? overlay : o));
        pendingRef.current = overlay;
        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = setTimeout(() => {
            if (pendingRef.current) {
                sendAction('update', { overlays: [pendingRef.current] });
            }
        }, UPDATE_DEBOUNCE_MS);
    }, [sendAction]);

    const updateOverlayImmediate = useCallback((overlay) => {
        setOverlays(prev => prev.map(o => o.id === overlay.id ? overlay : o));
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
            debounceTimerRef.current = null;
        }
        pendingRef.current = null;
        sendAction('update', { overlays: [overlay] });
    }, [sendAction]);

    const removeOverlay = useCallback((overlayId) => {
        setOverlays(prev => prev.filter(o => o.id !== overlayId));
        sendAction('remove', { overlayId });
    }, [sendAction]);

    const clearOverlays = useCallback(() => {
        setOverlays([]);
        sendAction('clear');
    }, [sendAction]);

    const handleSSEEvent = useCallback((event) => {
        if (!event || !event.key || !event.key.startsWith(SSE_EVENT_KEY_PREFIX)) return;
        if (event.key !== `${SSE_EVENT_KEY_PREFIX}${campaignName}`) return;

        const { action, overlays: newOverlays, overlayId } = event.data || {};
        switch (action) {
            case 'add':
                if (newOverlays?.length) {
                    setOverlaysG(prev => {
                        const existingIds = new Set(prev.map(o => o.id));
                        const unique = newOverlays.filter(n => !existingIds.has(n.id));
                        return unique.length ? [...prev, ...unique] : prev;
                     });
                   }
                break;
            case 'update':
                if (newOverlays?.length) {
                    setOverlaysG(prev => prev.map(o => {
                        const replacement = newOverlays.find(n => n.id === o.id);
                        return replacement || o;
                     }));
                   }
                break;
            case 'remove':
                if (overlayId) {
                    setOverlaysG(prev => prev.filter(o => o.id !== overlayId));
                  }
                break;
            case 'clear':
                setOverlaysG([]);
                break;
            default:
                break;
           }
        }, [campaignName, setOverlaysG]);

    return {
        overlays,
        pendingOverlay,
        setPendingOverlay,
        addOverlay,
        updateOverlay,
        updateOverlayImmediate,
        removeOverlay,
        clearOverlays,
        handleSSEEvent,
    };
}

export default useSpellOverlay;
