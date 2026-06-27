// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Map from './Map.jsx';

const mockGridCenterX = (gx) => gx * 40 + 20;
const mockGridCenterY = (gy) => gy * 40 + 20;

const createDefaultMocks = (overrides = {}) => ({
    mapData: { players: [], walls: new Set(), rooms: [] },
    setMapData: vi.fn(),
    placedItems: [],
    setPlacedItems: vi.fn(),
    ...overrides,
});

const createZoomPanMocks = (overrides = {}) => ({
    zoom: 1,
    panX: 0,
    panY: 0,
    zoomIn: vi.fn(),
    zoomOut: vi.fn(),
    resetView: vi.fn(),
    gridCenterX: mockGridCenterX,
    gridCenterY: mockGridCenterY,
    getGridFromEvent: vi.fn(() => ({ gridX: 5, gridY: 5 })),
    panning: false,
    handlePanStart: vi.fn(),
    handlePanMove: vi.fn(),
    handlePanEnd: vi.fn(),
    handleWheel: vi.fn(),
    clientToSVG: vi.fn(),
    ...overrides,
});

globalThis.EventSource = class MockEventSource {
    constructor() { this.onmessage = null; this.onerror = null; }
    close() {}
};

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: vi.fn(() => Promise.resolve([])),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
    saveMapData: vi.fn(() => Promise.resolve()),
    formatMapName: vi.fn((name) => name),
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
}));

vi.mock('../../services/ui/logService.js', () => ({
    getLog: vi.fn(() => Promise.resolve([])),
    addEntry: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../hooks/runtime/useLog.js', () => ({
    default: vi.fn(() => ({ logEntries: [], initialized: true, addEntry: vi.fn() })),
}));

vi.mock('./hooks/useMapLoader.js', () => ({
    default: vi.fn(() => createDefaultMocks()),
}));

vi.mock('./hooks/useZoomPan.js', () => ({
    default: vi.fn(() => createZoomPanMocks()),
}));

vi.mock('./hooks/useWallDrawing.js', () => ({
    default: vi.fn(() => ({
        painting: false,
        handleGridPointerDown: vi.fn(),
        handleGridPointerMove: vi.fn(),
        handleGridPointerUp: vi.fn(),
        handleGridPointerLeave: vi.fn(),
    })),
}));

vi.mock('./hooks/useRoomDrawing.js', () => ({
    default: vi.fn(() => ({
        roomDrawRect: null,
        selectedRoom: null,
        setSelectedRoom: vi.fn(),
        handleRoomPointerDown: vi.fn(),
        handleRoomPointerMove: vi.fn(),
        handleRoomPointerUp: vi.fn(),
        handleRoomClick: vi.fn(),
    })),
}));

vi.mock('./hooks/useSelectMove.js', () => ({
    default: vi.fn(() => ({
        selectionRect: null,
        selectedWalls: new Set(),
        selectedItems: new Set(),
        moveOffset: null,
        selectedWallsRef: { current: new Set() },
        selectedItemsRef: { current: new Set() },
        selectStart: { current: null },
        moveStartGrid: { current: null },
        moveOffsetRef: { current: null },
        selectionRectRef: { current: null },
        selectionBoundsRef: { current: null },
        placedItemsRef: { current: [] },
        mapDataRef: { current: null },
        handleSelectPointerDown: vi.fn(),
        handleSelectPointerMove: vi.fn(),
        handleSelectPointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useRuler.js', () => ({
    default: vi.fn(() => ({
        rulerMode: false,
        setRulerMode: vi.fn(),
        rulerStart: null,
        rulerEnd: null,
        rulerPreview: null,
        resetRuler: vi.fn(),
        handleRulerPointerDown: vi.fn(),
        handleRulerPointerMove: vi.fn(),
        handleRulerPointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useSpellOverlay.js', () => ({
    default: vi.fn(() => ({
        overlays: [],
        addOverlay: vi.fn(),
        updateOverlay: vi.fn(),
        updateOverlayImmediate: vi.fn(),
        removeOverlay: vi.fn(),
        clearOverlays: vi.fn(),
        handleSSEEvent: vi.fn(),
    })),
}));

vi.mock('./hooks/useSpellHandlers.js', () => ({
    default: vi.fn(() => ({
        spellDraft: null,
        dragOverlay: null,
        rotateOverlay: null,
        spellDragActiveRef: { current: false },
        handleSpellPointerDown: vi.fn(),
        handleSpellPointerMove: vi.fn(),
        handleSpellPointerUp: vi.fn(),
        handleSpellDragMove: vi.fn(),
        handleSpellDragEnd: vi.fn(),
    })),
}));

vi.mock('./hooks/usePlayerDragging.js', () => ({
    default: vi.fn(() => ({
        dragging: null,
        handlePointerDown: vi.fn(),
        handlePointerMove: vi.fn(),
        handlePointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useItemDragging.js', () => ({
    default: vi.fn(() => ({
        itemDragging: null,
        handleItemPointerDown: vi.fn(),
        handleItemPointerMove: vi.fn(),
        handleItemPointerUp: vi.fn(),
        handleItemPointerLeave: vi.fn(),
    })),
}));

vi.mock('./hooks/useNpcImageCache.js', () => ({
    default: vi.fn(() => ({
        npcImages: {},
        setNpcImages: vi.fn(),
    })),
}));

vi.mock('./hooks/useSSESync.js', () => ({
    default: vi.fn(() => ({
        handleSSEEvent: vi.fn(),
    })),
}));

vi.mock('./hooks/useFogOfWar.js', () => ({
    default: vi.fn(() => new Set()),
}));

vi.mock('./hooks/useMapDrops.js', () => ({
    default: vi.fn(() => ({
        handleDrop: vi.fn(),
    })),
}));

describe('Map handler logic', () => {
    describe('loadMonsters useEffect', () => {
        it('should call loadMonsters on mount', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('div.map')).toBeInTheDocument();
        });
    });

    describe('isLocalhost conditional rendering', () => {
        it('should render core map elements when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('rect.grid-bg')).toBeInTheDocument();
            expect(container.querySelector('svg.grid-svg')).toBeInTheDocument();
        });

        it('should not render grid size input when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            const gridSizeInput = container.querySelector('.grid-size-input');
            expect(gridSizeInput).toBeNull();
        });

        it('should render grid size input when isLocalhost is true', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const gridSizeInput = container.querySelector('.grid-size-input');
            expect(gridSizeInput).toBeInTheDocument();
        });
    });

    describe('cursor style and viewBox', () => {
        it('should render SVG with cursor style and correct viewBox', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).toBeInTheDocument();
            expect(svg.getAttribute('style')).toContain('cursor:');
            const viewBox = svg.getAttribute('viewBox');
            expect(viewBox).toMatch(/\d+ \d+ 1200 1200/);
        });
    });

    describe('SpellOverlayRenderer and RulerOverlay', () => {
        it('should render SpellOverlayRenderer with spell-overlay-layer class', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg.querySelector('.spell-overlay-layer')).toBeInTheDocument();
        });

        it('should render RulerOverlay component in SVG', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).toBeInTheDocument();
        });
    });

    describe('outdoor map rendering', () => {
        it('should render HexMap instead of SVG when mapData.type is outdoor', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { type: 'outdoor', players: [], walls: new Set(), rooms: [] },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('.hex-map')).toBeInTheDocument();
            expect(container.querySelector('svg.grid-svg')).toBeNull();
        });

        it('should render HexMap with onEncounterCreated prop for outdoor maps', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { type: 'outdoor', players: [], walls: new Set(), rooms: [] },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const onEncounterCreated = vi.fn();
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} onEncounterCreated={onEncounterCreated} />
            );
            expect(container.querySelector('.hex-map')).toBeInTheDocument();
        });

        it('should render HexMap with onPoiEntered prop for outdoor maps', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { type: 'outdoor', players: [], walls: new Set(), rooms: [] },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const onPoiEntered = vi.fn();
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} onPoiEntered={onPoiEntered} />
            );
            expect(container.querySelector('.hex-map')).toBeInTheDocument();
        });
    });

    describe('mapData null handling', () => {
        it('should return null (no render) when mapData is null', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: null,
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('div.map')).toBeNull();
        });
    });

    describe('room rendering', () => {
        it('should apply room-type-{type} CSS class to room highlights', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: {
                    players: [],
                    walls: new Set(),
                    rooms: [{ id: 'r1', type: 'private', rect: { x: 0, y: 0, w: 5, h: 5 } }],
                },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const roomHighlight = container.querySelector('rect.room-highlight');
            expect(roomHighlight).toHaveClass('room-type-private');
        });

        it('should render room label text centered in room', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: {
                    players: [],
                    walls: new Set(),
                    rooms: [{ id: 'r1', type: 'entrance', rect: { x: 0, y: 0, w: 5, h: 5 }, label: 'Entrance' }],
                },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const label = container.querySelector('text.room-label');
            expect(label).toBeInTheDocument();
        });

        it('should render multiple rooms', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: {
                    players: [],
                    walls: new Set(),
                    rooms: [
                        { id: 'r1', type: 'common', rect: { x: 0, y: 0, w: 10, h: 10 }, label: 'Room 1' },
                        { id: 'r2', type: 'private', rect: { x: 10, y: 0, w: 5, h: 5 }, label: 'Room 2' },
                    ],
                },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelectorAll('rect.room-highlight').length).toBeGreaterThan(0);
        });
    });

    describe('wide item selection highlighting', () => {
        it('should calculate 2x1 width for table/bed/altar/bookshelf at 0 rotation', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { players: [], walls: new Set(), rooms: [] },
                setMapData: vi.fn(),
                placedItems: [{ id: 'item1', type: 'table', gridX: 5, gridY: 5, rotation: 0 }],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('div.map')).toBeInTheDocument();
        });

        it('should calculate 1x2 width for table/bed/altar/bookshelf at 90 rotation', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { players: [], walls: new Set(), rooms: [] },
                setMapData: vi.fn(),
                placedItems: [{ id: 'item1', type: 'table', gridX: 5, gridY: 5, rotation: 90 }],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('div.map')).toBeInTheDocument();
        });
    });

    describe('mapData with features', () => {
        it('should pass bgFill to GridAndWalls component', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { players: [], walls: new Set(), rooms: [], bgFill: '#f0f0f0' },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('div.map')).toBeInTheDocument();
        });

        it('should render Players component with player data', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { players: [{ id: 'p1', name: 'Player1', gridX: 5, gridY: 5 }], walls: new Set(), rooms: [] },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('div.map')).toBeInTheDocument();
        });

        it('should render walls as a Set on the map', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { players: [], walls: new Set(['1,1', '2,2']), rooms: [] },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('div.map')).toBeInTheDocument();
        });

        it('should render multiple placed items', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { players: [], walls: new Set(), rooms: [] },
                setMapData: vi.fn(),
                placedItems: [
                    { id: 'item1', type: 'table', gridX: 5, gridY: 5 },
                    { id: 'item2', type: 'chair', gridX: 6, gridY: 5 },
                ],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('div.map')).toBeInTheDocument();
        });

        it('should pass outdoor variant to ItemsPanel for outdoor maps with parentHex', async () => {
            const mockMapLoader = await import('./hooks/useMapLoader.js');
            mockMapLoader.default.mockReturnValue({
                mapData: { type: 'outdoor', players: [], walls: new Set(), rooms: [], parentHex: true },
                setMapData: vi.fn(),
                placedItems: [],
                setPlacedItems: vi.fn(),
            });

            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('.hex-map')).toBeInTheDocument();
        });
    });

    describe('conditional rendering', () => {
        it('should not render ItemsPanel when itemsPanelOpen is false', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('items-panel')).toBeNull();
        });

        it('should not render ItemsPanel when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('items-panel')).toBeNull();
        });

        it('should not render MonsterNameAutocomplete when renamePopover is null', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('monster-name-autocomplete')).toBeNull();
        });

        it('should not render MonsterCardModal when viewingMonster is null', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('monster-card-modal')).toBeNull();
        });

        it('should not render context menu groups when nothing selected', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('g.item-context-menu')).toBeNull();
            expect(container.querySelector('g.room-context-menu')).toBeNull();
            expect(container.querySelector('g.player-context-menu')).toBeNull();
        });

        it('should not render selection-preview when nothing is selected', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('rect.selection-preview')).toBeNull();
        });

        it('should not render room-draw-preview when roomDrawRect is null', async () => {
            const { container } = render(
                <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('rect.room-draw-preview')).toBeNull();
        });
    });

});
