import * as mapsService from '../../services/maps/mapsService.js';
import SpellOverlayControls from './SpellOverlayControls.jsx';
import { OverlayShape } from '../../models/SpellOverlay.js';

const TOGGLE_TOOLS = [
    { tool: 'paint', icon: 'fa-paint-brush', label: 'Paint' },
    { tool: 'erase', icon: 'fa-eraser', label: 'Erase' },
    { tool: 'select', icon: 'fa-arrow-pointer', label: 'Select' },
    { tool: 'room', icon: 'fa-vector-square', label: 'Room' },
];

const MapToolbar = ({
    mapName,
    isLocalhost,
    tool,
    setTool,
    gridSize,
    setGridSize,
    setItemsPanelOpen,
    zoomIn,
    zoomOut,
    resetView,
    onBack,
    rulerMode,
    setRulerMode,
    onEnter3D,
    spellOverlayState,
}) => {
    const {
        spellMode,
        setSpellMode,
        selectedShape,
        setSelectedShape,
        shapeParams,
        setShapeParams,
        overlays,
        removeOverlay,
        clearOverlays,
    } = spellOverlayState || {};

    const toggleSpellMode = () => {
        if (spellMode) {
            setSpellMode(null);
        } else {
            setTool('none');
            setSpellMode(selectedShape || OverlayShape.SPHERE);
        }
    };

    const onSelectShape = (shape) => {
        setSelectedShape(shape);
        setSpellMode(shape);
    };

    return (
        <>
            <div className="toolbar-row">
                {onBack && (
                    <button onClick={onBack} title="Back" className="toolbar-back-btn no-print">
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                )}
                <h4>{mapsService.formatMapName(mapName) || 'Map'}</h4>
                {isLocalhost && (
                    <label className="grid-size-label no-print">
                        Grid Size&nbsp;&nbsp;
                        <input
                            type="number"
                            min="5"
                            max="100"
                            value={gridSize}
                            onChange={(e) => setGridSize(Number(e.target.value))}
                            className="grid-size-input"
                        />
                    </label>
                )}
                <div className="toolbar no-print">
                    {isLocalhost && TOGGLE_TOOLS.map(({ tool: t, icon, label }) => (
                        <button
                            key={t}
                            className={tool === t ? 'active' : ''}
                            onClick={() => setTool(tool === t ? 'none' : t)}
                        >
                            <i className={`fa-solid ${icon}`}></i> {label}
                        </button>
                    ))}
                    <button
                        className={spellMode ? 'active' : ''}
                        onClick={toggleSpellMode}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Spell
                    </button>
                    <button
                        className={rulerMode ? 'active' : ''}
                        onClick={() => setRulerMode(!rulerMode)}
                    >
                        <i className="fa-solid fa-ruler"></i> Ruler
                    </button>
                    {onEnter3D && (
                        <button onClick={onEnter3D} title="View map in 3D">
                            <i className="fa-solid fa-cube"></i> 3D
                        </button>
                    )}
                    {isLocalhost && (
                        <button onClick={() => setItemsPanelOpen(prev => !prev)}>
                            <i className="fa-solid fa-box"></i> Items
                        </button>
                    )}
                    <button onClick={zoomIn}>
                        <i className="fa-solid fa-magnifying-glass-plus"></i>
                    </button>
                    <button onClick={zoomOut}>
                        <i className="fa-solid fa-magnifying-glass-minus"></i>
                    </button>
                    <button onClick={resetView}>
                        <i className="fa-solid fa-rotate-left"></i> Reset View
                    </button>
                </div>
            </div>
            {spellMode !== null && spellMode !== undefined && (
                <SpellOverlayControls
                    selectedShape={selectedShape}
                    setSelectedShape={onSelectShape}
                    shapeParams={shapeParams}
                    setShapeParams={setShapeParams}
                    overlays={overlays}
                    onRemoveOverlay={removeOverlay}
                    onClearAll={clearOverlays}
                    onCancelMode={() => setSpellMode(null)}
                    isActive={!!spellMode}
                />
            )}
            {rulerMode && (
                <div className="ruler-hint">
                    <i className="fa-solid fa-ruler"></i> Click two points to measure distance
                </div>
            )}
        </>
    );
};

export default MapToolbar;
