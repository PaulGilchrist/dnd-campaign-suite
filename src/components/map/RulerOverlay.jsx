const RulerOverlay = ({ start, end, cellSize }) => {
    if (!start) return null;

    const sx = start.gridX * cellSize + cellSize / 2;
    const sy = start.gridY * cellSize + cellSize / 2;

    if (!end) {
        return (
            <g className="ruler-group">
                <circle cx={sx} cy={sy} r={4} className="ruler-point" />
            </g>
        );
    }

    const ex = end.gridX * cellSize + cellSize / 2;
    const ey = end.gridY * cellSize + cellSize / 2;

    const dx = end.gridX - start.gridX;
    const dy = end.gridY - start.gridY;
    const cellDist = Math.sqrt(dx * dx + dy * dy);
    const feetDist = Math.round(cellDist * 5);

    const mx = (sx + ex) / 2;
    const my = (sy + ey) / 2;

    // Integer grids can never produce a sub-cell distance (smallest non-zero leg is 1 cell),
    // so no "<1" case: a zero-length leg reads "0 cells", a 1-cell leg is singular.
    const cells = Math.round(cellDist);
    const label = `${feetDist} ft (${cells} cell${cells === 1 ? '' : 's'})`;
    const labelWidth = label.length * 6.5 + 12;

    return (
        <g className="ruler-group">
            <line x1={sx} y1={sy} x2={ex} y2={ey} className="ruler-line" />
            <circle cx={sx} cy={sy} r={4} className="ruler-point" />
            <circle cx={ex} cy={ey} r={4} className="ruler-point" />
            <g className="ruler-label">
                <rect
                    x={mx - labelWidth / 2}
                    y={my - 9}
                    width={labelWidth}
                    height={18}
                    rx={3}
                />
                <text x={mx} y={my + 4} textAnchor="middle">
                    {label}
                </text>
            </g>
        </g>
    );
};

export default RulerOverlay;
