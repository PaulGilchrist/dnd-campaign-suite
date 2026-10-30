import * as mapsService from '../../services/maps/mapsService.js';
import SpellOverlayControls from './SpellOverlayControls.jsx';
import { OverlayShape } from '../../models/SpellOverlay.js';

const TOGGLE_TOOLS = [
    { tool: 'paint', icon: 'fa-paint-brush', label: 'Paint' },
    { tool: 'erase', icon: 'fa-eraser', label: 'Erase' },
    { tool: 'select', icon: 'fa-arrow-pointer', label: 'Select' },
];

const MapToolbar = ({
    mapName,
    displayName,
    isLocalhost,
    tool,
    setTool,
    gridSize,
    setGridSize,
    setItemsPanelOpen,
    zoomIn,
    zoomOut,
    resetView,
    resetFog,
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
        // Defensive-only: the sole production producer (Map.jsx) always passes a
        // full overlay state. With no setSpellMode the mode can never engage, so
        // the honest click is a total inert no-op — not a half-action that drops
        // the paint tool without arming spell mode (#928a).
        if (!setSpellMode) return;
        if (spellMode) {
            setSpellMode(null);
        } else {
            setTool('none');
            // Interlock: arming the wand disarms the ruler. Without this the
            // wand UI arms but useSpellHandlers' rulerMode gate silently
            // swallows every canvas click (ruler-not-interlocked bug, face a).
            if (rulerMode) setRulerMode(false);
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
                    <button onClick={onBack} title="Back" aria-label="Back" className="toolbar-back-btn no-print">
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                )}
                <h4>{displayName || mapsService.formatMapName(mapName) || 'Map'}</h4>
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
                            aria-label={label}
                            onClick={() => {
                                const next = tool === t ? 'none' : t;
                                setTool(next);
                                // Interlock: arming a canvas tool disarms the
                                // ruler so one pointerdown is never both a
                                // measurement point and a wall edit.
                                if (next !== 'none' && rulerMode) setRulerMode(false);
                            }}
                        >
                            <i className={`fa-solid ${icon}`}></i> {label}
                        </button>
                    ))}
                    {/* Spell tool — binary toggle: aria-pressed mirrors the .active
                        class (HexMapToolbar travel-button pattern) so SRs and
                        harnesses can read armed/disarmed without probing the
                        controls panel. */}
                    <button
                        className={spellMode ? 'active' : ''}
                        aria-label="Spell"
                        aria-pressed={!!spellMode}
                        onClick={toggleSpellMode}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Spell
                    </button>
                    {/* Ruler tool — binary toggle: aria-pressed mirrors the .active
                        class (Spell-button/HexMapToolbar travel-button pattern) so
                        SRs and harnesses can read armed/disarmed without probing
                        the .ruler-hint panel. */}
                    <button
                        className={rulerMode ? 'active' : ''}
                        aria-label="Ruler"
                        aria-pressed={!!rulerMode}
                        onClick={() => setRulerMode(!rulerMode)}
                    >
                        <i className="fa-solid fa-ruler"></i> Ruler
                    </button>
                    {onEnter3D && (
                        <button onClick={onEnter3D} title="View map in 3D" aria-label="View map in 3D">
                            <i className="fa-solid fa-cube"></i> 3D
                        </button>
                    )}
                    {isLocalhost && (
                        <button onClick={() => setItemsPanelOpen(prev => !prev)} aria-label="Items">
                            <i className="fa-solid fa-box"></i> Items
                        </button>
                    )}
                    <button onClick={zoomIn} aria-label="Zoom in">
                        <i className="fa-solid fa-magnifying-glass-plus"></i>
                    </button>
                    <button onClick={zoomOut} aria-label="Zoom out">
                        <i className="fa-solid fa-magnifying-glass-minus"></i>
                    </button>
                    {isLocalhost ? (
                        <button onClick={() => { resetView(); resetFog(); }} title="Reset fog of war and view" aria-label="Reset Fog">
                            <i className="fa-solid fa-rotate-left"></i> Reset Fog
                        </button>
                    ) : (
                        <button onClick={resetView} title="Reset view" aria-label="Reset View">
                            <i className="fa-solid fa-rotate-left"></i> Reset View
                        </button>
                    )}
                </div>
            </div>
            {/* Truthy gate unifies the falsy arms: '' and null render identically
                (no controls, inactive button) — spellMode is only ever null or a
                non-empty OverlayShape from its producers, and every downstream
                consumer tests truthiness, so '' means inactive (#928b). */}
            {!!spellMode && (
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
