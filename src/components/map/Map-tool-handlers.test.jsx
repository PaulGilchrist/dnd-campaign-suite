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

describe('Map component', () => {
    it('should render the map container', () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});
