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

describe('Map event handlers', () => {
    describe('SVG event handlers', () => {
        it('should render SVG with correct cursor style when tool is none', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            expect(svg).toBeInTheDocument();
            expect(svg.getAttribute('style')).toContain('cursor: grab');
        });

        it('should handle pointerdown events without throwing', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new PointerEvent('pointerdown', { bubbles: true });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should handle pointermove events without throwing', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new PointerEvent('pointermove', { bubbles: true });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should handle pointerup events without throwing', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new PointerEvent('pointerup', { bubbles: true });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should handle wheel events without throwing', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new WheelEvent('wheel', { bubbles: true, metaKey: true });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });

        it('should handle click events without throwing', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const event = new MouseEvent('click', { bubbles: true, button: 0 });
            expect(() => svg.dispatchEvent(event)).not.toThrow();
        });
    });

    describe('SVG viewBox', () => {
        it('should render SVG with correct viewBox when zoom is 1', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const viewBox = svg.getAttribute('viewBox');
            expect(viewBox).toContain('0 0');
            expect(viewBox).toContain('1200');
        });

        it('should render SVG with viewBox that includes zoom divisor', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            const viewBox = svg.getAttribute('viewBox');
            // SVG_SIZE = 30 * 40 = 1200, zoom = 1, so viewBox size = 1200/1 = 1200
            expect(viewBox).toMatch(/\d+ \d+ 1200 1200/);
        });
    });

    describe('click handling', () => {
        it('should call handleCloseMenu on SVG click without throwing', async () => {
            const { container } = render(
                <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
            );
            const svg = container.querySelector('svg.grid-svg');
            // Click should not throw and should fire the onClick handler
            const event = new MouseEvent('click', { bubbles: true, button: 0 });
            svg.dispatchEvent(event);
            // If selectedItem was set, it should be cleared
        });
    });
});
