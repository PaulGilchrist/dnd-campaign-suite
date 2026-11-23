import { useEffect, useRef } from 'react';
import MenuOption from '../common/MenuOption.jsx';
import { useMenuRoving } from '../../hooks/ui/useMenuRoving';
import { itemSpriteHref } from '../../services/maps/itemSprites';
import { normalizeLightSetting } from '../../services/maps/lighting.js';

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

const MENU_WIDTH = 120;

function menuHeightFor(isCreature, isNpc, isDoor, showViewStats, showRotateOption) {
    let height;
    if (isDoor) height = 116;
    // Creature rows (plan C): a Light cycle row joins the menu (visibility,
    // delete, light — npc rows additionally rename/stats below it).
    else if (isCreature) height = isNpc ? (showViewStats ? 160 : 142) : 116;
    else height = 76;
    // Rotate is always the last row (22px pitch); drop its slot when hidden.
    return showRotateOption ? height : height - 22;
}

function rotateOffsetFor(showViewStats, showRenameOption, isDoor) {
    if (showViewStats) return 108;
    if (showRenameOption || isDoor) return 86;
    return 64;
}

// Entry flags + panel height are needed BEFORE the origin is placed (the
// viewport clamp reads the height), while the row offsets need the (clamped)
// origin — so the model splits into these two pure steps.
function menuFlagsFor(item, monsterFound) {
    const isNpc = item && item.type === 'npc';
    const isDoor = item && item.type === 'door';
    const isCreature = isNpc || (item && item.type === 'monster');
    const showRenameOption = isNpc;
    const showViewStats = isNpc && monsterFound;
    const showRotateOption = !isRotationInvariant(item);
    return {
        isDoor,
        isCreature: !!isCreature,
        showRenameOption,
        showViewStats,
        showRotateOption,
        height: menuHeightFor(!!isCreature, isNpc, isDoor, showViewStats, showRotateOption),
    };
}

function menuEntriesFor(flags, item, menuY) {
    const yRotate = rotateOffsetFor(flags.showViewStats, flags.showRenameOption, flags.isDoor);
    const entries = [
        { id: 'visibility', y: menuY + 20, label: item?.visible !== false ? 'Hide' : 'Show' },
        { id: 'delete', y: menuY + 42, label: 'Delete' },
    ];
    if (flags.isDoor) {
        entries.push({ id: 'door', y: menuY + 64, label: item?.open ? 'Close Door' : 'Open Door' });
    }
    // Light cycle row (plan C): presses cycle bright → dim → none; the label
    // names the CURRENT setting (absent = the canonical bright default).
    if (flags.isCreature) {
        const setting = normalizeLightSetting(item?.light);
        entries.push({ id: 'light', y: menuY + 64, label: `Light: ${setting}` });
    }
    if (flags.showRenameOption) {
        entries.push({ id: 'rename', y: menuY + (flags.isCreature ? 86 : 64), label: 'Rename' });
    }
    if (flags.showViewStats) {
        entries.push({ id: 'stats', y: menuY + (flags.isCreature ? 108 : 86), label: 'View Stats' });
    }
    if (flags.showRotateOption) {
        entries.push({ id: 'rotate', y: menuY + yRotate, label: 'Rotate' });
    }
    return entries;
}

// Roving arrow navigation within the open menu (backlog 2026-11-16 XC) now
// lives in the shared src/hooks/ui/useMenuRoving.js seam, extracted so the
// hex POIContextMenu adopts the identical tier (bug-hex-poi-menu-no-keyboard-
// rove-or-focus-first).

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
    viewPortBounds,
    handleCycleItemLight,
}) {
    const menuRef = useRef(null);
    const item = selectedItem ? placedItems.find(i => i.id === selectedItem.id) : undefined;
    const flags = menuFlagsFor(item, monsterFound);
    let menuX = selectedItem ? gridCenterX(selectedItem.gridX) + 10 : 0;
    let menuY = selectedItem ? gridCenterY(selectedItem.gridY) + 10 : 0;
    // Viewport clamp (backlog 2026-11-17, the SAME law the hex POI menu ships
    // in POIContextMenu.jsx): a token low on the board anchored the menu so
    // its tail rows rendered below the visible board — clipped by the svg
    // viewport and unreachable by mouse (native clicks hit nothing; only the
    // keyboard/Enter lane could reach them). viewPortBounds is the visible
    // world rect (the viewBox, which the square .grid-svg maps onto the
    // screen 1:1) computed by Map.jsx; absent bounds keep the raw anchor.
    if (viewPortBounds) {
        menuX = Math.max(viewPortBounds.left + 4, Math.min(menuX, viewPortBounds.right - MENU_WIDTH - 4));
        menuY = Math.max(viewPortBounds.top + 4, Math.min(menuY, viewPortBounds.bottom - flags.height - 4));
    }
    // Open-focus (first entry) + Arrow/Home/End rove + close focus-restore all
    // live in the shared hook (the XF-backlog restore tier: after every
    // dismissal the hook re-focuses the element focused before open, or the
    // board <svg> fallback when focus was on <body>; a rename hand-off to the
    // outside autocomplete popover still wins — the hook yields to any surface
    // that focuses itself). The anchor key re-arms focus when the selection
    // moves under the menu.
    const handleMenuKeyDown = useMenuRoving(
        menuRef,
        selectedItem ? `${selectedItem.id}:${menuX}:${menuY}` : null,
        !!selectedItem
    );

    // Escape semantics (backlog 2026-11-16 XC, mirroring the hex POI menu's
    // shipped 2026-11-13 seam; open-focus now comes from useMenuRoving):
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
    useEffect(() => {
        if (!selectedItem) return undefined;
        const handleKeyDown = (e) => {
            if (e.key !== 'Escape') return;
            onClose(menuX, menuY);
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedItem, menuX, menuY, onClose]);

    if (!selectedItem) return null;

    const entries = menuEntriesFor(flags, item, menuY);

    const handlers = {
        visibility: () => handleToggleItemVisibility(selectedItem.id),
        delete: () => handleDeleteItem(selectedItem.id),
        door: () => handleToggleDoor(selectedItem.id),
        light: () => handleCycleItemLight(selectedItem.id),
        rename: (e) => onRenameClicked(e, selectedItem, item?.name || 'NPC'),
        stats: () => handleViewStats(selectedItem.id),
        rotate: () => handleRotate(selectedItem.id),
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
                  <rect x={menuX} y={menuY} width={MENU_WIDTH} height={flags.height} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />
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
                  <MenuOption x={menuX + MENU_WIDTH - 12} y={menuY + 12} fill="#999" fontSize="10" className="menu-close" onActivate={() => onClose(menuX, menuY)}>✕</MenuOption>
              </g>
          </g>
      );
}

export default ItemContextMenu;
