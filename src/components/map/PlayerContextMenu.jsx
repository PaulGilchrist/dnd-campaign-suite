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
                    onClick={() => handleRemovePlayer(selectedPlayer.id)}
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
