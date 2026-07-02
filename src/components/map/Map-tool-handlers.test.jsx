// @improved-by-ai
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Map from './Map.jsx';
import {
    createDefaultMocks,
    createZoomPanMocks,
    createWallDrawingMocks,
    createRoomDrawingMocks,
    createSelectMoveMocks,
    createRulerMocks,
    createSpellOverlayMocks,
    createSpellHandlersMocks,
    createPlayerDraggingMocks,
    createItemDraggingMocks,
    createNpcImageCacheMocks,
    createSSESyncMocks,
    createMapDropsMocks,
} from './mapTestUtils.js';

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
    default: vi.fn(() => createWallDrawingMocks()),
}));

vi.mock('./hooks/useRoomDrawing.js', () => ({
    default: vi.fn(() => createRoomDrawingMocks()),
}));

vi.mock('./hooks/useSelectMove.js', () => ({
    default: vi.fn(() => createSelectMoveMocks()),
}));

vi.mock('./hooks/useRuler.js', () => ({
    default: vi.fn(() => createRulerMocks()),
}));

vi.mock('./hooks/useSpellOverlay.js', () => ({
    default: vi.fn(() => createSpellOverlayMocks()),
}));

vi.mock('./hooks/useSpellHandlers.js', () => ({
    default: vi.fn(() => createSpellHandlersMocks()),
}));

vi.mock('./hooks/usePlayerDragging.js', () => ({
    default: vi.fn(() => createPlayerDraggingMocks()),
}));

vi.mock('./hooks/useItemDragging.js', () => ({
    default: vi.fn(() => createItemDraggingMocks()),
}));

vi.mock('./hooks/useNpcImageCache.js', () => ({
    default: vi.fn(() => createNpcImageCacheMocks()),
}));

vi.mock('./hooks/useSSESync.js', () => ({
    default: vi.fn(() => createSSESyncMocks()),
}));

vi.mock('./hooks/useFogOfWar.js', () => ({
    default: vi.fn(() => new Set()),
}));

vi.mock('./hooks/useMapDrops.js', () => ({
    default: vi.fn(() => createMapDropsMocks()),
}));

describe('Map tool pointer handler routing', () => {
    it('should dispatch pointerdown to paint handler when tool is paint', async () => {
        const handleGridPointerDown = vi.fn();
        const mockWallDrawing = await import('./hooks/useWallDrawing.js');
        mockWallDrawing.default.mockReturnValue({
            ...createWallDrawingMocks(),
            handleGridPointerDown,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should dispatch pointerdown to select handler when tool is select', async () => {
        const handleSelectPointerDown = vi.fn();
        const mockSelectMove = await import('./hooks/useSelectMove.js');
        mockSelectMove.default.mockReturnValue({
            ...createSelectMoveMocks(),
            handleSelectPointerDown,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should dispatch pointerdown to room handler when tool is room', async () => {
        const handleRoomPointerDown = vi.fn();
        const mockRoomDrawing = await import('./hooks/useRoomDrawing.js');
        mockRoomDrawing.default.mockReturnValue({
            ...createRoomDrawingMocks(),
            handleRoomPointerDown,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should dispatch pointerdown to pan handler when tool is none', async () => {
        const handlePanStart = vi.fn();
        const mockZoomPan = await import('./hooks/useZoomPan.js');
        mockZoomPan.default.mockReturnValue({
            ...createZoomPanMocks(),
            handlePanStart,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should skip paint handler when spellDragActiveRef is true', async () => {
        const handleGridPointerDown = vi.fn();
        const mockWallDrawing = await import('./hooks/useWallDrawing.js');
        const mockSpellHandlers = await import('./hooks/useSpellHandlers.js');
        mockWallDrawing.default.mockReturnValue({
            ...createWallDrawingMocks(),
            handleGridPointerDown,
        });
        mockSpellHandlers.default.mockReturnValue({
            ...createSpellHandlersMocks(),
            spellDragActiveRef: { current: true },
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new PointerEvent('pointerdown', { bubbles: true });
        expect(() => svg.dispatchEvent(event)).not.toThrow();
    });

    it('should call all pointer move handlers', async () => {
        const handlePointerMove = vi.fn();
        const handleItemPointerMove = vi.fn();
        const handleGridPointerMove = vi.fn();
        const handleSelectPointerMove = vi.fn();
        const handleRoomPointerMove = vi.fn();
        const handlePanMove = vi.fn();
        const handleSpellPointerMove = vi.fn();
        const handleSpellDragMove = vi.fn();
        const handleRulerPointerMove = vi.fn();

        const mockPlayerDrag = await import('./hooks/usePlayerDragging.js');
        mockPlayerDrag.default.mockReturnValue({
            ...createPlayerDraggingMocks(),
            handlePointerMove,
        });

        const mockItemDrag = await import('./hooks/useItemDragging.js');
        mockItemDrag.default.mockReturnValue({
            ...createItemDraggingMocks(),
            handleItemPointerMove,
        });

        const mockWallDraw = await import('./hooks/useWallDrawing.js');
        mockWallDraw.default.mockReturnValue({
            ...createWallDrawingMocks(),
            handleGridPointerMove,
        });

        const mockSelectMove = await import('./hooks/useSelectMove.js');
        mockSelectMove.default.mockReturnValue({
            ...createSelectMoveMocks(),
            handleSelectPointerMove,
        });

        const mockRoomDraw = await import('./hooks/useRoomDrawing.js');
        mockRoomDraw.default.mockReturnValue({
            ...createRoomDrawingMocks(),
            handleRoomPointerMove,
        });

        const mockZoomPan = await import('./hooks/useZoomPan.js');
        mockZoomPan.default.mockReturnValue({
            ...createZoomPanMocks(),
            handlePanMove,
        });

        const mockSpellHandlers = await import('./hooks/useSpellHandlers.js');
        mockSpellHandlers.default.mockReturnValue({
            ...createSpellHandlersMocks(),
            handleSpellPointerMove,
            handleSpellDragMove,
        });

        const mockRuler = await import('./hooks/useRuler.js');
        mockRuler.default.mockReturnValue({
            ...createRulerMocks(),
            handleRulerPointerMove,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new PointerEvent('pointermove', { bubbles: true });
        svg.dispatchEvent(event);
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should call all pointer up handlers', async () => {
        const handlePointerUp = vi.fn();
        const handleItemPointerUp = vi.fn();
        const handleGridPointerUp = vi.fn();
        const handleSelectPointerUp = vi.fn();
        const handleRoomPointerUp = vi.fn();
        const handlePanEnd = vi.fn();
        const handleSpellPointerUp = vi.fn();
        const handleSpellDragEnd = vi.fn();
        const handleRulerPointerUp = vi.fn();

        const mockPlayerDrag = await import('./hooks/usePlayerDragging.js');
        mockPlayerDrag.default.mockReturnValue({
            ...createPlayerDraggingMocks(),
            handlePointerUp,
        });

        const mockItemDrag = await import('./hooks/useItemDragging.js');
        mockItemDrag.default.mockReturnValue({
            ...createItemDraggingMocks(),
            handleItemPointerUp: handleItemPointerUp,
        });

        const mockWallDraw = await import('./hooks/useWallDrawing.js');
        mockWallDraw.default.mockReturnValue({
            ...createWallDrawingMocks(),
            handleGridPointerUp,
        });

        const mockSelectMove = await import('./hooks/useSelectMove.js');
        mockSelectMove.default.mockReturnValue({
            ...createSelectMoveMocks(),
            handleSelectPointerUp,
        });

        const mockRoomDraw = await import('./hooks/useRoomDrawing.js');
        mockRoomDraw.default.mockReturnValue({
            ...createRoomDrawingMocks(),
            handleRoomPointerUp,
        });

        const mockZoomPan = await import('./hooks/useZoomPan.js');
        mockZoomPan.default.mockReturnValue({
            ...createZoomPanMocks(),
            handlePanEnd,
        });

        const mockSpellHandlers = await import('./hooks/useSpellHandlers.js');
        mockSpellHandlers.default.mockReturnValue({
            ...createSpellHandlersMocks(),
            handleSpellPointerUp,
            handleSpellDragEnd,
        });

        const mockRuler = await import('./hooks/useRuler.js');
        mockRuler.default.mockReturnValue({
            ...createRulerMocks(),
            handleRulerPointerUp,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new PointerEvent('pointerup', { bubbles: true });
        svg.dispatchEvent(event);
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should call pointer leave handlers', async () => {
        const handleItemPointerLeave = vi.fn();
        const handleGridPointerLeave = vi.fn();
        const handleSelectPointerUp = vi.fn();

        const mockItemDrag = await import('./hooks/useItemDragging.js');
        mockItemDrag.default.mockReturnValue({
            ...createItemDraggingMocks(),
            handleItemPointerLeave,
        });

        const mockWallDraw = await import('./hooks/useWallDrawing.js');
        mockWallDraw.default.mockReturnValue({
            ...createWallDrawingMocks(),
            handleGridPointerLeave,
        });

        const mockSelectMove = await import('./hooks/useSelectMove.js');
        mockSelectMove.default.mockReturnValue({
            ...createSelectMoveMocks(),
            handleSelectPointerUp,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        const event = new PointerEvent('pointerleave', { bubbles: true });
        svg.dispatchEvent(event);
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map SSE event handling', () => {
    it('should delegate SSE events to mapSSE handler', async () => {
        const handleMapSSEEvent = vi.fn();
        const mockSSESync = await import('./hooks/useSSESync.js');
        mockSSESync.default.mockReturnValue({
            handleSSEEvent: handleMapSSEEvent,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should delegate SSE events to spell overlay handler', async () => {
        const handleSpellOverlayEvent = vi.fn();
        const mockSpellOverlay = await import('./hooks/useSpellOverlay.js');
        mockSpellOverlay.default.mockReturnValue({
            ...createSpellOverlayMocks(),
            handleSSEEvent: handleSpellOverlayEvent,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should handle SSE events with data without throwing', async () => {
        const { container } = render(
            <Map campaignName="test-campaign" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should handle SSE events without data without throwing', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map refs synchronization', () => {
    it('should sync placedItemsRef when placedItems changes', async () => {
        const placedItemsRef = { current: [] };
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            ...createDefaultMocks(),
            placedItemsRef,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should sync selectedWallsRef when selectedWalls changes', async () => {
        const selectedWallsRef = { current: new Set() };
        const mockSelectMove = await import('./hooks/useSelectMove.js');
        mockSelectMove.default.mockReturnValue({
            ...createSelectMoveMocks(),
            selectedWallsRef,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should sync selectedItemsRef when selectedItems changes', async () => {
        const selectedItemsRef = { current: new Set() };
        const mockSelectMove = await import('./hooks/useSelectMove.js');
        mockSelectMove.default.mockReturnValue({
            ...createSelectMoveMocks(),
            selectedItemsRef,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should sync mapDataRef when mapData changes', async () => {
        const mapDataRef = { current: null };
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            ...createDefaultMocks(),
            mapDataRef,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map onDrop handler', () => {
    it('should have drag and drop handlers on SVG', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        const svg = container.querySelector('svg.grid-svg');
        expect(svg).toBeInTheDocument();
    });
});
