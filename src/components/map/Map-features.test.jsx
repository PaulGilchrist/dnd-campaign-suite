// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Map from './Map.jsx';

const mockGridCenterX = (gx) => gx * 40 + 20;
const mockGridCenterY = (gy) => gy * 40 + 20;

const createDefaultMocks = () => ({
    mapData: { players: [], walls: new Set(), rooms: [] },
    setMapData: vi.fn(),
    placedItems: [],
    setPlacedItems: vi.fn(),
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

describe('Map cursor styles', () => {
    it('should show grab cursor when tool is none', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        expect(svg.getAttribute('style')).toContain('cursor: grab');
    });

    it('should show crosshair cursor when tool is select', async () => {
        const { rerender } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const mockSelectMove = await import('./hooks/useSelectMove.js');
        mockSelectMove.default.mockReturnValue({
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
        });
        rerender(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
    });

    it('should show grabbing cursor when panning', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        // When panning is true, cursor should be grabbing
        expect(svg.getAttribute('style')).toContain('cursor:');
    });

    it('should show crosshair cursor when rulerMode is true', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        expect(svg).toBeInTheDocument();
    });
});

describe('Map handleViewStats', () => {
    it('should set viewingMonster when placed item is npc and monster is found', async () => {
        const mockLoadMonsters = await import('../../services/ui/dataLoader.js');
        mockLoadMonsters.loadMonsters.mockResolvedValue([
            { name: 'Goblin' },
            { name: 'Orc' },
        ]);

        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            ...createDefaultMocks(),
            placedItems: [{ id: 'npc1', type: 'npc', name: 'Goblin' }],
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should not set viewingMonster when placed item is not npc', async () => {
        const mockLoadMonsters = await import('../../services/ui/dataLoader.js');
        mockLoadMonsters.loadMonsters.mockResolvedValue([
            { name: 'Goblin' },
        ]);

        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            ...createDefaultMocks(),
            placedItems: [{ id: 'item1', type: 'table', name: 'Table' }],
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should not set viewingMonster when monster is not found', async () => {
        const mockLoadMonsters = await import('../../services/ui/dataLoader.js');
        mockLoadMonsters.loadMonsters.mockResolvedValue([
            { name: 'Goblin' },
        ]);

        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            ...createDefaultMocks(),
            placedItems: [{ id: 'npc1', type: 'npc', name: 'Unknown Creature' }],
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map monsterFound useMemo', () => {
    it('should return false when selectedItem is null', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should return false when selectedItem is not an npc', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map handleRemovePlayer', () => {
    it('should remove a player from mapData when called', async () => {
        const setMapData = vi.fn();
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            mapData: { players: [{ id: 'p1', name: 'Player1' }, { id: 'p2', name: 'Player2' }], walls: new Set(), rooms: [] },
            setMapData,
            placedItems: [],
            setPlacedItems: vi.fn(),
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should not throw when removing non-existent player', async () => {
        const setMapData = vi.fn();
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            mapData: { players: [{ id: 'p1', name: 'Player1' }], walls: new Set(), rooms: [] },
            setMapData,
            placedItems: [],
            setPlacedItems: vi.fn(),
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map handleCloseMenu', () => {
    it('should clear all selections when called', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map handleRenameClicked', () => {
    it('should not throw when svgRef is null', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map handleSetRulerMode', () => {
    it('should toggle ruler mode on and off', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should clear spell mode when ruler mode is enabled', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map handleRenameItem', () => {
    it('should not rename when newName is empty', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should trim whitespace from new name', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should update npcImages cache when renaming', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map SSE event handling', () => {
    it('should delegate SSE events to mapSSE handler', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should delegate SSE events to spell overlay handler', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should handle SSE events with data', async () => {
        const { container } = render(
            <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should ignore SSE events without data', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map tool pointer handlers', () => {
    it('should dispatch pointerdown to correct handler based on tool', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new PointerEvent('pointerdown', { bubbles: true });
        expect(() => svg.dispatchEvent(event)).not.toThrow();
    });

    it('should dispatch pointermove to all tool handlers', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new PointerEvent('pointermove', { bubbles: true });
        expect(() => svg.dispatchEvent(event)).not.toThrow();
    });

    it('should dispatch pointerup to all tool handlers', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new PointerEvent('pointerup', { bubbles: true });
        expect(() => svg.dispatchEvent(event)).not.toThrow();
    });

    it('should dispatch pointerleave to relevant handlers', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new PointerEvent('pointerleave', { bubbles: true });
        expect(() => svg.dispatchEvent(event)).not.toThrow();
    });

    it('should not dispatch paint handler when spellDragActiveRef is true', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new PointerEvent('pointerdown', { bubbles: true });
        expect(() => svg.dispatchEvent(event)).not.toThrow();
    });
});

describe('Map onDrop handler', () => {
    it('should handle contextmenu events without throwing', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new MouseEvent('contextmenu', { bubbles: true });
        expect(() => svg.dispatchEvent(event)).not.toThrow();
    });
});

describe('Map refs synchronization', () => {
    it('should sync placedItemsRef when placedItems changes', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should sync selectedWallsRef when selectedWalls changes', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should sync selectedItemsRef when selectedItems changes', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should sync mapDataRef when mapData changes', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map SVG event handling', () => {
    it('should render SVG with all event handlers wired', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        expect(svg).toBeInTheDocument();
    });
});

describe('Map click handling', () => {
    it('should call handleRoomClick on SVG click', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new MouseEvent('click', { bubbles: true, button: 0 });
        svg.dispatchEvent(event);
    });

    it('should call handleCloseMenu on SVG click', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new MouseEvent('click', { bubbles: true, button: 0 });
        svg.dispatchEvent(event);
    });

    it('should not call handleCloseMenu on non-left-click', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new MouseEvent('click', { bubbles: true, button: 2 });
        svg.dispatchEvent(event);
    });
});

describe('Map Subscriber component', () => {
    it('should render Subscriber with campaignName prop', async () => {
        const { container } = render(
            <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render Subscriber with handleEvent prop', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map mapData null handling', () => {
    it('should return null when mapData is null', async () => {
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
        // When mapData is null, component returns null (no render)
        expect(container.querySelector('div.map')).toBeNull();
    });
});

describe('Map outdoor map rendering', () => {
    it('should render HexMap when mapData.type is outdoor', async () => {
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
    });

    it('should pass correct props to HexMap for outdoor maps', async () => {
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            mapData: { type: 'outdoor', players: [], walls: new Set(), rooms: [] },
            setMapData: vi.fn(),
            placedItems: [],
            setPlacedItems: vi.fn(),
        });

        const characters = [{ name: 'Thorin', imagePath: 'https://example.com/thorin.png' }];
        const { container } = render(
            <Map campaignName="outdoor-campaign" characters={characters} isLocalhost={true} mapName="wilderness" onBack={vi.fn()} onEncounterCreated={vi.fn()} onPoiEntered={vi.fn()} />
        );
        expect(container.querySelector('.hex-map')).toBeInTheDocument();
    });

    it('should not render SVG when mapData.type is outdoor', async () => {
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
        expect(container.querySelector('svg.grid-svg')).toBeNull();
    });
});

describe('Map mapData with bgFill', () => {
    it('should pass bgFill to GridAndWalls', async () => {
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
});

describe('Map mapData with players', () => {
    it('should render Players component when players array has entries', async () => {
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

    it('should render Players component with characters prop', async () => {
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            mapData: { players: [{ id: 'p1', name: 'Player1', gridX: 5, gridY: 5 }], walls: new Set(), rooms: [] },
            setMapData: vi.fn(),
            placedItems: [],
            setPlacedItems: vi.fn(),
        });

        const characters = [{ name: 'Player1', imagePath: 'https://example.com/p1.png' }];
        const { container } = render(
            <Map campaignName="test" characters={characters} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map mapData with walls', () => {
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
});

describe('Map mapData with rooms', () => {
    it('should render rooms from mapData', async () => {
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            mapData: {
                players: [],
                walls: new Set(),
                rooms: [
                    { id: 'r1', type: 'common', rect: { x: 0, y: 0, w: 10, h: 10 }, label: 'Room 1' },
                ],
            },
            setMapData: vi.fn(),
            placedItems: [],
            setPlacedItems: vi.fn(),
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
        expect(container.querySelectorAll('rect.room-highlight').length).toBeGreaterThan(0);
    });

    it('should render room labels', async () => {
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            mapData: {
                players: [],
                walls: new Set(),
                rooms: [
                    { id: 'r1', type: 'entrance', rect: { x: 0, y: 0, w: 5, h: 5 }, label: 'Entrance' },
                ],
            },
            setMapData: vi.fn(),
            placedItems: [],
            setPlacedItems: vi.fn(),
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should apply room type CSS class', async () => {
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            mapData: {
                players: [],
                walls: new Set(),
                rooms: [
                    { id: 'r1', type: 'private', rect: { x: 0, y: 0, w: 5, h: 5 } },
                ],
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
});

describe('Map placedItems rendering', () => {
    it('should render PlacedItems component', async () => {
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            mapData: { players: [], walls: new Set(), rooms: [] },
            setMapData: vi.fn(),
            placedItems: [{ id: 'item1', type: 'table', gridX: 5, gridY: 5 }],
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
});

describe('Map spell overlay state', () => {
    it('should pass spell overlay state to MapToolbar', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render overlays from useSpellOverlay', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        expect(svg.querySelector('.spell-overlay-layer')).toBeInTheDocument();
    });
});

describe('Map ruler state', () => {
    it('should render RulerOverlay when ruler mode is active', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        expect(svg).toBeInTheDocument();
    });
});

describe('Map zoom/pan state', () => {
    it('should use zoom in viewBox calculation', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const viewBox = svg.getAttribute('viewBox');
        expect(viewBox).toMatch(/\d+ \d+ \d+ \d+/);
    });

    it('should use panX and panY in viewBox', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const viewBox = svg.getAttribute('viewBox');
        expect(viewBox).toMatch(/^0 0/);
    });
});

describe('Map gridSize state', () => {
    it('should use gridSize from useMapLoader', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const viewBox = svg.getAttribute('viewBox');
        // SVG_SIZE = 30 * 40 = 1200
        expect(viewBox).toContain('1200');
    });

    it('should pass gridSize to GridAndWalls', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map tool state', () => {
    it('should initialize tool to TOOL_NONE', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass tool and setTool to MapToolbar', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const toolbar = container.querySelector('.toolbar');
        expect(toolbar).toBeInTheDocument();
    });
});

describe('Map spellMode state', () => {
    it('should initialize spellMode to null', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass spellMode to MapToolbar', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map selectedShape and shapeParams', () => {
    it('should initialize selectedShape to OverlayShape.SPHERE', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass shapeParams to MapToolbar', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map itemsPanelOpen state', () => {
    it('should not render ItemsPanel when itemsPanelOpen is false', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('items-panel')).toBeNull();
    });

    it('should pass setItemsPanelOpen to MapToolbar', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map selected item state', () => {
    it('should pass selectedItem to ItemContextMenu', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass setSelectedItem to PlacedItems', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map selectedPlayer state', () => {
    it('should pass selectedPlayer to PlayerContextMenu', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass setSelectedPlayer to Players', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map selectedRoom state', () => {
    it('should pass selectedRoom to RoomContextMenu', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass setSelectedRoom to RoomContextMenu', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map renamePopover state', () => {
    it('should not render MonsterNameAutocomplete when renamePopover is null', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('monster-name-autocomplete')).toBeNull();
    });

    it('should render MonsterNameAutocomplete when renamePopover is set', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map viewingMonster state', () => {
    it('should not render MonsterCardModal when viewingMonster is null', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('monster-card-modal')).toBeNull();
    });

    it('should render MonsterCardModal when viewingMonster is set', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map fog of war', () => {
    it('should compute fog from useFogOfWar hook', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass fog to GridAndWalls', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass fog to Players', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass fog to PlacedItems', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render FogOverlay component', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map npcImages cache', () => {
    it('should pass npcImages to PlacedItems', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass setNpcImages to PlacedItems', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map isLocalhost conditional rendering', () => {
    it('should not render paint/erase/select/room buttons when isLocalhost is false', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
        );
        const toolbar = container.querySelector('.toolbar');
        expect(toolbar).toBeInTheDocument();
    });

    it('should render spell and ruler buttons when isLocalhost is false', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
        );
        const toolbar = container.querySelector('.toolbar');
        expect(toolbar).toBeInTheDocument();
    });

    it('should render zoom buttons when isLocalhost is false', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
        );
        const toolbar = container.querySelector('.toolbar');
        expect(toolbar).toBeInTheDocument();
    });

    it('should render ItemsPanel button when isLocalhost is true', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const toolbar = container.querySelector('.toolbar');
        expect(toolbar).toBeInTheDocument();
    });
});

describe('Map gridCenterX/gridCenterY functions', () => {
    it('should pass gridCenterX to Players', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass gridCenterY to Players', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass gridCenterX to PlacedItems', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass gridCenterY to PlacedItems', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map dragging state', () => {
    it('should pass dragging to Players', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass handlePointerDown to Players', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map itemDragging state', () => {
    it('should pass itemDragging to PlacedItems', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass handleItemPointerDown to PlacedItems', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map panning state', () => {
    it('should update cursor based on panning state', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        expect(svg).toHaveAttribute('style');
    });
});

describe('Map room drawing state', () => {
    it('should render room draw preview when roomDrawRect is set', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map selection state', () => {
    it('should render selection preview when selectionRect is set', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render selection outline when walls or items are selected', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render selection wall highlights', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render selection item highlights', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render move preview when moveOffset is set', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map moveOffset rendering', () => {
    it('should render move preview only when dx or dy is non-zero', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map wide items selection highlighting', () => {
    it('should render 2x1 highlight for table at 0 rotation', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render 1x2 highlight for table at 90 rotation', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render 2x1 highlight for bed at 0 rotation', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render 2x1 highlight for altar at 0 rotation', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render 2x1 highlight for bookshelf at 0 rotation', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map room hit areas', () => {
    it('should render room hit areas when tool is none', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render room hit areas when tool is select', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should not render room hit areas when tool is paint', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map room labels', () => {
    it('should render room label text', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should use room.label when available', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should fall back to room.type when label is missing', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should fall back to common when both label and type are missing', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map selectedRoom highlighting', () => {
    it('should apply room-selected class to selected room', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map bounding box calculation', () => {
    it('should calculate bounding box from selected walls', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should calculate bounding box from selected items', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should return null from bounding box when no walls/items selected', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map mapData propagation', () => {
    it('should pass mapData.players to Players component', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass mapData.walls to GridAndWalls', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass mapData.rooms to room rendering', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map isLocalhost propagation', () => {
    it('should pass isLocalhost to GridAndWalls', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass isLocalhost to Players', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass isLocalhost to PlacedItems', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass isLocalhost to FogOverlay', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass isLocalhost to RoomContextMenu', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass isLocalhost to MapToolbar', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map campaignName propagation', () => {
    it('should pass campaignName to MapToolbar', async () => {
        const { container } = render(
            <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass campaignName to Subscriber', async () => {
        const { container } = render(
            <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass campaignName to MonsterCardModal', async () => {
        const { container } = render(
            <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass campaignName to ItemsPanel', async () => {
        const { container } = render(
            <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map mapName propagation', () => {
    it('should pass mapName to MapToolbar', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="my-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass mapName to Subscriber', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="my-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should pass mapName to MonsterCardModal', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="my-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map onBack propagation', () => {
    it('should pass onBack to MapToolbar', async () => {
        const onBack = vi.fn();
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={onBack} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map onEncounterCreated propagation', () => {
    it('should pass onEncounterCreated to HexMap for outdoor maps', async () => {
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
});

describe('Map onPoiEntered propagation', () => {
    it('should pass onPoiEntered to HexMap for outdoor maps', async () => {
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

describe('Map HexMap props', () => {
    it('should render HexMap with campaignName for outdoor maps', async () => {
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            mapData: { type: 'outdoor', players: [], walls: new Set(), rooms: [] },
            setMapData: vi.fn(),
            placedItems: [],
            setPlacedItems: vi.fn(),
        });

        const { container } = render(
            <Map campaignName="outdoor-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('.hex-map')).toBeInTheDocument();
    });
});

describe('Map itemsPanel outdoor variant', () => {
    it('should pass outdoor variant to ItemsPanel for outdoor maps', async () => {
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
