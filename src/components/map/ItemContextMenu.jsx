import { itemSpriteHref } from '../../services/maps/itemSprites';

// Rotation-invariance audit (backlog 2026-11-01 BA): creature tokens (npc +
// monster, which is what AI-Dress `ai-dress-token-*` rows are) have NO
// transform consumer in either render lane — 2D PlacedItems.jsx
// renderCreature and 3D map3dScene._buildNpcs both ignore `rotation` — so
// Rotate was a silent persisted knob for them. Registered sprite types
// consume rotation in at least one lane (2D furniture/door transforms, 3D
// mesh rotation), so they keep the entry. Same pattern as showRenameOption:
// menu visibility is derived from the item type inside the entries builder.
//
// Ghost-'?' props (backlog 2026-11-05 CW): types unknown to the sprite
// registry render through PlacedItems' generic-prop dispatch (`renderProp(i,
// {})` — no `rotatable` opt, and the dashed `#generic-prop` chip is
// rotation-invariant anyway), so Rotate there was the same invisible state
// write: it persisted `rotation: 90` to disk with zero visual delta. Owner
// decision: hide it (do NOT add the rotatable transform path). `item` absent
// (id not in placedItems) keeps the legacy base menu.
function isRotationInvariant(item) {
    if (!item) return false;
    if (item.type === 'npc' || item.type === 'monster') return true;
    return !itemSpriteHref(item.type);
}

function menuHeightFor(isNpc, isDoor, showViewStats, showRotateOption) {
    let height;
    if (isDoor) height = 116;
    else if (isNpc || showViewStats) height = showViewStats ? 138 : 120;
    else height = 76;
    // Rotate is always the last row (22px pitch); drop its slot when hidden.
    return showRotateOption ? height : height - 22;
}

function rotateOffsetFor(showViewStats, showRenameOption, isDoor) {
    if (showViewStats) return 108;
    if (showRenameOption || isDoor) return 86;
    return 64;
}

function buildMenuModel(item, monsterFound, menuY) {
    const isNpc = item && item.type === 'npc';
    const isDoor = item && item.type === 'door';
    const showRenameOption = isNpc;
    const showViewStats = isNpc && monsterFound;
    const showRotateOption = !isRotationInvariant(item);

    const effectiveHeight = menuHeightFor(isNpc, isDoor, showViewStats, showRotateOption);
    const yRotate = rotateOffsetFor(showViewStats, showRenameOption, isDoor);

    const entries = [
        { id: 'visibility', y: menuY + 20, label: item?.visible !== false ? 'Hide' : 'Show' },
        { id: 'delete', y: menuY + 42, label: 'Delete' },
    ];
    if (isDoor) {
        entries.push({ id: 'door', y: menuY + 64, label: item?.open ? 'Close Door' : 'Open Door' });
    }
    if (showRenameOption) {
        entries.push({ id: 'rename', y: menuY + 64, label: 'Rename' });
    }
    if (showViewStats) {
        entries.push({ id: 'stats', y: menuY + 86, label: 'View Stats' });
    }
    if (showRotateOption) {
        entries.push({ id: 'rotate', y: menuY + yRotate, label: 'Rotate' });
    }

    return { entries, effectiveHeight, yRotate };
}

function ItemContextMenu({
    selectedItem,
    placedItems,
    gridCenterX,
    gridCenterY,
    handleToggleItemVisibility,
    handleDeleteItem,
    handleRotate,
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
    const { entries, effectiveHeight } = buildMenuModel(item, monsterFound, menuY);

    const handlers = {
        visibility: () => handleToggleItemVisibility(selectedItem.id),
        delete: () => handleDeleteItem(selectedItem.id),
        door: () => handleToggleDoor(selectedItem.id),
        rename: (e) => onRenameClicked(e, selectedItem, item?.name || 'NPC'),
        stats: () => handleViewStats(selectedItem.id),
        rotate: () => handleRotate(selectedItem.id),
    };

    return (
          // stopPropagation on pointerdown/up too: the svg root's Select/Paint
          // lanes call setPointerCapture on every pointerdown, which retargets
          // the matching pointerup/click to the svg and away from the menu
          // text — the entry's onClick would never fire (rotate/open-door/
          // delete all dead, found live 2026-11-05).
          <g className="item-context-menu"
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}>
              <g>
                  <rect x={menuX} y={menuY} width="120" height={effectiveHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                  {entries.map(entry => (
                      <text key={entry.id} x={menuX + 8} y={entry.y} fill="#ccc" fontSize="11" className="menu-option" onClick={handlers[entry.id]}>
                          {entry.label}
                      </text>
                  ))}
                  <text x={menuX + 108} y={menuY + 12} fill="#999" fontSize="10" className="menu-close" onClick={() => onClose(menuX, menuY)}>✕</text>
              </g>
          </g>
      );
}

export default ItemContextMenu;
