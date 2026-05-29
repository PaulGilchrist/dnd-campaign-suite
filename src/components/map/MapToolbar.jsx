import { useCallback } from 'react';
import * as mapsService from '../../services/mapsService.js';
import SpellOverlayControls from './SpellOverlayControls.jsx';

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

    const cancelSpellMode = useCallback(() => {
        setSpellMode(null);
    }, [setSpellMode]);

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
                    {isLocalhost && (
                        <>
                            <button
                                className={tool === 'paint' ? 'active' : ''}
                                onClick={() => setTool(tool === 'paint' ? 'none' : 'paint')}
                            >
                                <i className="fa-solid fa-paint-brush"></i> Paint
                            </button>
                            <button
                                className={tool === 'erase' ? 'active' : ''}
                                onClick={() => setTool(tool === 'erase' ? 'none' : 'erase')}
                            >
                                <i className="fa-solid fa-eraser"></i> Erase
                            </button>
                            <button
                                className={tool === 'select' ? 'active' : ''}
                                onClick={() => setTool(tool === 'select' ? 'none' : 'select')}
                            >
                                <i className="fa-solid fa-arrow-pointer"></i> Select
                            </button>
                        </>
                    )}
                    <button
                        className={spellMode ? 'active' : ''}
                        onClick={() => {
                            if (spellMode) {
                                setSpellMode(null);
                            } else {
                                setTool('none');
                                setSpellMode(selectedShape || 'radius');
                            }
                        }}
                    >
                        <i className="fa-solid fa-wand-magic-sparkles"></i> Spell
                    </button>
                    <button
                        className={rulerMode ? 'active' : ''}
                        onClick={() => setRulerMode(!rulerMode)}
                    >
                        <i className="fa-solid fa-ruler"></i> Ruler
                    </button>
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
                    setSelectedShape={(shape) => {
                        setSelectedShape(shape);
                        setSpellMode(shape);
                    }}
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
