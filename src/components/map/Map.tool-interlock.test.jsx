// @maintained-by-ai
// ─── Lane: Map tool MODE INTERLOCK (ruler ↔ spell ↔ paint/erase/select) ───
// Pins the bidirectional exclusivity that the ruler-not-interlocked bug broke:
//   face (a): arming Spell while the ruler was armed left the wand visually
//     armed but every canvas click was swallowed by useSpellHandlers'
//     `if (rulerMode) return;` gate. MapToolbar.toggleSpellMode now dispatches
//     setRulerMode(false) when arming from a ruler-armed state.
//   face (b): arming Ruler while Paint was armed left BOTH armed and one
//     canvas click both placed a ruler point AND committed wall edits to the
//     map file. handleSetRulerMode(true) now dispatches setTool('none')
//     (mirroring its existing setSpellMode(null)); the toolbar tool buttons
//     dispatch setRulerMode(false) when arming from a ruler-armed state; and
//     handleToolPanStart back-stops: while rulerMode is armed the paint/
//     erase/select lanes never receive pointerdown (pan still does).
//
// Routing dispatch bytes → Map-tool-handlers.test.jsx · ruler state machine
// → useRuler.test.js · spell placement → useSpellHandlers.test.js · toolbar
// unit census → MapToolbar.test.jsx. Scaffold mirrors Map-tool-handlers.
import { render, fireEvent, act, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map from './Map.jsx';

import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';

const mockLoadMonsters = vi.fn(() => Promise.resolve([]));

const handlers = {
    setMapData: vi.fn(),
    setPlacedItems: vi.fn(),
    setNpcImages: vi.fn(),
    flushSave: vi.fn(),
    gridPointerDown: vi.fn(),
    gridPointerMove: vi.fn(),
    gridPointerUp: vi.fn(),
    gridPointerLeave: vi.fn(),
    selectPointerDown: vi.fn(),
    selectPointerMove: vi.fn(),
    selectPointerUp: vi.fn(),
    panStart: vi.fn(),
    panMove: vi.fn(),
    panEnd: vi.fn(),
    wheel: vi.fn(),
    clientToSVG: vi.fn(),
    getGrid: vi.fn(() => ({ gridX: 5, gridY: 5 })),
    resetRuler: vi.fn(),
    setRulerMode: vi.fn(),
    rulerPointerDown: vi.fn(),
    rulerPointerMove: vi.fn(),
    rulerPointerUp: vi.fn(),
    spellPointerDown: vi.fn(),
    spellPointerMove: vi.fn(),
    spellPointerUp: vi.fn(),
    spellDragMove: vi.fn(),
    spellDragEnd: vi.fn(),
    addOverlay: vi.fn(),
    updateOverlay: vi.fn(),
    updateOverlayImmediate: vi.fn(),
    playerPointerMove: vi.fn(),
    playerPointerUp: vi.fn(),
    itemPointerMove: vi.fn(),
    itemPointerUp: vi.fn(),
    itemPointerLeave: vi.fn(),
    mapSSE: vi.fn(),
    spellOverlaySSE: vi.fn(),
    drop: vi.fn(),
};

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
    spellDragActiveRef: { current: false },
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
        setMapData: handlers.setMapData,
        placedItems: mockState.placedItems,
        setPlacedItems: handlers.setPlacedItems,
        flushSave: handlers.flushSave,
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
        getGridFromEvent: handlers.getGrid,
        panning: mockState.panning,
        handlePanStart: handlers.panStart,
        handlePanMove: handlers.panMove,
        handlePanEnd: handlers.panEnd,
        handleWheel: handlers.wheel,
        clientToSVG: handlers.clientToSVG,
    })),
}));

vi.mock('./hooks/useWallDrawing.js', () => ({
    default: vi.fn(() => ({
        painting: mockState.painting,
        handleGridPointerDown: handlers.gridPointerDown,
        handleGridPointerMove: handlers.gridPointerMove,
        handleGridPointerUp: handlers.gridPointerUp,
        handleGridPointerLeave: handlers.gridPointerLeave,
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
        placedItemsRef: { current: mockState.placedItems },
        mapDataRef: { current: mockState.mapData },
        handleSelectPointerDown: handlers.selectPointerDown,
        handleSelectPointerMove: handlers.selectPointerMove,
        handleSelectPointerUp: handlers.selectPointerUp,
    })),
}));

vi.mock('./hooks/useRuler.js', () => ({
    default: vi.fn(() => ({
        rulerMode: mockState.rulerMode,
        setRulerMode: handlers.setRulerMode,
        rulerStart: mockState.rulerStart,
        rulerEnd: mockState.rulerEnd,
        rulerPreview: mockState.rulerPreview,
        resetRuler: handlers.resetRuler,
        handleRulerPointerDown: handlers.rulerPointerDown,
        handleRulerPointerMove: handlers.rulerPointerMove,
        handleRulerPointerUp: handlers.rulerPointerUp,
    })),
}));

vi.mock('./hooks/useSpellOverlay.js', () => ({
    default: vi.fn(() => ({
        overlays: mockState.overlays,
        addOverlay: handlers.addOverlay,
        updateOverlay: handlers.updateOverlay,
        updateOverlayImmediate: handlers.updateOverlayImmediate,
        removeOverlay: vi.fn(),
        clearOverlays: vi.fn(),
        handleSSEEvent: handlers.spellOverlaySSE,
    })),
}));

vi.mock('./hooks/useSpellHandlers.js', () => ({
    default: vi.fn(() => ({
        spellDraft: mockState.spellDraft,
        dragOverlay: mockState.dragOverlay,
        rotateOverlay: mockState.rotateOverlay,
        spellDragActiveRef: mockState.spellDragActiveRef,
        handleSpellPointerDown: handlers.spellPointerDown,
        handleSpellPointerMove: handlers.spellPointerMove,
        handleSpellPointerUp: handlers.spellPointerUp,
        handleSpellDragMove: handlers.spellDragMove,
        handleSpellDragEnd: handlers.spellDragEnd,
    })),
}));

vi.mock('./hooks/usePlayerDragging.js', () => ({
    default: vi.fn(() => ({
        dragging: mockState.dragging,
        handlePointerDown: vi.fn(),
        handlePointerMove: handlers.playerPointerMove,
        handlePointerUp: handlers.playerPointerUp,
    })),
}));

vi.mock('./hooks/useItemDragging.js', () => ({
    default: vi.fn(() => ({
        itemDragging: mockState.itemDragging,
        handleItemPointerDown: vi.fn(),
        handleItemPointerMove: handlers.itemPointerMove,
        handleItemPointerUp: handlers.itemPointerUp,
        handleItemPointerLeave: handlers.itemPointerLeave,
    })),
}));

vi.mock('./hooks/useNpcImageCache.js', () => ({
    default: vi.fn(() => ({
        npcImages: mockState.npcImages,
        setNpcImages: handlers.setNpcImages,
    })),
}));

vi.mock('./hooks/useSSESync.js', () => ({
    default: vi.fn(() => ({ handleSSEEvent: handlers.mapSSE })),
}));

vi.mock('./hooks/useFogOfWar.js', () => ({
    default: vi.fn(() => ({ fog: new Set(), visible: new Set() })),
}));

vi.mock('./hooks/useMapDrops.js', () => ({
    default: vi.fn(() => ({ handleDrop: handlers.drop })),
}));

vi.mock('../hex-map/HexMap.jsx', () => ({ default: vi.fn(() => <div data-testid="hex-map" />) }));

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

const DOWN = expect.objectContaining({ type: 'pointerdown' });

describe('Map container - ruler/spell/paint mode interlock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        clearRuntimeState('campaign');
        MockEventSource.instances.length = 0;
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
            spellDragActiveRef: { current: false },
        });
        mockState.selectStart.current = null;
        mockState.moveStartGrid.current = null;
        mockLoadMonsters.mockReset();
        mockLoadMonsters.mockImplementation(() => Promise.resolve([]));
    });

    // Face (a): the wand was silently inert while the ruler stayed armed.
    it('arming Spell while the ruler is armed disarms the ruler and arms the wand', async () => {
        mockState.rulerMode = true;
        const { container } = await act(async () => renderMap());

        fireEvent.click(screen.getByRole('button', { name: 'Spell' }));
        // Ruler disarm is dispatched through the container's handleSetRulerMode
        expect(handlers.setRulerMode).toHaveBeenCalledWith(false);
        // The wand arms in the same click — next pointerdown carries the shape
        fireEvent.pointerDown(container.querySelector('svg'), { button: 0 });
        expect(handlers.spellPointerDown).toHaveBeenLastCalledWith(DOWN, 'sphere', mockState.overlays);
    });

    it('arming Spell with the ruler already disarmed dispatches no redundant ruler write', async () => {
        await act(async () => renderMap());
        fireEvent.click(screen.getByRole('button', { name: 'Spell' }));
        expect(handlers.setRulerMode).not.toHaveBeenCalled();
    });

    // Face (b): a ruler-armed click must never reach the wall painter.
    it('arming Ruler disarms Paint: dual-arm ends, canvas click routes pan, never grid paint', async () => {
        const { container } = await act(async () => renderMap());
        fireEvent.click(screen.getByRole('button', { name: 'Paint' }));
        expect(screen.getByRole('button', { name: 'Paint' })).toHaveClass('active');

        fireEvent.click(screen.getByRole('button', { name: 'Ruler' }));
        expect(handlers.setRulerMode).toHaveBeenCalledWith(true);
        expect(handlers.resetRuler).toHaveBeenCalledTimes(1);
        // Paint byte clears — exactly one armed tool remains
        expect(screen.getByRole('button', { name: 'Paint' })).not.toHaveClass('active');

        fireEvent.pointerDown(container.querySelector('svg'), { button: 0 });
        expect(handlers.gridPointerDown).not.toHaveBeenCalled();
        expect(handlers.selectPointerDown).not.toHaveBeenCalled();
        expect(handlers.panStart).toHaveBeenCalledTimes(1);
        // Ruler lane still receives its measurement gesture
        expect(handlers.rulerPointerDown).toHaveBeenCalledTimes(1);
    });

    it('arming Paint while the ruler is armed disarms the ruler, and the pointerdown back-stop never paints while rulerMode stays armed', async () => {
        mockState.rulerMode = true; // mock state pins rulerMode armed regardless of dispatch
        const { container } = await act(async () => renderMap());

        fireEvent.click(screen.getByRole('button', { name: 'Paint' }));
        // Toolbar interlock dispatches the ruler disarm...
        expect(handlers.setRulerMode).toHaveBeenCalledWith(false);
        // ...and while rulerMode is armed (the back-stop lane, state pinned on
        // the mock) no pointerdown may reach the wall painter — the map file
        // must never gain walls from a measurement state.
        fireEvent.pointerDown(container.querySelector('svg'), { button: 0 });
        expect(handlers.gridPointerDown).not.toHaveBeenCalled();
        expect(handlers.panStart).toHaveBeenCalledTimes(1);
    });

    it('arming Ruler while the wand is armed clears the wand (existing edge stays intact)', async () => {
        const { container } = await act(async () => renderMap());
        fireEvent.click(screen.getByRole('button', { name: 'Spell' }));
        expect(document.querySelector('.spell-overlay-controls')).toBeInTheDocument();

        fireEvent.click(screen.getByRole('button', { name: 'Ruler' }));
        expect(handlers.setRulerMode).toHaveBeenCalledWith(true);
        expect(handlers.resetRuler).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.spell-overlay-controls')).not.toBeInTheDocument();

        // Pointerdown afterwards carries a disarmed wand
        fireEvent.pointerDown(container.querySelector('svg'), { button: 0 });
        expect(handlers.spellPointerDown).toHaveBeenLastCalledWith(DOWN, null, mockState.overlays);
    });

    it('paint and erase keep painting when armed alone (interlock is not a suppression)', async () => {
        const { container } = await act(async () => renderMap());
        fireEvent.click(screen.getByRole('button', { name: 'Paint' }));
        fireEvent.pointerDown(container.querySelector('svg'), { button: 0 });
        expect(handlers.gridPointerDown).toHaveBeenCalledTimes(1);
        expect(handlers.gridPointerDown).toHaveBeenCalledWith(DOWN, handlers.setMapData);
        expect(handlers.panStart).not.toHaveBeenCalled();
    });
});
