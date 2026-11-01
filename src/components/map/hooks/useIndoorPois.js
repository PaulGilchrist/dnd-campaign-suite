import { useCallback, useState } from 'react';

/**
 * Indoor POI render/manage lane (bug-ai-dress-poi-invisible-on-indoor-maps).
 *
 * AI Dress happily authors `pois` rows onto INDOOR map documents
 * (server/services/ai/authoring/dressMap.js addPoi stores gridX/gridY), and
 * useSSESync already adopts the lane into editor state — but nothing drew or
 * removed them, so applied POI ops were silently invisible. This hook owns the
 * right-click selection + the two document edits, mirroring the outdoor lane
 * (hex-map/hooks/usePoiManagement.js: selectedPoiMenu, toggle visibility,
 * named-confirm delete) on the indoor square-grid geometry.
 *
 * Writes go through setMapData (useMapLoader), the same chokepoint every
 * indoor document lane uses: spread-new-array (never in-place splice), the
 * debounced autosave PUTs the whole document, and the SSE echo is adopted by
 * useSSESync for other tabs.
 */
function useIndoorPois({ setMapData }) {
    const [selectedPoi, setSelectedPoi] = useState(null);

    const closePoiMenu = useCallback(() => {
        setSelectedPoi(null);
    }, []);

    // Payload mirrors the placed-item lane ({ id, gridX, gridY }): the menu
    // anchors at the right-clicked POI's own cell, never a stale lookup.
    const handlePoiContextMenu = useCallback((poi, e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedPoi({ id: poi.id, gridX: poi.gridX, gridY: poi.gridY });
    }, []);

    const handleTogglePoiVisibility = useCallback((id) => {
        setMapData(prev => ({
            ...prev,
            pois: (prev.pois || []).map(p => (p.id === id ? { ...p, visible: p.visible === false } : p)),
        }));
    }, [setMapData]);

    const handleDeletePoi = useCallback((id) => {
        setMapData(prev => ({
            ...prev,
            pois: (prev.pois || []).filter(p => p.id !== id),
        }));
    }, [setMapData]);

    return {
        selectedPoi,
        closePoiMenu,
        handlePoiContextMenu,
        handleTogglePoiVisibility,
        handleDeletePoi,
    };
}

export default useIndoorPois;
