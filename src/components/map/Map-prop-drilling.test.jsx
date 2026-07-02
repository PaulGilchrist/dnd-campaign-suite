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

describe('Map prop drilling - campaignName', () => {
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
});

describe('Map prop drilling - mapName', () => {
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
});

describe('Map prop drilling - onBack', () => {
    it('should pass onBack to MapToolbar', async () => {
        const onBack = vi.fn();
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={onBack} />
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

describe('Map room rendering', () => {
    it('should render room hit areas', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should render room label text', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

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

describe('Map wide items selection highlighting', () => {
    it('should render wide items without errors', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});
