import { useEffect, useRef } from 'react';
import MenuOption from '../common/MenuOption.jsx';
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

// Roving arrow navigation within the open menu (backlog 2026-11-16 XC).
// MenuOption carries `tabIndex={0}`, so Tab already walks the rows natively;
// Arrow/Home/End give the full menu pattern without touching focus when no
// item row is present.
const NAV_DIRECTIONS = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };

function focusMenuRow(root, key) {
    const items = Array.from(root.querySelectorAll('[role="menuitem"]'));
    if (items.length === 0) return;
    let next;
    if (key === 'Home') next = items[0];
    else if (key === 'End') next = items[items.length - 1];
    else {
        const delta = NAV_DIRECTIONS[key];
        const idx = items.indexOf(document.activeElement);
        // Focus landing outside the rows (e.g. the svg root) starts the walk
        // at the top (down) or bottom (up) instead of stranding.
        next = idx === -1
            ? items[delta > 0 ? 0 : items.length - 1]
            : items[(idx + delta + items.length) % items.length];
    }
    if (next && typeof next.focus === 'function') next.focus();
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
    const menuRef = useRef(null);
    const menuX = selectedItem ? gridCenterX(selectedItem.gridX) + 10 : 0;
    const menuY = selectedItem ? gridCenterY(selectedItem.gridY) + 10 : 0;

    // Open/close focus + Escape semantics (backlog 2026-11-16 XC, mirroring
    // the hex POI menu's shipped 2026-11-13 seam):
    //  • opening moves focus into the first entry so the keyboard lane is
    //    live immediately (previously the menu was pointer-only chrome);
    //  • Escape rides the SAME onClose seam as the ✕/backdrop click — the
    //    modal-family law from 3f41dc16b: dismiss routes to the plain close
    //    handler and NEVER activates the focused option, so zero handler
    //    fires and the map's autosave PUT lane stays silent. The listener
    //    lives on window (not a menu-root onKeyDown) because dismissal must
    //    answer with focus on a menuitem, the menu root, or the board behind
    //    the menu. This menu has no inline text input (rename hands off to
    //    the MonsterNameAutocomplete popover OUTSIDE the menu, which nulls
    //    selectedItem and unmounts this effect first), so no
    //    `.context-menu-input` guard like the hex sibling needs here.
    // No focus-restore on close: the invoking hit-rects are unfocusable
    // pointer chrome, and Rename/Delete lanes move focus into their own
    // popover/dialog — restoring would fight that.
    useEffect(() => {
        if (!selectedItem) return undefined;
        const first = menuRef.current?.querySelector('[role="menuitem"]');
        if (first && typeof first.focus === 'function') first.focus();
        const handleKeyDown = (e) => {
            if (e.key !== 'Escape') return;
            onClose(menuX, menuY);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem, menuX, menuY, onClose]);

    if (!selectedItem) return null;

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

    const handleMenuKeyDown = (e) => {
        if (!(e.key in NAV_DIRECTIONS) && e.key !== 'Home' && e.key !== 'End') return;
        e.preventDefault(); // arrows/Home/End scroll the page natively
        if (menuRef.current) focusMenuRow(menuRef.current, e.key);
    };

    return (
          // stopPropagation on pointerdown/up too: the svg root's Select/Paint
          // lanes call setPointerCapture on every pointerdown, which retargets
          // the matching pointerup/click to the svg and away from the menu
          // text — the entry's onClick would never fire (rotate/open-door/
          // delete all dead, found live 2026-11-05). Trusted RIGHT-click
          // routing was the mirror defect (backlog 2026-11-16 XC): those same
          // lanes captured ANY button, and an active capture retargets the
          // contextmenu event to the svg root, away from the child
          // `rect.placed-hit-area` handler — fixed at the source with
          // button-0 guards in useSelectMove/useWallDrawing (house law:
          // useZoomPan.js:52, useItemDragging.js:54, useSpellHandlers.js:42).
          <g className="item-context-menu" role="menu" ref={menuRef}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={handleMenuKeyDown}>
              <g>
                  <rect x={menuX} y={menuY} width="120" height={effectiveHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
                  {entries.map(entry => (
                      <MenuOption
                          key={entry.id}
                          x={menuX + 8}
                          y={entry.y}
                          fill="#ccc"
                          onActivate={handlers[entry.id]}
                      >
                          {entry.label}
                      </MenuOption>
                  ))}
                  <MenuOption x={menuX + 108} y={menuY + 12} fill="#999" fontSize="10" className="menu-close" onActivate={() => onClose(menuX, menuY)}>✕</MenuOption>
              </g>
          </g>
      );
}

export default ItemContextMenu;
