import { OverlayShape, toGrid } from '../../models/SpellOverlay.js';

const CELL_SIZE = 40;

const renderRadius = (overlay) => {
    const r = toGrid(overlay.radiusFt) * CELL_SIZE;
    const cx = overlay.startGridX * CELL_SIZE + CELL_SIZE / 2;
    const cy = overlay.startGridY * CELL_SIZE + CELL_SIZE / 2;
    return (
        <circle
            key={overlay.id}
            cx={cx}
            cy={cy}
            r={r}
            fill={overlay.color}
            stroke={overlay.color.replace('0.35', '0.8')}
            strokeWidth={2}
            className="spell-overlay"
        />
    );
};

const renderCone = (overlay) => {
    const startX = overlay.startGridX * CELL_SIZE + CELL_SIZE / 2;
    const startY = overlay.startGridY * CELL_SIZE + CELL_SIZE / 2;
    const dist = toGrid(overlay.distanceFt) * CELL_SIZE;
    const halfSpread = (overlay.coneAngle / 2) * (Math.PI / 180);
    const angleRad = overlay.angle * (Math.PI / 180);

    const x1 = startX + dist * Math.cos(angleRad - halfSpread);
    const y1 = startY + dist * Math.sin(angleRad - halfSpread);
    const x2 = startX + dist * Math.cos(angleRad + halfSpread);
    const y2 = startY + dist * Math.sin(angleRad + halfSpread);

    const largeArc = overlay.coneAngle > 180 ? 1 : 0;
    const d = `M ${startX},${startY} L ${x1},${y1} A ${dist},${dist} 0 ${largeArc},1 ${x2},${y2} Z`;

    return (
        <path
            key={overlay.id}
            d={d}
            fill={overlay.color}
            stroke={overlay.color.replace('0.35', '0.8')}
            strokeWidth={2}
            className="spell-overlay"
        />
    );
};

const renderLine = (overlay) => {
    const startX = overlay.startGridX * CELL_SIZE + CELL_SIZE / 2;
    const startY = overlay.startGridY * CELL_SIZE + CELL_SIZE / 2;
    const dist = toGrid(overlay.distanceFt) * CELL_SIZE;
    const w = toGrid(overlay.widthFt) * CELL_SIZE;

    return (
        <g key={overlay.id} transform={`rotate(${overlay.angle}, ${startX}, ${startY})`}>
            <rect
                x={startX}
                y={startY - w / 2}
                width={dist}
                height={w}
                fill={overlay.color}
                stroke={overlay.color.replace('0.35', '0.8')}
                strokeWidth={2}
                className="spell-overlay"
            />
        </g>
    );
};

const SpellOverlayRenderer = ({ overlays = [], pendingOverlay = null }) => {
    const renderOverlay = (overlay) => {
        switch (overlay.shape) {
            case OverlayShape.RADIUS:
                return renderRadius(overlay);
            case OverlayShape.CONE:
                return renderCone(overlay);
            case OverlayShape.LINE:
                return renderLine(overlay);
            default:
                return null;
        }
    };

    return (
        <g className="spell-overlay-group">
            {overlays.map(renderOverlay)}
            {pendingOverlay && renderOverlay(pendingOverlay)}
        </g>
    );
};

export default SpellOverlayRenderer;
