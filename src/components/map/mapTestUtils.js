// @improved-by-ai
import { vi } from 'vitest';

export const mockGridCenterX = (gx) => gx * 40 + 20;
export const mockGridCenterY = (gy) => gy * 40 + 20;

export const createDefaultMocks = (overrides = {}) => ({
    mapData: { players: [], walls: new Set(), rooms: [] },
    setMapData: vi.fn(),
    placedItems: [],
    setPlacedItems: vi.fn(),
    ...overrides,
});

export const createZoomPanMocks = (overrides = {}) => ({
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

export const createWallDrawingMocks = () => ({
    painting: false,
    handleGridPointerDown: vi.fn(),
    handleGridPointerMove: vi.fn(),
    handleGridPointerUp: vi.fn(),
    handleGridPointerLeave: vi.fn(),
});

export const createRoomDrawingMocks = () => ({
    roomDrawRect: null,
    selectedRoom: null,
    setSelectedRoom: vi.fn(),
    handleRoomPointerDown: vi.fn(),
    handleRoomPointerMove: vi.fn(),
    handleRoomPointerUp: vi.fn(),
    handleRoomClick: vi.fn(),
});

export const createSelectMoveMocks = () => ({
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

export const createRulerMocks = () => ({
    rulerMode: false,
    setRulerMode: vi.fn(),
    rulerStart: null,
    rulerEnd: null,
    rulerPreview: null,
    resetRuler: vi.fn(),
    handleRulerPointerDown: vi.fn(),
    handleRulerPointerMove: vi.fn(),
    handleRulerPointerUp: vi.fn(),
});

export const createSpellOverlayMocks = () => ({
    overlays: [],
    addOverlay: vi.fn(),
    updateOverlay: vi.fn(),
    updateOverlayImmediate: vi.fn(),
    removeOverlay: vi.fn(),
    clearOverlays: vi.fn(),
    handleSSEEvent: vi.fn(),
});

export const createSpellHandlersMocks = () => ({
    spellDraft: null,
    dragOverlay: null,
    rotateOverlay: null,
    spellDragActiveRef: { current: false },
    handleSpellPointerDown: vi.fn(),
    handleSpellPointerMove: vi.fn(),
    handleSpellPointerUp: vi.fn(),
    handleSpellDragMove: vi.fn(),
    handleSpellDragEnd: vi.fn(),
});

export const createPlayerDraggingMocks = () => ({
    dragging: null,
    handlePointerDown: vi.fn(),
    handlePointerMove: vi.fn(),
    handlePointerUp: vi.fn(),
});

export const createItemDraggingMocks = () => ({
    itemDragging: null,
    handleItemPointerDown: vi.fn(),
    handleItemPointerMove: vi.fn(),
    handleItemPointerUp: vi.fn(),
    handleItemPointerLeave: vi.fn(),
});

export const createNpcImageCacheMocks = () => ({
    npcImages: {},
    setNpcImages: vi.fn(),
});

export const createSSESyncMocks = () => ({
    handleSSEEvent: vi.fn(),
});

export const createMapDropsMocks = () => ({
    handleDrop: vi.fn(),
});

// Shared mocks setup — call this in each test file's beforeEach or inline
export const setupMapMocks = (overrides = {}) => {
    const { vi: _vi } = vi; // ensure vi is available

    globalThis.EventSource = class MockEventSource {
        constructor() { this.onmessage = null; this.onerror = null; }
        close() {}
    };

    _vi.mock('../../services/ui/dataLoader.js', () => ({
        loadMonsters: _vi.fn(() => Promise.resolve([])),
    }));

    _vi.mock('../../services/maps/mapsService.js', () => ({
        loadMapData: _vi.fn(() => Promise.resolve(null)),
        saveMapData: _vi.fn(() => Promise.resolve()),
        formatMapName: _vi.fn((name) => name),
        loadMaps: _vi.fn(() => Promise.resolve({ maps: [] })),
    }));

    _vi.mock('../../services/ui/logService.js', () => ({
        getLog: _vi.fn(() => Promise.resolve([])),
        addEntry: _vi.fn(() => Promise.resolve()),
    }));

    _vi.mock('../../hooks/runtime/useLog.js', () => ({
        default: _vi.fn(() => ({ logEntries: [], initialized: true, addEntry: _vi.fn() })),
    }));

    _vi.mock('./hooks/useMapLoader.js', () => ({
        default: _vi.fn(() => createDefaultMocks(overrides.mapLoader)),
    }));

    _vi.mock('./hooks/useZoomPan.js', () => ({
        default: _vi.fn(() => createZoomPanMocks(overrides.zoomPan)),
    }));

    _vi.mock('./hooks/useWallDrawing.js', () => ({
        default: _vi.fn(() => createWallDrawingMocks()),
    }));

    _vi.mock('./hooks/useRoomDrawing.js', () => ({
        default: _vi.fn(() => createRoomDrawingMocks()),
    }));

    _vi.mock('./hooks/useSelectMove.js', () => ({
        default: _vi.fn(() => createSelectMoveMocks()),
    }));

    _vi.mock('./hooks/useRuler.js', () => ({
        default: _vi.fn(() => createRulerMocks()),
    }));

    _vi.mock('./hooks/useSpellOverlay.js', () => ({
        default: _vi.fn(() => createSpellOverlayMocks()),
    }));

    _vi.mock('./hooks/useSpellHandlers.js', () => ({
        default: _vi.fn(() => createSpellHandlersMocks()),
    }));

    _vi.mock('./hooks/usePlayerDragging.js', () => ({
        default: _vi.fn(() => createPlayerDraggingMocks()),
    }));

    _vi.mock('./hooks/useItemDragging.js', () => ({
        default: _vi.fn(() => createItemDraggingMocks()),
    }));

    _vi.mock('./hooks/useNpcImageCache.js', () => ({
        default: _vi.fn(() => createNpcImageCacheMocks()),
    }));

    _vi.mock('./hooks/useSSESync.js', () => ({
        default: _vi.fn(() => createSSESyncMocks()),
    }));

    _vi.mock('./hooks/useFogOfWar.js', () => ({
        default: _vi.fn(() => new Set()),
    }));

    _vi.mock('./hooks/useMapDrops.js', () => ({
        default: _vi.fn(() => createMapDropsMocks()),
    }));
};
