import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Subscriber from '../common/Subscriber.jsx';
import MapToolbar from './MapToolbar.jsx';
import { loadMonsters } from '../../services/dataLoader.js';
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
import { OverlayShape, DEFAULTS } from '../../models/SpellOverlay.js';
import HexMap from '../hex-map/HexMap';
import '../hex-map/HexMap.css';
import RoomContextMenu from './RoomContextMenu.jsx';
import PlayerContextMenu from './PlayerContextMenu.jsx';
import useMapLoader from './hooks/useMapLoader';
import useZoomPan from './hooks/useZoomPan';
import useWallDrawing from './hooks/useWallDrawing';
import useRoomDrawing from './hooks/useRoomDrawing';
import useSelectMove from './hooks/useSelectMove';
import useRuler from './hooks/useRuler';
import useSpellHandlers from './hooks/useSpellHandlers';
import useMapDrops from './hooks/useMapDrops';
import { CELL_SIZE, TOOL_NONE, TOOL_PAINT, TOOL_ERASE, TOOL_SELECT, TOOL_ROOM } from '../../config/mapConfig';

function Map({ campaignName, characters, isLocalhost, mapName, onBack, onEncounterCreated, onPoiEntered }) {
    const [gridSize, setGridSize] = useState(30);
    const SVG_SIZE = gridSize * CELL_SIZE;
    const svgRef = useRef(null);

    const [tool, setTool] = useState(TOOL_NONE);
    const [itemsPanelOpen, setItemsPanelOpen] = useState(false);
    const [selectedItem, setSelectedItem] = useState(null);
    const [renamePopover, setRenamePopover] = useState(null);
    const [viewingMonster, setViewingMonster] = useState(null);
    const [monstersLoaded, setMonstersLoaded] = useState([]);
    const [selectedPlayer, setSelectedPlayer] = useState(null);
    const [spellMode, setSpellMode] = useState(null);
    const [selectedShape, setSelectedShape] = useState(OverlayShape.SPHERE);
    const [shapeParams, setShapeParams] = useState(DEFAULTS.sphere);

    const { mapData, setMapData, placedItems, setPlacedItems } = useMapLoader({
        campaignName, characters, mapName, gridSize, setGridSize,
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
        roomDrawRect, selectedRoom, setSelectedRoom,
        handleRoomPointerDown, handleRoomPointerMove, handleRoomPointerUp, handleRoomClick,
    } = useRoomDrawing({ isLocalhost, tool, getGridFromEvent, svgRef });

    const {
        selectionRect, selectedWalls, selectedItems, moveOffset,
        selectedWallsRef, selectedItemsRef, selectStart, moveStartGrid,
        placedItemsRef, mapDataRef,
        handleSelectPointerDown, handleSelectPointerMove, handleSelectPointerUp,
    } = useSelectMove({ isLocalhost, tool, getGridFromEvent, svgRef });

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

    const { handleDrop } = useMapDrops({ isLocalhost, getGridFromEvent, setMapData, setPlacedItems });

    useEffect(() => {
        loadMonsters().then(setMonstersLoaded).catch(() => {});
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
    }, [placedItems, monstersLoaded]);

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

    const { dragging, handlePointerDown, handlePointerMove, handlePointerUp } = usePlayerDragging({
        svgRef, mapData, gridSize, panX, panY, setMapData, gridCenterX, gridCenterY, rulerMode, spellMode,
    });

    const { itemDragging, handleItemPointerDown, handleItemPointerMove, handleItemPointerUp: handleItemPointerUpHook, handleItemPointerLeave } = useItemDragging({
        svgRef, placedItems, setPlacedItems, gridSize, gridCenterX, gridCenterY, rulerMode, spellMode,
    });

    const fog = useFogOfWar(mapData?.players, mapData?.walls, placedItems, gridSize);

    const { npcImages, setNpcImages } = useNpcImageCache(placedItems);

    const handleRenameItem = useCallback((oldName, newName) => {
        if (!newName || !newName.trim()) return;
        setPlacedItems(prev =>
            prev.map(item =>
                item.name === oldName ? { ...item, name: newName.trim() } : item
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
    } = usePlacedItems(setPlacedItems, setSelectedItem);

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
        setSelectedRoom(null);
        setRenamePopover(null);
    }, [setSelectedItem, setSelectedPlayer, setSelectedRoom, setRenamePopover]);

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
        setRenamePopover({ itemName: placedItem?.name || defaultName || 'NPC', name: defaultName || placedItem?.name || 'NPC', position: { left: `${domX}px`, top: `${domY}px` } });
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
        if (tool === TOOL_ROOM) {
            handleRoomPointerDown(e);
            return;
        }
        handlePanStart(e, panX, panY);
    }, [tool, panX, panY, handleGridPointerDown, handleSelectPointerDown, handleRoomPointerDown, handlePanStart, placedItems, mapData, setMapData, spellDragActiveRef]);

    const handleToolPointerMove = useCallback((e) => {
        handlePointerMove(e);
        handleItemPointerMove(e);
        handleGridPointerMove(e, setMapData, painting, tool);
        handleSelectPointerMove(e);
        handleRoomPointerMove(e);
        handlePanMove(e);
        handleSpellPointerMove(e, spellDraft);
        handleSpellDragMove(e, dragOverlay, rotateOverlay, overlays, getGridFromEvent, clientToSVG, updateOverlay);
        handleRulerPointerMove(e, rulerMode, rulerStart, rulerEnd, getGridFromEvent);
    }, [handlePointerMove, handleItemPointerMove, handleGridPointerMove, handleSelectPointerMove, handleRoomPointerMove, handlePanMove, handleSpellPointerMove, handleSpellDragMove, handleRulerPointerMove, setMapData, painting, tool, spellDraft, dragOverlay, rotateOverlay, overlays, getGridFromEvent, clientToSVG, updateOverlay, rulerMode, rulerStart, rulerEnd]);

    const handleToolPointerUp = useCallback((e) => {
        handlePointerUp(e);
        handleItemPointerUpHook(e);
        handleGridPointerUp(e);
        handleSelectPointerUp(e, placedItems, mapData, setMapData, setPlacedItems);
        handleRoomPointerUp(e, gridSize, setMapData);
        handlePanEnd(e);
        handleSpellPointerUp(e, spellDraft, spellMode, addOverlay, shapeParams);
        handleSpellDragEnd(e, dragOverlay, rotateOverlay, overlays, getGridFromEvent, clientToSVG, updateOverlayImmediate, svgRef);
        handleRulerPointerUp(e, rulerMode, svgRef);
    }, [handlePointerUp, handleItemPointerUpHook, handleGridPointerUp, handleSelectPointerUp, handleRoomPointerUp, handlePanEnd, handleSpellPointerUp, handleSpellDragEnd, handleRulerPointerUp, placedItems, mapData, setMapData, setPlacedItems, gridSize, spellDraft, spellMode, addOverlay, shapeParams, dragOverlay, rotateOverlay, overlays, getGridFromEvent, clientToSVG, updateOverlayImmediate, rulerMode, svgRef]);

    const handleToolPointerLeave = useCallback((e) => {
        handleItemPointerLeave();
        handleGridPointerLeave(e);
        handleSelectPointerUp(e, placedItems, mapData, setMapData, setPlacedItems);
    }, [handleItemPointerLeave, handleGridPointerLeave, handleSelectPointerUp, placedItems, mapData, setMapData, setPlacedItems]);

    const handleSetRulerMode = useCallback((value) => {
        setRulerMode(value);
        if (value) {
            setSpellMode(null);
            resetRuler();
        }
    }, [setRulerMode, setSpellMode, resetRuler]);

    if (!mapData) return null;

    if (mapData?.type === 'outdoor') {
        return <HexMap campaignName={campaignName} mapName={mapName} onBack={onBack} characters={characters} onEncounterCreated={onEncounterCreated} isLocalhost={isLocalhost} onPoiEntered={onPoiEntered} />;
    }

    const { players, walls } = mapData;

    return (
        <div className="map">
            <MapToolbar
                mapName={mapName}
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
                onBack={onBack}
                rulerMode={rulerMode}
                setRulerMode={handleSetRulerMode}
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
            <Subscriber campaignName={campaignName} handleEvent={handleSSEEvent} />
            <svg
                ref={svgRef}
                viewBox={`${panX} ${panY} ${SVG_SIZE / zoom} ${SVG_SIZE / zoom}`}
                className="grid-svg"
                onPointerDown={(e) => { handleSpellPointerDown(e, spellMode, overlays); handleRulerPointerDown(e, rulerMode, rulerStart, rulerEnd, getGridFromEvent, svgRef); handleToolPanStart(e); }}
                onPointerMove={handleToolPointerMove}
                onPointerUp={handleToolPointerUp}
                onPointerLeave={handleToolPointerLeave}
                onWheel={handleWheel}
                onContextMenu={(e) => e.preventDefault()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={(e) => { if (e.button === 0) handleCloseMenu(); handleRoomClick(e, mapData, tool); }}
                style={{ cursor: panning ? 'grabbing' : rulerMode ? 'crosshair' : (tool === TOOL_NONE ? 'grab' : tool === TOOL_SELECT ? (moveOffset ? 'grabbing' : 'crosshair') : tool === TOOL_ROOM ? 'crosshair' : 'default') }}
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
                    walls={walls}
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
                    handleItemPointerDown={handleItemPointerDown}
                />

                <FogOverlay
                    fog={fog}
                    isLocalhost={isLocalhost}
                />

                {selectStart.current && selectionRect && (() => {
                    const { minX, maxX, minY, maxY } = selectionRect;
                    return (
                        <rect
                            x={minX * CELL_SIZE}
                            y={minY * CELL_SIZE}
                            width={(maxX - minX + 1) * CELL_SIZE}
                            height={(maxY - minY + 1) * CELL_SIZE}
                            className="selection-preview"
                        />
                    );
                })()}

                {roomDrawRect && (() => {
                    const { minX, maxX, minY, maxY } = roomDrawRect;
                    return (
                        <rect
                            x={minX * CELL_SIZE}
                            y={minY * CELL_SIZE}
                            width={(maxX - minX + 1) * CELL_SIZE}
                            height={(maxY - minY + 1) * CELL_SIZE}
                            className="room-draw-preview"
                        />
                    );
                })()}

                {(mapData?.rooms || []).map(room => {
                    const r = room.rect;
                    const isSelected = selectedRoom && selectedRoom.id === room.id;
                    const typeClass = 'room-type-' + (room.type || 'common');
                    return (
                        <g key={'room-' + room.id}>
                            <rect
                                x={r.x * CELL_SIZE}
                                y={r.y * CELL_SIZE}
                                width={r.w * CELL_SIZE}
                                height={r.h * CELL_SIZE}
                                className={`room-highlight ${typeClass} ${isSelected ? 'room-selected' : ''}`}
                            />
                            {(tool === TOOL_NONE || tool === TOOL_SELECT) && (
                                <rect
                                    x={r.x * CELL_SIZE}
                                    y={r.y * CELL_SIZE}
                                    width={r.w * CELL_SIZE}
                                    height={r.h * CELL_SIZE}
                                    fill="transparent"
                                    className="room-hit-area"
                                />
                            )}
                            <text
                                x={(r.x + r.w / 2) * CELL_SIZE}
                                y={(r.y + r.h / 2) * CELL_SIZE}
                                className="room-label"
                                textAnchor="middle"
                                dominantBaseline="central"
                            >
                                {room.label || room.type || 'common'}
                            </text>
                        </g>
                    );
                })}

                {!selectStart.current && !moveStartGrid.current && (selectedWalls.size > 0 || selectedItems.size > 0) && (() => {
                    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
                    for (const key of selectedWalls) {
                        const [x, y] = key.split(',').map(Number);
                        mnX = Math.min(mnX, x); mxX = Math.max(mxX, x);
                        mnY = Math.min(mnY, y); mxY = Math.max(mxY, y);
                    }
                    for (const id of selectedItems) {
                        const item = placedItems.find(i => i.id === id);
                        if (item) {
                            mnX = Math.min(mnX, item.gridX); mxX = Math.max(mxX, item.gridX);
                            mnY = Math.min(mnY, item.gridY); mxY = Math.max(mxY, item.gridY);
                        }
                    }
                    if (mnX === Infinity) return null;
                    return (
                        <rect
                            x={mnX * CELL_SIZE}
                            y={mnY * CELL_SIZE}
                            width={(mxX - mnX + 1) * CELL_SIZE}
                            height={(mxY - mnY + 1) * CELL_SIZE}
                            className="selection-outline"
                        />
                    );
                })()}

                {selectedWalls.size > 0 && Array.from(selectedWalls).map(key => {
                    const [gx, gy] = key.split(',').map(Number);
                    return (
                        <rect
                            key={`sel-wall-${key}`}
                            x={gx * CELL_SIZE}
                            y={gy * CELL_SIZE}
                            width={CELL_SIZE}
                            height={CELL_SIZE}
                            className="selection-wall"
                        />
                    );
                })()}

                {selectedItems.size > 0 && placedItems.filter(item => selectedItems.has(item.id)).map(item => {
                    const w = (item.type === 'table' || item.type === 'bed' || item.type === 'altar' || item.type === 'bookshelf')
                        && item.rotation !== 90 && item.rotation !== 270 ? CELL_SIZE * 2 : CELL_SIZE;
                    const h = (item.type === 'table' || item.type === 'bed' || item.type === 'altar' || item.type === 'bookshelf')
                        && (item.rotation === 90 || item.rotation === 270) ? CELL_SIZE * 2 : CELL_SIZE;
                    return (
                        <rect
                            key={`sel-item-${item.id}`}
                            x={item.gridX * CELL_SIZE}
                            y={item.gridY * CELL_SIZE}
                            width={w}
                            height={h}
                            className="selection-item-highlight"
                        />
                    );
                })()}

                {moveOffset && (moveOffset.dx !== 0 || moveOffset.dy !== 0) && (selectedWalls.size > 0 || selectedItems.size > 0) && (() => {
                    let mnX = Infinity, mxX = -Infinity, mnY = Infinity, mxY = -Infinity;
                    for (const key of selectedWalls) {
                        const [x, y] = key.split(',').map(Number);
                        mnX = Math.min(mnX, x); mxX = Math.max(mxX, x);
                        mnY = Math.min(mnY, y); mxY = Math.max(mxY, y);
                    }
                    for (const id of selectedItems) {
                        const item = placedItems.find(i => i.id === id);
                        if (item) {
                            mnX = Math.min(mnX, item.gridX); mxX = Math.max(mxX, item.gridX);
                            mnY = Math.min(mnY, item.gridY); mxY = Math.max(mxY, item.gridY);
                        }
                    }
                    if (mnX === Infinity) return null;
                    return (
                        <rect
                            x={(mnX + moveOffset.dx) * CELL_SIZE}
                            y={(mnY + moveOffset.dy) * CELL_SIZE}
                            width={(mxX - mnX + 1) * CELL_SIZE}
                            height={(mxY - mnY + 1) * CELL_SIZE}
                            className="selection-preview"
                        />
                    );
                })()}

                <ItemContextMenu
                    selectedItem={selectedItem}
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

                <RoomContextMenu
                    selectedRoom={selectedRoom}
                    isLocalhost={isLocalhost}
                    gridSize={gridSize}
                    gridCenterX={gridCenterX}
                    gridCenterY={gridCenterY}
                    setMapData={setMapData}
                    setSelectedRoom={setSelectedRoom}
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
                    pendingOverlay={spellDraft ? { ...spellDraft, shape: spellMode, ...shapeParams, id: 'pending' } : null}
                />

                <RulerOverlay
                    start={rulerStart}
                    end={rulerEnd || rulerPreview}
                    cellSize={CELL_SIZE}
                />
            </svg>

            {renamePopover && (
                <MonsterNameAutocomplete
                    key={renamePopover.name}
                    value={renamePopover.name}
                    position={renamePopover.position}
                    onCommit={(newName) => handleRenameItem(renamePopover.itemName, newName)}
                />
            )}

            {isLocalhost && itemsPanelOpen && (
                <ItemsPanel
                    itemsPanelOpen={itemsPanelOpen}
                    placedItems={placedItems}
                    onToggleItemVisibility={handleToggleItemVisibility}
                    onClose={() => setItemsPanelOpen(false)}
                    characters={characters}
                    players={players}
                    mapVariant={mapData.parentHex ? 'outdoor' : 'indoor'}
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
