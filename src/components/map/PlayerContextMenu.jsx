function PlayerContextMenu({ selectedPlayer, gridCenterX, gridCenterY, handleRemovePlayer, setSelectedPlayer }) {
    if (!selectedPlayer) return null;

    const menuX = gridCenterX(selectedPlayer.gridX) + 10;
    const menuY = gridCenterY(selectedPlayer.gridY) + 10;

    return (
        <g className="item-context-menu" onClick={(e) => e.stopPropagation()}>
            <g>
                <rect x={menuX} y={menuY} width="120" height="36" rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                <text
                    x={menuX + 8}
                    y={menuY + 24}
                    fill="#ccc"
                    fontSize="11"
                    className="menu-option"
                    onClick={() => {
                        // Removal no longer asks a native window.confirm: clicking
                        // hands off to handleRemovePlayer (Map.jsx), which stages the
                        // in-app named-confirm modal — `Remove "<name>" from the map?`
                        // through the shared DeleteConfirmModal (same role="dialog"
                        // tier as the MapsManager "Delete Map" dialog; backlog
                        // 2026-11-01 AZ2). Cancel there is fully inert — no
                        // setMapData write, the map's autosave PUT lane never
                        // fires. The menu closes here, as before.
                        handleRemovePlayer(selectedPlayer.id);
                        setSelectedPlayer(null);
                    }}
                >
                    Remove from Map
                </text>
                <text
                    x={menuX + 108}
                    y={menuY + 12}
                    fill="#999"
                    fontSize="10"
                    className="menu-close"
                    onClick={() => setSelectedPlayer(null)}
                >
                    ✕
                </text>
            </g>
        </g>
    );
}

export default PlayerContextMenu;
