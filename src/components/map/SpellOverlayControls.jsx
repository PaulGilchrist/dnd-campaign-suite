import { OverlayShape, DEFAULTS } from '../../models/SpellOverlay.js';

const SHAPE_LABELS = {
    [OverlayShape.SPHERE]: 'Sphere',
    [OverlayShape.CYLINDER]: 'Cylinder',
    [OverlayShape.CUBE]: 'Cube',
    [OverlayShape.CONE]: 'Cone',
    [OverlayShape.LINE]: 'Line',
};

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

const ShapeParamField = ({ field, value, onChange }) => (
    <label>
        {field.label}&nbsp;
        <input
            type="number"
            min={field.min}
            step={field.step}
            max={field.max}
            value={value || field.fallback}
            onChange={(e) => onChange(field.param, e.target.value)}
        />
    </label>
);

const ShapeParamsRow = ({ selectedShape, shapeParams, handleParamChange }) => {
    const fields = PARAM_FIELDS[selectedShape];
    if (!fields) {
        return null;
    }
    return (
        <div className="spell-overlay-row">
            {fields.map((field) => (
                <ShapeParamField
                    key={field.param}
                    field={field}
                    value={shapeParams[field.param]}
                    onChange={handleParamChange}
                />
            ))}
        </div>
    );
};

const ActiveOverlays = ({ overlays, onClearAll, onRemoveOverlay }) => (
    <div className="spell-overlay-active">
        <div className="spell-overlay-active-header">
            Active ({overlays.length})
            <button className="spell-overlay-clear-btn" onClick={onClearAll}>
                Clear All
            </button>
        </div>
        {overlays.map((o) => (
            <div key={o.id} className="spell-overlay-item">
                <span>{SHAPE_LABELS[o.shape] || o.shape}</span>
                <button onClick={() => onRemoveOverlay(o.id)}>
                    <i className="fa-solid fa-times"></i>
                </button>
            </div>
        ))}
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

    return (
        <div className="spell-overlay-controls">
            <div className="spell-overlay-header">
                <i className="fa-solid fa-wand-magic-sparkles"></i> Spell Overlay
            </div>

            <div className="spell-overlay-row">
                <label>
                    Shape&nbsp;
                    <select value={selectedShape} onChange={handleShapeChange}>
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
            />

            {isActive && (
                <div className="spell-overlay-hint">
                    Click map to place{DRAG_HINT_SHAPES.includes(selectedShape) ? ', drag for angle' : ''}
                </div>
            )}

            {overlays.length > 0 && (
                <ActiveOverlays
                    overlays={overlays}
                    onClearAll={onClearAll}
                    onRemoveOverlay={onRemoveOverlay}
                />
            )}
        </div>
    );
};

export default SpellOverlayControls;
