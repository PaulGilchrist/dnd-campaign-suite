import { useState, useCallback } from 'react';

const SSE_EVENT_KEY_PREFIX = 'spell-overlay-';

function useSpellOverlay(campaignName) {
    const [overlays, setOverlays] = useState([]);
    const [pendingOverlay, setPendingOverlay] = useState(null);

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
                    setOverlays(prev => {
                        const existingIds = new Set(prev.map(o => o.id));
                        const unique = newOverlays.filter(n => !existingIds.has(n.id));
                        return unique.length ? [...prev, ...unique] : prev;
                    });
                }
                break;
            case 'update':
                if (newOverlays?.length) {
                    setOverlays(prev => prev.map(o => {
                        const replacement = newOverlays.find(n => n.id === o.id);
                        return replacement || o;
                    }));
                }
                break;
            case 'remove':
                if (overlayId) {
                    setOverlays(prev => prev.filter(o => o.id !== overlayId));
                }
                break;
            case 'clear':
                setOverlays([]);
                break;
            default:
                break;
        }
    }, [campaignName]);

    return {
        overlays,
        pendingOverlay,
        setPendingOverlay,
        addOverlay,
        updateOverlay,
        removeOverlay,
        clearOverlays,
        handleSSEEvent,
    };
}

export default useSpellOverlay;
