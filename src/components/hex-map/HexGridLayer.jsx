import { useMemo } from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig.js';
import { getAllHexes, hexToPixel, hexToSVGPath } from '../../services/maps/hexMapUtils.js';

function HexGridLayer({ hexCols, hexRows }) {
    const paths = useMemo(() => {
        const allHexes = getAllHexes(hexCols, hexRows);
        return allHexes.map(({ q, r }) => {
            const center = hexToPixel(q, r, HEX_SIZE);
            const d = hexToSVGPath(center.x, center.y, HEX_SIZE);
            return { key: `${q},${r}`, d };
        });
    }, [hexCols, hexRows]);

    return (
        <g className="hex-grid-layer">
            {paths.map(({ key, d }) => (
                <path
                    key={key}
                    d={d}
                    fill="none"
                    stroke="#999"
                    strokeWidth="0.3"
                />
            ))}
        </g>
    );
}

export default HexGridLayer;
