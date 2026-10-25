// @maintained-by-ai
// ─── Lane: placed-item CLICK-select → visible delete dock ────────────────────
// OWNED here — the click-to-select affordance lane (backlog 2026-10-25:
// token delete was contextmenu-only), end to end through the real Map:
//   - GM (localhost): left-click (press + click at the same cell/px — the
//     real-browser shape where pointer capture retargets the click to the svg
//     root) selects the item and surfaces ItemDetailsDock: a NORMAL DOM button
//     whose accessible name is `Delete "<item name>"`. The SVG context menu
//     does NOT open on this lane.
//   - the dock's Delete fires the SAME named-confirm + persistence seam as the
//     contextmenu lane (accept → item gone from placedItems AND the autosave
//     PUT payload; cancel → inert: item stays, no payload drops it).
//   - the dock is derived: click on empty canvas deselects and the dock
//     unmounts (no stale control); a drag (click lands on a different cell)
//     never selects; right-click keeps the byte-identical SVG menu lane with
//     NO dock.
//
// NOT OWNED — cited to owner lanes:
//   confirm wording bytes + label fallback + selection-clear seam → hooks/usePlacedItems.test.js (#909)
//   contextmenu label census + dispatch                     → ItemContextMenu.test.jsx (#918)
//   contextmenu open/anchor/swap/close wiring               → Map-context-menus.test.jsx
//   right-click payload bytes + defaultPrevented            → PlacedItems-event-handlers.test.jsx
//   end-to-end contextmenu delete + LAN no-affordance       → PlacedItems.delete.test.jsx
//   autosave debounce mechanics                             → hooks/useMapLoader.test.js
import { render, fireEvent, act, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Map from './Map.jsx';
import { clearRuntimeState } from '../../hooks/runtime/useRuntimeState.js';

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

const npcToken = { id: 'npc-qa', type: 'npc', name: 'QA Marta', gridX: 5, gridY: 5, visible: true };
// Press/click bytes: cell (5,5) center at 40px cells = (220,220). A real click
// carries the SAME coords as the pointerdown once capture retargets it to the
// svg root; resolveItemClick requires same-cell + ≤5px movement.
const CLICK_AT = { clientX: 220, clientY: 220 };

vi.mock('../../services/ui/dataLoader.js', () => ({
    loadMonsters: () => Promise.resolve([]),
}));

vi.mock('../../services/maps/mapsService.js', () => ({
    loadMapData: vi.fn(() => Promise.resolve(null)),
    saveMapData: vi.fn(() => Promise.resolve({})),
    formatMapName: vi.fn((name) => name),
    loadMaps: vi.fn(() => Promise.resolve({ maps: [] })),
}));

import * as mapsService from '../../services/maps/mapsService.js';

vi.mock('../../hooks/runtime/useLog.js', () => ({
    default: vi.fn(() => ({ logEntries: [], initialized: true, addEntry: vi.fn() })),
}));

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
        placedItemsRef: { current: [] },
        mapDataRef: { current: null },
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
    default: () => <div data-testid="monster-card-modal" />,
}));

const renderMap = (overrides = {}) =>
    render(
        <Map
            campaignName="test-campaign"
            characters={[]}
            isLocalhost
            mapName="battle-arena"
            onBack={vi.fn()}
            onEncounterCreated={vi.fn()}
            onPoiEntered={vi.fn()}
            {...overrides}
        />
    );

// Real useMapLoader autosave (AUTOSAVE_DEBOUNCE_MS 1000) on real timers —
// same convention as PlacedItems.delete.test.jsx.
const settleAutosave = () => act(async () => { await new Promise(r => setTimeout(r, 1300)); });

const npcHitAreas = (container) => container.querySelectorAll('g.npc-group rect[fill="transparent"]');

// The full click shape the browser delivers: pointerdown on the hit area
// (records the press via Map's tracked wrapper) + click on the svg root
// (consumes it). Mirrors the live-retargeted event sequence.
const clickToken = async (container) => {
    await act(async () => {
        fireEvent(npcHitAreas(container)[0], new PointerEvent('pointerdown', { bubbles: true, button: 0, ...CLICK_AT }));
    });
    await act(async () => {
        fireEvent.click(container.querySelector('svg'), { button: 0, ...CLICK_AT });
    });
};

const deleteDockButton = () => screen.getByRole('button', { name: 'Delete "QA Marta"' });

let confirmSpy;

describe('placed-item click-select → visible delete dock', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        clearRuntimeState('test-campaign');
        clearRuntimeState('campaign');
        MockEventSource.instances.length = 0;
        mapsService.loadMapData.mockResolvedValue({
            players: [],
            walls: [],
            revealed: [],
            gridSize: 30,
            placedItems: [npcToken],
        });
        mapsService.saveMapData.mockResolvedValue({});
        confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    });

    afterEach(() => {
        confirmSpy.mockRestore();
    });

    it('GM: click-select surfaces the dock (DOM button named Delete "<name>") and NOT the svg context menu', async () => {
        const { container } = await act(async () => renderMap());
        await settleAutosave();
        expect(screen.queryByRole('button', { name: 'Delete "QA Marta"' })).not.toBeInTheDocument();

        await clickToken(container);

        const btn = deleteDockButton();
        expect(btn.tagName).toBe('BUTTON');
        expect(container.querySelector('.item-details-dock')).toBeInTheDocument();
        // Named token: plain name everywhere, no coord suffix.
        expect(container.querySelector('.item-details-dock')).toHaveAttribute('aria-label', 'Selected item: QA Marta');
        expect(container.querySelector('.item-details-dock-name').textContent).toBe('QA Marta');
        // click lane never opens the right-click menu
        expect(container.querySelectorAll('.item-context-menu')).toHaveLength(0);
        // confirm not yet asked — selection alone is inert
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('GM: dock Delete asks the SAME named confirm; accept removes the item and persists the filtered array', async () => {
        const { container } = await act(async () => renderMap());
        await settleAutosave();
        await clickToken(container);

        await act(async () => { fireEvent.click(deleteDockButton()); });

        expect(confirmSpy).toHaveBeenCalledWith('Delete "QA Marta" from the map?');
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(0);
        // Dock is derived from the selection — deleting the item unmounts it.
        expect(container.querySelector('.item-details-dock')).not.toBeInTheDocument();

        await settleAutosave();
        expect(mapsService.saveMapData).toHaveBeenCalled();
        const lastPayload = mapsService.saveMapData.mock.calls.at(-1)[2];
        expect(lastPayload.placedItems).toEqual([]);
        expect(lastPayload.map).toBeUndefined();
    });

    it('GM: canceling the dock Delete is inert — item and dock stay, every persisted payload keeps the token', async () => {
        confirmSpy.mockReturnValue(false);
        const { container } = await act(async () => renderMap());
        await settleAutosave();
        await clickToken(container);

        await act(async () => { fireEvent.click(deleteDockButton()); });

        expect(confirmSpy).toHaveBeenCalledWith('Delete "QA Marta" from the map?');
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
        expect(container.querySelector('.item-details-dock')).toBeInTheDocument();
        await settleAutosave();
        mapsService.saveMapData.mock.calls.forEach(([, , payload]) =>
            expect(payload.placedItems).toEqual([expect.objectContaining({ id: 'npc-qa' })])
        );
    });

    it('GM: palette-default NPC (name "NPC") is cell-anchored in dock text, both aria-labels, and the confirm', async () => {
        // Backlog 2026-10-25 pm: every unnamed palette token read "NPC" —
        // ambiguous with several on one map. Unnamed + numeric cell ⇒ `NPC (x,y)`
        // through the ONE placedItemLabel source (dock name, both arias, confirm).
        mapsService.loadMapData.mockResolvedValue({
            players: [],
            walls: [],
            revealed: [],
            gridSize: 30,
            placedItems: [{ id: 'npc-anon', type: 'npc', name: 'NPC', gridX: 5, gridY: 5, visible: true }],
        });
        const { container } = await act(async () => renderMap());
        await settleAutosave();

        await clickToken(container);

        const dock = container.querySelector('.item-details-dock');
        expect(dock).toHaveAttribute('aria-label', 'Selected item: NPC (5,5)');
        expect(dock.querySelector('.item-details-dock-name').textContent).toBe('NPC (5,5)');
        const btn = screen.getByRole('button', { name: 'Delete "NPC (5,5)"' });
        expect(btn).toBeInTheDocument();

        await act(async () => { fireEvent.click(btn); });
        expect(confirmSpy).toHaveBeenCalledWith('Delete "NPC (5,5)" from the map?');
    });

    it('GM: click on empty canvas deselects — the dock unmounts, no stale control', async () => {
        const { container } = await act(async () => renderMap());
        await settleAutosave();
        await clickToken(container);
        expect(container.querySelector('.item-details-dock')).toBeInTheDocument();

        await act(async () => {
            fireEvent.click(container.querySelector('svg'), { button: 0, clientX: 500, clientY: 500 });
        });

        expect(container.querySelector('.item-details-dock')).not.toBeInTheDocument();
        expect(container.querySelectorAll('g.npc-group')).toHaveLength(1);
    });

    it('GM: a DRAG (release lands on a different cell) never selects — dock stays hidden', async () => {
        const { container } = await act(async () => renderMap());
        await settleAutosave();

        await act(async () => {
            fireEvent(npcHitAreas(container)[0], new PointerEvent('pointerdown', { bubbles: true, button: 0, ...CLICK_AT }));
        });
        await act(async () => {
            // click retargeted to the svg root but 3 cells to the right
            fireEvent.click(container.querySelector('svg'), { button: 0, clientX: 340, clientY: 220 });
        });

        expect(container.querySelector('.item-details-dock')).not.toBeInTheDocument();
        expect(confirmSpy).not.toHaveBeenCalled();
    });

    it('GM: right-click lane unchanged — svg menu opens, dock stays hidden', async () => {
        const { container } = await act(async () => renderMap());
        await settleAutosave();

        await act(async () => { fireEvent.contextMenu(npcHitAreas(container)[0]); });

        expect(container.querySelectorAll('.item-context-menu')).toHaveLength(1);
        expect(screen.queryByRole('button', { name: 'Delete "QA Marta"' })).not.toBeInTheDocument();
    });

    it('LAN player: no click-select affordance — no hit-area, no dock on click', async () => {
        const { container } = await act(async () => renderMap({ isLocalhost: false }));
        await settleAutosave();

        expect(npcHitAreas(container)).toHaveLength(0);
        await act(async () => {
            fireEvent(container.querySelector('g.npc-group'), new PointerEvent('pointerdown', { bubbles: true, button: 0, ...CLICK_AT }));
            fireEvent.click(container.querySelector('svg'), { button: 0, ...CLICK_AT });
        });
        expect(container.querySelector('.item-details-dock')).not.toBeInTheDocument();
        expect(mapsService.saveMapData).not.toHaveBeenCalled();
    });
});
