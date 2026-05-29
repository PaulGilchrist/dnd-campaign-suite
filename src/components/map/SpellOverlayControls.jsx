import { OverlayShape, DEFAULTS } from '../../models/SpellOverlay.js';

const SHAPE_LABELS = {
    [OverlayShape.RADIUS]: 'Radius',
    [OverlayShape.CONE]: 'Cone',
    [OverlayShape.LINE]: 'Line',
};

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

            {selectedShape === OverlayShape.RADIUS && (
                <div className="spell-overlay-row">
                    <label>
                        Radius (ft)&nbsp;
                        <input
                            type="number"
                            min="5"
                            step="5"
                            value={shapeParams.radiusFt || 20}
                            onChange={(e) => handleParamChange('radiusFt', e.target.value)}
                        />
                    </label>
                </div>
            )}

            {selectedShape === OverlayShape.CONE && (
                <div className="spell-overlay-row">
                    <label>
                        Distance (ft)&nbsp;
                        <input
                            type="number"
                            min="5"
                            step="5"
                            value={shapeParams.distanceFt || 60}
                            onChange={(e) => handleParamChange('distanceFt', e.target.value)}
                        />
                    </label>
                    <label>
                        Angle (°)&nbsp;
                        <input
                            type="number"
                            min="1"
                            max="360"
                            value={shapeParams.coneAngle || 90}
                            onChange={(e) => handleParamChange('coneAngle', e.target.value)}
                        />
                    </label>
                </div>
            )}

            {selectedShape === OverlayShape.LINE && (
                <div className="spell-overlay-row">
                    <label>
                        Distance (ft)&nbsp;
                        <input
                            type="number"
                            min="5"
                            step="5"
                            value={shapeParams.distanceFt || 60}
                            onChange={(e) => handleParamChange('distanceFt', e.target.value)}
                        />
                    </label>
                    <label>
                        Width (ft)&nbsp;
                        <input
                            type="number"
                            min="5"
                            step="5"
                            value={shapeParams.widthFt || 5}
                            onChange={(e) => handleParamChange('widthFt', e.target.value)}
                        />
                    </label>
                </div>
            )}

            {isActive && (
                <div className="spell-overlay-hint">
                    Click map to place{selectedShape !== OverlayShape.RADIUS && ', drag for angle'}
                </div>
            )}

            {overlays.length > 0 && (
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
            )}
        </div>
    );
};

export default SpellOverlayControls;
