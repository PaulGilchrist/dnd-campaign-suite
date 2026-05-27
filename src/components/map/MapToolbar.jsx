import * as mapsService from '../../services/mapsService.js';

const MapToolbar = ({
    mapName,
    isLocalhost,
    tool,
    setTool,
    gridSize,
    setGridSize,
    setItemsPanelOpen,
    handleClearWalls,
    zoomIn,
    zoomOut,
    resetView,
    onBack
}) => {
    return (
        <div className="toolbar-row no-print">
            {onBack && (
                <button onClick={onBack} title="Back" className="toolbar-back-btn">
                    <i className="fa-solid fa-arrow-left"></i>
                </button>
            )}
            <h4>{mapsService.formatMapName(mapName) || 'Map'}</h4>
            {isLocalhost && (
                <label className="grid-size-label">
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
            <div className="toolbar">
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
                        <button onClick={handleClearWalls}>
                            <i className="fa-solid fa-trash"></i> Clear Walls
                        </button>
                    </>
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
    );
};

export default MapToolbar;
