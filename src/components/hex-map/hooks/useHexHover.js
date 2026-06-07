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
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const vb = svg.viewBox.baseVal;
        const svgX = (e.clientX - rect.left) / rect.width * vb.width + vb.x;
        const svgY = (e.clientY - rect.top) / rect.height * vb.height + vb.y;
        const snapped = pixelToHexSnapped(svgX, svgY, HEX_SIZE);
        if (snapped.q >= 0 && snapped.q < hexCols && snapped.r >= 0 && snapped.r < hexRows) {
            setHoveredHex(snapped);
        } else {
            setHoveredHex(null);
        }
    }, [svgRef, hexCols, hexRows]);

    return { hoveredHex, setHoveredHex, getHexFromEvent, handleHexHover };
}

export default useHexHover;
