// @improved-by-ai
// @cleaned-by-ai
import { render, fireEvent, act, screen, createEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Map from './Map.jsx';

import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';

const mockLoadMonsters = vi.fn(() => Promise.resolve([]));

const handlers = {
    setMapData: vi.fn(),
    setPlacedItems: vi.fn(),
    setNpcImages: vi.fn(),
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

vi.mock('./hooks/useMapLoader.js', () => ({
    default: vi.fn(() => ({
        mapData: mockState.mapData,
        setMapData: handlers.setMapData,
        placedItems: mockState.placedItems,
        setPlacedItems: handlers.setPlacedItems,
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
        handlePanStart: handlers.panStart,
        handlePanMove: handlers.panMove,
        handlePanEnd: handlers.panEnd,
        handleWheel: vi.fn(),
        clientToSVG: vi.fn(),
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
        moveOffsetRef: { current: null },
        selectionRectRef: { current: null },
        selectionBoundsRef: { current: null },
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
        addOverlay: vi.fn(),
        updateOverlay: vi.fn(),
        updateOverlayImmediate: vi.fn(),
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
    default: vi.fn(() => new Set()),
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

describe('Map - SVG pointer event routing', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
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

    it('routes pointer down to pan start when tool is none', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        await act(async () => {
            fireEvent.pointerDown(svg, { button: 0 });
        });
        expect(handlers.panStart).toHaveBeenCalled();
        expect(handlers.gridPointerDown).not.toHaveBeenCalled();
        expect(handlers.selectPointerDown).not.toHaveBeenCalled();
    });

    it.each([
        { tool: /paint/i, handler: 'gridPointerDown', notCalled: 'panStart' },
        { tool: /erase/i, handler: 'gridPointerDown', notCalled: 'panStart' },
    ])('routes pointer down to $handler for $tool tool', async ({ tool, handler, notCalled }) => {
        const { container } = await act(async () => renderMap());
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: tool }));
        });
        const svg = container.querySelector('svg');
        await act(async () => {
            fireEvent.pointerDown(svg, { button: 0 });
        });
        expect(handlers[handler]).toHaveBeenCalled();
        expect(handlers[notCalled]).not.toHaveBeenCalled();
    });

    it('routes pointer down to select pointer down for select tool', async () => {
        const { container } = await act(async () => renderMap());
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /select/i }));
        });
        const svg = container.querySelector('svg');
        await act(async () => {
            fireEvent.pointerDown(svg, { button: 0 });
        });
        expect(handlers.selectPointerDown).toHaveBeenCalled();
        expect(handlers.panStart).not.toHaveBeenCalled();
    });

    it('does not route tool actions when spell drag is active', async () => {
        mockState.spellDragActiveRef.current = true;
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        await act(async () => {
            fireEvent.pointerDown(svg, { button: 0 });
        });
        expect(handlers.panStart).not.toHaveBeenCalled();
        expect(handlers.gridPointerDown).not.toHaveBeenCalled();
        expect(handlers.selectPointerDown).not.toHaveBeenCalled();
    });

    it('calls pointer move handlers on SVG pointer move', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        await act(async () => {
            fireEvent.pointerMove(svg, { button: 0 });
        });
        expect(handlers.playerPointerMove).toHaveBeenCalled();
        expect(handlers.itemPointerMove).toHaveBeenCalled();
        expect(handlers.gridPointerMove).toHaveBeenCalled();
        expect(handlers.selectPointerMove).toHaveBeenCalled();
        expect(handlers.panMove).toHaveBeenCalled();
        expect(handlers.spellPointerMove).toHaveBeenCalled();
        expect(handlers.spellDragMove).toHaveBeenCalled();
        expect(handlers.rulerPointerMove).toHaveBeenCalled();
    });

    it('calls pointer up handlers on SVG pointer up', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        await act(async () => {
            fireEvent.pointerUp(svg, { button: 0 });
        });
        expect(handlers.playerPointerUp).toHaveBeenCalled();
        expect(handlers.itemPointerUp).toHaveBeenCalled();
        expect(handlers.gridPointerUp).toHaveBeenCalled();
        expect(handlers.selectPointerUp).toHaveBeenCalled();
        expect(handlers.panEnd).toHaveBeenCalled();
        expect(handlers.spellPointerUp).toHaveBeenCalled();
        expect(handlers.spellDragEnd).toHaveBeenCalled();
        expect(handlers.rulerPointerUp).toHaveBeenCalled();
    });

    it('calls leave handlers when pointer leaves SVG', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        await act(async () => {
            fireEvent.pointerLeave(svg);
        });
        expect(handlers.itemPointerLeave).toHaveBeenCalled();
        expect(handlers.gridPointerLeave).toHaveBeenCalled();
    });

    it('prevents default context menu on SVG', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        const contextMenuEvent = createEvent.contextMenu(svg);
        fireEvent(svg, contextMenuEvent);
        expect(contextMenuEvent.defaultPrevented).toBe(true);
    });

    it('prevents default drag over on SVG', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        const dragOverEvent = createEvent.dragOver(svg);
        fireEvent(svg, dragOverEvent);
        expect(dragOverEvent.defaultPrevented).toBe(true);
    });

    it('calls handleDrop on drop event', async () => {
        const { container } = await act(async () => renderMap());
        const svg = container.querySelector('svg');
        await act(async () => {
            fireEvent.drop(svg);
        });
        expect(handlers.drop).toHaveBeenCalled();
    });

    it('dispatches SSE events to map and spell overlay handlers', async () => {
        await act(async () => renderMap());
        const eventSource = MockEventSource.instances[0];
        expect(eventSource).toBeTruthy();
        const payload = { type: 'map-data', value: { players: [] } };
        await act(async () => {
            eventSource.onmessage({ data: JSON.stringify(payload) });
        });
        expect(handlers.mapSSE).toHaveBeenCalledWith(payload);
        expect(handlers.spellOverlaySSE).toHaveBeenCalledWith(payload);
    });
});

describe('Map - toolbar interactions', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        Object.assign(mockState, {
            mapData: createMockMapData(),
            placedItems: [],
            rulerMode: false,
        });
        mockState.selectStart.current = null;
        mockState.moveStartGrid.current = null;
        mockState.spellDragActiveRef.current = false;
        mockLoadMonsters.mockReset();
        mockLoadMonsters.mockImplementation(() => Promise.resolve([]));
    });

    it('enables ruler mode and resets ruler when toggled on', async () => {
        await act(async () => renderMap());
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /ruler/i }));
        });
        expect(handlers.setRulerMode).toHaveBeenCalledWith(true);
        expect(handlers.resetRuler).toHaveBeenCalled();
    });

    it('disables ruler mode without resetting ruler when toggled off', async () => {
        mockState.rulerMode = true;
        await act(async () => renderMap());
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /ruler/i }));
        });
        expect(handlers.setRulerMode).toHaveBeenCalledWith(false);
        expect(handlers.resetRuler).not.toHaveBeenCalled();
    });

    it('opens and closes the items panel', async () => {
        const { container } = await act(async () => renderMap());
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /items/i }));
        });
        expect(container.querySelector('.items-panel-close')).toBeInTheDocument();
        await act(async () => {
            fireEvent.click(container.querySelector('.items-panel-close'));
        });
        expect(container.querySelector('.items-panel-close')).not.toBeInTheDocument();
    });

    it('opens the items panel for an outdoor map variant', async () => {
        mockState.mapData = createMockMapData({ parentHex: true });
        const { container } = await act(async () => renderMap());
        await act(async () => {
            fireEvent.click(screen.getByRole('button', { name: /items/i }));
        });
        expect(container.querySelector('.items-panel-close')).toBeInTheDocument();
    });
});

describe('Map - selection and move previews', () => {
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
        });
        mockState.selectStart.current = null;
        mockState.moveStartGrid.current = null;
        mockState.spellDragActiveRef.current = false;
        mockLoadMonsters.mockReset();
        mockLoadMonsters.mockImplementation(() => Promise.resolve([]));
    });

    it('renders a selection preview when selectStart and selectionRect are set', async () => {
        mockState.selectStart.current = { gridX: 2, gridY: 3 };
        mockState.selectionRect = { minX: 2, maxX: 4, minY: 3, maxY: 5 };
        const { container } = await act(async () => renderMap());
        const preview = container.querySelector('rect.selection-preview');
        expect(preview).toBeTruthy();
    });

    it('does not render selection preview when selectStart is null', async () => {
        mockState.selectStart.current = null;
        mockState.selectionRect = { minX: 2, maxX: 4, minY: 3, maxY: 5 };
        const { container } = await act(async () => renderMap());
        expect(container.querySelector('rect.selection-preview')).toBeFalsy();
    });
});
