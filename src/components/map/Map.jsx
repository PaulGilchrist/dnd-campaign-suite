import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useSyncedState } from '../../hooks/runtime/useSyncedState.js';
import Subscriber from '../common/Subscriber.jsx';
import MapToolbar from './MapToolbar.jsx';
import { loadMonsters } from '../../services/ui/dataLoader.js';
import { computeEffectiveWalls } from '../../services/maps/effectiveWalls.js';
import MonsterCardModal from '../encounter/MonsterCardModal.jsx';
import './Map.css';
import ItemsPanel from './ItemsPanel.jsx';
import BarrelSVG from './BarrelSVG.jsx';
import TableSVG from './TableSVG.jsx';
import BedSVG from './BedSVG.jsx';
import FirePitSVG from './FirePitSVG.jsx';
import DoorSVG from './DoorSVG.jsx';
import SecretDoorSVG from './SecretDoorSVG.jsx';
import TrapSVG from './TrapSVG.jsx';
import PillarSVG from './PillarSVG.jsx';
import StairsSVG from './StairsSVG.jsx';
import AltarSVG from './AltarSVG.jsx';
import ArrowSlitWallSVG from './ArrowSlitWallSVG.jsx';
import BookshelfSVG from './BookshelfSVG.jsx';
import ChairSVG from './ChairSVG.jsx';
import ChestSVG from './ChestSVG.jsx';
import CrateSVG from './CrateSVG.jsx';
import FountainSVG from './FountainSVG.jsx';
import SkeletonSVG from './SkeletonSVG.jsx';
import StatueSVG from './StatueSVG.jsx';
import TorchSVG from './TorchSVG.jsx';
import WebSVG from './WebSVG.jsx';
import TreeSVG from './TreeSVG.jsx';
import BoulderSVG from './BoulderSVG.jsx';
import BushSVG from './BushSVG.jsx';
import PlacedItems from './PlacedItems.jsx';
import GridAndWalls from './GridAndWalls.jsx';
import Players from './Players.jsx';
import FogOverlay from './FogOverlay.jsx';
import ItemContextMenu from './ItemContextMenu.jsx';
import ItemDetailsDock from './ItemDetailsDock.jsx';
import MapDescriptionPanel from '../common/MapDescriptionPanel.jsx';
import MonsterNameAutocomplete from '../common/MonsterNameAutocomplete.jsx';
import usePlacedItems from './hooks/usePlacedItems.js';
import usePlayerDragging from './hooks/usePlayerDragging';
import useItemDragging from './hooks/useItemDragging';
import useNpcImageCache from './hooks/useNpcImageCache';
import useSSESync from './hooks/useSSESync';
import useFogOfWar from './hooks/useFogOfWar';
import useSpellOverlay from './hooks/useSpellOverlay';
import SpellOverlayRenderer from './SpellOverlayRenderer.jsx';
import RulerOverlay from './RulerOverlay.jsx';
import MapSnapToast from './MapSnapToast.jsx';
import { OverlayShape, DEFAULTS } from '../../models/SpellOverlay.js';
import HexMap from '../hex-map/HexMap';
import '../hex-map/HexMap.css';
import PlayerContextMenu from './PlayerContextMenu.jsx';
import useMapLoader from './hooks/useMapLoader';
import useZoomPan from './hooks/useZoomPan';
import Map3D from './Map3D/Map3D.jsx';
import useWallDrawing from './hooks/useWallDrawing';
import useSelectMove from './hooks/useSelectMove';
import useRuler from './hooks/useRuler';
import useSpellHandlers from './hooks/useSpellHandlers';
import useMapDrops from './hooks/useMapDrops';
import { CELL_SIZE, TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_SELECT } from '../../config/mapConfig';
import {
    SelectionPreviewRect,
    SelectionOutline,
    MovePreview,
    SelectedWalls,
    SelectedItemHighlights,
} from './MapSelectionLayers.jsx';

function getCursor({ panning, rulerMode, tool, moveOffset }) {
    if (panning) return 'grabbing';
    if (rulerMode) return 'crosshair';
    if (tool === TOOL_NONE) return 'grab';
    if (tool === TOOL_SELECT) return moveOffset ? 'grabbing' : 'crosshair';
    return 'default';
}

function buildPendingOverlay(spellDraft, spellMode, shapeParams) {
    if (!spellDraft) return null;
    return { ...spellDraft, shape: spellMode, ...shapeParams, id: 'pending' };
}

// Click-select discriminator for placed items (backlog 2026-10-25: token
// delete was contextmenu-only). A hit-area press records the item + cell +
// pixel at pointerdown (PlacedItems.jsx forwards through the tracked handler);
// browsers retarget the captured pointer's click to the svg root, so Map's
// svg onClick consumes it here. Same cell + sub-5px movement → a click:
// select the item (surfaces ItemDetailsDock). A drag repositions and NEVER
// selects; paint/erase/ruler/spell lanes never record a press at all.
const ITEM_CLICK_MOVE_PX = 5;

function resolveItemClick(press, e, placedItems) {
    if (!press) return null;
    if (Math.hypot(e.clientX - press.clientX, e.clientY - press.clientY) > ITEM_CLICK_MOVE_PX) return null;
    const item = (placedItems || []).find(i => i.id === press.itemId);
    if (!item) return null;
    if (item.gridX !== press.gridX || item.gridY !== press.gridY) return null;
    return { id: item.id, gridX: item.gridX, gridY: item.gridY };
}

// Which affordance chrome the current selection renders (hoisted to keep Map
// under the complexity cap). Two mutually exclusive lanes:
//   via === 'click'  → visible ItemDetailsDock (2D + GM only), NO svg menu
//   otherwise        → byte-identical right-click lane (svg menu, no dock)
// The dock item is derived (id lookup in placedItems): delete or deselect
// nulls it automatically — no stale control is possible.
function selectionChromeFor(selectedItem, placedItems, viewMode, isLocalhost) {
    const clickSelected = selectedItem?.via === 'click';
    const placed = clickSelected ? (placedItems.find(i => i.id === selectedItem.id) || null) : null;
    const chromeVisible = viewMode === '2d' && isLocalhost && placed;
    return {
        menuSelection: clickSelected ? null : selectedItem,
        dockItem: chromeVisible ? placed : null,
    };
}

function getWalls(mapData) {
    return mapData?.walls;
}

// Returns the revealed set (as an array) with every cell from `visible` merged
// in, or null when nothing new was revealed. Fog of war is persistent: a cell
// that has ever been seen stays seen, so we only ever grow the revealed set.
function mergeNewlyRevealed(visible, revealed) {
    const current = new Set(revealed || []);
    let grew = false;
    for (const key of visible) {
        if (!current.has(key)) {
            grew = true;
            break;
        }
    }
    if (!grew) return null;
    for (const key of visible) current.add(key);
    return Array.from(current);
}

function Map({ campaignName, characters, isLocalhost, mapName, onBack, onEncounterCreated, onPoiEntered }) {
    const [gridSize, setGridSize] = useState(30);
    const SVG_SIZE = gridSize * CELL_SIZE;
    const svgRef = useRef(null);

    const [tool, setTool] = useState(TOOL_NONE);
    const [itemsPanelOpen, setItemsPanelOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [renamePopover, setRenamePopover] = useState(null);
    const [viewingMonster, setViewingMonster] = useSyncedState('campaign', 'map-viewingMonster', null, campaignName);
    const [monstersLoaded, setMonstersLoaded] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [spellMode, setSpellMode] = useState(null);
    const [selectedShape, setSelectedShape] = useState(OverlayShape.SPHERE);
    const [shapeParams, setShapeParams] = useState(DEFAULTS.sphere);
    const [viewMode, setViewMode] = useState('2d');

    const { mapData, setMapData, placedItems, setPlacedItems, flushSave } = useMapLoader({
        campaignName, characters, mapName, gridSize, setGridSize, isLocalhost,
    });

    const {
        zoom, panX, panY,
        zoomIn, zoomOut, resetView,
        gridCenterX, gridCenterY,
        getGridFromEvent,
        panning, handlePanStart, handlePanMove, handlePanEnd,
        handleWheel,
        clientToSVG,
    } = useZoomPan(svgRef);

    const {
        painting,
        handleGridPointerDown,
        handleGridPointerMove,
        handleGridPointerUp,
        handleGridPointerLeave,
    } = useWallDrawing({ isLocalhost, tool, getGridFromEvent, svgRef });

    const {
        selectionRect, selectedWalls, selectedItems, moveOffset,
        selectedWallsRef, selectedItemsRef, selectStart, moveStartGrid,
        placedItemsRef, mapDataRef,
        handleSelectPointerDown, handleSelectPointerMove, handleSelectPointerUp,
    } = useSelectMove({ isLocalhost, tool, getGridFromEvent, svgRef, campaignName });

    const {
        rulerMode, setRulerMode,
        rulerStart, rulerEnd, rulerPreview,
        resetRuler,
        handleRulerPointerDown, handleRulerPointerMove, handleRulerPointerUp,
    } = useRuler();

    const {
        overlays,
        addOverlay,
        updateOverlay,
        updateOverlayImmediate,
        removeOverlay,
        clearOverlays,
        handleSSEEvent: handleSpellOverlayEvent,
    } = useSpellOverlay(campaignName, mapName);

    const {
        spellDraft,
        dragOverlay, rotateOverlay,
        spellDragActiveRef,
        handleSpellPointerDown, handleSpellPointerMove, handleSpellPointerUp,
        handleSpellDragMove, handleSpellDragEnd,
    } = useSpellHandlers({
        rulerMode, getGridFromEvent, clientToSVG,
        addOverlay, shapeParams, updateOverlay, updateOverlayImmediate, svgRef,
    });

    const { handleDrop } = useMapDrops({ isLocalhost, getGridFromEvent, setMapData, setPlacedItems, placedItems, gridSize });

    useEffect(() => {
        loadMonsters().then(setMonstersLoaded).catch((e) => { console.error("[Map] Error:", e); });
    }, []);

    const handleViewStats = useCallback((itemId) => {
        const item = placedItems.find(i => i.id === itemId);
        if (!item || item.type !== 'npc') return;
        const baseName = (item.name || '').replace(/\s+\d+$/, '');
        const monster = (monstersLoaded || []).find(
            m => m.name.toLowerCase() === baseName.toLowerCase()
        );
        if (monster) {
            setViewingMonster(monster);
        }
    }, [placedItems, monstersLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

    const monsterFound = useMemo(() => {
        if (!selectedItem) return false;
        const item = placedItems.find(i => i.id === selectedItem.id);
        if (!item || item.type !== 'npc') return false;
        const baseName = (item.name || '').replace(/\s+\d+$/, '');
        return (monstersLoaded || []).some(
            m => m.name.toLowerCase() === baseName.toLowerCase()
        );
    }, [selectedItem, placedItems, monstersLoaded]);

    const { handleSSEEvent: handleMapSSEEvent } = useSSESync({
        campaignName, mapName, setGridSize, setMapData, setPlacedItems,
    });

    const handleSSEEvent = useCallback((event) => {
        handleMapSSEEvent(event);
        handleSpellOverlayEvent(event);
    }, [handleMapSSEEvent, handleSpellOverlayEvent]);

    const { dragging, snapToast, handlePointerDown, handlePointerMove, handlePointerUp } = usePlayerDragging({
        svgRef, mapData, gridSize, panX, panY, setMapData, gridCenterX, gridCenterY, rulerMode, spellMode, campaignName,
        isLocalhost, walls: getWalls(mapData), placedItems,
    });

    const { itemDragging, handleItemPointerDown, handleItemPointerMove, handleItemPointerUp: handleItemPointerUpHook, handleItemPointerLeave } = useItemDragging({
        svgRef, placedItems, setPlacedItems, gridSize, gridCenterX, gridCenterY, rulerMode, spellMode, campaignName, mapData,
    });

    // Click-select press recorder (see resolveItemClick): the left-button
    // drag hook stopPropagations pointerdown, so a press on a token never
    // routes to the pan/paint lanes — the wrapper records at the target phase
    // BEFORE delegating. Recorded ONLY in the default (pan) mode: paint/erase/
    // select tools and ruler/spell lanes record nothing, so their clicks can
    // never select. The svg's own onClick (React bubble phase — click is NOT
    // suppressed by the hook's pointerdown preventDefault/capture; verified
    // live 2026-10-25) consumes-and-clears the press on every gesture, so a
    // stale press can never select a different item later.
    const itemPressRef = useRef(null);
    const handleItemPointerDownTracked = useCallback((e, itemId) => {
        if (e.button === 0 && tool === TOOL_NONE && !rulerMode && !spellMode) {
            const item = (placedItems || []).find(i => i.id === itemId);
            itemPressRef.current = item
                ? { itemId, gridX: item.gridX, gridY: item.gridY, clientX: e.clientX, clientY: e.clientY }
                : null;
        } else {
            itemPressRef.current = null;
        }
        handleItemPointerDown(e, itemId);
    }, [tool, rulerMode, spellMode, placedItems, handleItemPointerDown]);

    // Exploration memory: merge newly revealed cells into the persisted set so
    // uncovered areas stay uncovered. GM (localhost) only — the write PUTs the
    // whole map document (useMapLoader autosave) and is idempotent ONLY when the
    // client is the single author. A read-only (network) client that merges its
    // own line-of-sight back in resurrects cells the GM just fogged: live
    // 2026-10-24 a LAN player tab PUT revealed=400 seconds after a GM fog reset
    // (bug-player-clients-clobber-fog-reset). Players still mirror every map
    // change they DO receive via SSE (useSSESync); they just never author it.
    const revealed = mapData?.revealed;
    const { fog, visible } = useFogOfWar(mapData?.players, mapData?.walls, placedItems, gridSize, revealed);
    useEffect(() => {
        if (!isLocalhost) return;
        const next = mergeNewlyRevealed(visible, revealed);
        if (next) {
            setMapData(prev => ({ ...prev, revealed: next }));
        }
    }, [isLocalhost, visible, revealed, setMapData]);

    // GM: wipe exploration memory, leaving only the current line of sight
    // uncovered (the map's starting state).
    const resetFog = useCallback(() => {
        if (!isLocalhost) return;
        setMapData(prev => ({ ...prev, revealed: Array.from(visible) }));
    }, [isLocalhost, visible, setMapData]);

    const { npcImages, setNpcImages } = useNpcImageCache(placedItems, campaignName);

    // Rename by the token's stable id, never by name: duplicate-named tokens
    // (every unnamed palette NPC displays "NPC") used to ALL rename together
    // when one was edited (bug-map-rename-all-same-named-tokens). Mirrors the
    // sibling id-matched ops in ItemContextMenu (delete/rotate/visibility).
    // The npcImages reset stays keyed on the new name so a renamed token never
    // inherits an image cached under that name from a different NPC.
    const handleRenameItem = useCallback((id, newName) => {
        if (!id || !newName || !newName.trim()) return;
        setPlacedItems(prev =>
            prev.map(item =>
                item.id === id ? { ...item, name: newName.trim() } : item
            )
        );
        setRenamePopover(null);
        setSelectedItem(null);
        setNpcImages(prev => ({ ...prev, [newName.trim()]: null }));
    }, [setNpcImages, setPlacedItems, setRenamePopover, setSelectedItem]);

    const {
        handleToggleItemVisibility,
        handleDeleteItem,
        handleToggleDoor,
        handleRotate,
    } = usePlacedItems(setPlacedItems, setSelectedItem, placedItems);

    const handleRemovePlayer = useCallback((playerId) => {
        setMapData(prev => ({
            ...prev,
            players: (prev.players || []).filter(p => p.id !== playerId),
        }));
        setSelectedPlayer(null);
    }, [setMapData]);

    const handleCloseMenu = useCallback(() => {
        setSelectedItem(null);
        setSelectedPlayer(null);
        setRenamePopover(null);
        itemPressRef.current = null;
    }, [setSelectedItem, setSelectedPlayer, setRenamePopover]);

    // Left-click / tap on a placed item selects it (backlog 2026-10-25:
    // delete was contextmenu-only). The captured pointer's click lands on the
    // svg root (Playwright-verified 2026-10-25), so this single svg handler is
    // the consumption seam: a same-cell, near-zero-movement press becomes a
    // { id, gridX, gridY, via: 'click' } selection that surfaces the visible
    // ItemDetailsDock; anything else (empty canvas, drag) keeps the existing
    // close-on-click behavior. The `via` marker keeps the right-click lane
    // byte-identical (no marker → SVG context menu exactly as before).
    const handleSvgClick = useCallback((e) => {
        if (e.button !== 0) return;
        const press = itemPressRef.current;
        itemPressRef.current = null;
        const clicked = resolveItemClick(press, e, placedItems);
        if (clicked) {
            setSelectedItem({ ...clicked, via: 'click' });
            return;
        }
        handleCloseMenu();
    }, [placedItems, setSelectedItem, handleCloseMenu]);

    const handleRenameClicked = (event, item, defaultName) => {
        if (!svgRef.current) return;
        const svgRect = svgRef.current.getBoundingClientRect();
        const placedItem = placedItems.find(i => i.id === item.id);
        const vbX = panX;
        const vbY = panY;
        const scaleX = svgRect.width / (SVG_SIZE / zoom);
        const scaleY = svgRect.height / (SVG_SIZE / zoom);
        const menuSvgX = gridCenterX(item.gridX) + 10;
        const menuSvgY = gridCenterY(item.gridY) + 10;
        const domX = svgRect.left + (menuSvgX - vbX) * scaleX;
        const domY = svgRect.top + (menuSvgY - vbY) * scaleY + 80;
        setSelectedItem(null);
        // id is threaded straight through to the commit handler so the rename
        // targets exactly this token even when other placedItems share its name.
        setRenamePopover({ id: item.id, name: defaultName || placedItem?.name || 'NPC', position: { left: `${domX}px`, top: `${domY}px` } });
    };

    useEffect(() => { placedItemsRef.current = placedItems; }, [placedItems, placedItemsRef]);
    useEffect(() => { selectedWallsRef.current = selectedWalls; }, [selectedWalls, selectedWallsRef]);
    useEffect(() => { selectedItemsRef.current = selectedItems; }, [selectedItems, selectedItemsRef]);
    useEffect(() => { mapDataRef.current = mapData; }, [mapData, mapDataRef]);

    const handleToolPanStart = useCallback((e) => {
        if (spellDragActiveRef.current) return;
        if (tool === TOOL_PAINT || tool === TOOL_ERASE) {
            handleGridPointerDown(e, setMapData);
            return;
        }
        if (tool === TOOL_SELECT) {
            handleSelectPointerDown(e, placedItems, mapData);
            return;
        }
        handlePanStart(e, panX, panY);
    }, [tool, panX, panY, handleGridPointerDown, handleSelectPointerDown, handlePanStart, placedItems, mapData, setMapData, spellDragActiveRef]);

    const handleToolPointerMove = useCallback((e) => {
        handlePointerMove(e);
        handleItemPointerMove(e);
        handleGridPointerMove(e, setMapData, painting, tool);
        handleSelectPointerMove(e);
        handlePanMove(e);
        handleSpellPointerMove(e, spellDraft);
        handleSpellDragMove(e, dragOverlay, rotateOverlay, overlays, getGridFromEvent, clientToSVG, updateOverlay);
        handleRulerPointerMove(e, rulerMode, rulerStart, rulerEnd, getGridFromEvent);
    }, [handlePointerMove, handleItemPointerMove, handleGridPointerMove, handleSelectPointerMove, handlePanMove, handleSpellPointerMove, handleSpellDragMove, handleRulerPointerMove, setMapData, painting, tool, spellDraft, dragOverlay, rotateOverlay, overlays, getGridFromEvent, clientToSVG, updateOverlay, rulerMode, rulerStart, rulerEnd]);

    const handleToolPointerUp = useCallback((e) => {
        flushSave();
        handlePointerUp(e);
        handleItemPointerUpHook(e);
        handleGridPointerUp(e);
        handleSelectPointerUp(e, placedItems, mapData, setMapData, setPlacedItems);
        handlePanEnd(e);
        handleSpellPointerUp(e, spellDraft, spellMode, addOverlay, shapeParams);
        handleSpellDragEnd(e, dragOverlay, rotateOverlay, overlays, getGridFromEvent, clientToSVG, updateOverlayImmediate, svgRef);
        handleRulerPointerUp(e, rulerMode, svgRef);
    }, [flushSave, handlePointerUp, handleItemPointerUpHook, handleGridPointerUp, handleSelectPointerUp, handlePanEnd, handleSpellPointerUp, handleSpellDragEnd, handleRulerPointerUp, placedItems, mapData, setMapData, setPlacedItems, spellDraft, spellMode, addOverlay, shapeParams, dragOverlay, rotateOverlay, overlays, getGridFromEvent, clientToSVG, updateOverlayImmediate, rulerMode, svgRef]);

    const handleToolPointerLeave = useCallback((e) => {
        flushSave();
        handleItemPointerLeave();
        handleGridPointerLeave(e);
        handleSelectPointerUp(e, placedItems, mapData, setMapData, setPlacedItems);
    }, [flushSave, handleItemPointerLeave, handleGridPointerLeave, handleSelectPointerUp, placedItems, mapData, setMapData, setPlacedItems]);

    const handleSetRulerMode = useCallback((value) => {
        setRulerMode(value);
        if (value) {
            setSpellMode(null);
            resetRuler();
        }
    }, [setRulerMode, setSpellMode, resetRuler]);

    if (!mapData) return null;

    // Outdoor hex maps render entirely through HexMap (everything below is the
    // indoor branch). The loaded document's authored displayName flows to the
    // arena-spawn naming so "QA Hex 2" never re-title-cases into "Qa Hex 2"
    // (backlog 2026-10-25 eve); a blank one falls back inside
    // buildEncounterMapDisplayName to the title-cased slug.
    // key={mapName} (#798): an outdoor→outdoor flip must remount HexMap so
    // its useMapLoader guard resets and reloads — without the key the same
    // instance keeps the previous map's terrain/pois on screen.
    if (mapData.type === 'outdoor') {
        return (
            <HexMap
                key={mapName}
                campaignName={campaignName}
                mapName={mapName}
                parentDisplayName={mapData.displayName}
                onBack={onBack}
                characters={characters}
                onEncounterCreated={onEncounterCreated}
                isLocalhost={isLocalhost}
                onPoiEntered={onPoiEntered}
            />
        );
    }

    const { players } = mapData;
    const effectiveWalls = computeEffectiveWalls(mapData.walls, placedItems);

    // Click-select details dock / contextmenu menu split — see selectionChromeFor.
    const { menuSelection, dockItem } = selectionChromeFor(selectedItem, placedItems, viewMode, isLocalhost);

    return (
        // data-testid: mount-proof hook for automation — present ONLY while an
        // indoor map editor is mounted (root renders null until mapData loads,
        // and HexMap carries the same id for outdoor maps). Proves the maps
        // list "Open" click actually navigated, without polling for tokens.
        <div className="map" data-testid="map-editor">
            <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />
            {viewMode === '3d' ? (
                <Map3D
                    campaignName={campaignName}
                    mapData={mapData}
                    placedItems={placedItems}
                    characters={characters}
                    isLocalhost={isLocalhost}
                    fog={fog}
                    npcImages={npcImages}
                    overlays={overlays}
                    onExit={() => setViewMode('2d')}
                />
            ) : (
                <>
            <MapToolbar
                mapName={mapName}
                displayName={mapData.displayName}
                isLocalhost={isLocalhost}
                tool={tool}
                setTool={setTool}
                gridSize={gridSize}
                setGridSize={setGridSize}
                itemsPanelOpen={itemsPanelOpen}
                setItemsPanelOpen={setItemsPanelOpen}
                zoomIn={zoomIn}
                zoomOut={zoomOut}
                resetView={resetView}
                resetFog={resetFog}
                onBack={onBack}
                rulerMode={rulerMode}
                setRulerMode={handleSetRulerMode}
                onEnter3D={() => setViewMode('3d')}
                spellOverlayState={{
                    spellMode,
                    setSpellMode,
                    selectedShape,
                    setSelectedShape,
                    shapeParams,
                    setShapeParams,
                    overlays,
                    removeOverlay,
                    clearOverlays,
                }}
            />
            {/* Read-only header description panel (backlog 2026-10-26) — the
                panel self-gates on empty/missing description, so this call
                site adds zero branches. */}
            <MapDescriptionPanel mapData={mapData} />
            <svg
                ref={svgRef}
                viewBox={`${panX} ${panY} ${SVG_SIZE / zoom} ${SVG_SIZE / zoom}`}
                className="grid-svg"
                onPointerDown={(e) => { handleSpellPointerDown(e, spellMode, overlays); handleRulerPointerDown(e, { rulerMode, rulerStart, rulerEnd, getGridFromEvent, svgRef }); handleToolPanStart(e); }}
                onPointerMove={handleToolPointerMove}
                onPointerUp={handleToolPointerUp}
                onPointerLeave={handleToolPointerLeave}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={handleSvgClick}
                style={{ cursor: getCursor({ panning, rulerMode, tool, moveOffset }) }}
            >
                <defs>
                    <BarrelSVG id="barrel" />
                    <TableSVG id="table" />
                    <BedSVG id="bed" />
                    <FirePitSVG id="firepit" />
                    <DoorSVG id="door" />
                    <SecretDoorSVG id="secretDoor" />
                    <TrapSVG id="trap" />
                    <PillarSVG id="pillar" />
                    <StairsSVG id="stairs" />
                    <AltarSVG id="altar" />
                    <ArrowSlitWallSVG id="arrowSlitWall" />
                    <BookshelfSVG id="bookshelf" />
                    <ChairSVG id="chair" />
                    <ChestSVG id="chest" />
                    <CrateSVG id="crate" />
                    <FountainSVG id="fountain" />
                    <SkeletonSVG id="skeleton" />
                    <StatueSVG id="statue" />
                    <TorchSVG id="torch" />
                    <WebSVG id="web" />
                    <TreeSVG id="tree" />
                    <BoulderSVG id="boulder" />
                    <BushSVG id="bush" />
                </defs>

                <GridAndWalls
                    gridSize={gridSize}
                    walls={effectiveWalls}
                    isLocalhost={isLocalhost}
                    fog={fog}
                    bgFill={mapData.bgFill}
                />

                <Players
                    players={players}
                    characters={characters}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    isLocalhost={isLocalhost}
                    fog={fog}
                    dragging={dragging}
                    handlePointerDown={handlePointerDown}
                    selectedPlayer={selectedPlayer}
                    setSelectedPlayer={setSelectedPlayer}
                    campaignName={campaignName}
                />

                <PlacedItems
                    placedItems={placedItems}
                    isLocalhost={isLocalhost}
                    fog={fog}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    setSelectedItem={setSelectedItem}
                    npcImages={npcImages}
                    itemDragging={itemDragging}
                    handleItemPointerDown={handleItemPointerDownTracked}
                />

                <SelectionPreviewRect visible={selectStart.current} rect={selectionRect} className="selection-preview" />

                {/* Above map content so fogged areas cover their walls/items
                    for players; GM sees through the veil */}
                <FogOverlay
                    fog={fog}
                    isLocalhost={isLocalhost}
                />

                <SelectionOutline
                    selectionActive={selectStart.current}
                    moveActive={moveStartGrid.current}
                    selectedWalls={selectedWalls}
                    selectedItems={selectedItems}
                    placedItems={placedItems}
                />

                <SelectedWalls selectedWalls={selectedWalls} />

                <SelectedItemHighlights selectedItems={selectedItems} placedItems={placedItems} />

                <MovePreview
                    moveOffset={moveOffset}
                    selectedWalls={selectedWalls}
                    selectedItems={selectedItems}
                    placedItems={placedItems}
                />

                <ItemContextMenu
                    selectedItem={menuSelection}
                    placedItems={placedItems}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    handleToggleItemVisibility={handleToggleItemVisibility}
                    handleDeleteItem={handleDeleteItem}
                    handleToggleDoor={handleToggleDoor}
                    handleRotate={handleRotate}
                    handleViewStats={handleViewStats}
                    monsterFound={monsterFound}
                    onRenameClicked={handleRenameClicked}
                    onClose={handleCloseMenu}
                />

                <PlayerContextMenu
                    selectedPlayer={selectedPlayer}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    handleRemovePlayer={handleRemovePlayer}
                    setSelectedPlayer={setSelectedPlayer}
                />

                <SpellOverlayRenderer
                    overlays={overlays}
                    pendingOverlay={buildPendingOverlay(spellDraft, spellMode, shapeParams)}
                />

                <RulerOverlay
                    start={rulerStart}
                    end={rulerEnd || rulerPreview}
                    cellSize={CELL_SIZE}
                />
            </svg>
            {/* Enforcement snap-back toast (display-only visibility for the
                movement-budget clamp — see MapSnapToast.jsx) */}
            <MapSnapToast snapToast={snapToast} />
                </>
            )}

            {/* Click-select details dock — visible Delete affordance anchored
                to the map chrome (backlog 2026-10-25). selectionChromeFor
                already nulls it off the 2D/GM lanes and on deselect. */}
            <ItemDetailsDock
                item={dockItem}
                handleDeleteItem={handleDeleteItem}
                onDismiss={handleCloseMenu}
            />

            {viewMode === '2d' && renamePopover && (
                <MonsterNameAutocomplete
                    key={renamePopover.name}
                    value={renamePopover.name}
                    position={renamePopover.position}
                    onCommit={(newName) => handleRenameItem(renamePopover.id, newName)}
                />
            )}

            {isLocalhost && itemsPanelOpen && viewMode === '2d' && (
                <ItemsPanel
                    itemsPanelOpen={itemsPanelOpen}
                    placedItems={placedItems}
                    onToggleItemVisibility={handleToggleItemVisibility}
                    onClose={() => setItemsPanelOpen(false)}
                    characters={characters}
                    players={players}
                    mapVariant={mapData.parentHex ? 'outdoor' : 'indoor'}
                    campaignName={campaignName}
                />
            )}

            {viewingMonster && (
                <MonsterCardModal
                    monster={viewingMonster}
                    onClose={() => setViewingMonster(null)}
                    campaignName={campaignName}
                    mapName={mapName}
                    characters={characters}
                />
            )}
        </div>
    );
}

export default Map;
