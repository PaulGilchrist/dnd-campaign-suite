import React from 'react';
import { TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER, TOOL_TRAVEL, TOOL_ROAD } from '../../config/outdoorConfig';

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
    marchingOrderOpen,
    setMarchingOrderOpen,
    marchingOrder,
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

            {/* River tool */}
            <button
                className={tool === TOOL_RIVER ? 'active' : ''}
                onClick={() => setTool(tool === TOOL_RIVER ? TOOL_NONE : TOOL_RIVER)}
                title="Paint rivers"
            >
                <i className="fa-solid fa-water"></i>
            </button>
            {/* Road tool */}
            <button
                className={tool === TOOL_ROAD ? 'active' : ''}
                onClick={() => setTool(tool === TOOL_ROAD ? TOOL_NONE : TOOL_ROAD)}
                title="Connect cities and settlements with roads"
            >
                <i className="fa-solid fa-road"></i>
            </button>

            {/* Travel tool */}
            <button
                className={tool === TOOL_TRAVEL ? 'active' : ''}
                onClick={() => setTool(tool === TOOL_TRAVEL ? TOOL_NONE : TOOL_TRAVEL)}
                title="Travel mode — plan and execute overland travel"
            >
                <i className="fa-solid fa-route"></i>
            </button>

            {/* POI panel toggle */}
            <button
                onClick={() => setPoiPanelOpen(!poiPanelOpen)}
                title={poiPanelOpen ? 'Close POI panel' : 'Open POI panel'}
                className={poiPanelOpen ? 'active' : ''}
            >
                <i className="fa-solid fa-layer-group"></i>
            </button>

            {/* Marching order toggle */}
            <button
                onClick={() => setMarchingOrderOpen(!marchingOrderOpen)}
                title={marchingOrderOpen ? 'Close marching order' : 'Manage marching order'}
                className={marchingOrderOpen ? 'active' : ''}
            >
                <i className="fa-solid fa-people-group"></i>
                {marchingOrder.length > 0 && (
                    <span className="hex-map-poi-indicator">{marchingOrder.length}</span>
                )}
            </button>

            {/* Zoom controls */}
            <div className="hex-map-zoom-controls">
                <button onClick={zoomIn} title="Zoom in">
                    <i className="fa-solid fa-plus"></i>
                </button>
                <span>{Math.round(zoom * 50)}%</span>
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
                        min="30"
                        max="100"
                        value={gridSize}
                        onChange={(e) => setGridSize(Number(e.target.value))}
                    />
                    <span className="hex-map-grid-hint">{gridSize * 2}×{gridSize}</span>
                </label>
            </div>
        </div>
    );
}

export default HexMapToolbar;
