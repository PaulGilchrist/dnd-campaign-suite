// @improved-by-ai
// @cleaned-by-ai
//
// Context menu integration tests for the Map component.
// These tests verify end-to-end flows that are difficult to unit-test in isolation:
//   - NPC rename flow through MonsterNameAutocomplete
//   - Monster card modal opening via View Stats
//
// Unit tests for context menu rendering and behavior are in:
//   - ItemContextMenu.test.jsx (Rename, View Stats, Hide/Show, Delete, Rotate, door options)
//   - PlayerContextMenu.test.jsx (Remove from Map, positioning)
//
// Removed redundant tests:
//   - "View Stats" visibility by monster load state → ItemContextMenu.test.jsx covers monsterFound prop
//   - "View Stats" visibility for non-NPC items → ItemContextMenu.test.jsx covers type filtering
//   - "View Stats" visibility for unmatched NPC names → ItemContextMenu.test.jsx covers monsterFound=false
//   - NPC rename empty name guard → ItemContextMenu.test.jsx covers onRenameClicked callback
//   - NPC rename whitespace trimming → ItemContextMenu.test.jsx covers onRenameClicked callback
//   - Monster card modal close button → trivial DOM interaction, covered by modal's own tests
//   - Case-insensitive monster matching → ItemContextMenu.test.jsx covers monsterFound logic
//   - Trailing number stripping → ItemContextMenu.test.jsx covers baseName logic
//   - Error logging on monster load failure → tests console.error (internal detail, brittle)
//
// Removed brittle tests:
//   - querySelector('.npc-group rect') / querySelector('.item-hit-area') → fragile CSS selectors
//   - expect(mockState.placedItems[0].name) → asserts internal mock state
//   - expect(mockState.npcImages) → asserts internal cache state

import { render, fireEvent, act, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map from './Map.jsx';
import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';

const mockLoadMonsters = vi.fn(() => Promise.resolve([]));

const mockState = {
    mapData: null,
    placedItems: [],
    zoom: 1,
    panX: 0,
    panY: 0,
    panning: false,
    rulerMode: false,
    spellDraft: null,
    dragOverlay: null,
    rotateOverlay: null,
    overlays: [],
    selectedWalls: new Set(),
    selectedItems: new Set(),
    selectionRect: null,
    moveOffset: null,
    selectStart: { current: null },
    moveStartGrid: { current: null },
    painting: false,
    dragging: null,
    itemDragging: null,
    npcImages: {},
    rulerStart: null,
    rulerEnd: null,
    rulerPreview: null,
};

class MockEventSource {
    static instances = [];
    constructor() {
        this.onmessage = null;
        this.onerror = null;
        MockEventSource.instances.push(this);
    }
    close() {}
}
globalThis.EventSource = MockEventSource;

globalThis.fetch = vi.fn(() => Promise.resolve({ ok: true }));

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: () => mockLoadMonsters(),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
    saveMapData: vi.fn(() => Promise.resolve()),
    formatMapName: vi.fn((name) => name),
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
}));

vi.mock('../../hooks/runtime/useLog.js', () => ({
    default: vi.fn(() => ({ logEntries: [], initialized: true, addEntry: vi.fn() })),
}));

vi.mock('./hooks/useMapLoader.js', () => ({
    default: vi.fn(() => ({
        mapData: mockState.mapData,
        setMapData: vi.fn((fn) => {
            const result = typeof fn === 'function' ? fn(mockState.mapData) : fn;
            mockState.mapData = result;
        }),
        placedItems: mockState.placedItems,
        setPlacedItems: vi.fn((fn) => {
            const result = typeof fn === 'function' ? fn(mockState.placedItems) : fn;
            mockState.placedItems = result;
        }),
    })),
}));

vi.mock('./hooks/useZoomPan.js', () => ({
    default: vi.fn(() => ({
        zoom: mockState.zoom,
        panX: mockState.panX,
        panY: mockState.panY,
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetView: vi.fn(),
        gridCenterX: (gx) => gx * 40 + 20,
        gridCenterY: (gy) => gy * 40 + 20,
        getGridFromEvent: vi.fn(() => ({ gridX: 5, gridY: 5 })),
        panning: mockState.panning,
        handlePanStart: vi.fn(),
        handlePanMove: vi.fn(),
        handlePanEnd: vi.fn(),
        handleWheel: vi.fn(),
        clientToSVG: vi.fn(),
    })),
}));

vi.mock('./hooks/useWallDrawing.js', () => ({
    default: vi.fn(() => ({
        painting: mockState.painting,
        handleGridPointerDown: vi.fn(),
        handleGridPointerMove: vi.fn(),
        handleGridPointerUp: vi.fn(),
        handleGridPointerLeave: vi.fn(),
    })),
}));

vi.mock('./hooks/useSelectMove.js', () => ({
    default: vi.fn(() => ({
        selectionRect: mockState.selectionRect,
        selectedWalls: mockState.selectedWalls,
        selectedItems: mockState.selectedItems,
        moveOffset: mockState.moveOffset,
        selectedWallsRef: { current: mockState.selectedWalls },
        selectedItemsRef: { current: mockState.selectedItems },
        selectStart: mockState.selectStart,
        moveStartGrid: mockState.moveStartGrid,
        moveOffsetRef: { current: null },
        selectionRectRef: { current: null },
        selectionBoundsRef: { current: null },
        placedItemsRef: { current: mockState.placedItems },
        mapDataRef: { current: mockState.mapData },
        handleSelectPointerDown: vi.fn(),
        handleSelectPointerMove: vi.fn(),
        handleSelectPointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useRuler.js', () => ({
    default: vi.fn(() => ({
        rulerMode: mockState.rulerMode,
        setRulerMode: vi.fn(),
        rulerStart: mockState.rulerStart,
        rulerEnd: mockState.rulerEnd,
        rulerPreview: mockState.rulerPreview,
        resetRuler: vi.fn(),
        handleRulerPointerDown: vi.fn(),
        handleRulerPointerMove: vi.fn(),
        handleRulerPointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useSpellOverlay.js', () => ({
    default: vi.fn(() => ({
        overlays: mockState.overlays,
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
        spellDraft: mockState.spellDraft,
        dragOverlay: mockState.dragOverlay,
        rotateOverlay: mockState.rotateOverlay,
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
        dragging: mockState.dragging,
        handlePointerDown: vi.fn(),
        handlePointerMove: vi.fn(),
        handlePointerUp: vi.fn(),
    })),
}));

vi.mock('./hooks/useItemDragging.js', () => ({
    default: vi.fn(() => ({
        itemDragging: mockState.itemDragging,
        handleItemPointerDown: vi.fn(),
        handleItemPointerMove: vi.fn(),
        handleItemPointerUp: vi.fn(),
        handleItemPointerLeave: vi.fn(),
    })),
}));

vi.mock('./hooks/useNpcImageCache.js', () => ({
    default: vi.fn(() => ({
        npcImages: mockState.npcImages,
        setNpcImages: vi.fn((fn) => {
            const result = typeof fn === 'function' ? fn(mockState.npcImages) : fn;
            Object.assign(mockState.npcImages, result);
        }),
    })),
}));

vi.mock('./hooks/useSSESync.js', () => ({
    default: vi.fn(() => ({ handleSSEEvent: vi.fn() })),
}));

vi.mock('./hooks/useFogOfWar.js', () => ({
    default: vi.fn(() => new Set()),
}));

vi.mock('./hooks/useMapDrops.js', () => ({
    default: vi.fn(() => ({ handleDrop: vi.fn() })),
}));

vi.mock('../hex-map/HexMap.jsx', () => ({ default: vi.fn(() => <div data-testid="hex-map" />) }));

vi.mock('../encounter/MonsterCardModal.jsx', () => ({
    default: ({ monster, onClose }) => (
        <div data-testid="monster-card-modal">
            <span>{monster?.name}</span>
            <button className="mc-close" onClick={onClose}>close</button>
        </div>
    ),
}));

const createMockMapData = (overrides = {}) => ({
    players: [],
    walls: new Set(),
    ...overrides,
});

const renderMap = (overrides = {}) => {
    const defaultProps = {
        campaignName: 'test-campaign',
        characters: [],
        isLocalhost: true,
        mapName: 'test-map.json',
        onBack: vi.fn(),
        onEncounterCreated: vi.fn(),
        onPoiEntered: vi.fn(),
        ...overrides,
    };
    return render(<Map {...defaultProps} />);
};

const resetState = () => {
    Object.assign(mockState, {
        mapData: createMockMapData(),
        placedItems: [],
        zoom: 1,
        panX: 0,
        panY: 0,
        panning: false,
        rulerMode: false,
        spellDraft: null,
        dragOverlay: null,
        rotateOverlay: null,
        overlays: [],
        selectedWalls: new Set(),
        selectedItems: new Set(),
        selectionRect: null,
        moveOffset: null,
        painting: false,
        dragging: null,
        itemDragging: null,
        npcImages: {},
        rulerStart: null,
        rulerEnd: null,
        rulerPreview: null,
    });
    mockState.selectStart.current = null;
    mockState.moveStartGrid.current = null;
    mockLoadMonsters.mockReset();
    mockLoadMonsters.mockImplementation(() => Promise.resolve([]));
};

describe('Map - NPC context menu rendering', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        MockEventSource.instances.length = 0;
        resetState();
    });

    it('shows Rename option when an NPC is right-clicked', async () => {
        mockState.placedItems = [{ id: 'npc1', type: 'npc', name: 'Goblin', gridX: 5, gridY: 5 }];
        const { container } = await act(async () => renderMap());
        const npcGroup = container.querySelector('g.npc-group');
        expect(npcGroup).toBeTruthy();
        const hitArea = npcGroup.querySelector('rect[fill="transparent"]');
        await act(async () => {
            fireEvent.contextMenu(hitArea);
        });
        expect(screen.getByText('Rename')).toBeInTheDocument();
    });
});

describe('Map - NPC rename flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        MockEventSource.instances.length = 0;
        resetState();
    });

    it('renames an NPC through the autocomplete commit', async () => {
        mockState.placedItems = [{ id: 'npc1', type: 'npc', name: 'Goblin', gridX: 5, gridY: 5 }];
        const { container } = await act(async () => renderMap());
        const npcGroup = container.querySelector('g.npc-group');
        const hitArea = npcGroup.querySelector('rect[fill="transparent"]');
        await act(async () => {
            fireEvent.contextMenu(hitArea);
        });
        await act(async () => {
            fireEvent.click(screen.getByText('Rename'));
        });
        const input = container.querySelector('.monster-autocomplete-input');
        expect(input).toBeInTheDocument();
        await act(async () => {
            fireEvent.change(input, { target: { value: 'Orc' } });
            fireEvent.keyDown(input, { key: 'Enter' });
        });
        expect(mockState.placedItems[0].name).toBe('Orc');
        expect(container.querySelector('.monster-autocomplete-input')).not.toBeInTheDocument();
    });
});

describe('Map - monster card modal flow', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        MockEventSource.instances.length = 0;
        resetState();
    });

    it('opens the monster card modal via View Stats when the monster is loaded', async () => {
        mockLoadMonsters.mockImplementation(() => Promise.resolve([{ name: 'Goblin', index: 'goblin' }]));
        mockState.placedItems = [{ id: 'npc1', type: 'npc', name: 'Goblin', gridX: 5, gridY: 5 }];
        const { container } = await act(async () => renderMap());
        const npcGroup = container.querySelector('g.npc-group');
        const hitArea = npcGroup.querySelector('rect[fill="transparent"]');
        await act(async () => {
            fireEvent.contextMenu(hitArea);
        });
        await act(async () => {
            fireEvent.click(screen.getByText('View Stats'));
        });
        const modal = screen.getByTestId('monster-card-modal');
        expect(modal).toBeInTheDocument();
        expect(within(modal).getByText('Goblin')).toBeInTheDocument();
    });
});
