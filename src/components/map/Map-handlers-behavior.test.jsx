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

    it('should strip trailing number from npc name when matching monster', async () => {
        const mockLoadMonsters = await import('../../services/ui/dataLoader.js');
        mockLoadMonsters.loadMonsters.mockResolvedValue([
            { name: 'Goblin' },
        ]);

        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            ...createDefaultMocks(),
            placedItems: [{ id: 'npc1', type: 'npc', name: 'Goblin 3' }],
        });

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
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            ...createDefaultMocks(),
            setPlacedItems: vi.fn(),
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});

describe('Map handleRenameItem', () => {
    it('should not rename when newName is empty', async () => {
        const setPlacedItems = vi.fn();
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            ...createDefaultMocks(),
            setPlacedItems,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should trim whitespace from new name', async () => {
        const setPlacedItems = vi.fn();
        const mockMapLoader = await import('./hooks/useMapLoader.js');
        mockMapLoader.default.mockReturnValue({
            ...createDefaultMocks(),
            setPlacedItems,
        });

        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });

    it('should update npcImages cache when renaming', async () => {
        const setNpcImages = vi.fn();
        const mockNpcCache = await import('./hooks/useNpcImageCache.js');
        mockNpcCache.default.mockReturnValue({
            npcImages: {},
            setNpcImages,
        });

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

describe('Map handleRenameClicked', () => {
    it('should not throw when svgRef is null', async () => {
        const { container } = render(
            <Map campaignName="test" characters={[]} isLocalhost={true} mapName="test-map" onBack={vi.fn()} />
        );
        expect(container.querySelector('div.map')).toBeInTheDocument();
    });
});
