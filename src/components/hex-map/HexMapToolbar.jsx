import React from 'react';
import { TOOL_NONE, TOOL_PAINT, TOOL_ERASE } from '../../config/outdoorConfig';

function HexMapToolbar({
    onBack,
    mapName,
    tool,
    setTool,
    selectedTerrain,
    setSelectedTerrain,
    terrainTypes,
    zoomIn, zoomOut, resetView,
    zoom,
    poiPanelOpen,
    setPoiPanelOpen,
    gridSize,
    setGridSize,
}) {
    return (
        <div className="hex-map-toolbar">
            <button onClick={onBack} title="Back to maps">
                <i className="fa-solid fa-arrow-left"></i>
            </button>
            <span className="hex-map-title">{mapName}</span>

            {/* Terrain tools */}
            <button
                className={tool === TOOL_PAINT ? 'active' : ''}
                onClick={() => setTool(tool === TOOL_PAINT ? TOOL_NONE : TOOL_PAINT)}
                title="Paint terrain"
            >
                <i className="fa-solid fa-paint-brush"></i>
            </button>
            <button
                className={tool === TOOL_ERASE ? 'active' : ''}
                onClick={() => setTool(tool === TOOL_ERASE ? TOOL_NONE : TOOL_ERASE)}
                title="Erase terrain"
            >
                <i className="fa-solid fa-eraser"></i>
            </button>

            {/* Terrain selector — visible when paint or erase is active */}
            {(tool === TOOL_PAINT || tool === TOOL_ERASE) && (
                <div className="terrain-selector">
                    {terrainTypes.map(t => (
                        <div
                            key={t.id}
                            className={`terrain-swatch ${selectedTerrain === t.id ? 'active' : ''}`}
                            style={{ backgroundColor: t.fill }}
                            onClick={() => { setSelectedTerrain(t.id); setTool(TOOL_PAINT); }}
                            title={t.name}
                        />
                    ))}
                </div>
            )}

            {/* POI panel toggle */}
            <button
                onClick={() => setPoiPanelOpen(!poiPanelOpen)}
                title={poiPanelOpen ? 'Close POI panel' : 'Open POI panel'}
                className={poiPanelOpen ? 'active' : ''}
            >
                <i className="fa-solid fa-layer-group"></i>
            </button>

            {/* Zoom controls */}
            <div className="hex-map-zoom-controls">
                <button onClick={zoomIn} title="Zoom in">
                    <i className="fa-solid fa-plus"></i>
                </button>
                <span>{Math.round(zoom * 100)}%</span>
                <button onClick={zoomOut} title="Zoom out">
                    <i className="fa-solid fa-minus"></i>
                </button>
                <button onClick={resetView} title="Reset view">
                    <i className="fa-solid fa-expand"></i>
                </button>
            </div>

            {/* Grid size */}
            <div className="hex-map-grid-size">
                <label>
                    Grid:
                    <input
                        type="number"
                        min="5"
                        max="100"
                        value={gridSize}
                        onChange={(e) => setGridSize(Number(e.target.value))}
                    />
                </label>
            </div>
        </div>
    );
}

export default HexMapToolbar;
