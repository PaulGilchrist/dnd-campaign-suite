// @improved-by-ai
// @cleaned-by-ai
import { describe, it, expect, vi } from 'vitest';
import {
    mockGridCenterX,
    mockGridCenterY,
    createDefaultMocks,
    createZoomPanMocks,
    createWallDrawingMocks,
    createSelectMoveMocks,
    createRulerMocks,
    createSpellOverlayMocks,
    createSpellHandlersMocks,
    createPlayerDraggingMocks,
    createItemDraggingMocks,
    createNpcImageCacheMocks,
    createSSESyncMocks,
    createMapDropsMocks,
    setupMapMocks,
} from './map.test-utils.js';

describe('mapTestUtils', () => {
    describe('mockGridCenterX', () => {
        it('should convert grid X to pixel center using formula gx * 40 + 20', () => {
            expect(mockGridCenterX(0)).toBe(20);
            expect(mockGridCenterX(1)).toBe(60);
            expect(mockGridCenterX(5)).toBe(220);
            expect(mockGridCenterX(10)).toBe(420);
            expect(mockGridCenterX(-1)).toBe(-20);
            expect(mockGridCenterX(2)).toBe(100);
            expect(mockGridCenterX(-5)).toBe(-180);
        });

        it('should return consistent values for the same input', () => {
            const value = mockGridCenterX(7);
            expect(mockGridCenterX(7)).toBe(value);
        });
    });

    describe('mockGridCenterY', () => {
        it('should convert grid Y to pixel center using formula gy * 40 + 20', () => {
            expect(mockGridCenterY(0)).toBe(20);
            expect(mockGridCenterY(1)).toBe(60);
            expect(mockGridCenterY(5)).toBe(220);
            expect(mockGridCenterY(10)).toBe(420);
            expect(mockGridCenterY(-1)).toBe(-20);
            expect(mockGridCenterY(2)).toBe(100);
            expect(mockGridCenterY(-5)).toBe(-180);
        });

        it('should return consistent values for the same input', () => {
            const value = mockGridCenterY(7);
            expect(mockGridCenterY(7)).toBe(value);
        });
    });

    describe('createDefaultMocks', () => {
        it('should return an object with mapData, setMapData, placedItems, setPlacedItems', () => {
            const mocks = createDefaultMocks();

            expect(mocks).toHaveProperty('mapData');
            expect(mocks).toHaveProperty('setMapData');
            expect(mocks).toHaveProperty('placedItems');
            expect(mocks).toHaveProperty('setPlacedItems');
        });

        it('should initialize mapData with empty players and empty walls Set', () => {
            const { mapData } = createDefaultMocks();

            expect(mapData.players).toEqual([]);
            expect(mapData.walls).toBeInstanceOf(Set);
            expect(mapData.walls.size).toBe(0);
        });

        it('should initialize placedItems as empty array', () => {
            const { placedItems } = createDefaultMocks();
            expect(placedItems).toEqual([]);
        });

        it('should create mock functions for setMapData and setPlacedItems', () => {
            const { setMapData, setPlacedItems } = createDefaultMocks();

            setMapData('test');
            setPlacedItems([{ id: 'a' }]);
            expect(setMapData).toHaveBeenCalledWith('test');
            expect(setPlacedItems).toHaveBeenCalledWith([{ id: 'a' }]);
        });

        it('should replace mapData when override is provided', () => {
            const overrides = {
                mapData: { players: [{ name: 'Test' }], walls: new Set(['1,1-2,2']) },
            };
            const { mapData } = createDefaultMocks(overrides);

            expect(mapData.players).toEqual([{ name: 'Test' }]);
            expect(mapData.walls.has('1,1-2,2')).toBe(true);
        });

        it('should replace placedItems when override is provided', () => {
            const overrides = { placedItems: [{ id: 'item1' }] };
            const { placedItems } = createDefaultMocks(overrides);

            expect(placedItems).toEqual([{ id: 'item1' }]);
        });

        it('should replace functions when override is provided', () => {
            const customFn = vi.fn();
            const overrides = { setMapData: customFn };
            const { setMapData } = createDefaultMocks(overrides);

            expect(setMapData).toBe(customFn);
        });

        it('should preserve default values for non-overridden properties', () => {
            const { mapData, placedItems, setMapData, setPlacedItems } = createDefaultMocks({
                placedItems: [{ id: 'x' }],
            });

            expect(placedItems).toEqual([{ id: 'x' }]);
            expect(mapData.players).toEqual([]);
            expect(mapData.walls.size).toBe(0);
            expect(setMapData).toBeInstanceOf(Function);
            expect(setPlacedItems).toBeInstanceOf(Function);
        });
    });

    describe('createZoomPanMocks', () => {
        it('should return an object with all zoom/pan properties', () => {
            const mocks = createZoomPanMocks();

            expect(mocks).toHaveProperty('zoom');
            expect(mocks).toHaveProperty('panX');
            expect(mocks).toHaveProperty('panY');
            expect(mocks).toHaveProperty('zoomIn');
            expect(mocks).toHaveProperty('zoomOut');
            expect(mocks).toHaveProperty('resetView');
            expect(mocks).toHaveProperty('gridCenterX');
            expect(mocks).toHaveProperty('gridCenterY');
            expect(mocks).toHaveProperty('getGridFromEvent');
            expect(mocks).toHaveProperty('panning');
            expect(mocks).toHaveProperty('handlePanStart');
            expect(mocks).toHaveProperty('handlePanMove');
            expect(mocks).toHaveProperty('handlePanEnd');
            expect(mocks).toHaveProperty('handleWheel');
            expect(mocks).toHaveProperty('clientToSVG');
        });

        it('should initialize zoom to 1, panX/panY to 0, panning to false', () => {
            const { zoom, panX, panY, panning } = createZoomPanMocks();

            expect(zoom).toBe(1);
            expect(panX).toBe(0);
            expect(panY).toBe(0);
            expect(panning).toBe(false);
        });

        it('should create mock functions that track calls for all handler functions', () => {
            const { zoomIn, zoomOut, resetView, getGridFromEvent, handlePanStart, handlePanMove, handlePanEnd, handleWheel, clientToSVG } = createZoomPanMocks();

            zoomIn({ delta: 0.1 });
            zoomOut();
            resetView();
            handlePanStart({ clientX: 10 });
            handlePanMove({ clientX: 20 });
            handlePanEnd();
            handleWheel({ deltaY: 100 });
            clientToSVG({ clientX: 50, clientY: 50 });

            expect(zoomIn).toHaveBeenCalledTimes(1);
            expect(getGridFromEvent).not.toHaveBeenCalled();
            expect(handlePanStart).toHaveBeenCalledWith({ clientX: 10 });
        });

        it('should set gridCenterX/gridCenterY to mockGridCenterX/mockGridCenterY', () => {
            const { gridCenterX, gridCenterY } = createZoomPanMocks();

            expect(gridCenterX).toBe(mockGridCenterX);
            expect(gridCenterY).toBe(mockGridCenterY);
        });

        it('should initialize getGridFromEvent to return { gridX: 5, gridY: 5 }', () => {
            const { getGridFromEvent } = createZoomPanMocks();

            const result = getGridFromEvent();
            expect(result).toEqual({ gridX: 5, gridY: 5 });
        });

        it('should accept overrides', () => {
            const customFn = vi.fn(() => ({ gridX: 10, gridY: 10 }));
            const overrides = { zoom: 2, getGridFromEvent: customFn };
            const mocks = createZoomPanMocks(overrides);

            expect(mocks.zoom).toBe(2);
            expect(mocks.getGridFromEvent()).toEqual({ gridX: 10, gridY: 10 });
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createZoomPanMocks();
            const mocksB = createZoomPanMocks();

            expect(mocksA.zoomIn).not.toBe(mocksB.zoomIn);
            expect(mocksA.panX).toBe(0);
            expect(mocksB.panX).toBe(0);
            mocksA.zoomIn();
            expect(mocksB.zoomIn).not.toHaveBeenCalled();
        });
    });

    describe('createWallDrawingMocks', () => {
        it('should return an object with painting and wall event handlers', () => {
            const mocks = createWallDrawingMocks();

            expect(mocks).toHaveProperty('painting');
            expect(mocks).toHaveProperty('handleGridPointerDown');
            expect(mocks).toHaveProperty('handleGridPointerMove');
            expect(mocks).toHaveProperty('handleGridPointerUp');
            expect(mocks).toHaveProperty('handleGridPointerLeave');
        });

        it('should initialize painting to false', () => {
            const { painting } = createWallDrawingMocks();
            expect(painting).toBe(false);
        });

        it('should create mock functions that track calls', () => {
            const { handleGridPointerDown, handleGridPointerMove, handleGridPointerUp } = createWallDrawingMocks();

            handleGridPointerDown({ gridX: 1, gridY: 2 });
            handleGridPointerMove({ gridX: 3, gridY: 4 });

            expect(handleGridPointerDown).toHaveBeenCalledTimes(1);
            expect(handleGridPointerDown).toHaveBeenCalledWith({ gridX: 1, gridY: 2 });
            expect(handleGridPointerMove).toHaveBeenCalledTimes(1);
            expect(handleGridPointerUp).not.toHaveBeenCalled();
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createWallDrawingMocks();
            const mocksB = createWallDrawingMocks();

            expect(mocksA.handleGridPointerDown).not.toBe(mocksB.handleGridPointerDown);
        });
    });

    describe('createSelectMoveMocks', () => {
        it('should return an object with selection state and handlers', () => {
            const mocks = createSelectMoveMocks();

            expect(mocks).toHaveProperty('selectionRect');
            expect(mocks).toHaveProperty('selectedWalls');
            expect(mocks).toHaveProperty('selectedItems');
            expect(mocks).toHaveProperty('moveOffset');
            expect(mocks).toHaveProperty('selectedWallsRef');
            expect(mocks).toHaveProperty('selectedItemsRef');
            expect(mocks).toHaveProperty('selectStart');
            expect(mocks).toHaveProperty('moveStartGrid');
            expect(mocks).toHaveProperty('moveOffsetRef');
            expect(mocks).toHaveProperty('selectionRectRef');
            expect(mocks).toHaveProperty('selectionBoundsRef');
            expect(mocks).toHaveProperty('placedItemsRef');
            expect(mocks).toHaveProperty('mapDataRef');
            expect(mocks).toHaveProperty('handleSelectPointerDown');
            expect(mocks).toHaveProperty('handleSelectPointerMove');
            expect(mocks).toHaveProperty('handleSelectPointerUp');
        });

        it('should initialize selectionRect and moveOffset to null', () => {
            const { selectionRect, moveOffset } = createSelectMoveMocks();

            expect(selectionRect).toBeNull();
            expect(moveOffset).toBeNull();
        });

        it('should initialize selectedWalls and selectedItems as empty Sets', () => {
            const { selectedWalls, selectedItems } = createSelectMoveMocks();

            expect(selectedWalls).toBeInstanceOf(Set);
            expect(selectedItems).toBeInstanceOf(Set);
            expect(selectedWalls.size).toBe(0);
            expect(selectedItems.size).toBe(0);
        });

        it('should initialize refs with correct initial values', () => {
            const { selectedWallsRef, selectedItemsRef, selectStart, moveStartGrid, moveOffsetRef, selectionRectRef, selectionBoundsRef, placedItemsRef, mapDataRef } = createSelectMoveMocks();

            expect(selectedWallsRef.current).toBeInstanceOf(Set);
            expect(selectedItemsRef.current).toBeInstanceOf(Set);
            expect(selectStart.current).toBeNull();
            expect(moveStartGrid.current).toBeNull();
            expect(moveOffsetRef.current).toBeNull();
            expect(selectionRectRef.current).toBeNull();
            expect(selectionBoundsRef.current).toBeNull();
            expect(placedItemsRef.current).toEqual([]);
            expect(mapDataRef.current).toBeNull();
        });

        it('should create independent Set instances for selectedWalls and selectedWallsRef', () => {
            const { selectedWalls, selectedWallsRef } = createSelectMoveMocks();

            selectedWalls.add('wall1');
            expect(selectedWallsRef.current.has('wall1')).toBe(false);
        });

        it('should create mock functions that track calls', () => {
            const { handleSelectPointerDown, handleSelectPointerMove, handleSelectPointerUp } = createSelectMoveMocks();

            handleSelectPointerDown({ x: 10, y: 20 });
            handleSelectPointerMove({ x: 30, y: 40 });
            handleSelectPointerUp({ x: 50, y: 60 });

            expect(handleSelectPointerDown).toHaveBeenCalledTimes(1);
            expect(handleSelectPointerDown).toHaveBeenCalledWith({ x: 10, y: 20 });
            expect(handleSelectPointerMove).toHaveBeenCalledTimes(1);
            expect(handleSelectPointerUp).toHaveBeenCalledTimes(1);
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createSelectMoveMocks();
            const mocksB = createSelectMoveMocks();

            expect(mocksA.handleSelectPointerDown).not.toBe(mocksB.handleSelectPointerDown);
            expect(mocksA.selectedWalls).not.toBe(mocksB.selectedWalls);
        });
    });

    describe('createRulerMocks', () => {
        it('should return an object with ruler state and handlers', () => {
            const mocks = createRulerMocks();

            expect(mocks).toHaveProperty('rulerMode');
            expect(mocks).toHaveProperty('setRulerMode');
            expect(mocks).toHaveProperty('rulerStart');
            expect(mocks).toHaveProperty('rulerEnd');
            expect(mocks).toHaveProperty('rulerPreview');
            expect(mocks).toHaveProperty('resetRuler');
            expect(mocks).toHaveProperty('handleRulerPointerDown');
            expect(mocks).toHaveProperty('handleRulerPointerMove');
            expect(mocks).toHaveProperty('handleRulerPointerUp');
        });

        it('should initialize rulerMode to false and positions to null', () => {
            const { rulerMode, rulerStart, rulerEnd, rulerPreview } = createRulerMocks();

            expect(rulerMode).toBe(false);
            expect(rulerStart).toBeNull();
            expect(rulerEnd).toBeNull();
            expect(rulerPreview).toBeNull();
        });

        it('should create mock functions that track calls', () => {
            const { setRulerMode, resetRuler, handleRulerPointerDown } = createRulerMocks();

            setRulerMode('distance');
            resetRuler();
            handleRulerPointerDown({ gridX: 1, gridY: 1 });

            expect(setRulerMode).toHaveBeenCalledWith('distance');
            expect(resetRuler).toHaveBeenCalledTimes(1);
            expect(handleRulerPointerDown).toHaveBeenCalledWith({ gridX: 1, gridY: 1 });
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createRulerMocks();
            const mocksB = createRulerMocks();

            expect(mocksA.setRulerMode).not.toBe(mocksB.setRulerMode);
        });
    });

    describe('createSpellOverlayMocks', () => {
        it('should return an object with overlay state and handlers', () => {
            const mocks = createSpellOverlayMocks();

            expect(mocks).toHaveProperty('overlays');
            expect(mocks).toHaveProperty('addOverlay');
            expect(mocks).toHaveProperty('updateOverlay');
            expect(mocks).toHaveProperty('updateOverlayImmediate');
            expect(mocks).toHaveProperty('removeOverlay');
            expect(mocks).toHaveProperty('clearOverlays');
            expect(mocks).toHaveProperty('handleSSEEvent');
        });

        it('should initialize overlays as empty array', () => {
            const { overlays } = createSpellOverlayMocks();
            expect(overlays).toEqual([]);
        });

        it('should create mock functions that track calls', () => {
            const { addOverlay, updateOverlay, updateOverlayImmediate, removeOverlay, clearOverlays, handleSSEEvent } = createSpellOverlayMocks();

            addOverlay({ id: 'o1', shape: 'circle' });
            updateOverlay('o1', { radius: 10 });
            updateOverlayImmediate('o1', { radius: 15 });
            removeOverlay('o1');
            clearOverlays();
            handleSSEEvent({ type: 'spell', data: {} });

            expect(addOverlay).toHaveBeenCalledWith({ id: 'o1', shape: 'circle' });
            expect(updateOverlay).toHaveBeenCalledWith('o1', { radius: 10 });
            expect(updateOverlayImmediate).toHaveBeenCalledWith('o1', { radius: 15 });
            expect(removeOverlay).toHaveBeenCalledWith('o1');
            expect(clearOverlays).toHaveBeenCalledTimes(1);
            expect(handleSSEEvent).toHaveBeenCalledWith({ type: 'spell', data: {} });
        });

        it('should create distinct mock functions for updateOverlay and updateOverlayImmediate', () => {
            const { updateOverlay, updateOverlayImmediate } = createSpellOverlayMocks();

            expect(updateOverlay).not.toBe(updateOverlayImmediate);
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createSpellOverlayMocks();
            const mocksB = createSpellOverlayMocks();

            expect(mocksA.addOverlay).not.toBe(mocksB.addOverlay);
            expect(mocksA.overlays).not.toBe(mocksB.overlays);
        });
    });

    describe('createSpellHandlersMocks', () => {
        it('should return an object with spell handler state and handlers', () => {
            const mocks = createSpellHandlersMocks();

            expect(mocks).toHaveProperty('spellDraft');
            expect(mocks).toHaveProperty('dragOverlay');
            expect(mocks).toHaveProperty('rotateOverlay');
            expect(mocks).toHaveProperty('spellDragActiveRef');
            expect(mocks).toHaveProperty('handleSpellPointerDown');
            expect(mocks).toHaveProperty('handleSpellPointerMove');
            expect(mocks).toHaveProperty('handleSpellPointerUp');
            expect(mocks).toHaveProperty('handleSpellDragMove');
            expect(mocks).toHaveProperty('handleSpellDragEnd');
        });

        it('should initialize spellDraft, dragOverlay, rotateOverlay to null', () => {
            const { spellDraft, dragOverlay, rotateOverlay } = createSpellHandlersMocks();

            expect(spellDraft).toBeNull();
            expect(dragOverlay).toBeNull();
            expect(rotateOverlay).toBeNull();
        });

        it('should initialize spellDragActiveRef with current: false', () => {
            const { spellDragActiveRef } = createSpellHandlersMocks();
            expect(spellDragActiveRef.current).toBe(false);
        });

        it('should create mock functions that track calls', () => {
            const { handleSpellPointerDown, handleSpellDragMove, handleSpellDragEnd } = createSpellHandlersMocks();

            handleSpellPointerDown({ gridX: 3, gridY: 3 });
            handleSpellDragMove({ gridX: 5, gridY: 5 });
            handleSpellDragEnd();

            expect(handleSpellPointerDown).toHaveBeenCalledWith({ gridX: 3, gridY: 3 });
            expect(handleSpellDragMove).toHaveBeenCalledWith({ gridX: 5, gridY: 5 });
            expect(handleSpellDragEnd).toHaveBeenCalledTimes(1);
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createSpellHandlersMocks();
            const mocksB = createSpellHandlersMocks();

            expect(mocksA.handleSpellPointerDown).not.toBe(mocksB.handleSpellPointerDown);
        });
    });

    describe('createPlayerDraggingMocks', () => {
        it('should return an object with dragging state and handlers', () => {
            const mocks = createPlayerDraggingMocks();

            expect(mocks).toHaveProperty('dragging');
            expect(mocks).toHaveProperty('handlePointerDown');
            expect(mocks).toHaveProperty('handlePointerMove');
            expect(mocks).toHaveProperty('handlePointerUp');
        });

        it('should initialize dragging to null', () => {
            const { dragging } = createPlayerDraggingMocks();
            expect(dragging).toBeNull();
        });

        it('should create mock functions that track calls', () => {
            const { handlePointerDown, handlePointerMove, handlePointerUp } = createPlayerDraggingMocks();

            handlePointerDown({ player: 'p1' });
            handlePointerMove({ x: 10 });
            handlePointerUp();

            expect(handlePointerDown).toHaveBeenCalledWith({ player: 'p1' });
            expect(handlePointerMove).toHaveBeenCalledWith({ x: 10 });
            expect(handlePointerUp).toHaveBeenCalledTimes(1);
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createPlayerDraggingMocks();
            const mocksB = createPlayerDraggingMocks();

            expect(mocksA.handlePointerDown).not.toBe(mocksB.handlePointerDown);
        });
    });

    describe('createItemDraggingMocks', () => {
        it('should return an object with itemDragging state and handlers', () => {
            const mocks = createItemDraggingMocks();

            expect(mocks).toHaveProperty('itemDragging');
            expect(mocks).toHaveProperty('handleItemPointerDown');
            expect(mocks).toHaveProperty('handleItemPointerMove');
            expect(mocks).toHaveProperty('handleItemPointerUp');
            expect(mocks).toHaveProperty('handleItemPointerLeave');
        });

        it('should initialize itemDragging to null', () => {
            const { itemDragging } = createItemDraggingMocks();
            expect(itemDragging).toBeNull();
        });

        it('should create mock functions that track calls', () => {
            const { handleItemPointerDown, handleItemPointerLeave } = createItemDraggingMocks();

            handleItemPointerDown({ item: 'i1' });
            handleItemPointerLeave();

            expect(handleItemPointerDown).toHaveBeenCalledWith({ item: 'i1' });
            expect(handleItemPointerLeave).toHaveBeenCalledTimes(1);
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createItemDraggingMocks();
            const mocksB = createItemDraggingMocks();

            expect(mocksA.handleItemPointerDown).not.toBe(mocksB.handleItemPointerDown);
        });
    });

    describe('createNpcImageCacheMocks', () => {
        it('should return an object with npcImages and setNpcImages', () => {
            const mocks = createNpcImageCacheMocks();

            expect(mocks).toHaveProperty('npcImages');
            expect(mocks).toHaveProperty('setNpcImages');
        });

        it('should initialize npcImages as empty object', () => {
            const { npcImages } = createNpcImageCacheMocks();
            expect(npcImages).toEqual({});
        });

        it('should create a mock function that tracks calls', () => {
            const { setNpcImages } = createNpcImageCacheMocks();

            setNpcImages({ npc1: 'url1' });
            expect(setNpcImages).toHaveBeenCalledWith({ npc1: 'url1' });
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createNpcImageCacheMocks();
            const mocksB = createNpcImageCacheMocks();

            expect(mocksA.setNpcImages).not.toBe(mocksB.setNpcImages);
        });
    });

    describe('createSSESyncMocks', () => {
        it('should return an object with handleSSEEvent', () => {
            const mocks = createSSESyncMocks();

            expect(mocks).toHaveProperty('handleSSEEvent');
        });

        it('should create a mock function that tracks calls', () => {
            const { handleSSEEvent } = createSSESyncMocks();

            handleSSEEvent({ type: 'combat', data: {} });
            expect(handleSSEEvent).toHaveBeenCalledWith({ type: 'combat', data: {} });
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createSSESyncMocks();
            const mocksB = createSSESyncMocks();

            expect(mocksA.handleSSEEvent).not.toBe(mocksB.handleSSEEvent);
        });
    });

    describe('createMapDropsMocks', () => {
        it('should return an object with handleDrop', () => {
            const mocks = createMapDropsMocks();

            expect(mocks).toHaveProperty('handleDrop');
        });

        it('should create a mock function that tracks calls', () => {
            const { handleDrop } = createMapDropsMocks();

            handleDrop({ files: ['test.png'] });
            expect(handleDrop).toHaveBeenCalledWith({ files: ['test.png'] });
        });

        it('should return independent mock objects on each call', () => {
            const mocksA = createMapDropsMocks();
            const mocksB = createMapDropsMocks();

            expect(mocksA.handleDrop).not.toBe(mocksB.handleDrop);
        });
    });

    describe('setupMapMocks', () => {
        it('should set up MockEventSource on globalThis with close method', () => {
            setupMapMocks();

            expect(typeof globalThis.EventSource).toBe('function');

            const mockES = new globalThis.EventSource();
            expect(mockES).toHaveProperty('onmessage');
            expect(mockES).toHaveProperty('onerror');
            expect(typeof mockES.close).toBe('function');
            expect(() => mockES.close()).not.toThrow();
        });

        it('should allow mocking modules that can be imported and called', async () => {
            setupMapMocks();

            const { loadMonsters } = await import('../../services/ui/dataLoader.js');
            const monsters = await loadMonsters();
            expect(monsters).toEqual([]);
        });

        it('should allow mocking mapsService functions that can be called', async () => {
            setupMapMocks();

            const { loadMapData, saveMapData, formatMapName, loadMaps } = await import('../../services/maps/mapsService.js');

            const mapData = await loadMapData('test');
            expect(mapData).toBeNull();

            await saveMapData('test', {});
            expect(formatMapName('Test Map')).toBe('Test Map');

            const maps = await loadMaps();
            expect(maps).toEqual({ maps: [] });
        });

        it('should allow mocking logService functions that can be called', async () => {
            setupMapMocks();

            const { getLog, addEntry } = await import('../../services/ui/logService.js');

            const entries = await getLog();
            expect(entries).toEqual([]);

            await addEntry('test', {});
        });

        it('should allow mocking hooks that return expected defaults', async () => {
            setupMapMocks();

            const useLog = await import('../../hooks/runtime/useLog.js');
            const logResult = useLog.default();
            expect(logResult.logEntries).toEqual([]);
            expect(logResult.initialized).toBe(true);
            expect(typeof logResult.addEntry).toBe('function');

            const useMapLoader = (await import('./hooks/useMapLoader.js')).default;
            const mapLoaderResult = useMapLoader();
            expect(mapLoaderResult).toHaveProperty('mapData');
            expect(mapLoaderResult).toHaveProperty('placedItems');

            const useZoomPan = (await import('./hooks/useZoomPan.js')).default;
            const zoomPanResult = useZoomPan();
            expect(zoomPanResult.zoom).toBe(1);
            expect(zoomPanResult.panning).toBe(false);

            const useWallDrawing = (await import('./hooks/useWallDrawing.js')).default;
            const wallDrawingResult = useWallDrawing();
            expect(wallDrawingResult.painting).toBe(false);

            const useSelectMove = (await import('./hooks/useSelectMove.js')).default;
            const selectMoveResult = useSelectMove();
            expect(selectMoveResult.selectionRect).toBeNull();
            expect(selectMoveResult.selectedWalls.size).toBe(0);

            const useRuler = (await import('./hooks/useRuler.js')).default;
            const rulerResult = useRuler();
            expect(rulerResult.rulerMode).toBe(false);

            const useSpellOverlay = (await import('./hooks/useSpellOverlay.js')).default;
            const spellOverlayResult = useSpellOverlay();
            expect(spellOverlayResult.overlays).toEqual([]);

            const useSpellHandlers = (await import('./hooks/useSpellHandlers.js')).default;
            const spellHandlersResult = useSpellHandlers();
            expect(spellHandlersResult.spellDraft).toBeNull();

            const usePlayerDragging = (await import('./hooks/usePlayerDragging.js')).default;
            const playerDraggingResult = usePlayerDragging();
            expect(playerDraggingResult.dragging).toBeNull();

            const useItemDragging = (await import('./hooks/useItemDragging.js')).default;
            const itemDraggingResult = useItemDragging();
            expect(itemDraggingResult.itemDragging).toBeNull();

            const useNpcImageCache = (await import('./hooks/useNpcImageCache.js')).default;
            const npcImageCacheResult = useNpcImageCache();
            expect(npcImageCacheResult.npcImages).toEqual({});

            const useSSESync = (await import('./hooks/useSSESync.js')).default;
            const sseSyncResult = useSSESync();
            expect(sseSyncResult).toHaveProperty('handleSSEEvent');

            const fogModule = await import('./hooks/useFogOfWar.js');
            const fogResult = fogModule.default();
            expect(fogResult).toHaveProperty('fog');
            expect(fogResult).toHaveProperty('visible');
            expect(fogResult.fog).toBeInstanceOf(Set);
            expect(fogResult.visible).toBeInstanceOf(Set);

            const useMapDrops = (await import('./hooks/useMapDrops.js')).default;
            const mapDropsResult = useMapDrops();
            expect(mapDropsResult).toHaveProperty('handleDrop');
        });
    });
});
