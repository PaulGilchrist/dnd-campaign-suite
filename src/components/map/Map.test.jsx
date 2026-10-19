// @maintained-by-ai
// ─── Lane: Map CONTAINER — availability + composition seam ──────────────────
// OWNED here (only the container can prove):
//   • null-mapData honest empty container (loading/unresolved map)
//   • SVG defs palette availability — CITED OWNER app-wide as "Map
//     availability" by every decor lane (#890-#902: "availability →
//     Map.test.jsx"). Preserved verbatim; exact ordered equality.
//   • mount census: which layers mount per state + clean unmount
//   • outdoor dispatch: HexMap with props passed down, indoor stack absent
//   • 2D/3D view-mode switch carrying live overlays (button unit → MapToolbar)
//   • fog role wiring through the mounted SVG — mount-smoke only; exact
//     cell bytes owned by FogOverlay.test.jsx (#901)
//   • mapName change → loader reload trigger byte (fetch/#907 useMapLoader)
//   • exploration-memory persistence: Map's own mergeNewlyRevealed effect
//     writes revealed once and is idempotent (fog math → useFogOfWar #904)
//
// Cited to owners (never re-driven here):
//   tool routing + combined-SSE fan-out bytes .... Map-tool-handlers #922
//   toolbar unit dispatch / 3D button ............. MapToolbar.test.jsx
//   context menus, rename, view stats ............. Map-context-menus #920/921
//   SSE connection primitive / close lifecycle .... subscriber #915 · sseClient
//   items panel palettes ............................ ItemsPanel #919
//   hook behavior (zoom/walls/select/ruler/spell/drag/drops) #903-#917
//
// Old→new: 10 tests → 8.
//   :304/:309 null faces → T1 (merged, rec #922)
//   :321 defs registry → T3 (STRENGTHENED: exact ordered equality)
//   :346/:353/:392 outdoor faces → T4 (props-down + back byte added)
//   :366 3D button present → folded into T2 census + T5 toggle
//   :371/:381 3D toggle + overlays → T5 (one switch, overlays pinned)
//   :410/:417 fog role faces → T6 (one mount-smoke, rec #901)
//   ADDED: T2 census/unmount · T7 reload trigger · T8 revealed persistence
// CUT: local SSE dispatch assertions → Map-tool-handlers :480 covers the
// combined-handler once each; connection close lifecycle → subscriber #915.

import { render, act, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map from './Map.jsx';
import useMapLoader from './hooks/useMapLoader.js';
import useFogOfWar from './hooks/useFogOfWar.js';
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
    viewingMonster: null,
    itemsPanelOpen: false,
    renamePopover: null,
    spellMode: null,
    shapeParams: null,
    spellDragActiveRef: { current: false },
};

const createMockSetMapData = vi.fn();
const createMockSetPlacedItems = vi.fn();

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: () => mockLoadMonsters(),
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
    default: vi.fn(() => ({
        mapData: mockState.mapData,
        setMapData: createMockSetMapData,
        placedItems: mockState.placedItems,
        setPlacedItems: createMockSetPlacedItems,
        flushSave: vi.fn(),
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
        spellDragActiveRef: mockState.spellDragActiveRef,
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
        setNpcImages: vi.fn(),
    })),
}));

vi.mock('./hooks/useSSESync.js', () => ({
    default: vi.fn(() => ({
        handleSSEEvent: vi.fn(),
    })),
}));

vi.mock('./hooks/useFogOfWar.js', () => ({
    default: vi.fn(() => ({ fog: new Set(), visible: new Set() })),
}));

vi.mock('./hooks/useMapDrops.js', () => ({
    default: vi.fn(() => ({
        handleDrop: vi.fn(),
    })),
}));

vi.mock('../hex-map/HexMap.jsx', () => ({
    default: ({ campaignName, mapName, onBack }) => (
        <div data-testid="hex-map">{`${campaignName}|${mapName}`}
            <button onClick={onBack}>hex-back</button>
        </div>
    ),
}));

vi.mock('./Map3D/Map3D.jsx', () => ({
    default: ({ onExit, overlays }) => (
        <div data-testid="map3d">
            <span data-testid="map3d-overlays">{overlays ? overlays.length : 0}</span>
            <button data-testid="map3d-exit" onClick={onExit}>2D</button>
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
        viewingMonster: null,
        itemsPanelOpen: false,
        renamePopover: null,
        spellMode: null,
        shapeParams: null,
        spellDragActiveRef: { current: false },
    });
    mockState.selectStart.current = null;
    mockState.moveStartGrid.current = null;
    vi.mocked(useFogOfWar).mockReturnValue({ fog: new Set(), visible: new Set() });
    clearRuntimeState('test-campaign');
};

beforeEach(() => {
    vi.clearAllMocks();
    resetState();
});

describe('Map container — availability & composition', () => {
    it('T1: renders nothing while mapData is null', async () => {
        mockState.mapData = null;
        const { container } = await act(async () => renderMap());
        expect(container.firstChild).toBeNull();
    });

    it('T2: mounts the full GM 2D stack (toolbar, grid, token, items, no fog cells) and unmounts cleanly', async () => {
        mockState.mapData = createMockMapData({
            players: [{ id: 'p1', name: 'Thorin', gridX: 2, gridY: 3 }],
        });
        mockState.placedItems = [{ id: 'i1', type: 'barrel', gridX: 1, gridY: 1, visible: true }];
        const { container, unmount } = await act(async () => renderMap());

        expect(container.querySelector('svg.grid-svg')).toBeTruthy();
        expect(screen.getByTitle('View map in 3D')).toBeInTheDocument();
        expect(container.querySelector('.creature-group')).toBeTruthy();
        expect(container.querySelector('use[href="#barrel"]')).toBeTruthy();
        expect(container.querySelector('.fog-cell')).toBeNull();
        expect(container.querySelector('.items-panel')).toBeNull();

        unmount(); // clean teardown; SSE close lifecycle → subscriber #915 / sseClient
    });

    it('T3: makes every decor palette def available to <use> references (cited owner: availability, decor lanes #890-#902)', async () => {
        const { container } = await act(async () => renderMap());
        const defs = container.querySelector('svg defs');
        expect(defs).toBeTruthy();
        const groupIds = Array.from(defs.children).map(g => g.id);
        expect(groupIds).toEqual([
            'barrel', 'table', 'bed', 'firepit', 'door', 'secretDoor', 'trap',
            'pillar', 'stairs', 'altar', 'arrowSlitWall', 'bookshelf', 'chair',
            'chest', 'crate', 'fountain', 'skeleton', 'statue', 'torch', 'web',
            'tree', 'boulder', 'bush',
        ]);
    });

    it('T4: dispatches outdoor maps to HexMap with campaign/map props down; indoor stack absent', async () => {
        mockState.mapData = createMockMapData({ type: 'outdoor' });
        const onBack = vi.fn();
        const { container } = await act(async () => renderMap({ onBack }));

        const hex = container.querySelector('[data-testid="hex-map"]');
        expect(hex).toHaveTextContent('test-campaign|test-map.json');
        expect(container.querySelector('.map')).toBeNull();
        expect(container.querySelector('.grid-svg')).toBeNull();
        expect(screen.queryByTitle('View map in 3D')).not.toBeInTheDocument();

        fireEvent.click(hex.querySelector('button'));
        expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('T5: switches to 3D carrying live overlays, and back to 2D via exit', async () => {
        mockState.overlays = [{
            id: 'o1', shape: 'sphere', startGridX: 1, startGridY: 1, angle: 0,
            radiusFt: 20, coneAngle: 0, widthFt: 0, distanceFt: 0, sizeFt: 0,
            color: 'rgba(255,80,60,0.35)',
        }];
        await act(async () => renderMap());

        fireEvent.click(screen.getByTitle('View map in 3D'));
        expect(screen.getByTestId('map3d')).toBeInTheDocument();
        expect(screen.getByTestId('map3d-overlays')).toHaveTextContent('1');
        expect(screen.queryByTitle('View map in 3D')).not.toBeInTheDocument();

        fireEvent.click(screen.getByTestId('map3d-exit'));
        expect(screen.queryByTestId('map3d')).not.toBeInTheDocument();
        expect(screen.getByTitle('View map in 3D')).toBeInTheDocument();
    });

    it('T6: wires fog role through the mounted SVG — GM sees translucent cells, network client opaque (cell bytes → FogOverlay #901)', async () => {
        vi.mocked(useFogOfWar).mockReturnValue({ fog: new Set(['0,0']), visible: new Set() });

        const gm = await act(async () => renderMap());
        expect(gm.container.querySelector('.fog-cell')).toBeTruthy();
        expect(gm.container.querySelector('.fog-cell-player')).toBeNull();
        gm.unmount();

        const player = await act(async () => renderMap({ isLocalhost: false }));
        expect(player.container.querySelector('.fog-cell-player')).toBeTruthy();
        expect(player.container.querySelector('.fog-cell')).toBeNull();
    });

    it('T7: passing a new mapName re-triggers the loader with that name (fetch → useMapLoader #907)', async () => {
        const { rerender } = await act(async () => renderMap());
        rerender(<Map campaignName="test-campaign" characters={[]} isLocalhost
            mapName="other-map.json" onBack={vi.fn()} onEncounterCreated={vi.fn()}
            onPoiEntered={vi.fn()} />);

        expect(vi.mocked(useMapLoader).mock.calls.at(-1)[0]).toMatchObject({
            mapName: 'other-map.json',
        });
    });

    it('T8: newly visible cells persist once into mapData.revealed; already-revealed writes nothing', async () => {
        vi.mocked(useFogOfWar).mockReturnValue({
            fog: new Set(), visible: new Set(['0,0', '1,1']),
        });
        const first = await act(async () => renderMap());
        expect(createMockSetMapData).toHaveBeenCalledTimes(1);
        expect(createMockSetMapData.mock.calls[0][0]({ players: [] }))
            .toEqual({ players: [], revealed: ['0,0', '1,1'] });
        first.unmount();

        mockState.mapData = createMockMapData({ revealed: ['0,0', '1,1'] });
        createMockSetMapData.mockClear();
        await act(async () => renderMap());
        expect(createMockSetMapData).not.toHaveBeenCalled();
    });
});
