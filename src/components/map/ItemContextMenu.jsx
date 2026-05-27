
function ItemContextMenu({
    selectedItem,
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
    handleRotateTorch,
    handleRotateChair,
    handleToggleDoor,
    handleViewStats,
    monsterFound,
    onRenameClicked,
    onClose,
}) {
    if (!selectedItem) return null;

    const menuX = gridCenterX(selectedItem.gridX) + 10;
    const menuY = gridCenterY(selectedItem.gridY) + 10;
    const item = placedItems.find(i => i.id === selectedItem.id);
    const isNpc = item && item.type === 'npc';
    const isDoor = item && item.type === 'door';
    const hasRotation = item && (item.type === 'table' || item.type === 'bed' || item.type === 'door' || item.type === 'secretDoor' || item.type === 'stairs' || item.type === 'altar' || item.type === 'bookshelf' || item.type === 'torch' || item.type === 'chair');
    const showRenameOption = isNpc;
    const showViewStats = isNpc && monsterFound;
    const hasExtra = showRenameOption || showViewStats || hasRotation || isDoor;
    const menuHeight = hasExtra ? (showViewStats ? 98 : 80) : 58;
    const doorMenuHeight = isDoor ? 98 : 0;

    const effectiveHeight = isDoor ? doorMenuHeight : menuHeight;

    return (
          <g className="item-context-menu" onClick={(e) => e.stopPropagation()}>
              <g>
                  <rect x={menuX} y={menuY} width="120" height={effectiveHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                  <text x={menuX + 8} y={menuY + 20} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleToggleItemVisibility(selectedItem.id)}>
                      {item?.visible !== false ? 'Hide' : 'Show'}
                  </text>
                  <text x={menuX + 8} y={menuY + 42} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleDeleteItem(selectedItem.id)}>Delete</text>
                  {isDoor && (
                      <text x={menuX + 8} y={menuY + 64} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleToggleDoor(selectedItem.id)}>
                          {item?.open ? 'Close Door' : 'Open Door'}
                      </text>
                  )}
                  {showRenameOption && (
                      <>
                        <text x={menuX + 8} y={menuY + 64} fill="#ccc" fontSize="11" className="menu-option" onClick={(e) => onRenameClicked(e, selectedItem, item?.name || 'NPC')}>
                         Rename
                        </text>
                          {showViewStats && (
                              <text x={menuX + 8} y={menuY + 86} fill="#ccc" fontSize="11" className="menu-option" onClick={() => handleViewStats(selectedItem.id)}>
                                View Stats
                              </text>
                          )}
                      </>
                  )}
                  {hasRotation && (
                      <text x={menuX + 8} y={menuY + (isDoor ? 86 : 64)} fill="#ccc" fontSize="11" className="menu-option" onClick={() => {
                        if (item.type === 'table') handleRotateTable(selectedItem.id);
                        else if (item.type === 'bed') handleRotateBed(selectedItem.id);
                        else if (item.type === 'door') handleRotateDoor(selectedItem.id);
                        else if (item.type === 'secretDoor') handleRotateSecretDoor(selectedItem.id);
                        else if (item.type === 'stairs') handleRotateStairs(selectedItem.id);
                        else if (item.type === 'altar') handleRotateAltar(selectedItem.id);
                        else if (item.type === 'bookshelf') handleRotateBookshelf(selectedItem.id);
                        else if (item.type === 'torch') handleRotateTorch(selectedItem.id);
                        else if (item.type === 'chair') handleRotateChair(selectedItem.id);
                      }}>
                        Rotate
                      </text>
                  )}
                  <text x={menuX + 108} y={menuY + 12} fill="#999" fontSize="10" className="menu-close" onClick={() => onClose(menuX, menuY)}>✕</text>
              </g>
          </g>
      );
}

export default ItemContextMenu;
