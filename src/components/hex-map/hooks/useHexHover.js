import { useState, useCallback } from 'react';
import { pixelToHexSnapped } from '../../../services/maps/hexMapUtils.js';
import { HEX_SIZE } from '../../../config/outdoorConfig.js';

function useHexHover(svgRef, hexCols, hexRows) {
    const [hoveredHex, setHoveredHex] = useState(null);

    const getHexFromEvent = useCallback((e) => {
        const svg = svgRef.current;
        if (!svg) return null;
        const pt = svg.createSVGPoint();
        pt.x = e.clientX;
        pt.y = e.clientY;
        const svgP = pt.matrixTransform(svg.getScreenCTM().inverse());
        return pixelToHexSnapped(svgP.x, svgP.y, HEX_SIZE);
    }, [svgRef]);

    const handleHexHover = useCallback((e) => {
        const hex = getHexFromEvent(e);
        if (hex && hex.q >= 0 && hex.q < hexCols && hex.r >= 0 && hex.r < hexRows) {
            setHoveredHex(hex);
        } else {
            setHoveredHex(null);
        }
    }, [getHexFromEvent, hexCols, hexRows]);

    return { hoveredHex, setHoveredHex, getHexFromEvent, handleHexHover };
}

export default useHexHover;
