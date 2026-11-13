import { useEffect, useRef, useState } from 'react';
import { HEX_SIZE } from '../../config/outdoorConfig';
import { hexToPixel } from '../../services/maps/hexMapUtils';
import * as mapsService from '../../services/maps/mapsService.js';

const MENU_WIDTH = 160;
const PICKER_ITEM_HEIGHT = 20;
const MAX_PICKER_ITEMS = 6;

function getLinkPickerLayout(showLinkPicker, indoorMaps) {
    if (!showLinkPicker) return { count: 0, offset: 0, extraHeight: 0 };
    const count = indoorMaps.length === 0 ? 1 : Math.min(indoorMaps.length, MAX_PICKER_ITEMS);
    return { count, offset: count * PICKER_ITEM_HEIGHT, extraHeight: count * PICKER_ITEM_HEIGHT + 8 };
}

// Keyboard-activatable option row (improvement 2026-11-13): options used to
// be bare SVG <text> nodes — no .click() method, no focus, no keyboard/AT
// activation. Each option's <text> label keeps its exact position/attrs and
// its onClick (mouse face unchanged); the wrapping <g role="menuitem"
// tabIndex={0}> makes the row focusable and fires the SAME onActivate
// closure on Enter/Space. A keypress never synthesises a click event on an
// SVG <g> (only native controls do), so the keydown handler cannot
// double-fire the onClick. Escape is NOT an activation key here (it never
// reaches onActivate); the menu-level Escape DISMISS law lives in
// POIContextMenu below (replaces the adc78327f "Escape inert" law —
// backlog 2026-11-13: Escape = dismiss-zero-write, mirroring the
// 3f41dc16b modal family).
function MenuOption({ x, y, fill, fontSize = '11', className = 'menu-option', onActivate, children }) {
    const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            onActivate();
        }
    };
    return (
        <g role="menuitem" tabIndex={0} className="menu-option-item" onKeyDown={handleKeyDown}>
            <text x={x} y={y} fill={fill} fontSize={fontSize} className={className} onClick={onActivate}>
                {children}
            </text>
        </g>
    );
}

// Inline rename editor (backlog 2026-11-13, replaces the "no cancel face"
// law): three faces — Enter/blur COMMIT (unchanged laws), Escape REVERTS-AND-
// CLOSES with zero writes, and a refused blank commit is no longer silent.
// A full Notes-style discard-confirm (window.confirm "Discard changes…") is
// too heavy for a 28px inline SVG field, so Escape rides the lighter
// sibling pattern the modal family already uses: it routes to the plain
// close handler and the typed draft is simply dropped — onRename never runs,
// so no setPois write lands and the map's autosave PUT lane never fires.
// The menu's fate matches every commit path: the whole menu closes (HexMap
// wires onClose to null BOTH selectedPoiMenu and showRename).
function RenameInput({ editing, menuX, menuY, menuWidth, selectedItem, onRename, onClose }) {
    // Armed by Escape before the editor closes: guards against a blur racing
    // the unmount resurrecting the cancelled draft as a commit. Reset when
    // the editor is not mounted so a re-open always starts uncancelled.
    const cancelledRef = useRef(false);
    if (!editing) {
        cancelledRef.current = false;
        return null;
    }

    // onRename (usePoiManagement.handleRenamePoi) owns the blank-name law and
    // reports back: false = refused. On refusal nothing is written and the
    // editor stays open with the OLD label restored into the input, so the
    // user can see the blank was not accepted. Any other outcome (including
    // undefined from a plain mock) commits and closes.
    const tryCommit = (e) => {
        if (onRename(selectedItem.id, e.target.value) === false) {
            e.target.value = selectedItem.label || '';
            return;
        }
        onClose();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            tryCommit(e);
        } else if (e.key === 'Escape') {
            // Revert-and-close. stopPropagation keeps the menu-level window
            // listener from 18d1acc55 from double-handling this keydown (its
            // .context-menu-input guard already makes it inert here; this is
            // belt-and-braces so the input's cancel is the only handler).
            e.stopPropagation();
            cancelledRef.current = true;
            onClose();
        }
    };

    return (
        <foreignObject x={menuX + 4} y={menuY + 34} width={menuWidth - 8} height="28">
            <input
                type="text"
                defaultValue={selectedItem.label || ''}
                className="context-menu-input"
                onKeyDown={handleKeyDown}
                onBlur={(e) => {
                    if (!cancelledRef.current) tryCommit(e);
                }}
                autoFocus
            />
        </foreignObject>
    );
}

function LinkOption({ menuX, menuY, hasLink, linkedMap, onUnlinkMap, onShowPicker }) {
    if (hasLink) {
        return (
            <MenuOption x={menuX + 8} y={menuY + 64} fill="#e8a040" onActivate={onUnlinkMap}>
                {`Unlink Map (${mapsService.formatMapName(linkedMap)})`}
            </MenuOption>
        );
    }
    return (
        <MenuOption x={menuX + 8} y={menuY + 64} fill="#ccc" onActivate={onShowPicker}>
            Link to Map...
        </MenuOption>
    );
}

function LinkPicker({ showLinkPicker, menuX, menuY, menuWidth, layout, indoorMaps, onPickMap }) {
    if (!showLinkPicker) return null;
    const pickerStart = menuY + 86;
    const pickerBgHeight = layout.count * PICKER_ITEM_HEIGHT + 8;
    return (
        <g>
            <rect x={menuX + 4} y={pickerStart - 4} width={menuWidth - 8} height={pickerBgHeight} rx="2" fill="#383838" />
            {indoorMaps.length === 0 ? (
                <text x={menuX + 10} y={pickerStart + 14} fill="#888" fontSize="10">No indoor maps available</text>
            ) : indoorMaps.slice(0, MAX_PICKER_ITEMS).map((m, i) => (
                <MenuOption
                    key={m}
                    x={menuX + 10}
                    y={pickerStart + 14 + i * PICKER_ITEM_HEIGHT}
                    fill="#ccc"
                    onActivate={() => onPickMap(m)}
                >
                    {mapsService.formatMapName(m)}
                </MenuOption>
            ))}
        </g>
    );
}

function POIContextMenu({ selectedPoi, pois, showRename, onToggleVisibility, onDelete, onRename, onLinkMap, onUnlinkMap, onRemoveRoads, setShowRename, onClose, indoorMaps = [], viewPortBounds, roads = [] }) {
    const [showLinkPicker, setShowLinkPicker] = useState(false);

    // Escape = dismiss-zero-write (backlog 2026-11-13, REPLACING the
    // adc78327f "Escape inert" law): the keyboard now rides the SAME onClose
    // backdrop path the svg-root click uses — the menu unmounts, no mutation
    // callback fires, so the map's autosave PUT lane never runs, and the
    // focused item's action is never activated (the modal-family law from
    // 3f41dc16b: Escape routes to the plain Cancel handler, nothing else).
    // The listener lives on window rather than as a menu-root onKeyDown
    // because acceptance covers focus anywhere — menu root, a menuitem, or
    // the board/svg behind the menu. Escape inside the inline rename input
    // stays inert (its cancel face is a separate backlog item).
    useEffect(() => {
        if (!selectedPoi) return undefined;
        const handleKeyDown = (e) => {
            if (e.key !== 'Escape') return;
            if (e.target instanceof HTMLElement && e.target.classList.contains('context-menu-input')) return;
            setShowLinkPicker(false);
            onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedPoi, onClose]);

    if (!selectedPoi) return null;

    const center = hexToPixel(selectedPoi.q, selectedPoi.r, HEX_SIZE);
    let menuX = center.x + 10;
    let menuY = center.y + 10;
    const selectedItem = pois.find(i => i.id === selectedPoi.id);
    if (!selectedItem) return null;

    const hasLink = !!selectedItem.linkedMap;
    const connectedRoads = roads.filter(r => r.fromPoiId === selectedPoi.id || r.toPoiId === selectedPoi.id);
    const hasRoads = connectedRoads.length > 0;
    const rowCount = (hasLink ? 5 : 4) + (hasRoads ? 1 : 0);
    const baseMenuHeight = rowCount * 22 + 8; // 22px per row + padding
    const pickerLayout = getLinkPickerLayout(showLinkPicker, indoorMaps);
    const menuHeight = baseMenuHeight + pickerLayout.extraHeight;

    // Clamp to viewport so menu doesn't overflow the visible SVG area
    if (viewPortBounds) {
        menuX = Math.max(viewPortBounds.left + 4, Math.min(menuX, viewPortBounds.right - MENU_WIDTH - 4));
        menuY = Math.max(viewPortBounds.top + 4, Math.min(menuY, viewPortBounds.bottom - menuHeight - 4));
    }

    const handleLinkMap = (mapName) => {
        onLinkMap(selectedPoi.id, mapName);
        setShowLinkPicker(false);
        onClose();
    };

    const handleUnlinkMap = () => {
        onUnlinkMap(selectedPoi.id);
        onClose();
    };

    return (
        <g className="poi-context-menu" role="menu" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => e.stopPropagation()}>
            <g>
                <rect x={menuX} y={menuY} width={MENU_WIDTH} height={menuHeight} rx="4" fill="#2a2a2a" stroke="#555" strokeWidth="1" />

                {/* Hide/Show */}
                <MenuOption
                    x={menuX + 8}
                    y={menuY + 20}
                    fill="#ccc"
                    onActivate={() => { onToggleVisibility(selectedPoi.id); onClose(); }}
                >
                    {selectedItem.visible !== false ? 'Hide' : 'Show'}
                </MenuOption>

                {/* Rename */}
                <MenuOption
                    x={menuX + 8}
                    y={menuY + 42}
                    fill="#ccc"
                    onActivate={() => { setShowRename(selectedPoi.id); setShowLinkPicker(false); }}
                >
                    Rename
                </MenuOption>

                <RenameInput
                    editing={showRename === selectedPoi.id}
                    menuX={menuX}
                    menuY={menuY}
                    menuWidth={MENU_WIDTH}
                    selectedItem={selectedItem}
                    onRename={onRename}
                    onClose={onClose}
                />

                <LinkOption
                    menuX={menuX}
                    menuY={menuY}
                    hasLink={hasLink}
                    linkedMap={selectedItem.linkedMap}
                    onUnlinkMap={handleUnlinkMap}
                    onShowPicker={() => setShowLinkPicker(true)}
                />

                {/* Link picker dropdown (option rows carry the same
                    menuitem/keyboard treatment as the named actions) */}
                <LinkPicker
                    showLinkPicker={showLinkPicker}
                    menuX={menuX}
                    menuY={menuY}
                    menuWidth={MENU_WIDTH}
                    layout={pickerLayout}
                    indoorMaps={indoorMaps}
                    onPickMap={handleLinkMap}
                />

                {/* Delete */}
                <MenuOption
                    x={menuX + 8}
                    y={menuY + 86 + pickerLayout.offset}
                    fill="#ccc"
                    onActivate={() => {
                        // Delete stages through the shared requestDelete seam:
                        // usePoiManagement arms the descriptor and HexMap.jsx
                        // renders it through DeleteFromMapModal — the same
                        // role=dialog tier as the indoor token/prop/player/POI
                        // lanes (backlog 2026-11-01 BA, replaces the native
                        // native confirm replaced by the dialog tier). Cancel is fully inert: the staged
                        // closure never runs → no setPois/setRoads write → the
                        // map's autosave PUT lane never fires. This Delete is
                        // the ONLY placed-POI delete lane (HexMap.jsx wires
                        // handleDeletePoi here and nowhere else), so the menu
                        // gates it once. The menu closes at the request — the
                        // dialog owns the decision now.
                        onDelete(selectedPoi.id);
                        onClose();
                    }}
                >
                    Delete
                </MenuOption>

                {/* Remove Roads */}
                {hasRoads && (
                    <MenuOption
                        x={menuX + 8}
                        y={menuY + 108 + pickerLayout.offset}
                        fill="#e8a040"
                        onActivate={() => { onRemoveRoads(selectedPoi.id); onClose(); }}
                    >
                        {`Remove Roads (${connectedRoads.length})`}
                    </MenuOption>
                )}

                {/* Close button */}
                <MenuOption
                    x={menuX + MENU_WIDTH - 12}
                    y={menuY + 12}
                    fill="#999"
                    fontSize="10"
                    className="menu-close"
                    onActivate={() => { setShowLinkPicker(false); onClose(); }}
                >
                    ✕
                </MenuOption>
            </g>
        </g>
    );
}

export default POIContextMenu;
