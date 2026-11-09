import { OverlayShape, isValidOverlay, toGrid, svgOrigin, OVERLAY_STROKE_ALPHA } from '../../models/SpellOverlay.js';
import { CELL_SIZE } from '../../config/mapConfig';

const HANDLE_RADIUS = 6;

const overlayStroke = (color) => color.replace(/,\d+(?:\.\d+)?\)$/, `,${OVERLAY_STROKE_ALPHA})`);

const DragHandle = ({ cx, cy, cursor = 'grab', onPointerDown }) => (
    <circle
        cx={cx}
        cy={cy}
        r={HANDLE_RADIUS}
        fill="rgba(255,255,255,0.7)"
        stroke="#333"
        strokeWidth={1.5}
        style={{ cursor }}
        className="spell-overlay-handle"
        onPointerDown={onPointerDown}
    />
);

const renderSphere = (overlay) => {
    const r = toGrid(overlay.radiusFt) * CELL_SIZE;
    const { x: cx, y: cy } = svgOrigin(overlay);
    return (
        <g key={overlay.id} className="spell-overlay-group">
            <circle
                cx={cx}
                cy={cy}
                r={r}
                fill={overlay.color}
                stroke={overlayStroke(overlay.color)}
                strokeWidth={2}
                className="spell-overlay"
            />
            <DragHandle cx={cx} cy={cy} cursor="move" />
        </g>
    );
};

const renderCube = (overlay) => {
    const { x: cx, y: cy } = svgOrigin(overlay);
    const size = toGrid(overlay.sizeFt) * CELL_SIZE;
    return (
        <g key={overlay.id} className="spell-overlay-group">
            <g transform={`rotate(${overlay.angle}, ${cx}, ${cy})`}>
                <rect
                    x={cx - size / 2}
                    y={cy - size / 2}
                    width={size}
                    height={size}
                    fill={overlay.color}
                    stroke={overlayStroke(overlay.color)}
                    strokeWidth={2}
                    className="spell-overlay"
                />
            </g>
            <DragHandle cx={cx} cy={cy} cursor="move" />
        </g>
    );
};

// The tip knob sits at exactly distanceFt where the boundary hit-test misses,
// so it needs its own onPointerDown wired into the hook's rotate lane; without
// a handler (pending draft preview, or a host that passes none) it stays inert
// and drops the grab cursor so the knob never promises a dead click.
const renderCone = (overlay, onRotateStart) => {
    const { x: startX, y: startY } = svgOrigin(overlay);
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
        <g key={overlay.id} className="spell-overlay-group">
            <path
                d={d}
                fill={overlay.color}
                stroke={overlayStroke(overlay.color)}
                strokeWidth={2}
                className="spell-overlay"
            />
            <DragHandle cx={startX} cy={startY} cursor="move" />
            <DragHandle
                cx={x2}
                cy={y2}
                cursor={onRotateStart ? 'grab' : 'default'}
                onPointerDown={onRotateStart ? (e) => onRotateStart(e, overlay) : undefined}
            />
        </g>
    );
};

const renderLine = (overlay, onRotateStart) => {
    const { x: startX, y: startY } = svgOrigin(overlay);
    const dist = toGrid(overlay.distanceFt) * CELL_SIZE;
    const w = toGrid(overlay.widthFt) * CELL_SIZE;
    const endX = startX + dist * Math.cos(overlay.angle * (Math.PI / 180));
    const endY = startY + dist * Math.sin(overlay.angle * (Math.PI / 180));

    return (
        <g key={overlay.id} className="spell-overlay-group">
            <g transform={`rotate(${overlay.angle}, ${startX}, ${startY})`}>
                <rect
                    x={startX}
                    y={startY - w / 2}
                    width={dist}
                    height={w}
                    fill={overlay.color}
                    stroke={overlayStroke(overlay.color)}
                    strokeWidth={2}
                    className="spell-overlay"
                />
            </g>
            <DragHandle cx={startX} cy={startY} cursor="move" />
            <DragHandle
                cx={endX}
                cy={endY}
                cursor={onRotateStart ? 'grab' : 'default'}
                onPointerDown={onRotateStart ? (e) => onRotateStart(e, overlay) : undefined}
            />
        </g>
    );
};

const SpellOverlayRenderer = ({ overlays = [], pendingOverlay = null, onRotateStart = null }) => {
    const renderOverlay = (overlay, interactive) => {
        // Legacy-corrupt rows (junk coord keys, unknown shapes) render NaN
        // geometry or crash color.replace — skip with one console.error so a
        // bad board doc can never spam the console or lock the view
        // (backlog 2026-11-02 BD; the server now 400s these writes).
        if (!isValidOverlay(overlay)) {
            console.error(`SpellOverlayRenderer: skipping malformed overlay ${JSON.stringify(overlay?.id ?? overlay) ?? String(overlay)}`);
            return null;
        }
        switch (overlay.shape) {
            case OverlayShape.SPHERE:
                return renderSphere(overlay);
            case OverlayShape.CYLINDER:
                return renderSphere(overlay);
            case OverlayShape.CUBE:
                return renderCube(overlay);
            case OverlayShape.CONE:
                return renderCone(overlay, interactive ? onRotateStart : null);
            case OverlayShape.LINE:
                return renderLine(overlay, interactive ? onRotateStart : null);
            default:
                return null;
        }
    };

    return (
        <g className="spell-overlay-layer">
            {overlays.map((overlay) => renderOverlay(overlay, true))}
            {pendingOverlay && renderOverlay(pendingOverlay, false)}
        </g>
    );
};

export default SpellOverlayRenderer;
