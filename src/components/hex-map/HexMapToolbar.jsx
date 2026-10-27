import { TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER, TOOL_TRAVEL, TOOL_ROAD } from '../../config/outdoorConfig';

// One open/closed copy pair feeds title AND aria-label (a0211afcb pattern:
// icon-only buttons mirror their title into the accessible name).
const toggleLabel = (open, openLabel, closeLabel) => (open ? closeLabel : openLabel);

function HexMapToolbar({
    onBack,
    mapName,
    displayName,
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
    const poiLabel = toggleLabel(poiPanelOpen, 'Open POI panel', 'Close POI panel');
    const marchingLabel = toggleLabel(marchingOrderOpen, 'Manage marching order', 'Close marching order');
    return (
        <div className="hex-map-toolbar">
            <button onClick={onBack} title="Back to maps" aria-label="Back to maps" className="no-print">
                <i className="fa-solid fa-arrow-left"></i>
            </button>
            <span className="hex-map-title">{displayName || mapName}</span>

            {/* Terrain tools */}
            <button
                className={tool === TOOL_PAINT ? 'active no-print' : 'no-print'}
                onClick={() => setTool(tool === TOOL_PAINT ? TOOL_NONE : TOOL_PAINT)}
                title="Paint terrain"
                aria-label="Paint terrain"
            >
                <i className="fa-solid fa-paint-brush"></i>
            </button>
            <button
                className={tool === TOOL_ERASE ? 'active no-print' : 'no-print'}
                onClick={() => setTool(tool === TOOL_ERASE ? TOOL_NONE : TOOL_ERASE)}
                title="Erase terrain paint (re-click Paint rivers tool to remove river hexes)"
                aria-label="Erase terrain"
            >
                <i className="fa-solid fa-eraser"></i>
            </button>

            {/* Terrain selector — visible when paint or erase is active */}
            {(tool === TOOL_PAINT || tool === TOOL_ERASE) && (
                <div className="terrain-selector no-print">
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
                className={tool === TOOL_RIVER ? 'active no-print' : 'no-print'}
                onClick={() => setTool(tool === TOOL_RIVER ? TOOL_NONE : TOOL_RIVER)}
                title="Paint rivers"
                aria-label="Paint rivers"
            >
                <i className="fa-solid fa-water"></i>
            </button>
            {/* Road tool */}
            <button
                className={tool === TOOL_ROAD ? 'active no-print' : 'no-print'}
                onClick={() => setTool(tool === TOOL_ROAD ? TOOL_NONE : TOOL_ROAD)}
                title="Connect cities and settlements with roads"
                aria-label="Connect cities and settlements with roads"
            >
                <i className="fa-solid fa-road"></i>
            </button>

            {/* Travel tool — binary toggle: aria-pressed mirrors the .active
                class (SessionSection.jsx pattern) so SRs announce on/off. */}
            <button
                className={tool === TOOL_TRAVEL ? 'active no-print' : 'no-print'}
                aria-pressed={tool === TOOL_TRAVEL}
                onClick={() => setTool(tool === TOOL_TRAVEL ? TOOL_NONE : TOOL_TRAVEL)}
                title="Travel mode — plan and execute overland travel"
                aria-label="Travel mode — plan and execute overland travel"
            >
                <i className="fa-solid fa-route"></i>
            </button>

            {/* POI panel toggle */}
            <button
                onClick={() => setPoiPanelOpen(!poiPanelOpen)}
                title={poiLabel}
                aria-label={poiLabel}
                className={poiPanelOpen ? 'active no-print' : 'no-print'}
            >
                <i className="fa-solid fa-layer-group"></i>
            </button>

            {/* Marching order toggle */}
            <button
                onClick={() => setMarchingOrderOpen(!marchingOrderOpen)}
                title={marchingLabel}
                aria-label={marchingLabel}
                className={marchingOrderOpen ? 'active no-print' : 'no-print'}
            >
                <i className="fa-solid fa-people-group"></i>
                {marchingOrder.length > 0 && (
                    <span className="hex-map-poi-indicator">{marchingOrder.length}</span>
                )}
            </button>

            {/* Print */}
            <button onClick={() => window.print()} title="Print map" aria-label="Print map" className="no-print">
                <i className="fa-solid fa-print"></i>
            </button>

            {/* Zoom controls */}
            <div className="hex-map-zoom-controls no-print">
                <button onClick={zoomIn} title="Zoom in" aria-label="Zoom in">
                    <i className="fa-solid fa-plus"></i>
                </button>
                <span>{Math.round(zoom * 50)}%</span>
                <button onClick={zoomOut} title="Zoom out" aria-label="Zoom out">
                    <i className="fa-solid fa-minus"></i>
                </button>
                <button onClick={resetView} title="Reset view" aria-label="Reset view">
                    <i className="fa-solid fa-expand"></i>
                </button>
            </div>

            {/* Grid size */}
            <div className="hex-map-grid-size no-print">
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
