// @maintained-by-ai
// ─── Lane: Map container PLAYER context-menu wiring ──────────────────────────
// OWNED here (delegated by Map-context-menus.test.jsx #920 header:
// "player remove flow → Map-handlers.test.jsx"):
//   - right-click player token → ONE player menu, anchored to the clicked
//     player's exact bytes (circle onContextMenu → setSelectedPlayer →
//     PlayerContextMenu mount; anchor = gridCenter + 10)
//   - canvas left-click → handleCloseMenu → player menu unmounts
//     (player half of the close wiring; item half pinned by #920 :302)
//   - 'Remove from Map' end-to-end: exact remaining players in mapData
//     and menu closes (dispatch unit → PlayerContextMenu.test.jsx)
//
// NOT OWNED — cited to owner lanes (cut from this file):
//   item menu open/anchor/swap/close, rename, View Stats modal → #920
//   menu label census incl. View Stats negatives ('npc monster not
//   found'/'unknown type' rows), per-entry dispatch             → #918
//   player token render/select dispatch                        → Players.test.jsx
//   ✕/Remove dispatch args at unit level                     → PlayerContextMenu.test.jsx
//   SVG pointer routing, toolbar, selection previews         → Map-tool-handlers.test.jsx
//   tool state machines (drag/drop/ruler/select/spell/SSE)   → hooks #903-#917
//
// Old→new: 4 tests → 2. Cut ':280/:294' View Stats negatives (#918 census
//   owns menu content, stronger there); ':316' rewrite — vacuous (`.player-group`
//   selector never matched the real `circle.creature-circle`, so its `if`
//   guard skipped every assertion); ':346' strengthened — previously clicked a
//   never-opened menu (#920 lesson: open it before asserting it closes).

import { render, fireEvent, act, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map from './Map.jsx';
import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';

const mockLoadMonsters = vi.fn(() => Promise.resolve([]));

// Stateful harness: the mocked hooks read these live, so Map re-renders see
// what its callbacks wrote (setMapData/setPlacedItems mutate them in place).
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
// the player menu anchors at center + 10 — the bytes that pin WHICH player
// the menu belongs to.
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
        setNpcImages: vi.fn(),
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

const player = (id, name, gridX, gridY) => ({ id, name, gridX, gridY });

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

const menus = (container) => container.querySelectorAll('.item-context-menu');

const menuPanelRect = (container) => menus(container)[0]?.querySelector('rect');

const playerCircles = (container) => container.querySelectorAll('circle.creature-circle');

describe('Map container - player context menu', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        clearRuntimeState('campaign'); // viewingMonster lives on the 'campaign' store
        MockEventSource.instances.length = 0;
        resetState();
    });

    it('right-click player token opens ONE menu anchored to that token; canvas left-click closes it', async () => {
        mockState.mapData = {
            players: [player('player1', 'Thorin', 5, 5), player('player2', 'Legolas', 6, 6)],
            walls: new Set(),
        };
        const { container } = await act(async () => renderMap());
        const circles = playerCircles(container);
        expect(circles).toHaveLength(2);

        await act(async () => { fireEvent.contextMenu(circles[1]); });
        expect(menus(container)).toHaveLength(1);
        // Selection payload Legolas (6,6) → anchor bytes 6*40+20+10 = 270
        expect(menuPanelRect(container).getAttribute('x')).toBe('270');
        expect(menuPanelRect(container).getAttribute('y')).toBe('270');
        expect(screen.getByText('Remove from Map')).toBeInTheDocument();

        // Canvas left-click → handleCloseMenu → player menu unmounts
        await act(async () => { fireEvent.click(container.querySelector('svg'), { button: 0 }); });
        expect(menus(container)).toHaveLength(0);
        expect(screen.queryByText('Remove from Map')).not.toBeInTheDocument();
    });

    it('Remove from Map removes exactly that player and closes the menu', async () => {
        mockState.mapData = {
            players: [
                player('player1', 'Thorin', 5, 5),
                player('player2', 'Legolas', 6, 6),
                player('player3', 'Gimli', 7, 7),
            ],
            walls: new Set(),
        };
        const { container } = await act(async () => renderMap());

        await act(async () => { fireEvent.contextMenu(playerCircles(container)[0]); });
        expect(screen.getByText('Remove from Map')).toBeInTheDocument();

        await act(async () => { fireEvent.click(screen.getByText('Remove from Map')); });

        // Exact remaining players — only the right-clicked one is gone
        expect(mockState.mapData.players.map(p => p.id)).toEqual(['player2', 'player3']);
        expect(menus(container)).toHaveLength(0);
        expect(playerCircles(container)).toHaveLength(2);
    });
});
