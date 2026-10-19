// @maintained-by-ai
// ─── Lane: Map container composite event-handler ROUTING (dispatch bytes) ───
// OWNED here: Map.jsx's SVG + toolbar dispatchers. Click tool button →
// active-tool byte → EXACTLY ONE tool handler receives the pointerdown with
// the container's live state args once, the other two tool handlers zero;
// unconditional spell/ruler fan-out; pointermove/up/leave/wheel fan-out
// with exact bytes; native contextmenu/dragover preventDefault + drop
// wiring (#906 owns drop payload consumption); SSE combined-handler
// routing byte (:419-cited face — preserved verbatim: exact-payload
// mapSSE + spellOverlaySSE dispatch).
//
// Tool STATE MACHINES cited to owners (internals never re-driven here):
//   ruler #911 · select/move #912 · spell #913 · walls #916 · zoomPan #917
//   drag #905/#910 · drops #906 · mutations #909
//   item menu open/close #920 · player menu close #921 (canvas-click close
//   wiring lives there — not duplicated here)
//   toolbar unit dispatch/tool-active classes → MapToolbar.test.jsx
//   null mapData, SVG defs, outdoor HexMap, 3D toggle, fog roles → Map.test.jsx
//   ItemsPanel + SpellOverlayControls palettes/units → their own tests
//
// Old→new: 16 tests → 12 blocks / 15 cases.
//   :292/:303/:319 → T1 tool matrix (none/paint/erase/select rows, exact
//     args + honest-zero + unconditional spell/ruler pass-through)
//   :332 → T2 (guard now driven on the busiest tool, select; ruler+spell
//     pass-through added so the guard is scoped to the tool trio)
//   :344 → T3 (exact args pinned; wheel→handleWheel byte ADDED)
//   :360 → T4 (exact args pinned; flushSave-on-up ADDED — autosave seam,
//     unasserted app-wide before)
//   :376 → T5 (+selectPointerUp/flushSave on leave ADDED; move/up-only
//     handlers now verified honest-zero)
//   :386/:394/:402 → T6 consolidated
//   :411/:419/:420 → T7 (:419-cited mapSSE byte preserved, +once-card)
//   :440/:449 → T9 (one test: on resets+clears spell mode — setSpellMode
//     (null) wiring previously untested; off does not reset)
//   :459/:471 → T10 (variant byte observable via panel palette labels)
//   :500/:508 → T11 (honest-zero drives precondition, then exact rect
//     bytes 80/120/120/120)

import { render, fireEvent, act, screen, createEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map from './Map.jsx';

import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';
import { DEFAULTS } from '../../models/SpellOverlay.js';

const mockLoadMonsters = vi.fn(() => Promise.resolve([]));

// Stable identities: hoisted so dispatch assertions can pin WHICH collaborator
// the container wires (exact function bytes, not just "a function").
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

const pointer = (type) => expect.objectContaining({ type });
const DOWN = pointer('pointerdown');
const MOVE = pointer('pointermove');
const UP = pointer('pointerup');

describe('Map container - tool routing on pointerdown', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        clearRuntimeState('campaign'); // viewingMonster lives on the 'campaign' store
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

    // TOOL → pointerdown matrix: click palette/tool button sets the active-tool
    // byte; ONE tool handler gets the event with the container's live args,
    // the other two tool handlers stay honest-zero. Spell and ruler lanes
    // fan out unconditionally before the tool selector (Map.jsx:408).
    // Args are resolved against live mockState at test time (beforeEach
    // recreates placedItems/mapData between tests).
    it.each([
        { tool: null, routed: 'panStart', zero: ['gridPointerDown', 'selectPointerDown'] },
        { tool: /paint/i, routed: 'gridPointerDown', zero: ['panStart', 'selectPointerDown'] },
        { tool: /erase/i, routed: 'gridPointerDown', zero: ['panStart', 'selectPointerDown'] },
        { tool: /select/i, routed: 'selectPointerDown', zero: ['panStart', 'gridPointerDown'] },
    ])('tool $tool routes pointerdown to $routed once, other tool handlers zero', async ({ tool, routed, zero }) => {
        const { container } = await act(async () => renderMap());
        if (tool) {
            fireEvent.click(screen.getByRole('button', { name: tool }));
        }
        const svg = container.querySelector('svg');
        fireEvent.pointerDown(svg, { button: 0 });

        const args = {
            panStart: [DOWN, 0, 0],
            gridPointerDown: [DOWN, handlers.setMapData],
            selectPointerDown: [DOWN, mockState.placedItems, mockState.mapData],
        }[routed];
        expect(handlers[routed]).toHaveBeenCalledTimes(1);
        expect(handlers[routed]).toHaveBeenCalledWith(...args);
        for (const z of zero) {
            expect(handlers[z]).not.toHaveBeenCalled();
        }
        // Unconditional lanes: spell and ruler always receive the event
        expect(handlers.spellPointerDown).toHaveBeenCalledTimes(1);
        expect(handlers.spellPointerDown).toHaveBeenCalledWith(DOWN, null, mockState.overlays);
        expect(handlers.rulerPointerDown).toHaveBeenCalledTimes(1);
        expect(handlers.rulerPointerDown).toHaveBeenCalledWith(DOWN, expect.objectContaining({
            rulerMode: false, rulerStart: null, rulerEnd: null,
            getGridFromEvent: handlers.getGrid,
        }));
    });

    it('ruler mode on rides ruler state bytes in the pointerdown payload (tool lanes unchanged)', async () => {
        mockState.rulerMode = true;
        const { container } = await act(async () => renderMap());
        fireEvent.pointerDown(container.querySelector('svg'), { button: 0 });

        expect(handlers.rulerPointerDown).toHaveBeenCalledWith(DOWN, expect.objectContaining({
            rulerMode: true, rulerStart: null, rulerEnd: null,
        }));
        expect(handlers.panStart).toHaveBeenCalledTimes(1);
        expect(handlers.panStart).toHaveBeenCalledWith(DOWN, 0, 0);
        expect(handlers.gridPointerDown).not.toHaveBeenCalled();
        expect(handlers.selectPointerDown).not.toHaveBeenCalled();
    });

    it('active spell drag suppresses ALL tool routing while spell/ruler lanes pass through', async () => {
        mockState.spellDragActiveRef.current = true;
        const { container } = await act(async () => renderMap());
        fireEvent.click(screen.getByRole('button', { name: /select/i }));
        fireEvent.pointerDown(container.querySelector('svg'), { button: 0 });

        expect(handlers.panStart).not.toHaveBeenCalled();
        expect(handlers.gridPointerDown).not.toHaveBeenCalled();
        expect(handlers.selectPointerDown).not.toHaveBeenCalled();
        expect(handlers.spellPointerDown).toHaveBeenCalledTimes(1);
        expect(handlers.rulerPointerDown).toHaveBeenCalledTimes(1);
    });

    it('pointermove fans out to every tool handler with live container args; wheel routes to zoom', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        fireEvent.pointerMove(svg, { button: 0 });

        expect(handlers.playerPointerMove).toHaveBeenCalledWith(MOVE);
        expect(handlers.itemPointerMove).toHaveBeenCalledWith(MOVE);
        expect(handlers.gridPointerMove).toHaveBeenCalledWith(MOVE, handlers.setMapData, false, 'none');
        expect(handlers.selectPointerMove).toHaveBeenCalledWith(MOVE);
        expect(handlers.panMove).toHaveBeenCalledWith(MOVE);
        expect(handlers.spellPointerMove).toHaveBeenCalledWith(MOVE, null);
        expect(handlers.spellDragMove).toHaveBeenCalledWith(
            MOVE, null, null, mockState.overlays, handlers.getGrid, handlers.clientToSVG, handlers.updateOverlay);
        expect(handlers.rulerPointerMove).toHaveBeenCalledWith(MOVE, false, null, null, handlers.getGrid);

        fireEvent.wheel(svg, { deltaY: -100 });
        expect(handlers.wheel).toHaveBeenCalledTimes(1);
    });

    it('pointerup flushes the save and ends every tool lane with live args', async () => {
        const { container } = await act(async () => renderMap());
        fireEvent.pointerUp(container.querySelector('svg'), { button: 0 });

        expect(handlers.flushSave).toHaveBeenCalledTimes(1);
        expect(handlers.playerPointerUp).toHaveBeenCalledWith(UP);
        expect(handlers.itemPointerUp).toHaveBeenCalledWith(UP);
        expect(handlers.gridPointerUp).toHaveBeenCalledWith(UP);
        expect(handlers.selectPointerUp).toHaveBeenCalledWith(UP, mockState.placedItems, mockState.mapData, handlers.setMapData, handlers.setPlacedItems);
        expect(handlers.panEnd).toHaveBeenCalledWith(UP);
        expect(handlers.spellPointerUp).toHaveBeenCalledWith(UP, null, null, handlers.addOverlay, DEFAULTS.sphere);
        expect(handlers.spellDragEnd).toHaveBeenCalledWith(
            UP, null, null, mockState.overlays, handlers.getGrid, handlers.clientToSVG, handlers.updateOverlayImmediate, expect.any(Object));
        expect(handlers.rulerPointerUp).toHaveBeenCalledWith(UP, false, expect.any(Object));
    });

    it('pointerleave flushes and ends select/wall painting only - never fires token-drop or pan end', async () => {
        const { container } = await act(async () => renderMap());
        fireEvent.pointerLeave(container.querySelector('svg'));

        expect(handlers.flushSave).toHaveBeenCalledTimes(1);
        expect(handlers.itemPointerLeave).toHaveBeenCalledTimes(1);
        expect(handlers.gridPointerLeave).toHaveBeenCalledTimes(1);
        // Leaving the canvas is a select-cancel with the same live args as pointerup
        expect(handlers.selectPointerUp).toHaveBeenCalledWith(expect.any(Object), mockState.placedItems, mockState.mapData, handlers.setMapData, handlers.setPlacedItems);
        expect(handlers.playerPointerUp).not.toHaveBeenCalled();
        expect(handlers.itemPointerUp).not.toHaveBeenCalled();
        expect(handlers.panEnd).not.toHaveBeenCalled();
        expect(handlers.rulerPointerUp).not.toHaveBeenCalled();
    });

    it('suppresses native context menu and drag-over defaults and routes drop to useMapDrops', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');

        const contextMenuEvent = createEvent.contextMenu(svg);
        fireEvent(svg, contextMenuEvent);
        expect(contextMenuEvent.defaultPrevented).toBe(true);

        const dragOverEvent = createEvent.dragOver(svg);
        fireEvent(svg, dragOverEvent);
        expect(dragOverEvent.defaultPrevented).toBe(true);

        fireEvent.drop(svg);
        expect(handlers.drop).toHaveBeenCalledTimes(1);
        expect(handlers.drop).toHaveBeenCalledWith(expect.objectContaining({ type: 'drop' }));
    });

    it('combined SSE handler dispatches the exact payload to map and spell-overlay handlers once each', async () => {
        await act(async () => renderMap());
        const eventSource = MockEventSource.instances[0];
        expect(eventSource).toBeTruthy();
        const payload = { type: 'map-data', value: { players: [] } };
        await act(async () => {
            eventSource.onmessage({ data: JSON.stringify(payload) });
        });
        expect(handlers.mapSSE).toHaveBeenCalledTimes(1);
        expect(handlers.mapSSE).toHaveBeenCalledWith(payload);
        expect(handlers.spellOverlaySSE).toHaveBeenCalledTimes(1);
        expect(handlers.spellOverlaySSE).toHaveBeenCalledWith(payload);
    });
});

describe('Map container - toolbar routing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        Object.assign(mockState, {
            mapData: createMockMapData(),
            placedItems: [],
            rulerMode: false,
            overlays: [],
            spellDragActiveRef: { current: false },
        });
        mockState.selectStart.current = null;
        mockState.moveStartGrid.current = null;
        mockLoadMonsters.mockReset();
        mockLoadMonsters.mockImplementation(() => Promise.resolve([]));
    });

    it('Spell button arms pointerdown with spellMode sphere, second click disarms to null', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');

        fireEvent.click(screen.getByRole('button', { name: 'Spell' }));
        fireEvent.pointerDown(svg, { button: 0 });
        expect(handlers.spellPointerDown).toHaveBeenLastCalledWith(DOWN, 'sphere', mockState.overlays);
        // Ruler and pan lanes stay unarmed by the spell toggle
        expect(handlers.setRulerMode).not.toHaveBeenCalled();
        expect(handlers.panStart).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByRole('button', { name: 'Spell' }));
        fireEvent.pointerDown(svg, { button: 0 });
        expect(handlers.spellPointerDown).toHaveBeenLastCalledWith(DOWN, null, mockState.overlays);
        expect(handlers.spellPointerDown).toHaveBeenCalledTimes(2);
    });

    it('Ruler toggle on resets the ruler and clears spell mode; off disables without reset', async () => {
        const { rerender } = await act(async () => renderMap());

        // Arm spell, then turn ruler on: spell mode clears (controls unmount)
        fireEvent.click(screen.getByRole('button', { name: 'Spell' }));
        expect(document.querySelector('.spell-overlay-controls')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /ruler/i }));
        expect(handlers.setRulerMode).toHaveBeenCalledWith(true);
        expect(handlers.resetRuler).toHaveBeenCalledTimes(1);
        expect(document.querySelector('.spell-overlay-controls')).not.toBeInTheDocument();

        // Toggle off (rulerMode true in state): set false, no reset
        mockState.rulerMode = true;
        rerender(<Map campaignName="test-campaign" characters={[]} isLocalhost
            mapName="test-map.json" onBack={vi.fn()} onEncounterCreated={vi.fn()}
            onPoiEntered={vi.fn()} />);
        handlers.resetRuler.mockClear();
        handlers.setRulerMode.mockClear();
        fireEvent.click(screen.getByRole('button', { name: /ruler/i }));
        expect(handlers.setRulerMode).toHaveBeenCalledWith(false);
        expect(handlers.resetRuler).not.toHaveBeenCalled();
    });

    it('Items button mounts panel with indoor palette; close unmounts; parentHex map opens outdoor palette', async () => {
        const { container, rerender } = await act(async () => renderMap());

        fireEvent.click(screen.getByRole('button', { name: /items/i }));
        let panel = container.querySelector('.items-panel');
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveTextContent('Treasure Chest'); // indoor byte
        fireEvent.click(panel.querySelector('.items-panel-close'));
        expect(container.querySelector('.items-panel')).not.toBeInTheDocument();

        mockState.mapData = createMockMapData({ parentHex: true });
        rerender(<Map campaignName="test-campaign" characters={[]} isLocalhost
            mapName="test-map.json" onBack={vi.fn()} onEncounterCreated={vi.fn()}
            onPoiEntered={vi.fn()} />);
        fireEvent.click(screen.getByRole('button', { name: /items/i }));
        panel = container.querySelector('.items-panel');
        expect(panel).toBeInTheDocument();
        expect(panel).toHaveTextContent('Tree'); // outdoor byte
        expect(panel).not.toHaveTextContent('Treasure Chest');
    });
});

describe('Map container - selection preview bytes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        Object.assign(mockState, {
            mapData: createMockMapData(),
            placedItems: [],
            selectedWalls: new Set(),
            selectedItems: new Set(),
            selectionRect: null,
            moveOffset: null,
            spellDragActiveRef: { current: false },
        });
        mockState.selectStart.current = null;
        mockState.moveStartGrid.current = null;
        mockLoadMonsters.mockReset();
        mockLoadMonsters.mockImplementation(() => Promise.resolve([]));
    });

    it('selection preview hidden until selectStart is live, then exact rect bytes (CELL_SIZE math)', async () => {
        // Honest zero: rect data present but the selectStart flag is off
        mockState.selectionRect = { minX: 2, maxX: 4, minY: 3, maxY: 5 };
        const { container, rerender } = await act(async () => renderMap());
        expect(container.querySelector('rect.selection-preview')).toBeFalsy();

        mockState.selectStart.current = { gridX: 2, gridY: 3 };
        rerender(<Map campaignName="test-campaign" characters={[]} isLocalhost
            mapName="test-map.json" onBack={vi.fn()} onEncounterCreated={vi.fn()}
            onPoiEntered={vi.fn()} />);
        const preview = container.querySelector('rect.selection-preview');
        expect(preview).toBeTruthy();
        expect(preview.getAttribute('x')).toBe('80');   // minX 2 * 40
        expect(preview.getAttribute('y')).toBe('120');  // minY 3 * 40
        expect(preview.getAttribute('width')).toBe('120');  // (4-2+1) * 40
        expect(preview.getAttribute('height')).toBe('120'); // (5-3+1) * 40
    });
});
