// @maintained-by-ai
// ─── Lane: Map container context-menu wiring ──────────────────────────────────
// OWNED here — the container seam only: how Map.jsx reacts to right-clicks.
//   - right-click item → ONE menu, anchored at the right-clicked item's exact
//     bytes (menuX/Y = gridCenter + 10 via the {id, gridX, gridY} payload that
//     crosses the PlacedItems→Map seam); re-right-click swaps, never stacks
//   - right-click empty canvas → no context menu mounts (target specificity)
//   - close paths → menu unmounts: ✕ and left-click canvas both hit
//     handleCloseMenu (no Escape handler is authored; no tool-mode suppression
//     is authored — hit areas answer right-click under every tool)
//   - end-to-end rename flow and View Stats modal open/close (delegated here
//     by ItemContextMenu.test.jsx's header)
//
// NOT OWNED — cited to owner lanes (do not re-pin here):
//   menu label census + per-entry dispatch args       → ItemContextMenu.test.jsx (#918)
//   setSelectedItem payload bytes (unit, per type)      → PlacedItems-event-handlers.test.jsx
//   player menu content, Remove/✕ dispatch              → PlayerContextMenu.test.jsx
//   player remove flow + View Stats negatives           → Map-handlers.test.jsx
//   native contextmenu defaultPrevented bytes, drops,
//   wheel/zoom                                           → Map-tool-handlers.test.jsx (#917)
//   placed-item mutations (hide/delete/rotate)          → hooks/usePlacedItems (#909)
//   fog                                                  → #901/#904
//
// Old→new: 3 tests → 5. 'shows Rename option' re-anchored from menu content
//   (#918 owns labels) to open/anchor/swap wiring; rename flow strengthened
//   with not-renamed sibling + menu-closed byte; modal flow strengthened with
//   close/unmount and synced-store clear. Added: empty-canvas no-menu,
//   ✕/canvas-click close paths.

import { render, fireEvent, act, screen, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map from './Map.jsx';
import { clearRuntimeState, getRuntimeValue } from '../../hooks/runtime/useRuntimeState.js';

const mockLoadMonsters = vi.fn(() => Promise.resolve([]));

// Stateful harness: the mocked hooks read these live, so Map re-renders see
// what its callbacks wrote (setPlacedItems/setMapData mutate them in place).
const mockState = {
    mapData: null,
    placedItems: [],
    npcImages: {},
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
            mockState.mapData = typeof fn === 'function' ? fn(mockState.mapData) : fn;
        }),
        placedItems: mockState.placedItems,
        setPlacedItems: vi.fn((fn) => {
            mockState.placedItems = typeof fn === 'function' ? fn(mockState.placedItems) : fn;
        }),
        flushSave: vi.fn(),
    })),
}));

// Deterministic cell math: center of cell (gx, gy) = (gx*40+20, gy*40+20);
// the menu anchors at center + 10, so right-clicking cell (5,5) must put the
// menu panel rect at x=230 y=230 — the bytes that pin which item was chosen.
const gridCenterX = (gx) => gx * 40 + 20;
const gridCenterY = (gy) => gy * 40 + 20;

vi.mock('./hooks/useZoomPan.js', () => ({
    default: vi.fn(() => ({
        zoom: 1,
        panX: 0,
        panY: 0,
        zoomIn: vi.fn(),
        zoomOut: vi.fn(),
        resetView: vi.fn(),
        gridCenterX,
        gridCenterY,
        getGridFromEvent: vi.fn(() => ({ gridX: 5, gridY: 5 })),
        panning: false,
        handlePanStart: vi.fn(),
        handlePanMove: vi.fn(),
        handlePanEnd: vi.fn(),
        handleWheel: vi.fn(),
        clientToSVG: vi.fn(),
    })),
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
        placedItemsRef: { current: mockState.placedItems },
        mapDataRef: { current: mockState.mapData },
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
        npcImages: mockState.npcImages,
        setNpcImages: vi.fn((fn) => {
            Object.assign(mockState.npcImages, typeof fn === 'function' ? fn(mockState.npcImages) : fn);
        }),
    })),
}));

vi.mock('./hooks/useSSESync.js', () => ({
    default: vi.fn(() => ({ handleSSEEvent: vi.fn() })),
}));

vi.mock('./hooks/useFogOfWar.js', () => ({
    default: vi.fn(() => ({ fog: new Set(), visible: new Set() })),
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

const npc = (id, name, gridX, gridY) => ({ id, type: 'npc', name, gridX, gridY });

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
    mockState.mapData = { players: [], walls: new Set() };
    mockState.placedItems = [];
    mockState.npcImages = {};
    mockLoadMonsters.mockReset();
    mockLoadMonsters.mockImplementation(() => Promise.resolve([]));
};

const npcHitAreas = (container) =>
    container.querySelectorAll('g.npc-group rect[fill="transparent"]');

const menus = (container) => container.querySelectorAll('.item-context-menu');

const menuPanelRect = (container) => menus(container)[0]?.querySelector('rect');

describe('Map container - context-menu wiring', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        clearRuntimeState('campaign'); // viewingMonster lives on the 'campaign' store
        MockEventSource.instances.length = 0;
        resetState();
    });

    it('right-click opens ONE item menu anchored to the clicked item and swaps on a new right-click', async () => {
        mockState.placedItems = [npc('npcA', 'Goblin', 5, 5), npc('npcB', 'Bogey', 8, 3)];
        const { container } = await act(async () => renderMap());
        const hitAreas = npcHitAreas(container);
        expect(hitAreas).toHaveLength(2);

        await act(async () => { fireEvent.contextMenu(hitAreas[0]); });
        expect(menus(container)).toHaveLength(1);
        // Selection payload {id, gridX: 5, gridY: 5} → anchor bytes 220+10, 220+10
        expect(menuPanelRect(container).getAttribute('x')).toBe('230');
        expect(menuPanelRect(container).getAttribute('y')).toBe('230');

        // Re-right-click swaps the selection: still one menu, anchored to cell (8,3)
        await act(async () => { fireEvent.contextMenu(hitAreas[1]); });
        expect(menus(container)).toHaveLength(1);
        expect(menuPanelRect(container).getAttribute('x')).toBe('350');
        expect(menuPanelRect(container).getAttribute('y')).toBe('150');
    });

    it('right-clicking empty canvas opens no context menu', async () => {
        mockState.mapData = { players: [npc('p1', 'Thorin', 1, 1)], walls: new Set() };
        mockState.placedItems = [npc('npcA', 'Goblin', 5, 5)];
        const { container } = await act(async () => renderMap());

        await act(async () => { fireEvent.contextMenu(container.querySelector('svg')); });
        expect(menus(container)).toHaveLength(0);
        expect(screen.queryByText('Hide')).not.toBeInTheDocument();
        expect(screen.queryByText('Remove from Map')).not.toBeInTheDocument();
    });

    it('item menu closes exactly on ✕ and on canvas left-click', async () => {
        mockState.placedItems = [npc('npcA', 'Goblin', 5, 5)];
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        const hit = npcHitAreas(container)[0];

        await act(async () => { fireEvent.contextMenu(hit); });
        expect(menus(container)).toHaveLength(1);
        await act(async () => { fireEvent.click(screen.getByText('✕')); });
        expect(menus(container)).toHaveLength(0);

        await act(async () => { fireEvent.contextMenu(hit); });
        expect(menus(container)).toHaveLength(1);
        await act(async () => { fireEvent.click(svg, { button: 0 }); });
        expect(menus(container)).toHaveLength(0);
    });

    it('Rename flow: popover opens and the item menu closes; Enter commits the new name to that NPC only', async () => {
        mockState.placedItems = [npc('npcA', 'Goblin', 5, 5), npc('npcB', 'Bogey', 2, 2)];
        const { container } = await act(async () => renderMap());

        await act(async () => { fireEvent.contextMenu(npcHitAreas(container)[0]); });
        await act(async () => { fireEvent.click(screen.getByText('Rename')); });

        expect(menus(container)).toHaveLength(0);
        const input = container.querySelector('.monster-autocomplete-input');
        expect(input).toBeInTheDocument();

        await act(async () => {
            fireEvent.change(input, { target: { value: 'Orc' } });
            fireEvent.keyDown(input, { key: 'Enter' });
        });

        expect(mockState.placedItems.map(i => i.name)).toEqual(['Orc', 'Bogey']);
        expect(container.querySelector('.monster-autocomplete-input')).not.toBeInTheDocument();
    });

    // Regression (bug-map-rename-all-same-named-tokens): the palette drops
    // every unnamed NPC with the display name 'NPC', so the old name-matched
    // commit renamed ALL of them at once. Renaming by stable id must touch
    // ONLY the right-clicked token.
    it('Rename with duplicate names: Enter commits only to the right-clicked token id', async () => {
        mockState.placedItems = [npc('npc-1', 'NPC', 5, 5), npc('npc-2', 'NPC', 8, 3), npc('npc-3', 'NPC', 2, 2)];
        const { container } = await act(async () => renderMap());

        // Right-click the MIDDLE token (npc-2 at cell 8,3) and rename it.
        await act(async () => { fireEvent.contextMenu(npcHitAreas(container)[1]); });
        await act(async () => { fireEvent.click(screen.getByText('Rename')); });

        const input = container.querySelector('.monster-autocomplete-input');
        expect(input.value).toBe('NPC');
        await act(async () => {
            fireEvent.change(input, { target: { value: 'QA Solo Rename' } });
            fireEvent.keyDown(input, { key: 'Enter' });
        });

        expect(mockState.placedItems.map(i => [i.id, i.name])).toEqual([
            ['npc-1', 'NPC'],
            ['npc-2', 'QA Solo Rename'],
            ['npc-3', 'NPC'],
        ]);
        expect(container.querySelector('.monster-autocomplete-input')).not.toBeInTheDocument();
    });

    it('View Stats opens the monster card with the bestiary match and closes back through the synced store', async () => {
        mockLoadMonsters.mockImplementation(() => Promise.resolve([{ name: 'Goblin', index: 'goblin' }]));
        mockState.placedItems = [npc('npcA', 'Goblin', 5, 5)];
        const { container } = await act(async () => renderMap());

        await act(async () => { fireEvent.contextMenu(npcHitAreas(container)[0]); });
        await act(async () => { fireEvent.click(screen.getByText('View Stats')); });

        const modal = screen.getByTestId('monster-card-modal');
        expect(within(modal).getByText('Goblin')).toBeInTheDocument();
        expect(getRuntimeValue('campaign', 'map-viewingMonster')).toMatchObject({ name: 'Goblin' });

        await act(async () => { fireEvent.click(within(modal).getByText('close')); });
        expect(screen.queryByTestId('monster-card-modal')).not.toBeInTheDocument();
        expect(getRuntimeValue('campaign', 'map-viewingMonster')).toBeNull();
    });
});
