import { OverlayShape, SHAPE_LABELS, DEFAULTS, isValidOverlay } from '../../models/SpellOverlay.js';

const PARAM_FIELDS = {
    [OverlayShape.SPHERE]: [
        { param: 'radiusFt', label: 'Radius (ft)', min: '5', step: '5', fallback: 20 },
    ],
    [OverlayShape.CYLINDER]: [
        { param: 'radiusFt', label: 'Radius (ft)', min: '5', step: '5', fallback: 20 },
    ],
    [OverlayShape.CUBE]: [
        { param: 'sizeFt', label: 'Size (ft)', min: '5', step: '5', fallback: 15 },
    ],
    [OverlayShape.CONE]: [
        { param: 'distanceFt', label: 'Distance (ft)', min: '5', step: '5', fallback: 60 },
        { param: 'coneAngle', label: 'Angle (°)', min: '1', max: '360', fallback: 90 },
    ],
    [OverlayShape.LINE]: [
        { param: 'distanceFt', label: 'Distance (ft)', min: '5', step: '5', fallback: 60 },
        { param: 'widthFt', label: 'Width (ft)', min: '5', step: '5', fallback: 5 },
    ],
};

const DRAG_HINT_SHAPES = [OverlayShape.CONE, OverlayShape.LINE, OverlayShape.CUBE];

const ShapeParamField = ({ field, value, onChange, disabled }) => (
    <label>
        {field.label}&nbsp;
        <input
            type="number"
            min={field.min}
            step={field.step}
            max={field.max}
            value={value || field.fallback}
            onChange={(e) => onChange(field.param, e.target.value)}
            disabled={disabled}
        />
    </label>
);

const ShapeParamsRow = ({ selectedShape, shapeParams, handleParamChange, isActive }) => {
    const fields = PARAM_FIELDS[selectedShape];
    if (!fields) {
        return null;
    }
    return (
        <>
            <div className="spell-overlay-row">
                {fields.map((field) => (
                    <ShapeParamField
                        key={field.param}
                        field={field}
                        value={shapeParams[field.param]}
                        onChange={handleParamChange}
                        disabled={!isActive}
                    />
                ))}
            </div>
            {/* Placement-inviting copy: only while armed (backlog 2026-11-09
                ER) — an unarmed manage-only face must not hint at a placement. */}
            {isActive && (
                <div className="spell-overlay-hint">
                    Params apply to the next placement only
                </div>
            )}
        </>
    );
};

// Active-chip label: shape name + origin cell, e.g. "Sphere (12,8)" — with
// 2+ zones the bare shape name is anonymous, so the × couldn't say WHICH
// zone it removes (backlog 2026-11-08 EQ). Same `Name (x,y)` disambiguation
// shape as placedItemLabel (hooks/usePlacedItems.js). Rows reaching here are
// pre-screened by isValidOverlay, so the coords are always finite.
const overlayChipLabel = (overlay) =>
    `${SHAPE_LABELS[overlay.shape] || overlay.shape} (${overlay.startGridX},${overlay.startGridY})`;

const ActiveOverlays = ({ overlays, onClearAll, onRemoveOverlay }) => (
    <div className="spell-overlay-active">
        <div className="spell-overlay-active-header">
            Active ({overlays.length})
            <button className="spell-overlay-clear-btn" onClick={onClearAll}>
                Clear All
            </button>
        </div>
        {overlays.map((o) => {
            const label = overlayChipLabel(o);
            return (
                <div key={o.id} className="spell-overlay-item" title={label}>
                    <span>{label}</span>
                    <button
                        aria-label={`Remove overlay at (${o.startGridX},${o.startGridY})`}
                        onClick={() => onRemoveOverlay(o.id)}
                    >
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>
            );
        })}
    </div>
);

const SpellOverlayControls = ({
    selectedShape,
    setSelectedShape,
    shapeParams,
    setShapeParams,
    overlays,
    onRemoveOverlay,
    onClearAll,
    onCancelMode,
    isActive,
}) => {
    const handleParamChange = (param, value) => {
        const numValue = parseFloat(value) || 0;
        setShapeParams(prev => ({ ...prev, [param]: numValue }));
    };

    const handleShapeChange = (e) => {
        const shape = e.target.value;
        setSelectedShape(shape);
        setShapeParams(DEFAULTS[shape]);
    };

    // Malformed board rows (junk coord keys — the server now 400s these
    // writes, but legacy docs persist) get no panel row and no vote in the
    // Active count; SpellOverlayRenderer skips them with a console.error
    // (backlog 2026-11-02 BD — phantom "Active (1)" over an empty board).
    const visibleOverlays = overlays.filter(isValidOverlay);

    return (
        <div className="spell-overlay-controls">
            <div className="spell-overlay-header">
                <i className="fa-solid fa-wand-magic-sparkles"></i> Spell Overlay
            </div>

            <div className="spell-overlay-row">
                <label>
                    Shape&nbsp;
                    {/* Manage-only face (backlog 2026-11-09 ER): with zones on
                        the board but the wand UNARMED the whole param section
                        (shape picker + fields) renders disabled/dimmed — a map
                        click places nothing until the Spell toggle arms. */}
                    <select value={selectedShape} onChange={handleShapeChange} disabled={!isActive}>
                        {Object.entries(SHAPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>{label}</option>
                        ))}
                    </select>
                </label>
                {isActive && (
                    <button className="spell-overlay-cancel-btn" onClick={onCancelMode}>
                        <i className="fa-solid fa-times"></i> Cancel
                    </button>
                )}
            </div>

            <ShapeParamsRow
                selectedShape={selectedShape}
                shapeParams={shapeParams}
                handleParamChange={handleParamChange}
                isActive={isActive}
            />

            {isActive && (
                <div className="spell-overlay-hint">
                    Click map to place{DRAG_HINT_SHAPES.includes(selectedShape) ? ', drag for angle' : ''}
                </div>
            )}

            {visibleOverlays.length > 0 && (
                <ActiveOverlays
                    overlays={visibleOverlays}
                    onClearAll={onClearAll}
                    onRemoveOverlay={onRemoveOverlay}
                />
            )}
        </div>
    );
};

export default SpellOverlayControls;
