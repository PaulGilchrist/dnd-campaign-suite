import { useCallback, useRef } from 'react';
import { hexKey } from '../../../services/hexMapUtils.js';
import { TOOL_PAINT, TOOL_ERASE, TOOL_RIVER } from '../../../config/outdoorConfig.js';

function useTerrainPainting(hexCols, hexRows, getHexFromEvent, selectedTerrain, setTerrain, setRivers) {
    const paintingRef = useRef(false);

    const handleTerrainPointerDown = useCallback((e, tool) => {
        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return;
        const key = hexKey(hex.q, hex.r);
        if (tool === TOOL_RIVER) {
            setRivers(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
            paintingRef.current = true;
            return;
        }
        setTerrain(prev => {
            const next = { ...prev };
            if (tool === TOOL_PAINT) {
                next[key] = selectedTerrain;
            } else if (tool === TOOL_ERASE) {
                delete next[key];
            }
            return next;
        });
        paintingRef.current = true;
    }, [selectedTerrain, getHexFromEvent, hexCols, hexRows, setTerrain, setRivers]);

    const handleTerrainPointerMove = useCallback((e, tool) => {
        if (!paintingRef.current) return;
        const hex = getHexFromEvent(e);
        if (!hex) return;
        if (hex.q < 0 || hex.q >= hexCols || hex.r < 0 || hex.r >= hexRows) return;
        const key = hexKey(hex.q, hex.r);
        if (tool === TOOL_RIVER) {
            setRivers(prev => prev.includes(key) ? prev : [...prev, key]);
            return;
        }
        setTerrain(prev => {
            const next = { ...prev };
            if (tool === TOOL_PAINT) {
                next[key] = selectedTerrain;
            } else if (tool === TOOL_ERASE) {
                delete next[key];
            }
            return next;
        });
    }, [selectedTerrain, getHexFromEvent, hexCols, hexRows, setTerrain, setRivers]);

    const handleTerrainPointerUp = useCallback(() => {
        paintingRef.current = false;
    }, []);

    return { handleTerrainPointerDown, handleTerrainPointerMove, handleTerrainPointerUp };
}

export default useTerrainPainting;
