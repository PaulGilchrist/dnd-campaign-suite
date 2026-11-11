import { TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_RIVER, TOOL_TRAVEL, TOOL_ROAD } from '../../config/outdoorConfig';
import { backToMapLabel } from '../../services/maps/backToMapLabel.js';

// One open/closed copy pair feeds title AND aria-label (a0211afcb pattern:
// icon-only buttons mirror their title into the accessible name).
const toggleLabel = (open, openLabel, closeLabel) => (open ? closeLabel : openLabel);

// GM-only editor-tools cluster (terrain paint/erase + selector, rivers,
// roads). Split out of HexMapToolbar (ESLint complexity ceiling) — the host
// renders it only when isLocalhost; see the toolbar gate for the why.
function EditorTools({ tool, setTool, selectedTerrain, setSelectedTerrain, terrainTypes }) {
    return (<>
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
    </>);
}

function HexMapToolbar({
    onBack,
    // Current map-history top ({ mapName, mapDisplayName } | null) — while
    // non-null the back button names the map its press pops open instead of
    // the static "Back to maps" (backlog 2026-11-11 JV, label only — the
    // press behaviour is App.handleBackFromMap, unchanged).
    backMapTarget,
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
    // Committed travel-open face (see the travel button block): mirrors the
    // TravelPanel mount one-for-one. Hosts without the prop (legacy renders)
    // get a never-pressed face.
    travelActive = false,
    dressButton,
    onEnter3D,
    isLocalhost = false,
}) {
    const poiLabel = toggleLabel(poiPanelOpen, 'Open POI panel', 'Close POI panel');
    const marchingLabel = toggleLabel(marchingOrderOpen, 'Manage marching order', 'Close marching order');
    // Empty stack (or legacy hosts passing no target) → byte-identical
    // "Back to maps"; armed stack → names the popped map (JV label fix).
    const backLabel = backToMapLabel(backMapTarget);
    return (
        <div className="hex-map-toolbar">
            <button onClick={onBack} title={backLabel} aria-label={backLabel} className="no-print">
                <i className="fa-solid fa-arrow-left"></i>
            </button>
            <span className="hex-map-title">{displayName || mapName}</span>

            {/* Editor tools (terrain/erase/rivers/roads) + grid sizing — GM
                (localhost) only, mirroring the dressButton host gate above
                (bug-lan-player-terrain-paint-persists): a network client gets
                the read-only view, so these never arm and never queue a PUT
                the server would 403 (outdoorEditorDelta in maps.js). Travel,
                POI panel, marching order and the 3D view stay shared lanes. */}
            {isLocalhost && (
                <EditorTools
                    tool={tool}
                    setTool={setTool}
                    selectedTerrain={selectedTerrain}
                    setSelectedTerrain={setSelectedTerrain}
                    terrainTypes={terrainTypes}
                />
            )}

            {/* Travel tool — COMMITTED-FACE button (improve JT 2026-11-11
                parity): .active AND aria-pressed both read `travelActive`,
                the ONE committed boolean the host also mounts TravelPanel
                on (useTravelToolSync's return — same value, same commit),
                so panel-open ⇔ aria-pressed=true holds at every sample
                point. `tool` stays the press-intent/canvas-arming channel:
                the click still toggles the tool, and useTravelToolSync's
                branches turn that intent into the committed travel-mode
                byte (activate / deliberate-exit / mirror / hold). A press
                whose activation did not land (flaky fresh-mount absorb)
                leaves travel inactive — both faces stay false together, an
                honest, probeable "not open" instead of a ghost .active. */}
            <button
                className={travelActive ? 'active no-print' : 'no-print'}
                aria-pressed={travelActive}
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

            {/* AI Dress mount (backlog ai-dress-belongs-in-map-view): the host
                HexMap supplies the localhost-gated AiDressButton (hex maps dress
                POIs via q,r addressing) so the GM instructs with the grid in
                view. Players/hosts without the prop pass nothing → no button. */}
            {dressButton}

            {/* 3D diorama entry — the indoor MapToolbar.jsx twin (title AND
                aria-label mirror; button renders only when the host provides
                the handler). Read-only view, players included. */}
            {onEnter3D && (
                <button onClick={onEnter3D} title="View map in 3D" aria-label="View map in 3D">
                    <i className="fa-solid fa-cube"></i> 3D
                </button>
            )}

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

            {/* Grid size — editor scope (gridSize PUTs the document; the
                server 403s the delta from LAN), so GM-only like the tools. */}
            {isLocalhost && (
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
            )}
        </div>
    );
}

export default HexMapToolbar;
