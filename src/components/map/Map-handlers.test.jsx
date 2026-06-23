// @improved-by-ai
import { render, fireEvent, screen } from '@testing-library/react';
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

describe('Map handlers', () => {
    describe('onBack prop', () => {
        it('should call onBack when back button is clicked', async () => {
            const onBack = vi.fn();
            render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={onBack} />
            );
            const backBtn = screen.getByTitle('Back');
            fireEvent.click(backBtn);
            expect(onBack).toHaveBeenCalled();
        });
    });

    describe('map data props', () => {
        it('should render players and grid elements on the map', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('svg.grid-svg')).toBeInTheDocument();
        });

        it('should render grid and walls on the map', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('rect.grid-bg')).toBeInTheDocument();
        });
    });

    describe('toolbar rendering', () => {
        it('should render toolbar with buttons and back button', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const toolbar = container.querySelector('.toolbar');
            expect(toolbar).toBeInTheDocument();
            const buttons = toolbar.querySelectorAll('button');
            expect(buttons.length).toBeGreaterThan(2);
        });

        it('should render back button when onBack is provided', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const backBtn = container.querySelector('.toolbar-back-btn');
            expect(backBtn).toBeInTheDocument();
        });

        it('should render grid size input when isLocalhost is true', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const gridSizeInput = container.querySelector('.grid-size-input');
            expect(gridSizeInput).toBeInTheDocument();
        });

        it('should not render grid size input when isLocalhost is false', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={false} mapName="test-map" onBack={vi.fn()} />
            );
            const gridSizeInput = container.querySelector('.grid-size-input');
            expect(gridSizeInput).toBeNull();
        });

        it('should render map name in toolbar', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const mapTitle = container.querySelector('.toolbar-row h4');
            expect(mapTitle).toBeInTheDocument();
            expect(mapTitle.textContent).toBe('test-map');
        });
    });

    describe('campaign and map name props', () => {
        it('should render with campaign name in the component', async () => {
            const { container } = render(
                <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="my-map" onBack={vi.fn()} />
            );
            const mapDiv = container.querySelector('div.map');
            expect(mapDiv).toBeInTheDocument();
        });

        it('should render with map name in the toolbar', async () => {
            const { container } = render(
                <Map campaignName="my-campaign" characters={[]} isLocalhost={true} mapName="my-map" onBack={vi.fn()} />
            );
            const mapTitle = container.querySelector('.toolbar-row h4');
            expect(mapTitle).toBeInTheDocument();
        });
    });

    describe('character prop', () => {
        it('should render characters on the map', async () => {
            const characters = [{ name: 'Thorin', imagePath: 'https://example.com/thorin.png' }];
            const { container } = render(
                <Map campaignName="test-campaign" characters={characters} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            expect(container.querySelector('svg.grid-svg')).toBeInTheDocument();
        });
    });
});
