import {
    buildCoordinateLabels,
    ROW_LABEL_BASELINE,
} from './coordinateLabels.js';

// Coordinate legend overlay (backlog 2026-11-21): the board renders axis
// digits so the raw 0-based cells the copy cites (LoS deny "(5,10)", cover
// stamps, dress-preview "add altar at 3,7") resolve to a square. Label
// geometry lives in the pure seam coordinateLabels.js. Rendered INSIDE the
// map svg in grid units — the viewBox zoom/pan transform carries it for free.
// Enabled is per-client view state (Map.jsx local useState, default OFF).

const CoordinateLegend = ({ gridSize, enabled }) => {
    // OFF (the default, incl. fresh mount) renders NOTHING — zero legend
    // elements in the DOM, zero layout shift. This layer never reads or
    // writes the server.
    if (!enabled) return null;
    return (
        <g className="coord-legend" aria-hidden="true">
            {buildCoordinateLabels(gridSize).map(({ axis, value, x, y }) => (
                <text
                    key={`${axis}-${value}`}
                    className={`coord-label coord-${axis}`}
                    x={x}
                    y={axis === 'row' ? y + ROW_LABEL_BASELINE : y}
                    textAnchor={axis === 'col' ? 'middle' : 'start'}
                >
                    {value}
                </text>
            ))}
        </g>
    );
};

export default CoordinateLegend;
