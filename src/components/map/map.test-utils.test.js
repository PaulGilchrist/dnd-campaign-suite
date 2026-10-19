// @maintained-by-ai
// Smoke tests for the only real logic in map.test-utils.js:
//   - grid-center arithmetic               map.test-utils.js:3-4
//   - default fixture + override spread   map.test-utils.js:6-31
//   - independent Set instances           map.test-utils.js:43-47
//   - setupMapMocks isolation + override threading  map.test-utils.js:123-201
// All other createXMocks factories (:33-120) are pure vi.fn()/literal passthrough
// stubs — vi.fn() call-recording and per-call object identity are vitest semantics,
// not helper behavior. Real hook behavior canonical owners:
//   useMapLoader #907 · useZoomPan #917 · useWallDrawing #916 · useSelectMove #910 ·
//   useRuler · useSpellOverlay #913 · useSpellHandlers #914 · usePlayerDragging #905 ·
//   useItemDragging · useNpcImageCache · useSSESync #915 · useFogOfWar #904 ·
//   useMapDrops #906 (all in ./hooks/*.test.js)
import { describe, it, expect, vi } from 'vitest';
import {
    mockGridCenterX,
    mockGridCenterY,
    createDefaultMocks,
    createZoomPanMocks,
    createSelectMoveMocks,
    setupMapMocks,
} from './map.test-utils.js';

describe('mapTestUtils', () => {
    it('converts grid coordinates to pixel centers with g * 40 + 20', () => {
        expect(mockGridCenterX(0)).toBe(20);
        expect(mockGridCenterX(1)).toBe(60);
        expect(mockGridCenterX(5)).toBe(220);
        expect(mockGridCenterX(-1)).toBe(-20);
        expect(mockGridCenterY(0)).toBe(20);
        expect(mockGridCenterY(2)).toBe(100);
        expect(mockGridCenterY(-5)).toBe(-180);
    });

    it('createDefaultMocks builds default fixture and replaces only overridden keys', () => {
        const mocks = createDefaultMocks();
        expect(mocks.mapData).toEqual({ players: [], walls: new Set() });
        expect(mocks.placedItems).toEqual([]);
        expect(typeof mocks.setMapData).toBe('function');
        expect(typeof mocks.setPlacedItems).toBe('function');

        const customFn = vi.fn();
        const overridden = createDefaultMocks({
            mapData: { players: [{ name: 'Test' }], walls: new Set(['1,1-2,2']) },
            setMapData: customFn,
        });
        expect(overridden.mapData.players).toEqual([{ name: 'Test' }]);
        expect(overridden.mapData.walls.has('1,1-2,2')).toBe(true);
        expect(overridden.setMapData).toBe(customFn);
        // non-overridden keys keep defaults
        expect(overridden.placedItems).toEqual([]);
        expect(overridden.setPlacedItems).not.toBe(customFn);
    });

    it('createZoomPanMocks supplies fixed grid lookup default and applies overrides', () => {
        const mocks = createZoomPanMocks();
        expect(mocks.zoom).toBe(1);
        expect(mocks.panX).toBe(0);
        expect(mocks.panY).toBe(0);
        expect(mocks.panning).toBe(false);
        expect(mocks.getGridFromEvent()).toEqual({ gridX: 5, gridY: 5 });

        const customFn = vi.fn(() => ({ gridX: 10, gridY: 10 }));
        const overridden = createZoomPanMocks({ zoom: 2, getGridFromEvent: customFn });
        expect(overridden.zoom).toBe(2);
        expect(overridden.panX).toBe(0);
        expect(overridden.getGridFromEvent()).toEqual({ gridX: 10, gridY: 10 });
    });

    it('createSelectMoveMocks gives walls selection and its ref independent Sets', () => {
        const mocks = createSelectMoveMocks();
        expect(mocks.selectionRect).toBeNull();
        expect(mocks.moveOffset).toBeNull();
        expect(mocks.mapDataRef.current).toBeNull();

        mocks.selectedWalls.add('wall1');
        expect(mocks.selectedWallsRef.current.has('wall1')).toBe(false);
        mocks.selectedWallsRef.current.add('wall2');
        expect(mocks.selectedWalls.has('wall2')).toBe(false);
    });

    describe('setupMapMocks', () => {
        it('installs a closable EventSource stub, service stubs, and threads overrides into hook mocks', async () => {
            setupMapMocks({
                mapLoader: { mapData: { players: [{ name: 'A' }], walls: new Set(['1,1-2,2']) } },
                zoomPan: { zoom: 3 },
            });

            // No real network EventSource survives setup
            expect(typeof globalThis.EventSource).toBe('function');
            const mockES = new globalThis.EventSource();
            expect(() => mockES.close()).not.toThrow();

            const { loadMapData, saveMapData, formatMapName, loadMaps } = await import('../../services/maps/mapsService.js');
            expect(await loadMapData('test')).toBeNull();
            await saveMapData('test', {});
            expect(formatMapName('Test Map')).toBe('Test Map');
            expect(await loadMaps()).toEqual({ maps: [] });

            const { loadMonsters } = await import('../../services/ui/dataLoader.js');
            expect(await loadMonsters()).toEqual([]);

            // overrides threaded through the hook mock factories (:152, :156)
            const useMapLoader = (await import('./hooks/useMapLoader.js')).default;
            expect(useMapLoader().mapData.players).toEqual([{ name: 'A' }]);
            expect(useMapLoader().mapData.walls.has('1,1-2,2')).toBe(true);

            const useZoomPan = (await import('./hooks/useZoomPan.js')).default;
            expect(useZoomPan().zoom).toBe(3);
        });
    });
});
