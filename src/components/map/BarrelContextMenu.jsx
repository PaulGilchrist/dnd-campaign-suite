import React from 'react';

function BarrelContextMenu({
    selectedBarrel,
    showRename,
    placedItems,
    gridCenterX,
    gridCenterY,
    handleToggleItemVisibility,
    handleDeleteItem,
    handleRotateTable,
    handleRotateBed,
    handleRotateDoor,
    handleRotateSecretDoor,
    handleRotateStairs,
    handleRotateAltar,
    handleRotateBookshelf,
    handleRenameItem,
    setShowRename,
    setSelectedBarrel,
}) {
    if (!selectedBarrel) return null;

    const menuX = gridCenterX(selectedBarrel.gridX) + 10;
    const menuY = gridCenterY(selectedBarrel.gridY) + 10;
    const selectedItem = placedItems.find(i => i.id === selectedBarrel.id);
    const isNpc = selectedItem && selectedItem.type === 'npc';
    const hasRotation = selectedItem && (selectedItem.type === 'table' || selectedItem.type === 'bed' || selectedItem.type === 'door' || selectedItem.type === 'secretDoor' || selectedItem.type === 'stairs' || selectedItem.type === 'altar' || selectedItem.type === 'bookshelf');
    const showRenameOption = isNpc;
    const hasExtra = showRenameOption || hasRotation;
    const menuHeight = hasExtra ? 80 : 58;

    return (
        <g className="barrel-context-menu" onClick={(e) => e.stopPropagation()}>
            <g>
                <rect x={menuX} y={menuY} width="120" height={menuHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                <text x={menuX + 8} y={menuY + 20} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleToggleItemVisibility(selectedBarrel.id)}>
                    {selectedItem?.visible !== false ? 'Hide' : 'Show'}
                </text>
                <text x={menuX + 8} y={menuY + 42} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleDeleteItem(selectedBarrel.id)}>Delete</text>
                {showRenameOption && (
                    <>
                        <text x={menuX + 8} y={menuY + 64} fill="#ccc" fontSize="11" className="menu-option" onClick={() => setShowRename(selectedBarrel.id)}>
                            Rename
                        </text>
                        {showRename === selectedBarrel.id ? (
                            <foreignObject x={menuX + 4} y={menuY + 94} width="112" height="28">
                                <input
                                    type="text"
                                    defaultValue={selectedItem?.name || 'NPC'}
                                    className="context-menu-input"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            handleRenameItem(selectedBarrel.id, e.target.value);
                                        }
                                    }}
                                    onBlur={(e) => {
                                        handleRenameItem(selectedBarrel.id, e.target.value);
                                    }}
                                    autoFocus
                                />
                            </foreignObject>
                        ) : null}
                    </>
                )}
                {hasRotation && (
                    <text x={menuX + 8} y={menuY + 64} fill="#ccc" fontSize="11" className="menu-option" onClick={() => {
                        if (selectedItem.type === 'table') handleRotateTable(selectedBarrel.id);
                        else if (selectedItem.type === 'bed') handleRotateBed(selectedBarrel.id);
                        else if (selectedItem.type === 'door') handleRotateDoor(selectedBarrel.id);
                        else if (selectedItem.type === 'secretDoor') handleRotateSecretDoor(selectedBarrel.id);
                        else if (selectedItem.type === 'stairs') handleRotateStairs(selectedBarrel.id);
                        else if (selectedItem.type === 'altar') handleRotateAltar(selectedBarrel.id);
                        else if (selectedItem.type === 'bookshelf') handleRotateBookshelf(selectedBarrel.id);
                    }}>
                        Rotate
                    </text>
                )}
                <text x={menuX + 108} y={menuY + 12} fill="#999" fontSize="10" className="menu-close" onClick={() => { setSelectedBarrel(null); setShowRename(null); }}>✕</text>
            </g>
        </g>
    );
}

export default BarrelContextMenu;
